'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  Bell,
  Briefcase,
  ChevronRight,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Phone,
  QrCode,
  ReceiptText,
  Shield,
  Sparkles,
  Sun,
  User,
  Wallet,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';
import { AvatarEditor } from '@/components/profile/AvatarEditor';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { isDeliverableEmail } from '@/lib/notifications/channels';

/**
 * Profil et réglages du compte (lot 6, contrat H4 : migré sur le système de design pour recevoir le lien
 * vers les préférences de notification).
 *  - Aucun code brut à l'écran : rôles et statut du compte par leurs libellés français ; aucun emoji.
 *  - Thème : trois boutons à bascule (aria-pressed) de 44 px.
 *  - Raccourcis : liens pleine largeur de 44 px au moins (préférences de notification, portefeuille,
 *    espaces professionnels selon les rôles).
 *  - Déconnexion par useAuth().signOut, qui détache d'abord l'appareil des notifications push.
 */

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  PARTENAIRE: 'Partenaire',
  CONTROLEUR: 'Contrôleur',
  ADMIN: 'Administrateur',
  SUPERADMIN: 'Super-administrateur',
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIF: 'Compte actif',
  EN_ATTENTE: 'Compte en attente de validation',
  SUSPENDU: 'Compte suspendu',
};

/** « +221771234567 » s'affiche « +221 77 123 45 67 » ; une autre forme reste telle quelle. */
function displayPhone(phone: string): string {
  const parts = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return parts ? `+221 ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}` : phone;
}

const THEMES: Array<{ id: 'light' | 'dark' | 'system'; label: string; icon: React.ElementType }> = [
  { id: 'light', label: 'Clair', icon: Sun },
  { id: 'dark', label: 'Sombre', icon: Moon },
  { id: 'system', label: 'Système', icon: Sparkles },
];

interface Shortcut {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tone: Tone;
}

