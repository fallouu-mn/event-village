'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { Bell, Briefcase, Building2, Check, ImageIcon, MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { TextInput, Textarea } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';

/**
 * Page professionnelle du partenaire (GET / PATCH /api/partner/profile). Lot 7 (7.0 f) : migrée sur le système de
 * design ; champs liés à leur libellé (TextInput, Textarea) ; logo et couverture déposés par ImageUpload (plus
 * d'adresse libre) ; activités en boutons à état (aria-pressed) ; chargement en échec : ErrorState, jamais un
 * formulaire vide qui effacerait la fiche ; refus du serveur (400 INVALID_FIELD, D72) affiché sous le champ.
 */

type FormKey = 'company_name' | 'commercial_name' | 'description' | 'address' | 'city' | 'phone' | 'email' | 'logo_url' | 'cover_url';
type FormState = Record<FormKey, string>;

const EMPTY_FORM: FormState = {
  company_name: '', commercial_name: '', description: '', address: '', city: '', phone: '', email: '', logo_url: '', cover_url: '',
};

const ACTIVITY_TYPES = [
  { value: 'ORGANISATEUR', label: 'Organisateur d’événements' },
  { value: 'SALLE', label: 'Salle de réception' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'TRAITEUR', label: 'Traiteur' },
  { value: 'PRESTATAIRE', label: 'Prestataire de services' },
  { value: 'PATISSERIE', label: 'Pâtisserie, boulangerie' },
  { value: 'ETABLISSEMENT_ALIMENTAIRE', label: 'Établissement alimentaire' },
  { value: 'AUTRE', label: 'Autre activité' },
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parsePartner(body: unknown): { form: FormState; activities: string[] } | null {
  if (!isRecord(body) || !isRecord(body.partner)) return null;
  const p = body.partner;
  const form = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM) as FormKey[]) form[key] = str(p[key]);
  const activities = Array.isArray(p.partner_activities)
    ? p.partner_activities.flatMap((a: unknown) => (isRecord(a) && typeof a.activity_type === 'string' ? [a.activity_type] : []))
    : [];
  return { form, activities };
}

