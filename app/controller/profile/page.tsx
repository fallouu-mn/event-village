'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { Banknote, Bell, Calendar, Check, Eye, EyeOff, KeyRound, MapPin, Phone, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { TextInput } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { formatDate, formatEventDateTime } from '@/lib/format';
import { obviousPasswordReason, PASSWORD_CRITERIA_LABELS, PASSWORD_HINT, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules';

/**
 * Profil du contrôleur (GET / PATCH /api/controller/profile). Lot 7 (7.0 f) : migré sur le système de design ;
 * erreur de chargement en ErrorState (plus de page vide après un simple toast) ; dates à Dakar (lib/format) ;
 * D67 : règle du mot de passe affichée telle que le serveur l'applique (lot 9 quinquies, A7 : lib/auth/password-rules.ts ; avant : 8 caractères, une majuscule, une minuscule,
 * un chiffre), sans le caractère spécial de la liste du client. Thème sombre forcé par app/controller/layout.tsx.
 */

interface Assignment {
    id: string;
    canAcceptCash: boolean;
    title: string;
    startDate: string | null;
    startTime: string | null;
    location: string | null;
}

interface ControllerProfile {
    firstName: string;
    lastName: string;
    phone: string;
    createdAt: string | null;
}

// Lot 9 quinquies (A7 : AUTH-11) : règle commune (lib/auth/password-rules.ts), la même que celle du serveur
const PASSWORD_RULES: Array<{ key: string; label: string; test: (p: string) => boolean }> = [
    { key: 'length', label: PASSWORD_CRITERIA_LABELS.length, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
    { key: 'max', label: PASSWORD_CRITERIA_LABELS.max, test: (p) => p.length <= PASSWORD_MAX_LENGTH },
    { key: 'common', label: PASSWORD_CRITERIA_LABELS.common, test: (p) => p.length > 0 && obviousPasswordReason(p) === null },
];

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function strOrNull(v: unknown): string | null {
    return typeof v === 'string' && v ? v : null;
}

function parseProfile(body: unknown): { profile: ControllerProfile; assignments: Assignment[] } | null {
    if (!isRecord(body) || !isRecord(body.profile)) return null;
    const p = body.profile;
    const assignments: Assignment[] = Array.isArray(body.assignments)
        ? body.assignments.flatMap((raw: unknown) => {
            if (!isRecord(raw) || typeof raw.id !== 'string') return [];
            const ev = isRecord(raw.events) ? raw.events : null;
            return [{
                id: raw.id,
                canAcceptCash: raw.can_accept_cash === true,
                title: strOrNull(ev?.title) ?? 'Événement sans titre',
                startDate: strOrNull(ev?.start_date) ?? strOrNull(ev?.date),
                startTime: strOrNull(ev?.start_time),
                location: strOrNull(ev?.location),
            }];
        })
        : [];
    return {
        profile: {
            firstName: strOrNull(p.first_name) ?? '',
            lastName: strOrNull(p.last_name) ?? '',
            phone: strOrNull(p.phone) ?? '',
            createdAt: strOrNull(p.created_at),
        },
        assignments,
    };
}

/** « +221771234567 » → « 77 123 45 67 » (affichage seulement). */
function displayPhone(phone: string): string {
    const local = phone.replace(/^\+?221/, '');
    return /^\d{9}$/.test(local) ? local.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4') : phone || '—';
}

async function readJson(res: Response, what: string): Promise<unknown> {
    try {
        return await res.json();
    } catch (err) {
        console.error(`[profil contrôleur] ${what} : réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

export default function ControllerProfilePage() {
    const toast = useToast();
    const uid = useId();

    const [data, setData] = useState<{ profile: ControllerProfile; assignments: Assignment[] } | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/controller/profile', { cache: 'no-store' });
            const body = await readJson(res, 'lecture');
            if (!res.ok) {
                setLoadError(isRecord(body) && typeof body.error === 'string' && res.status < 500 ? body.error : `Profil indisponible (erreur ${res.status}).`);
                return;
            }
            const parsed = parseProfile(body);
            if (!parsed) {
                console.error('[profil contrôleur] réponse inattendue :', body);
                setLoadError('Réponse inattendue du serveur.');
                return;
            }
            setData(parsed);
            setLoadError(null);
        } catch (err) {
            console.error('[profil contrôleur] lecture injoignable :', err instanceof Error ? err.message : String(err));
            setLoadError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const rules = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(newPwd) }));
    const mismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError(null);
        if (!currentPwd) {
            setPwdError('Saisissez votre mot de passe actuel.');
            return;
        }
        if (!rules.every((r) => r.passed)) {
            setPwdError(`Le nouveau mot de passe doit comporter au moins ${PASSWORD_MIN_LENGTH} caractères et ne pas être un mot de passe trop courant.`);
            return;
        }
        if (newPwd !== confirmPwd) {
            setPwdError('Les mots de passe ne correspondent pas.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/controller/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
            });
            const body = await readJson(res, 'changement du mot de passe');
            if (!res.ok) {
                setPwdError(isRecord(body) && typeof body.error === 'string' && body.error ? body.error : `Mot de passe non modifié (erreur ${res.status}).`);
                return;
            }
            toast.success('Mot de passe modifié.');
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
        } catch (err) {
            console.error('[profil contrôleur] changement injoignable :', err instanceof Error ? err.message : String(err));
            setPwdError('Connexion impossible : le mot de passe n’a peut-être pas été modifié. Réessayez avec le réseau.');
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <PageHeader
            title="Mon profil"
            description="Vos informations, vos événements et la sécurité du compte."
            back={{ href: '/controller/scanner', label: 'Scanner' }}
        />
    );

    if (!data) {
        return (
            <div className="space-y-6 pb-24">
                {header}
                {loadError ? (
                    <ErrorState title="Profil indisponible" description={loadError} onRetry={() => void load()} isRetrying={isLoading} />
                ) : (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Chargement du profil…</span>
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                    </div>
                )}
            </div>
        );
    }

    const { profile, assignments } = data;
    const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Contrôleur';

    return (
        <div className="space-y-6 pb-24">
            {header}

            <section aria-labelledby={`${uid}-identite`} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-lg font-bold text-brand-fg" aria-hidden="true">
                        {displayName[0]?.toUpperCase() ?? 'C'}
                    </span>
                    <div className="min-w-0 space-y-1">
                        <h2 id={`${uid}-identite`} className="break-words text-base font-semibold text-fg">{displayName}</h2>
                        <Badge variant="brand" size="sm" icon={<ShieldCheck size={12} aria-hidden="true" />}>Contrôleur</Badge>
                    </div>
                </div>
                <p className="flex items-center gap-2 text-sm text-fg">
                    <Phone size={16} className="text-fg-muted" aria-hidden="true" />
                    <span className="sr-only">Téléphone :</span>
                    <span className="font-semibold tabular-nums">{displayPhone(profile.phone)}</span>
                </p>
                {profile.createdAt && (
                    <p className="flex items-center gap-2 text-sm text-fg-muted">
                        <Calendar size={16} aria-hidden="true" />
                        <span>Compte créé le <time dateTime={profile.createdAt}>{formatDate(profile.createdAt)}</time></span>
                    </p>
                )}
            </section>

            <LinkButton href="/profile/notifications" variant="secondary" fullWidth leftIcon={<Bell size={18} aria-hidden="true" />}>
                Préférences de notification
            </LinkButton>

            <section aria-labelledby={`${uid}-evenements`} className="space-y-3">
                <h2 id={`${uid}-evenements`} className="text-lg font-semibold text-fg">
                    {assignments.length === 1 ? 'Mon événement' : `Mes événements (${assignments.length})`}
                </h2>
                {assignments.length === 0 ? (
                    <EmptyState
                        icon={<Calendar size={28} />}
                        title="Aucun événement assigné"
                        description="Votre organisateur vous affecte à un événement depuis son équipe. Il apparaîtra ici."
                        className="my-0"
                    />
                ) : (
                    <ul className="space-y-3">
                        {assignments.map((a) => (
                            <li key={a.id} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                                <p className="break-words text-base font-semibold text-fg">{a.title}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
                                    {a.startDate && (
                                        <span className="flex items-center gap-1.5">
                                            <Calendar size={16} aria-hidden="true" />
                                            {formatEventDateTime(a.startDate, a.startTime)}
                                        </span>
                                    )}
                                    {a.location && (
                                        <span className="flex items-center gap-1.5">
                                            <MapPin size={16} aria-hidden="true" />
                                            {a.location}
                                        </span>
                                    )}
                                </div>
                                <Badge variant={a.canAcceptCash ? 'success' : 'neutral'} size="sm" icon={<Banknote size={12} aria-hidden="true" />}>
                                    {a.canAcceptCash ? 'Encaissement autorisé' : 'Sans encaissement'}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby={`${uid}-securite`} className="space-y-4 rounded-2xl border border-border bg-surface p-4">
                <h2 id={`${uid}-securite`} className="flex items-center gap-2 text-lg font-semibold text-fg">
                    <KeyRound size={20} className="text-brand-fg" aria-hidden="true" />
                    Changer le mot de passe
                </h2>

                {pwdError && (
                    <StatusBanner tone="danger" announce="alert" title="Mot de passe non modifié">
                        {pwdError}
                    </StatusBanner>
                )}

                <form onSubmit={handleChangePassword} noValidate className="space-y-4">
                    <div className="flex items-start gap-2">
                        <TextInput
                            label="Mot de passe actuel"
                            type={showPwd ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={currentPwd}
                            onChange={(e) => setCurrentPwd(e.target.value)}
                            fieldClassName="min-w-0 flex-1"
                        />
                        <IconButton
                            aria-label={showPwd ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
                            aria-pressed={showPwd}
                            variant="ghost"
                            onClick={() => setShowPwd((v) => !v)}
                            className="mt-7"
                        >
                            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                        </IconButton>
                    </div>

                    <TextInput
                        label="Nouveau mot de passe"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        hint={PASSWORD_HINT}
                    />
                    <ul className="space-y-1.5 rounded-2xl border border-border bg-surface-sunken p-3" aria-label="Règles du mot de passe">
                        {rules.map((r) => (
                            <li key={r.key} className="flex items-center gap-2 text-sm">
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                                        r.passed ? 'border-success bg-success text-on-tone' : 'border-border bg-surface text-fg-muted',
                                    )}
                                >
                                    {r.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                                </span>
                                <span className={r.passed ? 'font-medium text-success-fg' : 'text-fg-muted'}>
                                    {r.label}
                                    <span className="sr-only">{r.passed ? ' : respecté' : ' : manquant'}</span>
                                </span>
                            </li>
                        ))}
                    </ul>

                    <TextInput
                        label="Confirmer le nouveau mot de passe"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        error={mismatch ? 'Les mots de passe ne correspondent pas.' : undefined}
                    />

                    <Button type="submit" variant="primary" size="lg" fullWidth isLoading={saving}>
                        Modifier le mot de passe
                    </Button>
                </form>
            </section>
        </div>
    );
}
