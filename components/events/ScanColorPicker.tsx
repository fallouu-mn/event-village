'use client';

/**
 * Finition 2b (A, E-22) — couleur au contrôle d'une catégorie, en pastilles : les couleurs choisissables de la palette du
 * scanner (jetons --scan-cat-<clé>-bg ; contre-vérification 2b : plus OR, SCAN_CATEGORY_CHOOSABLE), chacune avec son nom
 * écrit (jamais la couleur seule), en groupe de boutons radio (flèches, Début, Fin ; un seul arrêt de tabulation). La
 * couleur d'une catégorie nouvelle est proposée par l'écran (proposeScanColor) et reste modifiable ; deux catégories de
 * même couleur sont signalées sans être refusées ; une couleur qui n'est plus proposée (OR) est dite, à remplacer.
 */
import React, { useRef } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { SCAN_CATEGORY_CHOOSABLE, SCAN_CATEGORY_COLOR_LABELS, isChoosableScanColor, isScanCategoryColor, type ScanCategoryColor } from '@/lib/scan/scan-result';

/** Pastille de chaque couleur (classes écrites en entier pour la génération des styles). */
export const SCAN_COLOR_SWATCH: Record<ScanCategoryColor, string> = {
    BLANC: 'bg-scan-cat-blanc-bg',
    OR: 'bg-scan-cat-or-bg',
    ARGENT: 'bg-scan-cat-argent-bg',
    ROSE: 'bg-scan-cat-rose-bg',
    TURQUOISE: 'bg-scan-cat-turquoise-bg',
    BLEU: 'bg-scan-cat-bleu-bg',
    VIOLET: 'bg-scan-cat-violet-bg',
    NOIR: 'bg-scan-cat-noir-bg',
};

/** Pastille seule, décorative (la couleur est toujours écrite à côté). */
export function ScanColorDot({ color, className }: { color: string | null | undefined; className?: string }) {
    if (!isScanCategoryColor(color)) return null;
    return <span aria-hidden="true" className={cn('inline-block h-4 w-4 flex-shrink-0 rounded-full border border-input', SCAN_COLOR_SWATCH[color], className)} />;
}

interface ScanColorPickerProps {
    /** Préfixe des identifiants (libellé, aide, erreur). */
    id: string;
    label: string;
    value: string;
    onChange: (color: ScanCategoryColor) => void;
    /** Autres catégories de l'événement (nom et couleur), pour signaler une couleur partagée. */
    others?: ReadonlyArray<{ name: string; color: string }>;
    hint?: string;
    error?: string;
    disabled?: boolean;
}

export function ScanColorPicker({ id, label, value, onChange, others = [], hint, error, disabled = false }: ScanColorPickerProps) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const selected = SCAN_CATEGORY_CHOOSABLE.findIndex((c) => c === value);
    // Contre-vérification 2b (2b) : couleur enregistrée qui n'est plus proposée (OR) : dite, à remplacer
    const retired = isScanCategoryColor(value) && !isChoosableScanColor(value) ? `${id}-retiree` : undefined;
    const labelId = `${id}-libelle`;
    const hintId = hint ? `${id}-aide` : undefined;
    const errorId = error ? `${id}-erreur` : undefined;
    const sharedWith = isScanCategoryColor(value)
        ? others.filter((o) => o.color === value).map((o) => o.name.trim() || 'une autre catégorie')
        : [];
    const warningId = sharedWith.length > 0 ? `${id}-partagee` : undefined;

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const n = SCAN_CATEGORY_CHOOSABLE.length;
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + n) % n;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = n - 1;
        if (next < 0) return;
        e.preventDefault();
        onChange(SCAN_CATEGORY_CHOOSABLE[next]);
        refs.current[next]?.focus();
    };

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span id={labelId} className="text-sm font-semibold text-foreground-strong">{label}</span>
            <div
                id={id}
                role="radiogroup"
                tabIndex={-1}
                aria-labelledby={labelId}
                aria-describedby={[errorId, retired, warningId, hintId].filter(Boolean).join(' ') || undefined}
                aria-invalid={error ? true : undefined}
                className="grid grid-cols-2 gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-4"
            >
                {SCAN_CATEGORY_CHOOSABLE.map((color, i) => {
                    const checked = color === value;
                    return (
                        <button
                            key={color}
                            ref={(el) => { refs.current[i] = el; }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabIndex={(selected === -1 ? i === 0 : i === selected) ? 0 : -1}
                            disabled={disabled}
                            onClick={() => onChange(color)}
                            onKeyDown={(e) => onKeyDown(e, i)}
                            className={cn(
                                'flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors duration-200',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                                checked ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-input bg-card text-foreground-strong hover:bg-background',
                                error && !checked && 'border-danger',
                            )}
                        >
                            <ScanColorDot color={color} className="h-5 w-5" />
                            <span className="min-w-0 truncate">{SCAN_CATEGORY_COLOR_LABELS[color]}</span>
                            {checked && <Check size={16} aria-hidden="true" className="ml-auto flex-shrink-0" />}
                        </button>
                    );
                })}
            </div>
            {retired && (
                <p id={retired} className="flex items-start gap-1.5 text-sm font-medium text-warning-text">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{`Couleur actuelle : ${SCAN_CATEGORY_COLOR_LABELS[value as ScanCategoryColor]}, qui n’est plus proposée. Choisissez-en une autre.`}</span>
                </p>
            )}
            {sharedWith.length > 0 && (
                <p id={warningId} className="flex items-start gap-1.5 text-sm font-medium text-warning-text">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{`Même couleur que ${sharedWith.map((n) => `« ${n} »`).join(', ')} : au contrôle, ces catégories auront la même bande.`}</span>
                </p>
            )}
            {hint && <p id={hintId} className="text-sm leading-snug text-muted-foreground">{hint}</p>}
            {error && <p id={errorId} className="text-sm font-medium text-danger-text">{error}</p>}
        </div>
    );
}

/**
 * Finition 2b (B) — couleur au contrôle en liste déroulante compacte (étape « Contrôle à l'entrée ») : la pastille à côté
 * du libellé, le nom de la couleur dans la liste.
 */
export function ScanColorSelect({ id, label, value, onChange, disabled = false }: {
    id: string;
    label: string;
    value: string;
    onChange: (color: ScanCategoryColor) => void;
    disabled?: boolean;
}) {
    return (
        <Select
            id={id}
            label={label}
            value={isChoosableScanColor(value) ? value : ''}
            placeholder={isChoosableScanColor(value) ? undefined : 'Choisir une couleur'}
            onChange={(e) => { if (isChoosableScanColor(e.target.value)) onChange(e.target.value); }}
            options={SCAN_CATEGORY_CHOOSABLE.map((c) => ({ value: c, label: SCAN_CATEGORY_COLOR_LABELS[c] }))}
            aside={<ScanColorDot color={value} className="h-5 w-5" />}
            disabled={disabled}
        />
    );
}
