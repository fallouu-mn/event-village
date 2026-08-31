'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Utensils,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { useAuth } from '@/components/providers/AuthProvider';

export default function RestaurantMenuPage({ params }: { params: { id: string } }) {
  const restaurantId = params.id;
  const { user } = useAuth();

  const [partnerId, setPartnerId] = useState<string>(restaurantId);
  const [partnerName, setPartnerName] = useState('Restaurant & Traiteur');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryMode, setDeliveryMode] = useState<'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE'>('LIVRAISON');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    async function loadMenu() {
      if (!restaurantId) return;
      try {
        setIsLoading(true);
        const res = await fetch(`/api/restaurants/${restaurantId}/menu`);
        if (res.ok) {
          const data = await res.json();
          setMenuItems(data.menuItems || []);
          if (data.partnerId) setPartnerId(data.partnerId);
          if (data.partnerName) setPartnerName(data.partnerName);
        }
      } catch (err) {
        console.error('[RestaurantMenuPage] Erreur chargement:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMenu();
  }, [restaurantId]);

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalCartAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menuItems.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const totalFormatted = `${totalCartAmount.toLocaleString('fr-FR')} FCFA`;

  const handleCheckout = async () => {
    if (isSubmitting || totalCartCount === 0) return;
    setIsSubmitting(true);

    try {
      const itemsPayload = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          items: itemsPayload,
          deliveryMode,
          clientId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Impossible de créer la commande.');
      }

      setActiveOrderId(data.order.id);
      setIsPaymentOpen(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la validation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all shadow-xs"
        >
          <ChevronLeft size={16} />
          <span>Retour à l’accueil</span>
        </Link>

        <Link
          href={`/restaurants/${partnerId}/tables`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-[#FF5722]"
        >
          <Utensils size={14} />
          <span>Réserver une table</span>
        </Link>
      </div>

      {/* 2. Layout 2 Colonnes Desktop (Menu à gauche, Panier à droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Colonne Gauche : Catalogue des Plats & Plat du Jour */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Utensils className="text-[#FF5722]" size={28} />
              <span>Menu & Commande Traiteur — {partnerName}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Plats cuisinés minute, spécialités locales et formules traiteur pour événements.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-44 w-full rounded-3xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-56 rounded-3xl" />
                <Skeleton className="h-56 rounded-3xl" />
              </div>
            </div>
          ) : menuItems.length > 0 ? (
            <>
              {/* Plat du Jour Spécial */}
              {menuItems.filter((i) => i.isDailySpecial).map((special) => (
                <div
                  key={special.id}
                  className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-2 border-[#FF5722]/40 flex flex-col sm:flex-row gap-5 items-center shadow-xs"
                >
                  <div className="w-full sm:w-44 aspect-video sm:aspect-square rounded-2xl overflow-hidden bg-slate-950 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={special.imageUrl} alt={special.name} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 space-y-2 text-left w-full">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5722] text-white text-[10px] font-black uppercase tracking-wider">
                      <Sparkles size={12} />
                      <span>Plat du Jour Exclusif</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{special.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{special.description}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-base font-black text-[#FF5722]">{special.priceFormatted}</span>
                      <div className="flex items-center gap-2">
                        {cart[special.id] ? (
                          <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(special.id, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-slate-700 dark:text-white font-bold"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-xs font-black px-2">{cart[special.id]}</span>
                            <button
                              onClick={() => updateQuantity(special.id, 1)}
                              className="w-7 h-7 rounded-lg bg-[#FF5722] text-white flex items-center justify-center font-bold"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => updateQuantity(special.id, 1)}
                            leftIcon={<Plus size={14} />}
                          >
                            Ajouter
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Liste des autres Plats */}
              <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Toutes les spécialités
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {menuItems.filter((i) => !i.isDailySpecial).map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-slate-950 mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-bold text-[#FF5722] uppercase tracking-wider block">
                          {item.category}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{item.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{item.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{item.priceFormatted}</span>

                        {cart[item.id] ? (
                          <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-700 flex items-center justify-center text-slate-700 dark:text-white font-bold"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-xs font-black px-1.5">{cart[item.id]}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-6 h-6 rounded-lg bg-[#FF5722] text-white flex items-center justify-center font-bold"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => updateQuantity(item.id, 1)}
                            leftIcon={<Plus size={13} />}
                          >
                            Commander
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200 dark:border-zinc-800 p-8 space-y-2">
              <Utensils size={36} className="mx-auto text-slate-400" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">Aucun plat disponible pour le moment</p>
              <p className="text-xs text-slate-500">Le restaurant mettra bientôt sa carte à jour.</p>
            </div>
          )}
        </div>

        {/* Colonne Droite : Panier Flottant & Validation de Commande */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-5 sticky top-20 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShoppingBag size={18} className="text-[#FF5722]" />
              <span>Votre Panier ({totalCartCount})</span>
            </h2>
            {totalCartCount > 0 && (
              <button
                onClick={() => setCart({})}
                className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>Vider</span>
              </button>
            )}
          </div>

          {/* Liste des articles dans le panier */}
          {totalCartCount > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {Object.entries(cart).map(([itemId, qty]) => {
                  const item = menuItems.find((i) => i.id === itemId);
                  if (!item) return null;
                  return (
                    <div key={itemId} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-zinc-800/60">
                      <div className="max-w-[150px]">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{item.name}</span>
                        <span className="text-[11px] text-slate-400">{qty} x {item.priceFormatted}</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">
                        {(item.price * qty).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mode de Retrait / Livraison */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
                  Mode de remise
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('LIVRAISON')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                      deliveryMode === 'LIVRAISON'
                        ? 'bg-[#FF5722] text-white border-[#FF5722]'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    🛵 Livraison
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('RETRAIT')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                      deliveryMode === 'RETRAIT'
                        ? 'bg-[#FF5722] text-white border-[#FF5722]'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    🛍️ Retrait
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('SUR_PLACE')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                      deliveryMode === 'SUR_PLACE'
                        ? 'bg-[#FF5722] text-white border-[#FF5722]'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    🍽️ Sur place
                  </button>
                </div>
              </div>

              {/* Total & CTA */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-500">Sous-total</span>
                  <span className="text-lg font-black text-[#FF5722]">{totalFormatted}</span>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isSubmitting}
                  onClick={handleCheckout}
                  leftIcon={<ShoppingBag size={18} />}
                >
                  Payer la commande ({totalFormatted})
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <ShoppingBag size={32} className="mx-auto opacity-50" />
              <p className="text-xs font-medium">Votre panier est vide</p>
              <p className="text-[11px] text-slate-400">Ajoutez des plats savoureux pour passer commande.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modale de Paiement SamirPay avec VRAI order_id */}
      {activeOrderId && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          targetType="ORDER"
          targetId={activeOrderId}
          amountFormatted={totalFormatted}
          title={`Commande ${partnerName}`}
          onPaymentSuccess={() => {
            setIsPaymentOpen(false);
            setCart({});
            window.location.href = '/orders';
          }}
        />
      )}
    </div>
  );
}
