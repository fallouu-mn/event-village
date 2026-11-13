import React from 'react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { formatDateTime, formatInteger, formatTime } from '@/lib/format';
import { scanReasonLabel } from '@/lib/scan/scan-result';
import { BarList, PilotageSection } from './PilotageBlocks';
import {
    dakarLocalToIso,
    formatPerMinute,
    type EntriesGateRow,
    type EntriesGuestList,
    type EntriesLive,
    type EntriesViews,
    type EntriesZoneRow,
} from './types';

type GuestRow = EntriesGuestList['items'][number];

/** « 12 entrés sur 30 » (accord au singulier pour 0 et 1). */
function enteredOf(entered: number, expected: number): string {
    return entered > 1
        ? `${formatInteger(entered)} entrés sur ${formatInteger(expected)}`
        : `${formatInteger(entered)} entré sur ${formatInteger(expected)}`;
}

/** Zone de contrôle : « 21 contrôlés sur 30 entrés ». */
function checkedOf(checked: number, entered: number): string {
    const tail = entered > 1 ? 'entrés' : 'entré';
    return checked > 1
        ? `${formatInteger(checked)} contrôlés sur ${formatInteger(entered)} ${tail}`
        : `${formatInteger(checked)} contrôlé sur ${formatInteger(entered)} ${tail}`;
}

function refusedDetail(refused: number): string | undefined {
    return refused > 0 ? `${formatInteger(refused)} refus` : undefined;
}

interface ShareItem {
    key: string;
    label: React.ReactNode;
    /** Valeur écrite en toutes lettres (la barre ne fait que la doubler). */
    text: string;
    part: number;
    /** Base de la barre (attendus) ; null : pas de barre remplie. */
    whole: number | null;
    detail?: React.ReactNode;
}

/**
 * Part de chaque ligne sur sa propre base (entrés sur attendus), servie par la base : rien n'est additionné ici. Même
 * dessin que BarList, dont l'échelle est commune à toutes les lignes et la valeur un seul nombre.
 */
