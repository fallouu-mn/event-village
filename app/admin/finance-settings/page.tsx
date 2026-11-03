'use client';

/**
 * Réglages de la plateforme : finance (lot 3, clés finance.*), contrôle d'accès (lot 4, clés access.*) et
 * notifications (lot 6, clés notif.* : rappels J-1 et H-3, SMS des rappels, plage sans SMS, seuil d'alerte),
 * lus et modifiés par GET / PUT /api/admin/finance-settings, présentés par section.
 * Lecture : ADMIN et SUPERADMIN ; modification : SUPERADMIN seul, avec un motif obligatoire. Chaque
 * modification est historisée et ne s'applique qu'aux opérations futures (jamais rétroactive). La
 * validation des valeurs (bornes, choix admis) est faite par le serveur (finance_setting_set).
 * Lot 6 : page migrée sur le système de design (tokens, PageHeader, Field, StatusBanner, 44 px, 14 px).
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import { Bell, History, Pencil, RefreshCw, Save, ScanLine, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';
import { readJsonBody, serverErrorMessage } from '@/components/payment/PaymentModal';

type Kind = 'percent' | 'integer' | 'boolean' | 'choice';

interface SettingMeta {
  label: string;
  help: string;
  kind: Kind;
  unit?: string;
  /** Valeurs admises d'un réglage « choice » et leur libellé. */
  options?: Record<string, string>;
}

const BEARER_LABELS: Record<string, string> = { EVENT_VILLAGE: 'Event Village', ORGANISATEUR: 'Organisateur' };
const MANUAL_ENTRY_SCOPE_LABELS: Record<string, string> = {
  ASSIGNED_CONTROLLER: 'Contrôleur affecté seul',
  STAFF: 'Contrôleur affecté, partenaire et admin',
};
/** Politique SMS d'un rappel (notif.j1_sms, notif.h3_sms). */
const SMS_POLICY_LABELS: Record<string, string> = {
  ALWAYS: 'Toujours',
  IF_NO_PUSH: 'Seulement sans notification push',
  NEVER: 'Jamais',
};

