import type { ReactNode } from 'react';
import { AdminAccountStepUp } from '@/components/admin/AdminAccountStepUp';

/**
 * Finition 3d (point 1) — profil de l'espace contrôleur : pour un compte admin, la fenêtre de sécurité de
 * l'administration (même règle des 30 minutes côté serveur). Mise en page imbriquée : l'en-tête et la déconnexion de
 * l'espace contrôleur (app/controller/layout.tsx) ne changent pas.
 */
export default function ControllerProfileLayout({ children }: { children: ReactNode }) {
    return <AdminAccountStepUp>{children}</AdminAccountStepUp>;
}
