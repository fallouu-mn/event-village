'use client';

/**
 * Lot 12c — catalogue de la partenaire (/partner/products) : un établissement à la fois, plat du jour mis en avant avec sa
 * jauge de portions, grille de cartes (photo, prix en grand, pastilles d'état), filtres par catégorie, disponibilité en un
 * geste, retrait (supprimé s'il n'a jamais été vendu, archivé sinon). Tout est lu sur GET /api/partner/catalog ; aucun
 * montant n'est calculé ici. Fiche suspendue : lecture seule (aucun bouton d'écriture).
 * Contre-vérification du lot 12c : produits archivés « Remettre en vente » (revus par la liste des mots), motif d'une
 * mise « à vérifier » par l'administration, renommage de la catégorie choisie (un nom avec un mot de la liste met ses
 * produits « à vérifier »).
 */
import React, { useMemo, useState } from 'react';
import { Archive, Clock, Pencil, Plus, RotateCcw, Settings2, Trash2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { useServerData } from '@/components/partner/useServerData';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatFcfa, formatInteger } from '@/lib/format';
import { PRODUCT_STATUSES, PRODUCT_STATUS_META, reviewReason } from '@/lib/orders/partner-ui';
import { NO_VENUE, portionsGauge, portionsLeft, type CatalogProduct, type CatalogResponse } from './catalog-client';
import { ProductBadges } from './ProductBadges';
import { ProductVisual } from './ProductVisual';
import { VenuePicker } from './VenuePicker';

const STATUS_OPTIONS = PRODUCT_STATUSES.map((s) => ({ value: s, label: PRODUCT_STATUS_META[s].label }));

