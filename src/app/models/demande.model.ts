export type StatutDemande = 'en_attente' | 'acceptee' | 'refusee' | 'annulee';

// Modèle demande Firestore : collection demandes/{id}
export interface Demande {
  id?: string;
  etudiantId: string;
  annonceId: string;
  proprietaireId: string;
  message: string;
  statut: StatutDemande;
  dateEnvoi: string; // ISO string
}
