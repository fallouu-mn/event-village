/**
 * Lot 5 — liste blanche des fichiers migrés sur le système de design (contrat, section Q).
 *
 * tests/parcours/design-systeme.test.ts applique à chaque fichier listé ici les règles du contrat Q :
 * aucune couleur codée en dur (#hex, slate-, zinc-, gray-, palette brute), aucun text-[9-13px], text-xs
 * réservé aux badges, horodatages secondaires et légendes, aucun « § », aucun emoji, aucun enum en dur
 * dans le JSX, aucun <Link><Button> imbriqué.
 *
 * Vide au départ : chaque correctif d'interface du lot 5 y ajoute, dans le même commit, les fichiers
 * qu'il crée ou qu'il touche. Chemins relatifs à la racine du dépôt, séparateur « / »
 * (par exemple 'components/ui/Modal.tsx').
 */
export const MIGRATED_DESIGN_FILES: string[] = [
    // Composants partagés (fondations du système de design, contrat Q)
    'components/ui/Badge.tsx',
    'components/ui/Button.tsx',
    'components/ui/ConfirmDialog.tsx',
    'components/ui/DataList.tsx',
    'components/ui/EmptyState.tsx',
    'components/ui/Field.tsx',
    'components/ui/IconButton.tsx',
    'components/ui/KpiCard.tsx',
    'components/ui/LinkButton.tsx',
    'components/ui/IntentLink.tsx',
    'components/ui/LiveIndicator.tsx',
    'components/ui/Modal.tsx',
    'components/ui/PageHeader.tsx',
    'components/ui/Pagination.tsx',
    'components/ui/ReasonDialog.tsx',
    'components/ui/StatusBadge.tsx',
    'components/ui/StatusBanner.tsx',
    'components/ui/Tabs.tsx',
    // Administration (tâches 5.7, 5.8 côté admin, 5.13 côté admin ; contrats G, J, O5)
    'app/admin/events/page.tsx',
    'app/admin/events/[id]/page.tsx',
    'app/admin/dashboard/page.tsx',
    'app/admin/services/page.tsx',
    'components/layout/AppLayout.tsx',
    // Relecture des captures du run 49 : logo de l'en-tête mobile (identifiant SVG unique, tokens)
    'components/ui/Logo.tsx',
    // Relecture des captures du run 50 : en-têtes (cibles de 44 px, nom accessible), messages, carte publique
    'components/ui/ThemeToggle.tsx',
    'components/notifications/NotificationBell.tsx',
    'components/ui/Toast.tsx',
    'components/ui/ToastCard.tsx',
    'components/ui/EventMap.tsx',
    'app/controller/layout.tsx',
    'app/partner/layout.tsx',
    // Formulaire d'événement (tâches 5.5, 5.6, 5.9 ; contrat F6)
    'components/events/EventForm.tsx',
    'components/events/EventTicketing.tsx',
    'components/ui/ImageUpload.tsx',
    'components/ui/MapPicker.tsx',
    'app/partner/events/new/page.tsx',
    'app/partner/events/[id]/edit/page.tsx',
    // Public et client (tâches 5.3 et 5.13 ; contrats E, O5)
    'app/events/[id]/page.tsx',
    'app/explore/page.tsx',
    'app/page.tsx',
    'app/tickets/page.tsx',
    'app/tickets/TicketsView.tsx',
    'components/tickets/TicketThumb.tsx',
    'components/events/EventCard.tsx',
    'components/events/FeaturedEventCard.tsx',
    // Client : carte billet et notifications (libellés humains, contrat Q ; run 49)
    'components/tickets/TicketCard.tsx',
    'app/notifications/page.tsx',
    // Partenaire : liste, pilotage, annulation (tâches 5.8, 5.10, 5.11 ; contrats H, I, J)
    'app/partner/events/page.tsx',
    'app/partner/events/[id]/page.tsx',
    'app/partner/events/[id]/team/page.tsx',
    'app/partner/events/[id]/caisse/page.tsx',
    'components/events/EventCancelDialog.tsx',
    'components/events/RefundProgress.tsx',
    'components/partner/events-list/PartnerEventCard.tsx',
    'components/partner/pilotage/PilotageBlocks.tsx',
    'components/partner/pilotage/OverviewTab.tsx',
    'components/partner/pilotage/SalesTab.tsx',
    'components/partner/pilotage/EntriesTab.tsx',
    'components/partner/pilotage/TeamTab.tsx',
    'components/partner/pilotage/CashTab.tsx',
    'components/partner/pilotage/ClosingTab.tsx',
    // Relecture des captures du run 50 : onglets défilants du pilotage (indice de défilement, onglet actif centré)
    // Scanner du contrôleur (écran du lot 4 touché par le lot 5 ; run 50). CombatFlashOverlay est migré au lot 7
    // (jetons --scan-*, D51) : il figure dans la section du lot 7 ci-dessous.
    'app/controller/scanner/page.tsx',
    'components/scan/ScannerShiftBanner.tsx',
    'components/scan/ScanResultPanel.tsx',
    'components/scan/ManualEntryForm.tsx',
    'components/scan/CameraQrScanner.tsx',
    // ── Lot 6 (contrat Q) ──
    // 6.0 e : connexion (composant serveur + formulaire client), inscription, mot de passe oublié,
    // réinitialisation, et leurs composants partagés (contrat A5)
    'app/login/page.tsx',
    'components/auth/LoginForm.tsx',
    'app/register/page.tsx',
    'app/forgot-password/page.tsx',
    'app/reset-password/page.tsx',
    'components/auth/OtpInput.tsx',
    'components/auth/PasswordStrengthChecklist.tsx',
    // 6.0 g : onglets défilants partagés, squelettes de chargement sur les tokens (contrat A7)
    'components/ui/ScrollableTabs.tsx',
    'components/ui/Skeleton.tsx',
    'app/events/[id]/loading.tsx',
    'app/orders/loading.tsx',
    'app/partner/dashboard/loading.tsx',
    'app/profile/loading.tsx',
    'app/wallet/loading.tsx',
    'app/explore/loading.tsx',
    'app/tickets/loading.tsx',
    // 6.2 : enregistrement du service worker (contrat F5)
    'components/pwa/ServiceWorkerRegister.tsx',
    // 6.4 : préférences de notification, bascule partagée, état du push sur cet appareil, profil (contrat H4)
    'components/ui/Switch.tsx',
    'components/notifications/PushDeviceCard.tsx',
    'app/profile/notifications/page.tsx',
    'app/profile/page.tsx',
    // 6.5 : réglages notif.* (contrat I1.6 ; Q le croyait déjà listé)
    'app/admin/finance-settings/page.tsx',
    // 6.7 : transferts reçus, vérification du numéro, transfert vers un numéro, ancienne page de réclamation (B5, amendement 2)
    'components/tickets/IncomingTransfers.tsx',
    'components/tickets/PhoneVerifyDialog.tsx',
    'components/tickets/TransferModal.tsx',
    'app/tickets/claim/[token]/page.tsx',
    // 6.8 : supervision admin (contrat L4)
    'app/admin/notifications/page.tsx',
    'app/admin/notifications/[id]/page.tsx',
    // ── Lot 7 (contrat, section 12 ; T0f) ──
    // Fichiers créés par le lot (aucun autre nouveau .tsx n'est permis). Absents tant que l'écran n'est pas
    // écrit : la suite design-systeme est rouge jusqu'aux commits d'écran (fix(7.1e), fix(7.2e), fix(7.3s),
    // fix(7.3e), fix(7.4)).
    // 7.1 : billet hors ligne (E2)
    'app/billet/hors-ligne/page.tsx',
    'components/tickets/offline/OfflineTicketView.tsx',
    'components/tickets/offline/OfflineStatusBadge.tsx',
    'components/tickets/OfflineTicketsSync.tsx',
    // 7.2 : scanner (E3)
    'components/scan/ScanStatusBar.tsx',
    'components/scan/ScanHistoryList.tsx',
    'components/scan/CounterSalePanel.tsx',
    'components/scan/ScannerStartScreen.tsx',
    // 7.3 : paiement (E4) et layouts de garde des interrupteurs features.* (A5)
    'components/payment/PendingPaymentBanner.tsx',
    'components/payment/PaymentWaitingInfo.tsx',
    'app/halls/layout.tsx',
    'app/restaurants/[id]/tables/layout.tsx',
    'app/restaurants/[id]/menu/layout.tsx',
    'app/orders/layout.tsx',
    'app/partner/halls/layout.tsx',
    'app/partner/tables/layout.tsx',
    'app/partner/orders/layout.tsx',
    'app/partner/products/layout.tsx',
    // 7.4 : première utilisation du partenaire (E5)
    'components/partner/onboarding/FirstEventSteps.tsx',
    // Fichiers existants migrés par le lot : rouges jusqu'à leur migration.
    // 7.0 f : restes d'interface du lot 6 (E1)
    'components/tickets/TransferExplainerModal.tsx',
    'app/partner/register/page.tsx',
    'app/controller/setup/page.tsx',
    'app/admin/communications/page.tsx',
    'app/partner/profile/page.tsx',
    'app/controller/profile/page.tsx',
    // 7.2 : scanner et caisse (E3)
    'components/scan/CombatFlashOverlay.tsx',
    'components/shifts/ShiftModals.tsx',
    // 7.3 : parcours client (E4)
    'components/payment/PaymentModal.tsx',
    'app/paiement/[id]/page.tsx',
    'app/wallet/page.tsx',
    'app/orders/page.tsx',
    'app/not-found.tsx',
    'app/error.tsx',
    // 7.4 : parcours partenaire (E5)
    'app/partner/dashboard/page.tsx',
    'app/partner/finance/page.tsx',
    'app/partner/team/page.tsx',
    'app/partner/subscription/page.tsx',
    // Hors liste, modifiés sans migration (vérifié : présents dans PRE_LOT5_UI_FILES de design-systeme.test.ts,
    // donc non concernés par le garde-fou des fichiers créés) : app/layout.tsx, app/partner/scan/page.tsx.
    // ── Lot 8 (contrat, section 16.3 ; T4) ──
    // Fichiers créés par le lot (aucun autre nouveau .tsx n'est permis). Absents tant que l'écran n'est pas
    // écrit : la suite design-systeme est rouge jusqu'aux commits d'écran (fix(8.2h), fix(8.2j-e), fix(8.3-A3e),
    // fix(8.3-A4e), fix(8.1e)).
    // 8.2 h : page d'un événement, garde serveur du 404 réel (S0)
    'app/events/[id]/layout.tsx',
    // 8.2 j : message d'accès refusé à l'accueil (E4)
    'components/layout/AccessNotice.tsx',
    // 8.3 A3 et A4 : remboursements à reprendre (E3), remboursement d'un billet au pilotage (E0)
    'components/admin/RefundsToRetry.tsx',
    'components/partner/pilotage/TicketRefundPanel.tsx',
    // Finition 3a (argent de l'administration) : page Finance, ses chiffres et leur détail, bloc « Argent qui attend »
    // de l'accueil (insérés ici, et non en fin de liste, pour ne pas chevaucher la finition 2a à la fusion)
    'app/admin/finance/page.tsx',
    'components/admin/finance/MoneyFigure.tsx',
    'components/admin/finance/PeriodPicker.tsx',
    'components/admin/finance/EarnedDetail.tsx',
    'components/admin/finance/OwedDetail.tsx',
    'components/admin/finance/DebtsList.tsx',
    'components/admin/finance/RefundsToPayList.tsx',
    'components/admin/finance/WithdrawableDetail.tsx',
    'components/admin/finance/MoneyWaiting.tsx',
    // Finition 3b : « À faire aujourd'hui » (E-29)
    'components/admin/TodoToday.tsx',
    // Finition 3b : « Mes droits » (E-34)
    'app/admin/mes-droits/page.tsx',
    // 8.1 : page de développement du faux SamirPay (E5), hors du build de production
    'app/dev/paiements/page.dev.tsx',
    'app/dev/paiements/[id]/page.dev.tsx',
    'components/dev/FakePaymentPanel.tsx',
    // Fichier existant migré par le lot : rouge jusqu'à sa migration (fix(8.2r)). Retrait de PRE_LOT5_UI_FILES : W7.
    'components/partner/ClosingReportModal.tsx',
    // ── Lot 9 (contrat, section 8 ; T4) ──
    // Fichiers créés par le lot. Absents tant que l'écran n'est pas écrit : la suite design-systeme est rouge
    // jusqu'aux commits d'écran (fix(9.0e), fix(9.1e), fix(9.2e)).
    // 9.0 : invitations au pilotage (E0)
    'components/partner/pilotage/InvitationsTab.tsx',
    // 9.1 : accueil, populaires et près de chez vous (E1)
    'components/events/HomeDiscovery.tsx',
    // 9.2 : profil, avatar, changement de numéro, Mes paiements (E2)
    'components/ui/Avatar.tsx',
    'components/profile/ProfileForm.tsx',
    'components/profile/PhoneChangeDialog.tsx',
    'components/profile/AvatarEditor.tsx',
    'app/profile/payments/page.tsx',
    'app/profile/payments/loading.tsx',
    // Finition 1 (complément 13) : Mes soirées du contrôleur
    'app/profile/soirees/page.tsx',
    'app/profile/soirees/loading.tsx',
    // ── Lot 9 bis (contrat, section 8.2 ; T3) ──
    // Fichiers créés par le lot (aucun autre nouveau .tsx n'est permis). Absents tant que l'écran n'est pas écrit :
    // la suite design-systeme est rouge jusqu'aux commits d'écran (fix(9b.48e), fix(9b.26e), fix(9b.13e),
    // fix(9b.42e), fix(9b.15e), fix(9b.4e)).
    // G (48) : page de validation du lien de vérification d'email (E-G)
    'app/verify-email/page.tsx',
    // C (26, R37) : invitations de contrôleur reçues, acceptées par le titulaire (E-C)
    'app/invitations/page.tsx',
    // B (13, R57) : saisie récente du mot de passe avant une action sensible (E-B)
    'components/auth/PasswordConfirmDialog.tsx',
    // E (42, R85) : « Changer mon mot de passe » une fois connecté (E-E)
    'components/profile/PasswordChangeDialog.tsx',
    // B (15, R6, R55) : « Suspendre » et « Réactiver » sur la fiche partenaire, motif obligatoire (E-B)
    'components/admin/PartnerStatusDialog.tsx',
    // A (4, R20) : « Espèces à rembourser par l'organisateur » (E-A)
    'components/partner/pilotage/CashRefundsList.tsx',
    // ── Lot 9 ter (contrat, section 8.3 ; K10) ──
    // Fichiers créés par le lot (aucun autre nouveau .tsx n'est permis sans amendement ; hooks/useUnsavedGuard.ts ne
    // rend aucun JSX : non déclaré). Absents tant que l'écran n'est pas écrit : la suite design-systeme est rouge
    // jusqu'aux commits d'écran (fix(9t.15e), fix(9t.17e), fix(9t.18e), fix(9t.12e)).
    // C (9t.15) : zones, portes et catégories admises, onglet Équipe du pilotage (E-C)
    'components/partner/zones/ZonesEditor.tsx',
    // C (9t.17) : liste des invités du scanner, chargée par import() (E-C)
    'components/scan/GuestListPanel.tsx',
    // D (9t.18) : entrées par zone, porte, catégorie et origine (onglet Entrées et rapport de clôture) (E-D)
    'components/partner/pilotage/EntriesBreakdown.tsx',
    // B (9t.12, R106 b) : rapport de clôture unique, partagé par l'onglet et la fenêtre (E-B)
    'components/partner/pilotage/ClosingReportSummary.tsx',
    // Lot 9 quinquies (A2, A3-A4, B1) : activation d'un compte créé par un admin, fenêtre de sécurité de l'administration,
    // page publique d'aide (ajout signalé au rapport)
    'app/activation/page.tsx',
    'app/admin/layout.tsx',
    'components/admin/AdminStepUpGate.tsx',
    // Finition 3d (point 1) : fenêtre de sécurité posée sur les pages partenaire et contrôleur d'un compte admin (chargée à
    // la demande), mises en page imbriquées du scanner et du profil de l'espace contrôleur (ajout signalé au rapport)
    'components/admin/AdminAccountStepUp.tsx',
    'app/controller/scanner/layout.tsx',
    'app/controller/profile/layout.tsx',
    // Finition 3d (point 4b) : choix de l'organisatrice dans la page Équipe d'un admin (liste avec recherche)
    'components/partner/team/OrganizerPicker.tsx',
    // Finition 3d (point 3) : fenêtre « mot de passe et code » des actions sensibles, « Changer le rôle »
    'components/admin/IdentityConfirm.tsx',
    'components/admin/RoleChangeDialog.tsx',
    // Finition 3d (point 2) : page « Sécurité du compte », codes de secours, changement du numéro d'un administrateur
    'app/admin/securite/page.tsx',
    'components/admin/BackupCodesPanel.tsx',
    'components/admin/PhoneChangeFlow.tsx',
    'app/aide/page.tsx',
    // Finition 1 (E-14) : composant commun de l'équipe, page /partner/team et onglet Équipe du pilotage
    'components/partner/team/TeamPanel.tsx',
    'components/partner/team/TeamDialogs.tsx',
    'components/partner/team/CategoryPills.tsx',
    // Finition 2a (2 et 3) : onglet « Infos » du pilotage (dates, fin retenue, lieu, petite carte, « Voir l’itinéraire »)
    'components/partner/pilotage/InfosTab.tsx',
    // Finition 2b (A, E-22) : couleur au contrôle en pastilles nommées (groupe radio), à la création et en modification
    'components/events/ScanColorPicker.tsx',
    // Finition 2b (B, E-23) : étape « Contrôle à l'entrée » (création, modification) et liste des zones partagée
    'components/events/ZoneListEditor.tsx',
    'components/events/EntryControlStep.tsx',
    'components/events/EntryControlEditor.tsx',
    // Finition 2b (C, E-24) : écran « Vérifier avant d'envoyer » (récapitulatif, manques)
    'components/events/EventReview.tsx',
    // Design 1a (point 6) : gabarit des pages spéciales et page hors ligne. app/global-error.tsx n'y est pas : il remplace le
    // layout racine (ni feuille globale ni jetons), ses couleurs de la charte sont donc écrites dans son propre <style>.
    'components/ui/SpecialPage.tsx',
    'app/hors-ligne/page.tsx',
    // Design 1a (point 7) : squelettes de l'accueil, de l'espace partenaire, du pilotage et de l'administration ; barre de progression
    'app/partner/loading.tsx',
    'app/partner/events/[id]/loading.tsx',
    'app/admin/loading.tsx',
    'components/ui/NavigationProgress.tsx',
    'components/ui/NavigationProgressDifferee.tsx',
    // Design 1a (point 5) : composants de base nouveaux et vitrine des captures
    'components/ui/Card.tsx',
    'components/ui/FilterChip.tsx',
    'components/ui/BottomSheet.tsx',
    'app/vitrine-design/Vitrine.tsx',
    'app/vitrine-design/page.tsx',
    // Design 1b : pages publiques (socle, catalogue, À la une)
    'components/events/LiveBadge.tsx',
    'app/explore/ExploreView.tsx',
    'app/_accueil/HomeLive.tsx',
    'app/_accueil/HomeNearby.tsx',
    'app/_accueil/LiveNow.tsx',
    'app/_accueil/sections.tsx',
    'components/events/CardLink.tsx',
    'components/events/CardLiveBadge.tsx',
    'app/admin/a-la-une/page.tsx',
    'app/admin/a-la-une/FeaturedDialogs.tsx',
    'components/event-page/EventTicketing.tsx',
    'components/event-page/LiveOnPoster.tsx',
    'components/event-page/PendingPaymentSlot.tsx',
    'components/event-page/ShareButton.tsx',
    'components/event-page/VenueMap.tsx',
    'components/tickets/TicketWallet.tsx',
    'components/tickets/QrFullscreen.tsx',
    'components/tickets/PurchaseCelebration.tsx',
    // Lot 10b : écrans des salles (client, salle, administration)
    'app/admin/halls/[id]/loading.tsx',
    'app/admin/halls/[id]/page.tsx',
    'app/admin/halls/loading.tsx',
    'app/admin/halls/page.tsx',
    'app/halls/[id]/loading.tsx',
    'app/halls/[id]/not-found.tsx',
    'app/halls/[id]/page.tsx',
    'app/halls/loading.tsx',
    'app/halls/page.tsx',
    'app/halls/reservations/[id]/loading.tsx',
    'app/halls/reservations/[id]/not-found.tsx',
    'app/halls/reservations/[id]/page.tsx',
    'app/halls/reservations/loading.tsx',
    'app/halls/reservations/page.tsx',
    'app/partner/halls/[id]/edit/loading.tsx',
    'app/partner/halls/[id]/edit/page.tsx',
    'app/partner/halls/[id]/loading.tsx',
    'app/partner/halls/[id]/page.tsx',
    'app/partner/halls/loading.tsx',
    'app/partner/halls/new/loading.tsx',
    'app/partner/halls/new/page.tsx',
    'app/partner/halls/page.tsx',
    'app/partner/halls/recettes/loading.tsx',
    'app/partner/halls/recettes/page.tsx',
    'app/partner/halls/reservations/page.tsx',
    'app/partner/halls/reservations/[id]/loading.tsx',
    'app/partner/halls/reservations/[id]/page.tsx',
    'components/halls/admin/HallDecision.tsx',
    'components/halls/admin/HallPhotoGallery.tsx',
    'components/halls/admin/HallSheetSkeleton.tsx',
    'components/halls/client/HallBookingPanel.tsx',
    'components/halls/client/HallCalendar.tsx',
    'components/halls/client/HallCard.tsx',
    'components/halls/client/HallGallery.tsx',
    'components/halls/client/HallLightbox.tsx',
    'components/halls/client/HallResults.tsx',
    'components/halls/client/HallSearch.tsx',
    'components/halls/client/ReservationDetailView.tsx',
    'components/halls/client/ReservationsView.tsx',
    'components/halls/client/RetryError.tsx',
    'components/halls/partner/EarningsView.tsx',
    'components/halls/partner/HallCalendar.tsx',
    'components/halls/partner/HallEditView.tsx',
    'components/halls/partner/HallForm.tsx',
    'components/halls/partner/HallSheetView.tsx',
    'components/halls/partner/HallSkeletons.tsx',
    'components/halls/partner/HallsListView.tsx',
    'components/halls/partner/ReservationDetailView.tsx',
    'components/halls/partner/useHallActions.tsx',
    // Design 1c : espace organisatrice, administration, scanner, paiement
    'components/payment/OperatorLogo.tsx',
    // Design 1c (administration) : comptes, journal, parrainage passés aux jetons de la charte
    'app/admin/users/page.tsx',
    'app/admin/audit/page.tsx',
    'app/admin/referral/page.tsx',
    // Design 1d : vitrine (cartes d'affiche, fiche immersive, comptes à rebours, favoris, recherche, pastilles)
    'components/event-page/Countdowns.tsx',
    'components/events/CardFavorites.tsx',
    'components/events/CategoryChipsBar.tsx',
    'components/events/FavoriteHeart.tsx',
    'components/tickets/AddToCalendar.tsx',
    'app/profile/favoris/page.tsx',
    'app/profile/favoris/loading.tsx',
    'components/search/SearchLauncher.tsx',
    'components/search/InstantSearch.tsx',
    'components/tickets/PullToRefresh.tsx',
    'components/events/CardFavoritesLazy.tsx',
    'components/event-page/EventCountdownLazy.tsx',
];
