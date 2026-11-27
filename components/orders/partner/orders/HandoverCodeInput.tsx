'use client';

/**
 * Lot 12c — saisie du code de remise (4 chiffres donnés par le client) en quatre grandes cases, lisibles et touchables
 * au comptoir : champs numériques nommés « Chiffre N sur 4 » dans le groupe « Code de remise », passage automatique à la
 * case suivante, retour arrière vers la précédente, collage d'un code complet dans n'importe quelle case. Aucune
 * vérification ici : le code est vérifié par la base (5 essais au plus).
 */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';

const LENGTH = 4;

export function HandoverCodeInput({
    value,
    onChange,
    disabled = false,
    hasError = false,
    describedBy,
    autoFocus = false,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    hasError?: boolean;
    describedBy?: string;
    autoFocus?: boolean;
}) {
    const refs = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (autoFocus && !disabled) refs.current[0]?.focus();
    }, [autoFocus, disabled]);

    const setAt = (i: number, digit: string) => {
        const chars = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');
        chars[i] = digit || ' ';
        onChange(chars.join('').replace(/\s+$/, '').replace(/ /g, ''));
    };

    const fill = (text: string) => {
        const digits = text.replace(/\D/g, '').slice(0, LENGTH);
        if (!digits) return false;
        onChange(digits);
        refs.current[Math.min(digits.length, LENGTH - 1)]?.focus();
        return true;
    };

    return (
        <div role="group" aria-label="Code de remise à 4 chiffres" aria-describedby={describedBy} className="flex justify-center gap-3 sm:gap-4">
            {Array.from({ length: LENGTH }, (_, i) => (
                <input
                    key={i}
                    ref={(el) => {
                        refs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={i === 0 ? LENGTH : 1}
                    aria-label={`Chiffre ${i + 1} sur ${LENGTH}`}
                    aria-invalid={hasError || undefined}
                    disabled={disabled}
                    value={value[i] ?? ''}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw.length > 1) {
                            fill(raw);
                            return;
                        }
                        setAt(i, raw);
                        if (raw && i < LENGTH - 1) refs.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !value[i] && i > 0) {
                            e.preventDefault();
                            setAt(i - 1, '');
                            refs.current[i - 1]?.focus();
                        } else if (e.key === 'ArrowLeft' && i > 0) {
                            refs.current[i - 1]?.focus();
                        } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
                            refs.current[i + 1]?.focus();
                        }
                    }}
                    onPaste={(e) => {
                        if (fill(e.clipboardData.getData('text'))) e.preventDefault();
                    }}
                    onFocus={(e) => e.target.select()}
                    className={cn(
                        'h-20 w-16 rounded-2xl border-2 bg-card text-center text-4xl font-extrabold tabular-nums text-foreground-strong sm:h-24 sm:w-20',
                        'transition-colors duration-fast ease-standard focus:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                        hasError ? 'border-danger' : 'border-input focus:border-primary',
                        disabled && 'opacity-60',
                    )}
                />
            ))}
        </div>
    );
}
