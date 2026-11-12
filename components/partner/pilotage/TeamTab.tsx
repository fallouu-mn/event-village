'use client';

import React, { useEffect, useState } from 'react';
import { Banknote, Phone, Send, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput } from '@/components/ui/Field';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { formatDateTime, formatInteger } from '@/lib/format';
import { isEventEligibleForController } from '@/lib/events/event-status';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { ZonesEditor, type ZonesConfig } from '@/components/partner/zones/ZonesEditor';
import { PilotageSection } from './PilotageBlocks';
import type { PilotageTeam } from './types';

type Controller = PilotageTeam['controllers'][number];

/** Lot 9 ter (9t.15) : portes d'un événement à zones, et porte de chaque contrôleur (servies par GET …/zones). */
interface GateChoice { id: string; label: string; name: string }
interface GateSetup { gates: GateChoice[]; gateId: string | null; changeAllowed: boolean }

interface InviteResponse {
    success?: boolean;
    message?: string;
    requires_confirmation?: boolean;
    existing_user?: { display_name: string; phone: string };
}

const SN_PHONE_RE = /^(7[0-8])\d{7}$/;

function displayPhone(phone: string | null): string {
    if (!phone) return 'Numéro inconnu';
    return phone.replace(/^\+221/, '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
}

/** Interrupteur accessible (role switch) : libellé visible, état lu par les lecteurs d'écran. */
function CashSwitch({ checked, disabled, busy, onToggle }: { checked: boolean; disabled: boolean; busy: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-busy={busy || undefined}
            disabled={disabled || busy}
            onClick={onToggle}
            className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                checked ? 'border-success-border bg-success-bg text-success-fg' : 'border-border bg-surface-sunken text-fg-muted',
            )}
        >
            <span
                aria-hidden="true"
                className={cn('relative inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full px-0.5 transition-colors duration-200', checked ? 'bg-success' : 'bg-border-strong')}
            >
                <span className={cn('h-5 w-5 rounded-full bg-surface shadow transition-transform duration-200', checked ? 'translate-x-4' : 'translate-x-0')} />
            </span>
            <span>{checked ? 'Espèces autorisées' : 'Espèces non autorisées'}</span>
        </button>
    );
}

/**
 * Lot 9 ter (9t.15, contrat C.1.4) : sur un événement à zones, la porte du contrôleur remplace le point d'entrée libre :
 * liste « Porte » (« Aucune porte » puis « {porte} — {zone} »), interrupteur « Peut changer de porte », enregistrés par
 * PATCH /api/partner/team/gate (le serveur vérifie la porte et les droits).
 */
