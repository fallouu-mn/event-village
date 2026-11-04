/**
 * Lot 7, tâche 7.2, amendement A10 (demande de l'utilisateur du 04/11) : rien de la session de contrôle n'est
 * perdu quand le contrôleur quitte l'application et revient (arrière-plan, appel, écran verrouillé, navigation
 * aller-retour, rechargement, fermeture puis réouverture de l'application installée).
 *
 * Ce module tient la mémoire locale de l'appareil, partagée par /controller/scanner et /partner/scan :
 *  1. la session (événement, affectation, mode caméra ou saisie manuelle, onglet) : identifiants et choix d'écran
 *     seulement, aucune donnée personnelle (ni nom, ni téléphone, ni billet) ; clé par compte (empreinte du
 *     compte, jamais son identifiant en clair) ; oubliée après 24 h sans usage ; reprise seulement si l'événement
 *     est toujours ouvert au contrôle pour ce compte (la page le vérifie sur le serveur) ;
 *  2. le scan en attente : clé d'idempotence et requête (QR lu ou numéro saisi, aucun nom) d'un scan dont le
 *     verdict n'a pas été reçu (requête coupée, réponse perdue, application fermée pendant l'envoi). Au retour, la
 *     page le renvoie avec la MÊME clé : le serveur rend le verdict d'origine sans nouvelle entrée (D40). Effacé
 *     dès qu'un verdict arrive ; oublié après 2 minutes (PENDING_SCAN_MAX_AGE_MS : au-delà, le spectateur n'est
 *     plus devant le contrôleur et un envoi tardif pourrait valider une entrée sans lui ; le verdict éventuel
 *     reste lisible dans « Derniers scans », servi par le serveur).
 * Les compteurs, l'historique et la caisse ne sont JAMAIS gardés ici : la page les relit sur le serveur à
 * chaque retour (useScannerReturn : visibilitychange vers visible, pageshow d'une page restaurée, et montage).
 * Tout est effacé à la déconnexion (clearAllScanMemory, lib/scan/scan-memory, appelé avant signOut et sur
 * SIGNED_OUT). localStorage peut être indisponible (navigation privée, quota) : chaque accès est dans un try,
 * l'échec est journalisé et la page continue sans mémoire (elle repasse alors par l'écran de choix).
 * Code volontairement compact : il pèse sur le premier chargement du scanner (budget de poids, 7.5).
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { ScanFailure, ScanOutcome, ScanRequest } from '@/components/scan/scan-client';
import { SCAN_PENDING_PREFIX, SCAN_SESSION_PREFIX } from './scan-memory';

export { clearAllScanMemory, SCAN_MEMORY_PREFIXES } from './scan-memory';

export type ScanSurface = 'controleur' | 'partenaire';
export type ScanInputMode = 'camera' | 'manual';
export type ScanArea = 'controle' | 'guichet' | 'caisse';

/** Session de contrôle retenue sur l'appareil (aucune donnée personnelle). */
export interface ScanSessionMemory {
    eventId: string;
    /** Affectation du contrôleur (event_controllers.id) ; null pour le partenaire. */
    assignmentId: string | null;
    mode: ScanInputMode;
    area: ScanArea;
    /** Dernier usage (ms depuis l'époque). */
    savedAt: number;
}

/** Scan envoyé dont le verdict n'a pas été reçu. */
export interface PendingScan {
    key: string;
    eventId: string;
    request: ScanRequest;
    /** Heure de la lecture (ms) : affichée avec le résultat retrouvé. */
    createdAt: number;
}

export interface PendingRead {
    /** Scan à renvoyer (même clé). */
    pending: PendingScan | null;
    /** Scan trop ancien, oublié sans être renvoyé : l'écran le signale. */
    expired: PendingScan | null;
}

/** Session oubliée après 24 h sans usage (soirée, nuit, journée suivante d'un festival). */
export const SCAN_SESSION_MAX_AGE_MS = 24 * 60 * 60_000;
/** Scan en attente oublié après 2 minutes (voir l'en-tête). */
export const PENDING_SCAN_MAX_AGE_MS = 2 * 60_000;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AREAS = ['controle', 'guichet', 'caisse'];

