'use client';

/**
 * Finition 2b (C, E-24) — écran « Vérifier avant d'envoyer » du formulaire d'événement : ce qui manque pour l'envoi en
 * tête (chaque manque mène à son étape), puis le récapitulatif de chaque étape avec « Modifier ». Les manques viennent de
 * submissionMissing (lib/events/submission-check.ts : règles et textes de la base à la soumission). Les boutons
 * « Enregistrer le brouillon » et « Envoyer pour validation » sont ceux de la barre du formulaire.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatFcfa, formatInteger } from '@/lib/format';
import { SCAN_CATEGORY_COLOR_LABELS, isScanCategoryColor } from '@/lib/scan/scan-result';
import type { MissingItem } from '@/lib/events/submission-check';
import { ScanColorDot } from './ScanColorPicker';
import { SINGLE_ENTRANCE_TEXT } from './ZoneListEditor';

export type ReviewStep = 'infos' | 'programme' | 'acces' | 'billetterie' | 'controle';

export interface ReviewData {
    title: string;
    typeLabel: string;
    start: string;
    end: string;
    location: string;
    city: string;
    capacity: number | null;
    hasPoster: boolean;
    programLines: number;
    hasPosition: boolean;
    address: string;
    contactPhone: string;
    categories: Array<{ name: string; price: number | null; total: number | null; active: boolean; color: string; instruction: string }>;
    /** null : une seule entrée. */
    zones: Array<{ name: string; kindLabel: string; categories: string[]; gates: string[] }> | null;
}

interface EventReviewProps {
    data: ReviewData;
    missing: MissingItem[];
    /** L'envoi pour validation est possible ici (création, brouillon). */
    canSend: boolean;
    onEdit: (step: ReviewStep) => void;
    onFix: (item: MissingItem) => void;
}

const STEP_TITLES: Record<ReviewStep, string> = {
    infos: 'Informations',
    programme: 'Programme',
    acces: 'Accès',
    billetterie: 'Billets',
    controle: 'Contrôle à l’entrée',
};

function Section({ index, step, children, onEdit }: { index: number; step: ReviewStep; children: React.ReactNode; onEdit: (step: ReviewStep) => void }) {
    const id = `ev-revue-${step}`;
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={id} className="text-base font-semibold text-foreground-strong">{`${index}. ${STEP_TITLES[step]}`}</h3>
                <Button type="button" variant="secondary" size="sm" leftIcon={<Pencil size={16} />} onClick={() => onEdit(step)}
                    aria-label={`Modifier : ${STEP_TITLES[step]}`}>
                    Modifier
                </Button>
            </div>
            {children}
        </section>
    );
}

function Rows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
    return (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
            {rows.map(([label, value]) => (
                <React.Fragment key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words font-medium text-foreground-strong">{value}</dd>
                </React.Fragment>
            ))}
        </dl>
    );
}

const orNone = (s: string, none = 'Non précisé') => (s.trim() === '' ? none : s);

export function EventReview({ data, missing, canSend, onEdit, onFix }: EventReviewProps) {
    return (
        <div className="flex flex-col gap-5">
            {canSend && (missing.length > 0 ? (
                <div role="status" className="flex flex-col gap-2 rounded-2xl border border-warning-border bg-warning-soft p-4">
                    <p className="flex items-start gap-2 text-base font-semibold tabular-nums text-warning-text">
                        <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        {missing.length > 1 ? `${formatInteger(missing.length)} points à compléter avant d’envoyer` : 'Un point à compléter avant d’envoyer'}
                    </p>
                    <ul className="flex flex-col gap-1">
                        {missing.map((m) => (
                            <li key={`${m.field}-${m.message}`}>
                                <button type="button" onClick={() => onFix(m)}
                                    className="min-h-11 cursor-pointer text-left text-sm font-medium text-warning-text underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    {`${m.message} (étape ${STEP_TITLES[m.step]})`}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p role="status" className="flex items-start gap-2 rounded-2xl border border-success-border bg-success-soft p-4 text-base font-semibold text-success-text">
                    <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    Tout est prêt : vous pouvez envoyer l’événement pour validation.
                </p>
            ))}

            <Section index={1} step="infos" onEdit={onEdit}>
                <Rows rows={[
                    ['Titre', orNone(data.title)],
                    ['Type d’événement', orNone(data.typeLabel, 'Non choisi')],
                    ['Début', orNone(data.start)],
                    ['Fin', orNone(data.end)],
                    ['Lieu', `${orNone(data.location)}, ${orNone(data.city)}`],
                    ['Capacité', data.capacity === null ? 'Non précisée' : <span className="tabular-nums">{`${formatInteger(data.capacity)} places`}</span>],
                    ['Affiche', data.hasPoster ? 'Déposée' : 'Aucune affiche'],
                ]} />
            </Section>

            <Section index={2} step="programme" onEdit={onEdit}>
                <p className="text-sm text-foreground-strong">
                    {data.programLines === 0
                        ? 'Aucune ligne de programme (facultatif).'
                        : <span className="tabular-nums">{data.programLines > 1 ? `${formatInteger(data.programLines)} lignes de programme.` : '1 ligne de programme.'}</span>}
                </p>
            </Section>

            <Section index={3} step="acces" onEdit={onEdit}>
                <Rows rows={[
                    ['Repère sur la carte', data.hasPosition ? 'Placé' : 'Non placé'],
                    ['Adresse précise', orNone(data.address)],
                    ['Téléphone de contact', orNone(data.contactPhone)],
                ]} />
            </Section>

            <Section index={4} step="billetterie" onEdit={onEdit}>
                {data.categories.length === 0 ? (
                    <p className="text-sm text-foreground-strong">Aucune catégorie de billets.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {data.categories.map((c, i) => (
                            <li key={`${c.name}-${i}`} className="flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2 text-sm">
                                <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground-strong">
                                    <ScanColorDot color={c.color} />
                                    <span className="min-w-0 break-words">{c.name.trim() || `Catégorie ${i + 1}`}</span>
                                    {!c.active && <span className="font-normal text-muted-foreground">· vente fermée</span>}
                                </span>
                                <span className="tabular-nums text-muted-foreground">
                                    {[
                                        c.price === null ? 'Prix à préciser' : c.price === 0 ? 'Gratuit' : formatFcfa(c.price),
                                        c.total === null ? 'quantité à préciser' : `${formatInteger(c.total)} ${c.total > 1 ? 'billets' : 'billet'}`,
                                        isScanCategoryColor(c.color) ? `couleur ${SCAN_CATEGORY_COLOR_LABELS[c.color].toLowerCase()}` : null,
                                    ].filter(Boolean).join(' · ')}
                                </span>
                                {c.instruction.trim() !== '' && <span className="text-foreground-strong">{`Consigne : ${c.instruction.trim()}`}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section index={5} step="controle" onEdit={onEdit}>
                {data.zones === null ? (
                    <p className="text-sm text-foreground-strong">{SINGLE_ENTRANCE_TEXT}</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {data.zones.map((z, i) => (
                            <li key={`${z.name}-${i}`} className="flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2 text-sm">
                                <span className="font-semibold text-foreground-strong">{`${z.name.trim() || `Zone ${i + 1}`} · ${z.kindLabel}`}</span>
                                <span className="text-muted-foreground">{`Laisse entrer : ${z.categories.length > 0 ? z.categories.join(', ') : 'aucune catégorie'}`}</span>
                                <span className="text-muted-foreground">{`${z.gates.length > 1 ? 'Portes' : 'Porte'} : ${z.gates.length > 0 ? z.gates.join(', ') : 'aucune'}`}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
}
