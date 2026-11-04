'use client';

/**
 * En-tête compact du scanner (lot 7, tâche 7.2, contrat 6.2 ; décision D42) : événement contrôlé, porte et
 * compteur servi par le serveur (« Porte A : 312 entrées », sans porte : « Vos entrées : 12 »), état du
 * réseau, changement d'événement et déconnexion (seul bouton de déconnexion de l'écran de scan).
 * Le compteur est annoncé par une seule région role="status" (phrase complète, aria-atomic).
 */
import React from 'react';
import { ArrowLeftRight, LogOut, Wifi, WifiOff } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { formatInteger } from '@/lib/format';

export interface ScanStatusBarProps {
    eventTitle: string;
    /** « Porte A » ou « Vos entrées » (servi par GET /api/controller/scans). */
    doorLabel: string | null;
    /** Entrées acceptées de la porte (ou du contrôleur sans porte) ; null tant que le serveur n'a pas répondu. */
    doorEntries: number | null;
    online: boolean;
    /** Les chiffres n'ont pas pu être relus (affichés tels quels, marqués comme anciens). */
    statsStale?: boolean;
    onChangeEvent?: () => void;
    onLogout: () => void;
}

function entriesLabel(n: number): string {
    return `${formatInteger(n)} entrée${n > 1 ? 's' : ''}`;
}

export function ScanStatusBar({ eventTitle, doorLabel, doorEntries, online, statsStale = false, onChangeEvent, onLogout }: ScanStatusBarProps) {
    const counter = doorLabel && doorEntries !== null ? `${doorLabel} : ${entriesLabel(doorEntries)}` : 'Compteur en cours de lecture…';
    return (
        <header className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col">
                <h1 className="truncate text-base font-semibold leading-snug text-fg">{eventTitle}</h1>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-fg">
                    <span role="status" aria-atomic="true" className="font-semibold tabular-nums">
                        {counter}{statsStale ? ' (non actualisé)' : ''}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 font-semibold', online ? 'text-success-fg' : 'text-danger-fg')}>
                        {online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
                        {online ? 'En ligne' : 'Hors ligne'}
                    </span>
                </p>
            </div>
            {onChangeEvent && (
                <IconButton aria-label="Changer d’événement" variant="secondary" onClick={onChangeEvent}>
                    <ArrowLeftRight size={18} />
                </IconButton>
            )}
            <IconButton aria-label="Se déconnecter" variant="danger" onClick={onLogout}>
                <LogOut size={18} />
            </IconButton>
        </header>
    );
}
