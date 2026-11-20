'use client';

import React, { useId, useState } from 'react';
import { Info, UserCog } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { roleLabel } from '@/lib/labels/account';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useIdentityConfirm } from '@/components/admin/IdentityConfirm';

export type RoleLevel = 'CLIENT' | 'ADMIN' | 'SUPERADMIN';

export interface RoleTarget {
    id: string;
    first_name: string;
    last_name: string;
    /** Rôle le plus élevé du compte (users.role). */
    role: string;
}

interface RoleReply {
    ok?: boolean;
    requires_confirmation?: boolean;
    code?: string;
    message?: string;
    role_before?: string;
    role_after?: string;
}

/** Rôle nommé dans une phrase (« … est maintenant administrateur »). */
const IN_SENTENCE: Readonly<Record<RoleLevel, string>> = {
    CLIENT: 'client',
    ADMIN: 'administrateur',
    SUPERADMIN: 'super-administrateur',
};

/** Rôles proposés en cartes (design 1c, point 4 ; revue d'ergonomie, section 5.2) : une phrase chacun. */
type RoleCard = 'CLIENT' | 'CONTROLEUR' | 'ADMIN' | 'SUPERADMIN';
const CARDS: ReadonlyArray<{ role: RoleCard; label: string; sentence: string }> = [
    { role: 'CLIENT', label: 'Client', sentence: 'Achète des billets, sans accès professionnel.' },
    { role: 'CONTROLEUR', label: 'Contrôleur', sentence: 'Scanne les billets des événements où un partenaire l’affecte.' },
    { role: 'ADMIN', label: 'Administrateur', sentence: 'Agit selon les droits que vous lui donnez.' },
    { role: 'SUPERADMIN', label: 'Super-administrateur', sentence: 'Tous les droits, dont les réglages et la création d’administrateurs.' },
];

export function roleLevelOf(role: string): RoleLevel {
    if (role === 'SUPERADMIN') return 'SUPERADMIN';
    if (role === 'ADMIN') return 'ADMIN';
    return 'CLIENT';
}

/** Changements permis depuis un rôle (le reste se fait en deux temps). */
export function allowedTargets(from: RoleLevel): RoleLevel[] {
    if (from === 'CLIENT') return ['ADMIN'];
    if (from === 'ADMIN') return ['CLIENT', 'SUPERADMIN'];
    return ['ADMIN'];
}

/**
 * Ce que le changement fait vraiment, et qui est prévenu, en mots simples (finition 3d, point 3 ; design 1c, point 4 :
 * confirmations qui disent vrai). Seule la nomination d'un super-administrateur met un avis en file (SUPERADMIN_PROMOTED,
 * M/20261120000003 : chaque super-administrateur actif) ; les autres changements ne préviennent personne.
 */
export function roleChangeEffect(from: RoleLevel, to: RoleLevel, self: boolean): string {
    if (from === 'CLIENT' && to === 'ADMIN') {
        return 'Il ouvre l’administration sans aucun droit : vous lui donnez ses droits juste après. S’il contrôle des entrées, il quitte les équipes de contrôle (vous le confirmerez). Personne n’est prévenu.';
    }
    if (from === 'ADMIN' && to === 'CLIENT') {
        return 'Il perd l’administration : ses droits sont retirés et il est déconnecté de tous ses appareils. Personne n’est prévenu.';
    }
    if (from === 'ADMIN' && to === 'SUPERADMIN') {
        return 'Il aura tous les droits, dont les réglages et les rôles. Chaque super-administrateur reçoit un SMS d’alerte.';
    }
    return self
        ? 'Vous gardez l’administration sans aucun droit, vous êtes déconnecté de tous vos appareils et vos codes de secours sont annulés. Personne n’est prévenu.'
        : 'Il garde l’administration sans aucun droit, il est déconnecté de tous ses appareils et ses codes de secours sont annulés. Personne n’est prévenu.';
}

/** Pourquoi une carte n'est pas proposée (le rôle actuel est dit à part). */
function unavailableReason(card: RoleCard, from: RoleLevel): string {
    if (card === 'CONTROLEUR') return 'Ne se donne pas ici : créez un compte de contrôleur.';
    if (from === 'CLIENT' && card === 'SUPERADMIN') return 'Passez d’abord par administrateur.';
    if (from === 'SUPERADMIN' && card === 'CLIENT') return 'Passez d’abord par administrateur.';
    return 'Pas proposé pour ce compte.';
}

/**
 * Finition 3d (point 3) — « Changer le rôle », SUPERADMIN seulement, sur la ligne d'un compte (sauf une organisatrice).
 * Client → administrateur, administrateur → client ou super-administrateur, super-administrateur → administrateur.
 * Motif obligatoire ; mot de passe et code administrateur demandés par la fenêtre de confirmation (useIdentityConfirm)
 * quand le serveur les exige. Contrôleur promu : la confirmation de la finition 1 (retrait des équipes) s'affiche
 * d'abord, rien ne change avant « Confirmer ». L'écran ne dit « fait » que si le serveur rend le rôle demandé (`role_after`).
 *
 * Design 1c (point 4) : fenêtre de la charte (Modal : focus piégé, Échap ferme) ; titre en question ; les quatre rôles en
 * cartes radio, une phrase chacun (rôle actuel et changements impossibles dits, non cliquables) ; la conséquence en une
 * phrase (ce que la personne pourra faire, qui est prévenu) ; bouton qui dit l'action (« Passer en administrateur ») et
 * bouton de retrait « Garder le rôle actuel ».
 */
