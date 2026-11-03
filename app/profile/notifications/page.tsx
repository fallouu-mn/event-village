'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, CalendarClock, LogIn, ShieldCheck, TrendingUp } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { PushDeviceCard } from '@/components/notifications/PushDeviceCard';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Préférences de notification (lot 6, contrats H1, H2, H4).
 *
 *  - Source unique : GET /api/notifications/preferences (sujets, canaux et libellés humains servis par le
 *    serveur ; indispensables listés à part). Aucun code de sujet ni de canal n'est affiché.
 *  - « Toujours envoyées » : messages indispensables (connexion, achats, transferts, annulations,
 *    remboursements, sécurité), non réglables.
 *  - « Vous choisissez » : une bascule par sujet et par canal ; mise à jour optimiste par PUT, annulée et
 *    signalée (Toast et message sous la bascule) en cas d'échec.
 *  - État du push SUR CET APPAREIL : PushDeviceCard (la demande d'autorisation n'a lieu qu'au clic).
 *  - Lien de désabonnement d'un email (?topic=REMINDERS…) : défilement jusqu'au sujet, mis en évidence.
 */

interface ChannelPreference {
  channel: string;
  label: string;
  enabled: boolean;
}

interface TopicPreference {
  topic: string;
  label: string;
  description: string;
  channels: ChannelPreference[];
}

interface PreferencesData {
  topics: TopicPreference[];
  essentials: string[];
}

const TOPIC_ICONS: Record<string, React.ElementType> = {
  REMINDERS: CalendarClock,
  EVENT_UPDATES: BellRing,
  PRO_ACTIVITY: TrendingUp,
};

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Lecture stricte de la réponse : une forme inattendue est une erreur affichée, jamais un écran vide. */
function parsePreferences(body: unknown): PreferencesData | null {
  if (!isRecord(body) || !Array.isArray(body.topics) || !Array.isArray(body.essentials)) return null;
  const topics: TopicPreference[] = [];
  for (const t of body.topics) {
    if (!isRecord(t) || typeof t.topic !== 'string' || typeof t.label !== 'string' || !Array.isArray(t.channels)) return null;
    const channels: ChannelPreference[] = [];
    for (const c of t.channels) {
      if (!isRecord(c) || typeof c.channel !== 'string' || typeof c.label !== 'string' || typeof c.enabled !== 'boolean') return null;
      channels.push({ channel: c.channel, label: c.label, enabled: c.enabled });
    }
    topics.push({ topic: t.topic, label: t.label, description: typeof t.description === 'string' ? t.description : '', channels });
  }
  const essentials = body.essentials.filter((e): e is string => typeof e === 'string');
  return { topics, essentials };
}

type LoadResult = { ok: true; data: PreferencesData } | { ok: false; message: string };

async function readPreferences(): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch('/api/notifications/preferences', { cache: 'no-store', credentials: 'same-origin' });
  } catch (err) {
    console.error('[Préférences] lecture injoignable :', err instanceof Error ? err.message : String(err));
    return { ok: false, message: NETWORK_MESSAGE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`[Préférences] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return { ok: false, message: `Réponse inattendue du serveur (erreur ${res.status}).` };
  }
  if (!res.ok) {
    const message = isRecord(body) && typeof body.error === 'string' && body.error ? body.error : `Vos préférences n’ont pas pu être chargées (erreur ${res.status}).`;
    return { ok: false, message };
  }
  const data = parsePreferences(body);
  if (!data) {
    console.error('[Préférences] réponse inattendue :', body);
    return { ok: false, message: 'Réponse inattendue du serveur.' };
  }
  return { ok: true, data };
}

const keyOf = (topic: string, channel: string) => `${topic}:${channel}`;

function PreferencesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <div className="h-5 w-1/2 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-4 w-5/6 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function NotificationPreferencesPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const toast = useToast();
  const [data, setData] = useState<PreferencesData | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  const load = useCallback(async () => {
    const result = await readPreferences();
    if (result.ok) {
      setData(result.data);
      setLoadError(null);
      setPhase('ready');
    } else {
      setLoadError(result.message);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading || !userId) return;
    void load();
  }, [isAuthLoading, userId, load]);

  // Lien de désabonnement (?topic=…) : défilement jusqu'au sujet et mise en évidence, une seule fois.
  useEffect(() => {
    if (phase !== 'ready' || !data || scrolledRef.current) return;
    const wanted = new URLSearchParams(window.location.search).get('topic');
    if (!wanted || !data.topics.some((t) => t.topic === wanted)) return;
    scrolledRef.current = true;
    setHighlighted(wanted);
    const el = document.getElementById(`sujet-${wanted}`);
    if (el) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      el.focus({ preventScroll: true });
    }
  }, [phase, data]);

  const retry = async () => {
    setIsRetrying(true);
    try {
      await load();
    } finally {
      setIsRetrying(false);
    }
  };

  const setChannel = (topic: string, channel: string, enabled: boolean) => {
    setData((prev) => prev && {
      ...prev,
      topics: prev.topics.map((t) => (t.topic !== topic ? t : {
        ...t,
        channels: t.channels.map((c) => (c.channel === channel ? { ...c, enabled } : c)),
      })),
    });
  };

  const toggle = async (topic: TopicPreference, channel: ChannelPreference, next: boolean) => {
    const key = keyOf(topic.topic, channel.channel);
    setChannel(topic.topic, channel.channel, next);
    setSaving((prev) => new Set(prev).add(key));
    setErrors((prev) => {
      const { [key]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    let failure: string | null = null;
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.topic, channel: channel.channel, enabled: next }),
      });
      if (!res.ok) {
        let message: string | null = null;
        try {
          const body = await res.json() as { error?: unknown };
          message = typeof body.error === 'string' && body.error ? body.error : null;
        } catch (err) {
          console.error(`[Préférences] refus illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        }
        failure = message ?? `Préférence non enregistrée (erreur ${res.status}).`;
      }
    } catch (err) {
      console.error('[Préférences] enregistrement injoignable :', err instanceof Error ? err.message : String(err));
      failure = NETWORK_MESSAGE;
    }
    if (failure) {
      setChannel(topic.topic, channel.channel, !next);
      setErrors((prev) => ({ ...prev, [key]: failure as string }));
      toast.error(`« ${channel.label} » pour « ${topic.label} » n’a pas été modifié. ${failure}`);
    } else {
      toast.success(`${topic.label} : ${channel.label} ${next ? 'activé' : 'désactivé'}.`);
    }
    setSaving((prev) => {
      const nextSet = new Set(prev);
      nextSet.delete(key);
      return nextSet;
    });
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<LogIn size={28} />}
          title="Connectez-vous pour régler vos notifications"
          description="Vos préférences de rappels, de SMS et de notifications push sont liées à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Fprofile%2Fnotifications"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Préférences de notification"
        description="Choisissez comment Event Village vous prévient. Les messages indispensables partent toujours."
        back={{ href: '/profile', label: 'Mon profil' }}
      />

      <PushDeviceCard />

      {isAuthLoading || phase === 'loading' ? (
        <div aria-busy="true">
          <span className="sr-only">Chargement de vos préférences…</span>
          <PreferencesSkeleton />
        </div>
      ) : phase === 'error' || !data ? (
        <ErrorState
          title="Impossible d’afficher vos préférences"
          description={loadError ?? NETWORK_MESSAGE}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
        />
      ) : (
        <>
          <section aria-labelledby="prefs-choix" className="space-y-4">
            <div className="space-y-1">
              <h2 id="prefs-choix" className="text-lg font-semibold text-fg">Vous choisissez</h2>
              <p className="text-sm leading-relaxed text-fg-muted">
                Pour chaque sujet, activez ou coupez un canal. Un canal coupé n’envoie plus rien sur ce sujet ; vous gardez les autres.
              </p>
            </div>
            {data.topics.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-fg-muted">
                Aucun réglage optionnel pour votre compte.
              </p>
            ) : (
              data.topics.map((topic) => {
                const Icon = TOPIC_ICONS[topic.topic] ?? BellRing;
                const headingId = `sujet-${topic.topic}-titre`;
                return (
                  <section
                    key={topic.topic}
                    id={`sujet-${topic.topic}`}
                    tabIndex={-1}
                    aria-labelledby={headingId}
                    className={cn(
                      'scroll-mt-24 space-y-3 rounded-2xl border bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5',
                      highlighted === topic.topic ? 'border-brand-fg ring-2 ring-ring/40' : 'border-border',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h3 id={headingId} className="text-base font-semibold text-fg">{topic.label}</h3>
                        {topic.description && <p className="text-sm leading-relaxed text-fg-muted">{topic.description}</p>}
                      </div>
                    </div>
                    <ul className="divide-y divide-border">
                      {topic.channels.map((channel) => {
                        const key = keyOf(topic.topic, channel.channel);
                        return (
                          <li key={key} className="py-1">
                            <Switch
                              id={`pref-${topic.topic}-${channel.channel}`}
                              label={channel.label}
                              checked={channel.enabled}
                              loading={saving.has(key)}
                              error={errors[key]}
                              onChange={(next) => void toggle(topic, channel, next)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </section>

          <section aria-labelledby="prefs-toujours" className="space-y-3 rounded-2xl border border-border bg-surface-sunken p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-success-bg text-success-fg" aria-hidden="true">
                <ShieldCheck size={20} />
              </span>
              <div className="min-w-0 space-y-1">
                <h2 id="prefs-toujours" className="text-lg font-semibold text-fg">Toujours envoyées</h2>
                <p className="text-sm leading-relaxed text-fg-muted">
                  Ces messages protègent votre compte, votre argent et vos billets : ils ne se désactivent pas.
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.essentials.map((e) => (
                <li key={e} className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg">
                  <ShieldCheck size={16} className="flex-shrink-0 text-success-fg" aria-hidden="true" />
                  {e}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
