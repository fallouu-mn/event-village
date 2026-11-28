'use client';

/**
 * Lot 12c — création et fiche d'un produit de la partenaire : établissement (choisi à la création, jamais changé), photo,
 * nom, description, catégorie, prix entier, stock, plat du jour et portions du jour, case « réglementé » et sorte (avec ce
 * que cela change, lu AVANT de cocher), suppléments, aperçu « vue client ». Écritures par les routes serveur (le produit
 * passe par order_product_save en base, qui pose l'état « à vérifier »). Produit absent, archivé ou d'une autre
 * partenaire : « Cet élément n'est plus disponible ». Fiche suspendue : lecture seule.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Save, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { UnavailableItem } from '@/components/ui/UnavailableItem';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { REGULATED_EXPLANATION, VENUE_KIND_LABELS, reviewReason } from '@/lib/orders/partner-ui';
import { portionsLeft, type CatalogProduct, type CatalogResponse } from './catalog-client';
import { AllergensPicker } from './AllergensPicker';
import { CategoryPicker, type CategoryChoice } from './CategoryPicker';
import { DailyPortions } from './DailyPortions';
import { ProductBadges } from './ProductBadges';
import { ProductOptionsEditor } from './ProductOptionsEditor';
import { ProductPreview } from './ProductPreview';

interface FormState {
    venueId: string;
    categoryId: string;
    name: string;
    description: string;
    price: string;
    image: string;
    stockManaged: boolean;
    stock: string;
    daily: boolean;
    regulated: boolean;
    kind: string;
    /** Lot 12d : allergènes et piment, enregistrés juste après le produit (PUT …/details). */
    allergens: string[];
    spiceLevel: number | null;
}

type Errors = Partial<Record<'venueId' | 'name' | 'price' | 'stock' | 'kind', string>>;

const EMPTY: FormState = {
    venueId: '', categoryId: '', name: '', description: '', price: '', image: '', stockManaged: false, stock: '', daily: false, regulated: false, kind: '',
    allergens: [], spiceLevel: null,
};

function fromProduct(p: CatalogProduct): FormState {
    return {
        venueId: p.venueId ?? '', categoryId: p.categoryId ?? '', name: p.name, description: p.description ?? '', price: String(p.price),
        image: p.images[0] ?? '', stockManaged: p.stockManaged, stock: p.stock === null ? '' : String(p.stock), daily: p.isDailySpecial,
        regulated: p.isRegulated, kind: p.regulatedKind ?? '',
        allergens: Array.isArray(p.allergens) ? p.allergens : [], spiceLevel: p.spiceLevel ?? null,
    };
}

function validate(f: FormState, creating: boolean): Errors {
    const e: Errors = {};
    if (creating && !f.venueId) e.venueId = 'Choisissez l’établissement qui vend ce produit.';
    if (!f.name.trim()) e.name = 'Indiquez le nom du produit.';
    if (!/^\d{1,8}$/.test(f.price.trim()) || Number(f.price) > 10_000_000) e.price = 'Indiquez un prix en F CFA, nombre entier de 0 à 10 000 000.';
    if (f.stockManaged && !/^\d{1,7}$/.test(f.stock.trim())) e.stock = 'Indiquez le stock, nombre entier.';
    if (f.regulated && !f.kind) e.kind = 'Choisissez alcool ou tabac.';
    return e;
}

