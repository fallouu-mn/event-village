/**
 * Lot 5 (zone partenaire) — appels des routes serveur depuis les écrans de l'organisateur.
 *
 * Toute réponse non 2xx devient une ApiError qui porte le message français renvoyé par la route
 * (`{ error, code }`, convention du contrat) ; une panne réseau devient une ApiError explicite. Rien n'est
 * avalé : l'écran affiche l'erreur (ErrorState avec « Réessayer », bandeau ou toast).
 */

export class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly code: string | null, readonly body: Record<string, unknown> | null) {
        super(message);
        this.name = 'ApiError';
    }
}

const NETWORK_MESSAGE = 'Connexion impossible. Vérifiez votre réseau, puis réessayez.';

function fallbackMessage(status: number): string {
    if (status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (status === 403) return 'Vous n’avez pas accès à ces informations.';
    if (status === 404) return 'Élément introuvable ou non autorisé.';
    if (status === 429) return 'Trop de demandes. Patientez quelques secondes, puis réessayez.';
    return 'Le serveur n’a pas pu traiter la demande. Réessayez dans un instant.';
}

async function readBody(res: Response): Promise<Record<string, unknown> | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        const parsed: unknown = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/** Réponse en échec : ApiError avec le message de la route, sinon un message selon le statut HTTP. */
export async function apiErrorOf(res: Response): Promise<ApiError> {
    const body = await readBody(res);
    const message = typeof body?.error === 'string' && body.error.trim() ? body.error : fallbackMessage(res.status);
    const code = typeof body?.code === 'string' ? body.code : null;
    return new ApiError(message, res.status, code, body);
}

/** Appel JSON d'une route : corps lu en cas de succès, ApiError sinon (réseau compris). */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
        res = await fetch(url, { cache: 'no-store', ...init });
    } catch (err) {
        console.error(`[fetchJson] ${url} : réseau`, err);
        throw new ApiError(NETWORK_MESSAGE, 0, 'NETWORK_ERROR', null);
    }
    if (!res.ok) throw await apiErrorOf(res);
    const body = await readBody(res);
    if (body === null) throw new ApiError('Réponse du serveur illisible. Réessayez.', res.status, 'INVALID_RESPONSE', null);
    return body as T;
}

/** Envoi JSON (POST, PATCH, DELETE) d'une route. */
export function sendJson<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: unknown): Promise<T> {
    return fetchJson<T>(url, {
        method,
        headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    });
}

/** Message affichable d'une erreur quelconque. */
export function errorMessage(err: unknown, fallback = 'Une erreur est survenue. Réessayez.'): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}
