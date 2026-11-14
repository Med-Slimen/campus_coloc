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

  // Calcule la date de fin de location à partir de la durée définie dans l'annonce
  calculerDateFin(duree: string, dateDepart: Date = new Date()): string {
    const fin = new Date(dateDepart.getTime());
    const d = (duree || '').toLowerCase();
    if (d.includes('semestre')) {
      fin.setMonth(fin.getMonth() + 6);
    } else if (d.includes('ann') || d.includes('universitaire')) {
      fin.setMonth(fin.getMonth() + 10);
    } else if (d.includes('1 à 3') || d.includes('3 mois')) {
      fin.setMonth(fin.getMonth() + 3);
    } else {
      fin.setMonth(fin.getMonth() + 6);
    }
    return fin.toISOString();
  }

  // Récupère l'espace s'il existe et s'il est actif (non fermé)
  async getEspaceActif(annonceId: string): Promise<Espace | null> {
    const espace = await this.getEspace(annonceId);
    if (!espace || espace.statut === 'ferme') {
      return null;
    }
    return espace;
  }

  // 10. Met à jour les règles de la maison par le premier locataire
  async updateRegles(annonceId: string, regles: string[]): Promise<void> {
    const docRef = doc(db, 'espaces', annonceId);
    await updateDoc(docRef, { reglesMaison: regles });
  }

  // 11. Fermeture de l'espace par le propriétaire
  async fermerEspace(annonceId: string, motif?: string): Promise<void> {
    const [espace, annonceSnap, membres] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId)),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace de colocation introuvable.");

    const batch = writeBatch(db);
    const espaceRef = doc(db, 'espaces', annonceId);
    batch.update(espaceRef, {
      statut: 'ferme',
      motifFermeture: motif || 'Espace fermé par le propriétaire'
    });

    // Si l'annonce était marquée louée, la remettre en publiée
    if (annonceSnap.exists()) {
      const a = annonceSnap.data() as Annonce;
      if (a.statut === 'louee') {
        const annonceRef = doc(db, 'annonces', annonceId);
        batch.update(annonceRef, { statut: 'publiee' });
      }
    }

    await batch.commit();

    // Notifier tous les membres acceptés
    const titre = annonceSnap.exists() ? (annonceSnap.data() as Annonce).titre : 'le logement';
    const acceptes = membres.filter(m => m.statutAdhesion === 'accepte');
    const maintenant = new Date().toISOString();

    for (const m of acceptes) {
      await this.notificationService.create({
        userId: m.etudiantId,
        type: 'demande',
        contenu: `L'espace de colocation pour « ${titre} » a été fermé par le propriétaire.`,
        lien: `/annonces/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });
    }
  }

  // 12. Confirmation individuelle d'un membre colocataire (requiert tous les colocataires ET le bailleur)
  async confirmMembre(
    annonceId: string,
    etudiantId: string
  ): Promise<{ espaceConfirme: boolean; dateFinLocation?: string }> {
    const [espace, annonceSnap, membres] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId)),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace de colocation introuvable.");
    if (espace.statut === 'ferme') throw new Error("Cet espace de colocation est fermé.");

    const maintenant = new Date().toISOString();

    // 1. Mettre à jour la confirmation de ce membre
    const membreRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
    await updateDoc(membreRef, {
      confirme: true,
      dateConfirmation: maintenant
    });

    // 2. Vérifier si TOUS les membres acceptés ET le bailleur ont confirmé
    const membresAcceptes = membres.filter(m => m.statutAdhesion === 'accepte');
    const tousColocsConfirmes = membresAcceptes.every(m =>
      m.etudiantId === etudiantId ? true : m.confirme === true
    );
    const bailleurConfirme = espace.confirmationProprietaire === true;

    if (tousColocsConfirmes && bailleurConfirme && membresAcceptes.length > 0) {
      const annonce = annonceSnap.exists() ? (annonceSnap.data() as Annonce) : null;
      const duree = espace.dureeLocation || annonce?.dureeLocation || '1 semestre';
      const dateFin = this.calculerDateFin(duree);

      const batch = writeBatch(db);
      const espaceRef = doc(db, 'espaces', annonceId);
      batch.update(espaceRef, {
        statut: 'confirme',
        dateConfirmation: maintenant,
        dateFinLocation: dateFin,
        dureeLocation: duree
      });

      // L'annonce ne doit plus apparaître dans les annonces publiques jusqu'à la fin de la durée
      if (annonceSnap.exists()) {
        const annonceRef = doc(db, 'annonces', annonceId);
        batch.update(annonceRef, { statut: 'louee' });
      }

      await batch.commit();

      // Notifications de félicitations à tous les membres et au propriétaire
      const titre = annonce?.titre || 'le logement';
      for (const m of membresAcceptes) {
        await this.notificationService.create({
          userId: m.etudiantId,
          type: 'adhesion_acceptee',
          contenu: `Excellente nouvelle ! L'ensemble des colocataires et le propriétaire ont validé leur engagement pour « ${titre} ». La colocation est officiellement confirmée !`,
          lien: `/espace/${annonceId}`,
          lue: false,
          dateEnvoi: maintenant,
          annonceId
        });
      }

      if (espace.proprietaireId) {
        await this.notificationService.create({
          userId: espace.proprietaireId,
          type: 'demande',
          contenu: `Tous les colocataires et vous-même avez confirmé la colocation pour votre bien « ${titre} ». Le bail est désormais scellé !`,
          lien: `/espace/${annonceId}`,
          lue: false,
          dateEnvoi: maintenant,
          annonceId
        });
      }

      return { espaceConfirme: true, dateFinLocation: dateFin };
    }

    return { espaceConfirme: false };
  }

  // 12. bis : Confirmation de la colocation par le propriétaire bailleur
  async confirmBailleur(
    annonceId: string
  ): Promise<{ espaceConfirme: boolean; dateFinLocation?: string }> {
    const [espace, annonceSnap, membres] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId)),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace de colocation introuvable.");
    if (espace.statut === 'ferme') throw new Error("Cet espace de colocation est fermé.");

    const maintenant = new Date().toISOString();
    const espaceRef = doc(db, 'espaces', annonceId);

    // Mettre à jour la confirmation du bailleur
    await updateDoc(espaceRef, {
      confirmationProprietaire: true,
      dateConfirmationProprietaire: maintenant
    });

    // Vérifier si tous les colocataires acceptés ont aussi confirmé
    const membresAcceptes = membres.filter(m => m.statutAdhesion === 'accepte');
    const tousColocsConfirmes = membresAcceptes.length > 0 && membresAcceptes.every(m => m.confirme === true);

    if (tousColocsConfirmes) {
      const annonce = annonceSnap.exists() ? (annonceSnap.data() as Annonce) : null;
      const duree = espace.dureeLocation || annonce?.dureeLocation || '1 semestre';
      const dateFin = this.calculerDateFin(duree);

      const batch = writeBatch(db);
      batch.update(espaceRef, {
        statut: 'confirme',
        dateConfirmation: maintenant,
        dateFinLocation: dateFin,
        dureeLocation: duree
      });

      if (annonceSnap.exists()) {
        const annonceRef = doc(db, 'annonces', annonceId);
        batch.update(annonceRef, { statut: 'louee' });
      }

      await batch.commit();

      // Notifications
      const titre = annonce?.titre || 'le logement';
      for (const m of membresAcceptes) {
        await this.notificationService.create({
          userId: m.etudiantId,
          type: 'adhesion_acceptee',
          contenu: `Le propriétaire a validé la location pour « ${titre} » et tous les colocataires ont confirmé. La colocation est officiellement confirmée !`,
          lien: `/espace/${annonceId}`,
          lue: false,
          dateEnvoi: maintenant,
          annonceId
        });
      }

      await this.notificationService.create({
        userId: espace.proprietaireId,
        type: 'demande',
        contenu: `Vous avez confirmé la colocation pour « ${titre} » et tous les colocataires sont validés. La colocation est officiellement confirmée !`,
        lien: `/espace/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });

      return { espaceConfirme: true, dateFinLocation: dateFin };
    }

    return { espaceConfirme: false };
  }

  // 13. Proposer un remplaçant certifié pour pouvoir quitter une colocation confirmée
  async proposerRemplacant(annonceId: string, demandeurId: string, emailRemplacant: string): Promise<void> {
    const emailNettoye = emailRemplacant.trim();
    if (!emailNettoye) throw new Error("Veuillez saisir une adresse email.");

    const [espace, annonceSnap, membres] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId)),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace de colocation introuvable.");
    if (espace.statut !== 'confirme') {
      throw new Error("Le remplacement n'est requis que lorsque la colocation est officiellement confirmée.");
    }

    // Recherche de l'étudiant remplaçant
    const usersCol = collection(db, 'users');
    let userSnap = await getDocs(query(usersCol, where('email', '==', emailNettoye)));
    if (userSnap.empty) {
      userSnap = await getDocs(query(usersCol, where('email', '==', emailNettoye.toLowerCase())));
    }

    if (userSnap.empty) {
      throw new Error(`Aucun utilisateur trouvé avec l'adresse « ${emailNettoye} » sur CampusColoc.`);
    }

    const remplacantDoc = userSnap.docs[0];
    const remplacant = remplacantDoc.data() as User;
    const remplacantId = remplacantDoc.id;

    if (remplacant.role !== 'etudiant') {
      throw new Error("L'adresse renseignée ne correspond pas à un compte étudiant.");
    }
    if (remplacant.statutVerification !== 'verifie') {
      throw new Error("Cet étudiant n'a pas encore validé son profil universitaire (profil non vérifié).");
    }
    if (remplacantId === demandeurId) {
      throw new Error("Vous ne pouvez pas vous désigner vous-même comme remplaçant.");
    }

    // Vérifier si le remplaçant est déjà membre accepté
    const membreExistant = membres.find(m => m.etudiantId === remplacantId);
    if (membreExistant && membreExistant.statutAdhesion === 'accepte') {
      throw new Error("Cet étudiant fait déjà partie des colocataires acceptés.");
    }

    const maintenant = new Date().toISOString();
    const batch = writeBatch(db);

    // 1. Marquer la demande de départ sur le membre demandeur
    const demandeurRef = doc(db, 'espaces', annonceId, 'membres', demandeurId);
    batch.update(demandeurRef, {
      demandeDepart: true,
      remplacantId: remplacantId
    });

    // 2. Créer l'invitation de remplacement
    const remplacantRef = doc(db, 'espaces', annonceId, 'membres', remplacantId);
    const nouveauMembreRemplacant: Membre = {
      etudiantId: remplacantId,
      premierLocataire: false,
      statutAdhesion: 'remplacement',
      remplaceEtudiantId: demandeurId,
      dateAdhesion: maintenant
    };
    batch.set(remplacantRef, nouveauMembreRemplacant);

    await batch.commit();

    // 3. Notifications
    const annonce = annonceSnap.exists() ? (annonceSnap.data() as Annonce) : null;
    const titre = annonce?.titre || 'la colocation';

    // Notifier le remplaçant
    await this.notificationService.create({
      userId: remplacantId,
      type: 'invitation_espace',
      contenu: `Vous avez été proposé comme remplaçant pour intégrer la colocation « ${titre} ». En attente de validation par le premier locataire.`,
      lien: `/espace/${annonceId}`,
      lue: false,
      dateEnvoi: maintenant,
      annonceId
    });

    // Notifier le premier locataire
    await this.notificationService.create({
      userId: espace.premierLocataireId,
      type: 'demande_espace',
      contenu: `Un colocataire souhaite quitter « ${titre} » et propose ${remplacant.nom || 'un remplaçant'} pour reprendre sa place. Veuillez statuer sur ce remplacement.`,
      lien: `/espace/${annonceId}`,
      lue: false,
      dateEnvoi: maintenant,
      annonceId
    });
  }

  // 14. Validation ou refus du remplaçant par le premier locataire (départ automatique du demandeur si accepté)
  async validerRemplacement(
    annonceId: string,
    remplacantId: string,
    action: 'accepte' | 'refuse'
  ): Promise<void> {
    const [espace, annonceSnap, membres] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId)),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace introuvable.");

    const membreRemplacant = membres.find(m => m.etudiantId === remplacantId);
    if (!membreRemplacant) throw new Error("Candidature de remplacement introuvable.");

    const demandeurId = membreRemplacant.remplaceEtudiantId;
    if (!demandeurId) throw new Error("Impossible d'identifier le colocataire remplacé.");

    const maintenant = new Date().toISOString();
    const titre = annonceSnap.exists() ? (annonceSnap.data() as Annonce).titre : 'le logement';
    const batch = writeBatch(db);

    if (action === 'accepte') {
      // Le remplaçant devient membre accepté et confirmé
      const remplacantRef = doc(db, 'espaces', annonceId, 'membres', remplacantId);
      batch.update(remplacantRef, {
        statutAdhesion: 'accepte',
        confirme: true,
        dateConfirmation: maintenant
      });

      // Le colocataire demandeur quitte automatiquement la colocation
      const demandeurRef = doc(db, 'espaces', annonceId, 'membres', demandeurId);
      batch.update(demandeurRef, {
        statutAdhesion: 'refuse',
        demandeDepart: false,
        premierLocataire: false
      });

      // Si le demandeur sortant était le premier locataire : désigner un successeur
      if (espace.premierLocataireId === demandeurId) {
        const autres = membres.filter(m => m.statutAdhesion === 'accepte' && m.etudiantId !== demandeurId);
        const nouveauPremierId = autres.length > 0 ? autres[0].etudiantId : remplacantId;

        const newPremierRef = doc(db, 'espaces', annonceId, 'membres', nouveauPremierId);
        batch.update(newPremierRef, { premierLocataire: true });

        const espaceRef = doc(db, 'espaces', annonceId);
        batch.update(espaceRef, { premierLocataireId: nouveauPremierId });
      }

      await batch.commit();

      // Notifications
      await this.notificationService.create({
        userId: demandeurId,
        type: 'adhesion_acceptee',
        contenu: `Votre remplaçant a été validé par le premier locataire. Votre départ de la colocation « ${titre} » est désormais effectif.`,
        lien: `/annonces/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });

      await this.notificationService.create({
        userId: remplacantId,
        type: 'adhesion_acceptee',
        contenu: `Félicitations ! Votre intégration en remplacement dans « ${titre} » a été validée par le premier locataire. Bienvenue dans la colocation !`,
        lien: `/espace/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });

      if (espace.proprietaireId) {
        await this.notificationService.create({
          userId: espace.proprietaireId,
          type: 'demande',
          contenu: `Un remplacement de colocataire a été validé avec succès pour votre logement « ${titre} ».`,
          lien: `/espace/${annonceId}`,
          lue: false,
          dateEnvoi: maintenant,
          annonceId
        });
      }
    } else {
      // Refus du remplaçant
      const remplacantRef = doc(db, 'espaces', annonceId, 'membres', remplacantId);
      batch.update(remplacantRef, { statutAdhesion: 'refuse' });

      const demandeurRef = doc(db, 'espaces', annonceId, 'membres', demandeurId);
      batch.update(demandeurRef, { demandeDepart: false, remplacantId: null });

      await batch.commit();

      await this.notificationService.create({
        userId: demandeurId,
        type: 'adhesion_refusee',
        contenu: `Le premier locataire n'a pas retenu le remplaçant proposé pour « ${titre} ». Veuillez proposer un autre remplaçant pour finaliser votre départ.`,
        lien: `/espace/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });

      await this.notificationService.create({
        userId: remplacantId,
        type: 'adhesion_refusee',
        contenu: `Votre candidature de remplacement pour la colocation « ${titre} » n'a pas été retenue.`,
        lien: `/annonces/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });
    }
  }

  // 13. Quitter la colocation avec gestion du premier locataire
  async leave(annonceId: string, etudiantId: string): Promise<void> {
    const [espace, annonceSnap, membres] = await Promise.all([
      this.getEspace(annonceId),
      getDoc(doc(db, 'annonces', annonceId)),
      this.getMembres(annonceId)
    ]);

    if (!espace) throw new Error("Espace introuvable.");

    const acceptes = membres.filter(m => m.statutAdhesion === 'accepte');
    const estPremier = espace.premierLocataireId === etudiantId;
    const maintenant = new Date().toISOString();
    const titre = annonceSnap.exists() ? (annonceSnap.data() as Annonce).titre : 'le logement';

    if (estPremier) {
      const autresAcceptes = acceptes.filter(m => m.etudiantId !== etudiantId);

      // Si le premier locataire est seul : fermeture automatique de l'espace
      if (autresAcceptes.length === 0) {
        const batch = writeBatch(db);
        const membreRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
        batch.update(membreRef, { statutAdhesion: 'refuse', premierLocataire: false });

        const espaceRef = doc(db, 'espaces', annonceId);
        batch.update(espaceRef, {
          statut: 'ferme',
          motifFermeture: 'Fermé automatiquement suite au départ du premier locataire'
        });

        if (annonceSnap.exists()) {
          const a = annonceSnap.data() as Annonce;
          if (a.statut === 'louee') {
            const annonceRef = doc(db, 'annonces', annonceId);
            batch.update(annonceRef, { statut: 'publiee' });
          }
        }

        await batch.commit();

        // Notifier le propriétaire
        await this.notificationService.create({
          userId: espace.proprietaireId,
          type: 'demande',
          contenu: `Le premier locataire a quitté la colocation pour « ${titre} ». N'ayant pas d'autres colocataires, l'espace a été fermé automatiquement.`,
          lien: `/mes-annonces`,
          lue: false,
          dateEnvoi: maintenant,
          annonceId
        });

        return;
      }

      // S'il reste d'autres colocataires : le plus ancien devient le nouveau premier locataire
      autresAcceptes.sort((a, b) => (a.dateAdhesion || '').localeCompare(b.dateAdhesion || ''));
      const nouveauPremier = autresAcceptes[0];

      const batch = writeBatch(db);
      // Ancien premier locataire
      const membreSortantRef = doc(db, 'espaces', annonceId, 'membres', etudiantId);
      batch.update(membreSortantRef, { statutAdhesion: 'refuse', premierLocataire: false });

      // Nouveau premier locataire
      const nouveauPremierRef = doc(db, 'espaces', annonceId, 'membres', nouveauPremier.etudiantId);
      batch.update(nouveauPremierRef, { premierLocataire: true });

      // Mise à jour de l'espace
      const espaceRef = doc(db, 'espaces', annonceId);
      const updatesEspace: any = {
        premierLocataireId: nouveauPremier.etudiantId
      };
      if (espace.statut === 'complet') {
        updatesEspace.statut = 'ouvert';
      }
      batch.update(espaceRef, updatesEspace);

      await batch.commit();

      // Notifications
      await this.notificationService.create({
        userId: nouveauPremier.etudiantId,
        type: 'adhesion_acceptee',
        contenu: `Suite au départ du premier locataire pour « ${titre} », vous êtes désormais désigné premier locataire et administrateur de cet espace !`,
        lien: `/espace/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });

      await this.notificationService.create({
        userId: espace.proprietaireId,
        type: 'demande',
        contenu: `Le premier locataire a quitté la colocation pour « ${titre} ». Le colocataire le plus ancien a été automatiquement promu premier locataire.`,
        lien: `/espace/${annonceId}`,
        lue: false,
        dateEnvoi: maintenant,
        annonceId
      });

      return;
    }

    // Départ d'un colocataire ordinaire
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

  // Récupère les espaces de colocation actifs (non fermés) appartenant à un propriétaire
  async getEspacesByProprietaire(proprietaireId: string): Promise<Espace[]> {
    const colRef = collection(db, 'espaces');
    const q = query(colRef, where('proprietaireId', '==', proprietaireId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Espace), annonceId: d.id }))
      .filter(e => e.statut !== 'ferme');
  }

  // Récupère la liste des annonces dont la colocation est confirmée et dont la durée n'est pas encore expirée
  async getEspacesConfirmesEnCoursIds(): Promise<string[]> {
    try {
      const colRef = collection(db, 'espaces');
      const q = query(colRef, where('statut', '==', 'confirme'));
      const snap = await getDocs(q);
      const maintenant = new Date().toISOString();
      return snap.docs
        .map(d => ({ ...(d.data() as Espace), annonceId: d.id }))
        .filter(e => !e.dateFinLocation || e.dateFinLocation > maintenant)
        .map(e => e.annonceId);
    } catch {
      return [];
    }
  }

  // Récupère les espaces de colocation où l'étudiant est membre accepté et l'espace est actif (non fermé)
  async getEspacesByEtudiant(etudiantId: string): Promise<Espace[]> {
    const espacesMap = new Map<string, Espace>();

    // 1. Recherche par les demandes acceptées de l'étudiant
    try {
      const demandesCol = collection(db, 'demandes');
      const qDemandes = query(
        demandesCol,
        where('etudiantId', '==', etudiantId),
        where('statut', '==', 'acceptee')
      );
      const snapDemandes = await getDocs(qDemandes);
      for (const d of snapDemandes.docs) {
        const dData = d.data() as Demande;
        if (dData.annonceId && !espacesMap.has(dData.annonceId)) {
          const esp = await this.getEspace(dData.annonceId);
          if (esp && esp.statut !== 'ferme') {
            espacesMap.set(dData.annonceId, esp);
          }
        }
      }
    } catch {
      // Ignorer si index ou permissions
    }

    // 2. Recherche sur la collection espaces pour les invitations / adhésions directes
    try {
      const colRef = collection(db, 'espaces');
      const snap = await getDocs(colRef);
      for (const d of snap.docs) {
        if (!espacesMap.has(d.id)) {
          try {
            const membreRef = doc(db, 'espaces', d.id, 'membres', etudiantId);
            const membreSnap = await getDoc(membreRef);
            if (membreSnap.exists()) {
              const membre = membreSnap.data() as Membre;
              if (membre.statutAdhesion === 'accepte') {
                const esp = { id: d.id, ...(d.data() as Espace), annonceId: d.id };
                if (esp.statut !== 'ferme') {
                  espacesMap.set(d.id, esp);
                }
              }
            }
          } catch {
            // Document non accessible
          }
        }
      }
    } catch {
      // Si la lecture de collection globale est restreinte
    }

    return Array.from(espacesMap.values());
  }
}
