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
    // 8.1 : page de développement du faux SamirPay (E5), hors du build de production
    'app/dev/paiements/page.dev.tsx',
    'app/dev/paiements/[id]/page.dev.tsx',
    'components/dev/FakePaymentPanel.tsx',
    // Fichier existant migré par le lot : rouge jusqu'à sa migration (fix(8.2r)). Retrait de PRE_LOT5_UI_FILES : W7.
    'components/partner/ClosingReportModal.tsx',
];
