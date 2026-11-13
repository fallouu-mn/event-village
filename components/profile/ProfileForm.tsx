'use client';

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { MailCheck, MailWarning, RotateCcw, Save } from 'lucide-react';
import { useAuth, type UserProfile } from '@/components/providers/AuthProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { PhoneChangeDialog } from '@/components/profile/PhoneChangeDialog';
import { PasswordChangeDialog } from '@/components/profile/PasswordChangeDialog';
import { isDeliverableEmail } from '@/lib/notifications/channels';
import { AccountProfileSchema } from '@/lib/validations/account';

// Lot 9 bis (R57) : la saisie du mot de passe n'est chargée qu'au premier refus PASSWORD_CONFIRMATION_REQUIRED.
const PasswordConfirmDialog = dynamic(
  () => import('@/components/auth/PasswordConfirmDialog').then((m) => m.PasswordConfirmDialog),
  { ssr: false },
);

/**
 * Coordonnées du compte (lot 9, tâche 9.2, contrat 4.3 et 5.3) : prénom, nom et email par PATCH /api/account/profile,
 * mêmes règles que la route (AccountProfileSchema), changement de numéro dans sa boîte de dialogue.
 * L'adresse technique d'un compte inscrit par téléphone n'est jamais présentée comme son email : le champ reste vide.
 *
 * Lot 9 bis :
 *  - G.47, R87 (contrat 4.6, 5.47) : aide « Recommandé : … » ; une adresse saisie attend sa vérification
 *    (users.email_pending, lu dans le profil servi par /api/auth/me) : le champ la montre, avec le bandeau « Adresse email
 *    non vérifiée » et « Recevoir le lien de vérification » (POST /api/account/email/resend ; lot 9 quinquies, B5) ; une
 *    adresse vérifiée porte « Email vérifié ». Une adresse
 *    réelle d'avant le lot, jamais vérifiée (B98), est traitée comme une adresse en attente. Le sort du lien (envoyé,
 *    non parti, envoi indisponible, quota) est dit sous l'adresse, sans disparaître comme un toast.
 *  - R57 (tâche 13) : changer d'adresse exige un mot de passe saisi depuis moins de 10 minutes ; le refus
 *    PASSWORD_CONFIRMATION_REQUIRED ouvre PasswordConfirmDialog, puis l'enregistrement repart tel quel.
 *  - R85 (tâche 42) : bloc « Mot de passe » qui ouvre PasswordChangeDialog.
 */

type FieldName = 'first_name' | 'last_name' | 'email';

const FIELD_NAMES: FieldName[] = ['first_name', 'last_name', 'email'];

/** Codes de la route qui concernent l'email saisi. */
const EMAIL_FIELD_CODES = new Set(['EMAIL_TAKEN', 'EMAIL_CONFLICT']);

type Payload = Record<FieldName, string>;

interface SaveReply {
  ok: true;
  email_technical: boolean;
  email_pending?: string | null;
  email_verification?: 'SENT' | 'NOT_SENT' | 'NOT_CONFIGURED' | null;
}

interface EmailFeedback {
  tone: 'success' | 'warning' | 'danger';
  text: string;
}

/** Adresse montrée et son état : en attente (ou réelle jamais vérifiée, B98), vérifiée, ou aucune. */
interface EmailState {
  address: string | null;
  verified: boolean;
}

const NOT_CONFIGURED_TEXT = 'L’envoi des emails n’est pas encore disponible. Votre adresse est enregistrée : vous pourrez la vérifier plus tard.';

function emailStateOf(profile: UserProfile): EmailState {
  // Colonnes de M10 servies telles quelles par /api/auth/me (select *), lues sans les supposer présentes.
  const extra = profile as UserProfile & { email_pending?: unknown; email_verified_at?: unknown };
  const pending = typeof extra.email_pending === 'string' && extra.email_pending.trim() !== '' ? extra.email_pending : null;
  if (pending) return { address: pending, verified: false };
  if (!isDeliverableEmail(profile.email)) return { address: null, verified: false };
  const verified = typeof extra.email_verified_at === 'string' && extra.email_verified_at !== '';
  return { address: profile.email, verified };
}

function isFieldName(value: unknown): value is FieldName {
  return value === 'first_name' || value === 'last_name' || value === 'email';
}

function fieldError(name: FieldName, value: string): string | null {
  const parsed = AccountProfileSchema.shape[name].safeParse(value);
  return parsed.success ? null : parsed.error.issues[0]?.message ?? 'Valeur invalide.';
}

