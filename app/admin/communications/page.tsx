'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { FilePenLine, Info, MessageSquare, RefreshCw, Save } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatInteger } from '@/lib/format';

/**
 * Campagnes de communication (admin, permission communications.manage). Lot 7 (7.0 f, D71) : page migrée sur le
 * système de design et rendue honnête. La route enregistre toujours la campagne en brouillon et n'envoie rien
 * (décision 43 du lot 6, `sendingDisabled: true`) : la page ne demande plus d'envoi immédiat, dit « Brouillon
 * enregistré », n'affiche ni statut ni audience bruts, ni nombre « livrés ». Erreur de chargement : ErrorState.
 */

interface CampaignItem {
  id: string;
  title: string;
  message: string;
  sender_profile: string;
  target_audience: string;
  channels: string[];
  status: string;
  recipient_count: number;
  created_at: string;
}

const DRAFT_SAVED = 'Brouillon enregistré : l’envoi immédiat est désactivé.';

const SENDER_OPTIONS = [
  { value: 'Event Village Info', label: 'Event Village Info (actualités et événements)' },
  { value: 'Event Village Sénégal', label: 'Event Village Sénégal (annonces nationales)' },
  { value: 'Support Officiel', label: 'Support officiel (transactions et sécurité)' },
];

const AUDIENCE_LABELS: Record<string, string> = {
  ALL_CLIENTS: 'Tous les clients inscrits',
  ALL_PARTNERS: 'Tous les partenaires',
  AMBASSADORS: 'Ambassadeurs seulement',
  RESTAURANTS: 'Restaurants',
  ORGANISATEURS: 'Organisateurs',
};
const AUDIENCE_OPTIONS = ['ALL_CLIENTS', 'ALL_PARTNERS', 'AMBASSADORS'].map((value) => ({ value, label: AUDIENCE_LABELS[value] }));

const CHANNEL_LABELS: Record<string, string> = { SMS: 'SMS', EMAIL: 'Email' };

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Brouillon', variant: 'neutral' },
  SCHEDULED: { label: 'Programmée', variant: 'info' },
  SENDING: { label: 'Envoi en cours', variant: 'info' },
  SENT: { label: 'Envoyée', variant: 'success' },
  FAILED: { label: 'En échec', variant: 'danger' },
};

function audienceLabel(value: string): string {
  return AUDIENCE_LABELS[value] ?? 'Audience non répertoriée';
}

function statusMeta(value: string): { label: string; variant: BadgeVariant } {
  return STATUS_META[value] ?? { label: 'État non répertorié', variant: 'neutral' };
}

function channelsLabel(channels: string[] | null | undefined): string {
  const labels = (channels ?? []).map((c) => CHANNEL_LABELS[c] ?? 'Canal non répertorié');
  return labels.length > 0 ? labels.join(', ') : 'Aucun canal';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseCampaigns(body: unknown): CampaignItem[] | null {
  if (!isRecord(body) || !Array.isArray(body.campaigns)) return null;
  return body.campaigns.flatMap((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.id !== 'string') return [];
    return [{
      id: raw.id,
      title: typeof raw.title === 'string' ? raw.title : '',
      message: typeof raw.message === 'string' ? raw.message : '',
      sender_profile: typeof raw.sender_profile === 'string' ? raw.sender_profile : '',
      target_audience: typeof raw.target_audience === 'string' ? raw.target_audience : '',
      channels: Array.isArray(raw.channels) ? raw.channels.filter((c): c is string => typeof c === 'string') : [],
      status: typeof raw.status === 'string' ? raw.status : '',
      recipient_count: typeof raw.recipient_count === 'number' ? raw.recipient_count : 0,
      created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
    }];
  });
}

