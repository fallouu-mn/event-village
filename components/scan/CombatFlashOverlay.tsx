'use client';

/**
 * Résultat plein écran du scanner (lot 7, tâche 7.2, contrat 6.2 ; décisions D41, D44, D47, D51).
 *
 * Lisible du coin de l'œil, de nuit comme en plein soleil : fond plein et texte sur les seuls jetons
 * --scan-* (texte ≥ 7:1, mêmes valeurs en clair et en sombre), icône d'au moins 96 px, titre d'au moins
 * 40 px sur mobile, jamais la couleur seule (icône et titre distincts par catégorie). Aucun flou, aucune
 * ombre portée, aucun zoom, aucun texte atténué, aucun son.
 *
 *  | catégorie         | fond              | résultats                                               |
 *  | accepte           | scan-accept       | valid                                                   |
 *  | deja_utilise      | scan-used         | already_used                                            |
 *  | refuse            | scan-refuse       | invalid, cancelled, refunded, wrong_event, qr_expired…  |
 *  | hors_fenetre      | scan-window       | event_not_open, event_ended                             |
 *  | evenement_annule  | scan-refuse       | event_cancelled, event_suspended (icône distincte)      |
 *  | technique         | scan-tech         | rate_limited, network_error, server_error, hors ligne,  |
 *  |                   |                   | not_processed (icône distincte : le réseau répond)      |
 *
 * Un seul role="alert". Un toucher ferme tout de suite ; sinon retour automatique après `durationMs`
 * (0 : attend un toucher, résultat d'un scan repris). Le conteneur porte data-scan-result (résultat) et
 * data-scan-state="result" (mesures et tests de bout en bout).
 *
 * Amendement A10 : un scan renvoyé au retour dans l'application (même clé d'idempotence, verdict d'origine rendu
 * par le serveur) porte `recoveredAt` : la ligne « Résultat retrouvé » dit l'heure de la lecture d'origine, et le
 * conteneur porte data-scan-recovered="true". Lot 8 (8.2 e) : jamais pour `not_processed`, rien n'a été retrouvé.
 *
 * Lot 9 ter (9t.16, contrat C.2.4, arbitrage 19) : orange (`oriente` : mauvaise zone, pas encore entré) avec la zone où se
 * présenter ; « Accès autorisé » (`zone_ok`) d'un contrôle de zone avec l'heure et la porte de l'entrée ; « Déjà utilisé à
 * {HH:MM}, {porte} » sur fond rouge ; entrée validée avec la bande de la catégorie dans sa couleur, la consigne d'entrée et
 * la zone ; badge « Invitation » ou « Gratuit » (aucune règle n'en dépend) ; incident de porte (409 GATE_*) en écran
 * technique avec sa consigne. Chaque nœud de texte porte data-scan-contrast (mesure e2e ≥ 7:1). Sans couleur, consigne ni
 * zone, l'entrée validée garde son rendu du lot 7.
 *
 * Ce n'est pas une modale : il ne piège pas le focus et ne bloque pas la caméra au-delà de son délai.
 * La position plein écran (fixed inset-0) est voulue : elle est imposée par tests/scanner-combat-ui.test.ts, et ce
 * fichier est l'exception nommée de la règle « modale écrite à la main » de tests/parcours/design-systeme.test.ts.
 */
