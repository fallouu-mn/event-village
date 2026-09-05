'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogOut, ArrowLeft } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useAuth } from '@/components/providers/AuthProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export default function ControllerLayout({ children }: { children: React.ReactNode }) {
    const { profile } = useAuth();
    const router = useRouter();
    const [showLogout, setShowLogout] = useState(false);

    const handleLogout = async () => {
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
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
            <header className="h-14 flex items-center justify-between px-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-slate-200 dark:border-zinc-800 shadow-2xs min-h-[38px]"
                        title="Retourner à l'accueil"
                        aria-label="Retourner à l'accueil"
                    >
                        <ArrowLeft size={15} />
                        <span>Retour</span>
                    </Link>
                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-zinc-800" />
                    <Link href="/" className="flex items-center gap-1">
                        <span className="text-xs font-black tracking-wider text-[#FF5722] uppercase">
                            Event Village
                        </span>
                    </Link>
                </div>

                <div className="flex items-center gap-3">
                    <NotificationBell />
                    {displayName && (
                        <Link
                            href="/controller/profile"
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-[#FF5722] transition-colors"
                        >
                            <div className="w-6 h-6 rounded-lg bg-[#FF5722]/10 border border-[#FF5722]/20 flex items-center justify-center">
                                <User size={12} className="text-[#FF5722]" />
                            </div>
                            <span className="hidden sm:inline truncate max-w-[120px]">{displayName}</span>
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowLogout(true)}
                        className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center justify-center"
                        title="Se déconnecter"
                        aria-label="Se déconnecter"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
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