const SHORTCUT_CLASS =
  'group flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors duration-200 hover:border-brand-fg/40 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ShortcutBody({ title, description, icon: Icon, tone }: Omit<Shortcut, 'href'>) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[tone])} aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg group-hover:text-brand-fg">{title}</span>
          <span className="block text-sm text-fg-muted">{description}</span>
        </span>
      </span>
      <ChevronRight size={18} className="flex-shrink-0 text-fg-muted group-hover:text-brand-fg" aria-hidden="true" />
    </>
  );
}

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const { profile, partner, isLoading, isAuthenticated, signOut, refreshProfile } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const retryProfile = async () => {
    setIsRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-12" aria-busy="true">
        <span className="sr-only">Chargement du profil…</span>
        <Skeleton className="h-10 w-48 rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<LogIn size={28} />}
          title="Connectez-vous pour voir votre profil"
          description="Vos coordonnées, vos préférences de notification et vos accès aux espaces professionnels sont liés à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Fprofile"
        />
      </div>
    );
  }

  // Lot 7 (7.3) : connecté mais profil illisible (/api/auth/me en échec) : ce n'est pas « non connecté ».
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <ErrorState
          title="Votre profil n’a pas pu être chargé"
          description="Vous êtes bien connecté, mais vos informations n’ont pas pu être lues. Vérifiez votre connexion, puis réessayez."
          onRetry={() => void retryProfile()}
          isRetrying={isRetrying}
        />
      </div>
    );
  }

  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'EV';
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Mon compte';
  const roles = profile.roles?.length ? profile.roles : [profile.role];
  const isPartner = roles.includes('PARTENAIRE');
  const isAdmin = roles.includes('ADMIN') || roles.includes('SUPERADMIN');
  const isController = roles.includes('CONTROLEUR') || isAdmin;
  const isAmbassador = profile.referral_status === 'AMBASSADEUR';
  const roleText = roles.map((r) => ROLE_LABELS[r] ?? 'Compte').filter((v, i, all) => all.indexOf(v) === i);
  const statusText = ACCOUNT_STATUS_LABELS[profile.status] ?? 'Statut du compte inconnu';
  const partnerValidated = partner?.status === 'VALIDE';

  const shortcuts: Shortcut[] = [
    {
      href: '/profile/payments',
      title: 'Mes paiements',
      description: 'L’historique de vos paiements et de vos remboursements',
      icon: ReceiptText,
      tone: 'brand',
    },
    {
      href: '/wallet',
      title: 'Portefeuille et parrainage',
      description: 'Vos gains de parrainage et vos demandes de retrait',
      icon: Wallet,
      tone: 'success',
    },
  ];
  if (isPartner || isAdmin) {
    shortcuts.push({
      href: '/partner/dashboard',
      title: 'Espace partenaire',
      description: 'Vos événements, vos ventes et votre équipe de contrôle',
      icon: Briefcase,
      tone: 'info',
    });
  }
  if (isController) {
    shortcuts.push({
      href: '/partner/scan',
      title: 'Contrôle des billets',
      description: 'Scanner les QR codes à l’entrée d’un événement',
      icon: QrCode,
      tone: 'neutral',
    });
  }
  if (isAdmin) {
    shortcuts.push({
      href: '/admin/dashboard',
      title: 'Administration',
      description: 'Validation des partenaires et des événements, finance, journal d’audit',
      icon: Shield,
      tone: 'neutral',
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Mon profil"
        description="Vos coordonnées, l’affichage de l’application, vos notifications et vos accès."
      />

      <section aria-labelledby="profil-identite" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-center sm:flex-row sm:items-start sm:text-left">
        <AvatarEditor avatarUrl={profile.avatar_url} initials={initials} />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 id="profil-identite" className="break-words text-lg font-semibold text-fg">{fullName}</h2>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {isAmbassador && <Badge variant="brand">Ambassadeur Event Village</Badge>}
            {isPartner && (
              <Badge variant={partnerValidated ? 'success' : 'warning'}>
                {partnerValidated ? 'Partenaire validé' : 'Partenaire en attente de validation'}
              </Badge>
            )}
          </div>
          <dl className="space-y-1 text-sm text-fg-muted">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <dt className="flex items-center gap-1.5">
                <Phone size={16} aria-hidden="true" />
                <span className="sr-only">Téléphone</span>
              </dt>
              <dd className="text-fg tabular-nums">{profile.phone ? displayPhone(profile.phone) : 'Non renseigné'}</dd>
            </div>
            {isDeliverableEmail(profile.email) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <dt className="flex items-center gap-1.5">
                  <Mail size={16} aria-hidden="true" />
                  <span className="sr-only">Email</span>
                </dt>
                <dd className="break-all text-fg">{profile.email}</dd>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <dt className="flex items-center gap-1.5">
                <User size={16} aria-hidden="true" />
                <span>{roleText.length > 1 ? 'Rôles :' : 'Rôle :'}</span>
              </dt>
              <dd className="text-fg">{roleText.join(', ')}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <dt className="flex items-center gap-1.5">
                <BadgeCheck size={16} aria-hidden="true" />
                <span className="sr-only">Statut du compte</span>
              </dt>
              <dd className="text-fg">{statusText}</dd>
            </div>
          </dl>
        </div>
      </section>

      <ProfileForm profile={profile} />

      <section aria-labelledby="profil-raccourcis" className="space-y-3">
        <h2 id="profil-raccourcis" className="text-base font-semibold text-fg">Réglages et espaces</h2>
        <ul className="space-y-3">
          <li>
            <Link href="/profile/notifications" className={SHORTCUT_CLASS}>
              <ShortcutBody
                title="Préférences de notification"
                description="Rappels, changements d’événement, SMS et notifications push sur cet appareil"
                icon={Bell}
                tone="brand"
              />
            </Link>
          </li>
          {shortcuts.map(({ href, ...body }) => (
            <li key={href}>
              <Link href={href} className={SHORTCUT_CLASS}>
                <ShortcutBody {...body} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="profil-theme" className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 id="profil-theme" className="text-base font-semibold text-fg">Affichage</h2>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Thème de l’application">
          {THEMES.map(({ id, label, icon: Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(id)}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-brand bg-brand text-on-brand' : 'border-border bg-surface-sunken text-fg hover:border-border-strong',
                )}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Button
        variant="secondary"
        fullWidth
        onClick={() => void signOut()}
        leftIcon={<LogOut size={18} aria-hidden="true" />}
        className="border-danger-border text-danger-fg hover:bg-danger-bg"
      >
        Se déconnecter
      </Button>
    </div>
  );
}
