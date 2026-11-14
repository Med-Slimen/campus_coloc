import { VilleTunisie } from './villes';

export type StatutAnnonce = 'en_attente' | 'publiee' | 'suspendue' | 'refusee' | 'louee';

// Modèle annonce Firestore : collection annonces/{id}
export interface Annonce {
  id?: string;
  proprietaireId: string;
  titre: string;
  description: string;
  ville: VilleTunisie | string;
  quartier: string;
  loyer: number;
  charges: number;
  nombrePlaces: number;
  meuble: boolean;
  dureeLocation: string;
  photos: string[]; // max 4 photos compressées en base64
  statut: StatutAnnonce;
  motifRefus?: string;
  dateCreation: string; // ISO string
}
