'use client';

/**
 * Réglages financiers (lot 3, contrat A) : clés finance.* lues et modifiées par
 * GET / PUT /api/admin/finance-settings. Lecture : ADMIN et SUPERADMIN ; modification : SUPERADMIN
 * seul, avec un motif obligatoire. Chaque modification est historisée et ne s'applique qu'aux
 * opérations futures (jamais rétroactive). La validation des valeurs est faite par le serveur.
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, History, Pencil, RefreshCw, Save, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { readJsonBody, serverErrorMessage } from '@/components/payment/PaymentModal';

type Kind = 'percent' | 'integer' | 'boolean' | 'bearer';

interface SettingMeta {
  label: string;
  help: string;
  kind: Kind;
  unit?: string;
}

/** Libellés et aides d'affichage ; les bornes sont contrôlées par le serveur (finance_setting_set). */
const META: Record<string, SettingMeta> = {
  'finance.service_fee_rate': { label: 'Frais de service', help: 'Payés par l’acheteur, arrondis au FCFA supérieur par billet. De 0 à 50 %.', kind: 'percent', unit: '%' },
  'finance.aggregator_fee_rate.WAVE': { label: 'Frais agrégateur Wave', help: 'Coût SamirPay d’un paiement Wave. De 0 à 10 %.', kind: 'percent', unit: '%' },
  'finance.aggregator_fee_rate.ORANGE_MONEY': { label: 'Frais agrégateur Orange Money', help: 'Coût SamirPay d’un paiement Orange Money. De 0 à 10 %.', kind: 'percent', unit: '%' },
  'finance.cancellation_aggregator_fee_bearer': { label: 'Frais agrégateur d’une annulation', help: 'Qui supporte les frais agrégateur quand un billet est remboursé.', kind: 'bearer' },
  'finance.payout_hold_enabled': { label: 'Délai de garde des ventes', help: 'Désactivé : les ventes sont disponibles dès la confirmation du paiement.', kind: 'boolean' },
  'finance.payout_delay_hours': { label: 'Délai après la fin de l’événement', help: 'Nombre d’heures avant que les ventes deviennent disponibles. De 0 à 720.', kind: 'integer', unit: 'h' },
  'finance.withdrawal_fee_rate': { label: 'Frais de retrait', help: 'Arrondis au FCFA supérieur, déduits du montant versé. De 0 à 10 %.', kind: 'percent', unit: '%' },
  'finance.withdrawal_min_amount': { label: 'Montant minimum de retrait', help: 'Montant entier en FCFA.', kind: 'integer', unit: 'FCFA' },
  'finance.withdrawal_bank_enabled': { label: 'Retraits par virement bancaire', help: 'Tant qu’il est désactivé, seuls Wave et Orange Money sont proposés.', kind: 'boolean' },
  'finance.referral_availability_days': { label: 'Délai de validation des commissions', help: 'Jours avant qu’une commission de parrainage devienne disponible. De 7 à 14.', kind: 'integer', unit: 'jours' },
};

