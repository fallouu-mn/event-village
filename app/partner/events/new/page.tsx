'use client';

import React, { useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import {
    Calendar,
    ArrowLeft,
    Plus,
    Trash2,
    ChevronRight,
    Save,
    MapPin,
    Ticket,
    Users,
    Megaphone,
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useToast } from '@/components/ui/Toast';
import { toastMessages } from '@/lib/messages/toast-messages';
import { EVENT_CATEGORIES, type EventCategoryId } from '@/lib/constants/event-categories';

const MapPicker = dynamic(() => import('@/components/ui/MapPicker').then(m => ({ default: m.MapPicker })), {
    ssr: false,
    loading: () => <div className="w-full h-56 rounded-xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />,
});

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
    sale_start: string;
    sale_end: string;
    max_per_order: number;
    is_visible: boolean;
}

const ticketCategorySchema = z.object({
    name: z.string().min(1, 'Le nom du pass est requis.'),
    price: z.number().min(0, 'Le prix doit être positif ou nul.'),
    total_quantity: z.number().min(1, 'La quantité doit être au moins 1.'),
    description: z.string().optional(),
    sale_start: z.string().optional(),
    sale_end: z.string().optional(),
    max_per_order: z.number().min(1, 'Minimum 1 billet par commande.').max(20, 'Maximum 20 billets par commande.'),
    is_visible: z.boolean(),
});

const EVENT_CATEGORY_IDS = EVENT_CATEGORIES.map((c) => c.id) as [EventCategoryId, ...EventCategoryId[]];

const eventFormSchema = z.object({
    title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères.'),
    category: z.enum(EVENT_CATEGORY_IDS, { errorMap: () => ({ message: 'Veuillez sélectionner une catégorie.' }) }),
    description: z.string().optional(),
    start_date: z.string().min(1, 'La date de début est requise.').refine(
        (val) => {
            if (!val) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selected = new Date(val + 'T00:00:00');
            return selected >= today;
        },
        { message: 'La date de début doit être dans le futur.' }
    ),
    start_time: z.string().min(1, 'L\'heure de debut est requise.'),
    end_date: z.string().optional(),
    end_time: z.string().optional(),
    location: z.string().min(2, 'Le lieu doit contenir au moins 2 caractères.'),
    city: z.string().default('Dakar'),
    capacity: z
        .union([z.number().positive('La capacité doit être positive.'), z.literal('')])
        .optional(),
    ticket_categories: z.array(ticketCategorySchema).optional(),
});

type FormErrors = Record<string, string>;

