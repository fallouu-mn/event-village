'use client';

/**
 * Finition 1 (E-14, E-17, E-18) — fenêtres de l'équipe, les mêmes sur /partner/team et dans l'onglet Équipe du
 * pilotage : « Inviter un contrôleur », « Ce numéro a déjà un compte », « Modifier » (un seul « Enregistrer » pour la
 * porte ou le point d'entrée, « Peut changer de porte » et les espèces), confirmations. Un admin qui agit sur l'équipe
 * d'un organisateur donne un motif, inscrit au journal.
 */
import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, TextInput, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { assignmentSummary, eventWhen, firstNameOf, memberName, normalizeTyped, PHONE_ERROR } from './team-format';
import { GateAdmits } from './CategoryPills';
import type { TeamAssignment, TeamEvent, TeamMember } from './team-types';

const SN_MOBILE_RE = /^7[0-8]\d{7}$/;

/** Motif d'un admin (5 caractères au moins), inscrit au journal. */
export function ReasonField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
    return (
        <Textarea
            id={id}
            label="Motif"
            hint="Obligatoire pour un administrateur : il est inscrit au journal."
            value={value}
            maxLength={500}
            rows={2}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function reasonOk(actsAsAdmin: boolean, reason: string): boolean {
    return !actsAsAdmin || reason.trim().length >= 5;
}

interface InviteReply {
    message?: string;
    requires_confirmation?: boolean;
    existing_user?: { display_name: string; phone: string };
}

/** « Inviter un contrôleur » : la même fenêtre aux deux endroits (dans l'onglet, l'événement courant coché d'office). */
export function InviteDialog({ isOpen, onClose, events, defaultEventIds, actsAsAdmin, onDone, initialPhone }: {
    isOpen: boolean;
    onClose: () => void;
    events: TeamEvent[];
    defaultEventIds: string[];
    actsAsAdmin: boolean;
    onDone: () => Promise<void>;
    initialPhone?: string;
}) {
    const toast = useToast();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
    const [selectedIds, setSelectedIds] = useState<string[]>(defaultEventIds);
    const [cash, setCash] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [existing, setExisting] = useState<{ display_name: string; phone: string; message: string } | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setFirstName('');
        setLastName('');
        setPhone(initialPhone ? normalizeTyped(initialPhone) : '');
        setPhoneError(undefined);
        setSelectedIds(defaultEventIds);
        setCash(false);
        setReason('');
        setExisting(null);
        // Réinitialisation à chaque ouverture seulement
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const assignable = events.filter((e) => e.assignable);
    const toggle = (id: string): void => setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

    const send = async (confirm: boolean): Promise<void> => {
        const digits = normalizeTyped(confirm && existing ? existing.phone : phone);
        if (!SN_MOBILE_RE.test(digits)) {
            setPhoneError(PHONE_ERROR);
            return;
        }
        setPhoneError(undefined);
        setBusy(true);
        try {
            const reply = await sendJson<InviteReply>('/api/partner/team/invite', 'POST', {
                event_ids: selectedIds,
                phone: digits,
                first_name: firstName.trim() || undefined,
                last_name: lastName.trim() || undefined,
                can_accept_cash: cash,
                ...(confirm ? { confirm_promotion: true } : {}),
                ...(actsAsAdmin ? { reason: reason.trim() } : {}),
            });
            if (reply.requires_confirmation && reply.existing_user) {
                setExisting({ ...reply.existing_user, message: reply.message ?? '' });
                return;
            }
            toast.success(reply.message ?? 'Invitation envoyée.');
            setExisting(null);
            onClose();
            await onDone();
        } catch (err) {
            toast.error(errorMessage(err, 'Invitation impossible pour le moment. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    const canSend = selectedIds.length > 0 && phone.trim() !== '' && reasonOk(actsAsAdmin, reason);
    return (
        <>
            <Modal
                isOpen={isOpen && existing === null}
                onClose={() => { if (!busy) onClose(); }}
                title="Inviter un contrôleur"
                subtitle="Il reçoit un SMS pour activer son accès au scanner."
                icon={<UserPlus size={20} aria-hidden="true" />}
                busy={busy}
                maxWidth="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none">Fermer</Button>
                        <Button variant="primary" onClick={() => void send(false)} isLoading={busy} disabled={!canSend} className="flex-1 sm:flex-none">
                            {selectedIds.length > 1 ? `Inviter sur ${selectedIds.length} événements` : 'Inviter'}
                        </Button>
                    </>
                }
            >
                <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (canSend) void send(false); }} noValidate>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <TextInput id="invite-prenom" label="Prénom" autoComplete="off" value={firstName} maxLength={60} onChange={(e) => setFirstName(e.target.value)} />
                        <TextInput id="invite-nom" label="Nom" hint="Facultatif" autoComplete="off" value={lastName} maxLength={60} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <TextInput
                        id="invite-telephone"
                        label="Numéro de téléphone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="77 123 45 67"
                        value={phone}
                        error={phoneError}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-sm font-semibold text-fg">Événements</legend>
                        {assignable.length === 0 ? (
                            <p className="text-sm text-fg-muted">Aucun événement validé ou publié : l’invitation sera possible après la validation.</p>
                        ) : assignable.map((e) => (
                            <label key={e.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 text-sm text-fg hover:bg-surface-sunken">
                                <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} className="h-5 w-5 cursor-pointer rounded border-border-strong accent-brand" />
                                <span className="min-w-0 flex-1 break-words">{e.title}</span>
                                <span className="text-sm tabular-nums text-fg-muted">{eventWhen(e.start_at)}</span>
                            </label>
                        ))}
                    </fieldset>
                    <Switch label="Encaisser les espèces" description="Vend des billets au guichet de ces événements." checked={cash} onChange={setCash} />
                    {actsAsAdmin && <ReasonField id="invite-motif" value={reason} onChange={setReason} />}
                </form>
            </Modal>
            <Modal
                isOpen={isOpen && existing !== null}
                onClose={() => { if (!busy) setExisting(null); }}
                title="Ce numéro a déjà un compte"
                subtitle={existing ? `Titulaire : ${existing.display_name}` : undefined}
                busy={busy}
                maxWidth="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setExisting(null)} disabled={busy} className="flex-1 sm:flex-none">Revenir</Button>
                        <Button variant="primary" onClick={() => void send(true)} isLoading={busy} className="flex-1 sm:flex-none">Envoyer l’invitation</Button>
                    </>
                }
            >
                {existing && <p className="text-sm text-fg">{existing.message}</p>}
            </Modal>
        </>
    );
}

/** « Modifier » : porte (ou point d'entrée), « Peut changer de porte », espèces ; un seul « Enregistrer ». */
export function SettingsDialog({ target, event, actsAsAdmin, onClose, onDone }: {
    target: { member: TeamMember; slot: TeamAssignment } | null;
    event: TeamEvent | undefined;
    actsAsAdmin: boolean;
    onClose: () => void;
    onDone: () => Promise<void>;
}) {
    const toast = useToast();
    const [gateId, setGateId] = useState('');
    const [changeAllowed, setChangeAllowed] = useState(false);
    const [entryPoint, setEntryPoint] = useState('');
    const [cash, setCash] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmCashOff, setConfirmCashOff] = useState(false);

    useEffect(() => {
        if (!target) return;
        setGateId(target.slot.gate?.id ?? '');
        setChangeAllowed(target.slot.gate_change_allowed);
        setEntryPoint(target.slot.entry_point ?? '');
        setCash(target.slot.can_accept_cash);
        setReason('');
        setConfirmCashOff(false);
    }, [target]);

    if (!target) return null;
    const { member, slot } = target;
    const zoned = slot.has_zones;
    const name = memberName(member);

    const save = async (): Promise<void> => {
        setBusy(true);
        try {
            await sendJson('/api/partner/team/settings', 'PATCH', {
                eventId: slot.event_id,
                controllerId: member.user_id,
                canAcceptCash: cash,
                ...(zoned ? { gateId: gateId || null, gateChangeAllowed: changeAllowed } : { entryPoint: entryPoint.trim() || null }),
                ...(actsAsAdmin ? { reason: reason.trim() } : {}),
            });
            toast.success(`Réglages de ${name} enregistrés. Ils s’appliquent à son prochain retour dans le scanner.`);
            setConfirmCashOff(false);
            onClose();
            await onDone();
        } catch (err) {
            toast.error(errorMessage(err, 'Enregistrement impossible pour le moment. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };
    const submit = (): void => {
        if (slot.can_accept_cash && !cash && slot.open_shift) {
            setConfirmCashOff(true);
            return;
        }
        void save();
    };

    return (
        <>
            <Modal
                isOpen={!confirmCashOff}
                onClose={() => { if (!busy) onClose(); }}
                title={`${name} · ${slot.title}`}
                subtitle={assignmentSummary(slot)}
                busy={busy}
                maxWidth="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none">Fermer</Button>
                        <Button variant="primary" onClick={submit} isLoading={busy} disabled={!reasonOk(actsAsAdmin, reason)} className="flex-1 sm:flex-none">Enregistrer</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    {zoned ? (
                        <>
                            <Select
                                id="reglage-porte"
                                label="Porte"
                                value={gateId}
                                onChange={(e) => setGateId(e.target.value)}
                                options={[{ value: '', label: 'Aucune porte' }, ...(event?.gates ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.zone_name}` }))]}
                            />
                            <GateAdmits categories={gateId ? (event?.gates.find((g) => g.id === gateId)?.categories ?? []) : null} hasZones />
                            <Switch label="Peut changer de porte" description="Choisit lui-même sa porte dans le scanner." checked={changeAllowed} onChange={setChangeAllowed} />
                        </>
                    ) : (
                        <TextInput id="reglage-point" label="Point d’entrée" placeholder="Porte Nord, Entrée VIP…" maxLength={80} value={entryPoint} onChange={(e) => setEntryPoint(e.target.value)} />
                    )}
                    <Switch label="Encaisser les espèces" description="Vend des billets au guichet de cet événement." checked={cash} onChange={setCash} />
                    {actsAsAdmin && <ReasonField id="reglage-motif" value={reason} onChange={setReason} />}
                </div>
            </Modal>
            <ConfirmDialog
                isOpen={confirmCashOff}
                onClose={() => { if (!busy) setConfirmCashOff(false); }}
                onConfirm={() => void save()}
                title="Retirer le droit d’encaisser ?"
                message={`${firstNameOf(member)} ne pourra plus vendre au guichet. Sa caisse reste ouverte : elle doit être clôturée avec le régisseur. Aucun message ne part : prévenez-le vous-même.`}
                confirmLabel="Retirer le droit"
                cancelLabel="Revenir"
                variant="warning"
                isLoading={busy}
            />
        </>
    );
}

/** Confirmation d'une action de l'équipe, avec le motif d'un admin. */
export function ActionDialog({ isOpen, onClose, onConfirm, title, lines, confirmLabel, variant, busy, actsAsAdmin, reason, onReason }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    lines: string[];
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'default';
    busy: boolean;
    actsAsAdmin: boolean;
    reason: string;
    onReason: (v: string) => void;
}) {
    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={() => { if (reasonOk(actsAsAdmin, reason)) onConfirm(); }}
            title={title}
            confirmLabel={confirmLabel}
            cancelLabel="Revenir"
            variant={variant}
            isLoading={busy}
        >
            <div className="flex flex-col gap-3 text-sm text-fg">
                {lines.map((l) => <p key={l}>{l}</p>)}
                {actsAsAdmin && <ReasonField id="action-motif" value={reason} onChange={onReason} />}
            </div>
        </ConfirmDialog>
    );
}
