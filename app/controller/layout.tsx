'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, LogOut, ArrowLeft } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useAuth } from '@/components/providers/AuthProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { detachPushSubscription } from '@/lib/push/client';

/**
 * En-tête de l'espace contrôleur (relecture des captures du run 50) : tokens du système de design, cibles
 * de 44 px, logo partagé (l'ancien texte #FF5722 en 12 px donnait 3,16:1), lien du profil nommé même
 * sous 640 px (axe link-name : seule l'icône restait visible), tient à 390 px.
 * Lot 7 (D45) : thème sombre forcé sur tout l'espace contrôleur (classe `dark` et color-scheme sombre sur la
 * racine, sans bascule) : écran lisible de nuit, batterie ménagée. Sur l'écran de scan, la déconnexion est
 * portée par l'en-tête compact du scanner (un seul bouton de déconnexion par écran).
 */
export default function ControllerLayout({ children }: { children: React.ReactNode }) {
    const { profile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const onScanner = pathname?.startsWith('/controller/scanner') ?? false;
    const [showLogout, setShowLogout] = useState(false);

    const handleLogout = async () => {
        // Lot 6 (contrat F4) : l'appareil est détaché du compte avant la déconnexion (ne lève jamais).
        await detachPushSubscription();
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        await supabase.auth.signOut({ scope: 'global' });
        router.push('/login');
    };

    const displayName = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Contrôleur'
        : '';

    return (
        <div className="dark min-h-screen bg-surface-sunken text-fg" style={{ colorScheme: 'dark' }}>
            <header className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-surface px-4 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                    <Link
                        href="/"
                        title="Basculer vers l’espace client (billetterie, réservations, commandes)"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-sunken hover:text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Mon espace client</span>
                    </Link>
                    <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
                    <Logo variant="auto" />
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
                    <NotificationBell />
                    {displayName && (
                        <Link
                            href="/controller/profile"
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-1.5 text-sm font-semibold text-fg transition-colors hover:text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-brand-bg text-brand-fg" aria-hidden="true">
                                <User size={16} />
                            </span>
                            <span className="sr-only sm:not-sr-only sm:max-w-[120px] sm:truncate">{displayName}</span>
                        </Link>
                    )}

                    {!onScanner && (
                        <IconButton aria-label="Se déconnecter" variant="danger" onClick={() => setShowLogout(true)}>
                            <LogOut size={18} />
                        </IconButton>
                    )}
                </div>
            </header>

            <main className={onScanner ? 'mx-auto max-w-2xl px-4 py-3' : 'mx-auto max-w-2xl px-4 py-6'}>
                {children}
            </main>

            <ConfirmDialog
                isOpen={showLogout}
                onClose={() => setShowLogout(false)}
                onConfirm={handleLogout}
                title="Se déconnecter ?"
                message="Vous serez déconnecté de tous vos appareils. Vous devrez vous reconnecter pour accéder au scanner."
                confirmLabel="Déconnexion"
                variant="danger"
            />
        </div>
    );
}
