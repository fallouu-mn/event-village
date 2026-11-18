'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Finition 3d (point 1) — sur les pages partenaire et contrôleur, la fenêtre de sécurité de l'administration n'agit que
 * pour un compte ADMIN ou SUPERADMIN : le serveur y applique la même règle (code de l'appareil, mot de passe de moins de
 * 12 h, 30 minutes sans activité). Elle est chargée à la demande (aucun octet de plus pour une organisatrice ou un
 * contrôleur : budget du scanner tenu) et posée à côté de la page, qui n'est jamais remontée. Une organisatrice ou un
 * contrôleur qui n'est pas admin ne voit rien de plus, et ses appels ne sont pas modifiés.
 */
const AdminStepUpOverlay = dynamic(
    () => import('@/components/admin/AdminStepUpGate').then((m) => m.AdminStepUpOverlay),
    { ssr: false },
);

export function AdminAccountStepUp({ children }: { children: React.ReactNode }) {
    const { hasAnyRole, isLoading } = useAuth();
    const isAdmin = !isLoading && hasAnyRole(['ADMIN', 'SUPERADMIN']);
    return (
        <>
            {children}
            {isAdmin ? <AdminStepUpOverlay /> : null}
        </>
    );
}
