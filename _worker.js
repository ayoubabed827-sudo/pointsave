// PointSave — Worker France entière
// Génère une page SEO par commune à la volée depuis KV

const CF_ACCOUNT = '8350ac24659c29521cfe5a3537235833';

// Slugify : "Saint-Flour" -> "saint-flour"
function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Distance GPS en km
function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Voisines : 6 communes les plus proches
function getVoisines(commune, allCommunes) {
  const DEPT_VOISINS = {
    '75':['92','93','94'], '92':['75','78','91','93','95'],
    '93':['75','77','94','95'], '94':['75','77','91','92','93'],
    '77':['75','91','93','94'], '78':['75','91','92','95'],
    '91':['75','77','78','92','94'], '95':['75','78','92','93']
  };
  const dept = commune.dept;
  const voisinsDepts = [dept, ...(DEPT_VOISINS[dept] || [])];
  
  let candidates = allCommunes.filter(c =>
    c.nom !== commune.nom && voisinsDepts.includes(c.dept)
  );

  if (commune.lat && commune.lon) {
    candidates = candidates.filter(c => c.lat && c.lon);
    candidates.sort((a, b) =>
      distKm(commune.lat, commune.lon, a.lat, a.lon) -
      distKm(commune.lat, commune.lon, b.lat, b.lon)
    );
  } else {
    candidates.sort((a, b) =>
      Math.abs(parseInt(a.cp) - parseInt(commune.cp)) -
      Math.abs(parseInt(b.cp) - parseInt(commune.cp))
    );
  }
  return candidates.slice(0, 6);
}

// Générer le HTML des voisines
function buildVoisinesHTML(voisines) {
  return voisines.map(v => {
    const slug = slugify(v.nom);
    return `<a href="/${slug}" class="ml-link">${v.nom} <span class="ml-dept">(${v.cp})</span></a>`;
  }).join('');
}

// Générer la page complète
function buildPage(commune, allCommunes, TEMPLATE) {
  const ville = commune.nom;
  const cp = commune.cp;
  const dept = commune.dept;
  const slug = slugify(ville);
  const villeUrl = encodeURIComponent(ville);
  const voisines = getVoisines(commune, allCommunes);
  const voisinesHTML = buildVoisinesHTML(voisines);

  return TEMPLATE
    .replace(/{{META_TITLE}}/g, `Stage Récupération Points ${ville} | PointSave`)
    .replace(/{{META_DESC}}/g, `Stage récupération de points agréé près de ${ville} (${cp}). Centres agréés dans un rayon de 30km. Appelez le +33 6 99 92 65 10.`)
    .replace(/{{SLUG}}/g, slug)
    .replace(/{{CP}}/g, cp)
    .replace(/{{DEPT_NUM}}/g, dept)
    .replace(/{{VILLE_URL}}/g, villeUrl)
    .replace(/{{VILLE}}/g, ville)
    .replace(/{{VOISINES_HTML}}/g, voisinesHTML);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/^\//, '').replace(/\.html$/, '');

    // Pages statiques existantes → passer au Pages
    if (path === '' || path === 'index' || path === 'crm' ||
        path.startsWith('cdn-cgi') || path.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // Lookup commune dans KV
    const communeJSON = await env.COMMUNES_KV.get(path);
    if (!communeJSON) {
      // Pas trouvé → 404 ou page index
      return env.ASSETS.fetch(request);
    }

    const commune = JSON.parse(communeJSON);

    // Charger le template et toutes les communes voisines potentielles
    const [template, voisinesData] = await Promise.all([
      env.COMMUNES_KV.get('__template__'),
      env.COMMUNES_KV.get(`__voisines_${commune.dept}__`)
    ]);

    if (!template) {
      return new Response('Template non trouvé', { status: 500 });
    }

    // Construire la liste de voisines candidates
    let allCommunes = [];
    if (voisinesData) {
      allCommunes = JSON.parse(voisinesData);
    }

    const html = buildPage(commune, allCommunes, template);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=86400',
        'X-Generated-By': 'PointSave-Worker'
      }
    });
  }
};