export function ProductEditor({ productId, initialVenue }: { productId: string | null; initialVenue: string | null }) {
    const router = useRouter();
    const toast = useToast();
    const catalog = useServerData<CatalogResponse>('/api/partner/catalog');
    const [product, setProduct] = useState<CatalogProduct | null>(null);
    const [productState, setProductState] = useState<'loading' | 'ready' | 'missing' | 'error'>(productId ? 'loading' : 'ready');
    const [productError, setProductError] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>({ ...EMPTY, venueId: initialVenue ?? '' });
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [createdCategories, setCreatedCategories] = useState<CategoryChoice[]>([]);

    const loadProduct = useCallback(async (resetForm: boolean) => {
        if (!productId) return;
        try {
            const body = await fetchJson<{ product: CatalogProduct }>(`/api/partner/products/${productId}`);
            setProduct(body.product);
            if (resetForm) setForm(fromProduct(body.product));
            setProductState('ready');
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) setProductState('missing');
            else {
                setProductError(errorMessage(err, 'Produit momentanément indisponible.'));
                setProductState('error');
            }
        }
    }, [productId]);

    useEffect(() => {
        void loadProduct(true);
    }, [loadProduct]);

    const venues = useMemo(() => catalog.data?.venues ?? [], [catalog.data]);
    // Création : un seul établissement → choisi d'office
    useEffect(() => {
        if (!productId && venues.length === 1 && !form.venueId) setForm((f) => ({ ...f, venueId: venues[0].id }));
    }, [productId, venues, form.venueId]);

    const readOnly = catalog.data?.partnerStatus === 'SUSPENDU';
    const creating = productId === null;
    const venue = venues.find((v) => v.id === (product?.venueId ?? form.venueId)) ?? null;
    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

    /** Lot 12d : PUT /api/partner/products/[id]/details (refus du serveur levé tel quel). */
    async function saveDetails(id: string): Promise<void> {
        await fetchJson(`/api/partner/products/${encodeURIComponent(id)}/details`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allergens: form.allergens, spiceLevel: form.spiceLevel }),
        });
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const found = validate(form, creating);
        setErrors(found);
        setSaveError(null);
        if (Object.keys(found).length > 0) return;
        const body: Record<string, unknown> = {
            category_id: form.categoryId || null,
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: Number(form.price),
            is_daily_special: form.daily,
            is_stock_managed: form.stockManaged,
            stock_quantity: form.stockManaged ? Number(form.stock) : null,
            images: form.image ? [form.image] : [],
            is_regulated: form.regulated,
            regulated_kind: form.regulated ? form.kind : null,
        };
        setSaving(true);
        try {
            if (creating) {
                const r = await sendJson<{ product: { id: string; review_state?: string | null } }>('/api/partner/products', 'POST', { ...body, venue_id: form.venueId });
                // Lot 12d : allergènes et piment, juste après la création (le produit existe déjà s'ils échouent)
                if (form.allergens.length > 0 || form.spiceLevel !== null) {
                    try {
                        await saveDetails(r.product.id);
                    } catch (err) {
                        toast.error(errorMessage(err, 'Produit enregistré, mais pas ses allergènes : indiquez-les de nouveau.'));
                    }
                }
                toast.success(r.product.review_state ? 'Produit enregistré : il passe en vérification par Event Village.' : 'Produit enregistré. Ajoutez ses suppléments si besoin.');
                router.push(`/partner/products/${r.product.id}`);
                return;
            }
            const r = await sendJson<{ product: { review_state?: string | null } }>(`/api/partner/products/${productId}`, 'PATCH', body);
            // Lot 12d : allergènes et piment, juste après le produit (seulement s'ils ont changé)
            const sameAllergens = product && [...form.allergens].sort().join(',') === [...(product.allergens ?? [])].sort().join(',');
            if (!sameAllergens || form.spiceLevel !== (product?.spiceLevel ?? null)) {
                try {
                    await saveDetails(productId);
                } catch (err) {
                    setSaveError(`Produit enregistré, mais pas ses allergènes : ${errorMessage(err, 'réessayez.')}`);
                    await loadProduct(false);
                    return;
                }
            }
            toast.success(r.product.review_state ? 'Modifications enregistrées. Le produit est en vérification par Event Village.' : 'Modifications enregistrées.');
            await Promise.all([loadProduct(true), catalog.reload()]);
        } catch (err) {
            setSaveError(errorMessage(err, 'Produit non enregistré. Réessayez.'));
        } finally {
            setSaving(false);
        }
    }

    const back = { href: venue ? `/partner/products?etablissement=${venue.id}` : '/partner/products', label: 'Ma carte' };

    if (productState === 'missing') {
        return <UnavailableItem actionLabel="Retour à ma carte" actionHref="/partner/products" />;
    }
    if (productState === 'error' || (catalog.error && !catalog.data)) {
        return (
            <div className="mx-auto w-full max-w-5xl">
                <PageHeader back={back} title={creating ? 'Nouveau produit' : 'Produit'} />
                <ErrorState title="Produit indisponible" description={productError ?? catalog.error ?? undefined}
                    onRetry={() => { void catalog.reload(); void loadProduct(true); }} />
            </div>
        );
    }
    if (productState === 'loading' || (catalog.loading && !catalog.data)) {
        return (
            <div className="mx-auto w-full max-w-5xl" role="status" aria-busy="true">
                <Skeleton className="mb-6 h-9 w-56" />
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-40 w-full" /></div>
                    <Skeleton className="h-96 w-full" />
                </div>
                <span className="sr-only">Chargement du produit…</span>
            </div>
        );
    }

    if (creating && venues.length === 0) {
        return (
            <div className="mx-auto w-full max-w-5xl">
                <PageHeader back={back} title="Nouveau produit" />
                <StatusBanner tone="info" title="Créez d’abord un établissement"
                    action={<LinkButton href="/partner/tables" variant="secondary" size="sm">Mes établissements</LinkButton>}>
                    Chaque produit est vendu par un établissement (restaurant, bar, boutique).
                </StatusBanner>
            </div>
        );
    }

    const preview = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: /^\d{1,8}$/.test(form.price.trim()) ? Number(form.price) : null,
        image: form.image || null,
        isDailySpecial: form.daily,
        isRegulated: form.regulated,
        underReview: product?.underReview ?? false,
        refused: product?.adminDecision === true,
        available: (product?.status ?? 'DISPONIBLE') === 'DISPONIBLE',
        portionsLeft: product ? portionsLeft(product.portionsToday) : null,
        options: product?.options ?? [],
    };
    // Catégories de la partenaire, plus celles créées depuis ce formulaire (sans attendre une nouvelle lecture du catalogue)
    const served = catalog.data?.categories ?? [];
    const categories = [...served, ...createdCategories.filter((c) => !served.some((x) => x.id === c.id))];

    return (
        <div className="mx-auto w-full max-w-5xl pb-6">
            <PageHeader
                back={back}
                eyebrow={product ? <ProductBadges product={product} /> : undefined}
                title={creating ? 'Nouveau produit' : product?.name ?? 'Produit'}
                description={creating ? 'Une photo, un nom, un prix : le reste est facultatif. Vous ajouterez les suppléments et les portions du jour juste après.' : undefined}
            />

            {readOnly && (
                <StatusBanner tone="suspended" title="Votre fiche est suspendue" className="mb-4">
                    Ce produit reste visible, mais il ne se modifie plus. Contactez le support pour en savoir plus.
                </StatusBanner>
            )}
            {product?.underReview && (
                <StatusBanner tone="info" title="En vérification par Event Village" className="mb-4">
                    {reviewReason(product.reviewWords)} En attendant, il est affiché sans pouvoir être commandé en ligne.
                </StatusBanner>
            )}
            {product?.adminDecision === true && !product.underReview && (
                <StatusBanner tone="danger" title="Refusé à la vente en ligne" className="mb-4">
                    Event Village a décidé que ce produit ne se vend pas en ligne. Il reste affiché avec son prix : vos clients l’achètent sur place.
                </StatusBanner>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-4">
                <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
                    <fieldset disabled={readOnly || saving} className="min-w-0 space-y-4">
                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Établissement</h2>
                            {creating ? (
                                <Select
                                    label="Vendu par"
                                    required
                                    placeholder="Choisir l’établissement"
                                    value={form.venueId}
                                    onChange={(e) => set('venueId', e.target.value)}
                                    error={errors.venueId}
                                    hint="Choisi une fois pour toutes : il ne change plus ensuite."
                                    options={venues.map((v) => ({ value: v.id, label: `${v.name} (${VENUE_KIND_LABELS[v.kind] ?? 'établissement'})` }))}
                                />
                            ) : (
                                <div className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
                                    <Lock size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-semibold text-foreground-strong">{venue?.name ?? 'Sans établissement'}</p>
                                        <p className="text-sm text-muted-foreground">L’établissement ne change pas. Pour le vendre ailleurs, créez-le dans l’autre établissement.</p>
                                    </div>
                                </div>
                            )}
                        </Card>

                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Le produit</h2>
                            <ImageUpload value={form.image} onChange={(url) => set('image', url)} folder="products" label="Photo"
                                hint="Une photo nette du plat, prise de près. JPG, PNG ou WebP, 5 Mo au plus." cardPreview downscale={1600} />
                            <TextInput label="Nom" required maxLength={200} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="Thiéboudienne" />
                            <Textarea label="Description" maxLength={2000} showCount rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
                                placeholder="Riz au poisson, légumes du marché" />
                            <CategoryPicker
                                categories={categories}
                                value={form.categoryId}
                                onChange={(id) => set('categoryId', id)}
                                onCreated={(c) => setCreatedCategories((list) => (list.some((x) => x.id === c.id) ? list : [...list, c]))}
                                readOnly={readOnly}
                            />
                        </Card>

                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Prix et stock</h2>
                            <TextInput label="Prix (F CFA)" required inputMode="numeric" value={form.price} error={errors.price}
                                onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} hint="Nombre entier, sans virgule ni espace." fieldClassName="sm:max-w-xs" />
                            <Switch label="Suivre le stock" description="Le produit passe en « épuisé » tout seul quand le stock tombe à zéro."
                                checked={form.stockManaged} onChange={(v) => set('stockManaged', v)} disabled={readOnly} />
                            {form.stockManaged && (
                                <TextInput label="Quantité en stock" inputMode="numeric" value={form.stock} error={errors.stock}
                                    onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} fieldClassName="sm:max-w-xs" />
                            )}
                        </Card>

                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Plat du jour</h2>
                            <Switch label="C’est un plat du jour" description="Mis en avant sur votre carte, vendu en nombre de portions par jour, payé en entier."
                                checked={form.daily} onChange={(v) => set('daily', v)} disabled={readOnly} />
                            {form.daily && product && product.isDailySpecial && (
                                <p className="text-sm text-muted-foreground">Indiquez les portions d’aujourd’hui plus bas, sous « Portions du jour ».</p>
                            )}
                            {form.daily && (!product || !product.isDailySpecial) && (
                                <p className="text-sm text-muted-foreground">Enregistrez le produit, puis indiquez ses portions du jour ici.</p>
                            )}
                        </Card>

                        {/* Lot 12d : allergènes et piment */}
                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Allergènes et piment</h2>
                            <AllergensPicker allergens={form.allergens} spiceLevel={form.spiceLevel} disabled={readOnly}
                                onChange={(n) => setForm((f) => ({ ...f, allergens: n.allergens, spiceLevel: n.spiceLevel }))} />
                        </Card>

                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground-strong">
                                <ShieldAlert size={20} className="text-warning-text" aria-hidden="true" /> Produit réglementé
                            </h2>
                            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm leading-relaxed text-warning-text">{REGULATED_EXPLANATION}</p>
                            <Switch label="Ce produit est réglementé (alcool, tabac)" checked={form.regulated} onChange={(v) => set('regulated', v)} disabled={readOnly} />
                            {form.regulated && (
                                <Select label="Sorte" required value={form.kind} onChange={(e) => set('kind', e.target.value)} error={errors.kind}
                                    placeholder="Choisir" options={[{ value: 'ALCOOL', label: 'Alcool' }, { value: 'TABAC', label: 'Tabac' }]} fieldClassName="sm:max-w-xs" />
                            )}
                        </Card>
                    </fieldset>

                    {saveError && <StatusBanner tone="danger" title="Produit non enregistré" announce="alert">{saveError}</StatusBanner>}
                    {!readOnly && (
                        <div className="flex flex-wrap justify-end gap-3">
                            <LinkButton href={back.href} variant="ghost">Annuler</LinkButton>
                            <Button type="submit" variant="primary" isLoading={saving} leftIcon={<Save size={18} aria-hidden="true" />}>
                                {creating ? 'Enregistrer le produit' : 'Enregistrer les modifications'}
                            </Button>
                        </div>
                    )}

                </form>

                    {product && product.isDailySpecial && (
                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Portions du jour</h2>
                            <DailyPortions productId={product.id} portions={product.portionsToday} readOnly={readOnly}
                                onChanged={() => loadProduct(false)} key={`${product.id}-${product.updatedAt}`} />
                        </Card>
                    )}

                    {product && (
                        <Card className="space-y-4 p-4 sm:p-5">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground-strong">Suppléments</h2>
                                <p className="text-sm text-muted-foreground">Le client les choisit en plus du plat. Le prix d’une commande déjà passée ne change jamais.</p>
                            </div>
                            <ProductOptionsEditor productId={product.id} options={product.options} readOnly={readOnly} onChanged={() => loadProduct(false)} />
                        </Card>
                    )}
                </div>

                <aside className="lg:sticky lg:top-24">
                    <ProductPreview product={preview} />
                </aside>
            </div>
        </div>
    );
}
