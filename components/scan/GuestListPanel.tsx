'use client';

/**
 * Lot 9 ter (9t.17, consigne 3, contrat C.3.5) — liste des invités du scanner : un invité sans smartphone, dont
 * l'invitation n'est pas encore acceptée dans l'application, est retrouvé par les 4 derniers chiffres (ou le numéro
 * complet) de son téléphone, puis validé une personne à la fois après vérification de sa pièce d'identité.
 *
 * Chargé à la demande (next/dynamic) depuis le scanner : il ne pèse pas sur son ouverture. La recherche passe par
 * POST /api/controller/scan/guests (droit, périmètre de l'événement, quota de 30 recherches par heure et journal décidés
 * par le serveur ; la réponse ne contient aucun numéro) ; chaque recherche est enregistrée au nom du contrôleur. La
 * validation passe par la voie unique du scan (`onAdmit` : guestTicketId, pièce vérifiée, porte) : le verdict s'affiche en
 * plein écran avec sa vibration, comme un QR. Aucune suggestion pendant la saisie (chaque recherche compte dans le quota).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatInteger } from '@/lib/format';
import type { ScanOutcome } from './scan-client';

export const GUEST_SEARCH_ENDPOINT = '/api/controller/scan/guests';

interface GuestGroup { guest_name: string | null; category: string; ticket_count: number; ticket_ids: string[] }

export interface GuestListPanelProps {
    eventId: string;
    /** Porte de l'affectation (événement à zones) ; absente sans zone. */
    gateId?: string | null;
    /** Validation d'un billet par la voie du scan (clé neuve) ; rend le verdict, ou null si rien n'est parti. */
    onAdmit: (guestTicketId: string) => Promise<ScanOutcome | null>;
    onClose: () => void;
    /** Session expirée (401). */
    onSessionExpired: () => void;
}

function tickets(n: number): string {
    return `${formatInteger(n)} billet${n > 1 ? 's' : ''}`;
}

