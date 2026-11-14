# 🏠 CampusColoc — Plateforme de Colocation Étudiante en Tunisie

> Application web moderne de colocation étudiante en Tunisie, développée selon l'esthétique épurée **« Carnet de campus »** (bleu et blanc de Sidi Bou Saïd, papier vélin et encre profonde).

---

## 🛠️ Stack technique & Versions

* **Framework frontend** : Angular 21.0.0 (Architecture 100% Standalone Components, Zone.js, RxJS 7.8)
* **Backend & Données** : Firebase JS SDK 12.19.0 (Firestore, Firebase Authentication)
* **Design & Style** : CSS pur modulaire (sans framework CSS externe, zéro bibliothèque d'icônes tierce, 34 icônes SVG natives)
* **Typographies** : Young Serif (titres), Instrument Sans (corps), JetBrains Mono (chiffres tabulaires)
* **Outils & Déploiement** : Angular CLI 21, Firebase CLI (Hosting & Firestore Security Rules)

---

## 🏗️ Architecture en 10 lignes

1. **Routing modulaire à 3 layouts étanches** : `PublicLayout` pour les visiteurs, `MembreLayout` pour les étudiants et bailleurs connectés, `AdminLayout` avec barre latérale fixe pour la modération.
2. **Couche de services exclusive** : Seuls les services injectables de `src/app/services/` communiquent avec Firebase via `src/app/firebase.ts` ; les composants et guards ne manipulent aucune API Firebase directement.
3. **Protection par Guards** : `authGuard` protège l'espace membre, `roleGuard` filtre les accès selon le profil (`etudiant`, `proprietaire`, `admin`), et `visiteurGuard` évite l'accès aux formulaires d'authentification aux utilisateurs déjà connectés.
4. **Transactions atomiques `writeBatch`** : Lors de l'acceptation d'une candidature, la création de l'espace, l'enregistrement du premier membre et la mise à jour de la demande sont engagés ensemble de manière atomique.
5. **Synchronisation temps réel `onSnapshot`** : Utilisée pour la messagerie instantanée du salon de colocation et l'écoute en direct des notifications non lues dans la barre de navigation.
6. **Calcul de part de loyer réactif** : La part de chaque colocataire `(loyer + charges) / membres` est recalculée dynamiquement lors de toute adhésion ou départ d'étudiant.
7. **Modération d'annonces et vérification d'identité** : Circuit de validation complet (CIN ou carte étudiante) empêchant la publication ou l'envoi de candidatures sans certification administrative préalable.
8. **Gestion du cycle de vie des annonces** : Statuts contrôlés (`en_attente`, `publiee`, `suspendue`, `refusee`) avec notification obligatoire au propriétaire lors de chaque décision de modération.
9. **Filtrage client haute performance** : Recherche et filtrage des annonces (gouvernorat, quartier, budget max, places, meublé, durée) exécutés en mémoire avec synchronisation des paramètres d'URL.
10. **Sécurité native Firestore** : Fichier de règles `firestore.rules` s'appuyant sur le document `users/{uid}` pour verrouiller les accès, les rôles et les sous-collections privées.

---

## 🗄️ Collections Firestore

| Collection | Description | Document ID | Rôles autorisés en écriture |
|---|---|---|---|
| `users` | Profils utilisateurs, coordonnées, rôles, filières et statut de vérification | `userId` (UID Auth) | Utilisateur propriétaire (sans altérer son rôle/statut) / Admin |
| `verifications` | Justificatifs d'identité déposés (cartes étudiantes, CIN) | Auto-ID | Utilisateur émetteur (création) / Admin (approbation ou refus) |
| `annonces` | Logements étudiants complets (photos, loyer, charges, places, statut) | Auto-ID | Bailleur certifié (création/édition non publiée) / Admin (validation) |
| `demandes` | Candidatures d'étudiants vérifiés adressées aux propriétaires | Auto-ID | Étudiant vérifié (création, annulation) / Bailleur (acceptation, refus) |
| `espaces` | Espaces de colocation actifs, règles de vie et visibilité | `annonceId` | Propriétaire bailleur (création) / 1er locataire (règles, visibilité) |
| `espaces/{id}/membres` | Sous-collection des colocataires admis, invités ou candidats | `etudiantId` | 1er locataire (invitations) / Étudiant (demande/réponse) |
| `espaces/{id}/messages` | Sous-collection du chat collectif en direct | Auto-ID | Colocataires acceptés et propriétaire du logement |
| `notifications` | Alertes personnelles avec lien d'action et indicateur de lecture | Auto-ID | Utilisateurs connectés (création) / Destinataire (marquage lu) |
| `signalements` | Signalements de modération transmis par la communauté | Auto-ID | Utilisateurs connectés (création) / Admin (traitement) |

---

## 🚀 Installation & Lancement local

### 1. Prérequis
* Node.js v18 ou supérieur
* npm v9 ou supérieur

### 2. Cloner le projet et installer les dépendances
```bash
git clone https://github.com/votre-compte/campuscoloc-project.git
cd campuscoloc-project/campuscoloc
npm install
```

### 3. Lancer le serveur de développement local
```bash
npm start
# ou
ng serve
```
> Ouvrez votre navigateur sur `http://localhost:4200`.

### 4. Injecter le jeu de données de démonstration
Rendez-vous sur `http://localhost:4200/test-firebase` et cliquez sur **« Injecter le jeu de démo complet »** pour créer immédiatement dans Firestore :
* 1 compte Administrateur (`admin@campuscoloc.tn`)
* 2 comptes Propriétaires certifiés
* 4 comptes Étudiants certifiés
* 8 Annonces publiées réparties sur Ariana, Tunis et Sousse
* 2 Espaces de colocation ouverts (1 privé et 1 public avec messagerie active)

### 5. Compiler pour la production
```bash
npm run build
```
> Les fichiers optimisés sont générés dans `dist/campuscoloc/browser`.

### 6. Déploiement sur Firebase Hosting
```bash
# Connexion à Firebase
firebase login

# Déploiement des règles de sécurité et de l'application
firebase deploy
```
"# campus_coloc" 
"# campus_coloc" 
