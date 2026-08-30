'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  Shield,
  Briefcase,
  Wallet,
  LogOut,
  ChevronRight,
  Phone,
  Mail,
  Sun,
  Moon,
  Sparkles,
  LogIn,
  QrCode,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const { user, profile, partner, isLoading, isAuthenticated, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <Skeleton className="h-10 w-48 rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <div className="max-w-md mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center">
          <User size={40} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Connexion Requise
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Connectez-vous pour consulter vos informations personnelles, vos billets et vos réservations.
          </p>
        </div>
        <Link href="/login" className="w-full">
          <Button variant="primary" size="lg" fullWidth leftIcon={<LogIn size={18} />}>
            Se connecter ou Créer un compte
          </Button>
        </Link>
      </div>
    );
  }

  const initials = `${profile.first_name?.[0] || 'U'}${profile.last_name?.[0] || 'E'}`.toUpperCase();
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const isAmbassador = profile.referral_status === 'AMBASSADEUR';
  const isPartner = profile.role === 'PARTENAIRE';
  const isAdmin = profile.role === 'ADMIN' || profile.role === 'SUPERADMIN';
  const isController = profile.role === 'CONTROLEUR' || isAdmin;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* 1. Header */}
      <div className="border-b border-slate-200 dark:border-zinc-800 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <User className="text-[#FF5722]" size={28} />
          <span>Mon Profil & Paramètres</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Gérez vos coordonnées, préférences d’affichage et accès aux espaces pro.
        </p>
      </div>

      {/* 2. Carte d'Identité Utilisateur */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
        <div className="w-20 h-20 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] font-black text-2xl flex items-center justify-center border-2 border-orange-200 dark:border-orange-900/50 shadow-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{fullName}</h2>
            {isAmbassador && (
              <Badge variant="brand" size="sm">
                ⭐ AMBASSADEUR EVENT VILLAGE
              </Badge>
            )}
            {isPartner && (
              <Badge variant="warning" size="sm">
                💼 {partner?.status === 'VALIDE' ? 'PARTENAIRE VALIDÉ' : 'PARTENAIRE EN ATTENTE'}
              </Badge>
            )}
            {isAdmin && (
              <Badge variant="success" size="sm">
                🛡️ {profile.role}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <Phone size={12} className="text-[#FF5722]" />
              <span>{profile.phone || 'Non renseigné'}</span>
            </span>
            {profile.email && (
              <>
                <span className="mx-0.5">•</span>
                <span className="flex items-center gap-1">
                  <Mail size={12} className="text-[#FF5722]" />
                  <span>{profile.email}</span>
                </span>
              </>
            )}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 pt-0.5">
            Rôle : <strong className="text-slate-700 dark:text-zinc-300">{profile.role}</strong> • Statut : <span className="text-emerald-600 font-bold">{profile.status}</span>
          </p>
        </div>
      </div>

      {/* 3. Préférences de Thème Visuel (Light / Dark / Système) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
          Thème Visuel de l’Application
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
              theme === 'light'
                ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-xs'
                : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            <Sun size={18} />
            <span>Mode Clair</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
              theme === 'dark'
                ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-xs'
                : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            <Moon size={18} />
            <span>Mode Sombre</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
              theme === 'system'
                ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-xs'
                : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            <Sparkles size={18} />
            <span>Système</span>
          </button>
        </div>
      </div>

      {/* 4. Raccourcis Navigation & Espaces */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white px-1">
          Espaces & Services
        </h3>

        <Link
          href="/wallet"
          className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF5722]/40 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-[#FF5722] transition-colors">
                Portefeuille & Commissions de Parrainage
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Consulter vos gains et demander un retrait Wave / OM
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-[#FF5722] transition-colors" />
        </Link>

        {(isPartner || isAdmin) && (
          <Link
            href="/partner/dashboard"
            className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF5722]/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-[#FF5722] transition-colors">
                  Espace Partenaire / Organisateur (B2B)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Dashboard KPIs, Realtime, Planning & Gestion des offres
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-[#FF5722] transition-colors" />
          </Link>
        )}

        {isController && (
          <Link
            href="/partner/scan"
            className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF5722]/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                <QrCode size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-[#FF5722] transition-colors">
                  Scanner de Billets & Contrôle d&apos;Accès
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Contrôle sécurisé des QR Codes aux entrées d&apos;événements
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-[#FF5722] transition-colors" />
          </Link>
        )}

        {isAdmin && (
          <Link
            href="/admin/dashboard"
            className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF5722]/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-[#FF5722] transition-colors">
                  Supervision Superadmin
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Gestion des Ambassadeurs, validation partenaires et audit log
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-[#FF5722] transition-colors" />
          </Link>
        )}
      </div>

      {/* 5. Déconnexion Réelle */}
      <div className="pt-2">
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={handleSignOut}
          leftIcon={<LogOut size={16} />}
          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/40"
        >
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
