/**
 * Design 1b (lot PERF) — module PUR de la mesure de performance mobile (scripts/e2e/perf-mobile.mjs) : seuils, médiane,
 * CLS par fenêtres de session, verdicts par page et pour le toucher, lignes TSV et rapport lisible. Aucun accès au
 * réseau, au disque ni au navigateur : testé sans base par tests/schema/design1b-perf-mobile.test.ts.
 *
 * Règles (texte de l'utilisateur : « Lighthouse mobile ≥ 90 sur accueil, fiche et Mes billets ; affichage principal
 * < 2,5 s et aucun saut de mise en page (CLS < 0,1) sur un Android moyen en 4G simulée ; réaction au toucher < 200 ms ») :
 *  - par page, 3 passages Lighthouse (préréglage mobile par défaut) : MÉDIANE du score ≥ 90, médiane du LCP < 2 500 ms,
 *    médiane du CLS < 0,1 ;
 *  - par page, 3 chargements réels (Playwright, 4G simulée par CDP et processeur ×4) : médiane du CLS mesuré
 *    (PerformanceObserver « layout-shift », sans les décalages qui suivent une saisie) < 0,1 ;
 *  - toucher : la PLUS LONGUE interaction (API Event Timing) < 200 ms, et la plus longue mesure témoin (de l'appui à
 *    l'image qui suit le clic) < 200 ms ;
 *  - un passage en erreur est écarté ; il faut au moins MIN_PASSAGES_VALIDES passages valides par mesure, sinon la
 *    mesure est HORS SEUIL (« mesure manquante »). Une page « Mes billets » qui finit ailleurs (page de connexion)
 *    est une erreur FATALE : toute la page est HORS SEUIL, quels que soient les autres passages.
 */

export const SEUILS = Object.freeze({
    /** Score Lighthouse « performance » (0-100), minimum inclus. */
    score: 90,
    /** Largest Contentful Paint, maximum exclu (ms). */
    lcpMs: 2_500,
    /** Cumulative Layout Shift, maximum exclu. */
    cls: 0.1,
    /** Durée d'une interaction (toucher), maximum exclu (ms). */
    toucherMs: 200,
});

export const PASSAGES = 3;
export const MIN_PASSAGES_VALIDES = 2;

