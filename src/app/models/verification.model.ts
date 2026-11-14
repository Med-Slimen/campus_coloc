export type TypePieceVerification = 'carte_etudiante' | 'cin';
export type StatutVerificationPiece = 'en_attente' | 'verifie' | 'refuse';

// Modèle vérification Firestore : collection verifications/{id}
export interface Verification {
  id?: string;
  userId: string;
  type: TypePieceVerification;
  fichier: string; // image compressée en base64
  statut: StatutVerificationPiece;
  motifRefus?: string;
  dateDepot: string; // ISO string
}
