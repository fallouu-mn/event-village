/**
 * Lot 7 — alignement d'une rafale sur une fenêtre de quota (contrat, section 12, ligne INFRA ; D37 ; T0).
 *
 * Les quotas de quota_reserve (20261031000011_lot1c9_quotas.sql:64) comptent par fenêtres FIXES alignées
 * sur l'époque, à l'horloge de la base : début = floor(epoch(now()) / window_secs) * window_secs. Une
 * rafale qui chevauche deux fenêtres voit son compteur repartir de zéro au milieu : le n-ième appel passe
 * alors qu'il devait être refusé (test 4.9 instable, run 70 : 4e scan 200 au lieu de 429).
 *
 * alignQuotaWindow(windowSecs, neededMs) lit l'horloge de la base et, s'il reste moins de `neededMs` dans
 * la fenêtre courante, attend le début de la suivante (attente réelle prévue par le contrat, au plus une
 * fenêtre). assertSameQuotaWindow(win, what) vérifie ensuite, à l'horloge de la base, que la rafale est
 * restée dans la fenêtre annoncée : sinon le test échoue en le disant (jamais un faux 200 ou un faux 429).
 * Les limites et les assertions des tests ne changent pas.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';

/** Fenêtre de quota courante, lue à l'horloge de la base. */
export interface QuotaWindow {
    /** Durée de la fenêtre en secondes (la même que la règle de quota visée). */
    windowSecs: number;
    /** Indice de la fenêtre : floor(epoch / windowSecs). */
    index: number;
    /** Début de la fenêtre (inclus). */
    startsAt: Date;
    /** Fin de la fenêtre (exclue). */
    endsAt: Date;
    /** Heure de la base au moment de la lecture (après l'attente éventuelle). */
    dbNow: Date;
    /** Temps restant dans la fenêtre au moment de la lecture, en millisecondes. */
    remainingMs: number;
    /** Attente réelle effectuée pour atteindre une fenêtre assez longue (0 : aucune). */
    waitedMs: number;
}

/** Heure de la base locale en millisecondes depuis l'époque (clock_timestamp(), pas now() d'une transaction). */
export async function dbClockMs(): Promise<number> {
    return inspect(async (c) => {
        const { rows } = await c.query<{ ms: string }>(`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text AS ms`);
        const ms = Number(rows[0]?.ms);
        assert.ok(Number.isFinite(ms) && ms > 0, `horloge de la base illisible (${JSON.stringify(rows)})`);
        return ms;
    });
}

function windowAt(windowSecs: number, nowMs: number, waitedMs: number): QuotaWindow {
    const span = windowSecs * 1000;
    const index = Math.floor(nowMs / span);
    const startsAt = new Date(index * span);
    const endsAt = new Date((index + 1) * span);
    return { windowSecs, index, startsAt, endsAt, dbNow: new Date(nowMs), remainingMs: endsAt.getTime() - nowMs, waitedMs };
}

/** Fenêtre courante de `windowSecs` secondes à l'horloge de la base, sans attente. */
export async function currentQuotaWindow(windowSecs: number): Promise<QuotaWindow> {
    assert.ok(Number.isInteger(windowSecs) && windowSecs > 0, `fenêtre de quota invalide : ${windowSecs}`);
    return windowAt(windowSecs, await dbClockMs(), 0);
}

/**
 * Garantit qu'il reste au moins `neededMs` dans la fenêtre courante de `windowSecs` secondes (horloge de la
 * base) : sinon attend le début de la fenêtre suivante (+ 50 ms de marge), puis relit l'horloge. Renvoie la
 * fenêtre dans laquelle la rafale doit tenir. `neededMs` doit être inférieur à la durée de la fenêtre.
 */
export async function alignQuotaWindow(windowSecs: number, neededMs: number): Promise<QuotaWindow> {
    assert.ok(Number.isInteger(windowSecs) && windowSecs > 0, `alignQuotaWindow : fenêtre invalide (${windowSecs} s)`);
    assert.ok(Number.isFinite(neededMs) && neededMs > 0 && neededMs < windowSecs * 1000,
        `alignQuotaWindow : durée de rafale ${neededMs} ms impossible dans une fenêtre de ${windowSecs} s`);
    let waitedMs = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
        const win = windowAt(windowSecs, await dbClockMs(), waitedMs);
        if (win.remainingMs >= neededMs) return win;
        const pause = win.remainingMs + 50;
        await new Promise((resolve) => setTimeout(resolve, pause));
        waitedMs += pause;
    }
    return assert.fail(`alignQuotaWindow : aucune fenêtre de ${windowSecs} s avec ${neededMs} ms disponibles après ${waitedMs} ms d'attente (horloge de la base instable ?)`);
}

/**
 * À appeler juste après la rafale : l'horloge de la base est toujours dans la fenêtre `win`. Comme chaque
 * appel de la rafale a été compté entre l'alignement et cette lecture, tous l'ont été dans la même fenêtre.
 * Sinon : échec explicite (rafale trop lente pour la fenêtre), avant toute assertion sur les statuts.
 */
export async function assertSameQuotaWindow(win: QuotaWindow, what: string): Promise<QuotaWindow> {
    const now = windowAt(win.windowSecs, await dbClockMs(), 0);
    assert.equal(now.index, win.index,
        `${what} : premier et dernier appel hors de la même fenêtre de ${win.windowSecs} s (fenêtre ${win.startsAt.toISOString()} → ${win.endsAt.toISOString()}, ` +
        `heure de la base après la rafale ${now.dbNow.toISOString()}) : rafale trop lente, le compteur du quota est reparti de zéro ; résultat non concluant`);
    return now;
}
