export type TypeToast = 'succes' | 'erreur' | 'info' | 'avertissement';

export interface Toast {
  id: string;
  type: TypeToast;
  message: string;
  dureeMs?: number;
}

