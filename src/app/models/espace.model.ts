export type VisibiliteEspace = 'prive' | 'public';
export type StatutEspace = 'ouvert' | 'complet';
export type StatutAdhesion = 'invite' | 'demande' | 'accepte' | 'refuse';

// Modèle espace Firestore : collection espaces/{annonceId}
export interface Espace {
  id?: string;
  annonceId: string;
  proprietaireId: string;
  premierLocataireId: string;
  visibilite: VisibiliteEspace;
  statut: StatutEspace;
  reglesMaison: string[];
  dateOuverture: string; // ISO string
}

// Sous-collection membres : espaces/{annonceId}/membres/{etudiantId}
export interface Membre {
  etudiantId: string;
  premierLocataire: boolean;
  statutAdhesion: StatutAdhesion;
  dateAdhesion: string; // ISO string
}

// Alias pour compatibilité
export type MembreEspace = Membre;

// Sous-collection messages : espaces/{annonceId}/messages/{id}
export interface Message {
  id?: string;
  auteurId: string;
  auteurNom: string;
  contenu: string;
  dateEnvoi: string; // ISO string
}

// Alias pour compatibilité
export type MessageEspace = Message;
