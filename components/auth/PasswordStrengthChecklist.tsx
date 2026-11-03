'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/components/ui/cn';

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
    /** Identifiant de la liste, à relier au champ du mot de passe par aria-describedby. */
    id?: string;
}

/**
 * Critères de robustesse du mot de passe (lot 6, contrat A5) : liste lue par les lecteurs d'écran
 * (« respecté » / « manquant » en texte, la couleur ne porte jamais seule l'information), 14 px, tokens.
 */
export function PasswordStrengthChecklist({ password, id }: PasswordStrengthChecklistProps) {
    if (password.length === 0) return null;

    const criteria = getPasswordCriteriaStatus(password);

    return (
        <div id={id} className="space-y-2 rounded-2xl border border-border bg-surface-sunken p-3.5">
            <p className="text-sm font-semibold text-fg">Robustesse du mot de passe</p>
            <ul className="space-y-1.5">
                {criteria.map((c) => (
                    <li key={c.key} className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                                c.passed ? 'border-success bg-success text-on-tone' : 'border-danger-border bg-danger-bg text-danger-fg',
                            )}
                        >
                            {c.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                        </span>
                        <span className={cn('text-sm font-medium', c.passed ? 'text-success-fg' : 'text-danger-fg')}>
                            {c.label}
                            <span className="sr-only">{c.passed ? ' : respecté' : ' : manquant'}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
