import type { ReactNode } from 'react';
import { AdminAccountStepUp } from '@/components/admin/AdminAccountStepUp';

/**
 * Finition 3d (point 1) — scanner : pour un compte admin, la fenêtre de sécurité de l'administration (le serveur applique
 * aux routes contrôleur la même règle des 30 minutes que dans l'administration). Mise en page imbriquée : l'en-tête et la
 * déconnexion de l'espace contrôleur (app/controller/layout.tsx) ne changent pas.
 */
export default function ControllerScannerLayout({ children }: { children: ReactNode }) {
    return <AdminAccountStepUp>{children}</AdminAccountStepUp>;
}
