'use client';

/**
 * Lot 10b (point 2) : liste des salles trouvées. La première page vient du serveur (rendu de /halls) ; « Voir plus »
 * demande la suite à GET /api/halls avec les mêmes filtres et le décalage (`offset`), puis place le focus sur la
 * première nouvelle salle (clavier et lecteur d'écran). Refus ou panne : message de la route et « Réessayer ».
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ApiError, errorMessage, fetchJson } from '@/components/partner/fetch-json';
import type { HallCard as HallCardData } from '@/lib/halls/queries';
import { HallCard } from './HallCard';
import { countText } from './format';

const PAGE_SIZE = 24;

export function HallResults({ initial, total, query }: { initial: HallCardData[]; total: number; query: string }) {
    const [halls, setHalls] = useState<HallCardData[]>(initial);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const focusIndex = useRef<number | null>(null);
    const links = useRef<Map<number, HTMLAnchorElement>>(new Map());

    useEffect(() => {
        if (focusIndex.current === null) return;
        links.current.get(focusIndex.current)?.focus();
        focusIndex.current = null;
    }, [halls]);

    const loadMore = async () => {
        setLoading(true);
        setFailure(null);
        try {
            const params = new URLSearchParams(query);
            params.set('offset', String(halls.length));
            params.set('limit', String(PAGE_SIZE));
            const body = await fetchJson<{ halls?: HallCardData[] }>(`/api/halls?${params.toString()}`);
            const known = new Set(halls.map((h) => h.id));
            const fresh = (Array.isArray(body.halls) ? body.halls : []).filter((h) => !known.has(h.id));
            if (fresh.length > 0) focusIndex.current = halls.length;
            setHalls((prev) => [...prev, ...fresh]);
        } catch (err) {
            setFailure(err instanceof ApiError ? errorMessage(err) : 'Impossible de charger la suite. Vérifiez votre connexion, puis réessayez.');
        } finally {
            setLoading(false);
        }
    };

    const remaining = total - halls.length;

    return (
        <section aria-labelledby="salles-trouvees" className="space-y-4">
            <h2 id="salles-trouvees" className="text-base font-semibold text-foreground-strong">
                {total > 1 ? `${countText(total)} salles trouvées` : '1 salle trouvée'}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {halls.map((hall, i) => (
                    <li key={hall.id} className="min-w-0">
                        <HallCard
                            hall={hall}
                            eager={i === 0}
                            linkRef={(node) => {
                                if (node) links.current.set(i, node);
                                else links.current.delete(i);
                            }}
                        />
                    </li>
                ))}
            </ul>
            {failure && (
                <StatusBanner
                    tone="danger"
                    title="La suite n’a pas pu être chargée"
                    announce="alert"
                    action={<Button variant="secondary" size="sm" onClick={loadMore} isLoading={loading}>Réessayer</Button>}
                >
                    {failure}
                </StatusBanner>
            )}
            {remaining > 0 && !failure && (
                <div className="flex flex-col items-center gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">{`${countText(halls.length)} salles affichées sur ${countText(total)}`}</p>
                    <Button variant="secondary" onClick={loadMore} isLoading={loading}>
                        Voir plus de salles
                    </Button>
                </div>
            )}
        </section>
    );
}
