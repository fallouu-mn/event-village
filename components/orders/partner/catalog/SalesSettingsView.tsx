'use client';

/**
 * Lot 12c — réglages de vente de chaque établissement : ouvert à la commande, modes de remise (livraison, retrait, sur
 * place avec la liste des tables), acompte en pourcentage (10 à 90), paiement à la remise, temps de préparation ; puis
 * zones de livraison. PATCH /api/partner/venues/[id]/orders (order_venue_settings_set en base) ; refus affichés tels
 * quels. Fiche suspendue : lecture seule.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Save, ShoppingBag, Store, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { formatInteger } from '@/lib/format';
import { ORDER_MODE_LABELS } from '@/lib/orders/partner-ui';
import type { CatalogResponse, CatalogVenue } from './catalog-client';
import { DeliveryZonesEditor } from './DeliveryZonesEditor';
import { VenuePicker } from './VenuePicker';

interface Settings {
    ordersOpen: boolean;
    modes: string[];
    depositAllowed: boolean;
    depositPercent: string;
    payOnHandover: boolean;
    prepMinutes: string;
}

const MODE_HELP: Record<string, { help: string; icon: React.ReactNode }> = {
    LIVRAISON: { help: 'Vous livrez dans les quartiers de la liste ci-dessous, vous-même ou par vos livreurs.', icon: <Bike size={20} aria-hidden="true" /> },
    RETRAIT: { help: 'Le client vient chercher sa commande et donne son code au comptoir.', icon: <ShoppingBag size={20} aria-hidden="true" /> },
    SUR_PLACE: { help: 'Le client commande depuis sa table ou l’endroit où il est.', icon: <UtensilsCrossed size={20} aria-hidden="true" /> },
};

function fromVenue(v: CatalogVenue): Settings {
    return {
        ordersOpen: v.ordersOpen, modes: [...v.modes], depositAllowed: v.depositAllowed,
        depositPercent: v.depositPercent === null ? '' : String(v.depositPercent), payOnHandover: v.payOnHandover,
        prepMinutes: v.prepMinutes === null ? '' : String(v.prepMinutes),
    };
}

export function SalesSettingsView({ initialVenue }: { initialVenue: string | null }) {
    const { data, error, loading, reload } = useServerData<CatalogResponse>('/api/partner/catalog');
    const toast = useToast();
    const [venuePick, setVenuePick] = useState<string | null>(initialVenue);
    const [form, setForm] = useState<Settings | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<'modes' | 'deposit' | 'prep', string>>>({});
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const venues = useMemo(() => data?.venues ?? [], [data]);
    const venue = venues.find((v) => v.id === venuePick) ?? venues[0] ?? null;
    const readOnly = data?.partnerStatus === 'SUSPENDU';

    // Le formulaire ne se recharge qu'au changement d'établissement ou de réglages servis (pas à chaque zone modifiée)
    const served = venue ? JSON.stringify([venue.id, fromVenue(venue)]) : '';
    useEffect(() => {
        setForm(served ? (JSON.parse(served) as [string, Settings])[1] : null);
        setFieldErrors({});
        setSaveError(null);
    }, [served]);

    const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
    const toggleMode = (mode: string, on: boolean) => setForm((f) => (f ? { ...f, modes: on ? [...new Set([...f.modes, mode])] : f.modes.filter((m) => m !== mode) } : f));

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!venue || !form) return;
        const errs: typeof fieldErrors = {};
        if (form.modes.length === 0) errs.modes = 'Choisissez au moins un mode : livraison, retrait ou sur place.';
        if (form.depositAllowed && form.depositPercent && !(/^\d{2}$/.test(form.depositPercent) && Number(form.depositPercent) >= 10 && Number(form.depositPercent) <= 90)) {
            errs.deposit = 'L’acompte est compris entre 10 et 90 %.';
        }
        if (form.prepMinutes && !(/^\d{2,3}$/.test(form.prepMinutes) && Number(form.prepMinutes) >= 10 && Number(form.prepMinutes) <= 240)) {
            errs.prep = 'La préparation dure de 10 à 240 minutes.';
        }
        setFieldErrors(errs);
        setSaveError(null);
        if (Object.keys(errs).length > 0) return;
        setSaving(true);
        try {
            await sendJson(`/api/partner/venues/${venue.id}/orders`, 'PATCH', {
                ordersOpen: form.ordersOpen,
                modes: form.modes,
                depositAllowed: form.depositAllowed,
                depositPercent: form.depositAllowed && form.depositPercent ? Number(form.depositPercent) : null,
                payOnHandover: form.payOnHandover,
                prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : null,
            });
            toast.success(`Réglages de vente de ${venue.name} enregistrés.`);
            await reload();
        } catch (err) {
            setSaveError(errorMessage(err, 'Réglages non enregistrés. Réessayez.'));
        } finally {
            setSaving(false);
        }
    }

    const header = (
        <PageHeader
            back={{ href: venue ? `/partner/products?etablissement=${venue.id}` : '/partner/products', label: 'Ma carte' }}
            title="Réglages de vente"
            description="Comment vos clients commandent dans chaque établissement : modes de remise, acompte, préparation et zones de livraison."
        />
    );

    if (loading && !data) {
        return (
            <div className="mx-auto w-full max-w-4xl" role="status" aria-busy="true">
                {header}
                <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>
                <span className="sr-only">Chargement des réglages…</span>
            </div>
        );
    }
    if (error && !data) {
        return <div className="mx-auto w-full max-w-4xl">{header}<ErrorState title="Réglages indisponibles" description={error} onRetry={() => void reload()} /></div>;
    }
    if (!data) return null;
    if (!venue || !form) {
        return (
            <div className="mx-auto w-full max-w-4xl">
                {header}
                <EmptyState icon={<Store size={28} aria-hidden="true" />} title="Aucun établissement" description="Créez d’abord un établissement : ses réglages de vente apparaîtront ici."
                    actionLabel={readOnly ? undefined : 'Mes établissements'} actionHref={readOnly ? undefined : '/partner/tables'} />
            </div>
        );
    }

    const delivery = form.modes.includes('LIVRAISON');
    const onsite = form.modes.includes('SUR_PLACE');

    return (
        <div className="mx-auto w-full max-w-4xl pb-6">
            {header}
            <VenuePicker venues={venues.map((v) => ({ id: v.id, name: v.name }))} value={venue.id} onChange={setVenuePick} />

            <div className="mt-4 space-y-4">
                {readOnly && (
                    <StatusBanner tone="suspended" title="Votre fiche est suspendue">
                        Les réglages restent visibles, mais ils ne se modifient plus. Contactez le support pour en savoir plus.
                    </StatusBanner>
                )}
                {!venue.validated && (
                    <StatusBanner tone="info" title="Établissement en attente de validation">
                        {venue.name} ne prend pas de commande tant qu’Event Village ne l’a pas validé. Vous pouvez préparer ses réglages dès maintenant.
                    </StatusBanner>
                )}

                <form onSubmit={(e) => void save(e)} noValidate>
                    <fieldset disabled={readOnly || saving} className="min-w-0 space-y-4">
                        <Card className="p-4 sm:p-5">
                            <Switch
                                label={<span className="text-base">Ouvert à la commande</span>}
                                description={form.ordersOpen ? 'Vos clients peuvent commander dans cet établissement.' : 'Vos clients voient la carte, sans pouvoir commander.'}
                                checked={form.ordersOpen}
                                onChange={(v) => set('ordersOpen', v)}
                                disabled={readOnly}
                            />
                        </Card>

                        <Card className="space-y-3 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Modes de remise</h2>
                            {(['LIVRAISON', 'RETRAIT', 'SUR_PLACE'] as const).map((m) => (
                                <div key={m} className="flex items-start gap-3 rounded-xl border border-border p-3">
                                    <span className="mt-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text">{MODE_HELP[m].icon}</span>
                                    <Switch className="min-w-0 flex-1" label={ORDER_MODE_LABELS[m]} description={MODE_HELP[m].help}
                                        checked={form.modes.includes(m)} onChange={(on) => toggleMode(m, on)} disabled={readOnly} />
                                </div>
                            ))}
                            {fieldErrors.modes && <p role="alert" className="text-sm font-medium text-danger-text">{fieldErrors.modes}</p>}
                            {onsite && (
                                <div className="rounded-xl bg-background p-3">
                                    <p className="text-sm font-semibold text-foreground-strong">Tables et emplacements proposés</p>
                                    {venue.tables.length === 0 ? (
                                        <p className="mt-1 text-sm text-muted-foreground">Aucune table enregistrée : le client indique lui-même l’endroit où il est.</p>
                                    ) : (
                                        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Tables proposées">
                                            {venue.tables.map((t) => (
                                                <li key={t.id} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground-strong">
                                                    Table {t.number} <span className="text-muted-foreground tabular-nums">· {formatInteger(t.capacity)} places</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <LinkButton href={`/partner/tables/${venue.id}`} variant="ghost" size="sm" className="-ml-3 mt-1">Gérer les tables</LinkButton>
                                </div>
                            )}
                        </Card>

                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Paiement</h2>
                            <Switch label="Accepter un acompte" description="Le client paie une part en ligne, le reste à la remise. Le plat du jour se paie toujours en entier."
                                checked={form.depositAllowed} onChange={(v) => set('depositAllowed', v)} disabled={readOnly} />
                            {form.depositAllowed && (
                                <TextInput label="Acompte (%)" inputMode="numeric" value={form.depositPercent} fieldClassName="sm:max-w-xs"
                                    onChange={(e) => set('depositPercent', e.target.value.replace(/\D/g, '').slice(0, 2))}
                                    placeholder={String(data.defaults.depositPercent)} error={fieldErrors.deposit}
                                    hint={`De 10 à 90 %. Vide : ${formatInteger(data.defaults.depositPercent)} %, le réglage d’Event Village.`} />
                            )}
                            <Switch label="Paiement à la remise" description="Le client peut tout payer en espèces quand il reçoit sa commande. Vous confirmez « reste reçu » au moment de la remise."
                                checked={form.payOnHandover} onChange={(v) => set('payOnHandover', v)} disabled={readOnly} />
                        </Card>

                        <Card className="space-y-4 p-4 sm:p-5">
                            <h2 className="text-lg font-semibold text-foreground-strong">Préparation</h2>
                            <TextInput label="Temps de préparation (minutes)" inputMode="numeric" value={form.prepMinutes} fieldClassName="sm:max-w-xs"
                                onChange={(e) => set('prepMinutes', e.target.value.replace(/\D/g, '').slice(0, 3))}
                                placeholder={String(data.defaults.prepMinutes)} error={fieldErrors.prep}
                                hint={`De 10 à 240 minutes. Vide : ${formatInteger(data.defaults.prepMinutes)} minutes. Vous pouvez l’ajuster à chaque commande en l’acceptant.`} />
                        </Card>
                    </fieldset>

                    {saveError && <StatusBanner tone="danger" title="Réglages non enregistrés" announce="alert" className="mt-4">{saveError}</StatusBanner>}
                    {!readOnly && (
                        <div className="mt-4 flex justify-end">
                            <Button type="submit" variant="primary" isLoading={saving} leftIcon={<Save size={18} aria-hidden="true" />}>Enregistrer les réglages</Button>
                        </div>
                    )}
                </form>

                <Card className="space-y-4 p-4 sm:p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground-strong">Zones de livraison</h2>
                        <p className="text-sm text-muted-foreground">
                            {delivery ? 'Les quartiers où vous livrez, dans l’ordre où vos clients les voient.' : 'La livraison est désactivée : vos zones sont gardées pour plus tard.'}
                        </p>
                    </div>
                    <DeliveryZonesEditor key={venue.id} venueId={venue.id} zones={venue.zones} readOnly={readOnly} onChanged={reload} />
                </Card>
            </div>
        </div>
    );
}
