'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatTime } from '@/lib/format';
import { NotificationBell } from '@/components/notifications/NotificationBell';

/**
 * En-tête de l'espace contrôleur (relecture des captures du run 50) : tokens du système de design, cibles
 * de 44 px, logo partagé (l'ancien texte #FF5722 en 12 px donnait 3,16:1), lien du profil nommé même
 * sous 640 px (axe link-name : seule l'icône restait visible), tient à 390 px.
 * Lot 7 (D45) : thème sombre forcé sur tout l'espace contrôleur (classe `dark` et color-scheme sombre sur la
 * racine, sans bascule) : écran lisible de nuit, batterie ménagée. Sur l'écran de scan, la déconnexion est
 * portée par l'en-tête compact du scanner (un seul bouton de déconnexion par écran).
 */
export default function ControllerLayout({ children }: { children: React.ReactNode }) {
    const { profile, signOut } = useAuth();
    const pathname = usePathname();
    const onScanner = pathname?.startsWith('/controller/scanner') ?? false;
    const [showLogout, setShowLogout] = useState(false);
    // Finition 1 (complément 11) : le scanner n'apparaît que si la personne a au moins un événement dont le contrôle est
    // ouvert ou ouvre dans les 24 h (GET /api/controller/status) ; sinon, un message et l'espace client. Pendant la
    // lecture, l'écran reste celui du scanner (qui refuse lui-même hors de la plage du contrôle).
    const roles = profile?.roles ?? [];
    const controllerOnly = roles.includes('CONTROLEUR') && !roles.includes('PARTENAIRE') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN');
    const [scanner, setScanner] = useState<{ open: boolean; next: string | null } | null>(null);
    useEffect(() => {
        if (!onScanner || !controllerOnly) return;
        let cancelled = false;
        fetch('/api/controller/status', { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = (await res.json()) as { scanner?: boolean; next_opens_at?: string | null };
                if (!cancelled) setScanner({ open: body.scanner === true, next: body.next_opens_at ?? null });
            })
            .catch((err: unknown) => {
                console.warn('[controller] état du scanner illisible :', err instanceof Error ? err.message : String(err));
            });
        return () => { cancelled = true; };
    }, [onScanner, controllerOnly]);
    const scannerClosed = onScanner && controllerOnly && scanner !== null && !scanner.open;

    // Sécurité (déconnexion sans réseau) : la déconnexion de toute l'application (useAuth().signOut) : mémoire du contrôle
    // (lot 7, A10), notifications de l'appareil (lot 6, F4) et session effacées tout de suite, avec ou sans réseau ; cet
    // appareil seulement (lot 9 quinquies, B4) ; révocation côté serveur refaite au retour du réseau.
    const handleLogout = () => signOut();

    const displayName = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Contrôleur'
        : '';

    return (
        <div className="dark min-h-screen bg-background text-foreground-strong" style={{ colorScheme: 'dark' }}>
            <header className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-card px-4 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                    {/* Design 1b : pas de préchargement de l'accueil depuis le scanner (JavaScript avant l'affichage utile du scanner) */}
                    <Link
                        href="/"
                        prefetch={false}
                        title="Basculer vers l’espace client (billetterie, réservations, commandes)"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground-strong transition-colors hover:bg-background hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-1.5 text-sm font-semibold text-foreground-strong transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-primary-soft text-primary-text" aria-hidden="true">
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
                {scannerClosed ? (
                    <EmptyState
                        title="Aucun contrôle ouvert pour vous"
                        description={scanner?.next
                            ? `Votre prochain contrôle ouvre le ${formatDate(scanner.next)} à ${formatTime(scanner.next)}. Le scanner apparaîtra 24 h avant.`
                            : 'Le scanner apparaît quand un organisateur vous confie un événement, 24 h avant l’ouverture du contrôle.'}
                        actionLabel="Mes billets"
                        actionHref="/tickets"
                    />
                ) : children}
            </main>

            <ConfirmDialog
                isOpen={showLogout}
                onClose={() => setShowLogout(false)}
                onConfirm={handleLogout}
                title="Se déconnecter ?"
                message="Vous serez déconnecté de cet appareil seulement. Vous devrez vous reconnecter pour accéder au scanner."
                confirmLabel="Déconnexion"
                variant="danger"
            />
        </div>
    );
}
