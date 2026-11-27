'use client';

/**
 * Lot 12c — relecture d'une route serveur toutes les `intervalMs` TANT QUE la page est visible : arrêt quand l'onglet est
 * caché, relecture immédiate au retour et au retour du réseau. Plus aucun temps réel par la base (la partenaire ne lit plus
 * les commandes par la REST depuis le lot 12a) : la route serveur est la seule source.
 *  - `skewMs` : écart entre l'heure du serveur (en-tête Date de la réponse) et celle de l'appareil, pour que les comptes
 *    à rebours ne dépendent pas d'une horloge de téléphone fausse.
 *  - Une réponse arrivée après une plus récente est ignorée ; une erreur garde les dernières données affichées.
 *  - `apply` permet à l'écran d'envelopper la mise à jour (transition de vue d'une colonne à l'autre).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiErrorOf } from '@/components/partner/fetch-json';

export interface PolledJson<T> {
    data: T | null;
    error: ApiError | null;
    loading: boolean;
    online: boolean;
    updatedAt: Date | null;
    skewMs: number;
    reload: () => Promise<void>;
}

const NETWORK = 'Connexion impossible. Vérifiez votre réseau : l’écran se remet à jour dès son retour.';

export function usePolledJson<T>(url: string | null, intervalMs: number, apply?: (update: () => void, next: T) => void): PolledJson<T> {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<ApiError | null>(null);
    const [loading, setLoading] = useState<boolean>(url !== null);
    const [online, setOnline] = useState(true);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [skewMs, setSkewMs] = useState(0);
    const seq = useRef(0);
    const applyRef = useRef(apply);
    applyRef.current = apply;

    const load = useCallback(async () => {
        if (!url) return;
        const mine = ++seq.current;
        try {
            let res: Response;
            try {
                res = await fetch(url, { cache: 'no-store' });
            } catch (err) {
                console.error(`[usePolledJson] ${url} : réseau`, err);
                throw new ApiError(NETWORK, 0, 'NETWORK_ERROR', null);
            }
            if (!res.ok) throw await apiErrorOf(res);
            const body = (await res.json()) as T;
            if (mine !== seq.current) return;
            const serverDate = Date.parse(res.headers.get('date') ?? '');
            if (!Number.isNaN(serverDate)) setSkewMs(serverDate - Date.now());
            const update = () => {
                setData(body);
                setError(null);
                setUpdatedAt(new Date());
            };
            if (applyRef.current) applyRef.current(update, body);
            else update();
        } catch (err) {
            if (mine !== seq.current) return;
            setError(err instanceof ApiError ? err : new ApiError('Lecture impossible pour le moment.', 0, null, null));
        } finally {
            if (mine === seq.current) setLoading(false);
        }
    }, [url]);

    useEffect(() => {
        if (!url) return undefined;
        setLoading(true);
        let timer: ReturnType<typeof setInterval> | null = null;
        const start = () => {
            if (timer) return;
            void load();
            timer = setInterval(() => void load(), intervalMs);
        };
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = null;
        };
        const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
        const onOnline = () => {
            setOnline(true);
            if (document.visibilityState === 'visible') void load();
        };
        const onOffline = () => setOnline(false);
        setOnline(navigator.onLine);
        if (document.visibilityState === 'visible') start();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [url, intervalMs, load]);

    return { data, error, loading, online, updatedAt, skewMs, reload: load };
}

/** Horloge de l'écran (heure du serveur estimée), relue chaque seconde tant que la page est visible. */
export function useServerClock(skewMs: number, everyMs = 1000): number {
    const [now, setNow] = useState(() => Date.now() + skewMs);
    useEffect(() => {
        setNow(Date.now() + skewMs);
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') setNow(Date.now() + skewMs);
        }, everyMs);
        return () => clearInterval(id);
    }, [skewMs, everyMs]);
    return now;
}
