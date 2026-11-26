'use client';

/**
 * Tableau de bord du partenaire (lot 7, tâche 7.4 ; contrat section 8, D69, D70).
 *  - Une seule source : GET /api/partner/dashboard, lu par useServerData. Tous les chiffres (montants du grand
 *    livre, billets, taux, nombre d'événements), la première utilisation (`onboarding`) et l'essai (`trial`)
 *    sont servis par le serveur ; la page ne fait que les formater (lib/format).
 *  - Chargement : KpiCard en squelette ; échec : ErrorState avec « Réessayer » (jamais de « 0 F CFA » sans
 *    donnée) ; états vides explicites.
 *  - Bandeaux du compte : en attente, refusé (avec le motif servi), suspendu (avec le motif servi). Lot 9 bis (R5, B16,
 *    contrat 5.2) : le bandeau de la suspension dit ce qui se passe vraiment (événements en ligne suspendus par la
 *    cascade, fonds gelés jusqu'à la réactivation) ; l'ancien texte, faux, est retiré.
 *  - Bloc « Commandes » affiché seulement si features.orders_enabled est ouvert (useFeatureFlags). Lot 12c : lu par les
 *    routes serveur GET /api/partner/orders/day (« Ma journée », calculée en base) et GET /api/partner/orders, relues
 *    toutes les 30 s tant que la page est visible ; plus d'abonnement temps réel à la table des commandes (la partenaire
 *    ne la lit plus par la REST depuis le lot 12a : l'ancien crochet usePartnerOrders ne rendait plus rien).
 *  - Le rapport de clôture est une modale chargée à la demande (next/dynamic).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
    Activity,
    CalendarDays,
    CheckCircle2,
    Clock,
    Download,
    FilePlus2,
    FileSpreadsheet,
    FileText,
    QrCode,
    RefreshCw,
    ShieldCheck,
    ShoppingBag,
    Ticket,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useFeatureFlags } from '@/lib/features/client';
import { useServerData } from '@/components/partner/useServerData';
import { FirstEventSteps, type FirstEventOnboarding } from '@/components/partner/onboarding/FirstEventSteps';
import { useToast } from '@/components/ui/Toast';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { KpiCard } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatDate, formatDateTime, formatFcfa, formatInteger, formatTime } from '@/lib/format';
import { ORDER_MODE_LABELS } from '@/lib/orders/partner-ui';
import type { PartnerActivityItem, PartnerDashboardData, PartnerEventBreakdown } from '@/lib/partner/partner-dashboard.service';
import Link from 'next/link';

const ClosingReportModal = dynamic(
    () => import('@/components/partner/ClosingReportModal').then((m) => m.ClosingReportModal),
    { ssr: false },
);

interface DashboardResponse {
    dashboard?: PartnerDashboardData;
    data?: PartnerDashboardData;
    /** Lot 9 bis (R7, R54) : état du dossier servi par la route (complément possible tant que resubmitted_at est vide). */
    partner?: { id: string; status: string; resubmitted_at: string | null; rejection_reason: string | null } | null;
    /** Lot 9 bis (R70, B88) : adresse de support lue côté serveur (SUPPORT_EMAIL), jamais écrite dans l'écran. */
    support_email?: string;
}

/** Lot 12c : ton de la pastille d'une commande selon son état servi (le libellé est servi : stateLabel). */
const ORDER_STATE_BADGES: Record<string, BadgeVariant> = {
    RECUE: 'warning',
    ACCEPTEE: 'info',
    EN_PREPARATION: 'brand',
    PRETE: 'success',
    EN_ROUTE: 'info',
};

/** Lot 12c : réponses des routes serveur des commandes (montants et compteurs servis, rien de calculé ici). */
interface OrdersDayResponse {
    day?: { receivedToday: number; openNow: number; toAccept: number; revenueToday: number };
}
interface OpenOrdersResponse {
    orders?: Array<{ id: string; order_number: string; state: string; stateLabel: string; mode: string; created_at: string; amounts?: { goods_total?: number } }>;
}

