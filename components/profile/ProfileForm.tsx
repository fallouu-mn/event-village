'use client';

import React, { useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth, type UserProfile } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { PhoneChangeDialog } from '@/components/profile/PhoneChangeDialog';
import { isDeliverableEmail } from '@/lib/notifications/channels';
import { AccountProfileSchema } from '@/lib/validations/account';

/**
 * Coordonnées du compte (lot 9, tâche 9.2, contrat 4.3 et 5.3) : prénom, nom et email par PATCH /api/account/profile,
 * mêmes règles que la route (AccountProfileSchema), changement de numéro dans sa boîte de dialogue.
 * L'adresse technique d'un compte inscrit par téléphone n'est jamais présentée comme son email : le champ reste vide.
 */

type FieldName = 'first_name' | 'last_name' | 'email';

const FIELD_NAMES: FieldName[] = ['first_name', 'last_name', 'email'];

/** Codes de la route qui concernent l'email saisi. */
const EMAIL_FIELD_CODES = new Set(['EMAIL_TAKEN', 'EMAIL_CONFLICT']);

function isFieldName(value: unknown): value is FieldName {
  return value === 'first_name' || value === 'last_name' || value === 'email';
}

function fieldError(name: FieldName, value: string): string | null {
  const parsed = AccountProfileSchema.shape[name].safeParse(value);
  return parsed.success ? null : parsed.error.issues[0]?.message ?? 'Valeur invalide.';
}

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState<Record<FieldName, string>>({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    email: isDeliverableEmail(profile.email) ? profile.email : '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const inputs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});

  const update = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const validateOnBlur = (name: FieldName) => {
    const message = fieldError(name, values[name]);
    setErrors((current) => ({ ...current, [name]: message ?? undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);
    const found: Partial<Record<FieldName, string>> = {};
    for (const name of FIELD_NAMES) {
      const message = fieldError(name, values[name]);
      if (message) found[name] = message;
    }
    setErrors(found);
    const firstInvalid = FIELD_NAMES.find((name) => found[name]);
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus();
      return;
    }

    const payload = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: values.email.trim().toLowerCase(),
    };
    setIsSaving(true);
    try {
      await sendJson<{ ok: true; email_technical: boolean }>('/api/account/profile', 'PATCH', payload);
      setValues(payload);
      await refreshProfile();
      toast.success('Profil enregistré.');
    } catch (err) {
      console.error('[ProfileForm] enregistrement refusé :', err instanceof Error ? err.message : String(err));
      const message = errorMessage(err);
      const field: FieldName | null = err instanceof ApiError
        ? (err.code !== null && EMAIL_FIELD_CODES.has(err.code) ? 'email' : isFieldName(err.body?.field) ? err.body.field : null)
        : null;
      if (field) {
        setErrors({ [field]: message });
        inputs.current[field]?.focus();
      } else {
        setFailure(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const onPhoneChanged = () => {
    void refreshProfile();
    toast.success('Numéro modifié. Vos autres appareils ont été déconnectés.');
  };

  return (
    <section aria-labelledby="profil-informations" className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 id="profil-informations" className="text-base font-semibold text-fg">Mes informations</h2>

      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            ref={(el) => { inputs.current.first_name = el; }}
            label="Prénom"
            autoComplete="given-name"
            maxLength={80}
            value={values.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            onBlur={() => validateOnBlur('first_name')}
            error={errors.first_name}
            disabled={isSaving}
          />
          <TextInput
            ref={(el) => { inputs.current.last_name = el; }}
            label="Nom"
            autoComplete="family-name"
            maxLength={80}
            value={values.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            onBlur={() => validateOnBlur('last_name')}
            error={errors.last_name}
            disabled={isSaving}
          />
        </div>
        <TextInput
          ref={(el) => { inputs.current.email = el; }}
          label="Adresse email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          onBlur={() => validateOnBlur('email')}
          error={errors.email}
          disabled={isSaving}
          hint="Facultative. Laissez ce champ vide si vous n’en avez pas."
        />
        {failure && (
          <StatusBanner tone="danger" announce="alert" title="Enregistrement impossible">
            {failure}
          </StatusBanner>
        )}
        <Button type="submit" isLoading={isSaving} leftIcon={<Save size={18} aria-hidden="true" />}>
          Enregistrer le profil
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold text-fg">Numéro de téléphone</p>
          <p className="text-sm text-fg-muted">Un code envoyé au nouveau numéro confirme le changement.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setIsPhoneDialogOpen(true)}>
          Changer de numéro
        </Button>
      </div>

      <PhoneChangeDialog isOpen={isPhoneDialogOpen} onClose={() => setIsPhoneDialogOpen(false)} onChanged={onPhoneChanged} />
    </section>
  );
}
