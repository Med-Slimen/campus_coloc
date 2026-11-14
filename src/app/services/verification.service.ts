import { Injectable, inject } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from 'firebase/firestore';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { Verification, TypePieceVerification } from '../models';

// Service de gestion et de validation des pièces justificatives (carte étudiante, CIN)
@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private notificationService = inject(NotificationService);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  // Enregistre un document justificatif et bascule le statut de l'utilisateur à en_attente
  async sendDocument(
    userId: string,
    type: TypePieceVerification,
    fichierBase64: string
  ): Promise<string> {
    const colRef = collection(db, 'verifications');
    const nouvellePiece: Omit<Verification, 'id'> = {
      userId,
      type,
      fichier: fichierBase64,
      statut: 'en_attente',
      dateDepot: new Date().toISOString()
    };

    const docRef = await addDoc(colRef, nouvellePiece);

    // Mise à jour du statut de l'utilisateur dans Firestore
    await this.userService.updateUser(userId, {
      statutVerification: 'en_attente'
    });

    // Synchronisation locale si c'est l'utilisateur connecté
    if (this.authService.currentUser && this.authService.currentUser.uid === userId) {
      this.authService.currentUser.statutVerification = 'en_attente';
    }

    return docRef.id;
  }

  // Récupère la dernière pièce justificative soumise par un utilisateur
  async getMyVerification(userId: string): Promise<Verification | null> {
    const colRef = collection(db, 'verifications');
    const q = query(colRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return null;
    }

    const pieces = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Verification)
    }));

    // Tri par date de dépôt décroissante pour retourner la plus récente
    pieces.sort((a, b) => (b.dateDepot || '').localeCompare(a.dateDepot || ''));
    return pieces[0];
  }

  // Récupère toutes les vérifications en attente de modération pour l'administration
  async getEnAttente(): Promise<Verification[]> {
    const colRef = collection(db, 'verifications');
    const q = query(colRef, where('statut', '==', 'en_attente'));
    const snap = await getDocs(q);

    const pieces = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Verification)
    }));

    return pieces.sort((a, b) => (a.dateDepot || '').localeCompare(b.dateDepot || ''));
  }

  // Valide une pièce justificative, certifie l'utilisateur et lui envoie une notification
  async approve(verificationId: string, userId: string): Promise<void> {
    const pieceRef = doc(db, 'verifications', verificationId);
    await updateDoc(pieceRef, { statut: 'verifie' });

    // Mise à jour de l'utilisateur
    await this.userService.updateUser(userId, {
      statutVerification: 'verifie'
    });

    // Synchronisation locale
    if (this.authService.currentUser && this.authService.currentUser.uid === userId) {
      this.authService.currentUser.statutVerification = 'verifie';
    }

    // Création d'une notification
    await this.notificationService.create({
      userId,
      type: 'verification',
      contenu: "Félicitations ! Votre pièce justificative a été approuvée. Votre compte est désormais certifié.",
      lien: '/profil',
      lue: false,
      dateEnvoi: new Date().toISOString()
    });
  }

  // Refuse une pièce avec motif explicatif, met à jour l'utilisateur et lui envoie une notification
  async refuse(verificationId: string, userId: string, motifRefus: string): Promise<void> {
    const pieceRef = doc(db, 'verifications', verificationId);
    await updateDoc(pieceRef, {
      statut: 'refuse',
      motifRefus: motifRefus.trim()
    });

    // Mise à jour de l'utilisateur
    await this.userService.updateUser(userId, {
      statutVerification: 'refuse'
    });

    // Synchronisation locale
    if (this.authService.currentUser && this.authService.currentUser.uid === userId) {
      this.authService.currentUser.statutVerification = 'refuse';
    }

    // Création d'une notification avec le motif de refus
    await this.notificationService.create({
      userId,
      type: 'verification',
      contenu: `Votre document justificatif a été refusé : "${motifRefus}". Veuillez soumettre un nouveau document lisible.`,
      lien: '/profil',
      lue: false,
      dateEnvoi: new Date().toISOString()
    });
  }
}
