'use client';

/**
 * Lot 10b (correctifs, point 1) : brouillon d'une salle gardé sur l'appareil (localStorage).
 *  - Une clé par compte et par fiche : une création (`…:nouvelle`) et chaque salle modifiée (`…:<id>`) ; aucune clé tant
 *    que le compte n'est pas connu (rien n'est mêlé entre deux comptes du même appareil).
 *  - Lecture une seule fois par clé, au montage (jamais au rendu serveur) ; un brouillon illisible, d'une autre forme ou
 *    identique à la fiche de départ est ignoré. S'il en reste un, il est proposé (`offer`) : rien n'est écrit tant que
 *    la personne n'a pas choisi de le reprendre ou de recommencer.
 *  - Écriture après un court délai à chaque changement ; écriture immédiate quand la page est masquée ou quittée.
 *    Revenir aux valeurs de départ efface le brouillon. `clear()` l'efface après un enregistrement réussi.
 *  - Toute lecture et toute écriture sont protégées (navigation privée, stockage plein ou bloqué) : le formulaire marche
 *    alors sans brouillon, sans message technique (`available` passe à faux).
 * Aucun montant de réservation ici : seulement les champs saisis de la salle (les photos sont les adresses déjà déposées).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearDraft, readDraft, writeDraft } from '@/lib/events/local-draft';

const VERSION = 1;
const WRITE_DELAY_MS = 600;

export interface DraftOffer<T> {
    data: T;
    /** Date de la dernière écriture (ISO). */
    savedAt: string;
    /** Repère de la fiche au moment du brouillon (date de mise à jour de la salle) ; null pour une création. */
    base: string | null;
}

interface Pending<T> {
    key: string;
    value: T;
}

function storage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

/**
 * Contre-vérification du lot 10b (garde de la déconnexion) : le brouillon passe par lib/events/local-draft (clé
 * « ev-brouillon:v1:<compte>:salle-<id> »), effacé avec les autres brouillons à la déconnexion (clearAllDrafts,
 * AuthProvider). Clé du crochet : « <compte>::<brouillon> ».
 */
function splitKey(key: string): [string, string] | null {
    const i = key.indexOf('::');
    return i > 0 ? [key.slice(0, i), key.slice(i + 2)] : null;
}

function readRaw(key: string): string | null {
    const k = splitKey(key);
    if (!k) return null;
    const draft = readDraft<object>(k[0], k[1], (d) => (d && typeof d === 'object' ? d : null));
    return draft ? JSON.stringify(draft.data) : null;
}

/** Vrai si l'opération a réussi. */
function writeRaw(key: string, raw: string | null): boolean {
    const k = splitKey(key);
    if (!k) return false;
    if (raw === null) {
        clearDraft(k[0], k[1]);
        return true;
    }
    return writeDraft(k[0], k[1], JSON.parse(raw) as unknown);
}

export interface HallDraftOptions<T> {
    /** Clé de stockage ; null tant qu'elle n'est pas connue (rien n'est lu ni écrit). */
    storageKey: string | null;
    /** Valeurs actuelles du formulaire. */
    value: T;
    /** Valeurs de départ : un brouillon identique est inutile. */
    baseline: T;
    /** Repère de la fiche (date de mise à jour de la salle), gardé avec le brouillon. */
    base: string | null;
    /** Faux pendant un enregistrement ou après un départ : rien n'est écrit. */
    enabled: boolean;
    /** Lecture prudente d'un brouillon stocké ; null s'il n'a pas la bonne forme. */
    parse: (raw: unknown) => T | null;
}

export function useHallDraft<T>({ storageKey, value, baseline, base, enabled, parse }: HallDraftOptions<T>) {
    const [offer, setOffer] = useState<DraftOffer<T> | null>(null);
    const [readKey, setReadKey] = useState<string | null>(null);
    const [available, setAvailable] = useState(true);
    const pendingRef = useRef<Pending<T> | null>(null);
    const timerRef = useRef<number | null>(null);
    const baselineJson = JSON.stringify(baseline);
    const valueJson = JSON.stringify(value);
    const latest = useRef({ baselineJson, base, parse });

    useEffect(() => {
        latest.current = { baselineJson, base, parse };
    });

    const persist = useCallback((p: Pending<T>) => {
        const same = JSON.stringify(p.value) === latest.current.baselineJson;
        const raw = same ? null : JSON.stringify({ v: VERSION, savedAt: new Date().toISOString(), base: latest.current.base, data: p.value });
        if (!writeRaw(p.key, raw)) setAvailable(false);
    }, []);

    const flush = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const p = pendingRef.current;
        pendingRef.current = null;
        if (p) persist(p);
    }, [persist]);

    // Lecture, une fois par clé
    useEffect(() => {
        if (!storageKey || readKey === storageKey) return;
        setReadKey(storageKey);
        if (!storage()) {
            setAvailable(false);
            return;
        }
        const raw = readRaw(storageKey);
        if (!raw) return;
        let parsed: unknown = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = null;
        }
        const stored = parsed && typeof parsed === 'object' ? (parsed as { v?: unknown; savedAt?: unknown; base?: unknown; data?: unknown }) : null;
        const data = stored && stored.v === VERSION ? latest.current.parse(stored.data) : null;
        if (!stored || data === null || JSON.stringify(data) === latest.current.baselineJson) {
            writeRaw(storageKey, null);
            return;
        }
        setOffer({
            data,
            savedAt: typeof stored.savedAt === 'string' ? stored.savedAt : '',
            base: typeof stored.base === 'string' ? stored.base : null,
        });
    }, [storageKey, readKey]);

    // Écriture différée à chaque changement (pas tant qu'un brouillon attend la décision)
    const ready = !!storageKey && readKey === storageKey && offer === null && enabled;
    useEffect(() => {
        if (!ready || !storageKey) return undefined;
        pendingRef.current = { key: storageKey, value: JSON.parse(valueJson) as T };
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            const p = pendingRef.current;
            pendingRef.current = null;
            if (p) persist(p);
        }, WRITE_DELAY_MS);
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [ready, storageKey, valueJson, baselineJson, persist]);

    // Page masquée, fermée ou quittée : la dernière saisie est écrite tout de suite
    useEffect(() => {
        const onHide = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onHide);
        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', onHide);
            flush();
        };
    }, [flush]);

    /** Reprendre le brouillon proposé : rend ses valeurs (l'écriture reprend ensuite). */
    const resume = useCallback((): DraftOffer<T> | null => {
        const current = offer;
        setOffer(null);
        return current;
    }, [offer]);

    /** Recommencer : le brouillon proposé est effacé. */
    const discard = useCallback(() => {
        if (storageKey) writeRaw(storageKey, null);
        setOffer(null);
    }, [storageKey]);

    /** Après un enregistrement réussi : rien en attente, brouillon effacé. */
    const clear = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = null;
        if (storageKey) writeRaw(storageKey, null);
        setOffer(null);
    }, [storageKey]);

    return { offer, available, resume, discard, clear };
}