export function RoleChangeDialog({ user, self, onClose, onChanged }: {
    user: RoleTarget;
    self: boolean;
    onClose: () => void;
    onChanged: (role: RoleLevel) => void;
}) {
    const id = useId();
    const formId = `${id}-formulaire`;
    const toast = useToast();
    const { run, dialog } = useIdentityConfirm();
    const from = roleLevelOf(user.role);
    const current: RoleCard = user.role === 'CONTROLEUR' ? 'CONTROLEUR' : from;
    const targets = allowedTargets(from);
    const [to, setTo] = useState<RoleLevel>(targets[0]);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [staffConfirm, setStaffConfirm] = useState<string | null>(null);
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'ce compte';
    const reasonOk = reason.trim().length >= 3;
    const actionLabel = `Passer en ${IN_SENTENCE[to]}`;

    const close = () => { if (!busy) onClose(); };

    const submit = async (confirmStaff: boolean) => {
        if (!reasonOk || busy) return;
        setBusy(true);
        setError(null);
        try {
            const reply = await run(() => sendJson<RoleReply>(`/api/admin/users/${user.id}/role`, 'POST', {
                role: to, reason: reason.trim(), ...(confirmStaff ? { confirm_staff_promotion: true } : {}),
            }));
            if (reply === null) return;
            if (reply.requires_confirmation === true && reply.code === 'STAFF_PROMOTION_CONFIRMATION') {
                setStaffConfirm(reply.message ?? 'Ce compte quitte les équipes de contrôle dont il fait partie.');
                return;
            }
            if (reply.ok === true && reply.role_after === to) {
                toast.success(`Rôle changé : ${name} est maintenant ${IN_SENTENCE[to]}.`);
                onChanged(to);
                return;
            }
            setError('Le serveur n’a pas confirmé le changement : rien n’a changé à l’écran. Relisez la liste avant de recommencer.');
        } catch (err) {
            setError(errorMessage(err, 'Le rôle n’a pas pu être changé. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    const footer = staffConfirm ? (
        <>
            <Button variant="secondary" onClick={() => setStaffConfirm(null)} disabled={busy} className="flex-1 sm:flex-none">Retour</Button>
            <Button variant="primary" isLoading={busy} onClick={() => void submit(true)} className="flex-1 sm:flex-none">{actionLabel}</Button>
        </>
    ) : (
        <>
            <Button type="button" variant="secondary" onClick={close} disabled={busy} className="flex-1 sm:flex-none">Garder le rôle actuel</Button>
            <Button type="submit" form={formId} variant="primary" isLoading={busy} disabled={!reasonOk} className="flex-1 sm:flex-none">{actionLabel}</Button>
        </>
    );

    return (
        <>
            <Modal
                isOpen
                onClose={close}
                title={self ? 'Quitter le rôle de super-administrateur ?' : `Changer le rôle de ${name} ?`}
                subtitle={`Rôle actuel : ${roleLabel(current)}.`}
                icon={<UserCog size={20} />}
                maxWidth="lg"
                busy={busy}
                footer={footer}
            >
                <div className="flex flex-col gap-4">
                    {error && <StatusBanner tone="danger" announce="alert" title="Rôle non changé">{error}</StatusBanner>}
                    {staffConfirm ? (
                        <StatusBanner tone="warning" title="Il quitte les équipes de contrôle">{staffConfirm}</StatusBanner>
                    ) : (
                        <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
                            <fieldset className="flex flex-col gap-2">
                                <legend className="mb-2 text-sm font-semibold text-foreground-strong">Nouveau rôle</legend>
                                {CARDS.map((card) => {
                                    const level = card.role === 'CONTROLEUR' ? null : card.role;
                                    const isCurrent = card.role === current;
                                    const enabled = !isCurrent && level !== null && targets.includes(level);
                                    const checked = enabled && level === to;
                                    const inputId = `${id}-${card.role.toLowerCase()}`;
                                    const noteId = `${inputId}-note`;
                                    return (
                                        <label
                                            key={card.role}
                                            htmlFor={inputId}
                                            className={cn(
                                                'flex min-h-11 items-start gap-3 rounded-xl border p-3 transition-colors duration-fast ease-standard',
                                                enabled ? 'cursor-pointer' : 'cursor-not-allowed bg-muted',
                                                checked ? 'border-primary bg-primary-soft' : 'border-border',
                                                enabled && !checked && 'bg-card hover:bg-muted',
                                            )}
                                        >
                                            <input
                                                id={inputId}
                                                type="radio"
                                                name={`${id}-role`}
                                                value={card.role}
                                                checked={checked}
                                                disabled={!enabled || busy}
                                                onChange={() => { if (level) setTo(level); }}
                                                aria-describedby={noteId}
                                                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className="text-sm font-semibold text-foreground-strong">{card.label}</span>
                                                    {isCurrent && <span className="text-sm font-semibold text-primary-text">Rôle actuel</span>}
                                                </span>
                                                <span id={noteId} className="block text-sm text-muted-foreground">
                                                    {card.sentence}
                                                    {!enabled && !isCurrent && <> {unavailableReason(card.role, from)}</>}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </fieldset>
                            <p className="flex items-start gap-2 rounded-xl border border-info-border bg-info-soft p-3 text-sm text-info-text" aria-live="polite">
                                <Info size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <span>{roleChangeEffect(from, to, self)}</span>
                            </p>
                            <Textarea
                                label="Motif (obligatoire)"
                                hint="3 caractères au moins. Il reste dans le journal."
                                required
                                rows={3}
                                maxLength={500}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={busy}
                            />
                            <p className="text-sm text-muted-foreground">Votre mot de passe et le code administrateur reçu par SMS vous seront demandés.</p>
                        </form>
                    )}
                </div>
            </Modal>
            {dialog}
        </>
    );
}
