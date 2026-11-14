import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { VerificationService } from '../../services/verification.service';
import { ImageService } from '../../services/image.service';
import { ToastService } from '../../services/toast.service';
import { StatutVerification, RoleUtilisateur, TypePieceVerification, Verification } from '../../models';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AvatarComponent, StatusBadgeComponent],
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.css']
})
export class ProfilComponent implements OnInit {
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private verificationService = inject(VerificationService);
  private imageService = inject(ImageService);
  private toastService = inject(ToastService);

  // Champs modifiables du profil utilisateur
  nom: string = '';
  email: string = '';
  telephone: string = '';
  photo: string | null = null;

  // Champs spécifiques aux étudiants
  faculte: string = '';
  niveau: string = 'Licence 1';
  filiere: string = '';

  // Liste des niveaux d'études en Tunisie
  readonly niveauxEtudes = [
    'Licence 1',
    'Licence 2',
    'Licence 3',
    'Master 1',
    'Master 2',
    'Cycle Ingénieur 1ère année',
    'Cycle Ingénieur 2ème année',
    'Cycle Ingénieur 3ème année',
    'Doctorat',
    'Autre'
  ];

  // Gestion de la section de vérification
  typePiece: TypePieceVerification = 'carte_etudiante';
  justificatifBase64: string | null = null;
  nomFichierJustificatif: string | null = null;
  derniereVerification: Verification | null = null;
  nouveauDepotActif: boolean = false;

  // Drapeaux d'état
  chargementProfil: boolean = false;
  chargementPhoto: boolean = false;
  chargementVerification: boolean = false;
  erreurProfil: string | null = null;
  erreurVerification: string | null = null;

  // Rôle de l'utilisateur connecté
  get roleActuel(): RoleUtilisateur {
    return this.authService.currentUser?.role || 'etudiant';
  }

  // Statut de vérification de l'utilisateur
  get statutVerification(): StatutVerification {
    return this.authService.currentUser?.statutVerification || 'non_verifie';
  }

  // Initialisation et chargement des données depuis Firestore
  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();
    const user = this.authService.currentUser;

