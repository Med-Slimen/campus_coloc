# Structure de l'application CampusColoc

Ce dossier contient tout le code source de l'application Angular pour CampusColoc. Voici le rôle de chaque dossier :

- **pages/** : Contient les composants de page (vues complètes associées à une route, comme l'accueil, la liste des annonces, le profil, etc.).
- **components/** : Contient les composants réutilisables partagés (boutons, icônes SVG, cartes d'annonces, squelettes de chargement, messages d'erreur).
- **services/** : Contient les services Angular qui gèrent la logique métier et communiquent avec Firebase (`auth` et `db`). Seuls les services ont le droit d'importer depuis Firebase.
- **models/** : Contient les interfaces TypeScript décrivant les données de l'application (utilisateurs, annonces, demandes, espaces de colocation, messages, etc.).
- **guards/** : Contient les gardes de navigation Angular pour protéger les routes selon l'état de connexion, le rôle de l'utilisateur ou son statut de vérification.
- **layouts/** : Contient les gabarits de mise en page structurant les différentes zones de l'application (`PublicLayout`, `MembreLayout`, `AdminLayout`).