/** Lot 12c : relecture des commandes toutes les 30 s tant que la page est visible (plus de temps réel par la base). */
const ORDERS_REFRESH_MS = 30_000;

const ACTIVITY_ICONS: Record<PartnerActivityItem['type'], { icon: React.ElementType; className: string }> = {
    SALE: { icon: Ticket, className: 'bg-info-soft text-info-text' },
    CHECKIN: { icon: QrCode, className: 'bg-success-soft text-success-text' },
    ORDER: { icon: ShoppingBag, className: 'bg-primary-soft text-primary-text' },
    WITHDRAWAL: { icon: Wallet, className: 'bg-muted text-foreground-strong' },
};

type DossierDoc = 'id_card' | 'business_doc';
const ACCEPTED_DOCS = 'application/pdf,image/jpeg,image/png,image/webp';
const REGISTRY_ID_MAX = 40;

/** Dépôt d'une pièce (même route que l'inscription) : jeton de dépôt, ou erreur en français. */
async function uploadDossierDocument(file: File, docType: DossierDoc): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    let res: Response;
    try {
        res = await fetch('/api/partner/documents/upload', { method: 'POST', body: formData });
    } catch (err) {
        console.error('[tableau de bord] dépôt de pièce injoignable :', err instanceof Error ? err.message : String(err));
        throw new Error('Connexion impossible : vérifiez votre réseau, puis réessayez.');
    }
    const httpCode = res.status;
    const body = (await res.json().catch((err: unknown) => {
        console.error(`[tableau de bord] dépôt ${docType} : réponse illisible, code HTTP`, httpCode, err);
        return null;
    })) as { uploadToken?: unknown; error?: unknown } | null;
    if (!res.ok || typeof body?.uploadToken !== 'string') {
        const what = docType === 'id_card' ? 'la pièce d’identité' : 'le document de l’entreprise';
        throw new Error(typeof body?.error === 'string' && body.error ? body.error : `Dépôt de ${what} impossible. Réessayez.`);
    }
    return body.uploadToken;
}

/**
 * Lot 9 bis (R54, B41, contrat 4.2 et 5.17) — complément d'un dossier refusé, une seule fois : les deux pièces déposées
 * de nouveau, NINEA et RCCM facultatifs (40 caractères au plus), puis POST /api/partner/dossier/complete. Le dossier
 * repasse EN_ATTENTE et les admins sont prévenus ; un refus de la route (déjà complété, dossier non refusé) est dit.
 */
