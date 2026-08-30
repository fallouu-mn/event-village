'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import {
    Building2,
    ArrowLeft,
    Users,
    Percent,
    Save,
    Plus,
    Trash2,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useToast } from '@/components/ui/Toast';

const hallSchema = z.object({
    name: z.string().min(3, 'Le nom doit contenir au moins 3 caracteres.'),
    description: z.string().optional(),
    capacity: z.number().int().min(1, 'La capacite doit etre superieure a 0.'),
    price_per_day: z.number().min(0).nullable(),
    price_per_hour: z.number().min(0).nullable(),
    deposit_percentage: z.number().min(10).max(100),
    address: z.string().optional(),
    city: z.string().optional(),
}).refine(
    (data) => (data.price_per_day && data.price_per_day > 0) || (data.price_per_hour && data.price_per_hour > 0),
    { message: 'Renseignez au moins un tarif (jour ou heure).', path: ['price_per_day'] }
);

type FormErrors = Partial<Record<string, string>>;

export default function EditHallPage() {
    const router = useRouter();
    const { id: hallId } = useParams<{ id: string }>();
    const toast = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [hasActiveReservations, setHasActiveReservations] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [capacity, setCapacity] = useState<number | ''>('');
    const [pricePerDay, setPricePerDay] = useState<number | ''>('');
    const [pricePerHour, setPricePerHour] = useState<number | ''>('');
    const [depositPercentage, setDepositPercentage] = useState<number>(30);
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('Dakar');
    const [imageUrl, setImageUrl] = useState('');
    const [amenities, setAmenities] = useState<string[]>([]);
    const [newAmenity, setNewAmenity] = useState('');

    useEffect(() => {
        if (!hallId) return;

        fetch(`/api/partner/halls/${hallId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.hall) {
                    const h = data.hall;
                    setName(h.name || '');
                    setDescription(h.description || '');
                    setCapacity(h.capacity ?? '');
                    setPricePerDay(h.price_per_day ?? '');
                    setPricePerHour(h.price_per_hour ?? '');
                    setDepositPercentage(h.deposit_percentage ?? 30);
                    setAddress(h.address || '');
                    setCity(h.city || 'Dakar');
                    setImageUrl(h.images?.[0] || '');
                    setAmenities(h.amenities || []);

                    const reservations = h.hall_reservations || [];
                    const active = reservations.filter(
                        (r: { status: string }) => r.status === 'EN_ATTENTE' || r.status === 'CONFIRMEE'
                    );
                    setHasActiveReservations(active.length > 0);
                } else {
                    toast.error(data.error || 'Impossible de charger la salle.');
                    router.push('/partner/halls');
                }
            })
            .catch(() => {
                toast.error('Erreur reseau lors du chargement.');
                router.push('/partner/halls');
            })
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hallId]);

    const addAmenity = () => {
        if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
            setAmenities([...amenities, newAmenity.trim()]);
            setNewAmenity('');
        }
    };

    const removeAmenity = (item: string) => {
        setAmenities(amenities.filter((a) => a !== item));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const parsed = hallSchema.safeParse({
            name,
            description: description || undefined,
            capacity: capacity === '' ? 0 : Number(capacity),
            price_per_day: pricePerDay === '' ? null : Number(pricePerDay),
            price_per_hour: pricePerHour === '' ? null : Number(pricePerHour),
            deposit_percentage: depositPercentage,
            address: address || undefined,
            city: city || undefined,
        });

        if (!parsed.success) {
            const fieldErrors: FormErrors = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as string;
                if (!fieldErrors[key]) {
                    fieldErrors[key] = issue.message;
                }
            }
            setErrors(fieldErrors);
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/partner/halls/${hallId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: parsed.data.name,
                    description: parsed.data.description || null,
                    capacity: parsed.data.capacity,
                    price_per_day: parsed.data.price_per_day,
                    price_per_hour: parsed.data.price_per_hour,
                    deposit_percentage: parsed.data.deposit_percentage,
                    address: parsed.data.address || null,
                    city: parsed.data.city || 'Dakar',
                    amenities,
                    images: imageUrl ? [imageUrl] : [],
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Salle mise a jour avec succes !');
                router.push('/partner/halls');
            } else {
                toast.error(data.error || 'Echec de la modification.');
            }
        } catch {
            toast.error('Erreur reseau lors de la modification.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const depositPreview = capacity && pricePerDay
        ? Math.round((Number(pricePerDay) * depositPercentage) / 100)
        : null;

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 text-[#FF5722] animate-spin" />
                <span className="text-sm font-semibold text-slate-600 dark:text-zinc-400">
                    Chargement de la salle...
                </span>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/partner/halls" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF5722]">
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux salles
                </Link>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <Building2 className="w-7 h-7 text-[#FF5722]" />
                    Modifier la salle
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    Mettez a jour les informations de votre salle de reception.
                </p>
            </div>

            {hasActiveReservations && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span>Cette salle a des reservations actives. Les modifications de tarif ne s&apos;appliquent qu&apos;aux nouvelles reservations.</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="space-y-5">
                    {/* Nom */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Nom de la salle <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Palais des Congres Teranga"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                        {errors.name && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.name}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Description & Presentation
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Decrivez les atouts, l'agencement, les possibilites..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                        />
                    </div>

                    {/* Image */}
                    <ImageUpload
                        value={imageUrl}
                        onChange={setImageUrl}
                        folder="halls"
                        label="Photo de la salle"
                    />

                    {/* Capacite + Tarifs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                <Users className="w-3.5 h-3.5 inline mr-1" />
                                Capacite <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="Ex: 300"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
                            {errors.capacity && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.capacity}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Tarif Journalier (FCFA)
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Ex: 200000"
                                value={pricePerDay}
                                onChange={(e) => setPricePerDay(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
                            {errors.price_per_day && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.price_per_day}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Tarif Horaire (FCFA)
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Ex: 25000"
                                value={pricePerHour}
                                onChange={(e) => setPricePerHour(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Taux d'Acompte */}
                    <div className="p-5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Percent className="w-4 h-4 text-[#FF5722]" />
                                Taux d&apos;Acompte Configurable
                            </label>
                            <span className="text-lg font-black text-[#FF5722]">{depositPercentage}%</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            Pourcentage que le client doit verser pour bloquer la date. Minimum 10%, recommande 30-50%.
                        </p>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={depositPercentage}
                            onChange={(e) => setDepositPercentage(Number(e.target.value))}
                            className="w-full accent-[#FF5722]"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                            <span>10%</span>
                            <span>30%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                        </div>
                        {depositPreview !== null && (
                            <div className="mt-2 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs">
                                <span className="text-slate-500 dark:text-zinc-400">Exemple : </span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                    Tarif {Number(pricePerDay).toLocaleString('fr-FR')} F/jour
                                </span>
                                <span className="text-slate-500 dark:text-zinc-400"> → Acompte : </span>
                                <span className="font-black text-[#FF5722]">
                                    {depositPreview.toLocaleString('fr-FR')} F
                                </span>
                                <span className="text-slate-500 dark:text-zinc-400"> — Reste : </span>
                                <span className="font-bold text-emerald-600">
                                    {(Number(pricePerDay) - depositPreview).toLocaleString('fr-FR')} F
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Adresse */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Adresse physique
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Corniche Ouest, Fann Residence"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Ville
                            </label>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Commodites */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                            Commodites & Equipements Inclus
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {amenities.map((item) => (
                                <span
                                    key={item}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5"
                                >
                                    {item}
                                    <button type="button" onClick={() => removeAmenity(item)} className="text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2 max-w-sm">
                            <input
                                type="text"
                                placeholder="Ajouter une commodite..."
                                value={newAmenity}
                                onChange={(e) => setNewAmenity(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(); } }}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
                            <Button type="button" size="sm" variant="outline" onClick={addAmenity} className="text-xs">
                                <Plus className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting}
                        leftIcon={isSubmitting ? undefined : <Save className="w-4 h-4" />}
                        isLoading={isSubmitting}
                    >
                        {isSubmitting ? 'Mise a jour...' : 'Enregistrer les modifications'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