function GateFields({ eventId, controller, setup, canManage, onChanged }: {
    eventId: string;
    controller: Controller;
    setup: GateSetup;
    canManage: boolean;
    onChanged: () => Promise<void>;
}) {
    const toast = useToast();
    const [gateId, setGateId] = useState(setup.gateId ?? '');
    const [changeAllowed, setChangeAllowed] = useState(setup.changeAllowed);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setGateId(setup.gateId ?? '');
        setChangeAllowed(setup.changeAllowed);
    }, [setup.gateId, setup.changeAllowed]);

    const changed = gateId !== (setup.gateId ?? '') || changeAllowed !== setup.changeAllowed;

    const save = async (): Promise<void> => {
        setSaving(true);
        try {
            await sendJson('/api/partner/team/gate', 'PATCH', {
                eventId,
                controllerId: controller.controller_id,
                gateId: gateId || null,
                gateChangeAllowed: changeAllowed,
            });
            const gate = setup.gates.find((g) => g.id === gateId);
            toast.success(gate ? `Porte de ${controller.name} : ${gate.name}.` : `Porte de ${controller.name} retirée.`);
            await onChanged();
        } catch (err) {
            toast.error(errorMessage(err, 'Modification de la porte impossible.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select
                    id={`porte-${controller.assignment_id}`}
                    label="Porte"
                    value={gateId}
                    disabled={!canManage || saving}
                    onChange={(e) => setGateId(e.target.value)}
                    options={[{ value: '', label: 'Aucune porte' }, ...setup.gates.map((g) => ({ value: g.id, label: g.label }))]}
                    fieldClassName="flex-1"
                />
                {canManage && (
                    <Button variant="secondary" onClick={() => void save()} disabled={!changed} isLoading={saving}>
                        Enregistrer
                    </Button>
                )}
            </div>
            <Switch
                label="Peut changer de porte"
                description="Le contrôleur choisit lui-même sa porte dans le scanner."
                checked={changeAllowed}
                disabled={!canManage || saving}
                onChange={setChangeAllowed}
            />
        </div>
    );
}

function ControllerCard({
    eventId,
    controller,
    canManage,
    gateSetup,
    onChanged,
    onRemove,
}: {
    eventId: string;
    controller: Controller;
    canManage: boolean;
    /** Événement à zones : porte du contrôleur ; null sans zone (point d'entrée libre, inchangé). */
    gateSetup: GateSetup | null;
    onChanged: () => Promise<void>;
    onRemove: (c: Controller) => void;
}) {
    const toast = useToast();
    const [entryPoint, setEntryPoint] = useState(controller.entry_point ?? '');
    const [savingPoint, setSavingPoint] = useState(false);
    const [savingCash, setSavingCash] = useState(false);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        setEntryPoint(controller.entry_point ?? '');
    }, [controller.entry_point]);

    const pointChanged = entryPoint.trim() !== (controller.entry_point ?? '');

    const savePoint = async (): Promise<void> => {
        setSavingPoint(true);
        try {
            await sendJson('/api/partner/team/entry-point', 'PATCH', {
                controllerId: controller.controller_id,
                eventId,
                entryPoint: entryPoint.trim() || null,
            });
            toast.success(entryPoint.trim() ? `Point d’entrée de ${controller.name} : ${entryPoint.trim()}.` : `Point d’entrée de ${controller.name} effacé.`);
            await onChanged();
        } catch (err) {
            toast.error(errorMessage(err, 'Modification du point d’entrée impossible.'));
        } finally {
            setSavingPoint(false);
        }
    };

    const toggleCash = async (): Promise<void> => {
        setSavingCash(true);
        const next = !controller.can_accept_cash;
        try {
            const res = await sendJson<{ openShift?: boolean }>(`/api/partner/team/assignments/${controller.assignment_id}`, 'PATCH', { canAcceptCash: next });
            toast.success(next ? `${controller.name} peut encaisser des espèces.` : `${controller.name} ne peut plus encaisser d’espèces.`);
            if (res.openShift && !next) toast.info('Une caisse est encore ouverte pour ce contrôleur : elle devra être clôturée normalement.');
            await onChanged();
        } catch (err) {
            toast.error(errorMessage(err, 'Modification de la permission espèces impossible.'));
        } finally {
            setSavingCash(false);
        }
    };

    const resend = async (): Promise<void> => {
        setResending(true);
        try {
            const res = await sendJson<InviteResponse>('/api/partner/team/invite', 'POST', {
                event_id: eventId,
                phone: controller.phone ?? '',
                resend: true,
                can_accept_cash: controller.can_accept_cash,
            });
            toast.success(res.message || 'Invitation renvoyée par SMS.');
        } catch (err) {
            toast.error(errorMessage(err, 'Renvoi de l’invitation impossible.'));
        } finally {
            setResending(false);
        }
    };

    const fieldId = `point-entree-${controller.assignment_id}`;

    return (
        <li className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="break-words text-base font-semibold text-fg">{controller.name}</p>
                    <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                        <Phone size={14} aria-hidden="true" />
                        <span className="tabular-nums">{displayPhone(controller.phone)}</span>
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-fg-muted">
                        {formatInteger(controller.accepted)} entrée(s) validée(s)
                        {controller.last_activity_at && (
                            <>
                                {' · dernière activité le '}
                                <time dateTime={controller.last_activity_at}>{formatDateTime(controller.last_activity_at)}</time>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!controller.account_active && (
                        <span className="inline-flex min-h-8 items-center rounded-lg border border-warning-border bg-warning-bg px-2.5 text-sm font-semibold text-warning-fg">
                            Compte inactif
                        </span>
                    )}
                    {controller.open_shift_id && (
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-info-border bg-info-bg px-2.5 text-sm font-semibold text-info-fg">
                            <Banknote size={14} aria-hidden="true" />
                            Caisse ouverte
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                {gateSetup ? (
                    <GateFields eventId={eventId} controller={controller} setup={gateSetup} canManage={canManage} onChanged={onChanged} />
                ) : (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                        <TextInput
                            id={fieldId}
                            label="Point d’entrée"
                            placeholder="Porte Nord, Entrée VIP…"
                            value={entryPoint}
                            maxLength={80}
                            disabled={!canManage || savingPoint}
                            onChange={(e) => setEntryPoint(e.target.value)}
                            fieldClassName="flex-1"
                        />
                        {canManage && (
                            <Button variant="secondary" onClick={() => void savePoint()} disabled={!pointChanged} isLoading={savingPoint}>
                                Enregistrer
                            </Button>
                        )}
                    </div>
                )}
                <CashSwitch checked={controller.can_accept_cash} disabled={!canManage} busy={savingCash} onToggle={() => void toggleCash()} />
            </div>

            {canManage && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button variant="ghost" size="sm" leftIcon={<Send size={16} />} onClick={() => void resend()} isLoading={resending}>
                        Renvoyer l’invitation par SMS
                    </Button>
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 size={16} />} onClick={() => onRemove(controller)} className="text-danger-fg">
                        Retirer de l’événement
                    </Button>
                </div>
            )}
        </li>
    );
}

/**
 * Onglet Équipe (contrat I) : contrôleurs affectés (pilotage_team), point d'entrée, permission espèces
 * modifiable par affectation (PATCH /api/partner/team/assignments/[id], journalisé), invitation, renvoi
 * du SMS et retrait. Lecture seule pour un admin (propriétaire seul).
 * Lot 9 bis : R97 plus de champ Email (ignoré par la route) ; R37 un compte existant reçoit une invitation qu'il accepte
 * lui-même, il n'est affecté qu'après.
 * Lot 9 ter (9t.15) : éditeur « Zones et portes » au-dessus des contrôleurs ; sur un événement à zones, chaque contrôleur
 * reçoit une porte (et le droit d'en changer) au lieu du point d'entrée libre.
 */
export function TeamTab({ eventId, eventStatus, signal }: { eventId: string; eventStatus: string; signal: number }) {
    const toast = useToast();
    const { data, error, loading, refreshing, reload } = useServerData<PilotageTeam>(`/api/partner/events/${eventId}/pilotage/team`, signal);
    const zones = useServerData<ZonesConfig>(`/api/partner/events/${eventId}/zones`, signal);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [inviteCash, setInviteCash] = useState(false);
    const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
    const [inviting, setInviting] = useState(false);
    const [existing, setExisting] = useState<{ display_name: string; phone: string; message: string } | null>(null);
    const [promoting, setPromoting] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<Controller | null>(null);
    const [removing, setRemoving] = useState(false);

    const eligible = isEventEligibleForController(eventStatus);
    const canManage = data?.can_manage === true;

    const resetForm = (): void => {
        setFirstName('');
        setLastName('');
        setPhone('');
        setInviteCash(false);
        setPhoneError(undefined);
    };

    const invite = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        const cleanPhone = phone.replace(/\s/g, '');
        if (!SN_PHONE_RE.test(cleanPhone)) {
            setPhoneError('Saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67).');
            return;
        }
        setPhoneError(undefined);
        setInviting(true);
        try {
            const res = await sendJson<InviteResponse>('/api/partner/team/invite', 'POST', {
                event_id: eventId,
                phone: cleanPhone,
                first_name: firstName.trim() || 'Contrôleur',
                last_name: lastName.trim(),
                can_accept_cash: inviteCash,
            });
            if (res.requires_confirmation && res.existing_user) {
                setExisting({ ...res.existing_user, message: res.message || '' });
                return;
            }
            toast.success(res.message || 'Contrôleur invité : il reçoit son accès par SMS.');
            resetForm();
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Invitation impossible pour le moment.'));
        } finally {
            setInviting(false);
        }
    };

    const confirmPromotion = async (): Promise<void> => {
        if (!existing) return;
        setPromoting(true);
        try {
            const res = await sendJson<InviteResponse>('/api/partner/team/invite', 'POST', {
                event_id: eventId,
                phone: existing.phone,
                can_accept_cash: inviteCash,
                confirm_promotion: true,
            });
            toast.success(res.message || 'Invitation envoyée : la personne doit l’accepter dans l’application.');
            setExisting(null);
            resetForm();
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Invitation impossible pour le moment.'));
        } finally {
            setPromoting(false);
        }
    };

    const confirmRemove = async (): Promise<void> => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await sendJson(`/api/partner/team/${eventId}?assignmentId=${encodeURIComponent(removeTarget.assignment_id)}`, 'DELETE');
            toast.success(`${removeTarget.name} est retiré de l’événement.`);
            setRemoveTarget(null);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Retrait impossible pour le moment.'));
        } finally {
            setRemoving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Chargement de l’équipe">
                <KpiCardSkeleton className="min-h-40" />
                <KpiCardSkeleton className="min-h-40" />
            </div>
        );
    }
    if (error || !data) {
        return <ErrorState title="Équipe indisponible" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    }

    const zonesConfig = zones.data;
    const gates: GateChoice[] = zonesConfig?.configured
        ? zonesConfig.zones.flatMap((z) => z.gates.map((g) => ({ id: g.id, name: g.name, label: `${g.name} — ${z.name}` })))
        : [];
    const gateSetupOf = (c: Controller): GateSetup | null => {
        if (!zonesConfig?.configured) return null;
        const row = zonesConfig.controllers.find((x) => x.user_id === c.controller_id);
        return { gates, gateId: row?.gate_id ?? null, changeAllowed: row?.gate_change_allowed === true };
    };
    const reloadTeam = async (): Promise<void> => {
        await Promise.all([reload(), zones.reload()]);
    };

    return (
        <div className="flex flex-col gap-6">
            {canManage && !eligible && (
                <StatusBanner tone="info" title="Affectation de contrôleurs indisponible">
                    Les contrôleurs ne peuvent être affectés qu’à un événement validé ou publié.
                </StatusBanner>
            )}

            {canManage && eligible && (
                <PilotageSection title="Inviter un contrôleur" description="Le contrôleur reçoit un SMS avec son accès au scanner de cet événement.">
                    <form onSubmit={(e) => void invite(e)} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5" noValidate>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <TextInput label="Prénom" hint="Facultatif" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
                            <TextInput label="Nom" hint="Facultatif" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} />
                            <TextInput
                                label="Téléphone du contrôleur"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel-national"
                                placeholder="77 123 45 67"
                                required
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    setPhoneError(undefined);
                                }}
                                error={phoneError}
                            />
                        </div>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-fg">
                            <input
                                type="checkbox"
                                checked={inviteCash}
                                onChange={(e) => setInviteCash(e.target.checked)}
                                className="h-5 w-5 cursor-pointer rounded border-border-strong accent-brand"
                            />
                            Autoriser l’encaissement en espèces
                        </label>
                        <div>
                            <Button type="submit" variant="primary" leftIcon={<UserPlus size={18} />} isLoading={inviting} disabled={!phone.trim()}>
                                Inviter le contrôleur
                            </Button>
                        </div>
                    </form>
                </PilotageSection>
            )}

            <ZonesEditor
                eventId={eventId}
                config={zones.data}
                loading={zones.loading}
                error={zones.error}
                refreshing={zones.refreshing}
                reload={zones.reload}
                onSaved={() => void reloadTeam()}
            />

            <PilotageSection
                title="Contrôleurs affectés"
                description="Chaque scan garde le point d’entrée du contrôleur ; la permission espèces vaut pour cette affectation seulement."
            >
                {data.controllers.length === 0 ? (
                    <EmptyState
                        title="Aucun contrôleur affecté"
                        description={canManage && eligible ? 'Invitez votre équipe avec le formulaire ci-dessus.' : 'Aucun contrôleur n’est affecté à cet événement.'}
                        icon={<UserPlus size={28} />}
                        className="my-0"
                    />
                ) : (
                    <ul className="flex flex-col gap-3" aria-label="Contrôleurs affectés">
                        {data.controllers.map((c) => (
                            <ControllerCard key={c.assignment_id} eventId={eventId} controller={c} canManage={canManage} gateSetup={gateSetupOf(c)} onChanged={reloadTeam} onRemove={setRemoveTarget} />
                        ))}
                    </ul>
                )}
            </PilotageSection>

            <ConfirmDialog
                isOpen={removeTarget !== null}
                onClose={() => setRemoveTarget(null)}
                onConfirm={() => void confirmRemove()}
                title="Retirer ce contrôleur de l’événement ?"
                message="Il perd l’accès au scanner pour cet événement. Ses autres affectations et l’historique de ses scans sont conservés."
                confirmLabel="Retirer de l’événement"
                variant="danger"
                isLoading={removing}
            />

            <Modal
                isOpen={existing !== null}
                onClose={() => {
                    if (!promoting) setExisting(null);
                }}
                title="Compte existant"
                subtitle="Ce numéro correspond déjà à un compte Event Village."
                icon={<UserCheck size={20} aria-hidden="true" />}
                busy={promoting}
                maxWidth="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setExisting(null)} disabled={promoting} className="flex-1 sm:flex-none">
                            Annuler
                        </Button>
                        <Button variant="primary" onClick={() => void confirmPromotion()} isLoading={promoting} className="flex-1 sm:flex-none">
                            Envoyer l’invitation
                        </Button>
                    </>
                }
            >
                {existing && (
                    <div className="flex flex-col gap-3 text-sm">
                        <dl className="rounded-2xl border border-border bg-surface-sunken px-4 py-1">
                            <div className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                                <dt className="text-fg-muted">Titulaire</dt>
                                <dd className="font-semibold text-fg">{existing.display_name}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 py-2">
                                <dt className="text-fg-muted">Téléphone</dt>
                                <dd className="font-semibold text-fg tabular-nums">{existing.phone}</dd>
                            </div>
                        </dl>
                        {existing.message && <p className="text-fg-muted">{existing.message}</p>}
                        <p className="text-fg-muted">
                            La personne garde son compte, ses billets et son historique. Elle reçoit une invitation par SMS et ne contrôle cet événement qu’après l’avoir acceptée dans l’application.
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
}
