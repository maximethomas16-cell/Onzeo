# Sources de données envisagées

Le projet utilise actuellement des données locales intégrées dans le HTML.

Sources publiques envisagées pour mise à jour manuelle ou automatisée :

- FFF / épreuves ;
- Délégation du Roannais / District Loire ;
- SportCorico ;
- saisie manuelle par l'administrateur.

## Stratégie recommandée

### Court terme

Continuer avec une mise à jour manuelle via l'administration.

### Moyen terme

Créer un fichier JSON maintenu manuellement :

```txt
data/season.json
```

Puis l'héberger sur un serveur ou GitHub Pages.

### Long terme

Créer un connecteur de récupération automatique, avec contrôle manuel avant publication.

## Attention

Les sites publics peuvent changer leur structure HTML.  
Un scraper doit donc être traité comme fragile et testé régulièrement.
