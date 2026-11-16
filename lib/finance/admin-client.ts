/**
 * Finition 3a — lecture des routes /api/admin/finance/* par les écrans de l'administration. Le message montré vient du
 * serveur ({ error }, déjà en français) ou d'un texte fixe ; jamais le détail technique d'une exception.
 */
import { readJsonBody, serverErrorMessage } from '@/lib/payments/payment-client';

export type FetchResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export const SERVER_TROUBLE = 'Le serveur n’a pas répondu comme prévu. Réessayez ; si cela continue, prévenez l’équipe technique.';
export const NETWORK_TROUBLE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

export async function getJson<T>(url: string, context: string): Promise<FetchResult<T>> {
    let res: Response;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (err) {
        console.error(`[${context}] requête impossible :`, err);
        return { ok: false, status: 0, message: NETWORK_TROUBLE };
    }
    const body = await readJsonBody(res, context);
    if (!res.ok) return { ok: false, status: res.status, message: serverErrorMessage(body) ?? SERVER_TROUBLE };
    if (body === null || typeof body !== 'object') {
        console.error(`[${context}] réponse inattendue :`, body);
        return { ok: false, status: res.status, message: SERVER_TROUBLE };
    }
    return { ok: true, data: body as T };
}
