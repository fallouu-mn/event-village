'use client';

import React, { useId, useState } from 'react';
import { CheckCircle2, MessageSquareText, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea, TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { OtpInput } from '@/components/auth/OtpInput';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatRetryDelay, retryAfterOf } from '@/lib/format-delay';
import { useIdentityConfirm } from '@/components/admin/IdentityConfirm';

interface StartReply { ok?: boolean; request_id?: string; expires_at?: string | null }
interface ConfirmReply { ok?: boolean; sessions_revoked?: number }

/** Cible du changement : soi-même (SUPERADMIN, avec ou sans code de secours) ou un ADMIN (par le SUPERADMIN). */
export type PhoneChangeTarget = { kind: 'SELF' } | { kind: 'ADMIN'; id: string; name: string; phone: string | null };

function urlsOf(target: PhoneChangeTarget): { start: string; confirm: string } {
    if (target.kind === 'SELF') return { start: '/api/admin/security/phone/start', confirm: '/api/admin/security/phone/confirm' };
    return { start: `/api/admin/users/${target.id}/phone/start`, confirm: `/api/admin/users/${target.id}/phone/confirm` };
}

function failureText(err: unknown, fallback: string): string {
    const wait = err instanceof ApiError && err.status === 429 ? retryAfterOf(err.body) : null;
    return wait ? `${errorMessage(err, fallback)} ${formatRetryDelay(wait)}` : errorMessage(err, fallback);
}

/**
 * Finition 3d (points 2a et 2c) — changer un numéro d'administrateur, prouvé par un code envoyé au NOUVEAU numéro.
 *  1. nouveau numéro (et motif, obligatoire pour le numéro d'un ADMIN) ; mot de passe et code administrateur demandés par
 *     la fenêtre de confirmation (useIdentityConfirm) quand le serveur les exige ; le code part au nouveau numéro ;
 *  2. les 6 chiffres reçus au nouveau numéro (l'ADMIN les dicte au SUPERADMIN) ;
 *  3. « fait » seulement si le serveur répond ok : sessions et appareils révoqués, SMS à l'ancien et au nouveau numéro.
 * Le serveur décide toujours (lib/admin/phone-change.ts) ; l'écran ne change rien de lui-même.
 */
