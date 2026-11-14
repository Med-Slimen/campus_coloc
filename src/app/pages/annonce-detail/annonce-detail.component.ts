import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { AnnonceService } from '../../services/annonce.service';
import { UserService } from '../../services/user.service';
import { EspaceService } from '../../services/espace.service';
import { DemandeService } from '../../services/demande.service';
import { NotificationService } from '../../services/notification.service';
import { SignalementService } from '../../services/signalement.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Annonce, Demande } from '../../models';

@Component({
  selector: 'app-annonce-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IconComponent,
    AvatarComponent,
    LoaderComponent,
    ErrorMessageComponent,
    StatusBadgeComponent
  ],
  templateUrl: './annonce-detail.component.html',
  styleUrls: ['./annonce-detail.component.css']
})
export class AnnonceDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private annonceService = inject(AnnonceService);
  private userService = inject(UserService);
  private espaceService = inject(EspaceService);
  private demandeService = inject(DemandeService);
  private notificationService = inject(NotificationService);
  private signalementService = inject(SignalementService);
  public authService = inject(AuthService);
  private toastService = inject(ToastService);

  // Identifiant et données du logement
  annonceId: string = '';
  annonce: Annonce | null = null;

  // Données restreintes du propriétaire (prénom uniquement, JAMAIS de téléphone ni email)
  proprietairePrenom: string = 'Hôte';
  proprietairePhoto: string | null = null;
  hoteVerifie: boolean = false;

  // Espace de colocation
  hasEspace: boolean = false;
  espacePublicOuvert: boolean = false;
  estColocataireAccepte: boolean = false;

  // Demande existante de l'étudiant connecté
  demandeExistante: Demande | null = null;
  aDemandeAdhesion: boolean = false;

  // Détermine si l'étudiant est colocataire accepté (soit membre accepté, soit demande acceptée)
  get estColocataire(): boolean {
    return this.estColocataireAccepte || this.demandeExistante?.statut === 'acceptee';
  }

  // Détermine si l'utilisateur connecté est le propriétaire de cette annonce
  get estMonAnnonce(): boolean {
    const uid = this.authService.currentUser?.uid;
    return !!(uid && this.annonce && this.annonce.proprietaireId === uid);
  }

  // Modale de demande d'intérêt
  dialogInteresseOuvert: boolean = false;
  messageDemande: string = '';
  envoiDemandeEnCours: boolean = false;
  raisonBlocage: string | null = null;

  // Modale de signalement
  dialogSignalerOuvert: boolean = false;
  motifSignalement: string = '';
  envoiSignalementEnCours: boolean = false;
  erreurMotifSignalement: string | null = null;

  // Gestion de la galerie de photos
  photoPrincipaleSelectionnee: string | null = null;

  // Détermine si l'annonce figure dans les favoris de l'étudiant
  get estEnFavoris(): boolean {
    return this.authService.estFavori(this.annonceId);
  }

  // États de chargement et d'erreur
  chargement: boolean = true;
  erreur: string | null = null;

  // Détermine si un utilisateur est authentifié
  get estConnecte(): boolean {
    return !!this.authService.currentUser;
  }

  // Détermine si l'utilisateur connecté est un étudiant
  get estEtudiant(): boolean {
    return this.authService.currentUser?.role === 'etudiant';
  }

  // Vérifie si l'étudiant a certifié son profil
  get etudiantEstVerifie(): boolean {
    return this.authService.currentUser?.statutVerification === 'verifie';
  }

  // Calcule le budget par personne en DT
  get budgetParPersonne(): number {
    if (!this.annonce) return 0;
    const loyer = Number(this.annonce.loyer) || 0;
    const charges = Number(this.annonce.charges) || 0;
    const places = Math.max(1, Number(this.annonce.nombrePlaces) || 1);
    return Math.round((loyer + charges) / places);
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.annonceId = id;
        this.chargerAnnonce(id);
      }
    });
  }

  // Récupère les données de l'annonce et de son propriétaire
  async chargerAnnonce(id: string): Promise<void> {
    this.chargement = true;
    this.erreur = null;
    this.raisonBlocage = null;

    try {
      const a = await this.annonceService.getById(id);
      if (!a) {
        this.erreur = "Ce logement est introuvable ou n'est plus disponible.";
        return;
      }

      this.annonce = a;
      if (a.photos && a.photos.length > 0) {
        this.photoPrincipaleSelectionnee = a.photos[0];
      }

      // Récupération stricte du premier prénom et du statut de vérification (aucun contact direct)
      if (a.proprietaireId) {
        try {
          const proprietaire = await this.userService.getUser(a.proprietaireId);
          if (proprietaire) {
            const partiesNom = (proprietaire.nom || '').trim().split(/\s+/);
            this.proprietairePrenom = partiesNom[0] || 'Hôte';
            this.proprietairePhoto = proprietaire.photo || null;
            this.hoteVerifie = proprietaire.statutVerification === 'verifie';
          }
        } catch {
          this.proprietairePrenom = 'Hôte';
        }
      }

      // Vérification si un espace existe déjà pour ce logement
      try {
        const espace = await this.espaceService.getEspace(id);
        this.hasEspace = !!espace;
        this.espacePublicOuvert = !!(
          espace &&
          espace.visibilite === 'public' &&
          espace.statut === 'ouvert'
        );

        if (this.hasEspace && this.authService.currentUser?.uid) {
          const uid = this.authService.currentUser.uid;
          const membres = await this.espaceService.getMembres(id).catch(() => []);
          this.aDemandeAdhesion = membres.some(
            m => m.etudiantId === uid && m.statutAdhesion === 'demande'
          );
          this.estColocataireAccepte = (
            espace?.premierLocataireId === uid ||
            membres.some(m => m.etudiantId === uid && m.statutAdhesion === 'accepte')
          );
        }
      } catch {
        this.hasEspace = false;
        this.espacePublicOuvert = false;
        this.estColocataireAccepte = false;
      }

      // Vérification si l'étudiant connecté a déjà transmis une demande
      if (this.authService.currentUser?.uid && this.estEtudiant) {
        try {
          this.demandeExistante = await this.demandeService.getDemandeExistante(
            this.authService.currentUser.uid,
            id
          );
        } catch {
          this.demandeExistante = null;
        }
      }
    } catch {
      this.erreur = 'Impossible de charger les détails de cette annonce.';
    } finally {
      this.chargement = false;
    }
  }

  // Permet de changer la photo principale affichée dans la galerie
  selectionnerPhoto(photo: string): void {
    this.photoPrincipaleSelectionnee = photo;
  }

  // Ouvre le dialogue de demande ou bloque avec un message explicatif
  async actionInteresse(): Promise<void> {
    if (!this.estConnecte) {
      this.toastService.info('Veuillez vous connecter pour postuler à cette colocation.');
      this.router.navigate(['/connexion'], {
        queryParams: { redirect: `/annonces/${this.annonceId}` }
      });
      return;
    }

    if (!this.estEtudiant) {
      this.toastService.avertissement('Seuls les étudiants peuvent postuler à une colocation.');
      return;
    }

    // Si l'annonce possède déjà un espace actif
    if (this.hasEspace) {
      if (this.espacePublicOuvert) {
        await this.demanderARejoindre();
        return;
      } else {
        this.toastService.info(
          "Cette colocation est actuellement complète ou privée."
        );
        this.raisonBlocage =
          "Cet espace de colocation n'accepte pas de nouvelles adhésions actuellement.";
        return;
      }
    }

    // Blocage 2 : L'étudiant n'est pas encore vérifié
    if (!this.etudiantEstVerifie) {
      this.toastService.erreur(
        "Votre profil étudiant n'est pas encore certifié. Vous devez faire valider votre carte d'étudiant ou CIN dans votre profil avant d'envoyer une demande."
      );
      this.raisonBlocage =
        "Votre profil n'a pas encore été certifié par notre équipe. Rendez-vous sur votre page Profil pour transmettre votre justificatif universitaire.";
      return;
    }

    // Blocage 3 : Une demande a déjà été envoyée pour cette annonce
    if (this.demandeExistante) {
      this.toastService.avertissement(
        'Vous avez déjà transmis une demande pour ce logement. Retrouvez-la dans votre onglet « Mes demandes ».'
      );
      this.raisonBlocage =
        'Une demande a déjà été enregistrée pour ce logement. Vous pouvez suivre son statut dans votre espace personnel.';
      return;
    }

    // Ouverture de la boîte de dialogue modale
    this.messageDemande = '';
    this.dialogInteresseOuvert = true;
  }

  // Ferme la modale de demande
  fermerDialogInteresse(): void {
    this.dialogInteresseOuvert = false;
    this.messageDemande = '';
  }

  // Envoie la demande au propriétaire et crée une notification
  async confirmerEnvoiDemande(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid || !this.annonce) return;

    this.envoiDemandeEnCours = true;

    try {
      const demandeId = await this.demandeService.envoyerDemande({
        etudiantId: user.uid,
        annonceId: this.annonceId,
        proprietaireId: this.annonce.proprietaireId,
        message: this.messageDemande.trim(),
        statut: 'en_attente',
        dateEnvoi: new Date().toISOString()
      });

      // Notification au propriétaire
      await this.notificationService.create({
        userId: this.annonce.proprietaireId,
        type: 'demande',
        contenu: `Nouvelle demande de colocation reçue de ${user.nom} pour votre annonce « ${this.annonce.titre} ».`,
        lien: '/demandes',
        lue: false,
        dateEnvoi: new Date().toISOString()
      });

      this.demandeExistante = {
        id: demandeId,
        etudiantId: user.uid,
        annonceId: this.annonceId,
        proprietaireId: this.annonce.proprietaireId,
        message: this.messageDemande.trim(),
        statut: 'en_attente',
        dateEnvoi: new Date().toISOString()
      };

      this.toastService.succes('Votre demande a été transmise avec succès au propriétaire !');
      this.fermerDialogInteresse();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de l'envoi de la demande.");
    } finally {
      this.envoiDemandeEnCours = false;
    }
  }

  // Demande à rejoindre un espace public ouvert (Règle 4)
  async demanderARejoindre(): Promise<void> {
    if (!this.estConnecte) {
      this.toastService.info('Veuillez vous connecter pour postuler à cette colocation.');
      this.router.navigate(['/connexion'], {
        queryParams: { redirect: `/annonces/${this.annonceId}` }
      });
      return;
    }

    if (!this.estEtudiant) {
      this.toastService.avertissement('Seuls les étudiants peuvent rejoindre une colocation.');
      return;
    }

    if (!this.etudiantEstVerifie) {
      this.toastService.erreur(
        "Votre profil étudiant n'est pas encore certifié. Vous devez faire valider votre justificatif universitaire dans votre profil avant d'envoyer une demande."
      );
      this.raisonBlocage =
        "Votre profil étudiant n'est pas encore vérifié. Transmettez votre justificatif dans votre profil pour pouvoir postuler.";
      return;
    }

    if (this.aDemandeAdhesion) {
      this.toastService.info("Vous avez déjà transmis une demande pour rejoindre cette colocation.");
      return;
    }

    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.envoiDemandeEnCours = true;
    try {
      await this.espaceService.requestToJoin(this.annonceId, user.uid);
      this.aDemandeAdhesion = true;
      this.toastService.succes("Votre demande d'adhésion a été transmise au premier locataire !");
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible de transmettre votre demande d'adhésion.");
    } finally {
      this.envoiDemandeEnCours = false;
    }
  }

  // Bouton 'Ajouter aux favoris' : bascule l'état dans Firestore via UserService
  async actionFavoris(): Promise<void> {
    if (!this.estConnecte) {
      this.toastService.info('Veuillez vous connecter pour enregistrer cette annonce.');
      this.router.navigate(['/connexion'], {
        queryParams: { redirect: `/annonces/${this.annonceId}` }
      });
      return;
    }

    if (!this.estEtudiant) {
      this.toastService.avertissement('L’enregistrement en favoris est réservé aux étudiants.');
      return;
    }

    try {
      if (this.estEnFavoris) {
        await this.authService.retirerFavori(this.annonceId);
        this.toastService.info('Annonce retirée de vos favoris.');
      } else {
        await this.authService.ajouterFavori(this.annonceId);
        this.toastService.succes('Annonce ajoutée à vos favoris !');
      }
    } catch {
      this.toastService.erreur('Une erreur est survenue lors de la mise à jour des favoris.');
    }
  }

  // Bouton 'Signaler' : ouvre la modale de signalement
  actionSignaler(): void {
    if (!this.estConnecte) {
      this.toastService.info('Veuillez vous connecter pour signaler un contenu.');
      this.router.navigate(['/connexion'], {
        queryParams: { redirect: `/annonces/${this.annonceId}` }
      });
      return;
    }

    this.dialogSignalerOuvert = true;
    this.motifSignalement = '';
    this.erreurMotifSignalement = null;
  }

  // Ferme la modale de signalement
  fermerDialogSignaler(): void {
    this.dialogSignalerOuvert = false;
    this.motifSignalement = '';
    this.erreurMotifSignalement = null;
  }

  // Valide et enregistre le signalement dans Firestore
  async confirmerSignalement(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    const motif = this.motifSignalement.trim();
    if (!motif) {
      this.erreurMotifSignalement = 'Veuillez préciser la raison du signalement.';
      return;
    }

    this.envoiSignalementEnCours = true;
    try {
      await this.signalementService.creerSignalement({
        auteurId: user.uid,
        annonceId: this.annonceId,
        motif,
        statut: 'ouvert',
        dateSignalement: new Date().toISOString()
      });

      this.toastService.succes('Votre signalement a bien été transmis aux administrateurs.');
      this.fermerDialogSignaler();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de l'envoi du signalement.");
    } finally {
      this.envoiSignalementEnCours = false;
    }
  }
}
