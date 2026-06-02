# FC Régny - Widget public + admin sécurisée

Projet web pour diffuser à tout le club:

- un **widget public** en lecture seule pour joueurs, coachs et membres ;
- une **administration sécurisée côté serveur** pour mettre à jour les données partagées.

Version actuelle : **V2.0**

## Ce qui change par rapport à l'ancienne version

L'ancienne admin était protégée uniquement dans le navigateur, avec un mot de passe visible dans le code source.  
Cette version corrige ce point:

- le widget public ne contient plus d'outils admin ;
- le mot de passe admin n'est plus embarqué dans le front ;
- les mises à jour passent par une API serveur avec session HTTP-only ;
- les données sont partagées dans `data/season.json` pour tous les utilisateurs.

## Structure

```txt
fc-regny-widget-codex/
├─ data/
│  └─ season.json
├─ docs/
├─ public/
│  ├─ index.html
│  ├─ admin.html
│  ├─ app.js
│  ├─ admin.js
│  ├─ shared.js
│  ├─ styles.css
│  └─ assets/
│     └─ logo-fc-regny.png
├─ scripts/
│  ├─ generate_password_hash.js
│  └─ validate_project.js
├─ server.js
└─ package.json
```

## Lancer le projet

```bash
npm run serve
```

Le serveur écoute par défaut sur `http://localhost:4173`.

## Configuration admin

Pour un usage local simple, tu peux lancer avec un mot de passe temporaire:

```bash
$env:ADMIN_PASSWORD="mot-de-passe-local"
npm run serve
```

Pour un vrai déploiement, il faut utiliser un **hash** et un **secret de session**.

### 1. Générer le hash du mot de passe

```bash
node scripts/generate_password_hash.js "TonMotDePasseFort"
```

### 2. Définir les variables d'environnement

Variables recommandées en production:

```txt
PORT=4173
APP_ORIGIN=https://widget.fc-regny.fr
SESSION_SECRET=une-cle-secrete-longue-et-aleatoire
ADMIN_PASSWORD_HASH=scrypt$...
COOKIE_SECURE=true
NODE_ENV=production
DATA_DIR=./data
```

## Déployer sur Render

Le dépôt contient maintenant un `render.yaml` prêt pour Render.

Points importants:

- le service est prévu en `starter`, pas en gratuit ;
- Render utilise un système de fichiers éphémère par défaut ;
- comme l'admin écrit dans `season.json`, il faut un **persistent disk** pour conserver les mises à jour du club ;
- le service expose aussi `GET /healthz` pour le health check Render.

Variables Render prévues dans `render.yaml`:

- `SESSION_SECRET` : généré automatiquement par Render ;
- `ADMIN_PASSWORD_HASH` : à renseigner dans le dashboard ;
- `DATA_DIR=/var/data/fc-regny` : stockage persistant des données admin.

Une fois le service en ligne, l'URL publique Render pourra servir:

- le site public ;
- l'admin ;
- le flux Android `GET /api/public/widget`.

## Vérifier le projet

```bash
npm run check
```

Le script valide:

- la présence des fichiers attendus ;
- la séparation public/admin ;
- l'absence de mot de passe en clair côté front ;
- la présence de la protection serveur ;
- la validité du JSON partagé.

## Endpoints

- `GET /api/public/season` : données publiques du widget
- `POST /api/admin/login` : connexion admin
- `POST /api/admin/logout` : déconnexion admin
- `GET /api/admin/session` : état de session
- `GET /api/admin/season` : lecture admin
- `PUT /api/admin/season` : écriture admin

## Sécurité

Cette version apporte:

- cookie de session `HttpOnly` ;
- `SameSite=Strict` ;
- CSP et en-têtes de sécurité ;
- validation serveur des données ;
- limitation basique des tentatives de connexion ;
- séparation stricte entre page publique et page admin ;
- sauvegarde de secours dans `data/backups/` à chaque mise à jour.

## Limites à connaître

- Le stockage reste **fichier**. C'est très bien pour un petit déploiement club, mais moins adapté si plusieurs admins modifient en même temps.
- Il faut absolument déployer derrière **HTTPS**.
- Pour plusieurs rôles fins (coach, staff, super-admin), il faudra ensuite ajouter une vraie gestion d'utilisateurs.
