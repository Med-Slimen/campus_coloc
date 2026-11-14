import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { LoaderComponent } from '../../components/loader/loader.component';
import { ErrorMessageComponent } from '../../components/error-message/error-message.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { EspaceService } from '../../services/espace.service';
import { AnnonceService } from '../../services/annonce.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Espace, Membre, Message, Annonce, User } from '../../models';

export interface MembreDetailItem {
  membre: Membre;
  user: User | null;
}

@Component({
  selector: 'app-espace',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IconComponent,
    AvatarComponent,
    StatusBadgeComponent,
    LoaderComponent,
    ErrorMessageComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './espace.component.html',
  styleUrls: ['./espace.component.css']
})
export class EspaceComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private espaceService = inject(EspaceService);
  private annonceService = inject(AnnonceService);
  private userService = inject(UserService);
  public authService = inject(AuthService);
  private toastService = inject(ToastService);

  // Données principales de l'espace et du logement
  annonceId: string = '';
  espace: Espace | null = null;
  annonce: Annonce | null = null;
  proprietaire: User | null = null;

  // Liste enrichie des membres avec leur profil utilisateur
  membresDetails: MembreDetailItem[] = [];

  // Discussion en direct
  messages: Message[] = [];
  nouveauMessage: string = '';
  private unsubscribeChat?: () => void;

  // Gestion des règles de la maison (par le 1er locataire)
  nouvelleRegle: string = '';

  // Formulaire d'invitation privée par email
  emailInvitation: string = '';
  invitationEnCours: boolean = false;

  // États du dialogue de confirmation pour quitter (espace non confirmé)
  dialogQuitterOuvert: boolean = false;
  // États du dialogue pour fermer l'espace par le propriétaire
  dialogFermerOuvert: boolean = false;
  // États du dialogue pour confirmer la colocation par un colocataire
  dialogConfirmerColocOuvert: boolean = false;

  // États du dialogue de demande de départ auprès du premier locataire (colocation confirmée)
  dialogDemandeDepartOuvert: boolean = false;
  motifDemandeDepart: string = '';
  demandeDepartEnCours: boolean = false;

  // États du dialogue d'invitation d'un remplaçant (une fois la demande acceptée)
  dialogInviterRemplacantOuvert: boolean = false;
  emailRemplacant: string = '';
  invitationRemplacantEnCours: boolean = false;

  // États des dialogues pour le candidat remplaçant
  dialogAccepterPropositionOuvert: boolean = false;
  dialogRefuserPropositionOuvert: boolean = false;

  actionEnCours: boolean = false;

  // Accès à Math pour les templates
  readonly Math = Math;

  // États de chargement et d'accès
  chargement: boolean = true;
  erreur: string | null = null;
  accesRefuse: boolean = false;

  // Détermine si l'espace est fermé
  get estFerme(): boolean {
    return this.espace?.statut === 'ferme';
  }

  // Détermine si l'espace est officiellement confirmé
  get estConfirme(): boolean {
    return this.espace?.statut === 'confirme';
  }

  // Indique si le propriétaire a confirmé la location
  get bailleurAConfirme(): boolean {
    return this.espace?.confirmationProprietaire === true;
  }

  // Nombre de membres acceptés ayant déjà confirmé
  get nbMembresConfirmes(): number {
    return this.membresAcceptes.filter(m => m.membre.confirme).length;
  }

  // Nombre total de parties devant confirmer (membres acceptés + bailleur)
  get totalPartiesAConfirmer(): number {
    return this.membresAcceptes.length + 1;
  }

  // Nombre total de parties ayant déjà confirmé
  get totalPartiesConfirmees(): number {
    return this.nbMembresConfirmes + (this.bailleurAConfirme ? 1 : 0);
  }

  // Membre courant de l'utilisateur connecté
  get monMembre(): MembreDetailItem | undefined {
    const uid = this.authService.currentUser?.uid;
    return this.membresDetails.find(m => m.membre.etudiantId === uid);
  }

  // Détermine si l'utilisateur connecté a déjà confirmé son engagement
  get jAiConfirme(): boolean {
    return this.monMembre?.membre.confirme === true;
  }

  // Indique si le membre connecté a une demande de départ
  get aDemandeDepart(): boolean {
    return this.monMembre?.membre.demandeDepart === true;
  }

  // Statut de validation de la demande de départ ('en_attente' | 'accepte' | 'refuse')
  get statutDepart(): 'en_attente' | 'accepte' | 'refuse' | undefined {
    return this.monMembre?.membre.statutDepart;
  }

  // Remplaçant actuellement invité par le membre connecté
  get remplacantInvite(): MembreDetailItem | undefined {
    const id = this.monMembre?.membre.remplacantId;
    return id ? this.membresDetails.find(m => m.membre.etudiantId === id) : undefined;
  }

  // Demandes de départ en attente de décision du premier locataire
  get demandesDepartEnAttente(): MembreDetailItem[] {
    return this.membresDetails.filter(
      m => m.membre.demandeDepart === true && m.membre.statutDepart === 'en_attente'
    );
  }

  // Candidat en remplacement actuellement connecté
  get estCandidatRemplacement(): boolean {
    const uid = this.authService.currentUser?.uid;
    return this.membresDetails.some(
      m => m.membre.etudiantId === uid && m.membre.statutAdhesion === 'remplacement'
    );
  }

  // Colocataire sortant que l'utilisateur connecté remplace (si candidat)
  get colocataireSortant(): MembreDetailItem | undefined {
    const id = this.monMembre?.membre.remplaceEtudiantId;
    return id ? this.membresDetails.find(m => m.membre.etudiantId === id) : undefined;
  }

  // Détermine si l'utilisateur actuel est le propriétaire du logement
  get estProprietaire(): boolean {
    const uid = this.authService.currentUser?.uid;
    return !!(uid && this.espace && this.espace.proprietaireId === uid);
  }

  // Détermine si l'utilisateur actuel est le premier locataire de la colocation
  get estPremierLocataire(): boolean {
    const uid = this.authService.currentUser?.uid;
    return !!(uid && this.espace && this.espace.premierLocataireId === uid);
  }

  // Détermine si l'utilisateur actuel est un colocataire accepté
  get estMembreAccepte(): boolean {
    const uid = this.authService.currentUser?.uid;
    return (
      this.estPremierLocataire ||
      this.membresDetails.some(
        m => m.membre.etudiantId === uid && m.membre.statutAdhesion === 'accepte'
      )
    );
  }

  // Détermine si l'utilisateur est un étudiant invité en attente de réponse
  get estInviteEnAttente(): boolean {
    const uid = this.authService.currentUser?.uid;
    return this.membresDetails.some(
      m => m.membre.etudiantId === uid && m.membre.statutAdhesion === 'invite'
    );
  }

  // Membres acceptés
  get membresAcceptes(): MembreDetailItem[] {
    return this.membresDetails.filter(m => m.membre.statutAdhesion === 'accepte');
  }

  // Candidatures ou invitations en attente
  get demandesAdhesionEnAttente(): MembreDetailItem[] {
    return this.membresDetails.filter(
      m => m.membre.statutAdhesion === 'demande' || m.membre.statutAdhesion === 'invite'
    );
  }

  // Calcul dynamique de la part de loyer par colocataire = (loyer + charges) / membres acceptés
  get partDeLoyer(): number {
    if (!this.annonce) return 0;
    const loyer = Number(this.annonce.loyer) || 0;
    const charges = Number(this.annonce.charges) || 0;
    const nbColocs = Math.max(1, this.membresAcceptes.length);
    return Math.round((loyer + charges) / nbColocs);
  }

  async ngOnInit(): Promise<void> {
    await this.authService.attendreAuth();

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.annonceId = id;
        this.chargerEspace(id);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.unsubscribeChat) {
      this.unsubscribeChat();
    }
  }

  // Charge l'ensemble des données de l'espace de colocation et vérifie les autorisations d'accès
  async chargerEspace(annonceId: string): Promise<void> {
    this.chargement = true;
    this.erreur = null;
    this.accesRefuse = false;

    try {
      const [espace, annonce] = await Promise.all([
        this.espaceService.getEspace(annonceId),
        this.annonceService.getById(annonceId)
      ]);

      if (!espace || !annonce) {
        this.erreur = "Cet espace de colocation n'existe pas ou le logement a été supprimé.";
        return;
      }

      this.espace = espace;
      this.annonce = annonce;

      // Récupération du profil du propriétaire pour afficher son téléphone (espace sécurisé)
      if (espace.proprietaireId) {
        this.proprietaire = await this.userService.getUser(espace.proprietaireId).catch(() => null);
      }

      // Récupération de la liste des membres
      await this.rafraichirMembres();

      // Contrôle strict des permissions : Propriétaire OU Membre accepté OU invité
      const user = this.authService.currentUser;
      if (!user) {
        this.accesRefuse = true;
        return;
      }

      const estProprio = user.uid === espace.proprietaireId;
      const estMembre = this.membresDetails.some(
        m => m.membre.etudiantId === user.uid && m.membre.statutAdhesion === 'accepte'
      );
      const estInvite = this.membresDetails.some(
        m => m.membre.etudiantId === user.uid && m.membre.statutAdhesion === 'invite'
      );
      const estRemplacant = this.membresDetails.some(
        m => m.membre.etudiantId === user.uid && m.membre.statutAdhesion === 'remplacement'
      );

      if (!estProprio && !estMembre && !estInvite && !estRemplacant && user.role !== 'admin') {
        this.accesRefuse = true;
        return;
      }

      // Initialisation du salon de discussion uniquement pour les membres acceptés, propriétaire ou admin
      if (estProprio || estMembre || user.role === 'admin') {
        this.initialiserChat(annonceId);
      }
    } catch {
      this.erreur = "Erreur lors du chargement de l'espace de colocation.";
    } finally {
      this.chargement = false;
    }
  }

  // Rafraîchit les informations détaillées des membres
  async rafraichirMembres(): Promise<void> {
    const membresBruts = await this.espaceService.getMembres(this.annonceId);
    const promesses = membresBruts.map(async (m): Promise<MembreDetailItem> => {
      const user = await this.userService.getUser(m.etudiantId).catch(() => null);
      return { membre: m, user };
    });
    this.membresDetails = await Promise.all(promesses);
  }

  // Démarre l'écouteur en temps réel du salon de discussion
  initialiserChat(annonceId: string): void {
    if (this.unsubscribeChat) {
      this.unsubscribeChat();
    }

    this.unsubscribeChat = this.espaceService.listenMessages(annonceId, (msgs) => {
      this.messages = msgs;
    });
  }

  // Envoi d'un message dans le chat
  async envoyerMessage(): Promise<void> {
    const contenu = this.nouveauMessage.trim();
    if (!contenu) return;

    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    try {
      this.nouveauMessage = '';
      await this.espaceService.sendMessage(
        this.annonceId,
        user.uid,
        user.nom || 'Colocataire',
        contenu
      );
    } catch {
      this.toastService.erreur("Impossible d'envoyer le message.");
    }
  }

  // 1. Bascule de visibilité Privé / Public (par le premier locataire)
  async basculerVisibilite(nouvelleVisibilite: 'prive' | 'public'): Promise<void> {
    if (!this.estPremierLocataire || !this.espace) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.changeVisibilite(this.annonceId, nouvelleVisibilite);
      this.espace.visibilite = nouvelleVisibilite;
      this.toastService.succes(
        nouvelleVisibilite === 'public'
          ? "L'espace est désormais public : les étudiants vérifiés peuvent postuler depuis l'annonce."
          : "L'espace est désormais privé : les ajouts se font par invitation email."
      );
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du changement de visibilité.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 2. Inviter un étudiant vérifié par email (par le premier locataire en mode privé)
  async inviterEtudiant(): Promise<void> {
    const email = this.emailInvitation.trim();
    if (!email) return;

    this.invitationEnCours = true;
    try {
      await this.espaceService.inviteStudent(this.annonceId, email);
      this.toastService.succes(`Invitation transmise avec succès à ${email} !`);
      this.emailInvitation = '';
      await this.rafraichirMembres();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible d'inviter cet étudiant.");
    } finally {
      this.invitationEnCours = false;
    }
  }

  // 3. Répondre à une demande ou invitation (Accepter / Refuser)
  async repondreMembre(item: MembreDetailItem, decision: 'accepte' | 'refuse'): Promise<void> {
    this.actionEnCours = true;
    try {
      await this.espaceService.answerMembre(this.annonceId, item.membre.etudiantId, decision);
      this.toastService.succes(
        decision === 'accepte' ? "Colocataire accepté !" : "Demande refusée."
      );
      await this.rafraichirMembres();

      // Recharger l'espace pour vérifier si le statut est passé à 'complet'
      const esp = await this.espaceService.getEspace(this.annonceId);
      if (esp) this.espace = esp;
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du traitement de la demande.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 4. Ajouter une règle de maison
  async ajouterRegle(): Promise<void> {
    const regle = this.nouvelleRegle.trim();
    if (!regle || !this.espace) return;

    const nouvellesRegles = [...(this.espace.reglesMaison || []), regle];
    try {
      await this.espaceService.updateRegles(this.annonceId, nouvellesRegles);
      this.espace.reglesMaison = nouvellesRegles;
      this.nouvelleRegle = '';
      this.toastService.succes("Règle de vie ajoutée.");
    } catch {
      this.toastService.erreur("Impossible de mettre à jour les règles.");
    }
  }

  // 5. Supprimer une règle de maison
  async supprimerRegle(index: number): Promise<void> {
    if (!this.espace || !this.espace.reglesMaison) return;

    const nouvellesRegles = this.espace.reglesMaison.filter((_, i) => i !== index);
    try {
      await this.espaceService.updateRegles(this.annonceId, nouvellesRegles);
      this.espace.reglesMaison = nouvellesRegles;
      this.toastService.info("Règle supprimée.");
    } catch {
      this.toastService.erreur("Impossible de supprimer la règle.");
    }
  }

  // 6. Procédure pour quitter la colocation
  demanderQuitter(): void {
    if (!this.estConfirme) {
      // Colocation non confirmée : n'importe quel colocataire peut quitter directement
      this.dialogQuitterOuvert = true;
    } else {
      // Colocation confirmée :
      // Si aucune demande formulée : ouvrir le formulaire de demande de départ au 1er locataire
      // Si demande déjà acceptée : ouvrir le dialogue pour inviter un remplaçant
      if (!this.aDemandeDepart) {
        this.motifDemandeDepart = '';
        this.dialogDemandeDepartOuvert = true;
      } else if (this.statutDepart === 'accepte') {
        this.emailRemplacant = '';
        this.dialogInviterRemplacantOuvert = true;
      }
    }
  }

  annulerQuitter(): void {
    this.dialogQuitterOuvert = false;
  }

  async confirmerQuitter(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.leave(this.annonceId, user.uid);
      this.toastService.succes("Vous avez quitté cet espace de colocation.");
      this.dialogQuitterOuvert = false;
      this.router.navigate(['/annonces']);
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible de quitter l'espace.");
      this.dialogQuitterOuvert = false;
    } finally {
      this.actionEnCours = false;
    }
  }

  // --- Étape 1 : Demande de départ auprès du premier locataire ---
  fermerDialogDemandeDepart(): void {
    this.dialogDemandeDepartOuvert = false;
    this.motifDemandeDepart = '';
  }

  async confirmerDemandeDepart(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.demandeDepartEnCours = true;
    try {
      await this.espaceService.demanderDepart(this.annonceId, user.uid, this.motifDemandeDepart);
      this.toastService.succes("Votre demande de départ a été transmise au premier locataire.");
      this.fermerDialogDemandeDepart();
      await this.rafraichirMembres();
      const esp = await this.espaceService.getEspace(this.annonceId);
      if (esp) this.espace = esp;
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible de soumettre la demande de départ.");
    } finally {
      this.demandeDepartEnCours = false;
    }
  }

  // --- Étape 2 : Le premier locataire accepte ou refuse la demande de départ ---
  async repondreDemandeDepart(item: MembreDetailItem, decision: 'accepte' | 'refuse'): Promise<void> {
    this.actionEnCours = true;
    try {
      await this.espaceService.repondreDemandeDepart(this.annonceId, item.membre.etudiantId, decision);
      this.toastService.succes(
        decision === 'accepte'
          ? "Demande de départ approuvée. Le colocataire est désormais autorisé à inviter un remplaçant."
          : "Demande de départ refusée."
      );
      await this.rafraichirMembres();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du traitement de la demande de départ.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // --- Étape 3 : Le membre invite un remplaçant ---
  ouvrirDialogInviterRemplacant(): void {
    this.emailRemplacant = '';
    this.dialogInviterRemplacantOuvert = true;
  }

  fermerDialogInviterRemplacant(): void {
    this.dialogInviterRemplacantOuvert = false;
    this.emailRemplacant = '';
  }

  async confirmerInviterRemplacant(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;
    const email = this.emailRemplacant.trim();
    if (!email) {
      this.toastService.avertissement("Veuillez renseigner l'adresse email du remplaçant.");
      return;
    }

    this.invitationRemplacantEnCours = true;
    try {
      await this.espaceService.inviterRemplacant(this.annonceId, user.uid, email);
      this.toastService.succes("Proposition transmise au remplaçant avec tous les détails du logement ! En attente de sa réponse.");
      this.fermerDialogInviterRemplacant();
      await this.rafraichirMembres();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible d'inviter ce remplaçant.");
    } finally {
      this.invitationRemplacantEnCours = false;
    }
  }

  async annulerRemplacant(candidateId: string): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.annulerInvitationRemplacant(this.annonceId, user.uid, candidateId);
      this.toastService.succes("Invitation de remplacement annulée.");
      await this.rafraichirMembres();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de l'annulation.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // --- Étape 4 : Le remplaçant consulte tous les détails et accepte ou refuse ---
  demanderAccepterProposition(): void {
    this.dialogAccepterPropositionOuvert = true;
  }

  annulerAccepterProposition(): void {
    this.dialogAccepterPropositionOuvert = false;
  }

  async confirmerAccepterProposition(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.repondrePropositionRemplacement(this.annonceId, user.uid, 'accepte');
      this.toastService.succes("Félicitations ! Vous avez accepté la proposition et intégrez la colocation.");
      this.dialogAccepterPropositionOuvert = false;
      await this.rafraichirMembres();
      const esp = await this.espaceService.getEspace(this.annonceId);
      if (esp) this.espace = esp;
      this.initialiserChat(this.annonceId);
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de l'acceptation de la proposition.");
    } finally {
      this.actionEnCours = false;
    }
  }

  demanderRefuserProposition(): void {
    this.dialogRefuserPropositionOuvert = true;
  }

  annulerRefuserProposition(): void {
    this.dialogRefuserPropositionOuvert = false;
  }

  async confirmerRefuserProposition(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.repondrePropositionRemplacement(this.annonceId, user.uid, 'refuse');
      this.toastService.succes("Vous avez décliné la proposition de remplacement.");
      this.dialogRefuserPropositionOuvert = false;
      this.router.navigate(['/annonces']);
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors du refus de la proposition.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 7. Fermer l'espace de colocation par le propriétaire
  demanderFermerEspace(): void {
    this.dialogFermerOuvert = true;
  }

  annulerFermerEspace(): void {
    this.dialogFermerOuvert = false;
  }

  async confirmerFermerEspace(): Promise<void> {
    if (!this.estProprietaire) return;

    this.actionEnCours = true;
    try {
      await this.espaceService.fermerEspace(this.annonceId);
      if (this.espace) {
        this.espace.statut = 'ferme';
      }
      this.toastService.succes("L'espace de colocation a été fermé avec succès.");
      this.dialogFermerOuvert = false;
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Erreur lors de la fermeture de l'espace.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 8. Confirmation de la colocation par un membre colocataire
  demanderConfirmerColocation(): void {
    this.dialogConfirmerColocOuvert = true;
  }

  annulerConfirmerColocation(): void {
    this.dialogConfirmerColocOuvert = false;
  }

  async validerConfirmationColocation(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || !user.uid) return;

    this.actionEnCours = true;
    try {
      const res = await this.espaceService.confirmMembre(this.annonceId, user.uid);
      if (res.espaceConfirme) {
        if (this.espace) {
          this.espace.statut = 'confirme';
          this.espace.dateConfirmation = new Date().toISOString();
          this.espace.dateFinLocation = res.dateFinLocation;
        }
        this.toastService.succes(
          "Félicitations ! L'ensemble des colocataires et le propriétaire ont confirmé. La colocation est officiellement validée !"
        );
      } else {
        this.toastService.succes("Votre confirmation d'engagement a bien été enregistrée. En attente des autres parties.");
      }

      await this.rafraichirMembres();
      this.dialogConfirmerColocOuvert = false;
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible de confirmer votre engagement.");
    } finally {
      this.actionEnCours = false;
    }
  }

  // 9. Confirmation de la colocation par le propriétaire bailleur
  async validerConfirmationBailleur(): Promise<void> {
    if (!this.estProprietaire) return;

    this.actionEnCours = true;
    try {
      const res = await this.espaceService.confirmBailleur(this.annonceId);
      if (res.espaceConfirme) {
        if (this.espace) {
          this.espace.statut = 'confirme';
          this.espace.confirmationProprietaire = true;
          this.espace.dateConfirmation = new Date().toISOString();
          this.espace.dateFinLocation = res.dateFinLocation;
        }
        this.toastService.succes(
          "Félicitations ! Vous avez confirmé la colocation et tous les colocataires ont validé. Le bail est scellé !"
        );
      } else {
        if (this.espace) {
          this.espace.confirmationProprietaire = true;
        }
        this.toastService.succes("Votre confirmation en tant que bailleur a bien été prise en compte.");
      }

      await this.rafraichirMembres();
    } catch (err: any) {
      this.toastService.erreur(err?.message || "Impossible de confirmer la colocation.");
    } finally {
      this.actionEnCours = false;
    }
  }
}
