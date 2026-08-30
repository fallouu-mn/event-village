'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Building2,
    ArrowLeft,
    DollarSign,
    Users,
    Percent,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Save,
    Plus,
    Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NewHallPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [capacity, setCapacity] = useState<number | ''>('');
    const [pricePerDay, setPricePerDay] = useState<number | ''>('');
    const [pricePerHour, setPricePerHour] = useState<number | ''>('');
    const [depositPercentage, setDepositPercentage] = useState<number>(30); // Configurable (§45)
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('Dakar');
    const [amenities, setAmenities] = useState<string[]>([
        'Climatisation',
        'Wifi Haut Débit',
        'Scène / Estrade',
        'Groupe Électrogène',
        'Parking Gardé',
    ]);
    const [newAmenity, setNewAmenity] = useState('');

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
        setErrorMsg(null);
        setIsSubmitting(true);

        if (!name.trim() || !capacity || (!pricePerDay && !pricePerHour)) {
            setErrorMsg('Veuillez remplir le nom, la capacité et au moins un tarif (jour ou heure).');
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch('/api/partner/halls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    capacity: Number(capacity),
                    price_per_day: pricePerDay ? Number(pricePerDay) : null,
                    price_per_hour: pricePerHour ? Number(pricePerHour) : null,
                    deposit_percentage: Number(depositPercentage),
                    address,
                    city,
                    amenities,
                }),
            });

            const data = await res.json();
            if (data.success) {
                router.push('/partner/halls');
            } else {
                setErrorMsg(data.error || 'Échec de l\'enregistrement.');
            }
        } catch (err) {
            setErrorMsg('Erreur réseau lors de la création.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/partner/halls" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF6B35]">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à la gestion des salles
                </Link>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <Building2 className="w-7 h-7 text-[#FF6B35]" />
                    Ajouter une Salle de Réception
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    Conforme aux exigences CDC V3.0 (§42-§50) — Paramétrez vos tarifs et votre taux d'acompte.
                </p>
            </div>

            {errorMsg && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Nom de la salle <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Palais des Congrès Teranga"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                            Description & Présentation
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Décrivez les atouts, l'agencement, les possibilités de décoration..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Capacité d'accueil <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="Ex: 300"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                            />
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

                    {/* Taux d'Acompte Configurable */}
                    <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Percent className="w-4 h-4 text-[#FF6B35]" />
                                Taux d'Acompte Configurable pour Réservation (§45)
                            </label>
                            <span className="text-xs font-black text-[#FF6B35]">{depositPercentage}%</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                            Définissez le pourcentage minimal que le client doit verser à la réservation pour bloquer la date (recommandé: 30% à 50%).
                        </p>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={depositPercentage}
                            onChange={(e) => setDepositPercentage(Number(e.target.value))}
                            className="w-full accent-[#FF6B35]"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                Adresse physique
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Corniche Ouest, Fann Résidence"
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

                    {/* Équipements & Commodités */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                            Commodités & Équipements Inclus
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {amenities.map((item) => (
                                <span
                                    key={item}
                                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5"
                                >
                                    {item}
                                    <button
                                        type="button"
                                        onClick={() => removeAmenity(item)}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2 max-w-sm">
                            <input
                                type="text"
                                placeholder="Ajouter une commodité..."
                                value={newAmenity}
                                onChange={(e) => setNewAmenity(e.target.value)}
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
                        disabled={isSubmitting}
                        className="bg-[#FF6B35] hover:bg-[#ff5719] text-white text-xs flex items-center gap-2 shadow-lg shadow-[#FF6B35]/20"
                    >
                        <Save className="w-4 h-4" />
                        {isSubmitting ? 'Création en cours...' : 'Enregistrer la salle (§42)'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
