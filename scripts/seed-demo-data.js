/**
 * CampusColoc — Script d'injection des données de démonstration dans Firestore
 * 
 * Contenu injecté :
 * - 1 Administrateur (admin@campuscoloc.tn)
 * - 2 Propriétaires vérifiés (Moncef Trabelsi, Leila Ben Salem)
 * - 4 Étudiants vérifiés (Sami Cherif, Mariem Jaziri, Youssef Mejri, Nour Khemir)
 * - 8 Annonces publiées dans 3 gouvernorats (Ariana, Tunis, Sousse)
 * - 2 Espaces de colocation ouverts (1 privé rattaché à l'annonce 1, 1 public rattaché à l'annonce 7)
 * 
 * Utilisation :
 * node scripts/seed-demo-data.js
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  setDoc,
  collection,
  writeBatch
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAZbzdTFR7Em3YZiJy3k60sZWgjWxUc3E4",
  authDomain: "campuscoloc.firebaseapp.com",
  projectId: "campuscoloc",
  storageBucket: "campuscoloc.firebasestorage.app",
  messagingSenderId: "882861824209",
  appId: "1:882861824209:web:233dc97ce04d904c270df0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function injecterDonnees() {
  console.log("🚀 Début de l'injection des données CampusColoc...");

  const dateNow = new Date().toISOString();

  // 1. Identifiants fixes pour reproductibilité
  const UID_ADMIN = "usr_admin_01";
  const UID_PROP_1 = "usr_prop_moncef";
  const UID_PROP_2 = "usr_prop_leila";
  const UID_ETU_1 = "usr_etu_sami";
  const UID_ETU_2 = "usr_etu_mariem";
  const UID_ETU_3 = "usr_etu_youssef";
  const UID_ETU_4 = "usr_etu_nour";

  const ID_ANNONCE_1 = "ann_ariana_insat";
  const ID_ANNONCE_2 = "ann_ariana_ennasr";
  const ID_ANNONCE_3 = "ann_ariana_ghazela";
  const ID_ANNONCE_4 = "ann_tunis_bab_saadoun";
  const ID_ANNONCE_5 = "ann_tunis_el_manar";
  const ID_ANNONCE_6 = "ann_tunis_centre_ville";
  const ID_ANNONCE_7 = "ann_sousse_khezama";
  const ID_ANNONCE_8 = "ann_sousse_sahloul";

  // 2. Les utilisateurs
  const users = [
    {
      uid: UID_ADMIN,
      nom: "Administrateur CampusColoc",
      email: "admin@campuscoloc.tn",
      role: "admin",
      statutVerification: "verifie",
      telephone: "+216 71 000 000",
      dateInscription: dateNow
    },
    {
      uid: UID_PROP_1,
      nom: "Moncef Trabelsi",
      email: "moncef.proprietaire@gmail.com",
      role: "proprietaire",
      statutVerification: "verifie",
      telephone: "+216 98 123 456",
      dateInscription: dateNow
    },
    {
      uid: UID_PROP_2,
      nom: "Leila Ben Salem",
      email: "leila.bailleur@gmail.com",
      role: "proprietaire",
      statutVerification: "verifie",
      telephone: "+216 22 987 654",
      dateInscription: dateNow
    },
    {
      uid: UID_ETU_1,
      nom: "Sami Cherif",
      email: "sami.etudiant@insat.u-carthage.tn",
      role: "etudiant",
      statutVerification: "verifie",
      telephone: "+216 55 111 222",
      faculte: "INSAT Tunis",
      filiere: "Génie Logiciel",
      niveau: "3ème année",
      favoris: [ID_ANNONCE_1, ID_ANNONCE_2],
      dateInscription: dateNow
    },
    {
      uid: UID_ETU_2,
      nom: "Mariem Jaziri",
      email: "mariem.etudiante@esen.tn",
      role: "etudiant",
      statutVerification: "verifie",
      telephone: "+216 50 333 444",
      faculte: "ESEN Manouba",
      filiere: "E-Business",
      niveau: "Master 1",
      favoris: [ID_ANNONCE_4, ID_ANNONCE_5],
      dateInscription: dateNow
    },
    {
      uid: UID_ETU_3,
      nom: "Youssef Mejri",
      email: "youssef.etudiant@fss.rnu.tn",
      role: "etudiant",
      statutVerification: "verifie",
      telephone: "+216 99 555 666",
      faculte: "Faculté des Sciences de Sousse",
      filiere: "Informatique",
      niveau: "2ème année",
      favoris: [ID_ANNONCE_7],
      dateInscription: dateNow
    },
    {
      uid: UID_ETU_4,
      nom: "Nour Khemir",
      email: "nour.etudiante@medecine-tunis.tn",
      role: "etudiant",
      statutVerification: "verifie",
      telephone: "+216 24 777 888",
      faculte: "Faculté de Médecine de Tunis",
      filiere: "Médecine",
      niveau: "Externat",
      favoris: [ID_ANNONCE_4],
      dateInscription: dateNow
    }
  ];

  for (const u of users) {
    await setDoc(doc(db, "users", u.uid), u);
    console.log(`  ✓ Utilisateur créé : ${u.nom} (${u.role})`);
  }

  // 3. Les 8 Annonces publiées réparties sur 3 gouvernorats
  const annonces = [
    {
      id: ID_ANNONCE_1,
      proprietaireId: UID_PROP_1,
      titre: "S+3 spacieux en face de l'INSAT — Centre Urbain Nord",
      description: "Appartement haut standing meublé situé au 3ème étage avec ascenseur. Cuisine équipée (réfrigérateur, four, micro-ondes), 3 chambres individuelles avec bureau, salon spacieux et balcon. Connexion fibre optique incluse.",
      ville: "Ariana",
      quartier: "Centre Urbain Nord",
      loyer: 900,
      charges: 60,
      nombrePlaces: 3,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_2,
      proprietaireId: UID_PROP_1,
      titre: "Colocation moderne et calme à Ennasr 2",
      description: "Bel appartement S+2 climatisé et chauffé, proche de toutes commodités (supermarchés, transports, cafés). Résidence gardée 24h/24. Idéal pour 2 étudiants calmes et ordonnés.",
      ville: "Ariana",
      quartier: "Ennasr 2",
      loyer: 800,
      charges: 40,
      nombrePlaces: 2,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_3,
      proprietaireId: UID_PROP_2,
      titre: "Villa partagée Technopôle El Ghazela & ESPRIT",
      description: "Grande maison meublée dédiée aux étudiants ingénieurs. 4 chambres spacieuses, grand jardin, terrasse, barbecue, deux salles d'eau. À 5 minutes à pied des écoles d'ingénieurs.",
      ville: "Ariana",
      quartier: "El Ghazela",
      loyer: 1000,
      charges: 80,
      nombrePlaces: 4,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_4,
      proprietaireId: UID_PROP_2,
      titre: "Étage de villa proche Faculté de Médecine de Tunis",
      description: "Appartement chaleureux situé à Bab Saadoun / Bab Souika. Entièrement équipé, proche de la station de métro et des bus. Idéal pour étudiants en médecine ou pharmacie.",
      ville: "Tunis",
      quartier: "Bab Saadoun",
      loyer: 750,
      charges: 50,
      nombrePlaces: 3,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_5,
      proprietaireId: UID_PROP_1,
      titre: "S+2 rénové Campus Universitaire El Manar 1",
      description: "Appartement lumineux avec vue dégagée, à 5 minutes à pied des facultés des sciences et de droit d'El Manar. Lave-linge, cuisine américaine, connexion Wi-Fi haut débit.",
      ville: "Tunis",
      quartier: "El Manar 1",
      loyer: 700,
      charges: 40,
      nombrePlaces: 2,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_6,
      proprietaireId: UID_PROP_2,
      titre: "Appartement de charme au Centre-Ville de Tunis",
      description: "Grand appartement haussmannien à proximité de l'Avenue Habib Bourguiba et du Passage. Grand salon, 3 chambres individuelles confortables. Proche de toutes les lignes de métro.",
      ville: "Tunis",
      quartier: "Centre-Ville",
      loyer: 840,
      charges: 60,
      nombrePlaces: 3,
      meuble: true,
      dureeLocation: "Flexible",
      photos: [
        "https://images.unsplash.com/photo-1502005229762-ee1b2b8ab98f?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_7,
      proprietaireId: UID_PROP_1,
      titre: "Colocation ensoleillée à Sousse — Khezama Ouest",
      description: "Logement S+3 tout confort à 10 minutes de la Faculté de Médecine de Sousse et de l'IHEC. Balcon avec vue dégagée, quartier calme et sécurisé, stationnement facile.",
      ville: "Sousse",
      quartier: "Khezama Ouest",
      loyer: 660,
      charges: 30,
      nombrePlaces: 3,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    },
    {
      id: ID_ANNONCE_8,
      proprietaireId: UID_PROP_2,
      titre: "Duplex contemporain Sahloul 4 proche facultés",
      description: "Grand duplex de standing avec 4 chambres individuelles, grand séjour lumineux et cuisine moderne. Quartier calme proche du CHU Sahloul et des grandes écoles.",
      ville: "Sousse",
      quartier: "Sahloul 4",
      loyer: 880,
      charges: 40,
      nombrePlaces: 4,
      meuble: true,
      dureeLocation: "1 année universitaire",
      photos: [
        "https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=800&q=80"
      ],
      statut: "publiee",
      dateCreation: dateNow
    }
  ];

  for (const a of annonces) {
    await setDoc(doc(db, "annonces", a.id), a);
    console.log(`  ✓ Annonce créée : ${a.titre} (${a.ville})`);
  }

  // 4. Deux Espaces de colocation ouverts (1 privé et 1 public)
  // Espace 1 (Privé) sur Annonce 1 (Ariana INSAT)
  const espace1 = {
    annonceId: ID_ANNONCE_1,
    proprietaireId: UID_PROP_1,
    premierLocataireId: UID_ETU_1,
    visibilite: "prive",
    statut: "ouvert",
    reglesMaison: [
      "Respect du calme à partir de 22h00 pour les révisions",
      "Partage hebdomadaire du nettoyage des parties communes",
      "Logement non-fumeur à l'intérieur"
    ],
    dateOuverture: dateNow
  };
  await setDoc(doc(db, "espaces", ID_ANNONCE_1), espace1);

  // Premier membre accepté
  await setDoc(doc(db, "espaces", ID_ANNONCE_1, "membres", UID_ETU_1), {
    etudiantId: UID_ETU_1,
    premierLocataire: true,
    statutAdhesion: "accepte",
    dateAdhesion: dateNow
  });

  // Messages du salon
  await setDoc(doc(db, "espaces", ID_ANNONCE_1, "messages", "msg_1"), {
    auteurId: UID_PROP_1,
    auteurNom: "Moncef Trabelsi",
    contenu: "Bienvenue dans l'espace de colocation ! Les clés seront remises ce vendredi à 14h.",
    dateEnvoi: dateNow
  });
  await setDoc(doc(db, "espaces", ID_ANNONCE_1, "messages", "msg_2"), {
    auteurId: UID_ETU_1,
    auteurNom: "Sami Cherif",
    contenu: "Merci beaucoup monsieur Moncef ! Tout est parfaitement clair.",
    dateEnvoi: dateNow
  });
  console.log("  ✓ Espace 1 (Privé, Ouvert) créé sur Annonce 1 (Ariana)");

  // Espace 2 (Public) sur Annonce 7 (Sousse Khezama)
  const espace2 = {
    annonceId: ID_ANNONCE_7,
    proprietaireId: UID_PROP_1,
    premierLocataireId: UID_ETU_3,
    visibilite: "public",
    statut: "ouvert",
    reglesMaison: [
      "Ambiance studieuse et conviviale",
      "Courses communes partagées équitablement"
    ],
    dateOuverture: dateNow
  };
  await setDoc(doc(db, "espaces", ID_ANNONCE_7), espace2);

  // Premier membre accepté
  await setDoc(doc(db, "espaces", ID_ANNONCE_7, "membres", UID_ETU_3), {
    etudiantId: UID_ETU_3,
    premierLocataire: true,
    statutAdhesion: "accepte",
    dateAdhesion: dateNow
  });

  // Message du salon
  await setDoc(doc(db, "espaces", ID_ANNONCE_7, "messages", "msg_sousse_1"), {
    auteurId: UID_ETU_3,
    auteurNom: "Youssef Mejri",
    contenu: "Bonjour à tous ! La colocation est ouverte, n'hésitez pas à postuler si vous étudiez à Sousse.",
    dateEnvoi: dateNow
  });
  console.log("  ✓ Espace 2 (Public, Ouvert) créé sur Annonce 7 (Sousse)");

  console.log("\n🎉 Injection réussie ! L'application CampusColoc dispose maintenant de son jeu de démonstration complet.");
}

injecterDonnees().catch(console.error);

