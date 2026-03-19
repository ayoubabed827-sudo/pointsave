# PointSave — Structure des fichiers

## Organisation

```
pointsave/
├── index.html              → Page principale (Meaux)
├── sitemap.xml             → Sitemap pour Google
├── wrangler.toml           → Config Cloudflare
├── .assetsignore           → Fichiers exclus du déploiement
│
├── lieux/                  → Pages villes (13 pages SEO)
│   ├── chelles.html
│   ├── lagny-sur-marne.html
│   ├── torcy.html
│   ├── noisiel.html
│   ├── claye-souilly.html
│   ├── mitry-mory.html
│   ├── villeparisis.html
│   ├── coulommiers.html
│   ├── trilport.html
│   ├── chessy.html
│   ├── dammartin-en-goele.html
│   ├── la-ferte-sous-jouarre.html
│   └── nanteuil-les-meaux.html
│
└── crm/
    └── crm.html            → Dashboard CRM (login: admin / pointsave2025)
```

## Upload sur GitHub / Cloudflare

IMPORTANT : Sur Cloudflare Pages, tous les fichiers doivent être
à la RACINE du repo. Donc uploadez comme ceci :

- index.html → racine
- sitemap.xml → racine
- wrangler.toml → racine
- chelles.html → racine (pas dans lieux/)
- lagny-sur-marne.html → racine
- ... tous les fichiers villes à la racine
- crm.html → racine

Les dossiers lieux/ et crm/ sont pour votre organisation locale uniquement.

## Choses à faire après mise en ligne

1. Remplacer G-XXXXXXXXXX par votre vrai ID Google Analytics
   → Dans index.html et dans chaque fichier ville

2. Coller votre URL Apps Script
   → Dans index.html : var APPS_SCRIPT_URL = 'VOTRE_URL'
   → Dans crm.html : via l'onglet Parametres

3. Créer votre fiche Google My Business
   → business.google.com → "Meaux" → Catégorie : Auto-école

4. Soumettre chaque page dans Google Search Console
   → search.google.com/search-console → Inspection d'URL

5. Soumettre le sitemap dans Google Search Console
   → Sitemaps → Ajouter : sitemap.xml

## CRM — Accès

URL : https://www.pointsave.fr/crm.html
Login : admin
Mot de passe : pointsave2025

Changez ces identifiants via l'onglet Parametres du CRM.

## Support

contact@pointsave.fr
