'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, ShoppingBag, CalendarDays, Package, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useToast } from '@/components/ui/Toast';

const productSchema = z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
    description: z.string().optional(),
    price: z.number().min(0, 'Le prix ne peut pas être négatif.'),
    is_daily_special: z.boolean().default(false),
    daily_special_date: z.string().optional(),
    stock_quantity: z.number().int().min(0).optional(),
    is_stock_managed: z.boolean().default(false),
});

type FormErrors = Partial<Record<keyof z.infer<typeof productSchema>, string>>;

function ProductFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useToast();

    const editId = searchParams.get('edit');
    const isEditMode = Boolean(editId);

    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState<number | ''>('');
    const [imageUrl, setImageUrl] = useState('');
    const [isDailySpecial, setIsDailySpecial] = useState(false);
    const [dailySpecialDate, setDailySpecialDate] = useState('');
    const [isStockManaged, setIsStockManaged] = useState(false);
    const [stockQuantity, setStockQuantity] = useState<number | ''>('');

    useEffect(() => {
        if (!editId) return;

        setIsLoadingProduct(true);
        fetch(`/api/partner/products/${editId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.product) {
                    const p = data.product;
                    setName(p.name || '');
                    setDescription(p.description || '');
                    setPrice(p.price ?? '');
                    setImageUrl(p.images?.[0] || p.image_url || '');
                    setIsDailySpecial(p.is_daily_special ?? false);
                    setDailySpecialDate(p.daily_special_date || '');
                    setIsStockManaged(p.is_stock_managed ?? false);
                    setStockQuantity(p.stock_quantity ?? '');
                } else {
                    toast.error(data.error || 'Impossible de charger le produit.');
                }
            })
            .catch(() => {
                toast.error('Erreur réseau lors du chargement du produit.');
            })
            .finally(() => setIsLoadingProduct(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const parsed = productSchema.safeParse({
            name,
            description: description || undefined,
            price: price === '' ? -1 : Number(price),
            is_daily_special: isDailySpecial,
            daily_special_date: isDailySpecial ? dailySpecialDate || undefined : undefined,
            stock_quantity: isStockManaged ? (stockQuantity === '' ? 0 : Number(stockQuantity)) : undefined,
            is_stock_managed: isStockManaged,
        });

        if (!parsed.success) {
            const fieldErrors: FormErrors = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as keyof FormErrors;
                if (!fieldErrors[key]) {
                    fieldErrors[key] = issue.message;
                }
            }
            setErrors(fieldErrors);
            return;
        }

        setIsSubmitting(true);

        const payload = {
            name: parsed.data.name,
            description: parsed.data.description || null,
            price: parsed.data.price,
            is_daily_special: parsed.data.is_daily_special,
            daily_special_date: parsed.data.is_daily_special ? parsed.data.daily_special_date || null : null,
            stock_quantity: parsed.data.is_stock_managed ? parsed.data.stock_quantity ?? 0 : null,
            is_stock_managed: parsed.data.is_stock_managed,
            images: imageUrl ? [imageUrl] : [],
        };

        try {
            const url = isEditMode
                ? `/api/partner/products/${editId}`
                : '/api/partner/products';
            const method = isEditMode ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                toast.success(
                    isEditMode
                        ? 'Produit mis à jour avec succès !'
                        : 'Produit créé avec succès !'
                );
                router.push('/partner/products');
            } else {
                toast.error(data.error || 'Une erreur est survenue.');
            }
        } catch {
            toast.error('Erreur reseau lors de l\'enregistrement.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingProduct) {
        return (
            <div className="p-8 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 text-[#FF5722] animate-spin" />
                <span className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
                    Chargement du produit...
                </span>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link
                    href="/partner/products"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF5722]"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux produits
                </Link>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <ShoppingBag className="w-7 h-7 text-[#FF5722]" />
                    {isEditMode ? 'Modifier le produit' : 'Ajouter un Produit'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    {isEditMode
                        ? 'Mettez à jour les informations de votre produit.'
                        : 'Créez un nouveau produit pour votre catalogue restauration.'}
                </p>
            </div>

            {/* Form */}
            <form
                onSubmit={handleSubmit}
                className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm"
            >
                <div className="space-y-5">
                    {/* Nom du produit */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Nom du produit <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Thiéboudienne Royal"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        {errors.name && (
                            <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.name}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Description
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Décrivez le produit, ses ingrédients, sa préparation..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        {errors.description && (
                            <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.description}</p>
                        )}
                    </div>

                    {/* Prix */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Prix (FCFA) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            placeholder="Ex: 3500"
                            value={price}
                            onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        {errors.price && (
                            <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.price}</p>
                        )}
                    </div>

                    {/* Image */}
                    <ImageUpload
                        value={imageUrl}
                        onChange={setImageUrl}
                        folder="products"
                        label="Photo du produit"
                    />

                    {/* Plat du jour */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-[#FF5722] transition-all">
                            <input
                                type="checkbox"
                                checked={isDailySpecial}
                                onChange={(e) => setIsDailySpecial(e.target.checked)}
                                className="accent-[#FF5722] mt-0.5"
                            />
                            <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <CalendarDays className="w-4 h-4 text-[#FF5722]" />
                                    Plat du jour
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                    Ce produit sera mis en avant comme plat du jour à la date sélectionnée.
                                </p>
                            </div>
                        </label>

                        {isDailySpecial && (
                            <div className="ml-4 pl-4 border-l-2 border-[#FF5722]/30">
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                    Date du plat du jour
                                </label>
                                <input
                                    type="date"
                                    value={dailySpecialDate}
                                    onChange={(e) => setDailySpecialDate(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                />
                                {errors.daily_special_date && (
                                    <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.daily_special_date}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Gestion de stock */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-[#FF5722] transition-all">
                            <input
                                type="checkbox"
                                checked={isStockManaged}
                                onChange={(e) => setIsStockManaged(e.target.checked)}
                                className="accent-[#FF5722] mt-0.5"
                            />
                            <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-[#FF5722]" />
                                    Gestion de stock
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                    Activez le suivi des quantités disponibles pour ce produit.
                                </p>
                            </div>
                        </label>

                        {isStockManaged && (
                            <div className="ml-4 pl-4 border-l-2 border-[#FF5722]/30">
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                    Quantité en stock
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Ex: 50"
                                    value={stockQuantity}
                                    onChange={(e) => setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                />
                                {errors.stock_quantity && (
                                    <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.stock_quantity}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit */}
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting}
                        leftIcon={isSubmitting ? undefined : <Save className="w-4 h-4" />}
                        isLoading={isSubmitting}
                    >
                        {isSubmitting
                            ? (isEditMode ? 'Mise à jour...' : 'Création en cours...')
                            : (isEditMode ? 'Enregistrer les modifications' : 'Enregistrer le produit')}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default function NewProductPage() {
    return (
        <Suspense
            fallback={
                <div className="p-8 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#FF5722] animate-spin" />
                    <span className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
                        Chargement...
                    </span>
                </div>
            }
        >
            <ProductFormContent />
        </Suspense>
    );
}