async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch (err) {
    console.error(`[Campagnes] ${what} : réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export default function AdminCommunicationsPage() {
  const toast = useToast();
  const formId = useId();
  const [campaigns, setCampaigns] = useState<CampaignItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{ title: string; recipients: number } | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [senderProfile, setSenderProfile] = useState(SENDER_OPTIONS[0].value);
  const [targetAudience, setTargetAudience] = useState('ALL_CLIENTS');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['SMS']);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/communications', { cache: 'no-store' });
      const body = await readJson(res, 'historique');
      if (!res.ok) {
        const serverMessage = isRecord(body) && typeof body.error === 'string' && res.status < 500 ? body.error : null;
        setLoadError(serverMessage ?? `Historique indisponible (erreur ${res.status}).`);
        return;
      }
      const parsed = parseCampaigns(body);
      if (!parsed) {
        console.error('[Campagnes] historique : réponse inattendue', body);
        setLoadError('Réponse inattendue du serveur.');
        return;
      }
      setCampaigns(parsed);
      setLoadError(null);
    } catch (err) {
      console.error('[Campagnes] historique injoignable :', err instanceof Error ? err.message : String(err));
      setLoadError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const toggleChannel = (channel: string, checked: boolean) => {
    setSelectedChannels((prev) => (checked ? Array.from(new Set([...prev, channel])) : prev.filter((c) => c !== channel)));
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (title.trim().length === 0 || message.trim().length === 0) {
      setSaveError('Indiquez un titre et un message.');
      return;
    }
    if (selectedChannels.length === 0) {
      setSaveError('Choisissez au moins un canal.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          senderProfile,
          targetAudience,
          channels: selectedChannels,
        }),
      });
      const body = await readJson(res, 'enregistrement');
      if (!res.ok) {
        const serverMessage = isRecord(body) && typeof body.error === 'string' && res.status < 500 ? body.error : null;
        setSaveError(serverMessage ?? `Brouillon non enregistré (erreur ${res.status}).`);
        return;
      }
      const recipients = isRecord(body) && typeof body.recipientCount === 'number' ? body.recipientCount : 0;
      setLastSaved({ title: title.trim(), recipients });
      toast.success(DRAFT_SAVED);
      setTitle('');
      setMessage('');
      await fetchCampaigns();
    } catch (err) {
      console.error('[Campagnes] enregistrement injoignable :', err instanceof Error ? err.message : String(err));
      setSaveError('Connexion impossible : le brouillon n’a peut-être pas été enregistré. Actualisez l’historique avant de réessayer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Campagnes de communication"
        description="Préparez un message pour les clients ou les partenaires. Les campagnes sont enregistrées en brouillon : aucun envoi ne part de cette page."
        back={{ href: '/admin/dashboard', label: 'Administration' }}
        actions={(
          <Button
            variant="secondary"
            onClick={() => void fetchCampaigns()}
            isLoading={isLoading && campaigns !== null}
            disabled={isLoading}
            leftIcon={<RefreshCw size={18} aria-hidden="true" />}
          >
            Actualiser
          </Button>
        )}
      />

      <StatusBanner tone="info" icon={<Info size={20} aria-hidden="true" />} title="Envoi des campagnes désactivé">
        L’envoi aux destinataires sera ouvert avec le lot des communications (préférences et désabonnement). En attendant, chaque campagne reste un brouillon.
      </StatusBanner>

      <section aria-labelledby={`${formId}-titre`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 id={`${formId}-titre`} className="flex items-center gap-2 text-lg font-semibold text-fg">
          <FilePenLine size={20} className="text-brand-fg" aria-hidden="true" />
          Nouveau brouillon
        </h2>

        {lastSaved && (
          <StatusBanner tone="success" title={DRAFT_SAVED}>
            {`« ${lastSaved.title} » : ${formatInteger(lastSaved.recipients)} destinataire${lastSaved.recipients > 1 ? 's' : ''} ciblé${lastSaved.recipients > 1 ? 's' : ''}, aucun message envoyé.`}
          </StatusBanner>
        )}

        <form onSubmit={handleSaveDraft} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Titre"
              required
              maxLength={120}
              placeholder="Ex : soirée de gala, information de sécurité"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Select
              label="Expéditeur"
              value={senderProfile}
              onChange={(e) => setSenderProfile(e.target.value)}
              options={SENDER_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Destinataires"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              options={AUDIENCE_OPTIONS}
            />
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-fg">Canaux</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                  <label
                    key={value}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-sunken px-3 text-sm font-semibold text-fg"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(value)}
                      onChange={(e) => toggleChannel(value, e.target.checked)}
                      className="h-5 w-5 rounded accent-brand"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <Textarea
            label="Message"
            required
            rows={4}
            maxLength={1000}
            showCount
            hint="Les termes offensants sont refusés par une modération automatique."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {saveError && (
            <StatusBanner tone="danger" announce="alert" title="Brouillon non enregistré">
              {saveError}
            </StatusBanner>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save size={18} aria-hidden="true" />}>
              Enregistrer le brouillon
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby={`${formId}-historique`} className="space-y-3">
        <h2 id={`${formId}-historique`} className="text-lg font-semibold text-fg">Campagnes enregistrées</h2>

        {loadError && campaigns === null ? (
          <ErrorState title="Historique indisponible" description={loadError} onRetry={() => void fetchCampaigns()} isRetrying={isLoading} />
        ) : campaigns === null ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Chargement des campagnes…</span>
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <>
            {loadError && (
              <StatusBanner tone="danger" announce="alert" title="Historique non actualisé">
                {loadError} La liste affichée est celle du dernier chargement.
              </StatusBanner>
            )}
            {campaigns.length === 0 ? (
              <EmptyState
                icon={<MessageSquare size={28} />}
                title="Aucune campagne"
                description="Les brouillons que vous enregistrez apparaissent ici."
              />
            ) : (
              <ul className="space-y-3">
                {campaigns.map((camp) => {
                  const meta = statusMeta(camp.status);
                  return (
                    <li key={camp.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <h3 className="break-words text-base font-semibold text-fg">{camp.title}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                            <Badge variant="brand" size="sm">{camp.sender_profile || 'Expéditeur non indiqué'}</Badge>
                          </div>
                        </div>
                        <time dateTime={camp.created_at || undefined} className="text-sm tabular-nums text-fg-muted">
                          {formatDateTime(camp.created_at)}
                        </time>
                      </div>
                      <p className="whitespace-pre-line break-words rounded-xl border border-border bg-surface-sunken p-3 text-sm leading-relaxed text-fg">
                        {camp.message}
                      </p>
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-fg-muted">Destinataires</dt>
                          <dd className="font-semibold text-fg">{audienceLabel(camp.target_audience)}</dd>
                        </div>
                        <div>
                          <dt className="text-fg-muted">Personnes ciblées</dt>
                          <dd className="font-semibold tabular-nums text-fg">{formatInteger(camp.recipient_count)}</dd>
                        </div>
                        <div>
                          <dt className="text-fg-muted">Canaux</dt>
                          <dd className="font-semibold text-fg">{channelsLabel(camp.channels)}</dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