/** Libellés et aides d'affichage ; les bornes sont contrôlées par le serveur (finance_setting_set). */
const META: Record<string, SettingMeta> = {
  'finance.service_fee_rate': { label: 'Frais de service', help: 'Payés par l’acheteur, arrondis au FCFA supérieur par billet. De 0 à 50 %.', kind: 'percent', unit: '%' },
  'finance.aggregator_fee_rate.WAVE': { label: 'Frais agrégateur Wave', help: 'Coût SamirPay d’un paiement Wave. De 0 à 10 %.', kind: 'percent', unit: '%' },
  'finance.aggregator_fee_rate.ORANGE_MONEY': { label: 'Frais agrégateur Orange Money', help: 'Coût SamirPay d’un paiement Orange Money. De 0 à 10 %.', kind: 'percent', unit: '%' },
  'finance.cancellation_aggregator_fee_bearer': { label: 'Frais agrégateur d’une annulation', help: 'Qui supporte les frais agrégateur quand un billet est remboursé.', kind: 'choice', options: BEARER_LABELS },
  'finance.payout_hold_enabled': { label: 'Délai de garde des ventes', help: 'Désactivé : les ventes sont disponibles dès la confirmation du paiement.', kind: 'boolean' },
  'finance.payout_delay_hours': { label: 'Délai après la fin de l’événement', help: 'Nombre d’heures avant que les ventes deviennent disponibles. De 0 à 720.', kind: 'integer', unit: 'h' },
  'finance.withdrawal_fee_rate': { label: 'Frais de retrait', help: 'Arrondis au FCFA supérieur, déduits du montant versé. De 0 à 10 %.', kind: 'percent', unit: '%' },
  'finance.withdrawal_min_amount': { label: 'Montant minimum de retrait', help: 'Montant entier en FCFA.', kind: 'integer', unit: 'FCFA' },
  'finance.withdrawal_bank_enabled': { label: 'Retraits par virement bancaire', help: 'Tant qu’il est désactivé, seuls Wave et Orange Money sont proposés.', kind: 'boolean' },
  'finance.referral_availability_days': { label: 'Délai de validation des commissions', help: 'Jours avant qu’une commission de parrainage devienne disponible. De 7 à 14.', kind: 'integer', unit: 'jours' },
  'access.scan_window_before_hours': { label: 'Ouverture du contrôle avant le début', help: 'Heures avant le début de l’événement à partir desquelles les billets peuvent être scannés. De 0 à 48.', kind: 'integer', unit: 'h' },
  'access.scan_window_after_hours': { label: 'Fermeture du contrôle après la fin', help: 'Heures après la fin de l’événement pendant lesquelles les billets peuvent encore être scannés. De 0 à 48.', kind: 'integer', unit: 'h' },
  'access.manual_entry_scope': { label: 'Saisie manuelle d’un numéro de billet', help: 'Qui peut valider un billet par son numéro, toujours après vérification de la pièce d’identité.', kind: 'choice', options: MANUAL_ENTRY_SCOPE_LABELS },
  'access.counter_sale_enabled': { label: 'Vente au guichet en espèces', help: 'Un contrôleur autorisé à encaisser, avec une caisse ouverte, vend des billets au prix facial, sans frais.', kind: 'boolean' },
  'access.low_stock_threshold': { label: 'Seuil « bientôt complet »', help: 'Quand il reste ce nombre de places ou moins dans une catégorie, la page publique affiche le restant ; au-delà, seulement « disponible ». Entier de 1 à 1000.', kind: 'integer', unit: 'places' },
  'notif.reminder_j1_enabled': { label: 'Rappel la veille', help: 'Rappel envoyé la veille du début aux porteurs d’un billet valable de l’événement en ligne.', kind: 'boolean' },
  'notif.reminder_j1_hour': { label: 'Heure du rappel de la veille', help: 'Heure de Dakar à laquelle part le rappel de la veille. De 6 à 20.', kind: 'integer', unit: 'h' },
  'notif.reminder_h3_enabled': { label: 'Rappel avant le début', help: 'Rappel envoyé quelques heures avant le début, avec le conseil d’ouvrir son billet avant d’arriver.', kind: 'boolean' },
  'notif.reminder_h3_hours': { label: 'Heures avant le début', help: 'Nombre d’heures entre le rappel et le début de l’événement. De 1 à 12.', kind: 'integer', unit: 'h' },
  'notif.j1_sms': { label: 'SMS du rappel de la veille', help: 'Envoi du SMS en plus de l’application et des notifications push.', kind: 'choice', options: SMS_POLICY_LABELS },
  'notif.h3_sms': { label: 'SMS du rappel avant le début', help: 'Envoi du SMS en plus de l’application et des notifications push.', kind: 'choice', options: SMS_POLICY_LABELS },
  'notif.sms_quiet_start': { label: 'Début de la plage sans SMS', help: 'Heure de Dakar à partir de laquelle aucun SMS optionnel ne part ; le rappel passe alors par les autres canaux. De 0 à 23.', kind: 'integer', unit: 'h' },
  'notif.sms_quiet_end': { label: 'Fin de la plage sans SMS', help: 'Heure de Dakar de fin de la plage. Un début égal à la fin supprime la plage. De 0 à 23.', kind: 'integer', unit: 'h' },
  'notif.sms_daily_alert': { label: "Seuil d'alerte SMS du jour", help: 'Nombre de SMS envoyés dans la journée au-delà duquel les administrateurs sont alertés. De 1 à 1 000 000.', kind: 'integer', unit: 'SMS' },
};

/** Ordre d'affichage des réglages dans leur section (celui de META ; clé inconnue en dernier). */
const META_ORDER = Object.keys(META);
const rank = (key: string) => (META_ORDER.includes(key) ? META_ORDER.indexOf(key) : META_ORDER.length);

/** Sections de la page, dans l'ordre d'affichage, par préfixe de clé. */
const SECTIONS: Array<{ prefix: string; title: string; help: string; icon: LucideIcon }> = [
  { prefix: 'finance.', title: 'Finance', help: 'Frais, délais de disponibilité des ventes, retraits et commissions.', icon: Wallet },
  { prefix: 'access.', title: 'Contrôle d’accès', help: 'Fenêtre de scan, saisie manuelle des numéros de billet, vente au guichet et seuil de stock affiché au public.', icon: ScanLine },
  { prefix: 'notif.', title: 'Notifications', help: 'Rappels la veille et avant le début, SMS des rappels, plage de nuit sans SMS et seuil d’alerte du volume de SMS.', icon: Bell },
];

interface Setting {
  key: string;
  value: unknown;
  updatedAt: string | null;
}

