# Android widget - etat apres passage en version gratuite

Le projet Android natif existe toujours dans `android-widget-app/`.

Ancien mode:

- consommation d'un endpoint Node `/api/public/widget`

Nouveau mode recommande:

- consommation de la source gratuite finale
- soit `data/season.json` publie statiquement
- soit la table `season_data` via Supabase

La vue web `public/widget.html` est deja alignee sur cette nouvelle logique:

- elle charge la saison via `public/data-source.js`
- elle reconstruit ensuite le payload widget cote client

Conclusion:

- le web widget est pret pour la version gratuite
- l'app Android native doit etre rebranchee sur la source gratuite retenue une fois l'URL publique finale connue