export function GuestListPanel({ eventId, gateId, onAdmit, onClose, onSessionExpired }: GuestListPanelProps) {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const [found, setFound] = useState<{ items: GuestGroup[]; truncated: boolean } | null>(null);
    /** Invité choisi et rang du prochain billet à valider. */
    const [chosen, setChosen] = useState<{ guest: GuestGroup; next: number } | null>(null);
    const [verified, setVerified] = useState(false);
    const [admitting, setAdmitting] = useState(false);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const queryRef = useRef<HTMLInputElement>(null);

    // Confirmation : focus sur son titre (une personne à la fois)
    useEffect(() => {
        if (chosen) titleRef.current?.focus();
    }, [chosen]);

    const search = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        const q = query.trim();
        if (!q || searching) return;
        setSearching(true);
        setProblem(null);
        setFound(null);
        try {
            const res = await fetch(GUEST_SEARCH_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gateId === undefined ? { eventId, query: q } : { eventId, query: q, gateId }),
                cache: 'no-store',
            });
            if (res.status === 401) {
                onSessionExpired();
                return;
            }
            let body: Record<string, unknown> = {};
            try {
                body = (await res.json()) as Record<string, unknown>;
            } catch (err) {
                console.warn(`[liste des invités] réponse HTTP ${res.status} illisible`, err instanceof Error ? err.message : String(err));
            }
            if (!res.ok || !Array.isArray(body.items)) {
                setProblem(typeof body.error === 'string' ? body.error : 'Liste des invités momentanément indisponible. Réessayez.');
                return;
            }
            setFound({ items: body.items as GuestGroup[], truncated: body.truncated === true });
        } catch (err) {
            console.warn('[liste des invités] recherche : réseau indisponible', err instanceof Error ? err.message : String(err));
            setProblem('Réseau indisponible : réessayez la recherche.');
        } finally {
            setSearching(false);
        }
    };

    const backToSearch = (clear: boolean): void => {
        setChosen(null);
        setVerified(false);
        if (clear) {
            setQuery('');
            setFound(null);
        }
        setTimeout(() => queryRef.current?.focus(), 0);
    };

    const admit = async (): Promise<void> => {
        if (!chosen || !verified || admitting) return;
        const ticketId = chosen.guest.ticket_ids[chosen.next];
        if (!ticketId) return;
        setAdmitting(true);
        try {
            const outcome = await onAdmit(ticketId);
            if (outcome?.result !== 'valid' || outcome.failure) return;
            const next = chosen.next + 1;
            // Billet suivant du même invité, sans nouvelle recherche ; sinon retour à la recherche, champ vidé
            if (next < chosen.guest.ticket_ids.length) {
                setChosen({ guest: chosen.guest, next });
                setVerified(false);
            } else {
                backToSearch(true);
            }
        } finally {
            setAdmitting(false);
        }
    };

    if (chosen) {
        const left = chosen.guest.ticket_ids.length - chosen.next;
        return (
            <section aria-labelledby="liste-invites-confirmation" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
                <h2 id="liste-invites-confirmation" ref={titleRef} tabIndex={-1} className="break-words text-4xl font-black leading-tight text-fg focus-visible:outline-none">
                    {chosen.guest.guest_name || 'Invité sans nom'}
                </h2>
                <p className="text-lg font-semibold text-fg">{chosen.guest.category}</p>
                <p className="text-base font-semibold tabular-nums text-fg">{tickets(chosen.guest.ticket_count)}</p>
                {chosen.next > 0 && (
                    <p role="status" className="text-base font-semibold tabular-nums text-fg">
                        {left > 1 ? `Encore ${formatInteger(left)} billets pour cet invité.` : 'Encore 1 billet pour cet invité.'}
                    </p>
                )}
                <StatusBanner tone="warning" title="Vérifiez la pièce d’identité">
                    Comparez le nom avec la pièce d’identité de la personne avant de valider.
                </StatusBanner>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold text-fg">
                    <input
                        type="checkbox"
                        required
                        checked={verified}
                        onChange={(e) => setVerified(e.target.checked)}
                        className="h-6 w-6 flex-shrink-0 cursor-pointer rounded border-border-strong accent-brand"
                    />
                    J’ai vérifié la pièce d’identité
                </label>
                <Button variant="primary" size="lg" fullWidth leftIcon={<UserCheck size={18} />} disabled={!verified} isLoading={admitting} onClick={() => void admit()}>
                    Valider l’entrée d’une personne
                </Button>
                <Button variant="ghost" fullWidth leftIcon={<ArrowLeft size={18} />} disabled={admitting} onClick={() => backToSearch(false)}>
                    Retour à la liste
                </Button>
            </section>
        );
    }

    return (
        <section aria-labelledby="liste-invites-titre" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-col gap-1">
                <h2 id="liste-invites-titre" className="text-xl font-bold text-fg">Liste des invités</h2>
                <p className="text-sm leading-relaxed text-fg-muted">
                    Invitations pas encore acceptées dans l’application. Saisissez les 4 derniers chiffres ou le numéro complet.
                </p>
            </div>
            <form onSubmit={(e) => void search(e)} className="flex flex-col gap-3" noValidate>
                <TextInput
                    ref={queryRef}
                    label="Numéro de l’invité"
                    hint="Exemple : 4567 ou 77 123 45 67. Chaque recherche est enregistrée à votre nom."
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={20}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <Button type="submit" variant="primary" fullWidth leftIcon={<Search size={18} />} isLoading={searching} disabled={!query.trim()}>
                    Rechercher
                </Button>
            </form>

            {problem && <StatusBanner tone="danger" title="Recherche impossible" announce="alert">{problem}</StatusBanner>}

            <div aria-live="polite" className="flex flex-col gap-2">
                {found?.truncated && (
                    <StatusBanner tone="info" title="Plusieurs invités correspondent">Plusieurs invités correspondent : saisissez le numéro complet.</StatusBanner>
                )}
                {found && found.items.length === 0 && (
                    <p className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-base text-fg">Aucune invitation non utilisée pour ce numéro.</p>
                )}
                {found && found.items.length > 0 && (
                    <ul className="flex flex-col gap-2" aria-label="Invités trouvés">
                        {found.items.map((g) => (
                            <li key={g.ticket_ids.join(',')} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-sunken p-3">
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="break-words text-2xl font-black leading-tight text-fg">{g.guest_name || 'Invité sans nom'}</span>
                                    <span className="text-base text-fg">{g.category}</span>
                                    <span className="text-base font-semibold tabular-nums text-fg">{tickets(g.ticket_count)}</span>
                                </span>
                                <Button variant="secondary" onClick={() => { setChosen({ guest: g, next: 0 }); setVerified(false); }}>
                                    Choisir
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Button variant="ghost" fullWidth leftIcon={<X size={18} />} onClick={onClose}>
                Fermer la liste
            </Button>
        </section>
    );
}
