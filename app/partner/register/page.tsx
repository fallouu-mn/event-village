'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Briefcase,
    Building2,
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    User,
    Phone,
    Mail,
    Lock,
    MapPin,
    ArrowRight,
    Sparkles,
    Shield,
    Clock,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { RegisterPartnerSchema, PartnerActivityTypes, normalizePhoneNumber } from '@/lib/validations/auth';

const ACTIVITY_LABELS: Record<string, string> = {
    RESTAURANT: 'Restaurant & Gastronomie',
    TRAITEUR: 'Service Traiteur & Buffet',
    SALLE: 'Salle de Fête & Réception',
    ORGANISATEUR: 'Organisateur d’Événements / Festivals',
    PRESTATAIRE: 'Prestataire Scénique / Son & Lumière',
    PATISSERIE: 'Pâtisserie & Desserts',
    ETABLISSEMENT_ALIMENTAIRE: 'Établissement Alimentaire',
    AUTRE: 'Autre Service Événementiel',
};

export default function PartnerRegisterPage() {
    const router = useRouter();

    // Données Entreprise
    const [companyName, setCompanyName] = useState('');
    const [commercialName, setCommercialName] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('Dakar');
    const [selectedActivities, setSelectedActivities] = useState<string[]>(['ORGANISATEUR']);
    const [ninea, setNinea] = useState('');
    const [rccm, setRccm] = useState('');

    // Données Gérant
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Fichiers
    const [idCardFile, setIdCardFile] = useState<File | null>(null);
    const [businessDocFile, setBusinessDocFile] = useState<File | null>(null);

    // OTP verification
    const [otpStep, setOtpStep] = useState(false);
    const [otpPhone, setOtpPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);

    // État de soumission
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const toggleActivity = (type: string) => {
        if (selectedActivities.includes(type)) {
            if (selectedActivities.length > 1) {
                setSelectedActivities(selectedActivities.filter((a) => a !== type));
            }
        } else {
            setSelectedActivities([...selectedActivities, type]);
        }
    };

    const handlePartnerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        // 1. Vérification préalable de la présence des deux documents obligatoires
        if (!idCardFile) {
            setErrorMessage("La pièce d'identité du gérant (CNI ou Passeport) est obligatoire pour valider votre dossier.");
            return;
        }
        if (!businessDocFile) {
            setErrorMessage("Le document officiel d'entreprise (Extrait RCCM ou Attestation NINEA) est obligatoire.");
            return;
        }

        setIsLoading(true);
        const normalizedPhone = normalizePhoneNumber(phone.trim());

        try {
            // 2. Upload sécurisé de la pièce d'identité du gérant dans le bucket privé
            const idCardFormData = new FormData();
            idCardFormData.append('file', idCardFile);
            idCardFormData.append('docType', 'id_card');

            const idCardRes = await fetch('/api/partner/documents/upload', {
                method: 'POST',
                body: idCardFormData,
            });
            const idCardData = await idCardRes.json();
            if (!idCardRes.ok || !idCardData.success || !idCardData.filePath) {
                throw new Error(idCardData.error || "Échec du téléversement de la pièce d'identité du gérant.");
            }
            const idCardUrl = idCardData.filePath as string;

            // 3. Upload sécurisé du document d'entreprise dans le bucket privé
            const busFormData = new FormData();
            busFormData.append('file', businessDocFile);
            busFormData.append('docType', 'business_doc');

            const busRes = await fetch('/api/partner/documents/upload', {
                method: 'POST',
                body: busFormData,
            });
            const busData = await busRes.json();
            if (!busRes.ok || !busData.success || !busData.filePath) {
                throw new Error(busData.error || "Échec du téléversement du document d'immatriculation d'entreprise.");
            }
            const businessDocUrl = busData.filePath as string;

            // 4. Validation Zod stricte incluant les URLs des justificatifs obligatoires
            const parseResult = RegisterPartnerSchema.safeParse({
                companyName: companyName.trim(),
                commercialName: commercialName.trim() || undefined,
                description: description.trim(),
                address: address.trim(),
                city: city.trim(),
                activities: selectedActivities,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                email: email.trim().toLowerCase(),
                password,
                confirmPassword,
                ninea: ninea.trim() || undefined,
                rccm: rccm.trim() || undefined,
                idCardUrl,
                businessDocUrl,
            });

            if (!parseResult.success) {
                setErrorMessage(parseResult.error.errors[0]?.message || 'Veuillez vérifier les informations du formulaire.');
                setIsLoading(false);
                return;
            }

            // 5. Appel de la route API serveur d'inscription partenaire
            const res = await fetch('/api/partner/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    commercialName: commercialName.trim() || undefined,
                    description: description.trim(),
                    address: address.trim(),
                    city: city.trim(),
                    activities: selectedActivities,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone: normalizedPhone,
                    email: email.trim().toLowerCase(),
                    password,
                    confirmPassword,
                    ninea: ninea.trim() || undefined,
                    rccm: rccm.trim() || undefined,
                    idCardUrl,
                    businessDocUrl,
                }),
            });

            let data: any = {};
            const textResponse = await res.text();
            try {
                data = JSON.parse(textResponse);
            } catch {
                throw new Error('Une erreur de communication avec le serveur est survenue. Veuillez réessayer.');
            }

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors de l\'enregistrement de votre candidature.');
            }

            setOtpPhone(data.phone || normalizedPhone);
            setOtpStep(true);
        } catch (err: unknown) {
            console.error('[PartnerRegister] Erreur onboarding:', err);
            const msg = err instanceof Error ? err.message : 'Erreur lors de l\'inscription partenaire.';
            setErrorMessage(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setOtpLoading(true);
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: otpPhone, otpCode }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Code de vérification incorrect.');
            }
            setIsSuccess(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erreur de vérification OTP.';
            setErrorMessage(msg);
        } finally {
            setOtpLoading(false);
        }
    };

    return (
        <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 pb-24">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="flex justify-center mb-2">
                    <Logo variant="full" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] text-xs font-black">
                    <Briefcase size={14} />
                    <span>Espace Professionnel & Partenaires B2B</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                    Devenez Partenaire Event Village
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-xl mx-auto">
                    Publiez vos événements, louez vos salles de réception, recevez des réservations de tables et vendez vos menus en direct avec reversements garantis par SamirPay.
                </p>
            </div>

            {/* Carte Formulaire */}
            <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xl space-y-8">
                {errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-3">
                        <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold block">Impossible de valider votre dossier :</span>
                            <span>{errorMessage}</span>
                        </div>
                    </div>
                )}

                {otpStep && !isSuccess ? (
                    <div className="py-10 space-y-6">
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center mx-auto">
                                <Phone size={32} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">
                                Vérification de votre numéro
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                                Un code de vérification à 6 chiffres a été envoyé au <strong className="text-slate-900 dark:text-white">{otpPhone}</strong>. Saisissez-le ci-dessous.
                            </p>
                        </div>
                        <form onSubmit={handleOtpVerify} className="max-w-xs mx-auto space-y-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                required
                                autoFocus
                                className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center text-2xl font-black tracking-[0.5em] text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                            />
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={otpLoading}
                                leftIcon={<CheckCircle2 size={18} />}
                            >
                                Vérifier le code SMS
                            </Button>
                            <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500">
                                Code valable 10 minutes. Si vous ne l&apos;avez pas reçu, vérifiez votre numéro.
                            </p>
                        </form>
                    </div>
                ) : !isSuccess ? (
                    <form onSubmit={handlePartnerSubmit} className="space-y-8">
                        {/* 1. Informations sur l'Établissement / Entreprise */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
                                <Building2 size={20} className="text-[#FF5722]" />
                                <h2 className="text-base font-black text-slate-900 dark:text-white">
                                    1. Structure & Activités Événementielles
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Raison Sociale / Nom Légal *
                                    </label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="ex: Terrou-Bi Hospitality SARL"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Nom Commercial / Enseigne
                                    </label>
                                    <input
                                        type="text"
                                        value={commercialName}
                                        onChange={(e) => setCommercialName(e.target.value)}
                                        placeholder="ex: Terrou-Bi Dakar"
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>
                            </div>

                            {/* Multi-activités */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-2">
                                    Types d&apos;activités proposées (Sélectionnez une ou plusieurs) *
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {PartnerActivityTypes.map((type) => {
                                        const isSelected = selectedActivities.includes(type);
                                        return (
                                            <div
                                                key={type}
                                                onClick={() => toggleActivity(type)}
                                                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'border-[#FF5722] bg-[#FF5722]/5 shadow-xs'
                                                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                                                }`}
                                            >
                                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                                    {ACTIVITY_LABELS[type] || type}
                                                </span>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#FF5722] bg-[#FF5722]' : 'border-slate-300 dark:border-zinc-700'}`}>
                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                    Description & Présentation de votre établissement *
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Présentez votre établissement, vos capacités d'accueil ou vos prestations événementielles..."
                                    required
                                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Adresse de l&apos;Établissement *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Boulevard Martin Luther King, Dakar"
                                            required
                                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                        />
                                        <MapPin size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Ville *
                                    </label>
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="Dakar"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Données du Gérant / Compte Professionnel */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
                                <User size={20} className="text-[#FF5722]" />
                                <h2 className="text-base font-black text-slate-900 dark:text-white">
                                    2. Représentant Légal & Accès Compte
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Prénom du Responsable *
                                    </label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Amadou"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Nom du Responsable *
                                    </label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Sow"
                                        required
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Téléphone Professionnel (Sénégal) *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="77 800 00 00"
                                            required
                                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                        />
                                        <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Email Professionnel *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="direction@etablissement.sn"
                                            required
                                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                        />
                                        <Mail size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Mot de passe *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Min. 8 car., 1 Maj, 1 chiffre, 1 spécial"
                                            required
                                            className={`w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition-all ${
                                                password.length > 0 && allPasswordCriteriaMet(password)
                                                    ? 'border-emerald-500 focus:border-emerald-500'
                                                    : password.length > 0
                                                    ? 'border-amber-400 focus:border-amber-400'
                                                    : 'border-slate-200 dark:border-zinc-800 focus:border-[#FF5722]'
                                            }`}
                                        />
                                        <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
                                        Confirmer le mot de passe *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#FF5722]"
                                        />
                                        <Lock size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            <PasswordStrengthChecklist password={password} />
                        </div>

                        {/* 3. Justificatifs & Documents Légaux (Upload privé) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <Shield size={20} className="text-[#FF5722]" />
                                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                                        3. Documents Professionnels (Bucket Privé Sécurisé)
                                    </h2>
                                </div>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                                    Obligatoire
                                </span>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                Conformément à la réglementation sénégalaise et au protocole de sécurité Event Village, le dépôt de ces deux pièces est obligatoire pour l&apos;audit et la validation de votre compte.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className={`p-4 rounded-2xl border border-dashed transition-colors space-y-2.5 ${
                                    idCardFile
                                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                                        : 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 hover:border-[#FF5722]'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                            Pièce d&apos;Identité du Gérant *
                                        </span>
                                        <span className="text-[10px] text-slate-400">CNI ou Passeport</span>
                                    </div>
                                    <input
                                        type="file"
                                        required
                                        accept="image/*,application/pdf"
                                        onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FF5722] file:text-white cursor-pointer"
                                    />
                                    {idCardFile ? (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Document sélectionné : {idCardFile.name}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-red-500 font-medium block">
                                            * Fichier requis (PDF, JPEG, PNG - Max 10 Mo)
                                        </span>
                                    )}
                                </div>

                                <div className={`p-4 rounded-2xl border border-dashed transition-colors space-y-2.5 ${
                                    businessDocFile
                                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                                        : 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 hover:border-[#FF5722]'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                            Document d&apos;Entreprise (RCCM / NINEA) *
                                        </span>
                                        <span className="text-[10px] text-slate-400">Extrait officiel</span>
                                    </div>
                                    <input
                                        type="file"
                                        required
                                        accept="image/*,application/pdf"
                                        onChange={(e) => setBusinessDocFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FF5722] file:text-white cursor-pointer"
                                    />
                                    {businessDocFile ? (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Document sélectionné : {businessDocFile.name}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-red-500 font-medium block">
                                            * Fichier requis (PDF, JPEG, PNG - Max 10 Mo)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={isLoading}
                            leftIcon={<Upload size={18} />}
                        >
                            Soumettre mon dossier d&apos;inscription Partenaire
                        </Button>
                    </form>
                ) : (
                    /* Écran de confirmation de soumission */
                    <div className="py-10 text-center space-y-6">
                        <div className="w-20 h-20 rounded-3xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center mx-auto border-2 border-orange-500 shadow-md">
                            <Clock size={44} className="animate-pulse" />
                        </div>

                        <div className="space-y-2">
                            <Badge variant="warning" size="md">
                                Statut : EN ATTENTE DE VALIDATION
                            </Badge>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                                Votre dossier Partenaire a été reçu avec succès !
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                                Conformément au protocole de sécurité Event Village, votre dossier et vos documents d&apos;entreprise sont en cours d&apos;examen par l&apos;équipe administrative.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto text-left space-y-1.5">
                            <span className="font-bold text-slate-900 dark:text-white block">Prochaines étapes :</span>
                            <p>1. Vérification administrative des pièces déposées sous 24 à 48 heures.</p>
                            <p>2. Réception d&apos;une notification SMS / Email dès l&apos;approbation de votre compte.</p>
                            <p>3. Déblocage complet de l&apos;Espace Partenaire B2B et publication de vos offres.</p>
                        </div>

                        <Link href="/login">
                            <Button variant="primary" size="md">
                                Retour à l&apos;écran de connexion
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
