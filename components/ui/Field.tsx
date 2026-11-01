'use client';

import React, { useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from './cn';

/** Attributs posés par Field sur son contrôle : identifiant, description liée, état invalide. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldProps {
  label: React.ReactNode;
  /** Aide sous le champ (format attendu, contrainte). */
  hint?: React.ReactNode;
  /** Message d'erreur, affiché près du champ et annoncé (aria-describedby). */
  error?: React.ReactNode;
  required?: boolean;
  /** Identifiant imposé du contrôle (sinon généré). */
  id?: string;
  className?: string;
  /** Libellé masqué visuellement (reste lu par les lecteurs d'écran). */
  hideLabel?: boolean;
  /** Information à droite du libellé (compteur de caractères…). */
  aside?: React.ReactNode;
  children: (control: FieldControlProps) => React.ReactNode;
}

/**
 * Champ de formulaire (contrat Q) : libellé lié (htmlFor/id), aide et erreur reliées par
 * aria-describedby, aria-invalid quand une erreur est affichée, astérisque doublé d'un texte pour
 * « obligatoire ».
 */
export function Field({ label, hint, error, required, id, className, hideLabel = false, aside, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? `champ-${generated}`;
  const hintId = hint ? `${controlId}-aide` : undefined;
  const errorId = error ? `${controlId}-erreur` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
        <label htmlFor={controlId} className="text-sm font-semibold text-fg">
          {label}
          {required && (
            <>
              <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
              <span className="sr-only"> (obligatoire)</span>
            </>
          )}
        </label>
        {aside && <span className="text-sm text-fg-muted">{aside}</span>}
      </div>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm leading-snug text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium leading-snug text-danger-fg">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'w-full min-h-11 rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-fg placeholder:text-fg-muted transition-colors duration-200 '
  + 'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 '
  + 'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70 '
  + 'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/40';

interface FieldWrapperProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  hideLabel?: boolean;
  aside?: React.ReactNode;
  /** Classe du bloc (libellé, champ, aide). La classe `className` vise le contrôle. */
  fieldClassName?: string;
}

export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'>, FieldWrapperProps {}

/** Champ texte (text, email, tel, number, date, datetime-local…) avec son libellé lié. */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, hideLabel, aside, fieldClassName, id, required, className, type = 'text', ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} hideLabel={hideLabel} aside={aside} className={fieldClassName}>
      {(control) => (
        <input
          ref={ref}
          type={type}
          required={required}
          className={cn(CONTROL, className)}
          {...props}
          id={control.id}
          aria-describedby={control['aria-describedby']}
          aria-invalid={control['aria-invalid']}
        />
      )}
    </Field>
  );
});

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'>, FieldWrapperProps {
  /** Affiche « n / max » à droite du libellé quand maxLength est fixé. */
  showCount?: boolean;
}

/** Zone de texte avec libellé lié et compteur optionnel. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, hideLabel, aside, fieldClassName, id, required, className, showCount = false, rows = 4, ...props },
  ref,
) {
  const length = typeof props.value === 'string' ? props.value.length : 0;
  const counter = showCount && props.maxLength ? `${length} / ${props.maxLength}` : undefined;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} hideLabel={hideLabel} aside={aside ?? counter} className={fieldClassName}>
      {(control) => (
        <textarea
          ref={ref}
          rows={rows}
          required={required}
          className={cn(CONTROL, 'resize-y leading-relaxed', className)}
          {...props}
          id={control.id}
          aria-describedby={control['aria-describedby']}
          aria-invalid={control['aria-invalid']}
        />
      )}
    </Field>
  );
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'>, FieldWrapperProps {
  options?: SelectOption[];
  /** Première option vide (« Choisir… »), non sélectionnable une fois une valeur choisie. */
  placeholder?: string;
  children?: React.ReactNode;
}

/** Liste déroulante native (clavier et lecteurs d'écran natifs) avec libellé lié. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, hideLabel, aside, fieldClassName, id, required, className, options, placeholder, children, ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} hideLabel={hideLabel} aside={aside} className={fieldClassName}>
      {(control) => (
        <div className="relative">
          <select
            ref={ref}
            required={required}
            className={cn(CONTROL, 'cursor-pointer appearance-none pr-10', className)}
            {...props}
            id={control.id}
            aria-describedby={control['aria-describedby']}
            aria-invalid={control['aria-invalid']}
          >
            {placeholder !== undefined && <option value="" disabled={required}>{placeholder}</option>}
            {options?.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
            {children}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        </div>
      )}
    </Field>
  );
});