function ShareList({ items, emptyLabel, ariaLabel }: { items: ShareItem[]; emptyLabel: string; ariaLabel: string }) {
    if (items.length === 0) {
        return <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">{emptyLabel}</p>;
    }
    return (
        <ul aria-label={ariaLabel} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            {items.map((item) => {
                const width = item.whole !== null && item.whole > 0 ? Math.min(100, (item.part / item.whole) * 100) : 0;
                return (
                    <li key={item.key} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                            <span className="min-w-0 break-words text-fg">{item.label}</span>
                            <span className="font-semibold text-fg tabular-nums">{item.text}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${width}%` }} />
                        </div>
                        {item.detail && <p className="text-sm text-fg-muted">{item.detail}</p>}
                    </li>
                );
            })}
        </ul>
    );
}

function zoneItem(z: EntriesZoneRow, index: number): ShareItem {
    const key = z.zone_id ?? `sans-zone-${index}`;
    if (z.zone_id === null && z.kind === null) {
        const entered = z.entered ?? 0;
        return {
            key,
            label: 'Zone non précisée',
            text: entered > 1 ? `${formatInteger(entered)} entrés` : `${formatInteger(entered)} entré`,
            part: entered,
            whole: null,
            detail: (
                <>
                    Entrées enregistrées avant la création des zones
                    {z.refused > 0 && <>{' · '}{refusedDetail(z.refused)}</>}
                </>
            ),
        };
    }
    if (z.kind === 'CONTROLE') {
        const checked = z.checked ?? 0;
        const entered = z.expected ?? 0;
        // Lot 9 quater (E2 : AUD-14) : chaque nouveau passage confirmé est compté et dit
        const repeats = z.repeats ?? 0;
        const repeatText = repeats > 0 ? `${formatInteger(repeats)} passage${repeats > 1 ? 's' : ''} répété${repeats > 1 ? 's' : ''}` : undefined;
        const detail = [refusedDetail(z.refused), repeatText].filter(Boolean).join(' · ') || undefined;
        return { key, label: `${z.name} (contrôle de zone)`, text: checkedOf(checked, entered), part: checked, whole: entered, detail };
    }
    const entered = z.entered ?? 0;
    const expected = z.expected ?? 0;
    return { key, label: z.name, text: enteredOf(entered, expected), part: entered, whole: expected, detail: refusedDetail(z.refused) };
}

function gateColumns(configured: boolean, live: boolean): DataColumn<EntriesGateRow>[] {
    const columns: DataColumn<EntriesGateRow>[] = [
        {
            key: 'name',
            header: configured ? 'Porte' : 'Point d’entrée',
            hideOnCard: true,
            render: (g) => <span className="font-semibold">{g.name || 'Point d’entrée non précisé'}</span>,
        },
    ];
    if (configured) {
        columns.push({ key: 'zone', header: 'Zone', render: (g) => g.zone_name || <span className="text-fg-muted">Non précisée</span> });
    }
    columns.push(
        { key: 'accepted', header: 'Entrées', align: 'right', render: (g) => formatInteger(g.accepted) },
        { key: 'refused', header: 'Refus', align: 'right', render: (g) => formatInteger(g.refused) },
    );
    if (live) {
        columns.push(
            { key: 'rate', header: 'Débit', align: 'right', render: (g) => formatPerMinute(g.rate_per_minute) },
            {
                key: 'controllers',
                header: 'Contrôleurs',
                align: 'right',
                render: (g) => {
                    const active = g.controllers_active ?? 0;
                    return `${formatInteger(active)} ${active > 1 ? 'actifs' : 'actif'} sur ${formatInteger(g.controllers_assigned)}`;
                },
            },
        );
    }
    return columns;
}

function guestColumns(ownerView: boolean): DataColumn<GuestRow>[] {
    const columns: DataColumn<GuestRow>[] = [
        {
            key: 'at',
            header: 'Heure',
            hideOnCard: true,
            render: (r) => <time dateTime={r.at} className="font-semibold tabular-nums">{formatTime(r.at)}</time>,
        },
    ];
    if (ownerView) {
        columns.push({ key: 'guest', header: 'Invité', render: (r) => r.guest_name || <span className="text-fg-muted">Nom non renseigné</span> });
    }
    columns.push(
        { key: 'category', header: 'Catégorie', render: (r) => r.category || 'Catégorie inconnue' },
        { key: 'gate', header: 'Porte', render: (r) => r.gate || <span className="text-fg-muted">Point d’entrée non précisé</span> },
        { key: 'controller', header: 'Contrôleur', render: (r) => r.controller },
    );
    return columns;
}

/**
 * Lot 9 ter (9t.18) : vues figées des entrées (pilotage_compute_entries), rendues par l'onglet Entrées (avec `live`)
 * et par le rapport de clôture (sans `live`, `ownerView` faux : jamais de nom d'invité). Tous les nombres viennent de
 * la base ; l'écran ne fait que les écrire.
 */
export function EntriesBreakdown({ views, live, ownerView }: { views: EntriesViews; live?: EntriesLive; ownerView: boolean }) {
    const gates = gateColumns(views.configured, live !== undefined);
    const guests = guestColumns(ownerView);
    const maxQuarter = Math.max(0, ...views.by_quarter.map((q) => q.accepted));
    const maxRefusal = Math.max(0, ...views.refusals_by_reason.map((r) => r.count));

    return (
        <div className="flex flex-col gap-6">
            {views.configured && (
                <PilotageSection
                    title="Par zone"
                    description="Entrés sur attendus. Les attendus sont les billets des catégories admises dans la zone : une catégorie admise dans deux zones compte dans les deux."
                >
                    <ShareList ariaLabel="Entrées par zone" emptyLabel="Aucune zone." items={views.by_zone.map(zoneItem)} />
                </PilotageSection>
            )}

            <PilotageSection title={views.configured ? 'Par porte' : 'Par point d’entrée'}>
                <DataList
                    items={views.by_gate}
                    columns={gates}
                    getKey={(g) => g.gate_key}
                    caption={views.configured ? 'Entrées par porte' : 'Entrées par point d’entrée'}
                    cardTitle={(g) => gates[0].render(g)}
                    empty={<p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucune entrée pour le moment.</p>}
                />
            </PilotageSection>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PilotageSection title="Par catégorie">
                    <ShareList
                        ariaLabel="Entrées par catégorie"
                        emptyLabel="Aucune catégorie."
                        items={views.by_category.map((c) => ({
                            key: c.category_id,
                            label: c.name,
                            text: enteredOf(c.accepted, c.expected),
                            part: c.accepted,
                            whole: c.expected,
                        }))}
                    />
                </PilotageSection>
                <PilotageSection title="Par origine">
                    <ShareList
                        ariaLabel="Entrées par origine"
                        emptyLabel="Aucun billet."
                        items={views.by_origin.map((o) => ({
                            key: o.origin,
                            label: o.label,
                            text: enteredOf(o.entered, o.expected),
                            part: o.entered,
                            whole: o.expected,
                        }))}
                    />
                </PilotageSection>
                <PilotageSection title="Flux par quart d’heure" description="Heure de Dakar.">
                    <BarList
                        ariaLabel="Entrées par quart d’heure"
                        unit={['entrée', 'entrées']}
                        max={maxQuarter}
                        emptyLabel="Aucun passage pour le moment."
                        items={views.by_quarter.map((q) => {
                            const iso = dakarLocalToIso(q.start);
                            return {
                                key: q.start,
                                label: iso ? <time dateTime={iso}>{formatDateTime(iso)}</time> : 'Horaire inconnu',
                                value: q.accepted,
                                detail: refusedDetail(q.refused),
                            };
                        })}
                    />
                </PilotageSection>
                <PilotageSection title="Refus par motif">
                    <BarList
                        ariaLabel="Refus par motif"
                        unit="refus"
                        max={maxRefusal}
                        emptyLabel="Aucun refus."
                        items={views.refusals_by_reason.map((r) => ({ key: r.result, label: r.label || scanReasonLabel(r.result), value: r.count }))}
                    />
                </PilotageSection>
            </div>

            <PilotageSection
                title="Validations par la liste des invités"
                description="Entrées validées par un contrôleur avec la liste des invités, pièce d’identité vérifiée."
            >
                <DataList
                    items={views.guest_list.items}
                    columns={guests}
                    getKey={(r) => r.scan_id}
                    caption="Entrées validées par la liste des invités"
                    cardTitle={(r) => guests[0].render(r)}
                    empty={<p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucune entrée validée par la liste des invités.</p>}
                />
            </PilotageSection>
        </div>
    );
}
