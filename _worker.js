// PointSave — Worker France entière
// Génère une page SEO par commune à la volée depuis KV

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getVoisines(commune, allCommunes) {
  if (!commune.lat || !commune.lon || !allCommunes.length) return [];
  return allCommunes
    .filter(c => c.nom !== commune.nom && c.lat && c.lon)
    .map(c => ({ ...c, d: distKm(commune.lat, commune.lon, c.lat, c.lon) }))
    .sort((a, b) => a.d - b.d)
    .filter(c => c.d <= 50)
    .slice(0, 6);
}

function buildVoisinesHTML(voisines) {
  return voisines.map(v => {
    const slug = slugify(v.nom);
    return `<a href="/${slug}" class="ml-link">${v.nom} <span class="ml-dept">(${v.cp})</span></a>`;
  }).join('');
}

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

// Depts voisins pour récupérer les communes proches
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
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/^\//, '').replace(/\.html$/, '');

    // Pages statiques → ASSETS
    if (path === '' || path === 'index' || path === 'crm' ||
        path.startsWith('cdn-cgi') || path.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // Lookup commune dans KV
    const communeJSON = await env.COMMUNES_KV.get(path);
    if (!communeJSON) {
      return env.ASSETS.fetch(request);
    }

    const commune = JSON.parse(communeJSON);

    // Charger template + communes du dept + depts voisins EN PARALLÈLE
    const dept = commune.dept;
    const voisinsDepts = [dept, ...(DEPT_VOISINS[dept] || [])];

    // Charger toutes les communes des depts voisins depuis KV
    // On utilise __dept_XX__ qui contient toutes les communes du dept
    const [template, ...deptDataArr] = await Promise.all([
      env.COMMUNES_KV.get('__template__'),
      ...voisinsDepts.map(d => env.COMMUNES_KV.get(`__dept_${d}__`))
    ]);

    if (!template) {
      return new Response('Template non trouvé', { status: 500 });
    }

    // Assembler toutes les communes candidates
    let allCommunes = [];
    for (const data of deptDataArr) {
      if (data) {
        try { allCommunes = allCommunes.concat(JSON.parse(data)); } catch(e) {}
      }
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
