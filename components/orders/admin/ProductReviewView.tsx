'use client';

/**
 * Lot 12c — « Produits à vérifier » (administration, droit partners.validate) :
 *  - file : produits dont le nom, la description ou un supplément contient un mot de la liste, et produits marqués
 *    « réglementé » par leur partenaire sans décision ; photo, texte, suppléments, mots trouvés surlignés ;
 *  - décision « Autoriser à la vente » ou « Refuser à la vente », motif obligatoire (POST
 *    /api/admin/products/[id]/regulation) ; la partenaire est prévenue ;
 *  - historique des décisions ; liste des mots (modifiable par un super-administrateur, avec motif).
 * Tout vient de GET /api/admin/products/review ; les refus du serveur sont affichés tels quels.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImageOff, ListChecks, Pencil, ShieldAlert, ShieldCheck, Store, Tags, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabPanel, useTabParam } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { fetchJson, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { highlightWords } from '@/lib/orders/review-highlight';
import { REGULATED_KIND_LABELS } from '@/lib/orders/partner-ui';

interface QueueItem {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image: string | null;
    reason: 'MOTS' | 'CASE';
    words: string[];
    partnerBox: boolean;
    regulatedKind: string | null;
    requestedAt: string;
    venueName: string | null;
    partnerName: string | null;
    options: Array<{ name: string; price: number; active: boolean }>;
}
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
    queue: QueueItem[];
    history: HistoryItem[];
}

const TABS = ['file', 'historique', 'mots'] as const;
type TabKey = (typeof TABS)[number];
const ID_PREFIX = 'produits-a-verifier';

/** Texte avec les mots de la liste surlignés (marque + libellé caché pour les lecteurs d'écran). */
function Highlighted({ text, words }: { text: string; words: readonly string[] }) {
    const parts = useMemo(() => highlightWords(text, words), [text, words]);
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

export function ProductReviewView({ focusId }: { focusId: string | null }) {
    const [tab, setTab] = useTabParam<TabKey>(TABS, 'file');
    const [data, setData] = useState<ReviewReply | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [decision, setDecision] = useState<Decision>(null);
    const [deciding, setDeciding] = useState(false);
    const [decisionError, setDecisionError] = useState<string | undefined>(undefined);
    const [done, setDone] = useState<string | null>(null);

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
            const r = await sendJson<{ message?: string }>(`/api/admin/products/${decision.item.id}/regulation`, 'POST', { regulated: !decision.allow, reason });
            setDone(`${decision.item.name} : ${r.message ?? (decision.allow ? 'autorisé à la vente.' : 'refusé à la vente.')} La partenaire est prévenue.`);
            setDecision(null);
            await load();
        } catch (err) {
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
                description="Un produit dont le nom, la description ou un supplément contient un mot de la liste ne se vend pas en ligne tant que vous n’avez pas décidé. Les produits marqués « réglementé » par leur partenaire sont aussi listés."
            />

            {done && (
                <StatusBanner tone="success" title="Décision enregistrée">
                    {done}
                </StatusBanner>
            )}

            <Tabs
                ariaLabel="Produits à vérifier"
                idPrefix={ID_PREFIX}
                value={tab}
                onChange={(id) => setTab(id as TabKey)}
                tabs={[
                    { id: 'file', label: 'À vérifier', count: data ? queue.length : undefined },
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
                                                                <Highlighted text={item.name} words={item.words} />
                                                            </h2>
                                                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                                                <span className="inline-flex items-center gap-1"><Store size={14} aria-hidden="true" />{item.venueName ?? 'Sans établissement'}</span>
                                                                {item.partnerName && <span>{item.partnerName}</span>}
                                                                <span>Signalé le <time dateTime={item.requestedAt} className="tabular-nums">{formatDateTime(item.requestedAt)}</time></span>
                                                            </p>
                                                        </div>
                                                        <span className="text-xl font-bold tabular-nums text-foreground-strong">{formatFcfa(item.price)}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.reason === 'MOTS' && (
                                                            <Badge variant="warning" icon={<ShieldAlert size={14} aria-hidden="true" />}>
                                                                {item.words.length > 1 ? 'Mots trouvés' : 'Mot trouvé'} : {item.words.join(', ')}
                                                            </Badge>
                                                        )}
                                                        {item.partnerBox && (
                                                            <Badge variant="info" icon={<Tags size={14} aria-hidden="true" />}>
                                                                Marqué réglementé par la partenaire{item.regulatedKind ? ` (${REGULATED_KIND_LABELS[item.regulatedKind] ?? 'autre'})` : ''}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {item.description && (
                                                        <p className="whitespace-pre-line break-words text-sm text-foreground">
                                                            <Highlighted text={item.description} words={item.words} />
                                                        </p>
                                                    )}
                                                    {item.options.length > 0 && (
                                                        <div className="text-sm">
                                                            <p className="font-medium text-foreground-strong">Suppléments</p>
                                                            <ul className="mt-1 flex flex-wrap gap-2">
                                                                {item.options.map((o, i) => (
                                                                    <li key={`${o.name}-${i}`} className="rounded-lg border border-border bg-background px-2.5 py-1">
                                                                        <Highlighted text={o.name} words={item.words} />{' '}
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
                                                            onClick={() => { setDone(null); setDecisionError(undefined); setDecision({ item, allow: true }); }}
                                                        >
                                                            Autoriser à la vente
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            leftIcon={<XCircle size={18} aria-hidden="true" />}
                                                            onClick={() => { setDone(null); setDecisionError(undefined); setDecision({ item, allow: false }); }}
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

function KeywordsPanel({ data, onSaved }: { data: ReviewReply; onSaved: () => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const start = () => {
        setDraft(data.keywords.join('\n'));
        setReason('');
        setError(null);
        setSaved(false);
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
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            if (!res.ok) throw new Error(body?.error ?? 'Liste non enregistrée. Réessayez.');
            setEditing(false);
            setSaved(true);
            await onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Liste non enregistrée. Réessayez.');
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
                        Comparés sans accents ni majuscules, au début d’un mot (« vin » trouve « vins », pas « vinaigrette »). La liste vaut pour les produits enregistrés à partir de maintenant.
                    </p>
                    {data.keywordsUpdatedAt && (
                        <p className="text-sm text-muted-foreground">Modifiée le <time dateTime={data.keywordsUpdatedAt} className="tabular-nums">{formatDateTime(data.keywordsUpdatedAt)}</time></p>
                    )}
                </div>
                {data.canEditKeywords && !editing && (
                    <Button variant="secondary" leftIcon={<Pencil size={16} aria-hidden="true" />} onClick={start}>Modifier la liste</Button>
                )}
            </div>

            {saved && <StatusBanner tone="success" title="Liste enregistrée">Les prochains produits enregistrés seront comparés à cette liste.</StatusBanner>}

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
