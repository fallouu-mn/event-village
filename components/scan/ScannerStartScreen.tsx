'use client';

/**
 * Écran « Commencer le contrôle » (lot 7, tâche 7.2 ; décision D49) : choix de l'événement, rappel de la
 * porte, puis un seul bouton. Ce premier toucher donne au navigateur l'activation de l'utilisateur qui
 * autorise la vibration (Chrome Android) et ouvre la caméra ; ensuite, aucun clic pour enchaîner les
 * billets. Cibles de 44 px au moins, action principale en bas, à portée de pouce.
 * Lot 9 ter (9t.15, contrat C.1.4) : sur un événement à zones, porte, zone et type de zone de l'affectation ; sans porte,
 * bandeau « Aucune porte attribuée » (le bouton reste actif : le serveur décide) ; « Changer de porte » quand
 * l'organisateur l'autorise (GET /api/controller/gates, POST /api/controller/gate). Sans zone : textes du lot 7.
 */
import React, { useEffect, useId, useState } from 'react';
import { DoorOpen, Play, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { ZONE_KIND_LABELS, type ZoneKind } from '@/lib/scan/scan-result';

export interface StartChoice {
    id: string;
    title: string;
    /** Date et heure déjà formatées (lib/format). */
    dateLabel: string;
    location?: string | null;
    /** Libellé d'un événement fermé au contrôle (« Terminé »…), sinon null. */
    closedLabel: string | null;
    entryPoint: string | null;
    /** Lot 9 ter : événement, porte de l'affectation (zone et type), zones configurées, droit de changer de porte. */
    eventId?: string;
    zonesConfigured?: boolean;
    gateLabel?: string | null;
    zoneLabel?: string | null;
    zoneKind?: ZoneKind | null;
    gateChangeAllowed?: boolean;
}

interface GateOption { id: string; name: string; zone: { name: string; kind: ZoneKind } }

/** « Choisir ma porte » : portes de l'événement lues sur le serveur, choix enregistré par lui (droit compris). */
function GatePicker({ eventId, onClose, onChanged }: { eventId: string; onClose: () => void; onChanged: () => void }) {
    const toast = useToast();
    const name = useId();
    const [gates, setGates] = useState<GateOption[] | null>(null);
    const [choice, setChoice] = useState('');
    const [problem, setProblem] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const call = async (url: string, init?: RequestInit): Promise<Record<string, unknown>> => {
        const res = await fetch(url, { cache: 'no-store', ...init });
        const body = (await res.json().catch((err: unknown) => {
            console.warn(`[scanner] ${url} : réponse HTTP ${res.status} illisible`, err instanceof Error ? err.message : String(err));
            return {};
        })) as Record<string, unknown>;
        if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Portes momentanément indisponibles : réessayez.');
        return body;
    };
    useEffect(() => {
        call(`/api/controller/gates?eventId=${encodeURIComponent(eventId)}`)
            .then((b) => setGates(Array.isArray(b.gates) ? (b.gates as GateOption[]) : []))
            .catch((err: unknown) => {
                console.warn('[scanner] portes non lues :', err instanceof Error ? err.message : String(err));
                setProblem(err instanceof Error ? err.message : String(err));
                setGates([]);
            });
    }, [eventId]);
    const save = async (): Promise<void> => {
        setBusy(true);
        setProblem(null);
        try {
            const b = await call('/api/controller/gate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, gateId: choice }),
            });
            const gate = b.gate as { name?: string } | null;
            toast.success(`Votre porte : ${gate?.name ?? gates?.find((g) => g.id === choice)?.name ?? ''}.`);
            onChanged();
            onClose();
        } catch (err) {
            console.warn('[scanner] porte non changée :', err instanceof Error ? err.message : String(err));
            setProblem(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title="Choisir ma porte" busy={busy} maxWidth="md"
            footer={<Button variant="primary" onClick={() => void save()} isLoading={busy} disabled={!choice}>Enregistrer cette porte</Button>}>
            <div className="flex flex-col gap-2">
                {problem && <StatusBanner tone="danger" title="Porte non changée" announce="alert">{problem}</StatusBanner>}
                {gates === null ? <p role="status" className="text-sm text-fg-muted">Lecture des portes…</p> : (
                    <fieldset className="flex flex-col gap-2">
                        <legend className="sr-only">Portes de l’événement</legend>
                        {gates.map((g) => (
                            <label key={g.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 text-base text-fg">
                                <input type="radio" name={name} value={g.id} checked={choice === g.id} onChange={() => setChoice(g.id)}
                                    className="h-5 w-5 flex-shrink-0 cursor-pointer accent-brand" />
                                {`${g.name} · ${g.zone.name} (${ZONE_KIND_LABELS[g.zone.kind] ?? g.zone.kind})`}
                            </label>
                        ))}
                    </fieldset>
                )}
            </div>
        </Modal>
    );
}

export interface ScannerStartScreenProps {
    choices: StartChoice[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onStart: () => void;
    controllerName?: string;
    /** Porte changée par le contrôleur : affectations à relire. */
    onGateChanged?: () => void;
}

export function ScannerStartScreen({ choices, selectedId, onSelect, onStart, controllerName, onGateChanged }: ScannerStartScreenProps) {
    const groupName = useId();
    const legendId = useId();
    const [picking, setPicking] = useState(false);
    const selected = choices.find((c) => c.id === selectedId) ?? null;
    const zoned = selected?.zonesConfigured === true;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
                    <ScanLine size={22} />
                </span>
                <div className="min-w-0">
                    <h1 className="text-xl font-bold leading-tight text-fg">Commencer le contrôle</h1>
                    <p className="text-sm leading-relaxed text-fg-muted">
                        {controllerName ? `${controllerName}, choisissez` : 'Choisissez'} l’événement, vérifiez votre porte, puis lancez la caméra.
                    </p>
                </div>
            </div>

            <fieldset aria-labelledby={legendId} className="flex flex-col gap-2">
                <legend id={legendId} className="mb-1 text-sm font-semibold text-fg">Événement à contrôler</legend>
                {choices.map((c) => {
                    const checked = c.id === selectedId;
                    const inputId = `${groupName}-${c.id}`;
                    return (
                        <label
                            key={c.id}
                            htmlFor={inputId}
                            className={cn(
                                'flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border-2 bg-surface p-3 transition-colors duration-200',
                                checked ? 'border-brand-fg' : 'border-border hover:border-border-strong',
                            )}
                        >
                            <input
                                id={inputId}
                                type="radio"
                                name={groupName}
                                value={c.id}
                                checked={checked}
                                onChange={() => onSelect(c.id)}
                                className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="break-words text-base font-semibold text-fg">{c.title}</span>
                                <span className="text-sm text-fg-muted">{[c.dateLabel, c.location].filter(Boolean).join(' · ')}</span>
                                {c.closedLabel && <span className="text-sm font-semibold text-warning-fg">{c.closedLabel} : contrôle fermé</span>}
                            </span>
                        </label>
                    );
                })}
            </fieldset>

            {zoned && !selected?.gateLabel && (
                <StatusBanner tone="warning" title="Aucune porte attribuée">
                    Cet événement a des portes : demandez à l’organisateur de vous en attribuer une avant de scanner.
                </StatusBanner>
            )}

            {selected && (!zoned || selected.gateLabel) && (
                <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface-sunken p-3 text-sm text-fg">
                    <DoorOpen size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-fg-muted" />
                    <span>
                        {zoned
                            ? <>Votre porte : <strong>{selected.gateLabel}</strong> · {selected.zoneLabel} ({ZONE_KIND_LABELS[selected.zoneKind === 'CONTROLE' ? 'CONTROLE' : 'ENTREE']}). Le compteur affichera les {selected.zoneKind === 'CONTROLE' ? 'contrôles' : 'entrées'} de cette porte.</>
                            : selected.entryPoint
                            ? <>Votre porte : <strong>{selected.entryPoint}</strong>. Le compteur affichera les entrées de cette porte.</>
                            : <>Aucune porte ne vous est attribuée : le compteur affichera vos propres entrées.</>}
                        {' '}Le téléphone vibre à chaque résultat ; aucun son n’est émis.
                    </span>
                </p>
            )}

            {zoned && selected?.gateChangeAllowed && selected.eventId && (
                <Button variant="secondary" fullWidth leftIcon={<DoorOpen size={18} />} onClick={() => setPicking(true)}>Changer de porte</Button>
            )}

            <Button variant="primary" size="lg" fullWidth disabled={!selected} onClick={onStart} leftIcon={<Play size={18} />}>
                Commencer le contrôle
            </Button>

            {picking && selected?.eventId && (
                <GatePicker eventId={selected.eventId} onClose={() => setPicking(false)} onChanged={() => onGateChanged?.()} />
            )}
        </div>
    );
}
