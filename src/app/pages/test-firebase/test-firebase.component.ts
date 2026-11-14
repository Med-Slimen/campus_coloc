import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestService } from '../../services/test.service';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

@Component({
  selector: 'app-test-firebase',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test-firebase.component.html',
  styleUrls: ['./test-firebase.component.css']
})
export class TestFirebaseComponent {
  private testService = inject(TestService);

  chargement: boolean = false;
  erreur: string | null = null;
  nbDocuments: number | null = null;
  tempsMs: number | null = null;

  // Injection démo
  seedEnCours: boolean = false;
  seedSucces: boolean = false;
  seedMessage: string | null = null;

  get estConnecte(): boolean {
    return this.testService.estUtilisateurConnecte();
  }

  get statutConnexion(): string {
    const email = this.testService.obtenirEmailUtilisateur();
    return email ? `Connecté en tant que ${email}` : 'Non connecté (visiteur anonyme)';
  }

  // Déclenche le test de lecture Firestore et enregistre la durée ou l'erreur
  async lancerTest(): Promise<void> {
    this.chargement = true;
    this.erreur = null;
    this.nbDocuments = null;
    this.tempsMs = null;

    try {
      const resultat = await this.testService.testerFirestore();
      this.nbDocuments = resultat.nbDocuments;
      this.tempsMs = resultat.tempsMs;
    } catch (e: any) {
      this.erreur = e?.message || 'Erreur inconnue lors du test Firestore';
    } finally {
      this.chargement = false;
    }
  }

