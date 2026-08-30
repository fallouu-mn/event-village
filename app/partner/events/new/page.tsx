'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Calendar,
    ArrowLeft,
    Plus,
    Trash2,
    Clock,
    MapPin,
    Ticket,
    Sparkles,
    Info,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Save,
    Upload
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ProgramItem {
    id: string;
    time: string;
    title: string;
    artistOrSpeaker: string;
    description: string;
}

interface TicketCategory {
    id: string;
    name: string;
    price: number;
    total_quantity: number;
    description: string;
}

export default function NewEventPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Étape 1 : Infos Générales (§30)
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [location, setLocation] = useState('');
    const [city, setCity] = useState('Dakar');
    const [imageUrl, setImageUrl] = useState('');
    const [capacity, setCapacity] = useState<number | ''>('');

    // Étape 2 : Programme (§32)
    const [programItems, setProgramItems] = useState<ProgramItem[]>([
        { id: '1', time: '18:00', title: 'Ouverture des portes & Accueil', artistOrSpeaker: 'DJ Warmup', description: 'Arrivée des participants' },
        { id: '2', time: '20:00', title: 'Concert Principal', artistOrSpeaker: 'Artiste Tête d\'affiche', description: 'Performance live sur scène' },
    ]);

    // Étape 3 : Infos Pratiques (§33)
    const [address, setAddress] = useState('');
    const [accessNotes, setAccessNotes] = useState('');
    const [parking, setParking] = useState('Parking sécurisé gratuit');
    const [contactPhone, setContactPhone] = useState('+221 77 000 00 00');
    const [rules, setRules] = useState('Tenue correcte exigée. Objets tranchants et bouteilles en verre interdits.');

    // Étape 4 : Services Associés (§34)
    const [services, setServices] = useState({
        ticketing: true,
        tableBooking: false,
        communication: true,
        promotion: false,
    });

    // Étape 5 : Catégories de Billets (§35)
    const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([
        { id: '1', name: 'Pass Standard', price: 5000, total_quantity: 100, description: 'Accès standard à l\'événement' },
        { id: '2', name: 'Pass VIP', price: 15000, total_quantity: 25, description: 'Accès espace VIP & cocktail de bienvenue' },
    ]);

    // Handlers Programme
    const addProgramItem = () => {
        setProgramItems([
            ...programItems,
            { id: Date.now().toString(), time: '21:00', title: '', artistOrSpeaker: '', description: '' },
        ]);
    };

    const removeProgramItem = (id: string) => {
        setProgramItems(programItems.filter((item) => item.id !== id));
    };

    const updateProgramItem = (id: string, field: keyof ProgramItem, value: string) => {
        setProgramItems(
            programItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    // Handlers Catégories de Billets
    const addTicketCategory = () => {
        setTicketCategories([
            ...ticketCategories,
            { id: Date.now().toString(), name: 'Pass Découverte', price: 2500, total_quantity: 50, description: '' },
        ]);
    };

    const removeTicketCategory = (id: string) => {
        setTicketCategories(ticketCategories.filter((cat) => cat.id !== id));
    };

    const updateTicketCategory = (id: string, field: keyof TicketCategory, value: any) => {
        setTicketCategories(
            ticketCategories.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
        );
    };

    // Soumission Finale
    const handleSubmit = async () => {
        setErrorMsg(null);
        setIsSubmitting(true);

        if (!title.trim() || !startDate || !startTime || !location.trim()) {
            setErrorMsg('Veuillez remplir tous les champs obligatoires (Titre, Date, Heure, Lieu).');
            setCurrentStep(1);
            setIsSubmitting(false);
            return;
        }

        const payload = {
            title,
            description,
            start_date: startDate,
            start_time: startTime,
            end_date: endDate || null,
            end_time: endTime || null,
            location,
            city,
            image_url: imageUrl || null,
            capacity: capacity ? Number(capacity) : null,
            program: programItems,
            practical_info: {
                address,
                accessNotes,
                parking,
                contactPhone,
                rules,
            },
            services,
            ticket_categories: services.ticketing
                ? ticketCategories.map((c) => ({
                      name: c.name,
                      price: Number(c.price),
                      total_quantity: Number(c.total_quantity),
                      description: c.description,
                  }))
                : [],
        };

        try {
            const res = await fetch('/api/partner/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                router.push('/partner/events');
            } else {
                setErrorMsg(data.error || 'Une erreur est survenue.');
            }
        } catch (err: unknown) {
            setErrorMsg('Erreur réseau lors de la création.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/partner/events" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF6B35]">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à mes événements
                </Link>
                <div className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                    Étape {currentStep} sur 5
                </div>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <Calendar className="w-7 h-7 text-[#FF6B35]" />
                    Créer un Nouvel Événement
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    Conforme au Cahier des Charges V3.0 (§30-§35) — L'événement sera créé en statut <strong>Brouillon</strong>.
                </p>
            </div>

            {/* Stepper Tabs */}
            <div className="grid grid-cols-5 gap-2 border-b border-slate-200 dark:border-zinc-800 pb-4">
                {[
                    { num: 1, label: 'Général (§30)' },
                    { num: 2, label: 'Programme (§32)' },
                    { num: 3, label: 'Infos Pratiques (§33)' },
                    { num: 4, label: 'Services (§34)' },
                    { num: 5, label: 'Billetterie (§35)' },
                ].map((step) => (
                    <button
                        key={step.num}
                        onClick={() => setCurrentStep(step.num)}
                        className={`text-left p-2 rounded-xl text-xs font-bold transition-all ${
                            currentStep === step.num
                                ? 'bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] border border-orange-200 dark:border-orange-900/50'
                                : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                        }`}
                    >
                        <span className="block text-[10px] opacity-70">0{step.num}</span>
                        <span className="truncate block">{step.label}</span>
                    </button>
                ))}
            </div>

            {errorMsg && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Contenu des Étapes */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
                {/* ÉTAPE 1 : INFOS GÉNÉRALES */}
                {currentStep === 1 && (
                    <div className="space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                            1. Informations Principales (§30 CDC V3.0)
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                    Titre de l'événement <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Dakar Fashion Week 2026"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                    Description détaillée
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Présentez le concept, les artistes, les moments forts..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Date de début <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Heure de début <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Lieu / Salle <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Monument de la Renaissance"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
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
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        URL Image d'affiche (ou upload)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="https://images.unsplash.com/photo-..."
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Capacité maximale totale
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Ex: 500"
                                        value={capacity}
                                        onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6B35] focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ÉTAPE 2 : PROGRAMME DÉTAILLÉ */}
                {currentStep === 2 && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    2. Programme & Déroulé (§32 CDC V3.0)
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Définissez l'ordre chronologique des activités, passages d'artistes ou interventions.
                                </p>
                            </div>
                            <Button size="sm" onClick={addProgramItem} variant="outline" className="text-xs flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" />
                                Ajouter un créneau
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {programItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[#FF6B35]">Activité #{index + 1}</span>
                                        {programItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeProgramItem(item.id)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Horaire
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 19:30"
                                                value={item.time}
                                                onChange={(e) => updateProgramItem(item.id, 'time', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Titre / Activité
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Première Partie"
                                                value={item.title}
                                                onChange={(e) => updateProgramItem(item.id, 'title', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Artiste / Intervenant
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Wally Seck"
                                                value={item.artistOrSpeaker}
                                                onChange={(e) => updateProgramItem(item.id, 'artistOrSpeaker', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ÉTAPE 3 : INFOS PRATIQUES */}
                {currentStep === 3 && (
                    <div className="space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                            3. Informations Pratiques & Accès (§33 CDC V3.0)
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                    Adresse exacte
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Route des Almadies, en face de l'Hôtel King Fahd"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Accès & Transports
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Bus Tata ligne 3, Taxis disponibles"
                                        value={accessNotes}
                                        onChange={(e) => setAccessNotes(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Parking
                                    </label>
                                    <input
                                        type="text"
                                        value={parking}
                                        onChange={(e) => setParking(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Téléphone de contact organisateur
                                    </label>
                                    <input
                                        type="text"
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Règlement intérieur / Consignes
                                    </label>
                                    <input
                                        type="text"
                                        value={rules}
                                        onChange={(e) => setRules(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ÉTAPE 4 : SERVICES ASSOCIÉS */}
                {currentStep === 4 && (
                    <div className="space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                            4. Services Associés Activés (§34 CDC V3.0)
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3 cursor-pointer hover:border-[#FF6B35] transition-all">
                                <input
                                    type="checkbox"
                                    checked={services.ticketing}
                                    onChange={(e) => setServices({ ...services, ticketing: e.target.checked })}
                                    className="mt-1 accent-[#FF6B35]"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Billetterie en Ligne (Ticketing)</p>
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                        Vendez des billets avec QR Code sécurisé et paiement Wave/OM/Carte.
                                    </p>
                                </div>
                            </label>

                            <label className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3 cursor-pointer hover:border-[#FF6B35] transition-all">
                                <input
                                    type="checkbox"
                                    checked={services.tableBooking}
                                    onChange={(e) => setServices({ ...services, tableBooking: e.target.checked })}
                                    className="mt-1 accent-[#FF6B35]"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Réservation de Tables VIP</p>
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                        Permet aux clients de réserver des tables exclusives pour l'événement.
                                    </p>
                                </div>
                            </label>

                            <label className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3 cursor-pointer hover:border-[#FF6B35] transition-all">
                                <input
                                    type="checkbox"
                                    checked={services.communication}
                                    onChange={(e) => setServices({ ...services, communication: e.target.checked })}
                                    className="mt-1 accent-[#FF6B35]"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Pack Communication Standard</p>
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                        Mise en avant dans la newsletter et le calendrier public Event Village.
                                    </p>
                                </div>
                            </label>

                            <label className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3 cursor-pointer hover:border-[#FF6B35] transition-all">
                                <input
                                    type="checkbox"
                                    checked={services.promotion}
                                    onChange={(e) => setServices({ ...services, promotion: e.target.checked })}
                                    className="mt-1 accent-[#FF6B35]"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Promotion Sponsorisée</p>
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                        Bannière en tête d'affiche sur la page d'accueil d'Event Village.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* ÉTAPE 5 : BILLETTERIE & PASS */}
                {currentStep === 5 && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    5. Catégories de Billets & Pass (§35 CDC V3.0)
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Configurez les types de billets (Standard, VIP, Early Bird...) avec leurs quotas stricts.
                                </p>
                            </div>
                            <Button size="sm" onClick={addTicketCategory} variant="outline" className="text-xs flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" />
                                Ajouter une catégorie
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {ticketCategories.map((cat, index) => (
                                <div
                                    key={cat.id}
                                    className="p-5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[#FF6B35]">Billet #{index + 1}</span>
                                        {ticketCategories.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTicketCategory(cat.id)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Nom du Pass
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Pass VIP"
                                                value={cat.name}
                                                onChange={(e) => updateTicketCategory(cat.id, 'name', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Prix Facial (FCFA)
                                            </label>
                                            <input
                                                type="number"
                                                value={cat.price}
                                                onChange={(e) => updateTicketCategory(cat.id, 'price', Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Quantité Totale (Quota)
                                            </label>
                                            <input
                                                type="number"
                                                value={cat.total_quantity}
                                                onChange={(e) => updateTicketCategory(cat.id, 'total_quantity', Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Navigation Stepper */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-6">
                    {currentStep > 1 ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentStep(currentStep - 1)}
                            className="text-xs"
                        >
                            Précédent
                        </Button>
                    ) : (
                        <div />
                    )}

                    {currentStep < 5 ? (
                        <Button
                            size="sm"
                            onClick={() => setCurrentStep(currentStep + 1)}
                            className="bg-[#FF6B35] hover:bg-[#ff5719] text-white text-xs flex items-center gap-1"
                        >
                            Suivant
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-[#FF6B35] hover:bg-[#ff5719] text-white text-xs flex items-center gap-2 shadow-lg shadow-[#FF6B35]/20"
                        >
                            <Save className="w-4 h-4" />
                            {isSubmitting ? 'Enregistrement...' : 'Enregistrer en Brouillon (§31)'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
