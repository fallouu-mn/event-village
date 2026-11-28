'use client';

/**
 * Lot 12d (point 6) — pause des commandes en un geste, dans l'écran des commandes et dans le mode comptoir.
 * « Plus de commandes pendant 15, 30 ou 60 minutes » : POST /api/partner/orders/pause { venueId, minutes } ; fin
 * automatique (la base compare à l'heure courante) ; « Reprendre maintenant » : minutes 0. État lu par
 * GET /api/partner/orders/pause (établissements ouverts à la vente). Plusieurs établissements : choix de l'établissement.
 * Pendant la pause, la carte du client l'annonce et le devis est refusé ; les commandes déjà reçues continuent.
 */
import { useCallback, useEffect, useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { instantHm } from '@/lib/tables/views';

interface PauseVenue { id: string; name: string; orders_open: boolean; paused_until?: string | null }

const CHOICES = [15, 30, 60] as const;

export function OrdersPause({ large = false, readOnly = false }: { large?: boolean; readOnly?: boolean }) {
    const toast = useToast();
    const [venues, setVenues] = useState<PauseVenue[] | null>(null);
    const [venueId, setVenueId] = useState<string>('');
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, setTick] = useState(0);

    const load = useCallback(async () => {
        try {
            const body = await fetchJson<{ venues?: PauseVenue[] }>('/api/partner/orders/pause');
            const list = (Array.isArray(body.venues) ? body.venues : []).filter((v) => v.orders_open);
            setVenues(list);
            setVenueId((cur) => (cur && list.some((v) => v.id === cur) ? cur : list[0]?.id ?? ''));
        } catch (err) {
            setVenues([]);
            console.error('[commandes] pause :', errorMessage(err));
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const venue = venues?.find((v) => v.id === venueId) ?? null;
    const until = venue?.paused_until ? Date.parse(venue.paused_until) : NaN;
    const paused = Number.isFinite(until) && until > Date.now();

    // Fin automatique : l'écran repasse seul à « Commandes ouvertes » à l'heure de fin
    useEffect(() => {
        if (!paused) return undefined;
        const t = setTimeout(() => { setTick((n) => n + 1); void load(); }, Math.max(until - Date.now(), 0) + 1_000);
        return () => clearTimeout(t);
    }, [paused, until, load]);

    if (!venues || venues.length === 0 || !venue) return null;

    const set = async (minutes: number) => {
        if (busy !== null) return;
        setBusy(minutes);
        setError(null);
        try {
            const body = await sendJson<{ pausedUntil?: string | null }>('/api/partner/orders/pause', 'POST', { venueId: venue.id, minutes });
            toast.success(minutes === 0 ? 'Les commandes reprennent.' : `Plus de nouvelles commandes jusqu’à ${instantHm(body.pausedUntil ?? null)}.`);
            await load();
        } catch (err) {
            setError(errorMessage(err, 'Pause impossible pour le moment. Réessayez.'));
        } finally {
            setBusy(null);
        }
    };

    const titleId = `pause-commandes-titre${large ? '-comptoir' : ''}`;
    return (
        <section
            aria-labelledby={titleId}
            className={cn('rounded-2xl border p-4 transition-colors duration-base', paused ? 'border-warning-border bg-warning-soft' : 'border-border bg-card')}
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cn('flex flex-shrink-0 items-center justify-center rounded-xl', large ? 'h-12 w-12' : 'h-11 w-11',
                        paused ? 'bg-card text-warning-text' : 'bg-muted text-foreground-strong')} aria-hidden="true">
                        <PauseCircle size={large ? 26 : 22} />
                    </span>
                    <div className="min-w-0">
                        <h2 id={titleId} className={cn('font-bold text-foreground-strong', large ? 'text-xl' : 'text-base')}>Pause des commandes</h2>
                        <p className={cn('break-words', large ? 'text-base' : 'text-sm', paused ? 'font-semibold text-warning-text' : 'text-muted-foreground')} role="status">
                            {paused
                                ? `Pause jusqu’à ${instantHm(venue.paused_until ?? null)} : plus de nouvelles commandes${venues.length > 1 ? ` pour ${venue.name}` : ''}. Les commandes reçues continuent.`
                                : 'Débordé ? Arrêtez les nouvelles commandes quelques minutes, elles reprennent seules.'}
                        </p>
                    </div>
                </div>
                {venues.length > 1 && (
                    <div className="md:w-56">
                        <Select
                            id={`pause-etablissement${large ? '-comptoir' : ''}`}
                            label="Établissement"
                            options={venues.map((v) => ({ value: v.id, label: v.name }))}
                            value={venueId}
                            onChange={(e) => setVenueId(e.target.value)}
                        />
                    </div>
                )}
            </div>
            <div className={cn('mt-3 grid gap-2', paused ? 'grid-cols-1 sm:flex sm:justify-end' : 'grid-cols-3')}>
                {paused ? (
                    <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        className={cn(large && 'min-h-16 text-lg')}
                        leftIcon={<PlayCircle size={large ? 22 : 18} aria-hidden="true" />}
                        onClick={() => void set(0)}
                        isLoading={busy === 0}
                        disabled={readOnly || busy !== null}
                    >
                        Reprendre maintenant
                    </Button>
                ) : (
                    CHOICES.map((m) => (
                        <Button
                            key={m}
                            type="button"
                            variant="secondary"
                            size="lg"
                            className={cn('px-2', large && 'min-h-16 text-lg')}
                            onClick={() => void set(m)}
                            isLoading={busy === m}
                            disabled={readOnly || busy !== null}
                            aria-label={`Plus de commandes pendant ${m} minutes`}
                        >
                            {`${m} min`}
                        </Button>
                    ))
                )}
            </div>
            {error && <p role="alert" className="mt-2 break-words text-sm font-medium text-danger-text">{error}</p>}
        </section>
    );
}
