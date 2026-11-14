// Modèle notification Firestore : collection notifications/{id}
export interface Notification {
  id?: string;
  userId: string;
  type: string;
  contenu: string;
  lien: string;
  lue: boolean;
  dateEnvoi: string; // ISO string
  annonceId?: string; // optionnel pour invitations ou demandes d'espace
}
