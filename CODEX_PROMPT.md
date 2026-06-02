# Prompt pour Codex — FC Régny Widget

Tu travailles sur un projet HTML autonome situé dans ce dossier.

Commence par lire :

1. `README.md`
2. `docs/DATA_MODEL.md`
3. `docs/ROADMAP.md`
4. `public/index.html`

## Contexte

Le projet est un widget / mini-site mobile pour le FC Régny.

Objectifs actuels :

- afficher le résumé du club ;
- afficher le prochain match ou le dernier match connu ;
- afficher les trois derniers matchs ;
- afficher le calendrier complet de la saison ;
- afficher le classement général ;
- conserver un thème sombre orange/noir et un thème clair orange/blanc ;
- conserver un menu admin protégé par mot de passe ;
- ne pas afficher d'informations d'administration dans l'interface publique.

## Mot de passe admin actuel

```txt
Maxx42630!
```

Attention : c'est une protection visuelle dans un fichier HTML autonome, pas une vraie sécurité serveur.

## Demande prioritaire pour la prochaine itération

Créer une **V1.7 plus premium et plus mobile**, sans casser les fonctions existantes.

Travail attendu :

1. Améliorer le rendu mobile du widget.
2. Rendre le bloc `Résumé` plus compact et plus proche d'un vrai widget téléphone.
3. Conserver le logo actuel, sans cadre ajouté autour.
4. Ne pas afficher les outils admin dans la partie publique.
5. Conserver les onglets :
   - Résumé
   - Calendrier saison
   - Classement général
6. Conserver le thème sombre et le thème clair.
7. Conserver l'admin dans le menu.
8. Mettre à jour `docs/CHANGELOG.md`.
9. Exécuter `npm run check` à la fin.

## Contraintes fortes

- Ne pas ajouter de framework.
- Ne pas ajouter de dépendance obligatoire.
- Ne pas supprimer le fonctionnement en fichier HTML autonome.
- Ne pas remplacer le logo.
- Ne pas supprimer les données de démonstration.
- Ne pas introduire d'appel API obligatoire.
- Ne pas exposer l'administration dans l'interface publique.

## Validation attendue

Avant de terminer :

```bash
npm run check
```

Puis résumer :

- fichiers modifiés ;
- changements principaux ;
- limites restantes ;
- prochaine étape recommandée.
