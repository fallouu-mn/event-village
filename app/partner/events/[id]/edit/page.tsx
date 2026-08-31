'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import {
    Calendar,
    ArrowLeft,
    Plus,
    Trash2,
    ChevronRight,
    Save,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { useToast } from '@/components/ui/Toast';
import { toastMessages } from '@/lib/messages/toast-messages';

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
    sold_quantity?: number;
}

const ticketCategorySchema = z.object({
    name: z.string().min(1, 'Le nom du pass est requis.'),
    price: z.number().min(0, 'Le prix doit etre positif ou nul.'),
    total_quantity: z.number().min(1, 'La quantite doit etre au moins 1.'),
    description: z.string().optional(),
});

const eventFormSchema = z.object({
    title: z.string().min(3, 'Le titre doit contenir au moins 3 caracteres.'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'La date de debut est requise.'),
    start_time: z.string().min(1, 'L\'heure de debut est requise.'),
    end_date: z.string().optional(),
    end_time: z.string().optional(),
    location: z.string().min(2, 'Le lieu doit contenir au moins 2 caracteres.'),
    city: z.string().default('Dakar'),
    capacity: z.union([z.number().positive('La capacite doit etre positive.'), z.literal('')]).optional(),
    ticket_categories: z.array(ticketCategorySchema).optional(),
});

type FormErrors = Record<string, string>;

