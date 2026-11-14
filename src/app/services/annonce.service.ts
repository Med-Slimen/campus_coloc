import { Injectable } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit
} from 'firebase/firestore';
import { Annonce, StatutAnnonce } from '../models';

/**
 * Service de gestion des annonces de colocation dans Firestore.
 * Toutes les opérations de lecture et d'écriture respectent les règles de sécurité et de modération.
 */
@Injectable({
  providedIn: 'root'
})
export class AnnonceService {
  // Crée une nouvelle annonce avec statut initial 'en_attente'
  async create(data: Omit<Annonce, 'id'>): Promise<string> {
    const colRef = collection(db, 'annonces');
    const nouvelleAnnonce: Omit<Annonce, 'id'> = {
      ...data,
      statut: 'en_attente',
      dateCreation: new Date().toISOString()
    };
    const docRef = await addDoc(colRef, nouvelleAnnonce);
    return docRef.id;
  }

  // Met à jour une annonce : renvoie vers 'en_attente' si elle était publiée ou refusée
  async update(id: string, data: Partial<Annonce>): Promise<void> {
    const docRef = doc(db, 'annonces', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error("L'annonce demandée n'existe pas.");
    }

    const actuelle = snap.data() as Annonce;
    const maj: Partial<Annonce> = { ...data };

    // Si l'annonce était déjà validée ou refusée, toute modification la remet en cours de modération
    if (actuelle.statut === 'publiee' || actuelle.statut === 'refusee') {
      maj.statut = 'en_attente';
      maj.motifRefus = '';
    }

    await updateDoc(docRef, maj);
  }

  // Supprime une annonce si aucun espace de colocation n'y est rattaché
  async delete(id: string): Promise<void> {
    // Vérification de l'existence d'un espace rattaché
    const espaceRef = doc(db, 'espaces', id);
    const espaceSnap = await getDoc(espaceRef);

    if (espaceSnap.exists()) {
      throw new Error(
        "Suppression impossible : un espace de colocation actif est rattaché à ce logement."
      );
    }

    const docRef = doc(db, 'annonces', id);
    await deleteDoc(docRef);
  }

  // Modifie le statut de modération d'une annonce (publiée, suspendue, refusée)
  async setStatut(id: string, statut: StatutAnnonce, motifRefus?: string): Promise<void> {
    const docRef = doc(db, 'annonces', id);
    const maj: any = { statut };
    if (motifRefus !== undefined) {
      maj.motifRefus = motifRefus.trim();
    } else if (statut === 'publiee') {
      maj.motifRefus = '';
    }
    await updateDoc(docRef, maj);
  }

  // Récupère une annonce par son identifiant unique
  async getById(id: string): Promise<Annonce | null> {
    const docRef = doc(db, 'annonces', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return { id: snap.id, ...(snap.data() as Annonce) };
  }

  // Récupère toutes les annonces appartenant à un propriétaire donné
  async getByProprietaire(proprietaireId: string): Promise<Annonce[]> {
    const colRef = collection(db, 'annonces');
    const q = query(colRef, where('proprietaireId', '==', proprietaireId));
    const snap = await getDocs(q);
    const annonces = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Annonce)
    }));

    return annonces.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
  }

  // Récupère les annonces selon leur statut de modération
  async getByStatut(statut: StatutAnnonce): Promise<Annonce[]> {
    const colRef = collection(db, 'annonces');
    const q = query(colRef, where('statut', '==', statut));
    const snap = await getDocs(q);
    const annonces = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Annonce)
    }));

    return annonces.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
  }

  // Récupère les annonces publiées avec prise en compte des filtres optionnels
  // et exclusion stricte des annonces dont la colocation est confirmée et en cours
  async getPubliees(filtres?: {
    ville?: string;
    budgetMax?: number;
    meuble?: boolean;
  }): Promise<Annonce[]> {
    const maintenant = new Date().toISOString();

    // 1. Récupération des espaces confirmés en cours pour exclure les annonces concernées
    const espacesConfirmesIds = new Set<string>();
    try {
      const espacesCol = collection(db, 'espaces');
      const qEspaces = query(espacesCol, where('statut', '==', 'confirme'));
      const snapEspaces = await getDocs(qEspaces);
      for (const d of snapEspaces.docs) {
        const esp = d.data();
        if (esp['dateFinLocation'] && esp['dateFinLocation'] > maintenant) {
          espacesConfirmesIds.add(d.id);
        } else if (esp['dateFinLocation'] && esp['dateFinLocation'] <= maintenant) {
          // La durée de location est échue : l'annonce peut réapparaître en ligne
          try {
            const annonceDocRef = doc(db, 'annonces', d.id);
            await updateDoc(annonceDocRef, { statut: 'publiee' });
          } catch {
            // Ignorer si l'écriture échoue
          }
        }
      }
    } catch {
      // Ignorer si lecture non autorisée
    }

    const colRef = collection(db, 'annonces');
    const q = query(colRef, where('statut', '==', 'publiee'));
    const snap = await getDocs(q);

    let annonces = snap.docs
      .map(d => ({
        id: d.id,
        ...(d.data() as Annonce)
      }))
      .filter(a => !espacesConfirmesIds.has(a.id || ''));

    if (filtres?.ville) {
      annonces = annonces.filter(a => a.ville === filtres.ville);
    }
    if (filtres?.budgetMax) {
      annonces = annonces.filter(a => a.loyer <= (filtres.budgetMax || 0));
    }
    if (filtres?.meuble !== undefined) {
      annonces = annonces.filter(a => a.meuble === filtres.meuble);
    }

    return annonces.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
  }

  // Récupère les dernières annonces validées pour la page d'accueil (exclut les colocations confirmées en cours)
  async getDernieresAnnonces(nombre: number = 3): Promise<Annonce[]> {
    const publiees = await this.getPubliees();
    return publiees.slice(0, nombre);
  }

  // Récupère l'intégralité des annonces pour le tableau de bord administrateur
  async getAllAnnonces(): Promise<Annonce[]> {
    const colRef = collection(db, 'annonces');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Annonce)
    }));
  }

  // Méthode raccourcie pour publication admin
  async validerAnnonce(id: string): Promise<void> {
    await this.setStatut(id, 'publiee');
  }

  // Méthode raccourcie pour refus admin avec motif
  async refuserAnnonce(id: string, motif: string): Promise<void> {
    await this.setStatut(id, 'refusee', motif);
  }

  // Méthode raccourcie pour suspension
  async suspendreAnnonce(id: string): Promise<void> {
    await this.setStatut(id, 'suspendue');
  }
}
