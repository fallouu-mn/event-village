/**
 * Design 1e (décision du 21/11, run complet 561) — lecture d'une requête du navigateur (tailles, en-têtes, corps…) qui ne
 * casse jamais le test ni le navigateur.
 *
 * Run 561 : e2e/perf.spec.ts poussait chaque `req.sizes()` dans une liste sans gestionnaire d'erreur et ne l'attendait que
 * plus tard. Une réponse arrivée pendant la fermeture de la page laissait une promesse rejetée sans gestionnaire
 * (« request.sizes: Target page, context or browser has been closed ») : le test échouait, puis la passe suivante ne
 * pouvait plus ouvrir de contexte.
 *
 * Règle : la promesse rendue ne rejette JAMAIS (aucun rejet non géré, même si personne ne l'attend).
 *  - page, contexte ou navigateur déjà fermés → `{ ignored: true }` : seule cette requête est ignorée ;
 *  - toute autre erreur → `{ error }` : gardée, à l'appelant de la faire échouer (rien n'est caché) ;
 *  - sinon → `{ value }`.
 */
export type RequestRead<T> = { value: T } | { ignored: true; reason: string } | { error: unknown };

/** Erreur de Playwright quand la page, le contexte ou le navigateur sont fermés avant la fin de la lecture. */
export const TARGET_CLOSED_RE = /Target page, context or browser has been closed|Target closed|Browser has been closed|has been closed/i;

export function isTargetClosed(err: unknown): boolean {
    return TARGET_CLOSED_RE.test(err instanceof Error ? err.message : String(err));
}

export function readRequest<T>(read: () => Promise<T>): Promise<RequestRead<T>> {
    let pending: Promise<T>;
    try {
        pending = read();
    } catch (err) {
        return Promise.resolve(isTargetClosed(err) ? { ignored: true as const, reason: firstLine(err) } : { error: err });
    }
    return pending.then(
        (value) => ({ value }),
        (err: unknown) => (isTargetClosed(err) ? { ignored: true as const, reason: firstLine(err) } : { error: err }),
    );
}

/**
 * Somme des valeurs lues : requêtes ignorées (page fermée) laissées de côté et comptées ; la première autre erreur est
 * relancée (la mesure échoue comme avant, sans rien masquer).
 */
export async function sumReads(reads: Array<Promise<RequestRead<number>>>): Promise<{ total: number; ignored: number }> {
    let total = 0;
    let ignored = 0;
    for (const r of await Promise.all(reads)) {
        if ('value' in r) total += r.value;
        else if ('ignored' in r) ignored += 1;
        else throw r.error instanceof Error ? r.error : new Error(String(r.error));
    }
    return { total, ignored };
}

function firstLine(err: unknown): string {
    return (err instanceof Error ? err.message : String(err)).split('\n')[0];
}
