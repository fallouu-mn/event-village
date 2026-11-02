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
    // Scanner du contrôleur (écran du lot 4 touché par le lot 5 ; run 50). CombatFlashOverlay reste hors liste :
    // ses couleurs de haute visibilité et son plein écran sont imposés par tests/scanner-combat-ui.test.ts.
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
];
