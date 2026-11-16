'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getJson } from '@/lib/finance/admin-client';

/** Réponse paginée des routes /api/admin/finance/* : { items, page, pageSize, total, amount? }. */
interface PagedBody<T> {
    items?: T[];
    page?: number;
    pageSize?: number;
    total?: number;
    amount?: number;
}

export interface PagedListState<T> {
    phase: 'loading' | 'ready' | 'error';
    items: T[];
    total: number;
    pageSize: number;
    /** Somme servie par la route (créances, remboursements à verser), sinon null. */
    amount: number | null;
    message: string | null;
    page: number;
    setPage: (page: number) => void;
    reload: () => void;
    isReloading: boolean;
}

/**
 * Finition 3a — liste paginée par le serveur (20 lignes par page). Une réponse arrivée pour une ancienne page est
 * ignorée ; une panne garde la page et dit pourquoi (jamais une liste vide trompeuse).
 */
export function usePagedList<T>(baseUrl: string, context: string, enabled = true, refreshToken = 0): PagedListState<T> {
    const [page, setPage] = useState(1);
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [amount, setAmount] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isReloading, setIsReloading] = useState(false);
    const [tick, setTick] = useState(0);
    const seq = useRef(0);

    useEffect(() => setPage(1), [baseUrl]);

    useEffect(() => {
        if (!enabled) return;
        const mine = ++seq.current;
        const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}`;
        setPhase((p) => (p === 'ready' ? 'ready' : 'loading'));
        void getJson<PagedBody<T>>(url, context).then((r) => {
            if (mine !== seq.current) return;
            setIsReloading(false);
            if (!r.ok || !Array.isArray(r.data.items)) {
                setMessage(r.ok ? null : r.message);
                setPhase('error');
                return;
            }
            setItems(r.data.items);
            setTotal(Number(r.data.total ?? r.data.items.length));
            setPageSize(Number(r.data.pageSize ?? 20));
            setAmount(typeof r.data.amount === 'number' ? r.data.amount : null);
            setMessage(null);
            setPhase('ready');
        });
    }, [baseUrl, context, enabled, page, refreshToken, tick]);

    const reload = useCallback(() => {
        setIsReloading(true);
        setTick((t) => t + 1);
    }, []);

    return { phase, items, total, pageSize, amount, message, page, setPage, reload, isReloading };
}
