'use client';

/**
 * Écran « Commencer le contrôle » (lot 7, tâche 7.2 ; décision D49) : choix de l'événement, rappel de la
 * porte, puis un seul bouton. Ce premier toucher donne au navigateur l'activation de l'utilisateur qui
 * autorise la vibration (Chrome Android) et ouvre la caméra ; ensuite, aucun clic pour enchaîner les
 * billets. Cibles de 44 px au moins, action principale en bas, à portée de pouce.
 */
import React, { useId } from 'react';
import { DoorOpen, Play, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

export interface StartChoice {
    id: string;
    title: string;
    /** Date et heure déjà formatées (lib/format). */
    dateLabel: string;
    location?: string | null;
    /** Libellé d'un événement fermé au contrôle (« Terminé »…), sinon null. */
    closedLabel: string | null;
    entryPoint: string | null;
}

export interface ScannerStartScreenProps {
    choices: StartChoice[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onStart: () => void;
    controllerName?: string;
}

export function ScannerStartScreen({ choices, selectedId, onSelect, onStart, controllerName }: ScannerStartScreenProps) {
    const groupName = useId();
    const legendId = useId();
    const selected = choices.find((c) => c.id === selectedId) ?? null;

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

            {selected && (
                <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface-sunken p-3 text-sm text-fg">
                    <DoorOpen size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-fg-muted" />
                    <span>
                        {selected.entryPoint
                            ? <>Votre porte : <strong>{selected.entryPoint}</strong>. Le compteur affichera les entrées de cette porte.</>
                            : <>Aucune porte ne vous est attribuée : le compteur affichera vos propres entrées.</>}
                        {' '}Le téléphone vibre à chaque résultat ; aucun son n’est émis.
                    </span>
                </p>
            )}

            <Button variant="primary" size="lg" fullWidth disabled={!selected} onClick={onStart} leftIcon={<Play size={18} />}>
                Commencer le contrôle
            </Button>
        </div>
    );
}
