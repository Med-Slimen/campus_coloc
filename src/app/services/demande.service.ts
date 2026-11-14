import { Injectable } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { Demande, StatutDemande } from '../models';

// Service de gestion des demandes de colocation dans Firestore
@Injectable({
  providedIn: 'root'
})
export class DemandeService {
  // Enregistre une nouvelle demande de colocation avec statut initial 'en_attente'
  async envoyerDemande(data: Omit<Demande, 'id'>): Promise<string> {
    const colRef = collection(db, 'demandes');
    const nouvelleDemande: Omit<Demande, 'id'> = {
      ...data,
      statut: 'en_attente',
      dateEnvoi: data.dateEnvoi || new Date().toISOString()
    };
    const docRef = await addDoc(colRef, nouvelleDemande);
    return docRef.id;
  }

  // Récupère les demandes envoyées par un étudiant donné
  async getDemandesByEtudiant(etudiantId: string): Promise<Demande[]> {
    const colRef = collection(db, 'demandes');
    const q = query(colRef, where('etudiantId', '==', etudiantId));
    const snap = await getDocs(q);
    const demandes = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Demande)
    }));
    return demandes.sort((a, b) => (b.dateEnvoi || '').localeCompare(a.dateEnvoi || ''));
  }

  // Récupère les demandes reçues par un propriétaire pour ses logements
  async getDemandesByProprietaire(proprietaireId: string): Promise<Demande[]> {
    const colRef = collection(db, 'demandes');
    const q = query(colRef, where('proprietaireId', '==', proprietaireId));
    const snap = await getDocs(q);
    const demandes = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Demande)
    }));
    return demandes.sort((a, b) => (b.dateEnvoi || '').localeCompare(a.dateEnvoi || ''));
  }

  // Vérifie si une demande active existe déjà entre un étudiant et une annonce
  async getDemandeExistante(etudiantId: string, annonceId: string): Promise<Demande | null> {
    const colRef = collection(db, 'demandes');
    const q = query(colRef, where('etudiantId', '==', etudiantId));
    const snap = await getDocs(q);
    const existante = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Demande) }))
      .find(d => d.annonceId === annonceId && d.statut !== 'annulee');
    return existante || null;
  }

  // Met à jour le statut d'une demande
  async setStatut(demandeId: string, statut: StatutDemande): Promise<void> {
    const docRef = doc(db, 'demandes', demandeId);
    await updateDoc(docRef, { statut });
  }

  // Accepte une demande par le propriétaire
  async accepterDemande(demandeId: string): Promise<void> {
    await this.setStatut(demandeId, 'acceptee');
  }

  // Refuse une demande par le propriétaire
  async refuserDemande(demandeId: string): Promise<void> {
    await this.setStatut(demandeId, 'refusee');
  }

  // Annule une demande par l'étudiant
  async annulerDemande(demandeId: string): Promise<void> {
    await this.setStatut(demandeId, 'annulee');
  }

  // Récupère l'intégralité des demandes pour les statistiques administratives
  async getAllDemandes(): Promise<Demande[]> {
    const colRef = collection(db, 'demandes');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Demande)
    }));
  }

  // Alias pour getDemandesByEtudiant
  async getByEtudiant(etudiantId: string): Promise<Demande[]> {
    return this.getDemandesByEtudiant(etudiantId);
  }

  // Alias pour getDemandesByProprietaire
  async getByProprietaire(proprietaireId: string): Promise<Demande[]> {
    return this.getDemandesByProprietaire(proprietaireId);
  }
}