function DossierCompleteModal({ isOpen, onClose, onDone }: { isOpen: boolean; onClose: () => void; onDone: (message: string) => void }) {
    const [idCard, setIdCard] = React.useState<File | null>(null);
    const [businessDoc, setBusinessDoc] = React.useState<File | null>(null);
    const [ninea, setNinea] = React.useState('');
    const [rccm, setRccm] = React.useState('');
    const [errors, setErrors] = React.useState<Partial<Record<'idCard' | 'businessDoc' | 'ninea' | 'rccm', string>>>({});
    const [failure, setFailure] = React.useState<string | null>(null);
    const [progress, setProgress] = React.useState<string | null>(null);
    const [isSending, setIsSending] = React.useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setIdCard(null);
        setBusinessDoc(null);
        setNinea('');
        setRccm('');
        setErrors({});
        setFailure(null);
        setProgress(null);
    }, [isOpen]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSending) return;
        const next: typeof errors = {};
        if (!idCard) next.idCard = 'Joignez la pièce d’identité du gérant (CNI ou passeport).';
        if (!businessDoc) next.businessDoc = 'Joignez le document de l’entreprise (RCCM ou NINEA).';
        if (ninea.trim().length > REGISTRY_ID_MAX) next.ninea = 'Le NINEA fait 40 caractères au plus.';
        if (rccm.trim().length > REGISTRY_ID_MAX) next.rccm = 'Le RCCM fait 40 caractères au plus.';
        setErrors(next);
        setFailure(null);
        if (Object.values(next).some(Boolean)) return;
        setIsSending(true);
        try {
            setProgress('Envoi de la pièce d’identité…');
            const idToken = await uploadDossierDocument(idCard as File, 'id_card');
            setProgress('Envoi du document de l’entreprise…');
            const businessToken = await uploadDossierDocument(businessDoc as File, 'business_doc');
            setProgress('Envoi du dossier…');
            const reply = await sendJson<{ ok?: boolean; message?: string }>('/api/partner/dossier/complete', 'POST', {
                upload_ids: [idToken, businessToken],
                ninea: ninea.trim() || null,
                rccm: rccm.trim() || null,
            });
            onDone(typeof reply.message === 'string' && reply.message ? reply.message : 'Dossier envoyé : il est de nouveau en cours de vérification.');
        } catch (err) {
            console.error('[tableau de bord] complément du dossier refusé :', err instanceof ApiError ? err.code ?? 'sans code' : String(err));
            setFailure(errorMessage(err, 'Dossier non envoyé. Réessayez.'));
        } finally {
            setProgress(null);
            setIsSending(false);
        }
    };

    const fileField = (key: 'idCard' | 'businessDoc', id: string, label: string, hint: string, file: File | null, setFile: (f: File | null) => void) => (
        <div className={cn('space-y-2 rounded-xl border border-dashed p-4', file ? 'border-success-border bg-success-soft' : 'border-input bg-background', errors[key] && 'border-danger')}>
            <label htmlFor={id} className="block text-sm font-semibold text-foreground-strong">
                {label}
                <span className="ml-0.5 text-danger-text" aria-hidden="true">*</span>
                <span className="sr-only"> (obligatoire)</span>
            </label>
            <p id={`${id}-aide`} className="text-sm text-muted-foreground">{hint}</p>
            <input
                id={id}
                type="file"
                accept={ACCEPTED_DOCS}
                disabled={isSending}
                aria-describedby={`${id}-aide${errors[key] ? ` ${id}-erreur` : ''}`}
                aria-invalid={errors[key] ? true : undefined}
                onChange={(ev) => {
                    setFile(ev.target.files?.[0] ?? null);
                    setErrors((prev) => ({ ...prev, [key]: undefined }));
                }}
                className="block w-full text-sm text-foreground-strong file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-xl file:border-0 file:bg-primary file:px-4 file:text-sm file:font-semibold file:text-primary-foreground"
            />
            {file && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-success-text">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span className="break-all">{`Fichier choisi : ${file.name}`}</span>
                </p>
            )}
            {errors[key] && <p id={`${id}-erreur`} className="text-sm font-medium text-danger-text">{errors[key]}</p>}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Compléter mon dossier"
            subtitle="Une seule fois : votre dossier repasse en vérification."
            icon={<FilePlus2 size={20} aria-hidden="true" />}
            busy={isSending}
            maxWidth="lg"
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSending}>Annuler</Button>
                    <Button type="submit" form="complement-dossier" variant="primary" isLoading={isSending}>Envoyer mon dossier</Button>
                </div>
            }
        >
            <form id="complement-dossier" noValidate onSubmit={(ev) => void submit(ev)} className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                    Déposez de nouveau vos deux pièces, en tenant compte du motif du refus. PDF, JPEG, PNG ou WebP, 10 Mo au plus.
                    Après cet envoi, le dossier ne pourra plus être complété ici.
                </p>
                {fileField('idCard', 'complement-piece-identite', 'Pièce d’identité du gérant', 'CNI ou passeport en cours de validité.', idCard, setIdCard)}
                {fileField('businessDoc', 'complement-document-entreprise', 'Document de l’entreprise', 'Extrait RCCM ou attestation NINEA.', businessDoc, setBusinessDoc)}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextInput id="complement-ninea" label="NINEA (facultatif)" value={ninea} maxLength={REGISTRY_ID_MAX} disabled={isSending}
                        onChange={(ev) => { setNinea(ev.target.value); setErrors((prev) => ({ ...prev, ninea: undefined })); }} error={errors.ninea} />
                    <TextInput id="complement-rccm" label="RCCM (facultatif)" value={rccm} maxLength={REGISTRY_ID_MAX} disabled={isSending}
                        onChange={(ev) => { setRccm(ev.target.value); setErrors((prev) => ({ ...prev, rccm: undefined })); }} error={errors.rccm} />
                </div>
                {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
                {failure && (
                    <StatusBanner tone="danger" announce="alert" title="Dossier non envoyé">
                        {failure}
                    </StatusBanner>
                )}
            </form>
        </Modal>
    );
}

