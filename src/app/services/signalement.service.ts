import { Injectable } from '@angular/core';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { Signalement } from '../models';

// Service de signalement des annonces inappropriées
@Injectable({
  providedIn: 'root'
})
export class SignalementService {
  // Crée un nouveau signalement pour une annonce donnée
  async creerSignalement(data: Omit<Signalement, 'id'>): Promise<string> {
    const colRef = collection(db, 'signalements');
    const docRef = await addDoc(colRef, {
      ...data,
      statut: data.statut || 'ouvert',
      dateSignalement: data.dateSignalement || new Date().toISOString()
    });
    return docRef.id;
  }

  // Récupère l'ensemble des signalements triés du plus récent au plus ancien
  async getAllSignalements(): Promise<Signalement[]> {
    const colRef = collection(db, 'signalements');
    const snap = await getDocs(colRef);
    const signalements = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Signalement)
    }));
    return signalements.sort((a, b) =>
      (b.dateSignalement || '').localeCompare(a.dateSignalement || '')
    );
  }

  // Récupère les signalements ouverts pour le tableau de bord et la modération
  async getSignalementsOuverts(): Promise<Signalement[]> {
    const colRef = collection(db, 'signalements');
    const q = query(colRef, where('statut', '==', 'ouvert'));
    const snap = await getDocs(q);
    const signalements = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Signalement)
    }));
    return signalements.sort((a, b) =>
      (b.dateSignalement || '').localeCompare(a.dateSignalement || '')
    );
  }

  // Traite et clôture un signalement
  async traiterSignalement(id: string): Promise<void> {
    const docRef = doc(db, 'signalements', id);
    await updateDoc(docRef, { statut: 'traite' });
  }
}
