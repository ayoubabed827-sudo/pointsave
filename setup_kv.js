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
      '01':['39','71','69','38','73','74'],'02':['60','95','78','76','51','80'],
      '03':['71','58','18','23','63','43'],'04':['05','26','84','83','06'],
      '05':['04','26','38','73'],'06':['83','04'],'07':['63','43','15','48','30','26','38'],
      '08':['59','02','51','55'],'09':['31','66','11','34'],'10':['89','77','51','52'],
      '11':['34','09','66','31'],'12':['46','48','30','34','81','82'],
      '13':['83','84','04'],'14':['76','50','61','27'],'15':['43','48','12','46','63','19'],
      '16':['87','23','19','24','33','17'],'17':['79','16','33','85','44'],
      '18':['45','89','58','23','03','36','41'],'19':['87','23','15','63','46','24','16'],
      '21':['71','58','89','10','52','70','39'],'22':['29','56','35'],
      '23':['03','19','87','15','63','36'],'24':['16','87','19','46','47','33'],
      '25':['39','21','70','90','68'],'26':['07','63','43','48','30','84','04','05','38'],
      '27':['76','95','78','28','61','14'],'28':['72','41','18','45','91','78','27','61'],
      '29':['22','56'],'30':['07','48','12','34','13','84'],'31':['32','65','09','11','81','82'],
      '32':['40','65','31','82','47','33'],'33':['17','16','24','47','40','32'],
      '34':['30','12','81','11','09'],'35':['22','56','44','53','72'],
      '36':['18','23','87','86','79','41'],'37':['41','45','86','79','72'],
      '38':['01','73','05','26','07','69','42'],'39':['21','71','01','25'],
      '40':['33','47','32','65','64'],'41':['37','45','18','28','36','72'],
      '42':['63','43','07','26','38','69','71'],'43':['15','12','48','07','42','63'],
      '44':['85','49','72','35','56'],'45':['77','89','58','18','41','28','91'],
      '46':['19','15','12','81','82','47','24'],'47':['24','46','12','82','32','33','40'],
      '48':['43','15','12','30','07'],'49':['44','35','53','72','37','86','79','85'],
      '50':['14','61','35'],'51':['08','55','52','10','89','77','02'],
      '52':['51','55','88','70','21','10'],'53':['61','72','35','49'],
      '54':['57','67','88','55'],'55':['54','57','52','51','08'],
      '56':['22','29','35','44'],'57':['54','67','55'],'58':['89','21','71','03','18','45'],
      '59':['62','08','02'],'60':['80','02','95','77'],'61':['14','50','35','53','72','28','27'],
      '62':['59','80','02'],'63':['03','23','19','15','43','42','69','71'],
      '64':['40','32','65'],'65':['64','32','31','09'],'66':['09','11'],
      '67':['57','54','88','25','68'],'68':['67','25','90'],
      '69':['42','43','07','26','38','01','71'],'70':['25','90','68','67','88','52'],
      '71':['01','39','21','58','03','42','69'],'72':['28','41','37','49','53','61'],
      '73':['74','01','38','05'],'74':['01','73'],
      '75':['92','93','94'],'76':['80','27','14'],
      '77':['51','10','89','45','91','94','93','60'],'78':['95','92','91','28','27'],
      '79':['17','16','86','49','85'],'80':['62','02','60','76'],
      '81':['31','82','12','34'],'82':['31','32','47','46','12','81'],
      '83':['06','04','13','84'],'84':['26','04','13','30','83'],
      '85':['44','49','79','17'],'86':['79','49','37','36','23','16'],
      '87':['23','19','16','86','36','03'],'88':['57','54','67','68','70','52'],
      '89':['58','21','10','77','45'],'90':['68','25'],
      '91':['78','75','94','77','45','28'],'92':['75','78','91','93','95'],
      '93':['75','77','94','60'],'94':['75','77','91','93'],
      '95':['60','78','92']
    }

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
