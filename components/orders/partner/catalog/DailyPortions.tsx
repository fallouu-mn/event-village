'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatInteger } from '@/lib/format';
import { portionsGauge, portionsLeft } from './catalog-client';

/**
 * Lot 12c — portions du plat du jour pour aujourd'hui (POST /api/partner/products/[id]/portions : order_daily_portions_set
 * en base, jamais sous ce qui est déjà vendu). Portions et ventes affichées telles que la base les sert.
 */
export function DailyPortions({ productId, portions, readOnly, onChanged }: {
    productId: string;
    portions: { portions: number; sold: number } | null;
    readOnly: boolean;
    onChanged: () => Promise<void>;
}) {
    const toast = useToast();
    const [value, setValue] = useState(portions ? String(portions.portions) : '');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const left = portionsLeft(portions);
    const gauge = portionsGauge(portions);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!/^\d{1,5}$/.test(value.trim())) {
            setError('Indiquez un nombre entier de portions, de 0 à 10 000.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await sendJson(`/api/partner/products/${productId}/portions`, 'POST', { portions: Number(value.trim()) });
            toast.success('Portions du jour enregistrées.');
            await onChanged();
        } catch (err) {
            setError(errorMessage(err, 'Portions non enregistrées. Réessayez.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3">
            {portions ? (
                <div>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-foreground-strong">
                            {left === 0 ? 'Plus de portions aujourd’hui' : <span className="tabular-nums">Il reste {formatInteger(left)} portions</span>}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{formatInteger(portions.sold)} vendues sur {formatInteger(portions.portions)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${formatInteger(portions.sold)} portions vendues sur ${formatInteger(portions.portions)}`}>
                        <div className={cn('h-full w-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-slow', left !== null && left <= 5 ? 'bg-warning' : 'bg-primary')}
                            style={{ transform: `scaleX(${gauge / 100})` }} />
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Aucune portion pour aujourd’hui : le plat ne se commande pas tant que vous n’en indiquez pas.</p>
            )}
            {!readOnly && (
                <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-3">
                    <TextInput
                        label="Portions pour aujourd’hui"
                        inputMode="numeric"
                        fieldClassName="w-48"
                        value={value}
                        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
                        error={error ?? undefined}
                        hint="Jamais moins que ce qui est déjà vendu. Le plat s’arrête seul à minuit."
                    />
                    <Button type="submit" variant="secondary" isLoading={busy}>Enregistrer</Button>
                </form>
            )}
        </div>
    );
}
