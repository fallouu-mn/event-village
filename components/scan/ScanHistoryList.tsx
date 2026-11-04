'use client';

/**
 * Historique repliable du contrôleur (lot 7, tâche 7.2 ; décision D42, règle du lot 5 « le serveur est la
 * seule source des chiffres ») : vos entrées, vos refus ventilés par motif et vos 20 derniers scans, tels
 * que les sert GET /api/controller/scans (aucun compteur tenu dans le navigateur, aucun nom de porteur).
 * Replié par défaut : la caméra reste en haut de l'écran.
 */
import React, { useId, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatInteger, formatTime } from '@/lib/format';
import { scanMethodLabel, scanCategoryOf, isScanResult } from '@/lib/scan/scan-result';

export interface ServedScan {
    scan_id: string;
    at: string;
    result: string;
    label: string;
    method: string;
    ticket_number: string | null;
    category: string | null;
}

export interface ServedRefusal { result: string; label: string; count: number }

export interface ScanHistoryListProps {
    recent: ServedScan[];
    myEntries: number | null;
    myRefusals: number | null;
    refusalsByResult: ServedRefusal[];
    loading?: boolean;
    error?: string | null;
}

function dotClass(result: string): string {
    if (!isScanResult(result)) return 'bg-fg-muted';
    switch (scanCategoryOf(result)) {
        case 'accepte':
            return 'bg-success';
        case 'technique':
            return 'bg-fg-muted';
        case 'a_encaisser':
        case 'hors_fenetre':
            return 'bg-warning';
        default:
            return 'bg-danger';
    }
}

export function ScanHistoryList({ recent, myEntries, myRefusals, refusalsByResult, loading = false, error = null }: ScanHistoryListProps) {
    const panelId = useId();
    const [open, setOpen] = useState(false);
    const summary = myEntries === null || myRefusals === null
        ? 'Vos chiffres sont en cours de lecture'
        : `Vous : ${formatInteger(myEntries)} entrée${myEntries > 1 ? 's' : ''}, ${formatInteger(myRefusals)} refus`;

    return (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((v) => !v)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <History size={18} aria-hidden="true" className="flex-shrink-0 text-fg-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-semibold text-fg">Derniers scans</span>
                    <span className="text-sm text-fg-muted">{summary}</span>
                </span>
                <ChevronDown size={18} aria-hidden="true" className={cn('flex-shrink-0 text-fg-muted transition-transform duration-200', open && 'rotate-180')} />
            </button>

            {open && (
                <div id={panelId} className="flex flex-col gap-3 px-4 pb-4">
                    {error && <p role="status" className="text-sm font-medium text-danger-fg">{error}</p>}
                    {refusalsByResult.length > 0 && (
                        <ul aria-label="Vos refus par motif" className="flex flex-wrap gap-2">
                            {refusalsByResult.map((r) => (
                                <li key={r.result} className="rounded-full border border-border bg-surface-sunken px-3 py-1 text-sm text-fg">
                                    {r.label} : <span className="font-semibold tabular-nums">{formatInteger(r.count)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {loading && recent.length === 0 ? (
                        <p className="text-sm text-fg-muted">Lecture de l’historique…</p>
                    ) : recent.length === 0 ? (
                        <p className="text-sm text-fg-muted">Aucun scan pour le moment sur cet événement.</p>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {recent.map((s) => (
                                <li key={s.scan_id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-sunken px-3 py-2">
                                    <span aria-hidden="true" className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', dotClass(s.result))} />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-semibold text-fg">{s.label}</span>
                                        <span className="truncate text-sm text-fg-muted tabular-nums">
                                            {[s.ticket_number, s.category, scanMethodLabel(s.method)].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                    <time dateTime={s.at} className="flex-shrink-0 text-sm text-fg-muted tabular-nums">{formatTime(s.at)}</time>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}
