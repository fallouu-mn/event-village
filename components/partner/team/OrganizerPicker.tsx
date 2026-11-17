'use client';

import React, { useEffect, useId, useState } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';

export interface PickedOrganizer { partner_id: string; name: string }
interface Organizer extends PickedOrganizer { city: string | null; status: string }

/**
 * Finition 3d (point 4b) — page Équipe d'un admin : l'organisatrice se choisit dans une liste avec recherche (fini
 * « ?partnerId= » tapé à la main). Lecture : GET /api/partner/team/organizers?q= (admin muni de events.read ; recherche
 * sans accents ni majuscules, 20 au plus, triées par nom). Une organisatrice suspendue reste dans la liste : l'admin peut
 * gérer son équipe à sa place.
 */
export function OrganizerPicker({ onPick }: { onPick: (o: PickedOrganizer) => void }) {
    const id = useId();
    const [query, setQuery] = useState('');
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [items, setItems] = useState<Organizer[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setPhase('loading');
        const timer = window.setTimeout(() => {
            fetch(`/api/partner/team/organizers?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
                .then(async (res) => {
                    const body = (await res.json().catch(() => null)) as { organizers?: Organizer[]; truncated?: boolean; error?: string } | null;
                    if (cancelled) return;
                    if (!res.ok || !body || !Array.isArray(body.organizers)) {
                        setError(body?.error ?? 'Liste des organisatrices indisponible pour le moment.');
                        setPhase('error');
                        return;
                    }
                    setItems(body.organizers);
                    setTruncated(body.truncated === true);
                    setPhase('ready');
                })
                .catch((err: unknown) => {
                    console.error('[OrganizerPicker] liste illisible :', err instanceof Error ? err.message : String(err));
                    if (cancelled) return;
                    setError('Connexion impossible. Vérifiez votre réseau, puis réessayez.');
                    setPhase('error');
                });
        }, query ? 300 : 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [query, attempt]);

    return (
        <section aria-labelledby={`${id}-titre`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <div className="space-y-1">
                <h2 id={`${id}-titre`} className="text-lg font-bold tracking-tight text-fg">Choisissez l’organisatrice</h2>
                <p className="text-sm text-fg-muted">Vous gérez l’équipe de contrôle d’une organisatrice à sa place : choisissez-la dans la liste.</p>
            </div>
            <TextInput
                label="Rechercher une organisatrice"
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="Nom, ville ou titulaire"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {phase === 'loading' && (
                <div role="status" aria-busy="true" aria-label="Chargement des organisatrices" className="space-y-2">
                    {[0, 1, 2].map((i) => <span key={i} className="block h-14 rounded-xl bg-surface-sunken motion-safe:animate-pulse" />)}
                </div>
            )}
            {phase === 'error' && (
                <StatusBanner tone="danger" announce="alert" title="Liste indisponible">
                    <span className="block">{error}</span>
                    <Button variant="secondary" size="sm" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>Réessayer</Button>
                </StatusBanner>
            )}
            {phase === 'ready' && items.length === 0 && (
                <p className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-fg">
                    {query.trim()
                        ? <>Aucune organisatrice ne correspond à « {query.trim()} ».</>
                        : <>Aucune organisatrice validée pour le moment.</>}
                </p>
            )}
            {phase === 'ready' && items.length > 0 && (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" aria-label="Organisatrices">
                    {items.map((o) => (
                        <li key={o.partner_id}>
                            <button
                                type="button"
                                onClick={() => onPick({ partner_id: o.partner_id, name: o.name })}
                                className="flex min-h-11 w-full items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-bg text-brand-fg" aria-hidden="true"><Building2 size={18} /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block break-words text-base font-semibold text-fg">{o.name}</span>
                                    {o.city && <span className="block text-sm text-fg-muted">{o.city}</span>}
                                </span>
                                {o.status === 'SUSPENDU' && <Badge variant="warning">Suspendue</Badge>}
                                <ChevronRight size={18} className="flex-shrink-0 text-fg-muted" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {phase === 'ready' && truncated && (
                <p className="text-sm text-fg-muted">Seules les 20 premières sont affichées : précisez la recherche.</p>
            )}
        </section>
    );
}