/** Ouvre un export (PDF ou CSV servi par une route) dans un nouvel onglet. */
function openExport(url: string): void {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) window.location.assign(url);
}

export default function PartnerDashboardPage() {
    const toast = useToast();
    const flags = useFeatureFlags();
    const { data: body, error, loading, refreshing, reload } = useServerData<DashboardResponse>('/api/partner/dashboard');
    const dashboard = body?.dashboard ?? body?.data ?? null;
    const partner = dashboard?.partner ?? null;
    const kpis = dashboard?.kpis ?? null;
    const trial = dashboard?.trial ?? null;
    const onboarding = (dashboard?.onboarding ?? null) as FirstEventOnboarding | null;
    const supportEmail = typeof body?.support_email === 'string' && body.support_email.includes('@') ? body.support_email : null;

    // Commandes : lues seulement si le service des commandes est ouvert (D69), par les routes serveur (lot 12c)
    const ordersOpen = flags?.orders === true;
    const [ordersTick, setOrdersTick] = React.useState(0);
    useEffect(() => {
        if (!ordersOpen) return undefined;
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') setOrdersTick((n) => n + 1);
        }, ORDERS_REFRESH_MS);
        return () => clearInterval(id);
    }, [ordersOpen]);
    const ordersDay = useServerData<OrdersDayResponse>(ordersOpen && partner ? '/api/partner/orders/day' : null, ordersTick);
    const openOrders = useServerData<OpenOrdersResponse>(ordersOpen && partner ? '/api/partner/orders?filter=open' : null, ordersTick);
    const liveOrders = openOrders.data?.orders ?? [];
    const today = ordersDay.data?.day ?? null;

    const [closing, setClosing] = React.useState<{ id: string; title: string } | null>(null);
    const [isDossierOpen, setIsDossierOpen] = React.useState(false);
    /** Lot 9 bis (R54) : complément possible une fois, tant que la route ne sert pas resubmitted_at. */
    const canCompleteDossier = partner?.status === 'REJETE' && body?.partner?.status === 'REJETE' && !body.partner.resubmitted_at;

    // Démarrage de l'essai à la première visite d'un partenaire validé (action idempotente du serveur),
    // puis relecture : la durée et la date de fin affichées sont celles que le serveur a posées.
    const activationAsked = useRef(false);
    /** Design 1a : appel nommé pour que « Réessayer » le relance tel quel (action idempotente du serveur). */
    const startTrial = useCallback(async (): Promise<void> => {
        try {
            const res = await fetch('/api/partner/activation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const reply = (await res.json().catch((err: unknown) => {
                    console.error('[tableau de bord] réponse d’activation illisible :', err);
                    return null;
                })) as { error?: string } | null;
                console.error('[tableau de bord] activation de l’essai refusée, HTTP', res.status, reply);
                const message = reply?.error ?? 'La période d’essai n’a pas pu démarrer. Rechargez la page pour réessayer.';
                if (res.status >= 500) toast.error(message, { onRetry: () => { void startTrial(); } });
                else toast.error(message);
                return;
            }
            await reload();
        } catch (err) {
            console.error('[tableau de bord] activation de l’essai impossible :', err);
            toast.error('Connexion impossible : la période d’essai démarrera à votre prochaine visite.', { onRetry: () => { void startTrial(); } });
        }
    }, [reload, toast]);
    useEffect(() => {
        if (!partner || !trial || activationAsked.current) return;
        if (partner.status !== 'VALIDE' || trial.started_at) return;
        activationAsked.current = true;
        void startTrial();
    }, [partner, trial, startTrial]);

    const handleRefresh = useCallback(() => {
        void reload();
    }, [reload]);

    const eventColumns: DataColumn<PartnerEventBreakdown>[] = [
        {
            key: 'event',
            header: 'Événement',
            render: (ev) => (
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                    <span className="break-words font-semibold text-foreground-strong">{ev.title}</span>
                    <StatusBadge domain="event" status={ev.status} size="sm" />
                </div>
            ),
        },
        {
            key: 'date',
            header: 'Date et lieu',
            render: (ev) => (
                <div className="flex flex-col">
                    <time dateTime={ev.startAt ?? undefined} className="text-sm text-foreground-strong">{formatDateTime(ev.startAt)}</time>
                    <span className="text-sm text-muted-foreground">{ev.city || ev.location || '—'}</span>
                </div>
            ),
        },
        {
            key: 'sold',
            header: 'Vendus / capacité',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-col tabular-nums">
                    <span className="font-semibold text-foreground-strong">{formatInteger(ev.ticketsSold)} / {formatInteger(ev.capacity)}</span>
                    <span className="text-sm text-muted-foreground">{formatInteger(ev.fillRatePercent)} % rempli</span>
                </div>
            ),
        },
        {
            key: 'entries',
            header: 'Entrées',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-col tabular-nums">
                    <span className="font-semibold text-foreground-strong">{formatInteger(ev.ticketsCheckedIn)}</span>
                    <span className="text-sm text-muted-foreground">{formatInteger(ev.checkInRatePercent)} % des vendus</span>
                </div>
            ),
        },
        {
            // Design 1c : brut → remboursé → net (grand livre ; netRevenue = grossRevenue − refundedAmount, une seule déduction)
            key: 'gross',
            header: 'Ventes en ligne (brut)',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-col tabular-nums">
                    <span className="font-semibold text-foreground-strong">{formatFcfa(ev.grossRevenue)}</span>
                    <span className="text-sm text-muted-foreground">Remboursements : {ev.refundedAmount > 0 ? `− ${formatFcfa(ev.refundedAmount)}` : formatFcfa(0)}</span>
                </div>
            ),
        },
        {
            key: 'net',
            header: 'Recettes nettes',
            align: 'right',
            render: (ev) => <span className="font-bold tabular-nums text-primary-text">{formatFcfa(ev.netRevenue)}</span>,
        },
        {
            key: 'actions',
            header: 'Rapports',
            align: 'right',
            render: (ev) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" leftIcon={<FileText size={16} aria-hidden="true" />} onClick={() => setClosing({ id: ev.id, title: ev.title })}>
                        Clôture
                    </Button>
                    <IconButton
                        aria-label={`Télécharger le rapport PDF de ${ev.title}`}
                        title="Rapport PDF"
                        variant="secondary"
                        onClick={() => openExport(`/api/partner/reports/closing/pdf?eventId=${encodeURIComponent(ev.id)}`)}
                    >
                        <Download size={18} />
                    </IconButton>
                    <IconButton
                        aria-label={`Exporter les ventes de ${ev.title} en CSV`}
                        title="Export CSV"
                        variant="secondary"
                        onClick={() => openExport(`/api/partner/reports/accounting?eventId=${encodeURIComponent(ev.id)}&format=csv`)}
                    >
                        <FileSpreadsheet size={18} />
                    </IconButton>
                </div>
            ),
        },
    ];

    const title = partner?.commercialName || partner?.companyName || 'Tableau de bord';

    return (
        <div className="mx-auto max-w-6xl space-y-6 py-6 pb-24 sm:space-y-8">
            <PageHeader
                eyebrow={<span className="text-sm font-medium text-muted-foreground">Espace partenaire</span>}
                title={title}
                description="Ventes, entrées et solde de vos événements."
                actions={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleRefresh}
                            isLoading={refreshing}
                            disabled={loading}
                            leftIcon={<RefreshCw size={16} aria-hidden="true" />}
                        >
                            Actualiser
                        </Button>
                        <a
                            href="/api/partner/reports/accounting?format=csv"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'no-underline gap-1.5' })}
                        >
                            <FileSpreadsheet size={16} aria-hidden="true" />
                            Export comptable
                        </a>
                        <LinkButton href="/partner/scan" size="sm" leftIcon={<QrCode size={16} />}>
                            Scanner des billets
                        </LinkButton>
                    </>
                }
            />

            {error && !dashboard ? (
                <ErrorState
                    title="Tableau de bord indisponible"
                    description={`${error} Aucun chiffre n’est affiché tant que le serveur n’a pas répondu.`}
                    onRetry={handleRefresh}
                    isRetrying={refreshing || loading}
                />
            ) : (
                <>
                    {error && dashboard && (
                        <StatusBanner tone="danger" announce="alert" title="Actualisation impossible">
                            {error} Les chiffres affichés sont ceux de la dernière lecture réussie.
                        </StatusBanner>
                    )}

                    {/* Bandeaux du compte (statut servi par le serveur) */}
                    {partner?.status === 'EN_ATTENTE' && (
                        <StatusBanner
                            tone="warning"
                            title="Compte en cours de vérification"
                            icon={<Clock size={20} />}
                            action={<LinkButton href="/partner/profile" variant="secondary" size="sm">Voir mon profil</LinkButton>}
                        >
                            Vos pièces sont vérifiées par l’équipe Event Village. Vous recevrez un SMS dès la validation de votre compte ;
                            vous pourrez alors créer et publier vos événements. En attendant, votre profil reste modifiable.
                        </StatusBanner>
                    )}
                    {partner?.status === 'REJETE' && (
                        <StatusBanner
                            tone="danger"
                            title="Demande de compte partenaire refusée"
                            action={canCompleteDossier
                                ? <Button variant="primary" size="sm" leftIcon={<FilePlus2 size={16} aria-hidden="true" />} onClick={() => setIsDossierOpen(true)}>Compléter mon dossier</Button>
                                : supportEmail ? <LinkButton href={`mailto:${supportEmail}`} variant="secondary" size="sm">Contacter le support</LinkButton> : undefined}
                        >
                            {partner.rejectionReason ? <>Motif : {partner.rejectionReason}</> : 'Aucun motif n’a été précisé.'}{' '}
                            {canCompleteDossier
                                ? 'Vous pouvez compléter votre dossier une fois : il repasse alors en vérification.'
                                : <>Votre dossier a déjà été complété une fois. Pour la suite, <Link href="/aide" className="font-semibold text-primary-text underline underline-offset-4">contactez le support</Link>.</>}
                        </StatusBanner>
                    )}
                    {partner?.status === 'SUSPENDU' && (
                        <StatusBanner tone="suspended" title="Compte partenaire suspendu">
                            {partner.suspendedReason ? <>Motif : {partner.suspendedReason}. </> : null}
                            Vos événements en ligne sont suspendus et vos fonds sont gelés jusqu’à la réactivation du compte. <Link href="/aide" className="font-semibold text-primary-text underline underline-offset-4">Contactez le support Event Village</Link>.
                        </StatusBanner>
                    )}

                    {/* Période d'essai (durée et date de fin servies) */}
                    {trial?.active && trial.ends_at && (
                        <StatusBanner tone="success" title="Période d’essai gratuite en cours" icon={<ShieldCheck size={20} />} className="tabular-nums">
                            {trial.days !== null ? `${formatInteger(trial.days)} jours offerts, ` : ''}
                            jusqu’au <time dateTime={trial.ends_at}>{formatDate(trial.ends_at)}</time>.
                        </StatusBanner>
                    )}

                    {/* Première utilisation (étapes cochées par le serveur) */}
                    {onboarding?.visible && <FirstEventSteps onboarding={onboarding} />}

                    {/* Indicateurs */}
                    <section aria-labelledby="kpi-titre" className="space-y-3">
                        <h2 id="kpi-titre" className="sr-only">Indicateurs</h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                            <KpiCard
                                loading={loading || !kpis}
                                label="Ventes en ligne (brut)"
                                value={kpis ? formatFcfa(kpis.grossRevenue) : ''}
                                countUp={kpis ? { to: kpis.grossRevenue, format: 'fcfa' } : undefined}
                                hint="Prix des billets vendus en ligne, tous événements, avant remboursements."
                                tone="brand"
                                icon={<TrendingUp size={18} />}
                            />
                            <KpiCard
                                loading={loading || !kpis}
                                label="Recettes nettes"
                                value={kpis ? formatFcfa(kpis.netRevenue) : ''}
                                countUp={kpis ? { to: kpis.netRevenue, format: 'fcfa' } : undefined}
                                hint={kpis ? `Ventes en ligne moins ${formatFcfa(kpis.refundedAmount)} de remboursements.` : undefined}
                                tone="success"
                                icon={<Wallet size={18} />}
                            />
                            <KpiCard
                                loading={loading || !kpis}
                                label="Billets vendus"
                                value={kpis ? formatInteger(kpis.ticketsSold) : ''}
                                countUp={kpis ? { to: kpis.ticketsSold, format: 'integer' } : undefined}
                                hint={kpis ? `${formatInteger(kpis.ticketsCheckedIn)} entrées validées aux portes.` : undefined}
                                tone="info"
                                icon={<Ticket size={18} />}
                            />
                            <KpiCard
                                loading={loading || !kpis}
                                label="Disponible au retrait"
                                value={kpis ? formatFcfa(kpis.soldeDisponible) : ''}
                                countUp={kpis ? { to: kpis.soldeDisponible, format: 'fcfa' } : undefined}
                                hint={kpis ? `Déjà versé : ${formatFcfa(kpis.totalWithdrawn)}.` : undefined}
                                tone="neutral"
                                icon={<CheckCircle2 size={18} />}
                            />
                        </div>
                        {kpis && (
                            <p className="text-sm tabular-nums text-muted-foreground">
                                Les ventes en espèces au guichet ({formatFcfa(kpis.cashSales)}) et les invitations n’alimentent pas le solde.{' '}
                                <LinkButton href="/partner/finance" variant="ghost" size="sm" className="-ml-2 align-middle">Voir mes finances</LinkButton>
                            </p>
                        )}
                    </section>

                    {/* Événements */}
                    <section aria-labelledby="evenements-titre" className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <h2 id="evenements-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                                    <CalendarDays size={20} className="text-primary-text" aria-hidden="true" />
                                    Mes événements
                                </h2>
                                {kpis && (
                                    <Badge variant="neutral" size="sm" className="tabular-nums">
                                        {formatInteger(kpis.totalEvents)} au total
                                    </Badge>
                                )}
                            </div>
                            <LinkButton href="/partner/events" variant="ghost" size="sm">Tous mes événements</LinkButton>
                        </div>
                        {loading || !dashboard ? (
                            <div className="space-y-2" role="status" aria-busy="true">
                                <span className="sr-only">Chargement des événements…</span>
                                <div className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
                                <div className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
                            </div>
                        ) : (
                            <DataList
                                items={dashboard.events}
                                columns={eventColumns}
                                getKey={(ev) => ev.id}
                                breakpoint="xl"
                                caption="Ventes, entrées et rapports par événement"
                                cardTitle={(ev) => ev.title}
                                empty={
                                    <EmptyState
                                        title="Aucun événement pour le moment"
                                        description="Créez votre premier événement : il restera en brouillon jusqu’à ce que vous le soumettiez à la validation."
                                        actionLabel={partner?.status === 'VALIDE' ? 'Créer un événement' : undefined}
                                        actionHref={partner?.status === 'VALIDE' ? '/partner/events/new' : undefined}
                                        icon={<CalendarDays size={28} />}
                                    />
                                }
                            />
                        )}
                    </section>

                    {/* Activité récente et commandes en direct */}
                    <div className={ordersOpen ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'grid grid-cols-1 gap-6'}>
                        <section aria-labelledby="activite-titre" className="space-y-3">
                            <h2 id="activite-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                                <Activity size={20} className="text-primary-text" aria-hidden="true" />
                                Activité récente
                            </h2>
                            {loading || !dashboard ? (
                                <div className="h-40 rounded-xl bg-muted motion-safe:animate-pulse" role="status" aria-busy="true">
                                    <span className="sr-only">Chargement de l’activité…</span>
                                </div>
                            ) : dashboard.recentActivity.length === 0 ? (
                                <EmptyState
                                    title="Aucune opération récente"
                                    description="Ventes, entrées validées et retraits apparaîtront ici."
                                    icon={<Activity size={28} />}
                                />
                            ) : (
                                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                                    {dashboard.recentActivity.map((item) => {
                                        const visual = ACTIVITY_ICONS[item.type];
                                        const Icon = visual.icon;
                                        return (
                                            <li key={item.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${visual.className}`} aria-hidden="true">
                                                        <Icon size={16} />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="break-words text-sm font-semibold text-foreground-strong">{item.title}</p>
                                                        <p className="break-words text-sm text-muted-foreground">{item.description}</p>
                                                    </div>
                                                </div>
                                                <time dateTime={item.createdAt} className="pl-12 text-caption text-muted-foreground sm:flex-shrink-0 sm:pl-0">
                                                    {formatDateTime(item.createdAt)}
                                                </time>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        {ordersOpen && (
                            <section aria-labelledby="commandes-titre" className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 id="commandes-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                                        <ShoppingBag size={20} className="text-primary-text" aria-hidden="true" />
                                        Commandes
                                    </h2>
                                    <span className="text-sm text-muted-foreground" role="status">
                                        {openOrders.updatedAt ? <>Mis à jour à <span className="tabular-nums">{formatTime(openOrders.updatedAt)}</span></> : 'Chargement…'}
                                    </span>
                                </div>
                                {today && (
                                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span>À accepter : <span className="font-bold tabular-nums text-foreground-strong">{formatInteger(today.toAccept)}</span></span>
                                        <span>En cours : <span className="font-bold tabular-nums text-foreground-strong">{formatInteger(today.openNow)}</span></span>
                                        <span>Recette du jour : <span className="font-bold tabular-nums text-foreground-strong">{formatFcfa(today.revenueToday)}</span></span>
                                    </p>
                                )}
                                {openOrders.error && !openOrders.data ? (
                                    <ErrorState title="Commandes indisponibles" description={openOrders.error} onRetry={() => void openOrders.reload()} />
                                ) : liveOrders.length === 0 ? (
                                    <EmptyState
                                        title="Aucune commande en cours"
                                        description="Les commandes de vos clients s’afficheront ici dès leur paiement."
                                        icon={<ShoppingBag size={28} />}
                                    />
                                ) : (
                                    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                                        {liveOrders.slice(0, 6).map((order) => (
                                            <li key={order.id} className="flex items-center justify-between gap-3 p-4">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link href={`/partner/orders/${order.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold tabular-nums text-foreground-strong underline-offset-2 hover:underline">
                                                            {order.order_number}
                                                        </Link>
                                                        <Badge variant={ORDER_STATE_BADGES[order.state] ?? 'neutral'} size="sm">{order.stateLabel}</Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {ORDER_MODE_LABELS[order.mode] ?? 'Commande'} ·{' '}
                                                        <time dateTime={order.created_at} className="text-sm">{formatDateTime(order.created_at)}</time>
                                                    </p>
                                                </div>
                                                <span className="flex-shrink-0 text-sm font-bold tabular-nums text-foreground-strong">{formatFcfa(order.amounts?.goods_total)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <LinkButton href="/partner/orders" variant="ghost" size="sm">Toutes les commandes</LinkButton>
                            </section>
                        )}
                    </div>
                </>
            )}

            <DossierCompleteModal
                isOpen={isDossierOpen}
                onClose={() => setIsDossierOpen(false)}
                onDone={(message) => {
                    setIsDossierOpen(false);
                    toast.success(message);
                    void reload();
                }}
            />

            {closing && (
                <ClosingReportModal isOpen onClose={() => setClosing(null)} eventId={closing.id} eventTitle={closing.title} />
            )}
        </div>
    );
}
