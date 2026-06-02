# Data model - FC Régny Widget

Dans la version sécurisée, les données partagées sont stockées dans `data/season.json` et servies par l'API.

## Objet racine

```json
{
  "club": {},
  "season": {},
  "summary": {},
  "standingsTable": [],
  "matches": [],
  "lastUpdated": "2026-06-01T10:00:00+02:00"
}
```

## Club

```json
{
  "name": "FC Régny",
  "fullName": "Football Club de Régny",
  "trackedTeam": "REGNY FC",
  "defaultVenue": "Rue du Collège, 42630 Régny",
  "sourceLabel": "FFF / SportCorico",
  "logoPath": "/assets/logo-fc-regny.png"
}
```

## Saison

```json
{
  "label": "2025/2026",
  "team": "Seniors 1",
  "competition": "District 4 R - Senior - Poule C",
  "district": "Délégation du Roannais"
}
```

## Résumé classement

```json
{
  "rank": 12,
  "points": 13,
  "played": 21,
  "goalDifference": -45
}
```

## Ligne de classement

```json
{
  "rank": 12,
  "team": "REGNY FC",
  "points": 13,
  "played": 21,
  "wins": 4,
  "draws": 1,
  "losses": 16,
  "goalsFor": 27,
  "goalsAgainst": 72,
  "goalDifference": -45
}
```

## Match

```json
{
  "id": "2026-05-31-d4j22",
  "date": "2026-05-31T15:00:00+02:00",
  "competition": "District 4 R - Journée 22",
  "round": "Journée 22",
  "type": "championship",
  "homeTeam": "REGNY FC 1",
  "awayTeam": "O. EST ROANNAIS 2",
  "homeScore": 4,
  "awayScore": 3,
  "status": "finished",
  "venue": "Régny"
}
```

## Règles de rendu

1. Le widget cherche d'abord un prochain match non terminé.
2. S'il n'y en a pas, il affiche le dernier match terminé.
3. Les trois derniers matchs terminés restent visibles dans le résumé.
4. Le calendrier trie toujours les matchs par date croissante.
5. Le classement met en évidence l'équipe suivie à partir de `club.trackedTeam`.
