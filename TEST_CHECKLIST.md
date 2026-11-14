# 📋 TEST_CHECKLIST — Parcours Complet CampusColoc

> Guide et protocole de recette fonctionnelle de bout en bout pour l'application **CampusColoc** (Plateforme de colocation étudiante en Tunisie).

---

## 🎯 Comptes de test préconfigurés

| Profil | Courriel | Rôle | Statut de vérification |
|---|---|---|---|
| **Admin** | `admin@campuscoloc.tn` | `admin` | `verifie` |
| **Bailleur 1** | `moncef.proprietaire@gmail.com` | `proprietaire` | `verifie` |
| **Bailleur 2** | `leila.bailleur@gmail.com` | `proprietaire` | `verifie` |
| **Étudiant 1** | `sami.etudiant@insat.u-carthage.tn` | `etudiant` | `verifie` |
| **Étudiant 2** | `mariem.etudiante@esen.tn` | `etudiant` | `verifie` |
| **Étudiant 3** | `youssef.etudiant@fss.rnu.tn` | `etudiant` | `verifie` |
| **Étudiant 4** | `nour.etudiante@medecine-tunis.tn` | `etudiant` | `verifie` |

*(Mot de passe de démonstration recommandé : `Coloc2026!` ou création libre via `/inscription`)*

---

## 🗺️ Matrice des étapes du parcours utilisateur

### Étape 1 : Inscription (`/inscription`)
- [x] Accéder à `/inscription` en tant que visiteur anonyme.
- [x] Renseigner : Nom complet, Email, Mot de passe (min. 6 caractères) et Confirmation.
- [x] Sélectionner la carte de rôle : **« Je suis étudiant »** ou **« Je suis propriétaire »**.
- [x] Pour un étudiant, renseigner : Faculté/Établissement, Filière et Niveau d'études.
- [x] Valider l'inscription.
- **Résultat attendu** : Redirection automatique vers le tableau de bord correspondant (`/etudiant` ou `/proprietaire`). Document créé dans `users/{uid}` avec `statutVerification: 'non_verifie'`.

### Étape 2 : Dépôt de pièce d'identité (`/profil`)
- [x] Se connecter avec un compte nouvellement créé (`statutVerification: 'non_verifie'`).
- [x] Constater le bandeau d'alerte `VerificationBanner` et la carte du tableau de bord indiquant les fonctionnalités restreintes.
- [x] Se rendre sur `/profil` et accéder à la section **Vérification d'identité**.
- [x] Téléverser la photo de la carte étudiante ou de la CIN.
- [x] Cliquer sur « Envoyer pour vérification ».
- **Résultat attendu** : Le statut passe à `en_attente`. Document créé dans `verifications/`. Toast de confirmation affiché.

