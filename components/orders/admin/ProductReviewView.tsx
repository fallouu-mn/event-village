'use client';

/**
 * Lot 12c — « Produits à vérifier » (administration, droit partners.validate) :
 *  - file : produits dont le nom, la description ou un supplément contient un mot de la liste, et produits marqués
 *    « réglementé » par leur partenaire sans décision ; photo, texte, suppléments, mots trouvés surlignés ;
 *  - décision « Autoriser à la vente » ou « Refuser à la vente », motif obligatoire (POST
 *    /api/admin/products/[id]/regulation) ; la partenaire est prévenue ;
 *  - historique des décisions ; liste des mots (modifiable par un super-administrateur, avec motif).
 * Tout vient de GET /api/admin/products/review ; les refus du serveur sont affichés tels quels.
 *
 * Contre-vérification du lot 12c :
 *  - T2 : la décision envoie la version affichée (reviewedAt) ; un produit changé pendant la lecture est refusé par la
 *    base, la page le dit et se recharge ;
 *  - T1 : surlignage calculé par le serveur (plages), catégorie affichée et surlignée ;
 *  - T3 : bouton « Mettre à vérifier » sur n'importe quel produit (recherche par nom, motif), motif affiché dans la
 *    file ; dernière revue groupée des produits déjà en vente affichée.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Flag, FolderOpen, ImageOff, ListChecks, Pencil, Search, ShieldAlert, ShieldCheck, Store, Tags, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { humanToastMessage } from '@/components/ui/human-message';
import { Tabs, TabPanel, useTabParam } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextInput, Textarea } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { ApiError, fetchJson, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { splitMarked } from '@/lib/orders/review-highlight';
import { REGULATED_KIND_LABELS } from '@/lib/orders/partner-ui';

type Ranges = Array<[number, number]>;
interface QueueItem {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image: string | null;
    reason: 'MOTS' | 'CASE' | 'ADMIN';
    note: string | null;
    version: string;
    categoryName: string | null;
    marks: { name: Ranges; description: Ranges; category: Ranges };
    words: string[];
    partnerBox: boolean;
    regulatedKind: string | null;
    requestedAt: string;
    venueName: string | null;
    partnerName: string | null;
    options: Array<{ name: string; price: number; active: boolean; marks: Ranges }>;
}
interface SearchItem { id: string; name: string; price: number; underReview: boolean; venueName: string | null; partnerName: string | null }
interface HistoryItem {
    id: string;
    productId: string | null;
    productName: string;
    decision: 'AUTORISE' | 'REFUSE';
    reason: string | null;
    words: string[];
    by: string;
    at: string;
}
interface ReviewReply {
    canEditKeywords: boolean;
    keywords: string[];
    keywordsUpdatedAt: string | null;
    lastBatch: { count: number; origin: string; at: string } | null;
    search: SearchItem[] | null;
    queue: QueueItem[];
    history: HistoryItem[];
}

const BATCH_ORIGIN: Record<string, string> = {
    LISTE: 'après un changement de la liste des mots',
    CATEGORIE: 'après le renommage d’une catégorie',
    MIGRATION: 'lors de la mise à jour de la plateforme',
};

const TABS = ['file', 'signaler', 'historique', 'mots'] as const;
type TabKey = (typeof TABS)[number];
const ID_PREFIX = 'produits-a-verifier';

/** Texte avec les mots trouvés surlignés (plages servies par le serveur ; libellé caché pour les lecteurs d'écran). */
function Highlighted({ text, ranges }: { text: string; ranges: Ranges }) {
    const parts = useMemo(() => splitMarked(text, ranges), [text, ranges]);
    return (
        <>
            {parts.map((p, i) => (p.match
                ? <mark key={i} className="rounded bg-warning-soft px-0.5 font-semibold text-warning-text"><span className="sr-only">Mot trouvé : </span>{p.text}</mark>
                : <React.Fragment key={i}>{p.text}</React.Fragment>))}
        </>
    );
}

