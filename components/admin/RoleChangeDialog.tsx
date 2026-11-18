'use client';

import React, { useId, useState } from 'react';
import { UserCog } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
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

const LABELS: Readonly<Record<RoleLevel, string>> = {
    CLIENT: 'Client (sans administration)',
    ADMIN: 'Administrateur',
    SUPERADMIN: 'Superadmin',
};

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

/** Ce que le changement fait vraiment, en mots simples (finition 3d, point 3 ; confirmations qui disent vrai). */
export function roleChangeEffect(from: RoleLevel, to: RoleLevel, self: boolean): string {
    if (from === 'CLIENT' && to === 'ADMIN') {
        return 'Il ouvre l’administration sans aucun droit : vous lui donnez ses droits ensuite. S’il contrôle des entrées, il quitte les équipes de contrôle (vous le confirmerez).';
    }
    if (from === 'ADMIN' && to === 'CLIENT') {
        return 'Il perd l’administration : ses droits sont retirés et il est déconnecté de tous ses appareils.';
    }
    if (from === 'ADMIN' && to === 'SUPERADMIN') {
        return 'Il aura tous les droits, dont les réglages et les rôles. Chaque Superadmin reçoit un SMS d’alerte.';
    }
    return self
        ? 'Vous quittez le rôle de Superadmin : vous gardez l’administration sans aucun droit, vous êtes déconnecté de tous vos appareils et vos codes de secours sont annulés.'
        : 'Il garde l’administration sans aucun droit, il est déconnecté de tous ses appareils et ses codes de secours sont annulés.';
}

/**
 * Finition 3d (point 3) — « Changer le rôle », SUPERADMIN seulement, sur la ligne d'un compte (sauf une organisatrice).
 * Client → Administrateur, Administrateur → client ou Superadmin, Superadmin → Administrateur. Motif obligatoire ; mot de
 * passe et code administrateur demandés par la fenêtre de confirmation (useIdentityConfirm) quand le serveur les exige.
 * Contrôleur promu : la confirmation de la finition 1 (retrait des équipes) s'affiche d'abord, rien ne change avant
 * « Confirmer ». L'écran ne dit « fait » que si le serveur rend le rôle demandé (`role_after`).
 */
export function RoleChangeDialog({ user, self, onClose, onChanged }: {
    user: RoleTarget;
    self: boolean;
    onClose: () => void;
    onChanged: (role: RoleLevel) => void;
}) {
    const id = useId();
    const toast = useToast();
    const { run, dialog } = useIdentityConfirm();
    const from = roleLevelOf(user.role);
    const targets = allowedTargets(from);
    const [to, setTo] = useState<RoleLevel>(targets[0]);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [staffConfirm, setStaffConfirm] = useState<string | null>(null);
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'ce compte';
    const reasonOk = reason.trim().length >= 3;

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
                toast.success(`Rôle changé : ${name} est maintenant ${LABELS[to].toLowerCase()}.`);
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

    return (
        <>
            <Modal
                isOpen
                onClose={() => { if (!busy) onClose(); }}
                title={self ? 'Quitter le rôle de Superadmin' : `Changer le rôle de ${name}`}
                subtitle={`Rôle actuel : ${LABELS[from]}.`}
                icon={<UserCog size={20} />}
                maxWidth="lg"
                busy={busy}
            >
                <div className="space-y-4">
                    {error && <StatusBanner tone="danger" announce="alert" title="Rôle non changé">{error}</StatusBanner>}
                    {staffConfirm ? (
                        <div className="space-y-4">
                            <StatusBanner tone="warning" title="Il quitte les équipes de contrôle">{staffConfirm}</StatusBanner>
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button variant="secondary" onClick={() => setStaffConfirm(null)} disabled={busy}>Retour</Button>
                                <Button variant="primary" isLoading={busy} onClick={() => void submit(true)}>Confirmer le changement</Button>
                            </div>
                        </div>
                    ) : (
                        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
                            <fieldset className="space-y-2">
                                <legend className="text-sm font-semibold text-fg">Nouveau rôle</legend>
                                {targets.map((t) => (
                                    <label
                                        key={t}
                                        className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3',
                                            to === t ? 'border-brand bg-brand-bg' : 'border-border bg-surface hover:bg-surface-sunken')}
                                    >
                                        <input type="radio" name={`${id}-role`} value={t} checked={to === t} onChange={() => setTo(t)}
                                            className="mt-1 h-5 w-5 flex-shrink-0 accent-brand" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-fg">{LABELS[t]}</span>
                                            <span className="block text-sm text-fg-muted">{roleChangeEffect(from, t, self)}</span>
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                            <Textarea
                                label="Motif (obligatoire)"
                                hint="3 caractères au moins. Il reste dans le journal."
                                required
                                rows={3}
                                maxLength={500}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            <p className="text-sm text-fg-muted">Votre mot de passe et le code administrateur reçu par SMS vous seront demandés.</p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Annuler</Button>
                                <Button type="submit" variant="primary" isLoading={busy} disabled={!reasonOk}>Changer le rôle</Button>
                            </div>
                        </form>
                    )}
                </div>
            </Modal>
            {dialog}
        </>
    );
}
