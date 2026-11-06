'use client';

/**
 * Caisse du contrôleur : ouverture, clôture (Z de caisse) et récapitulatif imprimable (lot 4.5, migrés au
 * lot 7, tâche 7.2 ; décision D46). Alignés sur le serveur :
 *  - PIN du régisseur facultatif à l'ouverture (saisi, il est vérifié par le serveur) ; à la clôture, il
 *    n'est demandé que si le serveur constate un écart (refus JUSTIFICATION_REQUIRED ou PIN_REQUIRED) ;
 *  - fonds de caisse, espèces encaissées, total attendu en caisse et écart viennent du serveur : aucun
 *    calcul dans le navigateur ;
 *  - montants entiers de francs, sans pas imposé (2 750 F est accepté), formatés par lib/format.
 * Sur Modal et Field (système de design) ; chargés à la demande (next/dynamic) par le scanner.
 */
import React, { useEffect, useId, useState } from 'react';
import { Banknote, Printer, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Textarea } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDateTime, formatFcfa } from '@/lib/format';
import type { Shift, ShiftSummary } from '@/lib/shifts/shift.service';
import type { ServedShift } from '@/components/scan/ScannerShiftBanner';

/** Montant saisi : entier de francs ≥ 0 (espaces de lecture admis) ; null si illisible. */
function parseAmount(raw: string): number | null {
    const compact = raw.replace(/[\s  ]/g, '');
    if (!/^\d{1,9}$/.test(compact)) return null;
    return Number(compact);
}

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
    try {
        return (await res.json()) as Record<string, unknown>;
    } catch (err) {
        console.warn(`[caisse] ${what} : réponse HTTP ${res.status} illisible`, err instanceof Error ? err.message : String(err));
        return {};
    }
}

function errorText(body: Record<string, unknown>, fallback: string): string {
    return typeof body.error === 'string' && body.error.trim() !== '' ? body.error : fallback;
}

// ── Ouverture ─────────────────────────────────────────────────────────────

interface OpenShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle?: string;
    onShiftOpened: (shift: Shift) => void;
}

