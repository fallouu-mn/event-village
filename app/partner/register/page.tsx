'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Briefcase, Building2, Check, CheckCircle2, Clock, FileText, LogOut, MailCheck, RotateCcw, Shield, Upload, User } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextInput, Textarea } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { Logo } from '@/components/ui/Logo';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { OtpInput } from '@/components/auth/OtpInput';
import { PasswordStrengthChecklist } from '@/components/auth/PasswordStrengthChecklist';
import { useAuth } from '@/components/providers/AuthProvider';
import { PartnerActivityTypes, RegisterPartnerSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { partnerActivityLabel } from '@/lib/partner/activity-labels';

/**
 * Inscription d'un partenaire avec ses pièces (POST /api/partner/documents/upload, puis POST /api/partner/register en
 * deux appels). Lot 9 bis (R53, B40, contrat 4.2 et 5.17) : l'appel 1 (sans code) vérifie le formulaire et les pièces
 * puis envoie le code SMS, sans rien créer ; l'appel 2 (même corps, `otpCode`) vérifie le code puis crée le compte, la
 * fiche (numéro vérifié, NINEA, RCCM) et ouvre la session côté serveur. Tant que le code n'est pas saisi, aucun dossier
 * n'existe. Lot 9 bis (G.47, R87) : l'email professionnel reçoit un lien de vérification ; l'écran final dit s'il est
 * parti. Lot 7 (7.0 f) :
 *  - D63 : ouverte par un compte déjà connecté, la page explique qu'elle crée un compte professionnel distinct (avec
 *    un autre numéro) et propose la déconnexion ; aucune conversion du compte connecté ;
 *  - D64 : tout le formulaire est validé par le schéma partagé (RegisterPartnerSchema sans les jetons) AVANT le
 *    moindre téléversement ; les jetons de dépôt sont réutilisés d'une tentative à l'autre tant qu'ils ne sont pas
 *    expirés et que le fichier est le même ; code SMS saisi par OtpInput, renvoi avec décompte ;
 *  - erreurs : récapitulatif en tête (focalisé, liens vers les champs) et message sous chaque champ ; libellés liés ;
 *    LinkButton au lieu de <Link><Button>.
 */

type FieldName =
  | 'companyName' | 'commercialName' | 'description' | 'address' | 'city' | 'activities'
  | 'firstName' | 'lastName' | 'phone' | 'email' | 'password' | 'confirmPassword' | 'ninea' | 'rccm'
  | 'idCard' | 'businessDoc';

type FieldErrors = Partial<Record<FieldName, string>>;

type DocType = 'id_card' | 'business_doc';

interface UploadedDoc {
  token: string;
  expiresAt: number;
  fileKey: string;
}

const FIELD_IDS: Record<FieldName, string> = {
  companyName: 'partenaire-raison-sociale',
  commercialName: 'partenaire-enseigne',
  description: 'partenaire-description',
  address: 'partenaire-adresse',
  city: 'partenaire-ville',
  activities: 'partenaire-activites',
  firstName: 'partenaire-prenom',
  lastName: 'partenaire-nom',
  phone: 'partenaire-telephone',
  email: 'partenaire-email',
  password: 'partenaire-mot-de-passe',
  confirmPassword: 'partenaire-confirmation',
  ninea: 'partenaire-ninea',
  rccm: 'partenaire-rccm',
  idCard: 'partenaire-piece-identite',
  businessDoc: 'partenaire-document-entreprise',
};

const FIELD_ORDER = Object.keys(FIELD_IDS) as FieldName[];

/** Schéma partagé sans les jetons de dépôt : contrôlé avant tout téléversement (D64). */
const FormSchema = RegisterPartnerSchema.innerType().omit({ idCardUploadToken: true, businessDocUploadToken: true });

const RESEND_DELAY_SECONDS = 60;
/** Marge avant l'expiration d'un jeton : en deçà, la pièce est déposée à nouveau. */
const TOKEN_MARGIN_MS = 2 * 60 * 1000;
const ACCEPTED_DOCS = 'application/pdf,image/jpeg,image/png,image/webp';

function fileKeyOf(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch (err) {
    console.error(`[inscription partenaire] ${what} : réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return {};
  }
}

function errorText(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === 'string' && body.error ? body.error : fallback;
}

export default function PartnerRegisterPage() {
  const { isAuthenticated, signOut } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Dakar');
  const [activities, setActivities] = useState<string[]>(['ORGANISATEUR']);
  const [ninea, setNinea] = useState('');
  const [rccm, setRccm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [businessDocFile, setBusinessDocFile] = useState<File | null>(null);
  const uploaded = useRef<Partial<Record<DocType, UploadedDoc>>>({});

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  /** Corps de l'appel 1 (formulaire et jetons des pièces), renvoyé tel quel avec le code à l'appel 2 (R53). */
  const pendingBody = useRef<Record<string, unknown> | null>(null);
  /** Résultat de l'appel 2 : session ouverte côté serveur, lien de vérification de l'email. */
  const [signedIn, setSignedIn] = useState(false);
  const [emailLink, setEmailLink] = useState<{ sent: boolean; to: string | null } | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const toggleActivity = (type: string) => {
    setActivities((prev) => (prev.includes(type) ? prev.filter((a) => a !== type) : [...prev, type]));
    setFieldErrors((prev) => ({ ...prev, activities: undefined }));
  };

  const clearError = (field: FieldName) => setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const showErrors = (errors: FieldErrors, message: string) => {
    setFieldErrors(errors);
    setFormError(message);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  /** Dépose une pièce, ou réutilise le jeton d'une tentative précédente pour le même fichier (D64). */
  const uploadDocument = async (file: File, docType: DocType): Promise<string> => {
    const key = fileKeyOf(file);
    const previous = uploaded.current[docType];
    if (previous && previous.fileKey === key && previous.expiresAt - Date.now() > TOKEN_MARGIN_MS) return previous.token;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    const res = await fetch('/api/partner/documents/upload', { method: 'POST', body: formData });
    const body = await readJson(res, `dépôt ${docType}`);
    if (!res.ok || typeof body.uploadToken !== 'string') {
      const what = docType === 'id_card' ? 'la pièce d’identité' : 'le document d’entreprise';
      throw new Error(errorText(body, `Dépôt de ${what} impossible. Réessayez.`));
    }
    const expiresAt = typeof body.expiresAt === 'string' ? Date.parse(body.expiresAt) : Number.NaN;
    uploaded.current[docType] = { token: body.uploadToken, expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0, fileKey: key };
    return body.uploadToken;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const values = {
      companyName: companyName.trim(),
      commercialName: commercialName.trim() || undefined,
      description: description.trim(),
      address: address.trim(),
      city: city.trim(),
      activities,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      password,
      confirmPassword,
      ninea: ninea.trim() || undefined,
      rccm: rccm.trim() || undefined,
    };

    // 1. Tout le formulaire, pièces comprises, avant le moindre envoi.
    const errors: FieldErrors = {};
    const parsed = FormSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && field in FIELD_IDS && !errors[field as FieldName]) errors[field as FieldName] = issue.message;
      }
    }
    if (password && confirmPassword && password !== confirmPassword) errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    if (!idCardFile) errors.idCard = 'Joignez la pièce d’identité du gérant (CNI ou passeport).';
    if (!businessDocFile) errors.businessDoc = 'Joignez le document de l’entreprise (RCCM ou NINEA).';
    if (Object.values(errors).some(Boolean)) {
      showErrors(errors, 'Le dossier n’est pas complet : corrigez les champs signalés.');
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      // 2. Pièces : un dépôt par fichier, réutilisé tant que son jeton est valable.
      setProgress('Envoi de la pièce d’identité…');
      const idCardUploadToken = await uploadDocument(idCardFile as File, 'id_card');
      setProgress('Envoi du document d’entreprise…');
      const businessDocUploadToken = await uploadDocument(businessDocFile as File, 'business_doc');

      // 3. Appel 1 (R53) : contrôle du dossier et envoi du code ; rien n'est encore créé.
      setProgress('Envoi du code de vérification…');
      const normalizedPhone = normalizePhoneNumber(values.phone);
      const request = { ...values, phone: normalizedPhone, idCardUploadToken, businessDocUploadToken };
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = await readJson(res, 'inscription, envoi du code');
      if (!res.ok) {
        if (body.code === 'INVALID_DOCUMENT_UPLOAD') {
          uploaded.current = {};
          showErrors({}, errorText(body, 'Pièces justificatives expirées : elles seront déposées à nouveau au prochain envoi.'));
          return;
        }
        showErrors({}, errorText(body, `Dossier non enregistré (erreur ${res.status}). Réessayez.`));
        return;
      }
      pendingBody.current = request;
      setOtpCode('');
      setOtpPhone(typeof body.phone === 'string' ? body.phone : normalizedPhone);
      setCountdown(RESEND_DELAY_SECONDS);
    } catch (err) {
      console.error('[inscription partenaire] envoi du dossier :', err instanceof Error ? err.message : String(err));
      showErrors({}, err instanceof TypeError
        ? 'Connexion impossible : vérifiez votre réseau, puis réessayez. Les pièces déjà déposées ne seront pas renvoyées.'
        : err instanceof Error ? err.message : 'Dossier non enregistré. Réessayez.');
    } finally {
      setProgress(null);
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPhone) return;
    setOtpError(null);
    setOtpInfo(null);
    if (otpCode.length !== 6) {
      setOtpError('Saisissez les 6 chiffres du code reçu par SMS.');
      return;
    }
    const request = pendingBody.current;
    if (!request) {
      setOtpPhone(null);
      showErrors({}, 'Le dossier est à envoyer de nouveau : un nouveau code vous sera adressé.');
      return;
    }
    setIsVerifying(true);
    try {
      // Appel 2 (R53) : le code est vérifié, puis le compte et la fiche sont créés ensemble.
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, otpCode }),
      });
      const body = await readJson(res, 'vérification du code et création du dossier');
      if (!res.ok) {
        // Pièces expirées ou déjà utilisées, compte créé entre-temps : le dossier est à reprendre depuis le formulaire.
        if (body.code === 'INVALID_DOCUMENT_UPLOAD' || res.status === 409) {
          uploaded.current = {};
          pendingBody.current = null;
          setOtpPhone(null);
          setOtpCode('');
          showErrors({}, errorText(body, 'Dossier non enregistré : envoyez-le de nouveau.'));
          return;
        }
        setOtpError(errorText(body, 'Code incorrect. Vérifiez-le ou demandez un nouveau code.'));
        return;
      }
      pendingBody.current = null;
      setSignedIn(body.signed_in === true);
      const pending = typeof body.email_pending === 'string' ? body.email_pending : null;
      setEmailLink({ sent: body.email_verification === 'SENT' && pending !== null, to: pending });
      setIsSuccess(true);
    } catch (err) {
      console.error('[inscription partenaire] vérification injoignable :', err instanceof Error ? err.message : String(err));
      setOtpError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!otpPhone || countdown > 0) return;
    setOtpError(null);
    setOtpInfo(null);
    setIsResending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, purpose: 'REGISTER' }),
      });
      const body = await readJson(res, 'renvoi du code');
      if (!res.ok) {
        setOtpError(errorText(body, `Nouveau code non envoyé (erreur ${res.status}). Réessayez plus tard.`));
        if (typeof body.remainingSeconds === 'number' && body.remainingSeconds > 0) setCountdown(Math.ceil(body.remainingSeconds));
        return;
      }
      setOtpCode('');
      setOtpInfo('Nouveau code envoyé par SMS. L’ancien ne fonctionne plus.');
      setCountdown(RESEND_DELAY_SECONDS);
    } catch (err) {
      console.error('[inscription partenaire] renvoi injoignable :', err instanceof Error ? err.message : String(err));
      setOtpError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsResending(false);
    }
  };

  const fileField = (field: 'idCard' | 'businessDoc', label: string, hint: string, file: File | null, setFile: (f: File | null) => void) => {
    const id = FIELD_IDS[field];
    const error = fieldErrors[field];
    return (
      <div className={cn('space-y-2 rounded-2xl border border-dashed p-4', file ? 'border-success-border bg-success-bg' : 'border-border-strong bg-surface-sunken', error && 'border-danger')}>
        <label htmlFor={id} className="block text-sm font-semibold text-fg">
          {label}
          <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
          <span className="sr-only"> (obligatoire)</span>
        </label>
        <p id={`${id}-aide`} className="text-sm text-fg-muted">{hint}</p>
        <input
          id={id}
          type="file"
          accept={ACCEPTED_DOCS}
          aria-describedby={`${id}-aide${error ? ` ${id}-erreur` : ''}`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            clearError(field);
          }}
          className="block w-full text-sm text-fg file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-xl file:border-0 file:bg-brand file:px-4 file:text-sm file:font-semibold file:text-on-brand"
        />
        {file && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-success-fg">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span className="break-all">{`Fichier choisi : ${file.name}`}</span>
          </p>
        )}
        {error && <p id={`${id}-erreur`} className="text-sm font-medium text-danger-fg">{error}</p>}
      </div>
    );
  };

  const errorList = FIELD_ORDER.filter((f) => fieldErrors[f]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4 pb-24 sm:py-8">
      <div className="flex justify-center">
        <Logo variant="full" />
      </div>
      <PageHeader
        eyebrow={<Badge variant="brand" icon={<Briefcase size={14} aria-hidden="true" />}>Espace professionnel</Badge>}
        title="Devenir partenaire Event Village"
        description="Publiez vos événements et vendez vos billets en ligne, avec des reversements par SamirPay. Votre dossier est vérifié par notre équipe avant l’ouverture de votre espace."
      />

      {!isSuccess && !(isAuthenticated && !otpPhone) && (
        <p className="text-sm font-semibold text-fg-muted" aria-live="polite">
          {otpPhone ? 'Étape 2 sur 2 : le code reçu par SMS' : 'Étape 1 sur 2 : votre dossier'}
        </p>
      )}

      {isAuthenticated && !otpPhone && !isSuccess ? (
        <section aria-labelledby="partenaire-connecte" className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <h2 id="partenaire-connecte" className="text-lg font-semibold text-fg">Vous êtes déjà connecté</h2>
          <p className="text-base leading-relaxed text-fg-muted">
            Ce formulaire crée un compte professionnel distinct, avec un autre numéro de téléphone. Votre compte actuel n’est pas transformé en compte partenaire.
          </p>
          <p className="text-base leading-relaxed text-fg-muted">
            Pour inscrire votre structure, déconnectez-vous, puis revenez sur cette page avec le numéro professionnel.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" leftIcon={<LogOut size={18} aria-hidden="true" />} onClick={() => void signOut()}>
              Se déconnecter
            </Button>
            <LinkButton href="/" variant="secondary">Retour à l’accueil</LinkButton>
          </div>
        </section>
      ) : isSuccess ? (
        <section aria-labelledby="partenaire-recu" className="space-y-5 rounded-2xl border border-border bg-surface p-4 text-center sm:p-8" role="status">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-bg text-warning-fg" aria-hidden="true">
            <Clock size={32} />
          </span>
          <Badge variant="warning">En attente de validation</Badge>
          <h2 id="partenaire-recu" className="text-2xl font-bold text-fg">Dossier reçu</h2>
          <p className="mx-auto max-w-md text-base leading-relaxed text-fg-muted">
            Votre numéro est vérifié. Notre équipe examine votre dossier et vos pièces.
          </p>
          <ol className="mx-auto max-w-md space-y-2 rounded-2xl border border-border bg-surface-sunken p-4 text-left text-sm text-fg">
            <li>1. Vérification des pièces, en général sous 24 à 48 heures.</li>
            <li>2. Un SMS vous prévient dès la validation de votre compte.</li>
            <li>3. Vous créez et publiez votre premier événement depuis votre espace.</li>
          </ol>
          {signedIn ? (
            <Button variant="primary" onClick={() => window.location.assign('/partner/dashboard')}>
              Ouvrir mon espace partenaire
            </Button>
          ) : (
            <LinkButton href="/login" variant="primary">Aller à la connexion</LinkButton>
          )}
        </section>
      ) : otpPhone ? (
        <section aria-labelledby="partenaire-code" className="space-y-5 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <div className="space-y-2 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
              <MailCheck size={28} />
            </span>
            <h2 id="partenaire-code" className="text-xl font-bold text-fg">Vérifiez votre numéro</h2>
            <p className="text-base text-fg-muted">
              Code envoyé au <strong className="font-semibold tabular-nums text-fg">{otpPhone}</strong>. Saisissez-le pour envoyer votre dossier.
            </p>
            <p className="text-sm text-fg-muted">Le code à 6 chiffres reste valable 10 minutes. Votre dossier n’est enregistré qu’après sa vérification.</p>
          </div>
          <form onSubmit={handleVerify} noValidate className="mx-auto max-w-sm space-y-4">
            {otpError && (
              <StatusBanner tone="danger" announce="alert" title="Code non accepté">{otpError}</StatusBanner>
            )}
            {otpInfo && <StatusBanner tone="success" title={otpInfo} />}
            <div role="group" aria-labelledby="partenaire-code-libelle" className="space-y-1.5">
              <p id="partenaire-code-libelle" className="text-sm font-semibold text-fg">Code reçu par SMS</p>
              <OtpInput value={otpCode} onChange={setOtpCode} disabled={isVerifying} hasError={Boolean(otpError)} />
            </div>
            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isVerifying} leftIcon={<Check size={18} aria-hidden="true" />}>
              Vérifier le code
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => void handleResend()}
              isLoading={isResending}
              disabled={countdown > 0 || isVerifying}
              leftIcon={<RotateCcw size={16} aria-hidden="true" />}
            >
              {countdown > 0 ? `Renvoyer le code (${countdown} s)` : 'Renvoyer le code'}
            </Button>
          </form>
        </section>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError && (
            <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="partenaire-erreurs" className="space-y-2 rounded-2xl border border-danger-border bg-danger-bg p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <h2 id="partenaire-erreurs" className="text-base font-semibold text-danger-fg">{formError}</h2>
              {errorList.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-fg">
                  {errorList.map((f) => (
                    <li key={f}>
                      <a href={`#${FIELD_IDS[f]}`} className="inline-flex min-h-11 items-center font-semibold text-danger-fg underline underline-offset-4">
                        {fieldErrors[f]}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <section aria-labelledby="partenaire-structure" className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <h2 id="partenaire-structure" className="flex items-center gap-2 text-lg font-semibold text-fg">
              <Building2 size={20} className="text-brand-fg" aria-hidden="true" />
              1. Votre structure
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput id={FIELD_IDS.companyName} label="Raison sociale" required autoComplete="organization" placeholder="Nom légal de la société"
                value={companyName} onChange={(e) => { setCompanyName(e.target.value); clearError('companyName'); }} error={fieldErrors.companyName} />
              <TextInput id={FIELD_IDS.commercialName} label="Nom commercial (enseigne)" placeholder="Nom connu du public"
                value={commercialName} onChange={(e) => { setCommercialName(e.target.value); clearError('commercialName'); }} error={fieldErrors.commercialName} />
            </div>

            <fieldset className="space-y-2">
              <legend id={FIELD_IDS.activities} tabIndex={-1} className="text-sm font-semibold text-fg">
                Activités proposées
                <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
                <span className="sr-only"> (obligatoire)</span>
              </legend>
              <p className="text-sm text-fg-muted">Touchez une ou plusieurs activités.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PartnerActivityTypes.map((type) => {
                  const selected = activities.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleActivity(type)}
                      className={cn(
                        'flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? 'border-brand-fg bg-brand-bg text-fg' : 'border-border bg-surface-sunken text-fg hover:border-brand-fg',
                      )}
                    >
                      <span>{partnerActivityLabel(type)}</span>
                      <span
                        aria-hidden="true"
                        className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border', selected ? 'border-brand bg-brand text-on-brand' : 'border-border-strong bg-surface')}
                      >
                        {selected && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.activities && <p className="text-sm font-medium text-danger-fg">{fieldErrors.activities}</p>}
            </fieldset>

            <Textarea id={FIELD_IDS.description} label="Présentation de votre structure" required rows={3} maxLength={2000} showCount
              hint="10 caractères au moins : capacité d’accueil, prestations, spécialités."
              value={description} onChange={(e) => { setDescription(e.target.value); clearError('description'); }} error={fieldErrors.description} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextInput id={FIELD_IDS.address} label="Adresse" required autoComplete="street-address" placeholder="Boulevard Martin Luther King"
                fieldClassName="sm:col-span-2" value={address} onChange={(e) => { setAddress(e.target.value); clearError('address'); }} error={fieldErrors.address} />
              <TextInput id={FIELD_IDS.city} label="Ville" required autoComplete="address-level2" placeholder="Dakar"
                value={city} onChange={(e) => { setCity(e.target.value); clearError('city'); }} error={fieldErrors.city} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput id={FIELD_IDS.ninea} label="NINEA (facultatif)" value={ninea} onChange={(e) => { setNinea(e.target.value); clearError('ninea'); }} error={fieldErrors.ninea} />
              <TextInput id={FIELD_IDS.rccm} label="RCCM (facultatif)" value={rccm} onChange={(e) => { setRccm(e.target.value); clearError('rccm'); }} error={fieldErrors.rccm} />
            </div>
          </section>

          <section aria-labelledby="partenaire-gerant" className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <h2 id="partenaire-gerant" className="flex items-center gap-2 text-lg font-semibold text-fg">
              <User size={20} className="text-brand-fg" aria-hidden="true" />
              2. Le gérant et le compte
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput id={FIELD_IDS.firstName} label="Prénom" required autoComplete="given-name" value={firstName}
                onChange={(e) => { setFirstName(e.target.value); clearError('firstName'); }} error={fieldErrors.firstName} />
              <TextInput id={FIELD_IDS.lastName} label="Nom" required autoComplete="family-name" value={lastName}
                onChange={(e) => { setLastName(e.target.value); clearError('lastName'); }} error={fieldErrors.lastName} />
              <TextInput id={FIELD_IDS.phone} label="Téléphone professionnel" type="tel" inputMode="tel" required autoComplete="tel" placeholder="77 800 00 00"
                hint="Le code de vérification est envoyé à ce numéro. Il ne doit pas déjà servir à un compte."
                value={phone} onChange={(e) => { setPhone(e.target.value); clearError('phone'); }} error={fieldErrors.phone} className="tabular-nums" />
              <TextInput id={FIELD_IDS.email} label="Email professionnel" type="email" required autoComplete="email" placeholder="direction@etablissement.sn"
                value={email} onChange={(e) => { setEmail(e.target.value); clearError('email'); }} error={fieldErrors.email} />
              <TextInput id={FIELD_IDS.password} label="Mot de passe" type="password" required autoComplete="new-password" value={password}
                onChange={(e) => { setPassword(e.target.value); clearError('password'); }} error={fieldErrors.password} />
              <TextInput id={FIELD_IDS.confirmPassword} label="Confirmer le mot de passe" type="password" required autoComplete="new-password" value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }} error={fieldErrors.confirmPassword} />
            </div>
            <PasswordStrengthChecklist password={password} />
          </section>

          <section aria-labelledby="partenaire-pieces" className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <h2 id="partenaire-pieces" className="flex items-center gap-2 text-lg font-semibold text-fg">
              <Shield size={20} className="text-brand-fg" aria-hidden="true" />
              3. Pièces justificatives
            </h2>
            <p className="text-sm leading-relaxed text-fg-muted">
              Les deux pièces sont obligatoires. Elles sont rangées dans un espace privé, lues seulement par l’équipe qui valide votre dossier. PDF, JPEG, PNG ou WebP, 10 Mo au plus.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fileField('idCard', 'Pièce d’identité du gérant', 'CNI ou passeport en cours de validité.', idCardFile, setIdCardFile)}
              {fileField('businessDoc', 'Document de l’entreprise', 'Extrait RCCM ou attestation NINEA.', businessDocFile, setBusinessDocFile)}
            </div>
          </section>

          {progress && (
            <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
              <FileText size={16} aria-hidden="true" />
              {progress}
            </p>
          )}

          <p className="text-sm text-fg-muted">Un code vous est d’abord envoyé par SMS au téléphone professionnel ; le dossier n’est enregistré qu’une fois ce code saisi.</p>
          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting} leftIcon={<Upload size={18} aria-hidden="true" />}>
            Envoyer mon dossier
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-fg-muted">
            <span>Déjà partenaire ?</span>
            <LinkButton href="/login" variant="ghost" size="sm">Se connecter</LinkButton>
          </div>
        </form>
      )}
    </div>
  );
}
