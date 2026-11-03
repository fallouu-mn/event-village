'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/components/ui/cn';

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    hasError?: boolean;
    /** Identifiant d'un message (erreur, aide) relié au groupe par aria-describedby. */
    describedBy?: string;
}

const LENGTH = 6;

/**
 * Saisie d'un code à usage unique de 6 chiffres (lot 6, contrat A5) :
 *  - 6 champs numériques nommés « Chiffre N sur 6 » (groupe « Code à 6 chiffres ») ;
 *  - `autoComplete="one-time-code"` sur le premier champ (remplissage automatique du code reçu par SMS) ;
 *  - collage d'un code complet par onPaste, dans n'importe quel champ (le premier accepte aussi 6 caractères
 *    au remplissage automatique) ;
 *  - champs de 44 px de large, texte à 18 px, anneau de focus `ring`, tokens du système de design.
 * Aucune logique de vérification ici : le composant ne fait que remonter les chiffres saisis.
 */
export const OtpInput: React.FC<OtpInputProps> = ({
    value,
    onChange,
    disabled = false,
    hasError = false,
    describedBy,
}) => {
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const digits = value.split('');

    useEffect(() => {
        if (!disabled && inputsRef.current[0]) {
            inputsRef.current[0]?.focus();
        }
    }, [disabled]);

    /** Répartit un code de plusieurs chiffres (collage, remplissage automatique) à partir du premier champ. */
    const fillFrom = (raw: string) => {
        const pasted = raw.replace(/\D/g, '').slice(0, LENGTH).split('');
        if (pasted.length === 0) return;
        const newDigits: string[] = [];
        for (let i = 0; i < LENGTH; i++) newDigits[i] = pasted[i] || '';
        onChange(newDigits.join(''));
        const nextIndex = Math.min(pasted.length, LENGTH - 1);
        inputsRef.current[nextIndex]?.focus();
    };

    const handleChange = (index: number, char: string) => {
        if (disabled) return;
        let cleaned = char.replace(/\D/g, '');
        if (!cleaned) return;

        // Le premier champ accepte 6 caractères (remplissage automatique du code) : une frappe dans ce champ
        // déjà rempli donne 2 chiffres, l'ancien et le nouveau ; seul le nouveau est gardé.
        const current = digits[index] || '';
        if (cleaned.length === 2 && current && cleaned.includes(current)) {
            cleaned = cleaned.startsWith(current) ? cleaned[1] : cleaned[0];
        }

        // Remplissage automatique ou collage d'un code complet
        if (cleaned.length > 1) {
            fillFrom(cleaned);
            return;
        }

        const newDigits = [...digits];
        newDigits[index] = cleaned;
        onChange(newDigits.join(''));

        // Passer au champ suivant
        if (index < LENGTH - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        const text = e.clipboardData.getData('text');
        if (!/\d/.test(text)) return;
        e.preventDefault();
        fillFrom(text);
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        if (e.key === 'Backspace') {
            e.preventDefault();
            const newDigits = [...digits];
            if (newDigits[index]) {
                newDigits[index] = '';
                onChange(newDigits.join(''));
            } else if (index > 0) {
                newDigits[index - 1] = '';
                onChange(newDigits.join(''));
                inputsRef.current[index - 1]?.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    return (
        <div
            role="group"
            aria-label="Code à 6 chiffres"
            aria-describedby={describedBy}
            className="flex items-center justify-center gap-1.5 sm:gap-3"
        >
            {Array.from({ length: LENGTH }).map((_, i) => {
                const digit = digits[i] || '';
                return (
                    <input
                        key={i}
                        ref={(el) => { inputsRef.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        maxLength={i === 0 ? LENGTH : 1}
                        aria-label={`Chiffre ${i + 1} sur ${LENGTH}`}
                        aria-invalid={hasError || undefined}
                        value={digit}
                        disabled={disabled}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className={cn(
                            'h-12 w-11 min-w-11 rounded-xl border-2 text-center text-lg font-bold tabular-nums transition-colors duration-200 sm:h-14 sm:w-12 sm:text-2xl',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            hasError
                                ? 'border-danger bg-danger-bg text-danger-fg'
                                : digit
                                    ? 'border-brand-fg bg-brand-bg text-brand-fg'
                                    : 'border-border-strong bg-surface text-fg',
                        )}
                    />
                );
            })}
        </div>
    );
};
