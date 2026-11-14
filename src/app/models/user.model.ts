export type RoleUtilisateur = 'etudiant' | 'proprietaire' | 'admin';
export type StatutVerification = 'non_verifie' | 'en_attente' | 'verifie' | 'refuse';

// Modèle utilisateur Firestore : collection users/{uid}
export interface User {
  uid?: string;
  nom: string;
  email: string;
  telephone: string;
  photo?: string | null;
  role: RoleUtilisateur;
  statutVerification: StatutVerification;
  faculte?: string;
  niveau?: string;
  filiere?: string;
  favoris: string[]; // tableau d'identifiants d'annonces
  dateInscription: string; // ISO string
}

// Alias francophone pour compatibilité
export type Utilisateur = User;