export default function EditEventPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;
    const toast = useToast();

    const [isLoadingEvent, setIsLoadingEvent] = useState(true);
    const [notEditable, setNotEditable] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

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

    const [programItems, setProgramItems] = useState<ProgramItem[]>([]);

    const [address, setAddress] = useState('');
    const [accessNotes, setAccessNotes] = useState('');
    const [parking, setParking] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [rules, setRules] = useState('');

    const [services, setServices] = useState({
        ticketing: true,
        tableBooking: false,
        communication: true,
        promotion: false,
    });

    const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);

    useEffect(() => {
        const loadEvent = async () => {
            try {
                const res = await fetch(`/api/partner/events/${eventId}`);
                const data = await res.json();
                if (!data.success || !data.event) {
                    toast.error(data.error || toastMessages.events.notFound);
                    router.push('/partner/events');
                    return;
                }

                const ev = data.event;

                if (!['BROUILLON', 'EN_ATTENTE'].includes(ev.status)) {
                    setNotEditable(true);
                    return;
                }

                setTitle(ev.title || '');
                setDescription(ev.description || '');
                setStartDate(ev.start_date || '');
                setStartTime(ev.start_time ? ev.start_time.slice(0, 5) : '');
                setEndDate(ev.end_date || '');
                setEndTime(ev.end_time ? ev.end_time.slice(0, 5) : '');
                setLocation(ev.location || '');
                setCity(ev.city || 'Dakar');
                setImageUrl(ev.image_url || '');
                setCapacity(ev.capacity ?? '');

                if (ev.program && Array.isArray(ev.program)) {
                    setProgramItems(
                        ev.program.map((p: Record<string, string>, i: number) => ({
                            id: p.id || String(i),
                            time: p.time || '',
                            title: p.title || '',
                            artistOrSpeaker: p.artistOrSpeaker || '',
                            description: p.description || '',
                        }))
                    );
                }

                if (ev.practical_info) {
                    const pi = ev.practical_info;
                    setAddress(pi.address || '');
                    setAccessNotes(pi.accessNotes || '');
                    setParking(pi.parking || '');
                    setContactPhone(pi.contactPhone || '');
                    setRules(pi.rules || '');
                }

                if (ev.services) {
                    setServices({
                        ticketing: ev.services.ticketing ?? true,
                        tableBooking: ev.services.tableBooking ?? false,
                        communication: ev.services.communication ?? true,
                        promotion: ev.services.promotion ?? false,
                    });
                }

                if (ev.ticket_categories && Array.isArray(ev.ticket_categories)) {
                    setTicketCategories(
                        ev.ticket_categories.map((c: Record<string, unknown>) => ({
                            id: c.id as string || String(Date.now()),
                            name: (c.name as string) || '',
                            price: Number(c.price) || 0,
                            total_quantity: Number(c.total_quantity) || 1,
                            description: (c.description as string) || '',
                            sold_quantity: Number(c.sold_quantity) || 0,
                        }))
                    );
                }
            } catch {
                toast.error(toastMessages.common.networkError);
                router.push('/partner/events');
            } finally {
                setIsLoadingEvent(false);
            }
        };

        loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

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

    const addTicketCategory = () => {
        setTicketCategories([
            ...ticketCategories,
            { id: Date.now().toString(), name: '', price: 0, total_quantity: 1, description: '' },
        ]);
    };

    const removeTicketCategory = (id: string) => {
        setTicketCategories(ticketCategories.filter((cat) => cat.id !== id));
    };

    const updateTicketCategory = (id: string, field: keyof TicketCategory, value: string | number) => {
        setTicketCategories(
            ticketCategories.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
        );
    };

    const validateForm = (): boolean => {
        const formData: Record<string, unknown> = {
            title,
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

        if (services.ticketing && ticketCategories.length > 0) {
            ticketCategories.forEach((cat, index) => {
                const catResult = ticketCategorySchema.safeParse({
                    name: cat.name,
                    price: Number(cat.price),
                    total_quantity: Number(cat.total_quantity),
                    description: cat.description || undefined,
                });
                if (!catResult.success) {
                    for (const issue of catResult.error.issues) {
                        const key = `ticket_categories.${index}.${issue.path.join('.')}`;
                        if (!newErrors[key]) {
                            newErrors[key] = issue.message;
                        }
                    }
                }
            });
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            const firstErrorKey = Object.keys(newErrors)[0];
            if (['title', 'start_date', 'start_time', 'location', 'city', 'capacity', 'description'].some(k => firstErrorKey.startsWith(k))) {
                setCurrentStep(1);
            } else if (firstErrorKey.startsWith('ticket_categories')) {
                setCurrentStep(5);
            }
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);

        if (!validateForm()) {
            toast.error(toastMessages.events.formErrors);
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
                      id: c.id,
                      name: c.name,
                      price: Number(c.price),
                      total_quantity: Number(c.total_quantity),
                      description: c.description,
                  }))
                : [],
        };

        try {
            const res = await fetch(`/api/partner/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(toastMessages.events.updated(title));
                router.push('/partner/events');
            } else {
                toast.error(data.error || toastMessages.events.updateError);
            }
        } catch {
            toast.error(toastMessages.common.networkError);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingEvent) {
        return (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#FF5722] animate-spin" />
                <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                    Chargement de l&apos;evenement...
                </p>
            </div>
        );
    }

    if (notEditable) {
        return (
            <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Modification impossible
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md">
                    Cet evenement ne peut plus etre modifie car son statut ne le permet pas. Seuls les evenements en &quot;Brouillon&quot; ou &quot;En attente&quot; sont editables.
                </p>
                <Link href="/partner/events">
                    <Button variant="outline" size="sm" className="text-xs">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                        Retour a mes evenements
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/partner/events" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-[#FF5722]">
                    <ArrowLeft className="w-4 h-4" />
                    Retour a mes evenements
                </Link>
                <div className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                    Etape {currentStep} sur 5
                </div>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <Calendar className="w-7 h-7 text-[#FF5722]" />
                    Modifier l&apos;Evenement
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    Modifiez les informations de votre evenement. Les modifications seront enregistrees immediatement.
                </p>
            </div>

            {/* Stepper Tabs */}
            <div className="grid grid-cols-5 gap-2 border-b border-slate-200 dark:border-zinc-800 pb-4">
                {[
                    { num: 1, label: 'General' },
                    { num: 2, label: 'Programme' },
                    { num: 3, label: 'Infos Pratiques' },
                    { num: 4, label: 'Services' },
                    { num: 5, label: 'Billetterie' },
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

            {/* Form Content */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
                {/* STEP 1: General */}
                {currentStep === 1 && (
                    <div className="space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                            1. Informations Principales
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                    Titre de l&apos;evenement <span className="text-red-500">*</span>
                                </label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                {errors.title && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.title}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Description</label>
                                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Date de debut <span className="text-red-500">*</span>
                                    </label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                    {errors.start_date && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.start_date}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Heure de debut <span className="text-red-500">*</span>
                                    </label>
                                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                    {errors.start_time && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.start_time}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Date de fin</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Heure de fin</label>
                                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                                        Lieu / Salle <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                    {errors.location && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.location}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Ville</label>
                                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                </div>
                            </div>

                            <ImageUpload value={imageUrl} onChange={setImageUrl} folder="events" label="Affiche de l'evenement" />

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Capacite maximale totale</label>
                                <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF5722] focus:outline-none" />
                                {errors.capacity && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.capacity}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: Programme */}
                {currentStep === 2 && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">2. Programme &amp; Deroule</h2>
                            <Button size="sm" onClick={addProgramItem} variant="outline" className="text-xs flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Ajouter un creneau
                            </Button>
                        </div>
                        {programItems.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">
                                Aucun creneau programme. Cliquez sur &quot;Ajouter un creneau&quot; pour commencer.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {programItems.map((item, index) => (
                                    <div key={item.id} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-[#FF5722]">Activite #{index + 1}</span>
                                            <button type="button" onClick={() => removeProgramItem(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">Horaire</label>
                                                <input type="text" placeholder="Ex: 19:30" value={item.time} onChange={(e) => updateProgramItem(item.id, 'time', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">Titre / Activite</label>
                                                <input type="text" placeholder="Ex: Concert" value={item.title} onChange={(e) => updateProgramItem(item.id, 'title', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">Artiste / Intervenant</label>
                                                <input type="text" placeholder="Ex: Wally Seck" value={item.artistOrSpeaker} onChange={(e) => updateProgramItem(item.id, 'artistOrSpeaker', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: Infos Pratiques */}
                {currentStep === 3 && (
                    <div className="space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                            3. Informations Pratiques &amp; Acces
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Adresse exacte</label>
                                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Acces &amp; Transports</label>
                                    <input type="text" value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Parking</label>
                                    <input type="text" value={parking} onChange={(e) => setParking(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Telephone de contact</label>
                                    <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Reglement interieur</label>
                                    <input type="text" value={rules} onChange={(e) => setRules(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: Services */}
                {currentStep === 4 && (
                    <div className="space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">
                            4. Services Associes
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'ticketing' as const, title: 'Billetterie en Ligne', desc: 'Vendez des billets avec QR Code securise et paiement Wave/OM/Carte.' },
                                { key: 'tableBooking' as const, title: 'Reservation de Tables VIP', desc: 'Permettez aux clients de reserver des tables exclusives.' },
                                { key: 'communication' as const, title: 'Pack Communication Standard', desc: 'Mise en avant dans la newsletter et le calendrier public.' },
                                { key: 'promotion' as const, title: 'Promotion Sponsorisee', desc: 'Banniere en tete d\'affiche sur la page d\'accueil.' },
                            ].map((svc) => (
                                <label key={svc.key} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start gap-3 cursor-pointer hover:border-[#FF5722] transition-all">
                                    <input type="checkbox" checked={services[svc.key]}
                                        onChange={(e) => setServices({ ...services, [svc.key]: e.target.checked })}
                                        className="mt-1 accent-[#FF5722]" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">{svc.title}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{svc.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 5: Billetterie */}
                {currentStep === 5 && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">5. Categories de Billets</h2>
                            <Button size="sm" onClick={addTicketCategory} variant="outline" className="text-xs flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Ajouter une categorie
                            </Button>
                        </div>
                        {ticketCategories.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">
                                Aucune categorie de billet. Cliquez sur &quot;Ajouter une categorie&quot; pour commencer.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {ticketCategories.map((cat, index) => (
                                    <div key={cat.id} className="p-5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-[#FF5722]">
                                                Billet #{index + 1}
                                                {cat.sold_quantity ? ` (${cat.sold_quantity} vendu${cat.sold_quantity > 1 ? 's' : ''})` : ''}
                                            </span>
                                            {!cat.sold_quantity && (
                                                <button type="button" onClick={() => removeTicketCategory(cat.id)} className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">Nom du Pass</label>
                                                <input type="text" value={cat.name} onChange={(e) => updateTicketCategory(cat.id, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                                {errors[`ticket_categories.${index}.name`] && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.name`]}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">Prix Facial (FCFA)</label>
                                                <input type="number" value={cat.price} onChange={(e) => updateTicketCategory(cat.id, 'price', Number(e.target.value))}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                                {errors[`ticket_categories.${index}.price`] && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.price`]}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">Quantite Totale</label>
                                                <input type="number"
                                                    min={cat.sold_quantity || 1}
                                                    value={cat.total_quantity}
                                                    onChange={(e) => updateTicketCategory(cat.id, 'total_quantity', Math.max(cat.sold_quantity || 1, Number(e.target.value)))}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" />
                                                {errors[`ticket_categories.${index}.total_quantity`] && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.total_quantity`]}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-6">
                    {currentStep > 1 ? (
                        <Button variant="outline" size="sm" onClick={() => setCurrentStep(currentStep - 1)} className="text-xs">
                            Precedent
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
                            disabled={isSubmitting}
                            isLoading={isSubmitting}
                            leftIcon={<Save className="w-4 h-4" />}
                        >
                            {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