type Rec = Record<string, unknown>;
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= 2048;
/** Instant plausible et récent : au plus `max` dans le passé, au plus une minute dans le futur. */
const isFresh = (at: unknown, now: number, max: number): at is number =>
    typeof at === 'number' && now - at <= max && at - now <= 60_000;

function warn(what: string, err?: unknown): void {
    console.warn(`[scan-session] ${what}`, err instanceof Error ? err.message : (err ?? ''));
}

/** Clé par compte : empreinte FNV-1a 32 bits du compte (jamais son identifiant en clair). */
function keyOf(prefix: string, surface: ScanSurface, accountId: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < accountId.length; i++) h = Math.imul(h ^ accountId.charCodeAt(i), 0x01000193) >>> 0;
    return `${prefix}${surface}:${h.toString(16).padStart(8, '0')}`;
}

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch (err) {
        warn('mémoire indisponible', err);
        return null;
    }
}

function del(key: string): void {
    try {
        storage()?.removeItem(key);
    } catch (err) {
        warn('effacement impossible', err);
    }
}

function get(key: string): Rec | null {
    try {
        const raw = storage()?.getItem(key);
        if (raw === null || raw === undefined) return null;
        const v: unknown = JSON.parse(raw);
        if (v && typeof v === 'object' && !Array.isArray(v)) return v as Rec;
        throw new Error('valeur hors format');
    } catch (err) {
        warn('valeur illisible', err);
        del(key);
        return null;
    }
}

function put(key: string, value: unknown): void {
    try {
        storage()?.setItem(key, JSON.stringify(value));
    } catch (err) {
        warn('écriture impossible', err);
    }
}

// ── 1. Session (événement et mode) ────────────────────────────────────────

/** Session retenue pour ce compte, ou null (absente, hors format ou de plus de 24 h : effacée). */
export function readScanSession(surface: ScanSurface, accountId: string, now: number = Date.now()): ScanSessionMemory | null {
    const key = keyOf(SCAN_SESSION_PREFIX, surface, accountId);
    const v = get(key);
    if (!v) return null;
    const { eventId, assignmentId, mode, area, savedAt } = v;
    if (isId(eventId) && (assignmentId === null || isId(assignmentId)) && (mode === 'camera' || mode === 'manual')
        && AREAS.includes(area as string) && isFresh(savedAt, now, SCAN_SESSION_MAX_AGE_MS)) {
        return { eventId, assignmentId, mode, area: area as ScanArea, savedAt };
    }
    warn('session oubliée');
    del(key);
    return null;
}

export function saveScanSession(surface: ScanSurface, accountId: string, value: Omit<ScanSessionMemory, 'savedAt'>): void {
    put(keyOf(SCAN_SESSION_PREFIX, surface, accountId), { ...value, savedAt: Date.now() });
}

export function clearScanSession(surface: ScanSurface, accountId: string): void {
    del(keyOf(SCAN_SESSION_PREFIX, surface, accountId));
}

// ── 2. Scan en attente de verdict ─────────────────────────────────────────

function isRequest(v: unknown, eventId: string): v is ScanRequest {
    if (!v || typeof v !== 'object') return false;
    const r = v as Rec;
    return r.eventId === eventId && (isText(r.payload) || (isText(r.manualTicketNumber) && r.identityVerified === true));
}

/** Scan en attente pour ce compte ; de plus de 2 minutes, il est effacé et rendu dans `expired`. */
export function readPendingScan(surface: ScanSurface, accountId: string, now: number = Date.now()): PendingRead {
    const key = keyOf(SCAN_PENDING_PREFIX, surface, accountId);
    const v = get(key);
    if (!v) return { pending: null, expired: null };
    const { key: k, eventId, request, createdAt } = v;
    if (!isId(k) || !isId(eventId) || !isRequest(request, eventId) || typeof createdAt !== 'number') {
        warn('scan en attente illisible');
        del(key);
        return { pending: null, expired: null };
    }
    const scan: PendingScan = { key: k, eventId, request, createdAt };
    if (isFresh(createdAt, now, PENDING_SCAN_MAX_AGE_MS)) return { pending: scan, expired: null };
    del(key);
    return { pending: null, expired: scan };
}