export default function NewEventPage() {
    const router = useRouter();
    const toast = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    // Étape 1 : Infos Générales (§30)
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<EventCategoryId | ''>('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [location, setLocation] = useState('');
    const [city, setCity] = useState('Dakar');
    const [imageUrl, setImageUrl] = useState('');
    const [capacity, setCapacity] = useState<number | ''>('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    // Étape 2 : Programme (§32)
    const [programItems, setProgramItems] = useState<ProgramItem[]>([]);

    // Étape 3 : Infos Pratiques (§33)
    const [address, setAddress] = useState('');
    const [accessNotes, setAccessNotes] = useState('');
    const [parking, setParking] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [rules, setRules] = useState('');

    // Étape 4 : Services Associés (§34)
    const [services, setServices] = useState({
        ticketing: true,
        tableBooking: false,
        communication: true,
    });

    // Étape 5 : Catégories de Billets (§35)
    const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);

    const totalTicketQuota = ticketCategories.reduce((sum, c) => sum + Number(c.total_quantity), 0);

    // Handlers Programme
    const addProgramItem = () => {
        setProgramItems([
            ...programItems,
            { id: Date.now().toString(), time: '', title: '', artistOrSpeaker: '', description: '' },
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
            { id: Date.now().toString(), name: '', price: 0, total_quantity: 1, description: '', sale_start: '', sale_end: '', max_per_order: 4, is_visible: true },
        ]);
    };

    const removeTicketCategory = (id: string) => {
        setTicketCategories(ticketCategories.filter((cat) => cat.id !== id));
    };

    const updateTicketCategory = (id: string, field: keyof TicketCategory, value: string | number | boolean) => {
        setTicketCategories(
            ticketCategories.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
        );
    };

    // Validation
    const validateForm = (): boolean => {
        const formData: Record<string, unknown> = {
            title,
            category: category || undefined,
            description: description || undefined,
            start_date: startDate,
            start_time: startTime,
            end_date: endDate || undefined,
            end_time: endTime || undefined,
            location,
            city,
            capacity: capacity === '' ? undefined : capacity,
        };

        if (services.ticketing) {
            formData.ticket_categories = ticketCategories.map((c) => ({
                name: c.name,
                price: Number(c.price),
                total_quantity: Number(c.total_quantity),
                description: c.description || undefined,
                sale_start: c.sale_start || undefined,
                sale_end: c.sale_end || undefined,
                max_per_order: Number(c.max_per_order),
                is_visible: c.is_visible,
            }));
        }

        const result = eventFormSchema.safeParse(formData);
        const newErrors: FormErrors = {};

        if (!result.success) {
            for (const issue of result.error.issues) {
                const path = issue.path.join('.');
                if (!newErrors[path]) {
                    newErrors[path] = issue.message;
                }
            }
        }

        // Cohérence temporelle : date_fin >= date_début
        if (endDate && startDate) {
            const startDt = new Date(startDate + 'T' + (startTime || '00:00'));
            const endDt = new Date(endDate + 'T' + (endTime || '23:59'));
            if (endDt < startDt) {
                newErrors['end_date'] = 'La date/heure de fin ne peut pas être antérieure à la date/heure de début.';
            }
        }

        // Validation croisée jauge : somme des quotas <= capacité maximale
        const numericCapacity = Number(capacity);
        if (services.ticketing && numericCapacity > 0 && ticketCategories.length > 0) {
            if (totalTicketQuota > numericCapacity) {
                newErrors['ticket_quota_exceeded'] = `La somme des quotas (${totalTicketQuota}) dépasse la capacité maximale (${numericCapacity}).`;
            }
        }

        // Validate ticket_categories array items individually when ticketing is enabled
        if (services.ticketing && ticketCategories.length > 0) {
            ticketCategories.forEach((cat, index) => {
                const catResult = ticketCategorySchema.safeParse({
                    name: cat.name,
                    price: Number(cat.price),
                    total_quantity: Number(cat.total_quantity),
                    description: cat.description || undefined,
                    sale_start: cat.sale_start || undefined,
                    sale_end: cat.sale_end || undefined,
                    max_per_order: Number(cat.max_per_order),
                    is_visible: cat.is_visible,
                });
                if (!catResult.success) {
                    for (const issue of catResult.error.issues) {
                        const key = `ticket_categories.${index}.${issue.path.join('.')}`;
                        if (!newErrors[key]) {
                            newErrors[key] = issue.message;
                        }
                    }
                }

                // Cohérence dates de vente par catégorie
                if (cat.sale_start && cat.sale_end && new Date(cat.sale_end) < new Date(cat.sale_start)) {
                    newErrors[`ticket_categories.${index}.sale_end`] = 'La date de fin de vente doit être postérieure à la date de début.';
                }
            });
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            const firstErrorKey = Object.keys(newErrors)[0];
            if (
                firstErrorKey.startsWith('title') ||
                firstErrorKey.startsWith('category') ||
                firstErrorKey.startsWith('start_date') ||
                firstErrorKey.startsWith('start_time') ||
                firstErrorKey.startsWith('end_date') ||
                firstErrorKey.startsWith('location') ||
                firstErrorKey.startsWith('city') ||
                firstErrorKey.startsWith('capacity') ||
                firstErrorKey.startsWith('description')
            ) {
                setCurrentStep(1);
            } else if (firstErrorKey.startsWith('ticket_categories') || firstErrorKey === 'ticket_quota_exceeded') {
                setCurrentStep(5);
            }
            return false;
        }

        return true;
    };

    // Soumission Finale
    const handleSubmit = async () => {
        setIsSubmitting(true);

        if (!validateForm()) {
            toast.error(toastMessages.events.formErrors);
            setIsSubmitting(false);
            return;
        }

        // Validation billetterie : au moins 1 catégorie si ticketing activé
        if (services.ticketing && ticketCategories.length === 0) {
            toast.error('La billetterie est activée mais aucune catégorie de billet n\'a été configurée. Ajoutez au moins une catégorie.');
            setCurrentStep(5);
            setIsSubmitting(false);
            return;
        }

        // HARD BLOCK : jauge croisée (defense-in-depth, même si validateForm devrait déjà bloquer)
        if (services.ticketing && ticketCategories.length > 0) {
            const numCap = Number(capacity);
            if (numCap > 0 && totalTicketQuota > numCap) {
                toast.error(`Erreur : Le quota total de billets (${totalTicketQuota}) dépasse la capacité maximale de la salle (${numCap}). Réduisez les quotas ou augmentez la capacité.`);
                setCurrentStep(5);
                setIsSubmitting(false);
                return;
            }
        }

        const payload = {
            title,
            category: category || null,
            description,
            start_date: startDate,
            start_time: startTime,
            end_date: endDate || null,
            end_time: endTime || null,
            location,
            city,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
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
                      sale_start: c.sale_start || null,
                      sale_end: c.sale_end || null,
                      max_per_order: Number(c.max_per_order),
                      is_visible: c.is_visible,
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
                toast.success(toastMessages.events.createdDraft);
                router.push('/partner/events');
            } else {
                toast.error(data.error || toastMessages.events.createError);
            }
        } catch (err: unknown) {
            toast.error(toastMessages.common.networkError);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/partner/events" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF5722]">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à mes événements
                </Link>
                <div className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                    Étape {currentStep} sur 5
                </div>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <Calendar className="w-7 h-7 text-[#FF5722]" />
                    Créer un Nouvel Événement
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    Conforme au Cahier des Charges V3.0 (§30-§35) — L&apos;événement sera créé en statut <strong>Brouillon</strong>.
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
                                ? 'bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] border border-orange-200 dark:border-orange-900/50'
                                : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                        }`}
                    >
                        <span className="block text-[10px] opacity-70">0{step.num}</span>
                        <span className="truncate block">{step.label}</span>
                    </button>
                ))}
            </div>

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
                                    Titre de l&apos;événement <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Dakar Fashion Week 2026"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                />
                                {errors.title && (
                                    <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.title}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                                    Catégorie de l&apos;événement <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {EVENT_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all duration-200 text-left ${
                                                category === cat.id
                                                    ? 'bg-[#FF5722]/10 border-[#FF5722] text-[#FF5722]'
                                                    : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-[#FF5722]/40'
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                                {errors.category && (
                                    <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.category}</p>
                                )}
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
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
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
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                    />
                                    {errors.start_date && (
                                        <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.start_date}</p>
                                    )}
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
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                    />
                                    {errors.start_time && (
                                        <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.start_time}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Date de fin
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                    />
                                    {errors.end_date && (
                                        <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.end_date}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Heure de fin
                                    </label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
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
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                    />
                                    {errors.location && (
                                        <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.location}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Ville
                                    </label>
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <ImageUpload
                                    value={imageUrl}
                                    onChange={setImageUrl}
                                    folder="events"
                                    label="Affiche de l'événement"
                                />
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Capacité maximale totale
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Ex: 500"
                                        value={capacity}
                                        onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none"
                                    />
                                    {errors.capacity && (
                                        <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.capacity}</p>
                                    )}
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
                                    Définissez l&apos;ordre chronologique des activités, passages d&apos;artistes ou interventions.
                                </p>
                            </div>
                            <Button size="sm" onClick={addProgramItem} variant="outline" className="text-xs flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" />
                                Ajouter un créneau
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {programItems.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-400 dark:text-zinc-500">
                                    Aucun créneau ajouté. Cliquez sur &quot;Ajouter un créneau&quot; pour commencer.
                                </div>
                            )}
                            {programItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[#FF5722]">Activité #{index + 1}</span>
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
                                    placeholder="Ex: Dakar Arena, Diamniadio"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                                    <MapPin size={13} className="text-[#FF5722]" />
                                    Position exacte sur la carte
                                </label>
                                <MapPicker
                                    latitude={latitude}
                                    longitude={longitude}
                                    onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
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
                                        placeholder="Ex: Parking sécurisé gratuit"
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
                                        placeholder="Ex: +221 77 000 00 00"
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
                                        placeholder="Ex: Tenue correcte exigée"
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
                        <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                4. Services Associés (§34 CDC V3.0)
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                Chaque service activé a des conséquences fonctionnelles réelles sur votre événement.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Billetterie */}
                            <div
                                onClick={() => setServices(s => ({ ...s, ticketing: !s.ticketing }))}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                    services.ticketing
                                        ? 'border-[#FF5722] bg-orange-50/50 dark:bg-orange-950/20'
                                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${services.ticketing ? 'bg-[#FF5722] text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                                        <Ticket size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-black text-slate-900 dark:text-white">Billetterie en Ligne</p>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${services.ticketing ? 'bg-[#FF5722] border-[#FF5722]' : 'border-slate-300 dark:border-zinc-600'}`}>
                                                {services.ticketing && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                            Vente de billets sécurisée avec QR Code • Paiement Wave / Orange Money / Carte
                                        </p>
                                        {services.ticketing && (
                                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                                <AlertCircle size={12} />
                                                Configurez au moins une catégorie de billet à l&apos;étape suivante
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tables VIP */}
                            <div
                                onClick={() => setServices(s => ({ ...s, tableBooking: !s.tableBooking }))}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                    services.tableBooking
                                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20'
                                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${services.tableBooking ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                                        <Users size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-black text-slate-900 dark:text-white">Réservation de Tables VIP</p>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${services.tableBooking ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-zinc-600'}`}>
                                                {services.tableBooking && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                            Vos tables configurées dans l&apos;espace Partenaire seront disponibles à la réservation
                                        </p>
                                        {services.tableBooking && (
                                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                                <CheckCircle2 size={12} />
                                                Gérez vos tables depuis l&apos;espace Tables de votre compte partenaire
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Communication */}
                            <div
                                onClick={() => setServices(s => ({ ...s, communication: !s.communication }))}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                    services.communication
                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${services.communication ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                                        <Megaphone size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-black text-slate-900 dark:text-white">Pack Communication Standard</p>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${services.communication ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-zinc-600'}`}>
                                                {services.communication && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                            Présence dans le calendrier public • Newsletter Event Village • Éligibilité aux mises en avant
                                        </p>
                                        {services.communication && (
                                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                <CheckCircle2 size={12} />
                                                Inclus dans votre abonnement partenaire
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

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

                        {/* Jauge de capacité */}
                        {capacity !== '' && typeof capacity === 'number' && capacity > 0 && ticketCategories.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-slate-600 dark:text-zinc-400">Jauge de capacité</span>
                                    <span className={totalTicketQuota > capacity ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}>
                                        {totalTicketQuota} / {capacity} billets ({Math.round((totalTicketQuota / capacity) * 100)}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${totalTicketQuota > capacity ? 'bg-red-500' : totalTicketQuota > capacity * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, (totalTicketQuota / capacity) * 100)}%` }}
                                    />
                                </div>
                                {errors.ticket_quota_exceeded && (
                                    <p className="text-[11px] font-semibold text-red-500">{errors.ticket_quota_exceeded}</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            {ticketCategories.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-400 dark:text-zinc-500">
                                    Aucune catégorie de billet ajoutée. Cliquez sur &quot;Ajouter une catégorie&quot; pour commencer.
                                </div>
                            )}
                            {ticketCategories.map((cat, index) => (
                                <div
                                    key={cat.id}
                                    className={`p-5 rounded-xl border space-y-3 ${cat.is_visible ? 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700' : 'bg-slate-100/50 dark:bg-zinc-900/50 border-dashed border-slate-300 dark:border-zinc-600 opacity-75'}`}
                                >
                                    {/* Header : titre + badges + actions */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-[#FF5722]">Billet #{index + 1}</span>
                                            {Number(cat.price) === 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase">
                                                    Gratuit
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => updateTicketCategory(cat.id, 'is_visible', !cat.is_visible)}
                                                className={`p-1.5 rounded-lg transition-colors ${cat.is_visible ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700' : 'text-amber-500 bg-amber-50 dark:bg-amber-950/30'}`}
                                                title={cat.is_visible ? 'Visible au public — cliquer pour masquer' : 'Masqué du public — cliquer pour rendre visible'}
                                            >
                                                {cat.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeTicketCategory(cat.id)}
                                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Ligne 1 : Nom, Prix, Quantité */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Nom du Pass <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Pass VIP"
                                                value={cat.name}
                                                onChange={(e) => updateTicketCategory(cat.id, 'name', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                            {errors[`ticket_categories.${index}.name`] && (
                                                <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.name`]}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Prix Facial (FCFA)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={cat.price}
                                                onChange={(e) => updateTicketCategory(cat.id, 'price', Math.max(0, Number(e.target.value)))}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                            {errors[`ticket_categories.${index}.price`] && (
                                                <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.price`]}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Quantité Totale (Quota) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={cat.total_quantity}
                                                onChange={(e) => updateTicketCategory(cat.id, 'total_quantity', Math.max(1, Number(e.target.value)))}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                            {errors[`ticket_categories.${index}.total_quantity`] && (
                                                <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.total_quantity`]}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ligne 2 : Description */}
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                            Description / Avantages inclus
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Accès Carré VIP + 1 consommation offerte"
                                            value={cat.description}
                                            onChange={(e) => updateTicketCategory(cat.id, 'description', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Ligne 3 : Période de vente + limite anti-fraude */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Début de vente
                                            </label>
                                            <input
                                                type="date"
                                                value={cat.sale_start}
                                                onChange={(e) => updateTicketCategory(cat.id, 'sale_start', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Fin de vente
                                            </label>
                                            <input
                                                type="date"
                                                value={cat.sale_end}
                                                onChange={(e) => updateTicketCategory(cat.id, 'sale_end', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                            {errors[`ticket_categories.${index}.sale_end`] && (
                                                <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.sale_end`]}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                                                Achat max / commande
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={cat.max_per_order}
                                                onChange={(e) => updateTicketCategory(cat.id, 'max_per_order', Math.max(1, Math.min(20, Number(e.target.value))))}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    {!cat.is_visible && (
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <EyeOff size={11} />
                                            Ce billet ne sera pas visible par les clients sur la page publique
                                        </p>
                                    )}
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
                            variant="primary"
                            onClick={() => setCurrentStep(currentStep + 1)}
                            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                            Suivant
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={handleSubmit}
                            isLoading={isSubmitting}
                            disabled={isSubmitting}
                            leftIcon={<Save className="w-4 h-4" />}
                        >
                            {isSubmitting ? 'Enregistrement...' : 'Enregistrer en Brouillon (§31)'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
