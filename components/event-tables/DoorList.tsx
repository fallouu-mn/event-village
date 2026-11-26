'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, Maximize2, Minimize2, Printer, RefreshCw, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { cn } from '@/components/ui/cn';
import { ApiError, fetchJson } from '@/components/partner/fetch-json';
import { formatDateTime, formatInteger, formatTime } from '@/lib/format';
import type { DoorItem, DoorList as DoorListData } from './types';

/**
 * Lot 11c-c — liste de la porte des tables d'un événement (GET /api/events/[id]/tables/door : propriétaire, ses
 * contrôleurs, administration habilitée au scan ; sinon 403). Gros caractères, recherche par numéro de table,
 * « 3/6 entrés », titulaire et invités en prénom et initiale ; une table touchée s'ouvre avec ses invités. Mode plein
 * écran à fort contraste (thème sombre forcé, caractères agrandis). Version imprimable (feuille d'impression propre à la
 * page : seule la liste est imprimée, en noir sur blanc, avec une case par place) pour une porte sans réseau ;
 * `?imprimer=1` ouvre l'impression dès la liste lue. Chaque nombre vient du serveur.
 * Contre-vérification 11c-c (T1) : hors de la plage du contrôle, un contrôleur reçoit 409 CONTROL_CLOSED ; la page dit
 * simplement quand le contrôle ouvre (ou qu'il est fermé), sans garder aucune liste lue auparavant.
 */

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #porte-impression, #porte-impression * { visibility: visible !important; color: black !important; background: transparent !important; }
  #porte-impression { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
  #porte-impression .ligne { display: grid; grid-template-columns: 14% 22% 18% 26% 20%; border: 1px solid black; border-top: 0; break-inside: avoid; }
  #porte-impression .ligne.entete { border-top: 1px solid black; font-weight: 700; }
  #porte-impression .ligne > div { padding: 6px 8px; border-left: 1px solid black; }
  #porte-impression .ligne > div:first-child { border-left: 0; }
  @page { margin: 12mm; }
}`;

export interface DoorListProps {
    eventId: string;
    /** Titre de l'événement, s'il est connu de la page (en tête de l'écran et de la feuille imprimée). */
    title?: string | null;
}

export function DoorList({ eventId, title }: DoorListProps) {
    const [data, setData] = useState<DoorListData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [closed, setClosed] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<number | null>(null);
    const [full, setFull] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const printed = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const body = await fetchJson<DoorListData>(`/api/events/${eventId}/tables/door`);
            setData(body);
            setError(null);
            setClosed(null);
        } catch (err) {
            if (err instanceof ApiError && err.code === 'CONTROL_CLOSED') {
                // Contrôle fermé : plus aucune donnée à l'écran, même lue plus tôt
                setData(null);
                setError(null);
                setClosed(err.message);
                return;
            }
            setError(err instanceof Error && err.message ? err.message : 'La liste des tables ne peut pas être affichée pour le moment.');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void load();
    }, [load]);

    // Retour sur l'onglet : relecture (les entrées avancent pendant la soirée)
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [load]);

    useEffect(() => {
        if (!data || printed.current) return;
        if (new URLSearchParams(window.location.search).get('imprimer') === '1') {
            printed.current = true;
            window.setTimeout(() => window.print(), 300);
        }
    }, [data]);

    useEffect(() => {
        const onChange = () => { if (!document.fullscreenElement) setFull(false); };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggleFull = async () => {
        if (full) {
            setFull(false);
            if (document.fullscreenElement) await document.exitFullscreen().catch((err: unknown) => console.warn('[porte] sortie du plein écran :', err));
            return;
        }
        setFull(true);
        const el = boxRef.current;
        if (el && typeof el.requestFullscreen === 'function') {
            // Sans plein écran (iPhone), le mode fort contraste reste appliqué dans la page
            await el.requestFullscreen().catch((err: unknown) => console.warn('[porte] plein écran refusé :', err));
        }
    };

    const items = useMemo(() => {
        const list = data?.items ?? [];
        const q = query.replace(/\D/g, '');
        return q ? list.filter((t) => String(t.table_number).startsWith(q)) : list;
    }, [data, query]);

    if (loading && !data) {
        return <div className="h-64 w-full rounded-2xl bg-muted motion-safe:animate-pulse" role="status" aria-label="Chargement de la liste de la porte" />;
    }
    if (closed !== null) {
        return (
            <EmptyState
                icon={<Clock size={28} />}
                title="Liste fermée pour le moment"
                description={closed}
                actionLabel="Actualiser"
                onAction={() => void load()}
                className="my-0"
            />
        );
    }
    if (!data) {
        return <ErrorState title="La liste de la porte n’a pas pu être chargée" description={error ?? undefined} onRetry={() => void load()} isRetrying={loading} />;
    }

    return (
        <div ref={boxRef} className={cn('flex flex-col gap-5', full && 'dark overflow-y-auto rounded-2xl bg-background p-4 text-foreground-strong sm:p-6')} data-porte="" data-porte-contraste={full ? 'fort' : undefined}>
            <style>{PRINT_CSS}</style>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className={cn('font-bold tracking-tight text-foreground-strong', full ? 'text-4xl' : 'text-2xl sm:text-3xl')}>Liste de la porte</h1>
                    {title && <p className="mt-1 break-words text-base text-muted-foreground">{title}</p>}
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        {formatInteger(data.items.length)} {data.items.length > 1 ? 'tables vendues' : 'table vendue'} · mis à jour à{' '}
                        <time dateTime={data.read_at} className="font-semibold tabular-nums text-foreground-strong">{formatTime(data.read_at)}</time>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" leftIcon={<RefreshCw size={18} />} onClick={() => void load()} isLoading={loading}>Actualiser</Button>
                    <Button variant="secondary" leftIcon={full ? <Minimize2 size={18} /> : <Maximize2 size={18} />} onClick={() => void toggleFull()} aria-pressed={full}>
                        {full ? 'Quitter le plein écran' : 'Plein écran'}
                    </Button>
                    <Button variant="secondary" leftIcon={<Printer size={18} />} onClick={() => window.print()}>Imprimer</Button>
                </div>
            </div>
            {error && <p role="alert" className="text-sm font-medium tabular-nums text-danger-text">{error} La liste affichée est celle de {formatTime(data.read_at)}.</p>}

            {data.items.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="Aucune table vendue" description="Les tables vendues apparaîtront ici avec leurs invités." className="my-0" />
            ) : (
                <>
                    <TextInput
                        id="porte-recherche"
                        type="search"
                        inputMode="numeric"
                        label="Numéro de table"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="12"
                        className={cn('text-2xl font-bold', full && 'min-h-16 text-3xl')}
                        aside={<Search size={18} aria-hidden="true" className="text-muted-foreground" />}
                    />
                    <p className="sr-only" aria-live="polite">{items.length === 1 ? '1 table affichée' : `${items.length} tables affichées`}</p>
                    {items.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-base text-foreground">Aucune table ne porte ce numéro.</p>
                    ) : (
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Tables vendues">
                            {items.map((t) => (
                                <DoorCard key={t.table_number} item={t} full={full} open={open === t.table_number}
                                    onToggle={() => setOpen((cur) => (cur === t.table_number ? null : t.table_number))} />
                            ))}
                        </ul>
                    )}
                </>
            )}

            <section id="porte-impression" className="hidden" aria-hidden="true">
                <h2 style={{ fontSize: '20pt', fontWeight: 700 }}>Liste de la porte — tables{title ? ` · ${title}` : ''}</h2>
                <p style={{ marginBottom: '8pt' }}>Imprimée le {formatDateTime(new Date())} · liste du {formatDateTime(data.read_at)}. Cochez une case par personne entrée.</p>
                <div className="ligne entete"><div>Table</div><div>Type · zone</div><div>Titulaire</div><div>Invités</div><div>Entrées</div></div>
                {data.items.map((t) => (
                    <div className="ligne tabular-nums" key={t.table_number}>
                        <div style={{ fontSize: '16pt', fontWeight: 700 }}>{t.table_number}</div>
                        <div>{t.type_name}{t.zone ? ` · ${t.zone}` : ''}</div>
                        <div>{t.holder ?? '—'}</div>
                        <div>{t.guests.length > 0 ? t.guests.join(', ') : '—'}</div>
                        <div className="tabular-nums">
                            {formatInteger(t.entered)}/{formatInteger(t.seats)} déjà entrés
                            <span style={{ display: 'block', marginTop: '4pt' }}>
                                {Array.from({ length: t.seats }, (_, i) => (
                                    <span key={i} style={{ display: 'inline-block', width: '11pt', height: '11pt', border: '1px solid black', marginRight: '3pt' }} />
                                ))}
                            </span>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}

function DoorCard({ item, full, open, onToggle }: { item: DoorItem; full: boolean; open: boolean; onToggle: () => void }) {
    const done = item.entered >= item.seats;
    const panelId = `porte-table-${item.table_number}`;
    return (
        <li className={cn('rounded-2xl border-2 bg-card', done ? 'border-success-border' : 'border-border')} data-porte-table={item.table_number}>
            <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
                className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0">
                    <span className={cn('block font-extrabold tabular-nums leading-none text-foreground-strong', full ? 'text-5xl' : 'text-4xl')}>Table {item.table_number}</span>
                    <span className="mt-1 block break-words text-base text-muted-foreground">{item.zone ?? item.type_name}{item.zone ? ` · ${item.type_name}` : ''}</span>
                    {item.holder && <span className="mt-1 block break-words text-lg font-semibold text-foreground-strong">{item.holder}</span>}
                </span>
                <span className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className={cn('rounded-xl px-3 py-1 font-extrabold tabular-nums', full ? 'text-4xl' : 'text-3xl', done ? 'bg-success-soft text-success-text' : 'bg-muted text-foreground-strong')}>
                        {formatInteger(item.entered)}/{formatInteger(item.seats)}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{done ? 'Tous entrés' : 'entrés'}</span>
                    <ChevronDown size={20} aria-hidden="true" className={cn('text-muted-foreground transition-transform duration-base', open && 'rotate-180')} />
                </span>
            </button>
            {open && (
                <div id={panelId} className="animate-in fade-in border-t border-border px-4 pb-4 pt-3">
                    <p className="text-sm font-semibold text-muted-foreground">Invités ({item.guests.length})</p>
                    {item.guests.length > 0 ? (
                        <ul className="mt-1 flex flex-wrap gap-2">
                            {item.guests.map((g) => (
                                <li key={g} className={cn('rounded-pill border border-border bg-background px-3 py-1 font-semibold text-foreground-strong', full ? 'text-xl' : 'text-lg')}>{g}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-1 text-base text-foreground">Aucune place envoyée : les invités entrent avec le titulaire.</p>
                    )}
                </div>
            )}
        </li>
    );
}