  // Injecte l'ensemble du jeu de données de démonstration directement dans Firestore
  async injecterDemoData(): Promise<void> {
    this.seedEnCours = true;
    this.seedSucces = false;
    this.seedMessage = null;

    const dateNow = new Date().toISOString();

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

    try {
      // 1. Les utilisateurs (1 admin, 2 propriétaires vérifiés, 4 étudiants vérifiés)
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
      }

      // 2. Les 8 annonces publiées
      const annonces = [
        {
          id: ID_ANNONCE_1,
          proprietaireId: UID_PROP_1,
          titre: "S+3 spacieux en face de l'INSAT — Centre Urbain Nord",
          description: "Appartement haut standing meublé situé au 3ème étage avec ascenseur. Cuisine équipée, 3 chambres individuelles avec bureau, salon spacieux et balcon. Connexion fibre optique.",
          ville: "Ariana",
          quartier: "Centre Urbain Nord",
          loyer: 900,
          charges: 60,
          nombrePlaces: 3,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_2,
          proprietaireId: UID_PROP_1,
          titre: "Colocation moderne et calme à Ennasr 2",
          description: "Bel appartement S+2 climatisé et chauffé, proche de toutes commodités. Résidence gardée 24h/24. Idéal pour 2 étudiants calmes et sérieux.",
          ville: "Ariana",
          quartier: "Ennasr 2",
          loyer: 800,
          charges: 40,
          nombrePlaces: 2,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_3,
          proprietaireId: UID_PROP_2,
          titre: "Villa partagée Technopôle El Ghazela & ESPRIT",
          description: "Grande maison meublée dédiée aux étudiants ingénieurs. 4 chambres, jardin, terrasse, deux salles d'eau. À 5 minutes à pied des écoles d'ingénieurs.",
          ville: "Ariana",
          quartier: "El Ghazela",
          loyer: 1000,
          charges: 80,
          nombrePlaces: 4,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_4,
          proprietaireId: UID_PROP_2,
          titre: "Étage de villa proche Faculté de Médecine de Tunis",
          description: "Appartement chaleureux à Bab Saadoun. Entièrement équipé, proche de la station de métro. Idéal pour étudiants en médecine ou pharmacie.",
          ville: "Tunis",
          quartier: "Bab Saadoun",
          loyer: 750,
          charges: 50,
          nombrePlaces: 3,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_5,
          proprietaireId: UID_PROP_1,
          titre: "S+2 rénové Campus Universitaire El Manar 1",
          description: "Appartement lumineux avec vue dégagée, à 5 minutes à pied des facultés des sciences et de droit d'El Manar. Lave-linge, Wi-Fi haut débit.",
          ville: "Tunis",
          quartier: "El Manar 1",
          loyer: 700,
          charges: 40,
          nombrePlaces: 2,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_6,
          proprietaireId: UID_PROP_2,
          titre: "Appartement de charme au Centre-Ville de Tunis",
          description: "Grand appartement haussmannien à proximité de l'Avenue Habib Bourguiba et du Passage. Grand salon, 3 chambres individuelles confortables.",
          ville: "Tunis",
          quartier: "Centre-Ville",
          loyer: 840,
          charges: 60,
          nombrePlaces: 3,
          meuble: true,
          dureeLocation: "Flexible",
          photos: ["https://images.unsplash.com/photo-1502005229762-ee1b2b8ab98f?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_7,
          proprietaireId: UID_PROP_1,
          titre: "Colocation ensoleillée à Sousse — Khezama Ouest",
          description: "Logement S+3 tout confort à 10 minutes de la Faculté de Médecine de Sousse et de l'IHEC. Balcon avec vue dégagée, quartier calme et sécurisé.",
          ville: "Sousse",
          quartier: "Khezama Ouest",
          loyer: 660,
          charges: 30,
          nombrePlaces: 3,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        },
        {
          id: ID_ANNONCE_8,
          proprietaireId: UID_PROP_2,
          titre: "Duplex contemporain Sahloul 4 proche facultés",
          description: "Grand duplex de standing avec 4 chambres individuelles, grand séjour lumineux et cuisine moderne. Quartier calme proche du CHU Sahloul.",
          ville: "Sousse",
          quartier: "Sahloul 4",
          loyer: 880,
          charges: 40,
          nombrePlaces: 4,
          meuble: true,
          dureeLocation: "1 année universitaire",
          photos: ["https://images.unsplash.com/photo-1540518614846-7ede433c4ef7?auto=format&fit=crop&w=800&q=80"],
          statut: "publiee",
          dateCreation: dateNow
        }
      ];

      for (const a of annonces) {
        await setDoc(doc(db, "annonces", a.id), a);
      }

      // 3. Espace 1 (Privé) sur Annonce 1
      await setDoc(doc(db, "espaces", ID_ANNONCE_1), {
        annonceId: ID_ANNONCE_1,
        proprietaireId: UID_PROP_1,
        premierLocataireId: UID_ETU_1,
        visibilite: "prive",
        statut: "ouvert",
        reglesMaison: ["Calme après 22h", "Nettoyage partagé", "Espace non-fumeur"],
        dateOuverture: dateNow
      });
      await setDoc(doc(db, "espaces", ID_ANNONCE_1, "membres", UID_ETU_1), {
        etudiantId: UID_ETU_1,
        premierLocataire: true,
        statutAdhesion: "accepte",
        dateAdhesion: dateNow
      });
      await setDoc(doc(db, "espaces", ID_ANNONCE_1, "messages", "msg_1"), {
        auteurId: UID_PROP_1,
        auteurNom: "Moncef Trabelsi",
        contenu: "Bienvenue dans l'espace de colocation ! Les clés seront remises vendredi.",
        dateEnvoi: dateNow
      });

      // 4. Espace 2 (Public) sur Annonce 7
      await setDoc(doc(db, "espaces", ID_ANNONCE_7), {
        annonceId: ID_ANNONCE_7,
        proprietaireId: UID_PROP_1,
        premierLocataireId: UID_ETU_3,
        visibilite: "public",
        statut: "ouvert",
        reglesMaison: ["Ambiance conviviale et studieuse"],
        dateOuverture: dateNow
      });
      await setDoc(doc(db, "espaces", ID_ANNONCE_7, "membres", UID_ETU_3), {
        etudiantId: UID_ETU_3,
        premierLocataire: true,
        statutAdhesion: "accepte",
        dateAdhesion: dateNow
      });
      await setDoc(doc(db, "espaces", ID_ANNONCE_7, "messages", "msg_1"), {
        auteurId: UID_ETU_3,
        auteurNom: "Youssef Mejri",
        contenu: "Bonjour ! Colocation ouverte pour étudiants à Sousse.",
        dateEnvoi: dateNow
      });

      this.seedSucces = true;
      this.seedMessage = "1 admin, 2 propriétaires vérifiés, 4 étudiants vérifiés, 8 annonces publiées et 2 espaces ouverts créés avec succès !";
    } catch (e: any) {
      this.seedMessage = "Erreur lors de l'injection : " + (e?.message || e);
    } finally {
      this.seedEnCours = false;
    }
  }
}