function Thumb({ item }: { item: QueueItem }) {
    if (!item.image) {
        return (
            <div className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground sm:w-44" aria-hidden="true">
                <ImageOff size={28} />
            </div>
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element -- image publique de la partenaire, taille fixée par le cadre
        <img src={item.image} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-lg object-cover sm:w-44" />
    );
}

type Decision = { item: QueueItem; allow: boolean } | null;

const CHANGED_MESSAGE = 'Ce produit a changé pendant votre lecture : relisez-le.';

export function ProductReviewView({ focusId }: { focusId: string | null }) {
    const [tab, setTab] = useTabParam<TabKey>(TABS, 'file');
    const [data, setData] = useState<ReviewReply | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [decision, setDecision] = useState<Decision>(null);
    const [deciding, setDeciding] = useState(false);
    const [decisionError, setDecisionError] = useState<string | undefined>(undefined);
    const [done, setDone] = useState<string | null>(null);
    const [changed, setChanged] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const body = await fetchJson<ReviewReply>('/api/admin/products/review');
            setData(body);
            setLoadError(null);
        } catch (err) {
            setLoadError(errorMessage(err, 'Impossible de charger les produits à vérifier. Réessayez.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Lien d'un avis (?produit=<id>) : la carte du produit est mise en vue
    useEffect(() => {
        if (!focusId || !data) return;
        document.getElementById(`produit-${focusId}`)?.scrollIntoView({ block: 'center' });
    }, [focusId, data]);

    const decide = async (reason: string) => {
        if (!decision) return;
        setDeciding(true);
        setDecisionError(undefined);
        try {
            const r = await sendJson<{ message?: string }>(`/api/admin/products/${decision.item.id}/regulation`, 'POST', {
                regulated: !decision.allow, reason, reviewedAt: decision.item.version,
            });
            setDone(`${decision.item.name} : ${r.message ?? (decision.allow ? 'autorisé à la vente.' : 'refusé à la vente.')} La partenaire est prévenue.`);
            setDecision(null);
            await load();
        } catch (err) {
            if (err instanceof ApiError && err.code === 'REVIEW_CHANGED') {
                // Le produit a changé depuis l'affichage : la décision n'est pas prise, la fiche est relue
                setChanged(`${decision.item.name} : ${err.message || CHANGED_MESSAGE}`);
                setDecision(null);
                await load();
                document.getElementById(`produit-${decision.item.id}`)?.scrollIntoView({ block: 'center' });
                return;
            }
            setDecisionError(errorMessage(err, 'Décision non enregistrée. Réessayez.'));
        } finally {
            setDeciding(false);
        }
    };

    const historyColumns: DataColumn<HistoryItem>[] = [
        { key: 'produit', header: 'Produit', render: (h) => <span className="font-semibold text-foreground-strong">{h.productName}</span> },
        {
            key: 'decision', header: 'Décision', render: (h) => (h.decision === 'AUTORISE'
                ? <Badge variant="success" icon={<CheckCircle2 size={14} aria-hidden="true" />}>Autorisé à la vente</Badge>
                : <Badge variant="danger" icon={<XCircle size={14} aria-hidden="true" />}>Refusé à la vente</Badge>),
        },
        { key: 'motif', header: 'Motif', render: (h) => <span className="break-words">{h.reason ?? '—'}</span> },
        { key: 'mots', header: 'Mots trouvés', render: (h) => (h.words.length ? h.words.join(', ') : '—') },
        { key: 'par', header: 'Par', render: (h) => h.by },
        { key: 'quand', header: 'Le', render: (h) => <time dateTime={h.at} className="tabular-nums">{formatDateTime(h.at)}</time> },
    ];

    const queue = data?.queue ?? [];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Produits à vérifier"
                description="Un produit dont le nom, la description, la catégorie ou un supplément contient un mot de la liste ne se vend pas en ligne tant que vous n’avez pas décidé. Les produits marqués « réglementé » par leur partenaire, ou mis à vérifier par l’administration, sont aussi listés."
            />

            {done && (
                <StatusBanner tone="success" title="Décision enregistrée">
                    {done}
                </StatusBanner>
            )}
            {changed && (
                <StatusBanner tone="warning" title="Décision non enregistrée">
                    {changed}
                </StatusBanner>
            )}
            {data?.lastBatch && data.lastBatch.count > 0 && (
                <StatusBanner tone="info" title="Produits déjà en vente revus">
                    <span className="tabular-nums">{formatInteger(data.lastBatch.count)}</span>
                    {` produit${data.lastBatch.count > 1 ? 's' : ''} mis à vérifier ${BATCH_ORIGIN[data.lastBatch.origin] ?? 'lors d’une revue'}, le `}
                    <time dateTime={data.lastBatch.at} className="tabular-nums">{formatDateTime(data.lastBatch.at)}</time>.
                </StatusBanner>
            )}

            <Tabs
                ariaLabel="Produits à vérifier"
                idPrefix={ID_PREFIX}
                value={tab}
                onChange={(id) => setTab(id as TabKey)}
                tabs={[
                    { id: 'file', label: 'À vérifier', count: data ? queue.length : undefined },
                    { id: 'signaler', label: 'Mettre à vérifier' },
                    { id: 'historique', label: 'Historique' },
                    { id: 'mots', label: 'Liste des mots', count: data ? data.keywords.length : undefined },
                ]}
            />

            {loading && !data ? (
                <div className="space-y-4" aria-busy="true" aria-label="Chargement des produits à vérifier">
                    {[0, 1].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
                </div>
            ) : loadError && !data ? (
                <ErrorState description={loadError} onRetry={() => void load()} isRetrying={loading} />
            ) : data && (
                <>
                    <TabPanel idPrefix={ID_PREFIX} tabIdValue="file" className={tab === 'file' ? '' : 'hidden'}>
                        {queue.length === 0 ? (
                            <EmptyState
                                illustrated
                                icon={<ShieldCheck size={32} aria-hidden="true" />}
                                title="Rien à vérifier"
                                description="Tous les produits signalés ont reçu une décision. Vous serez prévenu à chaque nouveau produit."
                            />
                        ) : (
                            <ul className="space-y-4">
                                {queue.map((item) => (
                                    <li key={item.id} id={`produit-${item.id}`}>
                                        <Card className={cn('p-4 sm:p-5', focusId === item.id && 'ring-2 ring-ring')}>
                                            <div className="flex flex-col gap-4 sm:flex-row">
                                                <Thumb item={item} />
                                                <div className="min-w-0 flex-1 space-y-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="min-w-0 space-y-1">
                                                            <h2 className="break-words text-lg font-semibold text-foreground-strong">
                                                                <Highlighted text={item.name} ranges={item.marks.name} />
                                                            </h2>
                                                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                                                <span className="inline-flex items-center gap-1"><Store size={14} aria-hidden="true" />{item.venueName ?? 'Sans établissement'}</span>
                                                                {item.partnerName && <span>{item.partnerName}</span>}
                                                                <span>Signalé le <time dateTime={item.requestedAt} className="tabular-nums">{formatDateTime(item.requestedAt)}</time></span>
                                                            </p>
                                                            {item.categoryName && (
                                                                <p className="inline-flex items-center gap-1 text-sm text-foreground">
                                                                    <FolderOpen size={14} aria-hidden="true" />
                                                                    <span>Catégorie : <Highlighted text={item.categoryName} ranges={item.marks.category} /></span>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="text-xl font-bold tabular-nums text-foreground-strong">{formatFcfa(item.price)}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.reason === 'MOTS' && (
                                                            <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>
                                                                {item.words.length > 1 ? 'Mots trouvés' : 'Mot trouvé'} : {item.words.join(', ')}
                                                            </Badge>
                                                        )}
                                                        {item.reason === 'ADMIN' && (
                                                            <Badge variant="warning" icon={<Flag size={14} aria-hidden="true" />}>
                                                                Mis à vérifier par l’administration
                                                            </Badge>
                                                        )}
                                                        {item.partnerBox && (
                                                            <Badge variant="info" icon={<Tags size={14} aria-hidden="true" />}>
                                                                Marqué réglementé par la partenaire{item.regulatedKind ? ` (${REGULATED_KIND_LABELS[item.regulatedKind] ?? 'autre'})` : ''}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {item.note && (
                                                        <p className="break-words rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-text">
                                                            Motif : {item.note}
                                                        </p>
                                                    )}
                                                    {item.description && (
                                                        <p className="whitespace-pre-line break-words text-sm text-foreground">
                                                            <Highlighted text={item.description} ranges={item.marks.description} />
                                                        </p>
                                                    )}
                                                    {item.options.length > 0 && (
                                                        <div className="text-sm">
                                                            <p className="font-medium text-foreground-strong">Suppléments</p>
                                                            <ul className="mt-1 flex flex-wrap gap-2">
                                                                {item.options.map((o, i) => (
                                                                    <li key={`${o.name}-${i}`} className="rounded-lg border border-border bg-background px-2.5 py-1">
                                                                        <Highlighted text={o.name} ranges={o.marks} />{' '}
                                                                        <span className="tabular-nums text-muted-foreground">+ {formatFcfa(o.price)}</span>
                                                                        {!o.active && <span className="text-muted-foreground"> (masqué)</span>}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {item.partnerBox && (
                                                        <p className="text-sm text-muted-foreground">
                                                            La partenaire a coché « réglementé » : même autorisé, le produit reste affiché sans vente en ligne tant que la case est cochée.
                                                        </p>
                                                    )}
                                                    <div className="flex flex-col gap-2 sm:flex-row">
                                                        <Button
                                                            variant="primary"
                                                            leftIcon={<CheckCircle2 size={18} aria-hidden="true" />}
                                                            onClick={() => { setDone(null); setChanged(null); setDecisionError(undefined); setDecision({ item, allow: true }); }}
                                                        >
                                                            Autoriser à la vente
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            leftIcon={<XCircle size={18} aria-hidden="true" />}
                                                            onClick={() => { setDone(null); setChanged(null); setDecisionError(undefined); setDecision({ item, allow: false }); }}
                                                        >
                                                            Refuser à la vente
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </TabPanel>

                    <TabPanel idPrefix={ID_PREFIX} tabIdValue="signaler" className={tab === 'signaler' ? '' : 'hidden'}>
                        <FlagPanel onFlagged={async (message) => { setDone(message); setChanged(null); await load(); }} />
                    </TabPanel>

                    <TabPanel idPrefix={ID_PREFIX} tabIdValue="historique" className={tab === 'historique' ? '' : 'hidden'}>
                        <DataList
                            items={data.history}
                            columns={historyColumns}
                            getKey={(h) => h.id}
                            caption="Décisions sur les produits"
                            cardTitle={(h) => h.productName}
                            empty={<EmptyState icon={<ListChecks size={32} aria-hidden="true" />} title="Aucune décision" description="Les décisions sur les produits apparaîtront ici." />}
                        />
                    </TabPanel>

                    <TabPanel idPrefix={ID_PREFIX} tabIdValue="mots" className={tab === 'mots' ? '' : 'hidden'}>
                        <KeywordsPanel data={data} onSaved={load} />
                    </TabPanel>
                </>
            )}

            <ReasonDialog
                isOpen={decision !== null}
                onClose={() => { if (!deciding) setDecision(null); }}
                onConfirm={(reason) => void decide(reason)}
                title={decision?.allow ? 'Autoriser à la vente en ligne' : 'Refuser à la vente en ligne'}
                description={decision ? (decision.allow
                    ? `« ${decision.item.name} » pourra être commandé en ligne${decision.item.partnerBox ? ' dès que la partenaire décoche « réglementé »' : ''}. La partenaire est prévenue.`
                    : `« ${decision.item.name} » reste affiché avec son prix mais ne se commande plus en ligne. Les commandes en cours qui le contiennent seront annulées et remboursées à leur prochaine étape. La partenaire est prévenue, avec votre motif.`) : undefined}
                label="Motif"
                hint="Envoyé à la partenaire avec la décision."
                confirmLabel={decision?.allow ? 'Autoriser' : 'Refuser'}
                variant={decision?.allow ? 'primary' : 'danger'}
                isLoading={deciding}
                error={decisionError}
                maxLength={300}
            />
        </div>
    );
}

/**
 * Contre-vérification du lot 12c (T3) : « Mettre à vérifier » n'importe quel produit en vente (une marque qu'aucune liste
 * ne reconnaît) ; recherche par nom servie par GET /api/admin/products/review?q=, motif envoyé à la partenaire.
 */
function FlagPanel({ onFlagged }: { onFlagged: (message: string) => Promise<void> }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SearchItem[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [target, setTarget] = useState<SearchItem | null>(null);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | undefined>(undefined);

    const search = async () => {
        const text = q.trim();
        if (text.length < 2) {
            setSearchError('Saisissez au moins 2 lettres du nom du produit.');
            return;
        }
        setSearching(true);
        setSearchError(null);
        try {
            const body = await fetchJson<ReviewReply>(`/api/admin/products/review?q=${encodeURIComponent(text)}`);
            setResults(body.search ?? []);
        } catch (err) {
            setSearchError(errorMessage(err, 'Recherche impossible pour le moment. Réessayez.'));
        } finally {
            setSearching(false);
        }
    };

    const flag = async (reason: string) => {
        if (!target) return;
        setSending(true);
        setSendError(undefined);
        try {
            const r = await sendJson<{ message?: string }>(`/api/admin/products/${target.id}/review`, 'POST', { reason });
            const name = target.name;
            setTarget(null);
            setResults((list) => (list ?? []).map((x) => (x.name === name ? { ...x, underReview: true } : x)));
            await onFlagged(`${name} : ${r.message ?? 'mis à vérifier.'} La partenaire est prévenue.`);
        } catch (err) {
            setSendError(errorMessage(err, 'Produit non mis à vérifier. Réessayez.'));
        } finally {
            setSending(false);
        }
    };

    return (
        <Card className="space-y-4 p-4 sm:p-5">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground-strong">Mettre un produit à vérifier</h2>
                <p className="text-sm text-muted-foreground">
                    Pour un produit qu’aucun mot de la liste ne repère (une marque, un nom détourné) : il ne se commande plus en ligne jusqu’à votre décision.
                </p>
            </div>
            <form
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                role="search"
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    void search();
                }}
            >
                <div className="min-w-0 flex-1">
                    <TextInput
                        label="Nom du produit"
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        maxLength={60}
                        error={searchError ?? undefined}
                    />
                </div>
                <Button type="submit" variant="secondary" leftIcon={<Search size={16} aria-hidden="true" />} isLoading={searching}>Chercher</Button>
            </form>
            {results !== null && (results.length === 0 ? (
                <p className="text-sm text-muted-foreground" role="status">Aucun produit en vente ne porte ce nom.</p>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Produits trouvés">
                    {results.map((r) => (
                        <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="break-words font-medium text-foreground-strong">{r.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {[r.venueName, r.partnerName].filter(Boolean).join(' · ') || 'Sans établissement'} · <span className="tabular-nums">{formatFcfa(r.price)}</span>
                                </p>
                            </div>
                            {r.underReview ? (
                                <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>Déjà à vérifier</Badge>
                            ) : (
                                <Button variant="outline" leftIcon={<Flag size={16} aria-hidden="true" />} onClick={() => { setSendError(undefined); setTarget(r); }}>
                                    Mettre à vérifier
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            ))}
            <ReasonDialog
                isOpen={target !== null}
                onClose={() => { if (!sending) setTarget(null); }}
                onConfirm={(reason) => void flag(reason)}
                title="Mettre à vérifier"
                description={target ? `« ${target.name} » ne se commande plus en ligne jusqu’à votre décision. La partenaire est prévenue, avec votre motif.` : undefined}
                label="Motif"
                hint="Envoyé à la partenaire."
                confirmLabel="Mettre à vérifier"
                variant="danger"
                isLoading={sending}
                error={sendError}
                maxLength={300}
            />
        </Card>
    );
}

function KeywordsPanel({ data, onSaved }: { data: ReviewReply; onSaved: () => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const start = () => {
        setDraft(data.keywords.join('\n'));
        setReason('');
        setError(null);
        setSaved(null);
        setEditing(true);
    };

    const save = async () => {
        const keywords = draft.split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean);
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/products/keywords', {
                method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keywords, reason }),
            });
            const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
            if (!res.ok) throw new Error(body?.error ?? 'Liste non enregistrée. Réessayez.');
            setEditing(false);
            setSaved(body?.message ?? 'Liste enregistrée.');
            await onSaved();
        } catch (err) {
            // Lot « Avis », phase 2 (2h, M12) : une coupure réseau (« Failed to fetch ») n'est jamais affichée telle quelle
            setError(err instanceof Error && err.message ? humanToastMessage(err.message) : 'Liste non enregistrée. Réessayez.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground-strong">Mots qui demandent une vérification</h2>
                    <p className="text-sm text-muted-foreground">
                        Comparés sans accents ni majuscules, au mot entier (« vin » trouve « vins », pas « vinaigrette »), même écrits avec des lettres séparées (« W.H.I.S.K.Y »). Chaque changement revoit aussi les produits déjà en vente.
                    </p>
                    {data.keywordsUpdatedAt && (
                        <p className="text-sm text-muted-foreground">Modifiée le <time dateTime={data.keywordsUpdatedAt} className="tabular-nums">{formatDateTime(data.keywordsUpdatedAt)}</time></p>
                    )}
                </div>
                {data.canEditKeywords && !editing && (
                    <Button variant="secondary" leftIcon={<Pencil size={16} aria-hidden="true" />} onClick={start}>Modifier la liste</Button>
                )}
            </div>

            {saved && <StatusBanner tone="success" title="Liste enregistrée">{saved}</StatusBanner>}

            {!editing ? (
                <>
                    <ul className="flex flex-wrap gap-2" aria-label={`${formatInteger(data.keywords.length)} mots`}>
                        {data.keywords.map((w) => (
                            <li key={w} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground-strong">{w}</li>
                        ))}
                    </ul>
                    {!data.canEditKeywords && (
                        <p className="text-sm text-muted-foreground">Seul un super-administrateur peut modifier la liste.</p>
                    )}
                </>
            ) : (
                <form
                    className="space-y-4"
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        void save();
                    }}
                >
                    <Textarea
                        label="Mots (un par ligne)"
                        hint="De 1 à 100 mots, de 2 à 40 lettres chacun."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={8}
                    />
                    <Textarea
                        label="Motif du changement"
                        hint="Gardé dans l’historique des réglages."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        maxLength={300}
                        error={error ?? undefined}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="submit" isLoading={saving} disabled={saving || reason.trim().length < 3}>Enregistrer la liste</Button>
                        <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Annuler</Button>
                    </div>
                </form>
            )}
        </Card>
    );
}
