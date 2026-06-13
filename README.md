# Onzeo

Application et widget statiques pour diffuser les infos club:

- un espace public en lecture seule
- une administration en ligne via Supabase
- un widget web compact pour mobile

## Architecture

- `public/` : site statique a publier
- `data/season.json` : jeu de donnees de base et fallback local
- `public/data/roannais-catalog.json` : catalogue verifie des clubs Roannais D1 a D5
- `public/data/roannais-bundles/` : un bundle JSON par equipe
- `public/data-source.js` : couche d'acces aux donnees
- `public/config.js` : choix du provider `local` ou `supabase`
- `scripts/build_static_site.js` : genere `dist-static/`
- `scripts/generate_roannais_bundles.js` : regenere les donnees verifiees depuis SportCorico

## Modes disponibles

### 1. Mode local demo

Par defaut, `public/config.js` pointe sur:

- `provider: "local"`
- `seasonFile: "./data/season.json"`

Ce mode permet de visualiser le site sans backend, mais l'admin en ligne reste desactivee.

### 2. Mode club gratuit

Pour la vraie version gratuite:

- hebergement statique
- Supabase pour l'admin et la source centrale

Le setup complet est documente dans `docs/SUPABASE_SETUP.md`.

## Lancer en local

```bash
npm run serve
```

Le serveur Node reste utile pour la previsualisation locale, mais il n'est plus obligatoire pour la production gratuite.

## Generer le site statique

```bash
npm run build:static
```

Le site pret a publier est genere dans `dist-static/`.

## Validation

Regenerer les donnees verifiees:

```bash
npm run generate:roannais
```

```bash
npm run check
```

## Deploiement

Un workflow GitHub Pages est fourni dans `.github/workflows/deploy-pages.yml`.

Attention:

- GitHub Pages sur repo prive depend du plan GitHub
- si tu veux rester en prive sans payer, prefere Cloudflare Pages

## Android

Le widget Android natif existe toujours dans `android-widget-app/`.
La prochaine etape logique consiste a le rebrancher sur la source gratuite finale une fois l'URL publique choisie.
