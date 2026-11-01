'use client';

import React, { useState } from 'react';
import { CalendarClock, Download, FileSpreadsheet, Landmark, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { ErrorState } from '@/components/ui/EmptyState';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { apiErrorOf, errorMessage } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { DefinitionRow, PilotageSection } from './PilotageBlocks';
import { shiftStatusLabel, type PilotageClosing, type ZReport } from './types';

type Absent = NonNullable<PilotageClosing['absents']['list']>[number];

/** Finalités admises pour exporter le téléphone et l'email (liste fermée, décision du 31/10). */
const EXPORT_PURPOSES = [
    { value: 'URGENT_EVENT_INFO', label: 'Prévenir les participants d’un changement urgent (horaire, lieu, annulation)' },
    { value: 'SAFETY_AND_RECEPTION', label: 'Sécurité et accueil des participants le jour de l’événement' },
] as const;
type ExportPurpose = (typeof EXPORT_PURPOSES)[number]['value'];

const SOURCE_LABELS: Record<string, string> = { SCAN: 'Encaissé au scan', GUICHET: 'Vendu au guichet' };

const ABSENT_COLUMNS: DataColumn<Absent>[] = [
    { key: 'name', header: 'Participant', render: (a) => a.name },
    { key: 'category', header: 'Catégorie', render: (a) => a.category },
];

function signedFcfa(value: number | null): string {
    if (value === null) return 'Caisse ouverte';
    if (value === 0) return 'Aucun écart';
    return value > 0 ? `+${formatFcfa(value)}` : formatFcfa(value);
}

function ZCard({ z }: { z: ZReport }) {
    return (
        <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-base font-semibold text-fg">{z.controller_name || 'Compte sans nom'}</p>
                <p className="text-sm font-semibold text-fg-muted">{shiftStatusLabel(z.status)}</p>
            </div>
            <dl className="rounded-xl bg-surface-sunken px-3 py-1">
                <DefinitionRow label="Fonds de caisse (hors recettes)" value={formatFcfa(z.opening_float)} />
                <DefinitionRow label="Attendu" value={z.expected === null ? 'Non calculé' : formatFcfa(z.expected)} />
                <DefinitionRow label="Déclaré hors fonds" value={z.declared === null ? 'Pas encore' : formatFcfa(z.declared)} />
                <DefinitionRow label="Écart" value={signedFcfa(z.difference)} />
                <DefinitionRow label="Co-signature par PIN" value={z.pin_cosigned ? 'Oui' : 'Non'} />
            </dl>
            {z.justification && <p className="text-sm text-fg-muted">Justification : {z.justification}</p>}
            {z.by_source.length > 0 && (
                <div>
                    <p className="mb-1 text-sm font-semibold text-fg">Par source</p>
                    <dl className="px-1">
                        {z.by_source.map((s) => (
                            <DefinitionRow key={s.source} label={`${SOURCE_LABELS[s.source] ?? 'Autre source'} · ${formatInteger(s.count)} billet(s)`} value={formatFcfa(s.amount)} />
                        ))}
                    </dl>
                </div>
            )}
            {z.by_category.length > 0 && (
                <div>
                    <p className="mb-1 text-sm font-semibold text-fg">Par catégorie</p>
                    <dl className="px-1">
                        {z.by_category.map((c) => (
                            <DefinitionRow key={c.category_id} label={`${c.name} · ${formatInteger(c.count)} billet(s)`} value={formatFcfa(c.amount)} />
                        ))}
                    </dl>
                </div>
            )}
            {z.closed_at && (
                <p className="text-sm text-fg-muted">
                    Clôturée le <time dateTime={z.closed_at}>{formatDateTime(z.closed_at)}</time>
                </p>
            )}
        </li>
    );
}

function fileNameOf(res: Response): string {
    const header = res.headers.get('Content-Disposition') ?? '';
    const m = /filename="?([^";]+)"?/i.exec(header);
    return m ? m[1] : 'participants.csv';
}

