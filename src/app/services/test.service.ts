import { Injectable } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

@Injectable({
  providedIn: 'root'
})
export class TestService {

  // Vérifie si un utilisateur est actuellement connecté à Firebase Auth
  estUtilisateurConnecte(): boolean {
    return auth.currentUser !== null;
  }

  // Récupère l'email de l'utilisateur connecté s'il existe
  obtenirEmailUtilisateur(): string | null {
    return auth.currentUser?.email || null;
  }

  // Interroge la collection 'users' dans Firestore avec un délai maximal de 8 secondes
  async testerFirestore(): Promise<{ nbDocuments: number; tempsMs: number }> {
    const debut = performance.now();

    // Promesse de timeout à 8 secondes
    const promesseTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Délai dépassé: Firestore ne répond pas'));
      }, 8000);
    });

    // Promesse de lecture Firestore sur la collection 'users'
    const promesseFirestore = (async () => {
      const collectionUsers = collection(db, 'users');
      const resultat = await getDocs(collectionUsers);
      return resultat;
    })();

    // Course entre la requête et le timeout
    const snapshot = await Promise.race([promesseFirestore, promesseTimeout]);
    const fin = performance.now();
    const tempsMs = Math.round(fin - debut);

    return {
      nbDocuments: snapshot.size,
      tempsMs
    };
  }
}

