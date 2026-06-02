# Changelog

## V2.0

- Remplacement de l'ancienne admin côté client par une admin sécurisée côté serveur.
- Suppression du mot de passe exposé dans le HTML public.
- Séparation nette entre `public/index.html` et `public/admin.html`.
- Externalisation des données dans `data/season.json`.
- Ajout d'une API HTTP pour la lecture publique et l'écriture admin.
- Ajout d'une session admin `HttpOnly` avec signature serveur.
- Ajout d'un script de génération de hash de mot de passe.
- Remplacement de la validation Python par une validation Node.js.
- Réduction massive du poids du widget public en retirant le logo base64 et le gros bloc inline.

## V1.6

- Logo exact intégré.
- Suppression du cadre UI autour du logo.
- Suppression des effets de cadre et d'ombre sur le logo.
- Conservation des thèmes sombre et clair.
- Conservation du menu admin protégé.

## V1.5

- Logo rendu plus visible.
- Filigrane widget renforcé.
- Rendu plus premium dans l'en-tête.

## V1.4

- Tentative de logo sans fond et sans cadre.
- Adaptation des styles de logo.

## V1.3

- Interface publique nettoyée.
- Ajout d'un menu.
- Ajout d'une zone administration protégée.
- Masquage des informations admin dans l'interface publique.

## V1.2

- Intégration du logo FC Régny.
- Ajout thème sombre orange/noir.
- Ajout thème clair orange/blanc.

## V1.1

- Ajout onglet calendrier complet.
- Ajout onglet classement général.

## V1.0

- Première version HTML autonome.
- Résumé club.
- Dernier/prochain match.
- Trois derniers matchs.
