import { Injectable, inject } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { Espace, Membre, Message, Demande, User, Annonce } from '../models';
import { NotificationService } from './notification.service';

/**
 * Service de gestion de l'espace de colocation Firestore :
 * Espace collectif (règles de vie, statut, visibilité), membres et salon de discussion en temps réel.
 */
@Injectable({
  providedIn: 'root'
})
export class EspaceService {
  private notificationService = inject(NotificationService);

  // 1. Crée un espace et le premier colocataire via un writeBatch atomique lors de l'acceptation d'une demande
  async creerEspaceDepuisDemande(demande: Demande, annonceTitre: string): Promise<void> {
    if (!demande.id) throw new Error("Identifiant de demande manquant.");

    const annonceId = demande.annonceId;
    const espaceRef = doc(db, 'espaces', annonceId);
    const espaceSnap = await getDoc(espaceRef);

    // Règle métier : si un espace existe déjà, refuser l'acceptation d'une autre demande initiale
    if (espaceSnap.exists()) {
      throw new Error(
        "Un espace de colocation existe déjà pour ce logement. Les nouveaux colocataires doivent désormais rejoindre directement l'espace."
      );
    }

    // Initialisation du writeBatch atomique
    const batch = writeBatch(db);

    // A. La demande devient acceptée
    const demandeRef = doc(db, 'demandes', demande.id);
    batch.update(demandeRef, { statut: 'acceptee' });

    // B. Création du document espaces/{annonceId}
    const maintenant = new Date().toISOString();
    const nouvelEspace: Espace = {
      annonceId,
      proprietaireId: demande.proprietaireId,
      premierLocataireId: demande.etudiantId,
      visibilite: 'prive',
      statut: 'ouvert',
      reglesMaison: [],
      dateOuverture: maintenant
    };
    batch.set(espaceRef, nouvelEspace);

    // C. Création du membre espaces/{annonceId}/membres/{etudiantId} (premier locataire)
    const membreRef = doc(db, 'espaces', annonceId, 'membres', demande.etudiantId);
    const premierMembre: Membre = {
      etudiantId: demande.etudiantId,
      premierLocataire: true,
      statutAdhesion: 'accepte',
      dateAdhesion: maintenant
    };
    batch.set(membreRef, premierMembre);

    // Validation atomique
    await batch.commit();

    // D. Notification de félicitations pour l'étudiant
    await this.notificationService.create({
      userId: demande.etudiantId,
      type: 'demande',
      contenu: `Félicitations ! Votre demande pour « ${annonceTitre} » a été acceptée. Votre espace de colocation est désormais ouvert !`,
      lien: `/espace/${annonceId}`,
      lue: false,
      dateEnvoi: maintenant,
      annonceId
    });
  }

  // 2. Récupère l'espace de colocation rattaché à une annonce
  async getEspace(annonceId: string): Promise<Espace | null> {
    const docRef = doc(db, 'espaces', annonceId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return { ...(snap.data() as Espace), annonceId: snap.id };
  }

  // 3. Récupère la liste des membres d'un espace de colocation
  async getMembres(annonceId: string): Promise<Membre[]> {
    const colRef = collection(db, 'espaces', annonceId, 'membres');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({
      ...(d.data() as Membre),
      etudiantId: d.id
    }));
  }

  // 4. Modifie la visibilité de l'espace (prive ou public) par le premier locataire
  async changeVisibilite(annonceId: string, visibilite: 'prive' | 'public'): Promise<void> {
    const docRef = doc(db, 'espaces', annonceId);
    await updateDoc(docRef, { visibilite });
  }