interface HistoryRow {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  changedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valeur d'un réglage, éventuellement enveloppée dans { value } (historique). */
function unwrap(value: unknown): unknown {
  return isRecord(value) && 'value' in value ? value.value : value;
}

function displayValue(key: string, value: unknown): string {
  const meta = META[key];
  const v = unwrap(value);
  if (v === null || v === undefined) return '—';
  if (meta?.kind === 'boolean') return v === true ? 'Activé' : 'Désactivé';
  if (meta?.kind === 'choice') return meta.options?.[String(v)] ?? 'Valeur non répertoriée';
  if (typeof v === 'number') return `${v.toLocaleString('fr-FR')}${meta?.unit ? ` ${meta.unit}` : ''}`;
  return String(v);
}

function parseSettings(body: unknown): { settings: Setting[]; history: HistoryRow[] } | null {
  if (!isRecord(body) || !Array.isArray(body.settings)) return null;
  const settings = body.settings.flatMap((s: unknown) => {
    if (!isRecord(s) || typeof s.key !== 'string') return [];
    return [{ key: s.key, value: s.value, updatedAt: typeof s.updated_at === 'string' ? s.updated_at : null }];
  });
  const history = Array.isArray(body.history)
    ? body.history.flatMap((h: unknown) => {
        if (!isRecord(h) || typeof h.key !== 'string' || typeof h.changed_at !== 'string') return [];
        return [{ key: h.key, oldValue: h.old_value, newValue: h.new_value, reason: typeof h.reason === 'string' ? h.reason : null, changedAt: h.changed_at }];
      })
    : [];
  return { settings, history };
}

export default function AdminFinanceSettingsPage() {
  const toast = useToast();
  const fieldId = useId();
  const [data, setData] = useState<{ settings: Setting[]; history: HistoryRow[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/finance-settings', { cache: 'no-store' });
      const body = await readJsonBody(res, 'réglages de la plateforme');
      if (!res.ok) {
        setLoadError(serverErrorMessage(body) ?? `Réglages indisponibles (erreur ${res.status}).`);
        return;
      }
      const parsed = parseSettings(body);
      if (!parsed) {
        console.error('[réglages de la plateforme] réponse inattendue :', body);
        setLoadError('Réponse inattendue du serveur.');
        return;
      }
      setData(parsed);
      setLoadError(null);
    } catch (err) {
      console.error('[réglages de la plateforme] chargement impossible :', err);
      setLoadError('Connexion impossible : vérifiez votre réseau puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (setting: Setting) => {
    const v = unwrap(setting.value);
    setEditing(setting.key);
    setDraft(v === null || v === undefined ? '' : String(v));
    setReason('');
    setSaveError(null);
  };

  const save = async (key: string) => {
    const meta = META[key];
    let value: number | boolean | string;
    if (meta?.kind === 'boolean') value = draft === 'true';
    else if (meta?.kind === 'choice') value = draft;
    else {
      const parsed = Number(draft.replace(',', '.'));
      if (draft.trim() === '' || !Number.isFinite(parsed)) {
        setSaveError('Saisissez une valeur numérique.');
        return;
      }
      value = parsed;
    }
    if (reason.trim().length < 3) {
      setSaveError('Indiquez le motif de la modification (3 caractères au moins).');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/finance-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, reason: reason.trim() }),
      });
      const body = await readJsonBody(res, 'réglages de la plateforme/modification');
      if (!res.ok) {
        setSaveError(
          serverErrorMessage(body) ??
            (res.status === 403 ? 'Seul un superadministrateur peut modifier ce réglage.' : `Réglage non enregistré (erreur ${res.status}).`)
        );
        return;
      }
      toast.success(`Réglage « ${meta?.label ?? 'sans libellé'} » enregistré. Il s’applique aux prochaines opérations.`);
      setEditing(null);
      void load();
    } catch (err) {
      console.error('[réglages de la plateforme] enregistrement impossible :', err);
      setSaveError('Connexion impossible : le réglage n’a peut-être pas été enregistré. Actualisez avant de réessayer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Réglages de la plateforme"
        description="Chaque modification est historisée et ne s’applique qu’aux opérations futures. Modification réservée aux superadministrateurs."
        back={{ href: '/admin', label: 'Administration' }}
        actions={(
          <Button variant="secondary" leftIcon={<RefreshCw size={18} aria-hidden="true" />} onClick={() => void load()} isLoading={isLoading && Boolean(data)} disabled={isLoading}>
            Actualiser
          </Button>
        )}
      />

      {loadError && !data ? (
        <ErrorState title="Réglages indisponibles" description={loadError} onRetry={() => void load()} isRetrying={isLoading} />
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Chargement des réglages…</span>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {loadError && (
            <StatusBanner tone="danger" announce="alert" title="Réglages non actualisés">
              {loadError} Les valeurs affichées sont celles du dernier chargement.
            </StatusBanner>
          )}
          {SECTIONS.map((section) => {
            const items = data.settings.filter((s) => s.key.startsWith(section.prefix)).sort((a, b) => rank(a.key) - rank(b.key));
            if (items.length === 0) return null;
            const headingId = `${fieldId}-section-${section.prefix.replace('.', '')}`;
            const SectionIcon = section.icon;
            return (
              <section key={section.prefix} aria-labelledby={headingId} className="space-y-3">
                <div className="space-y-1">
                  <h2 id={headingId} className="flex items-center gap-2 text-lg font-semibold text-fg">
                    <SectionIcon size={20} className="text-brand-fg" aria-hidden="true" />
                    {section.title}
                  </h2>
                  <p className="text-sm text-fg-muted">{section.help}</p>
                </div>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                  {items.map((s) => {
                    const meta = META[s.key];
                    const label = meta?.label ?? 'Réglage sans libellé';
                    const isEditing = editing === s.key;
                    const formId = `${fieldId}-${s.key}-form`;
                    return (
                      <li key={s.key} className="space-y-3 p-4">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-semibold text-fg">{label}</p>
                            {meta?.help && <p className="text-sm text-fg-muted">{meta.help}</p>}
                            <p className="text-sm text-fg-muted">
                              Modifié le <time dateTime={s.updatedAt ?? undefined}>{formatDateTime(s.updatedAt)}</time>
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-3">
                            <span className="text-base font-semibold tabular-nums text-brand-fg">{displayValue(s.key, s.value)}</span>
                            {!isEditing && (
                              <Button variant="ghost" size="sm" leftIcon={<Pencil size={16} aria-hidden="true" />} onClick={() => startEdit(s)} aria-label={`Modifier ${label}`}>
                                Modifier
                              </Button>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <form
                            id={formId}
                            noValidate
                            onSubmit={(e) => {
                              e.preventDefault();
                              void save(s.key);
                            }}
                            className="grid grid-cols-1 items-start gap-3 rounded-2xl border border-border bg-surface-sunken p-3 sm:grid-cols-[minmax(0,14rem)_1fr]"
                          >
                            {meta?.kind === 'boolean' ? (
                              <Select
                                label="Nouvelle valeur"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                options={[{ value: 'true', label: 'Activé' }, { value: 'false', label: 'Désactivé' }]}
                              />
                            ) : meta?.kind === 'choice' ? (
                              <Select
                                label="Nouvelle valeur"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                options={Object.entries(meta.options ?? {}).map(([value, optionLabel]) => ({ value, label: optionLabel }))}
                              />
                            ) : (
                              <TextInput
                                label={`Nouvelle valeur${meta?.unit ? ` (${meta.unit})` : ''}`}
                                type="text"
                                inputMode="decimal"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="tabular-nums"
                              />
                            )}
                            <TextInput
                              label="Motif"
                              required
                              value={reason}
                              maxLength={300}
                              placeholder="Ex : décision du comité du 15 novembre"
                              onChange={(e) => setReason(e.target.value)}
                              hint="3 caractères au moins ; visible dans l’historique."
                            />
                            {saveError && (
                              <div className="sm:col-span-2">
                                <StatusBanner tone="danger" announce="alert" title="Réglage non enregistré">
                                  {saveError}
                                </StatusBanner>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 sm:col-span-2">
                              <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save size={18} aria-hidden="true" />}>
                                Enregistrer
                              </Button>
                              <Button type="button" variant="ghost" disabled={isSaving} onClick={() => setEditing(null)} leftIcon={<X size={18} aria-hidden="true" />}>
                                Annuler
                              </Button>
                            </div>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <section aria-labelledby={`${fieldId}-historique`} className="space-y-3">
            <h2 id={`${fieldId}-historique`} className="flex items-center gap-2 text-lg font-semibold text-fg">
              <History size={20} className="text-brand-fg" aria-hidden="true" />
              Historique des modifications
            </h2>
            {data.history.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-fg-muted">Aucune modification enregistrée.</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {data.history.map((h, i) => (
                  <li key={`${h.key}-${h.changedAt}-${i}`} className="space-y-0.5 px-4 py-3 text-sm">
                    <p className="font-semibold text-fg">{META[h.key]?.label ?? 'Réglage sans libellé'}</p>
                    <p className="tabular-nums text-fg">
                      {displayValue(h.key, h.oldValue)} <span aria-hidden="true">→</span><span className="sr-only">devient</span> {displayValue(h.key, h.newValue)}
                    </p>
                    <p className="text-fg-muted">
                      <time dateTime={h.changedAt}>{formatDateTime(h.changedAt)}</time>
                      {h.reason && ` · ${h.reason}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