/** Médiane (moyenne des deux valeurs centrales si le nombre est pair) ; null si aucune valeur finie. */
export function median(values) {
    const v = (values ?? []).filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * CLS selon la définition de web.dev : décalages regroupés en fenêtres de session (au plus 1 s entre deux décalages,
 * 5 s par fenêtre), valeur de la PIRE fenêtre. Les décalages qui suivent une saisie (hadRecentInput) sont ignorés.
 * @param {Array<{ startTime: number, value: number, hadRecentInput?: boolean }>} entries
 */
export function clsSessionWindows(entries) {
    const shifts = (entries ?? [])
        .filter((e) => e && !e.hadRecentInput && Number.isFinite(e.value) && Number.isFinite(e.startTime))
        .sort((a, b) => a.startTime - b.startTime);
    let worst = 0;
    let current = 0;
    let first = null;
    let last = null;
    for (const e of shifts) {
        if (first !== null && e.startTime - last < 1_000 && e.startTime - first < 5_000) {
            current += e.value;
        } else {
            current = e.value;
            first = e.startTime;
        }
        last = e.startTime;
        if (current > worst) worst = current;
    }
    return worst;
}

/** Pathname attendu pour une URL finale (ex. « /tickets ») ; false si l'URL est illisible. */
export function finalPathMatches(finalUrl, expectedPath) {
    try {
        return new URL(finalUrl).pathname.replace(/\/+$/, '') === expectedPath.replace(/\/+$/, '');
    } catch {
        return false;
    }
}

// ── Mise en forme (français) ──────────────────────────────────────────────────

const frNumber = (n, digits) => n.toFixed(digits).replace('.', ',');

export function fmtMs(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
    return ms >= 1_000 ? `${frNumber(ms / 1_000, 2)} s` : `${Math.round(ms)} ms`;
}

export function fmtCls(v) {
    return v === null || v === undefined || !Number.isFinite(v) ? '—' : frNumber(v, 3);
}

export function fmtBytes(o) {
    if (o === null || o === undefined || !Number.isFinite(o)) return '—';
    return o >= 1_000_000 ? `${frNumber(o / 1_000_000, 2)} Mo` : `${frNumber(o / 1_000, 1)} Ko`;
}

// ── Verdicts ──────────────────────────────────────────────────────────────────

/**
 * Une mesure : valeur médiane comparée au seuil.
 * @param {{ nom: string, valeurs: Array<number|null>, seuil: number, sens: 'min'|'max', format: (v: number) => string }} p
 */
export function mesure({ nom, valeurs, seuil, sens, format }) {
    const valides = (valeurs ?? []).filter((x) => typeof x === 'number' && Number.isFinite(x));
    const valeur = valides.length >= MIN_PASSAGES_VALIDES ? median(valides) : null;
    const ok = valeur !== null && (sens === 'min' ? valeur >= seuil : valeur < seuil);
    const borne = `${sens === 'min' ? '≥' : '<'} ${format(seuil)}`;
    const detail = valeur === null
        ? `mesure manquante (${valides.length} passage(s) valide(s) sur ${valeurs?.length ?? 0}, ${MIN_PASSAGES_VALIDES} au moins)`
        : `médiane ${format(valeur)} sur ${valides.length} passage(s) [${valides.map(format).join(' ; ')}]`;
    return { nom, valeur, seuil, ok, texte: `${ok ? 'OK' : 'HORS SEUIL'} — ${nom} : ${detail} (seuil ${borne})` };
}

/**
 * Verdict d'une page.
 * @param {{
 *   id: string, libelle: string,
 *   lighthouse: Array<{ score: number|null, lcp: number|null, cls: number|null, error?: string|null }>,
 *   reel: Array<{ cls: number|null, error?: string|null }>,
 *   fatal?: string|null,
 * }} page
 */
export function verdictPage(page) {
    const lh = (page.lighthouse ?? []).filter((p) => !p.error);
    const reel = (page.reel ?? []).filter((p) => !p.error);
    const mesures = [
        mesure({ nom: 'score Lighthouse mobile', valeurs: lh.map((p) => p.score), seuil: SEUILS.score, sens: 'min', format: (v) => String(Math.round(v)) }),
        mesure({ nom: 'affichage principal (LCP, Lighthouse)', valeurs: lh.map((p) => p.lcp), seuil: SEUILS.lcpMs, sens: 'max', format: fmtMs }),
        mesure({ nom: 'sauts de mise en page (CLS, Lighthouse)', valeurs: lh.map((p) => p.cls), seuil: SEUILS.cls, sens: 'max', format: fmtCls }),
        mesure({ nom: 'sauts de mise en page (CLS mesuré, 4G simulée, processeur ×4)', valeurs: reel.map((p) => p.cls), seuil: SEUILS.cls, sens: 'max', format: fmtCls }),
    ];
    const erreurs = [
        ...(page.lighthouse ?? []).map((p, i) => (p.error ? `Lighthouse passage ${i + 1} : ${p.error}` : null)),
        ...(page.reel ?? []).map((p, i) => (p.error ? `chargement réel ${i + 1} : ${p.error}` : null)),
    ].filter(Boolean);
    const fatal = page.fatal ?? null;
    return { id: page.id, libelle: page.libelle, mesures, erreurs, fatal, ok: !fatal && mesures.every((m) => m.ok) };
}

/**
 * Verdict du toucher : la plus longue interaction (Event Timing) et la plus longue mesure témoin < 200 ms.
 * Un toucher non reçu (aucun clic vu par la page) ou en erreur fait échouer le verdict.
 * @param {Array<{ page: string, cible: string, eventTimingMs: number|null, temoinMs: number|null, error?: string|null }>} touches
 * @param {string[]} [fatals] pages où rien n'a pu être touché
 */
export function verdictToucher(touches, fatals = []) {
    const list = touches ?? [];
    const erreurs = [...fatals, ...list.filter((t) => t.error).map((t) => `${t.page} (${t.cible}) : ${t.error}`)];
    const valides = list.filter((t) => !t.error);
    const et = valides.map((t) => t.eventTimingMs ?? 0);
    const temoin = valides.map((t) => t.temoinMs).filter((v) => typeof v === 'number' && Number.isFinite(v));
    const maxEt = et.length ? Math.max(...et) : null;
    const maxTemoin = temoin.length ? Math.max(...temoin) : null;
    const okEt = maxEt !== null && maxEt < SEUILS.toucherMs;
    const okTemoin = maxTemoin !== null && maxTemoin < SEUILS.toucherMs;
    const ok = valides.length > 0 && erreurs.length === 0 && okEt && okTemoin;
    const textes = [
        `${okEt && erreurs.length === 0 ? 'OK' : 'HORS SEUIL'} — réaction au toucher (Event Timing, la plus longue sur ${valides.length} toucher(s)) : `
            + `${maxEt === null ? 'aucune mesure' : maxEt === 0 ? 'moins de 16 ms (aucune interaction au-dessus de 16 ms)' : fmtMs(maxEt)} (seuil < ${fmtMs(SEUILS.toucherMs)})`,
        `${okTemoin && erreurs.length === 0 ? 'OK' : 'HORS SEUIL'} — réaction au toucher (mesure témoin : de l'appui à l'image qui suit le clic) : `
            + `${maxTemoin === null ? 'aucune mesure' : fmtMs(maxTemoin)} (seuil < ${fmtMs(SEUILS.toucherMs)})`,
    ];
    return { ok, maxEventTimingMs: maxEt, maxTemoinMs: maxTemoin, erreurs, textes };
}

// ── Sorties ───────────────────────────────────────────────────────────────────

export const TSV_HEADER = [
    'page', 'passage', 'score', 'lcp_ms', 'cls', 'tbt_ms', 'fcp_ms', 'speed_index_ms', 'poids_o', 'url_finale',
    'cls_reel', 'lcp_reel_ms', 'erreur',
].join('\t');

const cell = (v, digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '' : digits ? v.toFixed(digits) : String(Math.round(v)));
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');

/**
 * Lignes TSV d'une page : une par passage (Lighthouse i et chargement réel i côte à côte), puis la médiane.
 * @param {string} id
 * @param {Array<{ score?: number|null, lcp?: number|null, cls?: number|null, tbt?: number|null, fcp?: number|null, si?: number|null, bytes?: number|null, finalUrl?: string|null, error?: string|null }>} lighthouse
 * @param {Array<{ cls?: number|null, lcp?: number|null, error?: string|null }>} reel
 */
export function tsvRows(id, lighthouse, reel) {
    const n = Math.max(lighthouse.length, reel.length);
    const rows = [];
    for (let i = 0; i < n; i++) {
        const l = lighthouse[i] ?? {};
        const r = reel[i] ?? {};
        const err = [l.error ? `lighthouse : ${l.error}` : '', r.error ? `réel : ${r.error}` : ''].filter(Boolean).join(' | ');
        rows.push([id, String(i + 1), cell(l.score), cell(l.lcp), cell(l.cls, 4), cell(l.tbt), cell(l.fcp), cell(l.si), cell(l.bytes), clean(l.finalUrl),
            cell(r.cls, 4), cell(r.lcp), clean(err)].join('\t'));
    }
    const okL = lighthouse.filter((p) => !p.error);
    const okR = reel.filter((p) => !p.error);
    const med = (arr, k) => median(arr.map((p) => p[k]));
    rows.push([id, 'mediane', cell(med(okL, 'score')), cell(med(okL, 'lcp')), cell(med(okL, 'cls'), 4), cell(med(okL, 'tbt')), cell(med(okL, 'fcp')),
        cell(med(okL, 'si')), cell(med(okL, 'bytes')), '', cell(med(okR, 'cls'), 4), cell(med(okR, 'lcp')), ''].join('\t'));
    return rows;
}

export const TOUCHER_TSV_HEADER = ['page', 'toucher', 'cible', 'event_timing_ms', 'temoin_ms', 'etat_change', 'erreur'].join('\t');

export function toucherRows(touches) {
    return (touches ?? []).map((t, i) => [clean(t.page), String(i + 1), clean(t.cible), cell(t.eventTimingMs), cell(t.temoinMs),
        t.etatChange === undefined || t.etatChange === null ? '' : t.etatChange ? 'oui' : 'non', clean(t.error)].join('\t'));
}

/**
 * Rapport lisible (perf/lighthouse.txt).
 * @param {{ pages: Array<ReturnType<typeof verdictPage> & { details?: string[] }>, toucher: ReturnType<typeof verdictToucher>, entete?: string[], notes?: string[] }} p
 */
export function texteRapport({ pages, toucher, entete = [], notes = [] }) {
    const ok = pages.every((p) => p.ok) && toucher.ok;
    const lignes = [
        'Performance mobile mesurée (design 1b, lot PERF) — scripts/e2e/perf-mobile.mjs',
        ...entete,
        `Seuils : score ≥ ${SEUILS.score} ; LCP < ${fmtMs(SEUILS.lcpMs)} ; CLS < ${fmtCls(SEUILS.cls)} ; toucher < ${fmtMs(SEUILS.toucherMs)} `
            + `(médiane de ${PASSAGES} passages par page, au moins ${MIN_PASSAGES_VALIDES} valides ; toucher : la plus longue).`,
        '',
    ];
    for (const p of pages) {
        lignes.push(`${p.ok ? 'OK' : 'HORS SEUIL'} — ${p.libelle}`);
        if (p.fatal) lignes.push(`  HORS SEUIL — ${p.fatal}`);
        for (const m of p.mesures) lignes.push(`  ${m.texte}`);
        for (const d of p.details ?? []) lignes.push(`  · ${d}`);
        for (const e of p.erreurs) lignes.push(`  ! ${e}`);
        lignes.push('');
    }
    lignes.push(`${toucher.ok ? 'OK' : 'HORS SEUIL'} — Réaction au toucher`);
    for (const t of toucher.textes) lignes.push(`  ${t}`);
    for (const e of toucher.erreurs) lignes.push(`  ! ${e}`);
    lignes.push('');
    for (const n of notes) lignes.push(n);
    lignes.push(`VERDICT : ${ok ? 'OK — tous les seuils sont tenus' : 'HORS SEUIL — au moins une mesure ne tient pas son seuil (le run est rouge)'}`);
    return { ok, texte: `${lignes.join('\n')}\n` };
}
