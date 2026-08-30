'use client';

import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    hasError?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
    value,
    onChange,
    disabled = false,
    hasError = false,
}) => {
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const length = 6;
    const digits = value.split('');

    useEffect(() => {
        if (!disabled && inputsRef.current[0]) {
            inputsRef.current[0]?.focus();
        }
    }, [disabled]);

    const handleChange = (index: number, char: string) => {
        if (disabled) return;
        const cleaned = char.replace(/\D/g, '');
        if (!cleaned) return;

        const newDigits = [...digits];
        // Support du copier/coller d'un code complet
        if (cleaned.length > 1) {
            const pasted = cleaned.slice(0, length).split('');
            for (let i = 0; i < length; i++) {
                newDigits[i] = pasted[i] || '';
            }
            onChange(newDigits.join(''));
            const nextIndex = Math.min(pasted.length, length - 1);
            inputsRef.current[nextIndex]?.focus();
            return;
        }

        newDigits[index] = cleaned[cleaned.length - 1];
        const nextValue = newDigits.join('');
        onChange(nextValue);

        // Passer au champ suivant
        if (index < length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
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
        } else if (e.key === 'ArrowRight' && index < length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    return (
        <div className="flex items-center justify-center gap-2 sm:gap-3">
            {Array.from({ length }).map((_, i) => {
                const digit = digits[i] || '';
                return (
                    <input
                        key={i}
                        ref={(el) => { inputsRef.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        disabled={disabled}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className={`w-11 h-13 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-black rounded-2xl border-2 transition-all outline-none ${
                            hasError
                                ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600'
                                : digit
                                ? 'border-[#FF5722] bg-orange-50/50 dark:bg-orange-950/20 text-[#FF5722] shadow-xs'
                                : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white focus:border-[#FF5722]'
                        } disabled:opacity-50`}
                    />
                );
            })}
        </div>
    );
};
