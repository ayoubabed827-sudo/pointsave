// setup_kv.js — À lancer UNE SEULE FOIS depuis ton terminal
// Lance avec : node setup_kv.js
//
// Prérequis : Node.js 18+
// Ce script :
//   1. Télécharge les 35 000 communes de France depuis l'API officielle
//   2. Les upload dans Cloudflare KV
//   3. Upload le template HTML

const CF_TOKEN = 'cfut_yq13kwRZNkq5mWrLadLsQXgsnnVMs3JGlTE5xMgY7eb3f490';
const CF_ACCOUNT = '8350ac24659c29521cfe5a3537235833';
const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID; // On le récupère après création

const fs = require('fs');
const path = require('path');

// Slugify
function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Appel API Cloudflare KV
async function kvPut(key, value) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CF_TOKEN}`,
        'Content-Type': 'text/plain'
      },
      body: typeof value === 'string' ? value : JSON.stringify(value)
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`KV PUT failed: ${err}`);
  }
}

// Upload en batch (max 10 000 clés par requête)
async function kvBulkPut(entries) {
  const BATCH = 5000;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batch)
      }
    );
    const data = await res.json();
    if (!data.success) throw new Error(JSON.stringify(data.errors));
    console.log(`  ✅ Batch ${i}-${i+batch.length} uploadé`);
  }
}

async function main() {
  console.log('🚀 Setup KV PointSave France\n');

  if (!KV_NAMESPACE_ID) {
    console.error('❌ Manque KV_NAMESPACE_ID');
    console.log('Lance : KV_NAMESPACE_ID=xxx node setup_kv.js');
    process.exit(1);
  }

  // 1. Télécharger les communes
  console.log('📥 Téléchargement des communes françaises...');
  const res = await fetch(
    'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,centre&format=json&geometry=centre'
  );
  const communes = await res.json();
  console.log(`✅ ${communes.length} communes téléchargées\n`);

  // 2. Préparer les données
  const communeMap = {};
  const deptMap = {}; // dept -> [communes]

  for (const c of communes) {
    if (!c.codesPostaux || !c.codesPostaux.length) continue;
    const cp = c.codesPostaux[0];
    const dept = c.codeDepartement;
    const lat = c.centre?.coordinates?.[1] || null;
    const lon = c.centre?.coordinates?.[0] || null;
    const slug = slugify(c.nom);

    const data = { nom: c.nom, cp, dept, lat, lon };
    communeMap[slug] = data;

    if (!deptMap[dept]) deptMap[dept] = [];
    deptMap[dept].push(data);
  }

  console.log(`📦 ${Object.keys(communeMap).length} slugs uniques`);

  // 3. Upload communes individuelles en bulk
  console.log('\n📤 Upload communes dans KV...');
  const bulkEntries = Object.entries(communeMap).map(([slug, data]) => ({
    key: slug,
    value: JSON.stringify(data)
  }));
  await kvBulkPut(bulkEntries);
  console.log(`✅ ${bulkEntries.length} communes uploadées\n`);

  // 4. Upload données par département (pour calcul voisines)
  console.log('📤 Upload données par département...');
  const deptEntries = [];
  
  // Depts voisins pour étendre la recherche
  const DEPT_VOISINS = {
    '75':['92','93','94'], '92':['75','78','91','93','95'],
    '93':['75','77','94','95'], '94':['75','77','91','92','93'],
    '77':['75','91','93','94'], '78':['75','91','92','95'],
    '91':['75','77','78','92','94'], '95':['75','78','92','93']
  };

  for (const [dept, coms] of Object.entries(deptMap)) {
    // Inclure aussi les communes des depts voisins
    const voisinsDepts = DEPT_VOISINS[dept] || [];
    let allComs = [...coms];
    for (const vd of voisinsDepts) {
      if (deptMap[vd]) allComs = allComs.concat(deptMap[vd]);
    }
    deptEntries.push({
      key: `__voisines_${dept}__`,
      value: JSON.stringify(allComs)
    });
  }

  await kvBulkPut(deptEntries);
  console.log(`✅ ${deptEntries.length} départements uploadés\n`);

  // 5. Upload template HTML
  console.log('📤 Upload template HTML...');
  const templatePath = path.join(__dirname, 'template_commune.html');
  if (!fs.existsSync(templatePath)) {
    console.error('❌ template_commune.html introuvable');
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');
  await kvPut('__template__', template);
  console.log('✅ Template uploadé\n');

  console.log('🎉 SETUP TERMINÉ !');
  console.log(`📊 ${bulkEntries.length} pages communes disponibles`);
  console.log('🌐 Déploie le _worker.js sur GitHub pour activer');
}

main().catch(err => {
  console.error('❌ ERREUR:', err.message);
  process.exit(1);
});
