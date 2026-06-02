# Android Widget Ready

Ce projet expose maintenant un flux dédié au widget Android natif :

- Endpoint : `/api/public/widget`
- Méthode : `GET`
- Format : JSON léger, sans logique d'assemblage à refaire côté Android

## Objectif

Permettre à un futur widget Android (`AppWidgetProvider`, `Glance`, `WorkManager`) de consommer directement :

- le match prioritaire
- le lieu
- la date et l'heure
- la compétition
- le rang de chaque équipe

## Structure renvoyée

```json
{
  "data": {
    "widgetVersion": 1,
    "generatedAt": "2026-06-01T10:00:00+02:00",
    "refreshAfterSeconds": 1800,
    "mode": "split",
    "club": {
      "name": "FC Régny",
      "fullName": "Football Club de Régny",
      "logoPath": "/assets/logo-fc-regny.png",
      "trackedTeam": "REGNY FC"
    },
    "season": {
      "label": "2025/2026",
      "team": "Seniors 1",
      "competition": "District 4 R - Senior - Poule C",
      "district": "Délégation du Roannais"
    },
    "lastMatch": {
      "title": "Dernier match",
      "competition": "District 4 R",
      "kickoffDateLabel": "dim. 31 mai",
      "kickoffTimeLabel": "15:00",
      "scoreLine": "4 - 3"
    },
    "nextMatch": {
      "title": "Prochain match",
      "competition": "District 4 R",
      "venue": "Régny",
      "kickoffDateLabel": "dim. 07 juin",
      "kickoffTimeLabel": "15:00",
      "scoreLine": "Match à venir"
    }
  }
}
```

## Règles métier

- Le payload renvoie séparément `lastMatch` et `nextMatch`.
- Si l'un des deux n'existe pas encore, sa valeur vaut `null`.
- Si aucun match n'est disponible, `mode` vaut `empty`.
- Les rangs sont calculés à partir de `standingsTable` avec la même logique de rapprochement que le front.

## Intégration Android conseillée

- Récupération HTTP périodique avec `WorkManager`
- Stockage local du dernier payload valide
- Rafraîchissement recommandé : toutes les `1800` secondes minimum
- Affichage conseillé :
  - dernier match : score + date
  - prochain match : date + heure + lieu
  - équipes domicile / extérieur avec leurs rangs

## Déjà prêt côté web

- [public/widget.html](C:/Users/maxim/Desktop/fc-regny-widget-codex/public/widget.html) consomme déjà ce flux
- [public/widget.js](C:/Users/maxim/Desktop/fc-regny-widget-codex/public/widget.js) sert de référence de rendu compacte
- [server.js](C:/Users/maxim/Desktop/fc-regny-widget-codex/server.js) expose l'endpoint dédié