async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch (err) {
    console.error(`[profil partenaire] ${what} : réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export default function PartnerProfilePage() {
  const toast = useToast();
  const uid = useId();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activities, setActivities] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/partner/profile', { cache: 'no-store' });
      const body = await readJson(res, 'lecture');
      if (!res.ok) {
        setLoadError(isRecord(body) && typeof body.error === 'string' && res.status < 500 ? body.error : `Profil indisponible (erreur ${res.status}).`);
        return;
      }
      const parsed = parsePartner(body);
      if (!parsed) {
        console.error('[profil partenaire] réponse inattendue :', body);
        setLoadError('Réponse inattendue du serveur.');
        return;
      }
      setForm(parsed.form);
      setActivities(parsed.activities);
      setLoaded(true);
      setLoadError(null);
    } catch (err) {
      console.error('[profil partenaire] lecture injoignable :', err instanceof Error ? err.message : String(err));
      setLoadError('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldError?.field === key) setFieldError(null);
  };

  const toggleActivity = (value: string) => {
    setActivities((prev) => (prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]));
    if (fieldError?.field === 'activities') setFieldError(null);
  };

  const errorFor = (key: string): string | undefined => (fieldError?.field === key ? fieldError.message : undefined);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError(null);
    setFieldError(null);
    if (form.company_name.trim().length < 2) {
      setFieldError({ field: 'company_name', message: 'Indiquez le nom de l’entreprise (2 caractères au moins).' });
      return;
    }
    if (activities.length === 0) {
      setFieldError({ field: 'activities', message: 'Choisissez au moins une activité.' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, activities }),
      });
      const body = await readJson(res, 'enregistrement');
      if (!res.ok) {
        const message = isRecord(body) && typeof body.error === 'string' ? body.error : `Profil non enregistré (erreur ${res.status}).`;
        if (isRecord(body) && body.code === 'INVALID_FIELD' && typeof body.field === 'string') setFieldError({ field: body.field, message });
        setSaveError(message);
        return;
      }
      const parsed = parsePartner(body);
      if (parsed) {
        setForm(parsed.form);
        setActivities(parsed.activities);
      }
      toast.success('Page professionnelle enregistrée.');
    } catch (err) {
      console.error('[profil partenaire] enregistrement injoignable :', err instanceof Error ? err.message : String(err));
      setSaveError('Connexion impossible : le profil n’a peut-être pas été enregistré. Actualisez la page avant de réessayer.');
    } finally {
      setIsSaving(false);
    }
  };

  const header = (
    <PageHeader
      title="Page professionnelle"
      description="Votre présentation publique sur Event Village : nom, activités, contact et visuels."
      actions={(
        <LinkButton href="/profile/notifications" variant="secondary" leftIcon={<Bell size={18} aria-hidden="true" />}>
          Préférences de notification
        </LinkButton>
      )}
    />
  );

  if (!loaded) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-24 lg:pb-12">
        {header}
        {loadError ? (
          <ErrorState title="Profil indisponible" description={loadError} onRetry={() => void load()} isRetrying={isLoading} />
        ) : (
          <div className="space-y-4" aria-busy="true">
            <span className="sr-only">Chargement du profil…</span>
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        )}
      </div>
    );
  }

  const activitiesError = errorFor('activities');

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 lg:pb-12">
      {header}

      <form onSubmit={handleSave} noValidate className="space-y-6">
        <section aria-labelledby={`${uid}-infos`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <h2 id={`${uid}-infos`} className="flex items-center gap-2 text-lg font-semibold text-fg">
            <Building2 size={20} className="text-brand-fg" aria-hidden="true" />
            Informations générales
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Nom de l’entreprise"
              required
              maxLength={150}
              autoComplete="organization"
              placeholder="Event Prestige Dakar"
              value={form.company_name}
              onChange={(e) => setField('company_name', e.target.value)}
              error={errorFor('company_name')}
            />
            <TextInput
              label="Nom commercial (enseigne)"
              maxLength={150}
              placeholder="Prestige Events"
              value={form.commercial_name}
              onChange={(e) => setField('commercial_name', e.target.value)}
              error={errorFor('commercial_name')}
            />
          </div>
          <Textarea
            label="Présentation"
            rows={4}
            maxLength={2000}
            showCount
            placeholder="Votre activité, vos services, votre spécialité."
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            error={errorFor('description')}
          />
        </section>

        <section aria-labelledby={`${uid}-activites`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <h2 id={`${uid}-activites`} className="flex items-center gap-2 text-lg font-semibold text-fg">
            <Briefcase size={20} className="text-brand-fg" aria-hidden="true" />
            Activités
          </h2>
          <p id={`${uid}-activites-aide`} className="text-sm text-fg-muted">Touchez une activité pour l’ajouter ou la retirer. Une activité au moins.</p>
          <div
            role="group"
            aria-labelledby={`${uid}-activites`}
            aria-describedby={`${uid}-activites-aide${activitiesError ? ` ${uid}-activites-erreur` : ''}`}
            className="flex flex-wrap gap-2"
          >
            {ACTIVITY_TYPES.map((act) => {
              const selected = activities.includes(act.value);
              return (
                <button
                  key={act.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleActivity(act.value)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-brand bg-brand text-on-brand' : 'border-border bg-surface-sunken text-fg hover:border-brand-fg',
                  )}
                >
                  {selected && <Check size={16} aria-hidden="true" />}
                  {act.label}
                </button>
              );
            })}
          </div>
          {activitiesError && (
            <p id={`${uid}-activites-erreur`} role="alert" className="text-sm font-medium text-danger-fg">{activitiesError}</p>
          )}
        </section>

        <section aria-labelledby={`${uid}-contact`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <h2 id={`${uid}-contact`} className="flex items-center gap-2 text-lg font-semibold text-fg">
            <MapPin size={20} className="text-brand-fg" aria-hidden="true" />
            Contact et adresse
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Téléphone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="77 123 45 67"
              hint="Numéro mobile sénégalais, affiché aux clients et aux organisateurs."
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              error={errorFor('phone')}
              className="tabular-nums"
            />
            <TextInput
              label="Email professionnel"
              type="email"
              autoComplete="email"
              placeholder="contact@maboutique.sn"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={errorFor('email')}
            />
            <TextInput
              label="Adresse"
              maxLength={200}
              autoComplete="street-address"
              placeholder="Almadies, zone 2"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              error={errorFor('address')}
            />
            <TextInput
              label="Ville"
              maxLength={80}
              autoComplete="address-level2"
              placeholder="Dakar"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              error={errorFor('city')}
            />
          </div>
        </section>

        <section aria-labelledby={`${uid}-visuels`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <h2 id={`${uid}-visuels`} className="flex items-center gap-2 text-lg font-semibold text-fg">
            <ImageIcon size={20} className="text-brand-fg" aria-hidden="true" />
            Visuels
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ImageUpload
              label="Logo"
              folder="misc"
              hint="Image carrée de préférence. JPEG, PNG ou WebP, 5 Mo au plus."
              value={form.logo_url}
              onChange={(url) => setField('logo_url', url)}
              error={errorFor('logo_url')}
            />
            <ImageUpload
              label="Photo de couverture"
              folder="misc"
              hint="Format paysage. JPEG, PNG ou WebP, 5 Mo au plus."
              value={form.cover_url}
              onChange={(url) => setField('cover_url', url)}
              error={errorFor('cover_url')}
            />
          </div>
        </section>

        {saveError && (
          <StatusBanner tone="danger" announce="alert" title="Profil non enregistré">
            {saveError}
          </StatusBanner>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" isLoading={isSaving} leftIcon={<Save size={18} aria-hidden="true" />}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