### Étape 3 : Modération administrative (`/admin/verifications`)
- [x] Se connecter avec le compte administrateur (`admin@campuscoloc.tn`).
- [x] Accéder à `/admin/verifications` depuis la barre latérale.
- [x] Constater la présence du dossier dans la table des pièces en attente.
- [x] Cliquer sur **« Traiter »** pour ouvrir le panneau latéral avec la prévisualisation du document.
- [x] Tester le refus avec motif obligatoire (notification envoyée à l'utilisateur).
- [x] Tester l'approbation : cliquer sur **« Approuver »**.
- **Résultat attendu** : Le document passe à `statut: 'verifie'`, `users.statutVerification` passe à `'verifie'`. L'utilisateur reçoit une notification interne et un badge vert « Vérifié ».

### Étape 4 : Dépôt et publication d'une annonce (`/mes-annonces`)
- [x] Se connecter avec un propriétaire certifié (`moncef.proprietaire@gmail.com`).
- [x] Constater que le bouton « Publier une annonce » sur `/proprietaire` est actif.
- [x] Remplir le formulaire `/mes-annonces/nouvelle` :
  - Titre, description, gouvernorat (select `VILLES_TUNISIE`), quartier, loyer total, charges, nombre de places (ex: 3), meublé (Oui/Non), durée de location, photos.
  - Vérifier l'affichage en temps réel du budget calculé par personne.
- [x] Enregistrer l'annonce.
- [x] Se reconnecter en tant qu'administrateur et ouvrir `/admin/annonces`.
- [x] Constater l'annonce dans l'onglet **« En attente »** et cliquer sur **« Publier »**.
- **Résultat attendu** : L'annonce passe à `statut: 'publiee'`, le propriétaire est notifié et l'offre apparaît immédiatement sur la page publique `/annonces`.

### Étape 5 : Recherche et filtres de colocation (`/annonces`)
- [x] Ouvrir la page publique `/annonces`.
- [x] Tester le filtre par gouvernorat (ex: « Ariana », « Tunis », « Sousse »).
- [x] Tester le filtre par budget maximum par personne (ex: 350 DT).
- [x] Tester le filtre par nombre minimum de places et meublé.
- [x] Tester les options de tri (Prix croissant, Décroissant, Plus récentes).
- **Résultat attendu** : Filtrage instantané côté client, compteur de résultats exact, mise à jour des paramètres d'URL synchronisée avec la recherche de la page d'accueil.

### Étape 6 : Mise en favoris (`/favoris`)
- [x] Se connecter avec un compte étudiant (`sami.etudiant@insat.u-carthage.tn`).
- [x] Sur une carte d'annonce (`AnnonceCard`) ou la page de détail, cliquer sur l'icône cœur.
- [x] Ouvrir la page `/favoris`.
- [x] Constater la présence du logement sélectionné avec toutes ses caractéristiques.
- [x] Retirer un favori : constater le retrait immédiat et la mise à jour du compteur.
- **Résultat attendu** : Tableau `favoris` de l'utilisateur synchronisé dans Firestore.

### Étape 7 : Envoi d'une candidature de colocation (`/annonces/:id`)
- [x] Ouvrir la fiche d'une annonce publiée sans espace actif.
- [x] En tant qu'étudiant vérifié, cliquer sur **« Je suis intéressé »**.
- [x] Rédiger un message de présentation optionnel dans la modale.
- [x] Confirmer l'envoi.
- **Résultat attendu** : Création d'une `demande` avec statut `'en_attente'`. Notification immédiate adressée au propriétaire bailleur. Le bouton passe à « Demande en cours ».

### Étape 8 : Acceptation et ouverture atomique de l'espace (`/demandes`)
- [x] Se connecter en tant que propriétaire bailleur de l'annonce.
- [x] Ouvrir `/demandes` (Demandes reçues) : constater la candidature de l'étudiant avec ses détails universitaires.
- [x] Cliquer sur **« Accepter la candidature »**.
- **Résultat attendu** : Exécution de la transaction atomique `writeBatch` :
  1. `demande.statut` passe à `'acceptee'`.
  2. Création du document `espaces/{annonceId}` avec `premierLocataireId: etudiantId`, `visibilite: 'prive'`, `statut: 'ouvert'`.
  3. Création du premier membre dans `espaces/{annonceId}/membres/{etudiantId}` avec `premierLocataire: true` et `statutAdhesion: 'accepte'`.
  4. Notification de félicitations transmise à l'étudiant avec lien direct vers `/espace/{annonceId}`.

### Étape 9 : Espace de colocation & Part de loyer (`/espace/:annonceId`)
- [x] Ouvrir la page `/espace/:annonceId` en tant que premier locataire ou propriétaire.
- [x] Vérifier la colonne de gauche : caractéristiques du logement, coordonnées du bailleur (visibles uniquement ici).
- [x] Constater la carte **« Part de loyer par colocataire »** : calcul automatique `(loyer + charges) / nbMembresAcceptes`.
- [x] En tant que premier locataire, éditer et sauvegarder les règles de la maison.
- [x] Basculer la visibilité de l'espace de **Privé** à **Public** : constater l'apparition du badge doré *« Colocation ouverte »* sur la carte de l'annonce dans `/annonces`.

### Étape 10 : Invitation d'un colocataire par courriel
- [x] Dans l'espace, saisir l'adresse courriel d'un étudiant inscrit (ex: `mariem.etudiante@esen.tn`).
- [x] Cliquer sur **« Inviter ce colocataire »**.
- [x] Se connecter avec le compte invité : constater la notification cloche avec les boutons **« Accepter »** et **« Refuser »**.
- [x] Cliquer sur **« Accepter »**.
- **Résultat attendu** : Le membre rejoint l'espace avec `statutAdhesion: 'accepte'`. La part de loyer est instantanément recalculée et divisée par 2 colocataires.

### Étape 11 : Messagerie collective en temps réel
- [x] Ouvrir l'espace de colocation dans deux fenêtres de navigateur distinctes (Étudiant 1 et Étudiant 2).
- [x] Envoyer un message depuis la première fenêtre.
- **Résultat attendu** : Réception instantanée sans rechargement de page grâce à l'écouteur `onSnapshot` Firestore. Affichage du nom de l'auteur, de l'heure et distinction visuelle de ses propres messages.

### Étape 12 : Complétude de la colocation (`statut: 'complet'`)
- [x] Accepter des colocataires jusqu'à atteindre la capacité maximale fixée par `nombrePlaces`.
- **Résultat attendu** : L'espace bascule automatiquement en `statut: 'complet'`. Les demandes d'adhésion publiques sont fermées. Si un membre quitte la colocation, l'espace rebascule automatiquement en `'ouvert'`.

---

## 🛡️ Vérification des règles de sécurité Firestore

- [x] Tentative de lecture d'une pièce d'identité par un tiers : **Bloqué (Permission Denied)**.
- [x] Tentative de publication directe d'annonce sans passer par l'admin : **Bloqué (Permission Denied)**.
- [x] Tentative d'adhésion par un étudiant non certifié : **Bloqué (Permission Denied)**.
- [x] Modification de son propre rôle utilisateur en base : **Bloqué (Permission Denied)**.
- [x] Accès au chat d'une colocation par un utilisateur non membre : **Bloqué (Permission Denied)**.