/** Sort du lien après un enregistrement qui met une adresse en attente (réponse `email_verification`). */
function feedbackAfterSave(reply: SaveReply): EmailFeedback | null {
  const address = reply.email_pending ?? null;
  if (!address || !reply.email_verification) return null;
  if (reply.email_verification === 'SENT') {
    return { tone: 'success', text: `Un lien de vérification a été envoyé à ${address}. Il est valable 24 heures.` };
  }
  if (reply.email_verification === 'NOT_CONFIGURED') return { tone: 'warning', text: NOT_CONFIGURED_TEXT };
  return { tone: 'warning', text: 'Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil.' };
}

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const emailState = emailStateOf(profile);
  const [values, setValues] = useState<Payload>({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    email: emailState.address ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<EmailFeedback | null>(null);
  const [isResending, setIsResending] = useState(false);
  const inputs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});
  /** Enregistrement en attente de la saisie du mot de passe (R57), relancé tel quel après confirmation. */
  const pendingSave = useRef<Payload | null>(null);

  const update = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const validateOnBlur = (name: FieldName) => {
    const message = fieldError(name, values[name]);
    setErrors((current) => ({ ...current, [name]: message ?? undefined }));
  };

  const save = async (payload: Payload) => {
    setIsSaving(true);
    try {
      const reply = await sendJson<SaveReply>('/api/account/profile', 'PATCH', payload);
      setValues(payload);
      const feedback = feedbackAfterSave(reply);
      if (feedback) setEmailFeedback(feedback);
      await refreshProfile();
      toast.success('Profil enregistré.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PASSWORD_CONFIRMATION_REQUIRED') {
        // Changement d'adresse sans mot de passe récent : rien n'est enregistré, la saisie est demandée.
        pendingSave.current = payload;
        setIsConfirmOpen(true);
        return;
      }
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

    await save({
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: values.email.trim().toLowerCase(),
    });
  };

  const onPasswordConfirmed = () => {
    setIsConfirmOpen(false);
    const payload = pendingSave.current;
    pendingSave.current = null;
    if (payload) void save(payload);
  };

  const onConfirmClosed = () => {
    setIsConfirmOpen(false);
    pendingSave.current = null;
    setFailure('Adresse email non modifiée : saisissez votre mot de passe pour la changer.');
  };

  const resendLink = async () => {
    const address = emailState.address;
    if (!address) return;
    setEmailFeedback(null);
    setIsResending(true);
    try {
      await sendJson<{ sent: true }>('/api/account/email/resend', 'POST');
      setEmailFeedback({ tone: 'success', text: `Lien envoyé à ${address}. Il est valable 24 heures.` });
    } catch (err) {
      console.error('[ProfileForm] renvoi du lien refusé :', err instanceof ApiError ? `${err.status} ${err.code ?? ''}` : String(err));
      // Message de la route (quota, envoi indisponible, adresse prise, panne), jamais de code.
      const unavailable = err instanceof ApiError && (err.status === 429 || err.code === 'EMAIL_NOT_CONFIGURED');
      setEmailFeedback({ tone: unavailable ? 'warning' : 'danger', text: errorMessage(err, 'Le lien n’a pas pu être envoyé. Réessayez dans un instant.') });
    } finally {
      setIsResending(false);
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
          hint="Recommandé : recevez vos billets et confirmations par email"
        />
        {emailState.address && emailState.verified && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface-sunken p-3">
            <Badge variant="success" icon={<MailCheck size={14} aria-hidden="true" />}>Email vérifié</Badge>
            <span className="min-w-0 flex-1 basis-40 break-all text-sm text-fg">{emailState.address}</span>
          </div>
        )}
        {/* Lot 9 quinquies (B5 : A7 de la revue) : bandeau « Adresse email non vérifiée » ; tant qu'elle ne l'est pas, la
            connexion se fait par le numéro */}
        {emailState.address && !emailState.verified && (
          <StatusBanner
            tone="warning"
            icon={<MailWarning size={20} aria-hidden="true" />}
            title="Adresse email non vérifiée"
            action={(
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void resendLink()}
                isLoading={isResending}
                disabled={isSaving}
                leftIcon={<RotateCcw size={16} aria-hidden="true" />}
              >
                Recevoir le lien de vérification
              </Button>
            )}
          >
            <span className="break-all">{emailState.address}</span> : ouvrez le lien reçu par email pour la vérifier. En attendant, connectez-vous avec votre numéro.
          </StatusBanner>
        )}
        {emailFeedback && (
          <StatusBanner tone={emailFeedback.tone} announce={emailFeedback.tone === 'danger' ? 'alert' : 'status'} title={emailFeedback.text} />
        )}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold text-fg">Mot de passe</p>
          <p className="text-sm text-fg-muted">Les autres appareils seront déconnectés.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setIsPasswordDialogOpen(true)}>
          Changer de mot de passe
        </Button>
      </div>

      <PhoneChangeDialog isOpen={isPhoneDialogOpen} onClose={() => setIsPhoneDialogOpen(false)} onChanged={onPhoneChanged} />
      <PasswordChangeDialog isOpen={isPasswordDialogOpen} onClose={() => setIsPasswordDialogOpen(false)} />
      {isConfirmOpen && (
        <PasswordConfirmDialog
          isOpen={isConfirmOpen}
          onClose={onConfirmClosed}
          onConfirmed={onPasswordConfirmed}
          actionHint="Votre profil sera enregistré juste après."
        />
      )}
    </section>
  );
}
