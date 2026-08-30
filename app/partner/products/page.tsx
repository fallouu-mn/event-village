'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ShoppingBag,
    Plus,
    RefreshCw,
    Pencil,
    Trash2,
    Star,
    Package,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    status: 'DISPONIBLE' | 'INDISPONIBLE' | 'EPUISE' | 'SUSPENDU';
    is_daily_special: boolean;
    images: string[];
    category_id: string | null;
    created_at: string;
}

export default function PartnerProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toggleLoading, setToggleLoading] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; productId: string | null }>({ isOpen: false, productId: null });
    const [deleteLoading, setDeleteLoading] = useState(false);
    const toast = useToast();

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/partner/products', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setProducts(data.products || []);
            }
        } catch {
            toast.error('Erreur lors du chargement des produits.');
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleToggleStock = async (product: Product) => {
        const newStatus = product.status === 'DISPONIBLE' ? 'INDISPONIBLE' : 'DISPONIBLE';
        setToggleLoading(product.id);
        try {
            const res = await fetch(`/api/partner/products/${product.id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setProducts((prev) =>
                    prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
                );
                toast.success(`Produit ${newStatus === 'DISPONIBLE' ? 'remis en stock' : 'mis en rupture'}.`);
            } else {
                toast.error(data.error || 'Echec du changement de statut.');
            }
        } catch {
            toast.error('Erreur reseau.');
        } finally {
            setToggleLoading(null);
        }
    };

    const confirmDeleteProduct = async () => {
        const productId = deleteConfirm.productId;
        if (!productId) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/partner/products/${productId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast.success('Produit supprime.');
                setProducts((prev) => prev.filter((p) => p.id !== productId));
            } else {
                toast.error(data.error || 'Echec de la suppression.');
            }
        } catch {
            toast.error('Erreur reseau lors de la suppression.');
        } finally {
            setDeleteLoading(false);
            setDeleteConfirm({ isOpen: false, productId: null });
        }
    };

    const totalProducts = products.length;
    const inStock = products.filter((p) => p.status === 'DISPONIBLE').length;
    const dailySpecials = products.filter((p) => p.is_daily_special).length;

    const getStatusBadge = (status: Product['status']) => {
        switch (status) {
            case 'DISPONIBLE':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                        En stock
                    </span>
                );
            case 'INDISPONIBLE':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/60">
                        Rupture
                    </span>
                );
            case 'EPUISE':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700">
                        Epuise
                    </span>
                );
            case 'SUSPENDU':
                return (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                        Suspendu
                    </span>
                );
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <ShoppingBag className="w-8 h-8 text-[#FF6B35]" />
                        Produits &amp; Menu
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                        Gerez votre catalogue de produits et plats pour la restauration
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchProducts} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                    <Link href="/partner/products/new">
                        <Button className="bg-[#FF6B35] hover:bg-[#ff5719] text-white shadow-lg shadow-[#FF6B35]/20">
                            <Plus className="w-4 h-4 mr-1.5" />
                            Creer un produit
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#FF6B35] flex items-center justify-center">
                        <Package className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Total Produits</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalProducts}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">En Stock</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{inStock}</p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                        <Star className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Plats du Jour</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{dailySpecials}</p>
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            {isLoading ? (
                <div className="p-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#FF6B35]" />
                    <p className="text-sm font-medium">Chargement des produits...</p>
                </div>
            ) : products.length === 0 ? (
                <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center mx-auto">
                        <ShoppingBag className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun produit</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                            Vous n&apos;avez pas encore cree de produit. Ajoutez votre premier article au catalogue !
                        </p>
                    </div>
                    <Link href="/partner/products/new">
                        <Button className="bg-[#FF6B35] hover:bg-[#ff5719] text-white text-xs">
                            <Plus className="w-4 h-4 mr-2" />
                            Creer un produit
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:border-[#FF6B35]/40 transition-all flex flex-col"
                        >
                            {/* Image */}
                            <div className="relative h-40 bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                {product.images && product.images.length > 0 ? (
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-center p-4">
                                        <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                        <span className="text-xs text-slate-400 font-medium">Pas d&apos;image</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                    {product.is_daily_special && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white flex items-center gap-1">
                                            <Star size={10} /> Plat du jour
                                        </span>
                                    )}
                                    {getStatusBadge(product.status)}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 space-y-3">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                    {product.name}
                                </h3>
                                {product.description && (
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
                                        {product.description}
                                    </p>
                                )}
                                <p className="text-lg font-black text-[#FF6B35]">
                                    {product.price.toLocaleString('fr-FR')} FCFA
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                                {/* Stock Toggle */}
                                <button
                                    type="button"
                                    onClick={() => handleToggleStock(product)}
                                    disabled={toggleLoading === product.id || product.status === 'SUSPENDU' || product.status === 'EPUISE'}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:ring-offset-2 disabled:opacity-50 ${
                                        product.status === 'DISPONIBLE'
                                            ? 'bg-emerald-500'
                                            : 'bg-slate-300 dark:bg-zinc-600'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                            product.status === 'DISPONIBLE' ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>

                                <div className="flex items-center gap-1.5">
                                    <Link href={`/partner/products/new?edit=${product.id}`}>
                                        <Button size="sm" variant="ghost" className="text-xs p-1.5">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                    </Link>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        onClick={() => setDeleteConfirm({ isOpen: true, productId: product.id })}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, productId: null })}
                onConfirm={confirmDeleteProduct}
                title="Supprimer ce produit ?"
                message="Cette action est irreversible. Le produit sera definitivement supprime du catalogue."
                confirmLabel="Supprimer"
                variant="danger"
                isLoading={deleteLoading}
            />
        </div>
    );
}