  // 5. Inviter un étudiant vérifié par son email (mode privé)
  async inviteStudent(annonceId: string, email: string): Promise<void> {
    const emailNettoye = email.trim();
    if (!emailNettoye) throw new Error("Veuillez saisir une adresse email.");

    // Récupération de l'espace et de l'annonce pour vérifier la capacité
    const [espace, annonceSnap] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId))
    ]);

    if (!espace) throw new Error("Espace de colocation introuvable.");
    if (!annonceSnap.exists()) throw new Error("Annonce introuvable.");

    const annonce = annonceSnap.data() as Annonce;
    const membres = await this.getMembres(annonceId);
    const nbAcceptes = membres.filter(m => m.statutAdhesion === 'accepte').length;

    // Règle 5 : vérification stricte de la capacité avant toute invitation
    if (nbAcceptes >= (annonce.nombrePlaces || 1) || espace.statut === 'complet') {
      throw new Error(
        `Capacité maximale atteinte (${annonce.nombrePlaces} places). Impossible d'inviter de nouveaux colocataires.`
      );
    }

    // Recherche de l'étudiant par son email dans la collection users
    const usersCol = collection(db, 'users');
    let userSnap = await getDocs(query(usersCol, where('email', '==', emailNettoye)));
    if (userSnap.empty) {
      userSnap = await getDocs(query(usersCol, where('email', '==', emailNettoye.toLowerCase())));
    }

    if (userSnap.empty) {
      throw new Error(`Aucun utilisateur trouvé avec l'adresse courriel « ${emailNettoye} » sur CampusColoc.`);
    }

    const etudiantDoc = userSnap.docs[0];
    const etudiant = etudiantDoc.data() as User;
    const etudiantId = etudiantDoc.id;

    if (etudiant.role !== 'etudiant') {
      throw new Error("L'adresse saisie ne correspond pas à un compte étudiant.");
    }

    if (etudiant.statutVerification !== 'verifie') {
      throw new Error("Cet étudiant n'a pas encore validé son profil universitaire (profil non vérifié).");
    }

    // Vérifier si cet étudiant est déjà membre
    const membreExistant = membres.find(m => m.etudiantId === etudiantId);
    if (membreExistant) {
      if (membreExistant.statutAdhesion === 'accepte') {
        throw new Error("Cet étudiant fait déjà partie des colocataires acceptés.");
      }
      if (membreExistant.statutAdhesion === 'invite') {
        throw new Error("Une invitation est déjà en attente pour cet étudiant.");
      }
    }

    // Création du membre avec statutAdhesion: 'invite'
    const membreRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
    const dateNow = new Date().toISOString();
    await setDoc(membreRef, {
      etudiantId,
      premierLocataire: false,
      statutAdhesion: 'invite',
      dateAdhesion: dateNow
    });

    // Notification à l'étudiant invité
    await this.notificationService.create({
      userId: etudiantId,
      type: 'invitation_espace',
      contenu: `Vous avez reçu une invitation à rejoindre la colocation pour le logement « ${annonce.titre} ».`,
      lien: `/espace/${annonceId}`,
      lue: false,
      dateEnvoi: dateNow,
      annonceId
    });
  }

  // 6. Demander à rejoindre un espace public ouvert par un étudiant vérifié
  async requestToJoin(annonceId: string, etudiantId: string): Promise<void> {
    const [espace, annonceSnap] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId))
    ]);

    if (!espace) throw new Error("Espace de colocation introuvable.");
    if (!annonceSnap.exists()) throw new Error("Annonce introuvable.");

    const annonce = annonceSnap.data() as Annonce;
    const membres = await this.getMembres(annonceId);
    const nbAcceptes = membres.filter(m => m.statutAdhesion === 'accepte').length;

    if (nbAcceptes >= (annonce.nombrePlaces || 1) || espace.statut === 'complet') {
      throw new Error("Le logement a atteint sa capacité maximale de colocataires.");
    }

    if (espace.visibilite !== 'public' || espace.statut !== 'ouvert') {
      throw new Error("Cet espace n'accepte pas les candidatures publiques actuellement.");
    }

    // Création de la demande d'adhésion
    const membreRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
    const dateNow = new Date().toISOString();
    await setDoc(membreRef, {
      etudiantId,
      premierLocataire: false,
      statutAdhesion: 'demande',
      dateAdhesion: dateNow
    });

    // Notification au premier locataire
    await this.notificationService.create({
      userId: espace.premierLocataireId,
      type: 'demande_espace',
      contenu: `Un étudiant vérifié a demandé à rejoindre votre colocation « ${annonce.titre} ».`,
      lien: `/espace/${annonceId}`,
      lue: false,
      dateEnvoi: dateNow,
      annonceId
    });
  }

  // 7. Traitement (Accepter / Refuser) d'une invitation ou d'une demande d'adhésion
  async answerMembre(
    annonceId: string,
    etudiantId: string,
    action: 'accepte' | 'refuse'
  ): Promise<void> {
    const membreRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
    const espaceRef = doc(db, 'espaces', annonceId);

    if (action === 'accepte') {
      // Vérification de la capacité avant acceptation
      const [annonceSnap, membres] = await Promise.all([
        getDoc(doc(db, 'annonces', annonceId)),
        this.getMembres(annonceId)
      ]);

      const annonce = annonceSnap.data() as Annonce;
      const nbAcceptes = membres.filter(m => m.statutAdhesion === 'accepte').length;

      if (nbAcceptes >= (annonce.nombrePlaces || 1)) {
        throw new Error(
          `Impossible d'accepter : la capacité maximale (${annonce.nombrePlaces} places) est atteinte.`
        );
      }

      await updateDoc(membreRef, { statutAdhesion: 'accepte' });

      // Si cette acceptation atteint le nombre total de places, basculer le statut en 'complet'
      if (nbAcceptes + 1 >= (annonce.nombrePlaces || 1)) {
        await updateDoc(espaceRef, { statut: 'complet' });
      }

      // Notification à l'étudiant accepté
      await this.notificationService.create({
        userId: etudiantId,
        type: 'adhesion_acceptee',
        contenu: `Votre adhésion à la colocation a été validée ! Bienvenue dans l'espace partagé.`,
        lien: `/espace/${annonceId}`,
        lue: false,
        dateEnvoi: new Date().toISOString(),
        annonceId
      });
    } else {
      await updateDoc(membreRef, { statutAdhesion: 'refuse' });

      // Notification à l'étudiant refusé
      await this.notificationService.create({
        userId: etudiantId,
        type: 'adhesion_refusee',
        contenu: `L'adhésion à la colocation n'a pas été retenue.`,
        lien: `/annonces/${annonceId}`,
        lue: false,
        dateEnvoi: new Date().toISOString(),
        annonceId
      });
    }
  }

  // 8. Envoie un message dans le salon collectif en temps réel
  async sendMessage(
    annonceId: string,
    auteurId: string,
    auteurNom: string,
    contenu: string
  ): Promise<string> {
    const texte = contenu.trim();
    if (!texte) throw new Error("Le message ne peut pas être vide.");

    const messagesCol = collection(db, 'espaces', annonceId, 'messages');
    const docRef = await addDoc(messagesCol, {
      auteurId,
      auteurNom,
      contenu: texte,
      dateEnvoi: new Date().toISOString()
    });
    return docRef.id;
  }

  // 9. Écoute les messages en direct avec onSnapshot
  listenMessages(
    annonceId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    const messagesCol = collection(db, 'espaces', annonceId, 'messages');
    return onSnapshot(messagesCol, (snap) => {
      const messages = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Message)
      }));
      messages.sort((a, b) => (a.dateEnvoi || '').localeCompare(b.dateEnvoi || ''));
      callback(messages);
    });
  }

  // 10. Met à jour les règles de la maison par le premier locataire
  async updateRegles(annonceId: string, regles: string[]): Promise<void> {
    const docRef = doc(db, 'espaces', annonceId);
    await updateDoc(docRef, { reglesMaison: regles });
  }

  // 11. Quitter la colocation (un premier locataire ne peut pas partir s'il reste d'autres colocataires)
  async leave(annonceId: string, etudiantId: string): Promise<void> {
    const [espace, membres] = await Promise.all([
      this.getEspace(annonceId),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace introuvable.");

    const acceptes = membres.filter(m => m.statutAdhesion === 'accepte');
    const estPremier = espace.premierLocataireId === etudiantId;

    // Règle 7 : le premier locataire ne peut pas quitter tant qu'il reste d'autres membres
    if (estPremier && acceptes.length > 1) {
      throw new Error(
        "En tant que premier locataire, vous ne pouvez pas quitter la colocation tant que d'autres colocataires y résident."
      );
    }

    const membreRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
    await updateDoc(membreRef, { statutAdhesion: 'refuse' });

    // Si l'espace était complet, le départ libère une place : repasse en 'ouvert'
    if (espace.statut === 'complet') {
      const espaceRef = doc(db, 'espaces', annonceId);
      await updateDoc(espaceRef, { statut: 'ouvert' });
    }
  }

  // Récupère la liste des identifiants d'annonces dont l'espace est public et ouvert
  async getEspacesPublicsOuvertsIds(): Promise<string[]> {
    const colRef = collection(db, 'espaces');
    const snap = await getDocs(colRef);
    return snap.docs
      .map(d => ({ ...(d.data() as Espace), annonceId: d.id }))
      .filter(e => e.visibilite === 'public' && e.statut === 'ouvert')
      .map(e => e.annonceId);
  }

  // Récupère les espaces de colocation où l'étudiant est membre accepté
  async getEspacesByEtudiant(etudiantId: string): Promise<Espace[]> {
    const colRef = collection(db, 'espaces');
    const snap = await getDocs(colRef);
    const espaces: Espace[] = [];
    for (const d of snap.docs) {
      const membreRef = doc(db, 'espaces', d.id, 'membres', etudiantId);
      const membreSnap = await getDoc(membreRef);
      if (membreSnap.exists()) {
        const membre = membreSnap.data() as Membre;
        if (membre.statutAdhesion === 'accepte') {
          espaces.push({ id: d.id, ...(d.data() as Espace) });
        }
      }
    }
    return espaces;
  }
}
