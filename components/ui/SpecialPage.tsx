import React from 'react';
import { Compass, Home, RotateCcw, Ticket, TriangleAlert, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { LinkButton } from './LinkButton';

/**
 * Design 1a (point 6) — pages spéciales au style du projet : page introuvable, erreur, hors ligne.
 *
 * Même gabarit pour les trois : pastille d'icône, titre (un seul h1), une phrase, une ou deux actions. SÉCURITÉ : aucune de
 * ces pages n'affiche de donnée personnelle ni le détail d'une erreur (message, pile, empreinte, adresse demandée) ; aucun
 * mot technique (ni « 404 », ni « erreur serveur »). Textes de la consigne du design 1a, exacts.
 */
export const SPECIAL_TEXTS = {
  notFound: {
    title: 'Page introuvable',
    message: 'Cette page n’existe pas ou a été déplacée.',
    home: 'Retour à l’accueil',
    explore: 'Explorer les événements',
  },
  error: {
    title: 'Quelque chose s’est mal passé de notre côté.',
    message: 'Réessayez dans un instant. Si cela continue, revenez à l’accueil.',
    retry: 'Réessayer',
    home: 'Accueil',
  },
  offline: {
    title: 'Vous n’avez pas de réseau.',
    message: 'Vos billets restent disponibles.',
    tickets: 'Mes billets',
  },
} as const;

/** Page de secours des billets sans réseau (service worker, contrat 5.3). */
export const OFFLINE_TICKETS_PATH = '/billet/hors-ligne';

export function SpecialPage({
  tone,
  title,
  message,
  actions,
  role,
}: {
  tone: 'neutral' | 'danger' | 'info';
  title: string;
  message: string;
  actions: React.ReactNode;
  /** `alert` pour l'erreur : annoncée aussitôt aux lecteurs d'écran. */
  role?: 'alert' | 'status';
}) {
  const Icon = tone === 'danger' ? TriangleAlert : tone === 'info' ? WifiOff : Compass;
  const pastille = tone === 'danger' ? 'bg-danger-soft text-danger-text' : tone === 'info' ? 'bg-info-soft text-info-text' : 'bg-primary-soft text-primary-text';
  return (
    <div role={role} className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${pastille}`} aria-hidden="true">
        <Icon size={30} />
      </span>
      <h1 className="text-balance text-2xl font-extrabold tracking-tight text-foreground-strong sm:text-3xl">{title}</h1>
      <p className="text-base leading-relaxed text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">{actions}</div>
    </div>
  );
}

export function NotFoundContent() {
  const t = SPECIAL_TEXTS.notFound;
  return (
    <SpecialPage
      tone="neutral"
      title={t.title}
      message={t.message}
      actions={(
        <>
          <LinkButton href="/" leftIcon={<Home size={18} />}>{t.home}</LinkButton>
          <LinkButton href="/explore" variant="secondary">{t.explore}</LinkButton>
        </>
      )}
    />
  );
}

export function OfflineContent() {
  const t = SPECIAL_TEXTS.offline;
  return (
    <SpecialPage
      tone="info"
      role="status"
      title={t.title}
      message={t.message}
      actions={<LinkButton href={OFFLINE_TICKETS_PATH} leftIcon={<Ticket size={18} />}>{t.tickets}</LinkButton>}
    />
  );
}

/** Contenu de la page d'erreur ; `retry` relance l'affichage de la section (reset du périmètre d'erreur de Next). */
export function ErrorContent({ retry }: { retry: () => void }) {
  const t = SPECIAL_TEXTS.error;
  return (
    <SpecialPage
      tone="danger"
      role="alert"
      title={t.title}
      message={t.message}
      actions={(
        <>
          <Button onClick={retry} leftIcon={<RotateCcw size={16} />}>{t.retry}</Button>
          <LinkButton href="/" variant="secondary" leftIcon={<Home size={16} />}>{t.home}</LinkButton>
        </>
      )}
    />
  );
}
