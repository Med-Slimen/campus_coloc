export type StatutSignalement = 'ouvert' | 'traite';

// Modèle signalement Firestore : collection signalements/{id}
export interface Signalement {
  id?: string;
  auteurId: string;
  annonceId: string;
  motif: string;
  statut: StatutSignalement;
  dateSignalement: string; // ISO string
}
