import json, base64, re, unicodedata, os, requests

# Strip tous les caractères invisibles du token (zero-width space etc.)
GH_TOKEN = ''.join(c for c in os.environ['GH_TOKEN'] if ord(c) < 128 and c.isprintable())
GH_REPO = os.environ['GH_REPO']
GH_HEADERS = {
    'Authorization': 'Bearer ' + GH_TOKEN,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
}

def slugify(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s

def gh_get_sha(path):
    r = requests.get(
        f'https://api.github.com/repos/{GH_REPO}/contents/{path}',
        headers=GH_HEADERS
    )
    return r.json().get('sha') if r.ok else None

def gh_put_file(path, content_str, message):
    sha = gh_get_sha(path)
    b64 = base64.b64encode(content_str.encode('utf-8')).decode('ascii')
    body = {'message': message, 'content': b64}
    if sha:
        body['sha'] = sha
    r = requests.put(
        f'https://api.github.com/repos/{GH_REPO}/contents/{path}',
        headers=GH_HEADERS,
        json=body
    )
    if not r.ok:
        raise Exception(f'GitHub API error {r.status_code}: {r.text[:200]}')
    return r.json()['commit']['sha']

print('Telechargement communes...')
r = requests.get(
    'https://geo.api.gouv.fr/communes?fields=nom,codesPostaux,codeDepartement,centre&format=json&geometry=centre'
)
communes = r.json()
print(f'OK: {len(communes)} communes')

dept_map = {}
index = {}
for c in communes:
    if not c.get('codesPostaux'):
        continue
    dept = c['codeDepartement']
    cp = c['codesPostaux'][0]
    nom = c['nom']
    coords = c.get('centre', {}).get('coordinates', [None, None])
    lon, lat = coords[0], coords[1]
    if dept not in dept_map:
        dept_map[dept] = []
    data = {'nom': nom, 'cp': cp, 'dept': dept, 'lat': lat, 'lon': lon}
    dept_map[dept].append(data)
    slug = slugify(nom)
    if slug:
        index[slug] = data

print(f'Upload {len(dept_map)} fichiers...')
i = 0
for dept, coms in sorted(dept_map.items()):
    gh_put_file(
        f'public/data/dept-{dept}.json',
        json.dumps(coms, ensure_ascii=False),
        f'data: communes dept-{dept}'
    )
    i += 1
    if i % 10 == 0:
        print(f'  {i}/{len(dept_map)} depts...')

gh_put_file(
    'public/data/index.json',
    json.dumps(index, ensure_ascii=False),
    f'data: index {len(index)} communes'
)
print(f'DONE: {i} depts + index ({len(index)} communes)')
