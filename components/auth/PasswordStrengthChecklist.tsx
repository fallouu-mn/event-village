'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';

const PASSWORD_CRITERIA = [
    { key: 'length',  label: 'Au moins 8 caractères',                    test: (p: string) => p.length >= 8 },
    { key: 'upper',   label: 'Au moins une majuscule (A-Z)',             test: (p: string) => /[A-Z]/.test(p) },
    { key: 'digit',   label: 'Au moins un chiffre (0-9)',                test: (p: string) => /[0-9]/.test(p) },
    { key: 'special', label: 'Au moins un caractère spécial (!@#$...)',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordCriteriaStatus(password: string) {
    return PASSWORD_CRITERIA.map((c) => ({ ...c, passed: c.test(password) }));
}

export function allPasswordCriteriaMet(password: string) {
    return PASSWORD_CRITERIA.every((c) => c.test(password));
}

interface PasswordStrengthChecklistProps {
    password: string;
}

export function PasswordStrengthChecklist({ password }: PasswordStrengthChecklistProps) {
    if (password.length === 0) return null;

    const criteria = getPasswordCriteriaStatus(password);

    return (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                Robustesse du mot de passe
            </p>
            {criteria.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                    <div className={clsx(
                        'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                        c.passed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-100 dark:bg-red-950/50 text-red-500 border border-red-300 dark:border-red-800'
                    )}>
                        {c.passed
                            ? <Check size={10} strokeWidth={3} />
                            : <X size={10} strokeWidth={3} />
                        }
                    </div>
                    <span className={clsx(
                        'text-[11px] font-semibold transition-colors',
                        c.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    )}>
                        {c.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