/** Un seul scan en attente par compte : le dernier envoyé remplace le précédent. */
export function savePendingScan(surface: ScanSurface, accountId: string, scan: PendingScan): void {
    put(keyOf(SCAN_PENDING_PREFIX, surface, accountId), scan);
}

/** Efface le scan en attente, seulement s'il porte cette clé (un scan plus récent est gardé). */
export function clearPendingScan(surface: ScanSurface, accountId: string, key: string): void {
    const storageKey = keyOf(SCAN_PENDING_PREFIX, surface, accountId);
    if (get(storageKey)?.key === key) del(storageKey);
}

/**
 * Le verdict est-il reçu ? Non pour une coupure réseau, un délai dépassé, une erreur serveur après les relances et
 * un passage hors ligne après un premier envoi : le serveur a peut-être traité la lecture, seul un renvoi avec la
 * même clé le dira. Oui pour tout verdict sur le billet, pour un refus de la requête (400, 401, 403, 429 : rien
 * n'a été traité) et pour un appareil hors ligne avant tout envoi (rien n'est parti).
 * La page ne garde le scan pour un renvoi au retour que si le contrôleur a QUITTÉ l'application pendant l'envoi
 * (`awayRef` de useScannerReturn) : un incident vu à l'écran est tranché par le contrôleur, jamais renvoyé plus
 * tard (un QR renvoyé après son expiration serait un faux refus, une saisie manuelle une entrée sans le spectateur).
 */
const UNRESOLVED: ReadonlyArray<ScanFailure | undefined> = ['network', 'timeout', 'server'];
export function isVerdictReceived(outcome: ScanOutcome): boolean {
    return !(UNRESOLVED.includes(outcome.failure) || (outcome.failure === 'offline' && (outcome.attempts ?? 0) > 0));
}

/** QR présenté par un scan en attente (null pour une saisie manuelle). */
export function pendingPayload(scan: PendingScan): string | null {
    return 'payload' in scan.request ? scan.request.payload : null;
}

// ── 3. Retour dans l'application ──────────────────────────────────────────

export type ScanReturnReason = 'visible' | 'pageshow';

/**
 * Appelle `onReturn` à chaque retour dans l'application : `visibilitychange` vers visible (appel terminé, autre
 * application, écran déverrouillé, onglet repris) et `pageshow` d'une page restaurée par le navigateur (retour
 * arrière servi par le cache de pages). Le montage (rechargement, réouverture, navigation retour sans cache)
 * est traité par la page elle-même. Deux signaux à moins d'une seconde n'en font qu'un.
 * `awayRef` passe à vrai à chaque sortie (`visibilitychange` vers hidden, `pagehide`) ; la page le remet à faux au
 * début d'un envoi pour savoir si le contrôleur a quitté l'application pendant celui-ci.
 */
export function useScannerReturn(onReturn: (reason: ScanReturnReason) => void, awayRef: MutableRefObject<boolean>): void {
    const ref = useRef(onReturn);
    ref.current = onReturn;
    useEffect(() => {
        let last = 0;
        const fire = (reason: ScanReturnReason) => {
            const now = Date.now();
            if (now - last < 1000) return;
            last = now;
            ref.current(reason);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') fire('visible');
            else awayRef.current = true;
        };
        const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) fire('pageshow');
        };
        const onPageHide = () => {
            awayRef.current = true;
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pageshow', onPageShow);
        window.addEventListener('pagehide', onPageHide);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pageshow', onPageShow);
            window.removeEventListener('pagehide', onPageHide);
        };
    }, [awayRef]);
}