    if (user) {
      this.nom = user.nom || '';
      this.email = user.email || '';
      this.telephone = user.telephone || '';
      this.photo = user.photo || null;
      this.faculte = user.faculte || '';
      this.niveau = user.niveau || 'Licence 1';
      this.filiere = user.filiere || '';

      // Par défaut, le propriétaire ne peut soumettre que la CIN
      if (user.role === 'proprietaire') {
        this.typePiece = 'cin';
      } else {
        this.typePiece = 'carte_etudiante';
      }

      if (user.uid) {
        await this.chargerDerniereVerification(user.uid);
      }
    }
  }

  // Charge le document de vérification le plus récent de l'utilisateur
  async chargerDerniereVerification(uid: string): Promise<void> {
    try {
      this.derniereVerification = await this.verificationService.getMyVerification(uid);
    } catch (err) {
      console.error('Erreur lors du chargement de la vérification :', err);
    }
  }

  // Formate le numéro de téléphone au format tunisien (+216 XX XXX XXX)
  onTelephoneChange(): void {
    const brut = this.telephone.replace(/\D/g, '');
    if (!brut) return;

    let chiffres8 = brut;
    if (brut.startsWith('216') && brut.length >= 11) {
      chiffres8 = brut.slice(3, 11);
    } else if (brut.length > 8) {
      chiffres8 = brut.slice(-8);
    }

    if (chiffres8.length === 8) {
      this.telephone = `+216 ${chiffres8.slice(0, 2)} ${chiffres8.slice(2, 5)} ${chiffres8.slice(5, 8)}`;
    }
  }

  // Sélectionne et compresse une photo de profil via ImageService
  async changerPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const fichier = input.files[0];
    this.chargementPhoto = true;

    try {
      const base64 = await this.imageService.compressImage(fichier);
      this.photo = base64;
      this.toastService.succes('Photo compressée avec succès. Pensez à enregistrer vos modifications.');
    } catch (err: any) {
      this.toastService.erreur(err?.message || 'Erreur lors du traitement de la photo.');
    } finally {
      this.chargementPhoto = false;
      input.value = '';
    }
  }

  // Supprime la photo de profil sélectionnée
  supprimerPhoto(): void {
    this.photo = null;
    this.toastService.info('Photo retirée. Pensez à enregistrer vos modifications.');
  }

  // Enregistre les coordonnées et le cursus dans Firestore
  async enregistrerProfil(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) {
      this.toastService.erreur("Vous n'êtes pas connecté.");
      return;
    }

    if (!this.nom.trim()) {
      this.erreurProfil = 'Le nom complet est obligatoire.';
      return;
    }

    this.chargementProfil = true;
    this.erreurProfil = null;

    try {
      const modifications: any = {
        nom: this.nom.trim(),
        telephone: this.telephone.trim(),
        photo: this.photo
      };

      if (this.roleActuel === 'etudiant') {
        modifications.faculte = this.faculte.trim();
        modifications.niveau = this.niveau;
        modifications.filiere = this.filiere.trim();
      }

      await this.userService.updateUser(user.uid, modifications);

      // Synchronisation en mémoire
      user.nom = modifications.nom;
      user.telephone = modifications.telephone;
      user.photo = modifications.photo;
      if (this.roleActuel === 'etudiant') {
        user.faculte = modifications.faculte;
        user.niveau = modifications.niveau;
        user.filiere = modifications.filiere;
      }

      this.toastService.succes('Profil mis à jour avec succès.');
    } catch {
      this.erreurProfil = 'Erreur lors de la sauvegarde de votre profil.';
      this.toastService.erreur(this.erreurProfil);
    } finally {
      this.chargementProfil = false;
    }
  }

  // Sélectionne et compresse l'image du document justificatif (carte étudiante ou CIN)
  async choisirJustificatif(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const fichier = input.files[0];
    this.chargementVerification = true;
    this.erreurVerification = null;

    try {
      const base64 = await this.imageService.compressImage(fichier);
      this.justificatifBase64 = base64;
      this.nomFichierJustificatif = fichier.name;
      this.toastService.succes('Document importé et compressé avec succès.');
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors du traitement du document.';
      this.erreurVerification = msg;
      this.toastService.erreur(msg);
    } finally {
      this.chargementVerification = false;
      input.value = '';
    }
  }

  // Annule la sélection du fichier en cours de dépôt
  annulerSelectionJustificatif(): void {
    this.justificatifBase64 = null;
    this.nomFichierJustificatif = null;
  }

  // Active le mode de re-dépôt après un refus ou pour changer de document
  activerNouveauDepot(): void {
    this.nouveauDepotActif = true;
    this.justificatifBase64 = null;
    this.nomFichierJustificatif = null;
    this.erreurVerification = null;
  }

  // Soumet la pièce justificative à l'équipe de modération
  async envoyerVerification(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    if (!this.justificatifBase64) {
      this.erreurVerification = 'Veuillez sélectionner une photo claire de votre document.';
      return;
    }

    this.chargementVerification = true;
    this.erreurVerification = null;

    try {
      await this.verificationService.sendDocument(
        user.uid,
        this.typePiece,
        this.justificatifBase64
      );

      this.toastService.succes('Votre document a été envoyé avec succès. Votre statut passe en attente.');
      this.justificatifBase64 = null;
      this.nomFichierJustificatif = null;
      this.nouveauDepotActif = false;

      // Actualisation locale de la dernière vérification
      await this.chargerDerniereVerification(user.uid);
    } catch {
      this.erreurVerification = "Erreur lors de l'envoi de la pièce justificative.";
      this.toastService.erreur(this.erreurVerification);
    } finally {
      this.chargementVerification = false;
    }
  }
}