export function OpenShiftModal({ isOpen, onClose, eventId, eventTitle, onShiftOpened }: OpenShiftModalProps) {
    const floatId = useId();
    const pinId = useId();
    const [openingFloat, setOpeningFloat] = useState('');
    const [regisseurPin, setRegisseurPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [floatError, setFloatError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setOpeningFloat('');
        setRegisseurPin('');
        setError('');
        setFloatError('');
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const amount = openingFloat.trim() === '' ? 0 : parseAmount(openingFloat);
        if (amount === null) {
            setFloatError('Saisissez un montant entier en francs, sans virgule (par exemple 2 750).');
            return;
        }
        setFloatError('');
        setLoading(true);
        try {
            const pin = regisseurPin.trim();
            const res = await fetch('/api/controller/shifts/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, openingFloat: amount, ...(pin ? { regisseurPin: pin } : {}) }),
            });
            const data = await readJson(res, 'ouverture');
            if (!res.ok || data.success !== true || !data.shift) {
                setError(errorText(data, 'La caisse n’a pas pu être ouverte.'));
                return;
            }
            onShiftOpened(data.shift as Shift);
            onClose();
        } catch (err) {
            console.warn('[caisse] ouverture : réseau indisponible', err instanceof Error ? err.message : String(err));
            setError('Réseau indisponible : la caisse n’est pas ouverte. Réessayez.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            busy={loading}
            title="Ouvrir ma caisse"
            subtitle={eventTitle}
            icon={<Banknote size={20} />}
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {error && <StatusBanner tone="danger" title="Ouverture refusée" announce="alert">{error}</StatusBanner>}
                <TextInput
                    id={floatId}
                    label="Fonds de caisse remis par le régisseur (F CFA)"
                    hint="Montant en espèces remis pour rendre la monnaie. 0 si aucun fonds n’est remis."
                    inputMode="numeric"
                    autoComplete="off"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="0"
                    error={floatError || undefined}
                    className="tabular-nums"
                />
                <TextInput
                    id={pinId}
                    label="Code PIN du régisseur (facultatif)"
                    hint="Facultatif à l’ouverture. Saisi, il est vérifié et l’ouverture est marquée confirmée par le régisseur."
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={8}
                    value={regisseurPin}
                    onChange={(e) => setRegisseurPin(e.target.value)}
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Annuler</Button>
                    <Button type="submit" variant="primary" isLoading={loading}>Ouvrir la caisse</Button>
                </div>
            </form>
        </Modal>
    );
}

// ── Clôture (Z de caisse) ─────────────────────────────────────────────────

interface CloseShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    shift: ServedShift;
    onShiftClosed: (summary: ShiftSummary) => void;
}

export function CloseShiftModal({ isOpen, onClose, shift, onShiftClosed }: CloseShiftModalProps) {
    const countId = useId();
    const justificationId = useId();
    const pinId = useId();
    const [counted, setCounted] = useState('');
    const [justification, setJustification] = useState('');
    const [regisseurPin, setRegisseurPin] = useState('');
    /** Écart constaté par le serveur : justification et PIN du régisseur demandés. */
    const [cosign, setCosign] = useState<{ discrepancy: number | null } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setCounted('');
        setJustification('');
        setRegisseurPin('');
        setCosign(null);
        setError('');
        setFieldError('');
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const declared = parseAmount(counted);
        if (declared === null) {
            setFieldError('Saisissez le montant compté, en francs entiers, sans virgule.');
            return;
        }
        setFieldError('');
        setLoading(true);
        try {
            const res = await fetch('/api/controller/shifts/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftId: shift.id,
                    declaredCashTotal: declared,
                    ...(cosign ? { justification: justification.trim(), regisseurPin: regisseurPin.trim() } : {}),
                }),
            });
            const data = await readJson(res, 'clôture');
            if (res.ok && data.success === true && data.summary) {
                onShiftClosed(data.summary as ShiftSummary);
                onClose();
                return;
            }
            const code = typeof data.code === 'string' ? data.code : '';
            if (code === 'JUSTIFICATION_REQUIRED' || code === 'PIN_REQUIRED') {
                const served = Number(data.discrepancy);
                setCosign({ discrepancy: Number.isFinite(served) ? served : null });
                setError(cosign ? errorText(data, 'Justification ou code PIN manquant.') : '');
                return;
            }
            setError(errorText(data, 'La caisse n’a pas pu être clôturée.'));
        } catch (err) {
            console.warn('[caisse] clôture : réseau indisponible', err instanceof Error ? err.message : String(err));
            setError('Réseau indisponible : la caisse n’est pas clôturée. Réessayez.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            busy={loading}
            title="Clôturer ma caisse"
            subtitle="Décompte des espèces avec le régisseur"
            icon={<Receipt size={20} />}
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <dl className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-sunken p-4 text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="text-fg-muted">Fonds de caisse</dt>
                        <dd className="font-semibold text-fg tabular-nums">{formatFcfa(Number(shift.opening_float_amount))}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-fg-muted">Espèces encaissées (enregistrées)</dt>
                        <dd className="font-semibold text-fg tabular-nums">{formatFcfa(Number(shift.expected_cash_total))}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-border pt-1.5">
                        <dt className="font-semibold text-fg">Total attendu en caisse</dt>
                        <dd className="font-bold text-fg tabular-nums">{formatFcfa(shift.expected_cash_in_drawer ?? null)}</dd>
                    </div>
                </dl>

                {error && <StatusBanner tone="danger" title="Clôture refusée" announce="alert">{error}</StatusBanner>}

                <TextInput
                    id={countId}
                    label="Espèces encaissées comptées, hors fonds de caisse (F CFA)"
                    hint="Comptez les espèces avec le régisseur, mettez de côté le fonds de caisse, puis saisissez le reste."
                    inputMode="numeric"
                    autoComplete="off"
                    value={counted}
                    onChange={(e) => { setCounted(e.target.value); setCosign(null); }}
                    error={fieldError || undefined}
                    required
                    className="tabular-nums"
                />

                {cosign && (
                    <>
                        <StatusBanner tone="warning" title="Écart constaté par le serveur" announce="alert" className="tabular-nums">
                            {cosign.discrepancy !== null
                                ? `Écart de ${formatFcfa(cosign.discrepancy)} avec les encaissements enregistrés. `
                                : 'Le montant compté ne correspond pas aux encaissements enregistrés. '}
                            Justifiez l’écart ; le régisseur co-signe la clôture avec son code PIN.
                        </StatusBanner>
                        <Textarea
                            id={justificationId}
                            label="Justification de l’écart"
                            hint="10 caractères au moins (par exemple : monnaie rendue en trop à un spectateur)."
                            rows={3}
                            maxLength={1000}
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            required
                        />
                        <Field label="Code PIN du régisseur" hint="Le régisseur saisit lui-même son code." required id={pinId}>
                            {(control) => (
                                <input
                                    id={control.id}
                                    aria-describedby={control['aria-describedby']}
                                    aria-invalid={control['aria-invalid']}
                                    aria-required={control['aria-required']}
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={8}
                                    value={regisseurPin}
                                    onChange={(e) => setRegisseurPin(e.target.value)}
                                    className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-center text-base tracking-widest text-fg focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            )}
                        </Field>
                    </>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Annuler</Button>
                    <Button type="submit" variant="primary" isLoading={loading}>
                        {cosign ? 'Clôturer avec l’écart' : 'Clôturer la caisse'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ── Z de caisse (récapitulatif imprimable) ────────────────────────────────

interface ZSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: ShiftSummary | null;
}

export function ZSummaryModal({ isOpen, onClose, summary }: ZSummaryModalProps) {
    if (!summary) return null;
    const discrepancy = summary.discrepancy_amount;
    const rows: Array<[string, string]> = [
        ['Événement', summary.event_title],
        ['Contrôleur', summary.controller_name],
        ['Ouverture', formatDateTime(summary.opened_at)],
        ['Clôture', summary.closed_at ? formatDateTime(summary.closed_at) : 'En cours'],
        ['Fonds de caisse', formatFcfa(summary.opening_float_amount)],
        ['Encaissements enregistrés', formatFcfa(summary.expected_cash_total)],
        ['Encaissements comptés', formatFcfa(summary.declared_cash_total)],
        ['Écart', discrepancy === null ? 'Aucun' : discrepancy === 0 ? 'Aucun écart' : formatFcfa(discrepancy)],
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Caisse clôturée"
            subtitle="Z de caisse"
            icon={<Receipt size={20} />}
            maxWidth="md"
            footer={(
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end print:hidden">
                    <Button variant="secondary" onClick={() => window.print()} leftIcon={<Printer size={18} />}>Imprimer le Z</Button>
                    <Button variant="primary" onClick={onClose}>Terminé</Button>
                </div>
            )}
        >
            <dl className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-sunken p-4 text-sm">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                        <dt className="text-fg-muted">{label}</dt>
                        <dd className="text-right font-semibold text-fg tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>
            {summary.discrepancy_justification && (
                <p className="mt-3 text-sm text-fg">
                    <span className="font-semibold">Justification : </span>{summary.discrepancy_justification}
                </p>
            )}
            <p className="mt-3 text-sm text-fg-muted">
                {summary.closing_confirmed_by_pin ? 'Clôture co-signée par le code PIN du régisseur.' : 'Clôture sans co-signature (aucun écart).'}
            </p>
        </Modal>
    );
}