const BEARER_LABELS: Record<string, string> = { EVENT_VILLAGE: 'Event Village', ORGANISATEUR: 'Organisateur' };

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
  if (meta?.kind === 'bearer') return BEARER_LABELS[String(v)] ?? String(v);
  if (typeof v === 'number') return `${v.toLocaleString('fr-FR')}${meta?.unit ? ` ${meta.unit}` : ''}`;
  return String(v);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
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
      const body = await readJsonBody(res, 'réglages financiers');
      if (!res.ok) {
        setLoadError(serverErrorMessage(body) ?? `Réglages indisponibles (erreur ${res.status}).`);
        return;
      }
      const parsed = parseSettings(body);
      if (!parsed) {
        console.error('[réglages financiers] réponse inattendue :', body);
        setLoadError('Réponse inattendue du serveur.');
        return;
      }
      setData(parsed);
      setLoadError(null);
    } catch (err) {
      console.error('[réglages financiers] chargement impossible :', err);
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
    else if (meta?.kind === 'bearer') value = draft;
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
      const body = await readJsonBody(res, 'réglages financiers/modification');
      if (!res.ok) {
        setSaveError(
          serverErrorMessage(body) ??
            (res.status === 403 ? 'Seul un superadministrateur peut modifier ce réglage.' : `Réglage non enregistré (erreur ${res.status}).`)
        );
        return;
      }
      toast.success(`Réglage « ${meta?.label ?? key} » enregistré. Il s’applique aux prochaines opérations.`);
      setEditing(null);
      void load();
    } catch (err) {
      console.error('[réglages financiers] enregistrement impossible :', err);
      setSaveError('Connexion impossible : le réglage n’a peut-être pas été enregistré. Actualisez avant de réessayer.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5722]/30 focus:border-[#FF5722]';

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-[#FF5722] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] rounded-md">
            <ChevronLeft size={14} aria-hidden="true" /> Administration
          </Link>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="text-[#FF5722]" size={24} aria-hidden="true" />
            Réglages financiers
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Chaque modification est historisée et ne s’applique qu’aux opérations futures. Modification réservée aux superadministrateurs.
          </p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} aria-hidden="true" />} onClick={() => void load()} disabled={isLoading}>
          Actualiser
        </Button>
      </div>

      {loadError && !data ? (
        <ErrorState title="Réglages indisponibles" description={loadError} onRetry={() => void load()} />
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Chargement des réglages…</span>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {loadError && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {loadError}
            </div>
          )}
          <ul className="rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
            {data.settings.map((s) => {
              const meta = META[s.key];
              const isEditing = editing === s.key;
              const valueId = `${fieldId}-${s.key}-value`;
              const reasonId = `${fieldId}-${s.key}-reason`;
              const errorId = `${fieldId}-${s.key}-error`;
              return (
                <li key={s.key} className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 dark:text-white">{meta?.label ?? s.key}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">{meta?.help ?? s.key}</div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">{s.key} · modifié le {formatDateTime(s.updatedAt)}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-[#FF5722] tabular-nums">{displayValue(s.key, s.value)}</span>
                      {!isEditing && (
                        <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} aria-hidden="true" />} onClick={() => startEdit(s)} aria-label={`Modifier ${meta?.label ?? s.key}`}>
                          Modifier
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <form
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(s.key);
                      }}
                      className="grid grid-cols-1 sm:grid-cols-[minmax(0,12rem)_1fr_auto] gap-3 items-start p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800"
                    >
                      <div>
                        <label htmlFor={valueId} className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 mb-1">
                          Nouvelle valeur{meta?.unit ? ` (${meta.unit})` : ''}
                        </label>
                        {meta?.kind === 'boolean' ? (
                          <select id={valueId} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass}>
                            <option value="true">Activé</option>
                            <option value="false">Désactivé</option>
                          </select>
                        ) : meta?.kind === 'bearer' ? (
                          <select id={valueId} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass}>
                            {Object.entries(BEARER_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={valueId}
                            type="text"
                            inputMode="decimal"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            aria-describedby={saveError ? errorId : undefined}
                            className={`${inputClass} tabular-nums`}
                          />
                        )}
                      </div>
                      <div>
                        <label htmlFor={reasonId} className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 mb-1">
                          Motif <span className="text-[#FF5722]" aria-hidden="true">*</span>
                        </label>
                        <input
                          id={reasonId}
                          type="text"
                          value={reason}
                          maxLength={300}
                          placeholder="Ex : décision du comité du 15 novembre"
                          onChange={(e) => setReason(e.target.value)}
                          aria-describedby={saveError ? errorId : undefined}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2 sm:pt-5">
                        <Button type="submit" variant="primary" size="sm" isLoading={isSaving} leftIcon={<Save size={14} aria-hidden="true" />}>
                          Enregistrer
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={() => setEditing(null)} leftIcon={<X size={14} aria-hidden="true" />}>
                          Annuler
                        </Button>
                      </div>
                      {saveError && (
                        <p id={errorId} role="alert" className="sm:col-span-3 text-[11px] font-medium text-red-600 dark:text-red-400">
                          {saveError}
                        </p>
                      )}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>

          <section aria-labelledby={`${fieldId}-historique`} className="space-y-3">
            <h2 id={`${fieldId}-historique`} className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-[#FF5722]" aria-hidden="true" /> Historique des modifications
            </h2>
            {data.history.length === 0 ? (
              <p className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 text-xs text-slate-500 dark:text-zinc-400">Aucune modification enregistrée.</p>
            ) : (
              <ul className="rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
                {data.history.map((h, i) => (
                  <li key={`${h.key}-${h.changedAt}-${i}`} className="px-4 py-3 text-xs space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white">{META[h.key]?.label ?? h.key}</div>
                    <div className="text-slate-600 dark:text-zinc-300 tabular-nums">
                      {displayValue(h.key, h.oldValue)} → {displayValue(h.key, h.newValue)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {formatDateTime(h.changedAt)}
                      {h.reason && ` · ${h.reason}`}
                    </div>
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