/**
 * Onglet Clôture (contrat I) : absents (nombre en direct, liste après la fin), rapport de clôture, Z de
 * caisse par caisse, montant net et disponibilité des fonds (pilotage_closing) ; export CSV des
 * participants, journalisé par la base, sans donnée de paiement, contacts seulement pour une finalité de
 * la liste fermée.
 */
export function ClosingTab({ eventId, signal }: { eventId: string; signal: number }) {
    const toast = useToast();
    const { data, error, loading, refreshing, reload } = useServerData<PilotageClosing>(`/api/partner/events/${eventId}/pilotage/closing`, signal);
    const [includeContacts, setIncludeContacts] = useState(false);
    const [purpose, setPurpose] = useState<ExportPurpose | ''>('');
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [purposeError, setPurposeError] = useState(false);

    const exportCsv = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (includeContacts && !purpose) {
            setPurposeError(true);
            return;
        }
        setPurposeError(false);
        setExportError(null);
        setExporting(true);
        try {
            let res: Response;
            try {
                res = await fetch(`/api/partner/events/${eventId}/participants-export`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(includeContacts ? { includeContacts: true, purpose } : { includeContacts: false }),
                });
            } catch (netErr) {
                console.error('[clôture] export : réseau', netErr);
                throw new Error('Connexion impossible. Vérifiez votre réseau, puis réessayez.');
            }
            if (!res.ok) throw await apiErrorOf(res);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileNameOf(res);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Export téléchargé. Il est enregistré dans le journal des exports.');
        } catch (err) {
            setExportError(errorMessage(err, 'Export impossible pour le moment.'));
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4" role="status" aria-busy="true" aria-label="Chargement de la clôture">
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
            </div>
        );
    }
    if (error || !data) {
        return <ErrorState title="Clôture indisponible" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    }

    const { finance, report, absents } = data;
    const fundsFrom = finance.funds_available_from;
    const fundsTo = finance.funds_available_to;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Montant net organisateur" value={formatFcfa(finance.organizer_net)} hint="Ventes en ligne, commissions et remboursements déduits" tone="success" icon={<Landmark size={18} />} />
                <KpiCard
                    label="Disponibilité des fonds"
                    value={fundsFrom ? formatDateTime(fundsFrom) : 'Aucune vente en ligne'}
                    hint={fundsFrom && fundsTo && fundsTo !== fundsFrom ? `jusqu’au ${formatDateTime(fundsTo)} pour les dernières ventes` : 'Selon le délai de versement de la plateforme'}
                    tone="info"
                    icon={<CalendarClock size={18} />}
                />
                <KpiCard label="Absents" value={formatInteger(absents.count)} hint="Billets valides non compostés" tone="neutral" icon={<UserX size={18} />} />
            </div>

            <PilotageSection title="Rapport de clôture" description="Bilan de l’événement, mêmes définitions que l’aperçu.">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <dl className="rounded-2xl border border-border bg-surface px-4 py-1">
                        <DefinitionRow label="Billets vendus (hors invitations)" value={formatInteger(report.tickets.sold)} />
                        <DefinitionRow label="Invitations" value={formatInteger(report.tickets.invitations)} />
                        <DefinitionRow label="Capacité mise en vente" value={formatInteger(report.tickets.capacity)} />
                        <DefinitionRow label="Entrées (dont guichet)" value={`${formatInteger(report.entries.total)} (${formatInteger(report.entries.counter)})`} />
                        <DefinitionRow label="Refus au contrôle" value={formatInteger(report.entries.refused)} />
                    </dl>
                    <dl className="rounded-2xl border border-border bg-surface px-4 py-1">
                        <DefinitionRow label="Recettes en ligne" value={formatFcfa(report.revenue.online)} />
                        <DefinitionRow label="Recettes en espèces" value={formatFcfa(report.revenue.cash)} />
                        <DefinitionRow label="Remboursé" value={formatFcfa(report.revenue.refunded)} />
                        <DefinitionRow label="Frais de service payés par les acheteurs" value={formatFcfa(finance.buyer_service_fees)} />
                        <DefinitionRow label="Déjà disponible / en attente" value={`${formatFcfa(finance.available)} / ${formatFcfa(finance.pending)}`} />
                    </dl>
                </div>
            </PilotageSection>

            <PilotageSection title="Z de caisse" description="Une fiche par caisse : fonds, attendu, déclaré hors fonds et écart, détail par source et par catégorie.">
                {data.z.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucune caisse pour cet événement.</p>
                ) : (
                    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Z de caisse">
                        {data.z.map((z) => (
                            <ZCard key={z.shift_id} z={z} />
                        ))}
                    </ul>
                )}
            </PilotageSection>

            <PilotageSection
                title="Absents"
                description={absents.list_available ? 'Participants dont le billet valide n’a pas été composté.' : 'La liste nominative est disponible après la fin de l’événement ; le nombre est tenu à jour en direct.'}
            >
                {absents.list_available && absents.list && absents.list.length > 0 ? (
                    <DataList
                        items={absents.list}
                        columns={ABSENT_COLUMNS}
                        getKey={(a) => `${a.category_id}-${a.name}-${absents.list?.indexOf(a) ?? 0}`}
                        caption="Participants absents"
                        cardTitle={(a) => a.name}
                    />
                ) : (
                    <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
                        {absents.list_available ? 'Aucun absent : tous les billets valides ont été compostés.' : `${formatInteger(absents.count)} billet(s) valide(s) pas encore composté(s).`}
                    </p>
                )}
            </PilotageSection>

            <PilotageSection title="Export des participants" description="Fichier CSV : nom, catégorie, statut du billet et heure d’entrée. Aucune donnée de paiement ni numéro de billet.">
                <form onSubmit={(e) => void exportCsv(e)} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5" noValidate>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium text-fg">
                        <input
                            type="checkbox"
                            checked={includeContacts}
                            onChange={(e) => {
                                setIncludeContacts(e.target.checked);
                                if (!e.target.checked) {
                                    setPurpose('');
                                    setPurposeError(false);
                                }
                            }}
                            className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-border-strong accent-brand"
                        />
                        <span>
                            Inclure le téléphone et l’email des participants
                            <span className="block font-normal text-fg-muted">Seulement pour l’une des finalités ci-dessous. L’export et sa finalité sont journalisés.</span>
                        </span>
                    </label>

                    {includeContacts && (
                        <fieldset className="flex flex-col gap-2" aria-describedby={purposeError ? 'export-finalite-erreur' : undefined}>
                            <legend className="mb-1 text-sm font-semibold text-fg">Finalité de l’export</legend>
                            {EXPORT_PURPOSES.map((p) => (
                                <label key={p.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-sm text-fg">
                                    <input
                                        type="radio"
                                        name="export-finalite"
                                        value={p.value}
                                        checked={purpose === p.value}
                                        onChange={() => {
                                            setPurpose(p.value);
                                            setPurposeError(false);
                                        }}
                                        className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-brand"
                                    />
                                    <span>{p.label}</span>
                                </label>
                            ))}
                            {purposeError && (
                                <p id="export-finalite-erreur" className="text-sm font-medium text-danger-fg" role="alert">
                                    Choisissez la finalité de l’export des contacts.
                                </p>
                            )}
                        </fieldset>
                    )}

                    {exportError && (
                        <StatusBanner tone="danger" title="L’export n’a pas abouti" announce="alert">
                            {exportError}
                        </StatusBanner>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" variant="primary" leftIcon={<Download size={18} />} isLoading={exporting}>
                            Exporter les participants
                        </Button>
                        <span className="flex items-center gap-2 text-sm text-fg-muted">
                            <FileSpreadsheet size={16} aria-hidden="true" />
                            CSV compatible tableur (UTF-8)
                        </span>
                    </div>
                </form>
            </PilotageSection>
        </div>
    );
}