export function CatalogView({ initialVenue }: { initialVenue: string | null }) {
    const { data, error, loading, reload } = useServerData<CatalogResponse>('/api/partner/catalog');
    const toast = useToast();
    const [venuePick, setVenuePick] = useState<string | null>(initialVenue);
    const [category, setCategory] = useState<string>('');
    const [removing, setRemoving] = useState<CatalogProduct | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
    const [renameError, setRenameError] = useState<string | null>(null);

    const readOnly = data?.partnerStatus === 'SUSPENDU';
    const venueChoices = useMemo(() => {
        if (!data) return [];
        const list = data.venues.map((v) => ({ id: v.id, name: v.name, count: data.products.filter((p) => p.venueId === v.id).length }));
        const orphans = data.products.filter((p) => !p.venueId || !data.venues.some((v) => v.id === p.venueId)).length;
        if (orphans > 0) list.push({ id: NO_VENUE, name: 'Sans établissement', count: orphans });
        return list;
    }, [data]);
    const venueId = venuePick && venueChoices.some((v) => v.id === venuePick) ? venuePick : (venueChoices[0]?.id ?? null);
    const venue = data?.venues.find((v) => v.id === venueId) ?? null;

    const inVenue = useMemo(() => (data?.products ?? []).filter((p) => (venueId === NO_VENUE
        ? !p.venueId || !data?.venues.some((v) => v.id === p.venueId)
        : p.venueId === venueId)), [data, venueId]);
    const categories = useMemo(() => (data?.categories ?? []).filter((c) => inVenue.some((p) => p.categoryId === c.id)), [data, inVenue]);
    const shown = inVenue.filter((p) => !category || p.categoryId === category);
    const specials = shown.filter((p) => p.isDailySpecial);
    const others = shown.filter((p) => !p.isDailySpecial);
    const reviewCount = inVenue.filter((p) => p.underReview).length;
    const archived = (data?.archived ?? []).filter((a) => (venueId === NO_VENUE
        ? !a.venueId || !data?.venues.some((v) => v.id === a.venueId)
        : a.venueId === venueId));
    const currentCategory = categories.find((c) => c.id === category) ?? null;
    const newHref = venue ? `/partner/products/new?etablissement=${venue.id}` : '/partner/products/new';

    async function changeStatus(p: CatalogProduct, next: string) {
        if (next === p.status) return;
        setBusy(p.id);
        try {
            await sendJson(`/api/partner/products/${p.id}/status`, 'POST', { status: next });
            toast.success(`« ${p.name} » : ${PRODUCT_STATUS_META[next as keyof typeof PRODUCT_STATUS_META]?.label.toLowerCase() ?? 'disponibilité changée'}.`);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Disponibilité non enregistrée. Réessayez.'));
        } finally {
            setBusy(null);
        }
    }

    async function restore(id: string, name: string) {
        setBusy(id);
        try {
            const r = await sendJson<{ message?: string }>(`/api/partner/products/${id}/restore`, 'POST');
            toast.success(`« ${name} » : ${(r.message ?? 'Produit remis sur votre carte.').replace(/^Produit r/, 'r')}`);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Produit non remis en vente. Réessayez.'));
        } finally {
            setBusy(null);
        }
    }

    async function rename() {
        if (!renaming) return;
        const clean = renaming.name.trim().replace(/\s+/g, ' ');
        if (clean.length < 2 || clean.length > 60) {
            setRenameError('Le nom de la catégorie compte de 2 à 60 caractères.');
            return;
        }
        setBusy(renaming.id);
        setRenameError(null);
        try {
            const r = await sendJson<{ flagged?: number }>(`/api/partner/products/categories/${renaming.id}`, 'PATCH', { name: clean });
            const n = r.flagged ?? 0;
            toast.success(n > 0
                ? `Catégorie renommée : ${n > 1 ? `${formatInteger(n)} produits sont` : 'un produit est'} en vérification par Event Village.`
                : `Catégorie renommée « ${clean} ».`);
            setRenaming(null);
            await reload();
        } catch (err) {
            setRenameError(errorMessage(err, 'Catégorie non renommée. Réessayez.'));
        } finally {
            setBusy(null);
        }
    }

    async function confirmRemove() {
        if (!removing) return;
        setBusy(removing.id);
        try {
            const r = await sendJson<{ message?: string }>(`/api/partner/products/${removing.id}`, 'DELETE');
            toast.success(r.message ?? 'Produit retiré.');
            setRemoving(null);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Produit non retiré. Réessayez.'));
        } finally {
            setBusy(null);
        }
    }

    const header = (
        <PageHeader
            title="Ma carte"
            description="Vos plats et produits, établissement par établissement. Ce que vous voyez ici est ce que vos clients voient."
            actions={!readOnly && (
                <>
                    <LinkButton href={venue ? `/partner/products/vente?etablissement=${venue.id}` : '/partner/products/vente'} variant="secondary" leftIcon={<Settings2 size={18} aria-hidden="true" />}>
                        Réglages de vente
                    </LinkButton>
                    {data && data.venues.length > 0 && (
                        <LinkButton href={newHref} variant="primary" leftIcon={<Plus size={18} aria-hidden="true" />}>Ajouter un plat</LinkButton>
                    )}
                </>
            )}
        />
    );

    if (loading && !data) {
        return (
            <div className="mx-auto w-full max-w-6xl" role="status" aria-busy="true">
                {header}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                            <Skeleton className="aspect-[16/10] w-full rounded-none" />
                            <div className="space-y-2 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-7 w-1/3" /></div>
                        </div>
                    ))}
                </div>
                <span className="sr-only">Chargement de votre carte…</span>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="mx-auto w-full max-w-6xl">
                {header}
                <ErrorState title="Carte indisponible" description={error} onRetry={() => void reload()} />
            </div>
        );
    }
    if (!data) return null;

    return (
        <div className="mx-auto w-full max-w-6xl pb-6">
            {header}

            {readOnly && (
                <StatusBanner tone="suspended" title="Votre fiche est suspendue" className="mb-4">
                    Votre carte reste visible ici, mais elle ne se modifie plus. Contactez le support pour en savoir plus.
                </StatusBanner>
            )}

            {data.venues.length === 0 && data.products.length === 0 ? (
                <EmptyState
                    illustrated
                    title="Créez d’abord un établissement"
                    description="Votre carte se range par établissement (restaurant, bar, boutique). Ajoutez-en un, puis vos plats."
                    actionLabel={readOnly ? undefined : 'Mes établissements'}
                    actionHref={readOnly ? undefined : '/partner/tables'}
                />
            ) : (
                <>
                    <VenuePicker venues={venueChoices} value={venueId ?? ''} onChange={(id) => { setVenuePick(id); setCategory(''); }} />

                    {venue && !venue.validated && (
                        <StatusBanner tone="info" title="Établissement en attente de validation" className="mt-4">
                            {venue.name} ne prend pas de commande tant qu’Event Village ne l’a pas validé. Vous pouvez déjà préparer sa carte.
                        </StatusBanner>
                    )}
                    {venue && venue.validated && !venue.ordersOpen && (
                        <StatusBanner
                            tone="neutral"
                            title="Commandes en ligne fermées"
                            className="mt-4"
                            action={!readOnly && <LinkButton href={`/partner/products/vente?etablissement=${venue.id}`} variant="secondary" size="sm">Ouvrir aux commandes</LinkButton>}
                        >
                            Vos clients voient la carte de {venue.name}, mais ne peuvent pas encore commander.
                        </StatusBanner>
                    )}
                    {venueId === NO_VENUE && (
                        <StatusBanner tone="warning" title="Produits sans établissement" className="mt-4">
                            Ces produits datent d’avant les établissements : ils ne se commandent pas. Recréez-les dans un établissement, puis retirez-les.
                        </StatusBanner>
                    )}
                    {reviewCount > 0 && (
                        <StatusBanner tone="info" title={reviewCount > 1 ? `${formatInteger(reviewCount)} produits en vérification` : 'Un produit en vérification'} className="mt-4">
                            Event Village les vérifie avant la vente en ligne. Vous êtes prévenu dès qu’une décision est prise.
                        </StatusBanner>
                    )}

                    {categories.length > 0 && (
                        <div role="group" aria-label="Catégorie" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                            <FilterChip pressed={category === ''} onClick={() => setCategory('')}>Toutes</FilterChip>
                            {categories.map((c) => (
                                <FilterChip key={c.id} pressed={category === c.id} onClick={() => { setCategory(c.id); setRenaming(null); }}>{c.name}</FilterChip>
                            ))}
                            {currentCategory && !readOnly && !renaming && (
                                <Button variant="ghost" size="sm" leftIcon={<Pencil size={16} aria-hidden="true" />}
                                    onClick={() => { setRenameError(null); setRenaming({ id: currentCategory.id, name: currentCategory.name }); }}>
                                    Renommer
                                </Button>
                            )}
                        </div>
                    )}
                    {renaming && (
                        <form
                            className="mt-3 flex flex-wrap items-end gap-2"
                            noValidate
                            onSubmit={(e) => {
                                e.preventDefault();
                                void rename();
                            }}
                        >
                            <TextInput
                                label="Nouveau nom de la catégorie"
                                maxLength={60}
                                value={renaming.name}
                                fieldClassName="min-w-0 flex-1 basis-56"
                                error={renameError ?? undefined}
                                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                            />
                            <Button type="submit" variant="primary" isLoading={busy === renaming.id}>Enregistrer</Button>
                            <Button type="button" variant="ghost" onClick={() => setRenaming(null)} disabled={busy === renaming.id}>Annuler</Button>
                        </form>
                    )}

                    {inVenue.length === 0 ? (
                        <EmptyState
                            className="mt-6"
                            icon={<UtensilsCrossed size={28} aria-hidden="true" />}
                            title="Ajoutez votre premier plat"
                            description="Une photo, un nom, un prix : votre plat apparaît sur la carte de l’établissement. Vous pourrez ajouter des suppléments ensuite."
                            actionLabel={readOnly || venueId === NO_VENUE ? undefined : 'Ajouter un plat'}
                            actionHref={readOnly || venueId === NO_VENUE ? undefined : newHref}
                        />
                    ) : (
                        <>
                            {specials.length > 0 && (
                                <section aria-labelledby="plats-du-jour" className="mt-6">
                                    <h2 id="plats-du-jour" className="mb-3 text-lg font-semibold text-foreground-strong">Plat du jour</h2>
                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        {specials.map((p) => (
                                            <DailySpecialCard key={p.id} product={p} readOnly={readOnly} busy={busy === p.id}
                                                onStatus={(s) => void changeStatus(p, s)} onRemove={() => setRemoving(p)} />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {others.length > 0 && (
                                <section aria-labelledby="la-carte" className="mt-6">
                                    <h2 id="la-carte" className="mb-3 text-lg font-semibold text-foreground-strong">
                                        La carte <span className="tabular-nums text-muted-foreground">({formatInteger(others.length)})</span>
                                    </h2>
                                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {others.map((p) => (
                                            <li key={p.id}>
                                                <ProductCard product={p} readOnly={readOnly} busy={busy === p.id}
                                                    onStatus={(s) => void changeStatus(p, s)} onRemove={() => setRemoving(p)} />
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            {shown.length === 0 && (
                                <p className="mt-6 text-sm text-muted-foreground">Aucun produit dans cette catégorie.</p>
                            )}
                        </>
                    )}

                    {archived.length > 0 && (
                        <section aria-labelledby="archives" className="mt-8">
                            <h2 id="archives" className="mb-1 flex items-center gap-2 text-lg font-semibold text-foreground-strong">
                                <Archive size={18} aria-hidden="true" />
                                Produits archivés <span className="tabular-nums text-muted-foreground">({formatInteger(archived.length)})</span>
                            </h2>
                            <p className="mb-3 text-sm text-muted-foreground">
                                Retirés de votre carte après avoir été vendus. Remis en vente, ils reviennent tels qu’ils étaient ; Event Village les revoit si leur nom contient un mot à vérifier.
                            </p>
                            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                                {archived.map((a) => (
                                    <li key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                        <div className="min-w-0">
                                            <p className="break-words font-medium text-foreground-strong">{a.name}</p>
                                            <p className="text-sm text-muted-foreground tabular-nums">{formatFcfa(a.price)}</p>
                                        </div>
                                        {!readOnly && venueId !== NO_VENUE && (
                                            <Button variant="secondary" size="sm" leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                                                isLoading={busy === a.id} disabled={busy !== null && busy !== a.id}
                                                onClick={() => void restore(a.id, a.name)}>
                                                Remettre en vente
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}

            <ConfirmDialog
                isOpen={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={() => void confirmRemove()}
                title={removing ? `Retirer « ${removing.name} » ?` : 'Retirer ce produit ?'}
                message="S’il n’a jamais été commandé, il est supprimé. S’il a déjà été vendu, il est archivé : il disparaît de votre carte et reste dans l’historique de vos commandes."
                confirmLabel="Retirer"
                variant="danger"
                isLoading={removing !== null && busy === removing.id}
            />
        </div>
    );
}

interface CardProps {
    product: CatalogProduct;
    readOnly: boolean;
    busy: boolean;
    onStatus: (status: string) => void;
    onRemove: () => void;
}

function CardActions({ product, readOnly, busy, onStatus, onRemove }: CardProps) {
    if (readOnly) {
        return <LinkButton href={`/partner/products/${product.id}`} variant="secondary" size="sm" fullWidth>Voir le produit</LinkButton>;
    }
    return (
        <div className="flex flex-wrap items-end gap-2">
            <Select
                label={`Disponibilité de ${product.name}`}
                hideLabel
                fieldClassName="min-w-36 flex-1"
                value={product.status}
                onChange={(e) => onStatus(e.target.value)}
                disabled={busy}
                options={STATUS_OPTIONS}
            />
            <LinkButton href={`/partner/products/${product.id}`} variant="secondary">Modifier</LinkButton>
            <IconButton aria-label={`Retirer ${product.name}`} variant="danger" onClick={onRemove} disabled={busy}>
                <Trash2 size={18} aria-hidden="true" />
            </IconButton>
        </div>
    );
}

function ReviewNote({ product }: { product: CatalogProduct }) {
    if (!product.underReview) return null;
    return (
        <p className="flex items-start gap-1.5 rounded-lg bg-info-soft px-3 py-2 text-sm leading-snug text-info-text">
            <Clock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
                {product.reviewNote
                    ? `Event Village vérifie ce produit avant la vente en ligne. Motif : ${product.reviewNote}`
                    : reviewReason(product.reviewWords)}
            </span>
        </p>
    );
}

function ProductCard(props: CardProps) {
    const { product } = props;
    const dim = product.status !== 'DISPONIBLE';
    return (
        <Card interactive className="flex h-full flex-col overflow-hidden">
            <div className="relative">
                <ProductVisual src={product.images[0]} className={cn(dim && 'opacity-60')} />
                <div className="absolute left-3 top-3"><ProductBadges product={product} /></div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                    <h3 className="break-words text-base font-semibold leading-snug text-foreground-strong">{product.name}</h3>
                    {product.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-2xl font-bold tracking-tight text-foreground-strong tabular-nums">{formatFcfa(product.price)}</p>
                    {product.options.length > 0 && (
                        <p className="text-sm text-muted-foreground tabular-nums">
                            {product.options.length > 1 ? `${formatInteger(product.options.length)} suppléments` : '1 supplément'}
                        </p>
                    )}
                </div>
                {product.stockManaged && product.stock !== null && (
                    <p className="text-sm text-muted-foreground tabular-nums">Stock : {formatInteger(product.stock)}</p>
                )}
                <ReviewNote product={product} />
                <div className="mt-auto"><CardActions {...props} /></div>
            </div>
        </Card>
    );
}

function DailySpecialCard(props: CardProps) {
    const { product } = props;
    const left = portionsLeft(product.portionsToday);
    const gauge = portionsGauge(product.portionsToday);
    const low = left !== null && left <= 5;
    return (
        <Card className="flex flex-col overflow-hidden border-primary-text/30 sm:flex-row">
            <div className="relative sm:w-2/5">
                <ProductVisual src={product.images[0]} className="sm:aspect-auto sm:h-full" />
                <div className="absolute left-3 top-3"><ProductBadges product={product} /></div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div>
                    <h3 className="break-words text-lg font-bold leading-snug text-foreground-strong">{product.name}</h3>
                    {product.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
                </div>
                <p className="text-3xl font-bold tracking-tight text-primary-text tabular-nums">{formatFcfa(product.price)}</p>
                {product.portionsToday ? (
                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                            <span className={cn('font-semibold', low ? 'text-warning-text' : 'text-foreground-strong')}>
                                {left === 0 ? 'Plus de portions aujourd’hui' : low ? 'Bientôt épuisé' : 'Portions du jour'}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                                {formatInteger(product.portionsToday.sold)} vendues sur {formatInteger(product.portionsToday.portions)}
                            </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="img"
                            aria-label={`${formatInteger(product.portionsToday.sold)} portions vendues sur ${formatInteger(product.portionsToday.portions)}`}>
                            <div className={cn('h-full w-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-slow', low ? 'bg-warning' : 'bg-primary')}
                                style={{ transform: `scaleX(${gauge / 100})` }} />
                        </div>
                    </div>
                ) : (
                    <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-text">
                        Aucune portion indiquée pour aujourd’hui : le plat ne se commande pas. Indiquez vos portions dans sa fiche.
                    </p>
                )}
                <ReviewNote product={product} />
                <div className="mt-auto"><CardActions {...props} /></div>
            </div>
        </Card>
    );
}