import React, { useEffect } from 'react';
import {
    Ban, CalendarX2, CheckCircle2, Clock, DoorClosed, OctagonX, RotateCcw, ScanLine, ShieldCheck, Signpost, WifiOff,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import {
    gatePhrase, isScanCategoryColor, isScanResult, NOT_PROCESSED_DETAIL, SCAN_RESULT_LABELS, scanCategoryOf,
    type GateProblemCode, type ScanCategory, type ScanCategoryColor, type ScanResult,
} from '@/lib/scan/scan-result';

export interface CombatFlashOverlayProps {
    /** Résultat affiché (null : rien). */
    status: ScanResult | null;
    /** Catégorie d'affichage imposée (un incident technique renvoyé en 4xx garde « technique »). */
    kind?: ScanCategory;
    /** Titre imposé (sinon : titre de la catégorie). */
    title?: string;
    message?: string;
    holderName?: string;
    /** Catégorie du billet (« VIP »), affichée sous le nom. */
    category?: string;
    ticketNumber?: string;
    /** Heure de compostage (already_used : « Entré à HH:MM »). */
    checkedInAt?: string | null;
    /** Billet composté par ce scanneur il y a moins de 30 s (D41). */
    checkedInByMe?: boolean;
    /** Retour automatique (ms) ; 0 : attend un toucher. */
    durationMs?: number;
    onDismiss?: () => void;
    /** Heure de la lecture d'origine d'un scan renvoyé au retour dans l'application (A10) ; sinon absent. */
    recoveredAt?: number | null;
    /** Lot 9 ter : couleur de la catégorie (clé de SCAN_CATEGORY_COLORS), bande du plein écran. */
    categoryColor?: string | null;
    /** Consigne d'entrée de la catégorie (entrée validée seulement). */
    entryInstruction?: string | null;
    /** Zone de la porte ; null pour la zone implicite « Entrée » (ligne omise). */
    zoneName?: string | null;
    gateName?: string | null;
    /** Origine du billet (`INVITATION` → « Invitation », `FREE` → « Gratuit », sinon aucun badge). */
    origin?: string | null;
    /** Zones où se présenter (mauvaise zone, pas encore entré), 2 au plus. */
    redirectZones?: string[] | null;
    /** Porte (ou point d'entrée) de la première entrée : « Déjà utilisé à 21:14, porte Nord ». */
    checkedInGate?: string | null;
    /** Incident de porte (409 GATE_*) : consigne propre à la place de « Le billet n'est pas en cause… ». */
    gateProblem?: GateProblemCode | null;
}

/** Bande de la catégorie (classes écrites en entier : Tailwind ne lit que des noms complets). */
export const SCAN_CATEGORY_COLOR_CLASSES: Record<ScanCategoryColor, string> = {
    BLANC: 'bg-scan-cat-blanc-bg text-scan-cat-blanc-fg',
    OR: 'bg-scan-cat-or-bg text-scan-cat-or-fg',
    ARGENT: 'bg-scan-cat-argent-bg text-scan-cat-argent-fg',
    ROSE: 'bg-scan-cat-rose-bg text-scan-cat-rose-fg',
    TURQUOISE: 'bg-scan-cat-turquoise-bg text-scan-cat-turquoise-fg',
    BLEU: 'bg-scan-cat-bleu-bg text-scan-cat-bleu-fg',
    VIOLET: 'bg-scan-cat-violet-bg text-scan-cat-violet-fg',
    NOIR: 'bg-scan-cat-noir-bg text-scan-cat-noir-fg',
};

/** Consigne d'un incident de porte (contrat C.2.4). */
const GATE_LINES: Record<GateProblemCode, string> = {
    GATE_REQUIRED: 'Demandez à l’organisateur de vous attribuer une porte. Rien n’a été validé.',
    GATE_CHANGED: 'Le contrôle reprend avec votre nouvelle porte : scannez de nouveau.',
    GATE_INVALID: 'Choisissez une porte de cet événement.',
};

const ORIGIN_BADGES: Readonly<Record<string, string>> = { INVITATION: 'Invitation', FREE: 'Gratuit' };

interface Look {
    surface: string;
    Icon: LucideIcon;
    title: string;
}

/** Fond (jeton --scan-*), icône et titre par catégorie. */
const LOOKS: Record<ScanCategory, Look> = {
    accepte: { surface: 'bg-scan-accept-bg text-scan-accept-fg', Icon: CheckCircle2, title: 'Entrée validée' },
    deja_utilise: { surface: 'bg-scan-used-bg text-scan-used-fg', Icon: RotateCcw, title: 'Billet déjà utilisé' },
    refuse: { surface: 'bg-scan-refuse-bg text-scan-refuse-fg', Icon: OctagonX, title: 'Entrée refusée' },
    hors_fenetre: { surface: 'bg-scan-window-bg text-scan-window-fg', Icon: Clock, title: 'Contrôle fermé' },
    evenement_annule: { surface: 'bg-scan-refuse-bg text-scan-refuse-fg', Icon: CalendarX2, title: 'Événement annulé' },
    technique: { surface: 'bg-scan-tech-bg text-scan-tech-fg', Icon: WifiOff, title: 'Vérification impossible' },
    // Lot 9 ter (9t.16, X13) : entrée de compilation seule ; textes et lignes du plein écran en vague E (E-C)
    oriente: { surface: 'bg-scan-orient-bg text-scan-orient-fg', Icon: Signpost, title: 'Accès refusé' },
};

/** Titre précis d'un résultat (libellé du contrat), sinon celui de la catégorie. */
function titleOf(status: ScanResult, category: ScanCategory): string {
    switch (status) {
        case 'event_suspended':
            return 'Événement suspendu';
        case 'event_cancelled':
            return 'Événement annulé';
        case 'valid':
        case 'already_used':
            return LOOKS[category].title;
        default:
            return category === 'technique' ? LOOKS.technique.title : SCAN_RESULT_LABELS[status];
    }
}

/** Vrai si `message` redit le titre : identique, ou début du titre (aux espaces et à la ponctuation finale près). */
function repeatsHeading(message: string, heading: string): boolean {
    const norm = (v: string): string => v.trim().replace(/[\s.:;!]+$/, '').toLocaleLowerCase('fr-FR');
    const m = norm(message);
    const h = norm(heading);
    if (m === h) return true;
    return m.length > 0 && h.startsWith(m) && /^[\s:,–—-]/.test(h.slice(m.length));
}

export const CombatFlashOverlay: React.FC<CombatFlashOverlayProps> = ({
    status,
    kind,
    title,
    message,
    holderName,
    category,
    ticketNumber,
    checkedInAt,
    checkedInByMe,
    durationMs,
    onDismiss,
    recoveredAt,
    categoryColor,
    entryInstruction,
    zoneName,
    gateName,
    origin,
    redirectZones,
    checkedInGate,
    gateProblem,
}) => {
    const effectiveDuration = durationMs ?? (status === 'valid' || status === 'zone_ok' ? 1500 : 3000);

    useEffect(() => {
        if (!status || effectiveDuration <= 0 || !onDismiss) return;
        const timer = setTimeout(onDismiss, effectiveDuration);
        return () => clearTimeout(timer);
    }, [status, effectiveDuration, onDismiss]);

    if (!status || !isScanResult(status)) return null;
    const cat = kind ?? scanCategoryOf(status);
    const look = LOOKS[cat];
    const Icon = gateProblem ? DoorClosed : status === 'event_suspended' ? Ban : status === 'not_processed' ? ScanLine
        : status === 'zone_ok' && cat === 'accepte' ? ShieldCheck : look.Icon;
    const heading = title
        ?? (status === 'wrong_zone' && cat === 'oriente' ? (category ? `Accès refusé : billet ${category}` : LOOKS.oriente.title) : titleOf(status, cat));
    const ticketLine = [category, ticketNumber].filter(Boolean).join(' · ');
    // Le numéro ne se coupe pas à ses tirets (relecture du run 111).
    const ticketLineNode = (
        <>
            {category}
            {category && ticketNumber ? ' · ' : ''}
            {ticketNumber && <span className="min-[375px]:whitespace-nowrap">{ticketNumber}</span>}
        </>
    );
    // Message masqué s'il redit le titre, y compris quand le titre le complète (relecture du run 77).
    const detail = status === 'not_processed' ? NOT_PROCESSED_DETAIL : message;
    const showMessage = Boolean(detail) && !gateProblem && !repeatsHeading(detail ?? '', heading);
    const at = checkedInAt ? formatTime(checkedInAt) : null;
    const gateSuffix = checkedInGate ? `, ${gatePhrase(checkedInGate)}` : '';
    // Lot 9 ter : la porte de la première entrée suit l'heure (« Déjà utilisé à 21:14, porte Nord »)
    const usedLine = status === 'already_used' && at
        ? (checkedInByMe ? `Déjà validé par vous à ${at}` : `Déjà utilisé à ${at}${gateSuffix}`)
        : null;
    const zoneOk = status === 'zone_ok' && cat === 'accepte';
    const oriented = cat === 'oriente' && (status === 'wrong_zone' || status === 'not_entered');
    // Entrée validée « riche » (couleur, consigne ou zone explicite) ; sans aucune, le rendu du lot 7 est gardé
    const richValid = status === 'valid' && cat === 'accepte' && Boolean(categoryColor || entryInstruction || zoneName);
    const band = isScanCategoryColor(categoryColor) ? categoryColor : null;
    const zoneLine = zoneName ? `Zone : ${zoneName}${richValid && gateName ? ` · ${gateName}` : ''}` : null;
    const zones = (redirectZones ?? []).filter(Boolean).slice(0, 2).join(' ou ');
    const redirectLine = !oriented ? null
        : !zones ? 'Aucune zone n’admet ce billet : appelez l’organisateur.'
        : `${status === 'wrong_zone' ? 'Présentez-vous à' : 'Passez d’abord par'} : ${zones}`;
    const badge = (status === 'valid' || zoneOk) && cat === 'accepte' && origin ? ORIGIN_BADGES[origin] : undefined;
    const categoryHead = (richValid || zoneOk) && category ? (
        <p
            data-scan-contrast
            data-scan-band={band ?? undefined}
            className={cn('max-w-4xl break-words text-6xl font-black leading-none tracking-tight',
                band && 'rounded-2xl border-4 border-scan-accept-fg px-6 py-3', band && SCAN_CATEGORY_COLOR_CLASSES[band])}
        >
            {category}
        </p>
    ) : null;

    return (
        <div
            data-testid="combat-flash-overlay"
            data-scan-result={status}
            data-scan-state="result"
            data-scan-category={cat}
            data-scan-recovered={recoveredAt ? 'true' : undefined}
            onClick={onDismiss}
            className={cn(
                'fixed inset-0 z-50 flex select-none flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center',
                onDismiss && 'cursor-pointer',
                look.surface,
            )}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
        >
            <Icon aria-hidden="true" strokeWidth={2.5} className="h-24 w-24 flex-shrink-0 sm:h-32 sm:w-32" />

            <p data-scan-contrast className="max-w-3xl text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                {heading}
            </p>

            {recoveredAt ? (
                <p className="max-w-2xl text-xl font-bold leading-snug tabular-nums sm:text-2xl">
                    Résultat retrouvé : billet lu à {formatTime(recoveredAt)}.
                </p>
            ) : null}

            {status === 'valid' && !richValid && (
                <div className="flex max-w-4xl flex-col items-center gap-2">
                    <p data-testid="combat-holder-name" data-scan-contrast className="break-words text-5xl font-black leading-none tracking-tight sm:text-6xl">
                        {holderName || 'Porteur non renseigné'}
                    </p>
                    {ticketLine && <p data-scan-contrast className="text-xl font-bold tabular-nums sm:text-2xl">{ticketLineNode}</p>}
                </div>
            )}

            {richValid && (
                <div className="flex max-w-4xl flex-col items-center gap-3">
                    {categoryHead}
                    {entryInstruction && <p data-scan-contrast className="text-balance text-3xl font-black leading-tight">{entryInstruction}</p>}
                    {zoneLine && <p data-scan-contrast className="text-2xl font-bold">{zoneLine}</p>}
                    <p data-testid="combat-holder-name" data-scan-contrast className="break-words text-4xl font-bold leading-tight">
                        {holderName || 'Porteur non renseigné'}
                    </p>
                    {ticketNumber && <p data-scan-contrast className="text-xl font-bold tabular-nums sm:text-2xl">{ticketNumber}</p>}
                </div>
            )}

            {zoneOk && (
                <>
                    {categoryHead}
                    {zoneLine && <p data-scan-contrast className="text-2xl font-bold">{zoneLine}</p>}
                    {at && <p data-scan-contrast className="text-2xl font-bold tabular-nums sm:text-3xl">Entré à {at}{gateSuffix}</p>}
                </>
            )}

            {redirectLine && <p data-scan-contrast className="max-w-3xl text-balance text-3xl font-black leading-tight">{redirectLine}</p>}

            {usedLine && <p data-scan-contrast className="text-2xl font-bold tabular-nums sm:text-3xl">{usedLine}</p>}

            {status !== 'valid' && holderName && (
                <p data-scan-contrast className="max-w-3xl break-words text-2xl font-bold sm:text-3xl">{holderName}</p>
            )}

            {showMessage && <p data-scan-contrast className="max-w-2xl text-xl font-semibold leading-snug sm:text-2xl">{detail}</p>}

            {status !== 'valid' && !zoneOk && ticketLine && (
                <p data-scan-contrast className="text-lg font-semibold tabular-nums sm:text-xl">Billet : {ticketLineNode}</p>
            )}

            {cat === 'technique' && (
                <p data-scan-contrast className="max-w-xl text-lg font-semibold leading-snug">
                    {gateProblem ? GATE_LINES[gateProblem]
                        : 'Le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif : faites patienter et réessayez.'}
                </p>
            )}

            {badge && <p data-scan-contrast className="rounded-xl border-2 border-current px-4 py-1 text-lg font-bold">{badge}</p>}

            {onDismiss && (
                // Retour automatique (consigne 7.2 : aucun clic nécessaire) : le toucher ne fait que l'avancer. « Touchez
                // l'écran pour… » laissait croire qu'il fallait toucher ; gardé seulement sans retour automatique.
                <p className="text-balance text-base font-semibold">
                    {effectiveDuration > 0 ? 'Retour automatique au scan · touchez pour passer'
                        : cat === 'technique' ? 'Touchez l’écran pour reprendre le scan' : 'Touchez l’écran pour scanner le billet suivant'}
                </p>
            )}
        </div>
    );
};
