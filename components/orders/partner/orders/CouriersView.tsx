'use client';

/**
 * Lot 12c — livreurs de la partenaire (/partner/orders/livreurs) : inviter une personne par son numéro (elle doit avoir
 * un compte Event Village et accepter l'invitation), voir les invitations, retirer un livreur. Routes : GET et POST
 * /api/partner/couriers, DELETE /api/partner/couriers/[userId] ; refus du serveur affichés tels quels (10 invitations par
 * jour au plus, numéro sans compte…). Avant l'accord, seuls le numéro saisi et un nom masqué sont montrés.
 */
import React, { useState } from 'react';
import { Bike, Phone, UserMinus, UserPlus } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { TextInput } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useServerData } from '@/components/partner/useServerData';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime } from '@/lib/format';
import { PARTNER_COURIERS_URL, partnerCourierUrl } from '@/lib/orders/partner-endpoints';
import type { CourierRow, CouriersReply } from './order-types';

const STATUS_BADGE: Record<string, BadgeVariant> = { ACTIVE: 'success', PENDING: 'warning', DECLINED: 'neutral', REMOVED: 'neutral' };

export function CouriersView() {
    const toast = useToast();
    const { data, error, loading, reload } = useServerData<CouriersReply>(PARTNER_COURIERS_URL);
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
    const [inviting, setInviting] = useState(false);
    const [removing, setRemoving] = useState<CourierRow | null>(null);
    const [removeBusy, setRemoveBusy] = useState(false);

    const couriers = data?.couriers ?? [];
    const active = couriers.filter((c) => c.status === 'ACTIVE');
    const others = couriers.filter((c) => c.status !== 'ACTIVE');

    const invite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^\s*(\+?221)?\s*7[0-9\s]{8,12}$/.test(phone)) {
            setPhoneError('Indiquez un numéro de mobile sénégalais (9 chiffres, commençant par 7).');
            return;
        }
        setInviting(true);
        setPhoneError(undefined);
        try {
            await sendJson(PARTNER_COURIERS_URL, 'POST', { phone });
            toast.success('Invitation envoyée : la personne doit l’accepter depuis son compte.');
            setPhone('');
            await reload();
        } catch (err) {
            setPhoneError(errorMessage(err, 'Invitation impossible pour le moment.'));
        } finally {
            setInviting(false);
        }
    };

    const remove = async () => {
        if (!removing) return;
        setRemoveBusy(true);
        try {
            await sendJson(partnerCourierUrl(removing.userId), 'DELETE');
            toast.success('Livreur retiré de votre équipe.');
            setRemoving(null);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Retrait impossible pour le moment.'));
        } finally {
            setRemoveBusy(false);
        }
    };

    const row = (c: CourierRow) => (
        <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                    <Bike size={20} />
                </span>
                <div className="min-w-0">
                    <p className="break-words text-base font-semibold text-foreground-strong">{c.firstName || c.displayName || 'Livreur'}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                        {c.phone && <span className="inline-flex items-center gap-1 tabular-nums"><Phone size={14} aria-hidden="true" />{c.phone}</span>}
                        <span>Invité le <time dateTime={c.invitedAt} className="tabular-nums">{formatDateTime(c.invitedAt)}</time></span>
                    </p>
                </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
                <Badge variant={STATUS_BADGE[c.status] ?? 'neutral'}>{c.statusLabel}</Badge>
                {(c.status === 'ACTIVE' || c.status === 'PENDING') && (
                    <Button variant="ghost" size="sm" leftIcon={<UserMinus size={16} />} className="text-danger-text" onClick={() => setRemoving(c)}
                        aria-label={`Retirer ${c.firstName || c.displayName || 'ce livreur'}`}>
                        Retirer
                    </Button>
                )}
            </div>
        </li>
    );

    return (
        <div className="space-y-6 pb-24 lg:pb-12">
            <PageHeader
                back={{ href: '/partner/orders', label: 'Commandes' }}
                title="Livreurs"
                description="Les personnes qui livrent vos commandes. Elles ne voient que les livraisons que vous leur confiez, et jamais le code du client."
            />

            <section aria-labelledby="inviter-titre" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 id="inviter-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                    <UserPlus size={20} className="text-primary-text" aria-hidden="true" />
                    Inviter un livreur
                </h2>
                <form onSubmit={(e) => void invite(e)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <TextInput
                        label="Numéro de mobile"
                        hint="La personne doit déjà avoir un compte Event Village avec ce numéro."
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="77 123 45 67"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPhoneError(undefined); }}
                        error={phoneError}
                        fieldClassName="flex-1"
                    />
                    <Button type="submit" variant="primary" isLoading={inviting} className="sm:mt-7">Envoyer l’invitation</Button>
                </form>
            </section>

            {loading && !data ? (
                <div className="h-40 rounded-2xl bg-muted motion-safe:animate-pulse" role="status" aria-busy="true"><span className="sr-only">Chargement des livreurs…</span></div>
            ) : error && !data ? (
                <ErrorState title="Livreurs indisponibles" description={error} onRetry={() => void reload()} />
            ) : couriers.length === 0 ? (
                <EmptyState icon={<Bike size={28} />} title="Aucun livreur pour le moment" description="Sans livreur, vous livrez vous-même vos commandes : c’est permis. Invitez quelqu’un quand vous voulez." />
            ) : (
                <>
                    <section aria-labelledby="actifs-titre" className="space-y-3">
                        <h2 id="actifs-titre" className="text-lg font-bold text-foreground-strong">Livrent pour vous</h2>
                        {active.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Personne n’a encore accepté votre invitation.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">{active.map(row)}</ul>
                        )}
                    </section>
                    {others.length > 0 && (
                        <section aria-labelledby="invitations-titre" className="space-y-3">
                            <h2 id="invitations-titre" className="text-lg font-bold text-foreground-strong">Invitations</h2>
                            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">{others.map(row)}</ul>
                        </section>
                    )}
                </>
            )}

            <ConfirmDialog
                isOpen={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={() => void remove()}
                title="Retirer ce livreur ?"
                confirmLabel="Retirer"
                variant="danger"
                isLoading={removeBusy}
            >
                <p className="text-sm text-foreground">
                    Il ne verra plus aucune de vos commandes. Les livraisons que vous lui aviez confiées et qui ne sont pas encore parties lui sont retirées : confiez-les à quelqu’un d’autre ou livrez-les vous-même. Une livraison déjà en route reste à terminer.
                </p>
            </ConfirmDialog>
        </div>
    );
}
