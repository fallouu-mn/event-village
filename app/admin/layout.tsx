import { AdminStepUpGate } from '@/components/admin/AdminStepUpGate';

/**
 * Lot 9 quinquies (A3 : AUTH-05 ; A4 : AUTH-04) — toute page /admin passe par la fenêtre de sécurité de
 * l'administration : code SMS sur un nouvel appareil et après 12 h, mot de passe redemandé après 30 min sans activité.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AdminStepUpGate>{children}</AdminStepUpGate>;
}