export function PhoneChangeFlow({ target, onDone, onCancel }: {
    target: PhoneChangeTarget;
    onDone?: (sessionsRevoked: number) => void;
    onCancel?: () => void;
}) {
    const errorId = useId();
    const { run, dialog } = useIdentityConfirm();
    const urls = urlsOf(target);
    const byAdmin = target.kind === 'ADMIN';
    const [phone, setPhone] = useState('');
    const [reason, setReason] = useState('');
    const [requestId, setRequestId] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [revoked, setRevoked] = useState<number | null>(null);
    const reasonOk = !byAdmin || reason.trim().length >= 3;

    const start = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!phone.trim() || !reasonOk || busy) return;
        setBusy(true); setError(null);
        try {
            const reply = await run(() => sendJson<StartReply>(urls.start, 'POST', {
                phone: phone.trim(), ...(byAdmin ? { reason: reason.trim() } : {}),
            }));
            if (reply === null) return;
            if (reply.ok === true && typeof reply.request_id === 'string') {
                setRequestId(reply.request_id);
                setCode('');
                return;
            }
            setError('Le serveur n’a pas confirmé l’envoi du code : rien n’a changé. Réessayez.');
        } catch (err) {
            setError(failureText(err, 'Le code n’a pas pu être envoyé. Réessayez.'));
        } finally { setBusy(false); }
    };

    const confirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestId || code.length !== 6 || busy) return;
        setBusy(true); setError(null);
        try {
            const reply = await sendJson<ConfirmReply>(urls.confirm, 'POST', { request_id: requestId, code });
            if (reply.ok === true) {
                const n = Number(reply.sessions_revoked ?? 0);
                setRevoked(n);
                onDone?.(n);
                return;
            }
            setError('Le serveur n’a pas confirmé le changement : le numéro n’a pas changé. Réessayez.');
        } catch (err) {
            setError(failureText(err, 'Code refusé. Réessayez.'));
        } finally { setBusy(false); }
    };

    if (revoked !== null) {
        return (
            <StatusBanner tone="success" title="Numéro changé">
                {byAdmin
                    ? `Le nouveau numéro de ${target.name} est enregistré. Il est déconnecté de tous ses appareils et doit se reconnecter. Un SMS est parti à l’ancien et au nouveau numéro.`
                    : 'Votre nouveau numéro est enregistré. Vos autres appareils sont déconnectés. Un SMS est parti à l’ancien et au nouveau numéro.'}
            </StatusBanner>
        );
    }

    return (
        <div className="space-y-4">
            {error && <StatusBanner tone="danger" announce="alert" title="Numéro non changé"><span id={errorId}>{error}</span></StatusBanner>}
            {!requestId ? (
                <form className="space-y-4" onSubmit={(e) => void start(e)}>
                    {byAdmin && target.phone && <p className="text-sm text-fg">Numéro actuel : <span className="font-semibold tabular-nums">{target.phone}</span></p>}
                    <TextInput
                        label="Nouveau numéro (Sénégal)"
                        type="tel"
                        inputMode="tel"
                        autoComplete={byAdmin ? 'off' : 'tel'}
                        required
                        placeholder="77 123 45 67"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="tabular-nums"
                        hint={byAdmin ? 'Un code part à ce numéro : l’administrateur vous le dicte.' : 'Un code part à ce numéro pour prouver qu’il est bien le vôtre.'}
                    />
                    {byAdmin && (
                        <Textarea
                            label="Motif (obligatoire)"
                            hint="3 caractères au moins. Il reste dans le journal."
                            required
                            rows={3}
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    )}
                    <p className="text-sm text-fg-muted">Votre mot de passe et le code administrateur peuvent vous être demandés.</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Annuler</Button>}
                        <Button type="submit" variant="primary" isLoading={busy} disabled={!phone.trim() || !reasonOk} leftIcon={<MessageSquareText size={18} />}>
                            Envoyer le code au nouveau numéro
                        </Button>
                    </div>
                </form>
            ) : (
                <form className="space-y-4" onSubmit={(e) => void confirm(e)}>
                    <p className="text-sm text-fg">
                        {byAdmin
                            ? `Demandez à ${target.name} les 6 chiffres reçus au ${phone.trim()}. Le code est valable 10 minutes.`
                            : `Saisissez les 6 chiffres reçus au ${phone.trim()}. Le code est valable 10 minutes.`}
                    </p>
                    <OtpInput value={code} onChange={setCode} disabled={busy} hasError={!!error} describedBy={error ? errorId : undefined} />
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => { setRequestId(null); setError(null); }} disabled={busy}>Changer de numéro</Button>
                        <Button type="submit" variant="primary" isLoading={busy} disabled={code.length !== 6} leftIcon={<CheckCircle2 size={18} />}>
                            Valider le nouveau numéro
                        </Button>
                    </div>
                </form>
            )}
            {dialog}
        </div>
    );
}

/** Finition 3d (point 2a) — « Changer le numéro » sur la ligne d'un ADMIN, pour le SUPERADMIN. */
export function AdminPhoneChangeDialog({ user, onClose, onChanged }: {
    user: { id: string; first_name: string; last_name: string; phone: string | null };
    onClose: () => void;
    onChanged: () => void;
}) {
    const [done, setDone] = useState(false);
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'cet administrateur';
    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Changer le numéro de ${name}`}
            subtitle="Pour un administrateur qui a perdu son téléphone. Le nouveau numéro est prouvé par un code ; ensuite il est déconnecté de tous ses appareils."
            icon={<Smartphone size={20} />}
            maxWidth="lg"
        >
            <div className="space-y-4">
                <PhoneChangeFlow
                    target={{ kind: 'ADMIN', id: user.id, name, phone: user.phone }}
                    onCancel={onClose}
                    onDone={() => { setDone(true); onChanged(); }}
                />
                {done && <Button variant="primary" fullWidth onClick={onClose}>Fermer</Button>}
            </div>
        </Modal>
    );
}
