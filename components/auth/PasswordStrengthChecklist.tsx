'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { obviousPasswordReason, PASSWORD_CRITERIA_LABELS, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules';

// Lot 9 quinquies (A7 : AUTH-11) : la liste suit la règle commune (lib/auth/password-rules.ts) : 10 caractères au moins,
// 64 au plus, pas un mot de passe évident ; plus aucune majuscule, aucun chiffre ni caractère spécial exigés. La liste des
// 10 000 mots de passe courants n'est vérifiée qu'à l'envoi, par le serveur (budget JS du navigateur).
const PASSWORD_CRITERIA = [
    { key: 'length', label: PASSWORD_CRITERIA_LABELS.length, test: (p: string) => p.length >= PASSWORD_MIN_LENGTH },
    { key: 'max',    label: PASSWORD_CRITERIA_LABELS.max,    test: (p: string) => p.length <= PASSWORD_MAX_LENGTH },
    { key: 'common', label: PASSWORD_CRITERIA_LABELS.common, test: (p: string) => p.length > 0 && obviousPasswordReason(p) === null },
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
