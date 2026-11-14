import { Injectable } from '@angular/core';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { User } from '../models';

/**
 * EXEMPLE D'APPEL DANS UN COMPOSANT AVEC try/catch/finally :
 *
 * async chargerProfil(uid: string) {
 *   this.chargement = true;
 *   this.erreur = null;
 *   try {
 *     this.utilisateur = await this.userService.getUser(uid);
 *   } catch (err: unknown) {
 *     this.erreur = 'Impossible de charger le profil pour le moment.';
 *   } finally {
 *     this.chargement = false;
 *   }
 * }
 */

@Injectable({
  providedIn: 'root'
})
export class UserService {
  // Récupère les données d'un utilisateur par son identifiant unique
  async getUser(uid: string): Promise<User | null> {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return { uid: snap.id, ...(snap.data() as User) };
  }

  // Crée un profil utilisateur dans Firestore
  async createUser(uid: string, data: Partial<User>): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, data, { merge: true });
  }

  // Met à jour les informations d'un utilisateur
  async updateUser(uid: string, data: Partial<User>): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, data);
  }

  // Récupère tous les utilisateurs (pour l'espace administration)
  async getAllUsers(): Promise<User[]> {
    const colRef = collection(db, 'users');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ uid: d.id, ...(d.data() as User) }));
  }

  // Ajoute l'identifiant d'une annonce aux favoris d'un étudiant
  async addFavori(uid: string, annonceId: string): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      favoris: arrayUnion(annonceId)
    });
  }

  // Supprime l'identifiant d'une annonce des favoris d'un étudiant
  async removeFavori(uid: string, annonceId: string): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      favoris: arrayRemove(annonceId)
    });
  }
}

