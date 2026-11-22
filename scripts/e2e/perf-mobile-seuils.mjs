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

/** Décision du 18/11 (oscillation de ± 5 au run 417, ralentissement calibré) : médiane de 5 passages, seuils inchangés. */
export const PASSAGES = 5;

/**
 * Décision du 18/11 — téléphone de référence de Lighthouse : le préréglage mobile ralentit le processeur ×4 pour un poste
 * d'indice de puissance ≈ 2 000 (Lighthouse, docs/throttling.md « calibrating multipliers » ; il avertit sous 1 000,
 * « environ deux fois plus faible que la cible »). Le runner de la CI varie (indices 1 996 à 3 571 aux runs 385 à 401,
 * même code : scores 94 → 87) ; le ralentissement est donc recalculé à chaque tour sur l'indice mesuré, pour viser le
 * même téléphone : ×4 × indice / 2 000, borné entre ×1 et ×16. Seuils inchangés.
 */
export const REFERENCE_CPU = Object.freeze({ benchmarkIndex: 2000, multiplier: 4 });

/** Décision du 18/11 : tâches du fil principal de la page comptées comme style et mise en page, ou comme peinture et composition. */
const STYLE_EVENTS = new Set(['UpdateLayoutTree', 'RecalculateStyles', 'Layout']);
const PAINT_EVENTS = new Set(['Paint', 'PrePaint', 'Layerize', 'UpdateLayer', 'UpdateLayerTree', 'CompositeLayers', 'PaintImage', 'Commit']);

/** Somme (ms) des tâches de style et de peinture du fil principal des pages, dans une trace du navigateur. */
export function renderWorkFromTrace(trace) {
    const events = Array.isArray(trace) ? trace : (trace?.traceEvents ?? []);
    const main = new Set(events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`));
    let style = 0;
    let paint = 0;
    for (const e of events) {
        if (e.ph !== 'X' || !Number.isFinite(e.dur) || !main.has(`${e.pid}:${e.tid}`)) continue;
        if (STYLE_EVENTS.has(e.name)) style += e.dur / 1000;
        else if (PAINT_EVENTS.has(e.name)) paint += e.dur / 1000;
    }
    return { styleMs: Math.round(style), paintMs: Math.round(paint) };
}

/** Ralentissement du processeur pour un indice de puissance mesuré (indice illisible : ×4, le préréglage). */
export function calibratedCpuMultiplier(benchmarkIndex) {
    if (!Number.isFinite(benchmarkIndex) || benchmarkIndex <= 0) return REFERENCE_CPU.multiplier;
    const m = (REFERENCE_CPU.multiplier * benchmarkIndex) / REFERENCE_CPU.benchmarkIndex;
    return Math.round(Math.min(16, Math.max(1, m)) * 100) / 100;
}
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

// ── Finition 5 : mesure fiable (mesure « faussée », refaite dans le même job) ─────────────────────────────────

/**
 * Finition 5 (consigne du 22/11) : une tentative de mesure Lighthouse (5 tours, calibration à chaque tour) est FAUSSÉE
 * quand un tour au moins sort de la plage du téléphone de référence :
 *  - ralentissement calculé au-delà de ×6 (machine de CI trop rapide : runs 449, 455, 536, 544, 585, ×6,8 à ×7,4, pages
 *    non touchées sous 90) ;
 *  - indice de puissance hors de la plage habituelle [1 000 ; 3 000] (sous 1 000, Lighthouse avertit lui-même qu'il est
 *    « environ deux fois plus faible que la cible » ; au-dessus de 3 000, le ralentissement dépasse ×6) ;
 *  - indice illisible (calibration en erreur : ralentissement par défaut, non calibré).
 * Une tentative faussée est refaite dans le même job, au plus `reprisesMax` fois. Seuils, calibration (×4 pour 2 000)
 * et médiane de 5 inchangés : seule la décision de refaire et le texte du verdict sont ajoutés.
 */
export const MESURE_FIABLE = Object.freeze({ ralentissementMax: 6, indiceMin: 1_000, indiceMax: 3_000, reprisesMax: 2 });

/**
 * Causes de la mesure faussée pour une liste de tours de calibration (vide : tentative valide). `sens` : « rapide »
 * (machine plus rapide que prévu : la mesure est PLUS sévère que la référence), « lent » ou « illisible » (mesure plus
 * indulgente ou non calibrée : un résultat dans les seuils n'est pas fiable non plus).
 * @param {Array<{ tour: number, benchmarkIndex: number|null, multiplier: number }>} calibrations
 */
export function causesMesureFaussee(calibrations) {
    const causes = [];
    for (const c of calibrations ?? []) {
        const i = c?.benchmarkIndex;
        const tour = `tour ${c?.tour ?? '?'}`;
        if (!Number.isFinite(i) || i <= 0) {
            causes.push({ tour: c?.tour ?? null, sens: 'illisible', texte: `${tour} : indice de puissance illisible (ralentissement non calibré ×${c?.multiplier ?? '?'})` });
            continue;
        }
        const indice = String(Math.round(i));
        const ralenti = `×${frNumber(c.multiplier, 2)}`;
        if (c.multiplier > MESURE_FIABLE.ralentissementMax || i > MESURE_FIABLE.indiceMax) {
            causes.push({ tour: c.tour, sens: 'rapide', texte: `${tour} : machine trop rapide, indice ${indice} → ralentissement ${ralenti} (plage habituelle : indice ${MESURE_FIABLE.indiceMin} à ${MESURE_FIABLE.indiceMax}, ralentissement ×${MESURE_FIABLE.ralentissementMax} au plus)` });
        } else if (i < MESURE_FIABLE.indiceMin) {
            causes.push({ tour: c.tour, sens: 'lent', texte: `${tour} : machine trop lente, indice ${indice} → ralentissement ${ralenti} (plage habituelle : indice ${MESURE_FIABLE.indiceMin} à ${MESURE_FIABLE.indiceMax})` });
        }
    }
    return causes;
}

/**
 * Les trois mesures Lighthouse d'une page (score, LCP, CLS), seules touchées par la calibration ; le CLS mesuré et le
 * toucher tournent avec un ralentissement fixe ×4 et ne dépendent pas de la tentative.
 */
export function lighthouseOk(page) {
    if (page?.fatal) return false;
    return verdictPage({ ...page, reel: [] }).mesures.slice(0, 3).every((m) => m.ok);
}

/**
 * Décision après une tentative : faussée ou non, et faut-il la refaire. Une tentative faussée dont TOUTES les causes
 * sont « machine trop rapide » et dont toutes les pages tiennent les seuils n'est pas refaite (mesure plus sévère que
 * la référence, seuils tenus quand même) ; toute autre tentative faussée est refaite tant qu'il reste des reprises.
 * @param {{ numero: number, calibrations: Array<{ tour: number, benchmarkIndex: number|null, multiplier: number }>, pagesOk: boolean }} t
 */
export function decisionTentative({ numero, calibrations, pagesOk }) {
    const causes = causesMesureFaussee(calibrations);
    const faussee = causes.length > 0;
    const acceptee = !faussee || (pagesOk && causes.every((c) => c.sens === 'rapide'));
    const reste = MESURE_FIABLE.reprisesMax + 1 - numero;
    return { numero, faussee, causes, acceptee, refaire: !acceptee && reste > 0 };
}

/**
 * Verdict final de la mesure : « OK », « HORS SEUIL » ou « FAUSSÉE » (à relancer). FAUSSÉE seulement quand la dernière
 * tentative reste faussée et non acceptée ET que rien d'autre ne fait échouer la mesure : un CLS mesuré, un toucher ou
 * une erreur fatale hors seuil (indépendants de la calibration) reste un vrai HORS SEUIL.
 * @param {{ pages: Array<ReturnType<typeof verdictPage>>, lighthousePages: boolean[], toucher: { ok: boolean }, derniere: ReturnType<typeof decisionTentative>|null }} p
 */
export function etatFinal({ pages, lighthousePages, toucher, derniere }) {
    if (pages.every((p) => p.ok) && toucher.ok) return 'OK';
    const horsCalibration = !toucher.ok || pages.some((p) => p.fatal || !p.mesures.slice(3).every((m) => m.ok));
    if (!horsCalibration && derniere && derniere.faussee && !derniere.acceptee && lighthousePages.some((ok) => !ok)) return 'FAUSSÉE';
    return 'HORS SEUIL';
}

export const TENTATIVES_TSV_HEADER = ['tentative', 'tour', 'indice_puissance', 'ralentissement_cpu', 'etat_tour', 'cause', 'scores', 'decision'].join('\t');

/**
 * Journal de toutes les tentatives (perf/tentatives.tsv) : une ligne par tour de calibration de chaque tentative, avec
 * les scores Lighthouse des pages de ce tour et la décision prise à la fin de la tentative.
 * @param {Array<{ decision: ReturnType<typeof decisionTentative>, calibrations: Array<{ tour: number, benchmarkIndex: number|null, multiplier: number }>, scores: Record<string, Array<number|null>> }>} tentatives
 */
export function tentativesRows(tentatives) {
    const rows = [];
    for (const t of tentatives ?? []) {
        const d = t.decision;
        const decision = !d.faussee ? 'valide' : d.acceptee ? 'faussée mais acceptée (machine trop rapide, seuils tenus)' : d.refaire ? 'faussée : refaite'
            : d.sansTemps ? 'faussée : reprise non lancée (temps insuffisant)' : 'faussée : plus de reprise';
        for (const c of t.calibrations) {
            const cause = d.causes.find((x) => x.tour === c.tour);
            const scores = Object.entries(t.scores ?? {}).map(([id, list]) => `${id} ${list[c.tour - 1] ?? '—'}`).join(' ; ');
            rows.push([String(d.numero), String(c.tour), cell(c.benchmarkIndex), cell(c.multiplier, 2), cause ? 'faussé' : 'valide', clean(cause?.texte ?? ''), clean(scores), decision].join('\t'));
        }
    }
    return rows;
}

// ── Sorties ───────────────────────────────────────────────────────────────────

export const TSV_HEADER = [
    'page', 'passage', 'score', 'lcp_ms', 'cls', 'tbt_ms', 'fcp_ms', 'speed_index_ms', 'poids_o', 'url_finale',
    'cls_reel', 'lcp_reel_ms', 'erreur', 'indice_puissance', 'ralentissement_cpu',
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
            cell(r.cls, 4), cell(r.lcp), clean(err), cell(l.benchmarkIndex), cell(l.cpu, 2)].join('\t'));
    }
    const okL = lighthouse.filter((p) => !p.error);
    const okR = reel.filter((p) => !p.error);
    const med = (arr, k) => median(arr.map((p) => p[k]));
    rows.push([id, 'mediane', cell(med(okL, 'score')), cell(med(okL, 'lcp')), cell(med(okL, 'cls'), 4), cell(med(okL, 'tbt')), cell(med(okL, 'fcp')),
        cell(med(okL, 'si')), cell(med(okL, 'bytes')), '', cell(med(okR, 'cls'), 4), cell(med(okR, 'lcp')), '', cell(med(okL, 'benchmarkIndex')), cell(med(okL, 'cpu'), 2)].join('\t'));
    return rows;
}

export const TOUCHER_TSV_HEADER = ['page', 'toucher', 'cible', 'event_timing_ms', 'temoin_ms', 'etat_change', 'erreur'].join('\t');

export function toucherRows(touches) {
    return (touches ?? []).map((t, i) => [clean(t.page), String(i + 1), clean(t.cible), cell(t.eventTimingMs), cell(t.temoinMs),
        t.etatChange === undefined || t.etatChange === null ? '' : t.etatChange ? 'oui' : 'non', clean(t.error)].join('\t'));
}

/**
 * Rapport lisible (perf/lighthouse.txt).
 * Finition 5 : `etat` (etatFinal : OK, HORS SEUIL ou FAUSSÉE) et `tentatives` (journal des tentatives Lighthouse), facultatifs.
 * @param {{ pages: Array<ReturnType<typeof verdictPage> & { details?: string[] }>, toucher: ReturnType<typeof verdictToucher>, entete?: string[], notes?: string[], etat?: 'OK'|'HORS SEUIL'|'FAUSSÉE'|null, tentatives?: Array<{ decision: ReturnType<typeof decisionTentative> }> }} p
 */
export function texteRapport({ pages, toucher, entete = [], notes = [], etat = null, tentatives = [] }) {
    const ok = pages.every((p) => p.ok) && toucher.ok;
    // Finition 5 : état final fourni par etatFinal (OK, HORS SEUIL ou FAUSSÉE) ; sans lui, comportement d'origine
    const final = etat ?? (ok ? 'OK' : 'HORS SEUIL');
    const lignes = [
        'Performance mobile mesurée (design 1b, lot PERF) — scripts/e2e/perf-mobile.mjs',
        ...(final === 'FAUSSÉE' ? ['MESURE FAUSSÉE, À RELANCER — la machine de la CI est restée hors de la plage du téléphone de référence après toutes les reprises : les scores Lighthouse ci-dessous ne disent rien des pages.'] : []),
        ...entete,
        `Seuils : score ≥ ${SEUILS.score} ; LCP < ${fmtMs(SEUILS.lcpMs)} ; CLS < ${fmtCls(SEUILS.cls)} ; toucher < ${fmtMs(SEUILS.toucherMs)} `
            + `(médiane de ${PASSAGES} passages par page, au moins ${MIN_PASSAGES_VALIDES} valides ; toucher : la plus longue).`,
        '',
    ];
    for (const p of pages) {
        // Mesure faussée : les mesures Lighthouse (3 premières) hors seuil sont écrites « FAUSSÉ », jamais « HORS SEUIL »
        lignes.push(`${p.ok ? 'OK' : final === 'FAUSSÉE' ? 'MESURE FAUSSÉE' : 'HORS SEUIL'} — ${p.libelle}`);
        if (p.fatal) lignes.push(`  HORS SEUIL — ${p.fatal}`);
        p.mesures.forEach((m, i) => lignes.push(`  ${final === 'FAUSSÉE' && i < 3 ? m.texte.replace(/^HORS SEUIL/, 'FAUSSÉ (non concluant)') : m.texte}`));
        for (const d of p.details ?? []) lignes.push(`  · ${d}`);
        for (const e of p.erreurs) lignes.push(`  ! ${e}`);
        lignes.push('');
    }
    lignes.push(`${toucher.ok ? 'OK' : 'HORS SEUIL'} — Réaction au toucher`);
    for (const t of toucher.textes) lignes.push(`  ${t}`);
    for (const e of toucher.erreurs) lignes.push(`  ! ${e}`);
    lignes.push('');
    if (tentatives.length > 0) {
        lignes.push(`Tentatives de la mesure Lighthouse (finition 5 : faussée si un tour sort de la plage, refaite ${MESURE_FIABLE.reprisesMax} fois au plus ; journal perf/tentatives.tsv) :`);
        for (const t of tentatives) {
            const d = t.decision ?? t;
            lignes.push(`  tentative ${d.numero} : ${!d.faussee ? 'valide' : d.acceptee ? 'faussée mais acceptée (machine trop rapide : mesure plus sévère que la référence, seuils tenus)' : d.refaire ? 'FAUSSÉE, refaite'
                : d.sansTemps ? 'FAUSSÉE, reprise non lancée (temps insuffisant dans le délai de l’étape)' : 'FAUSSÉE, plus de reprise'}`);
            for (const c of d.causes) lignes.push(`    · ${c.texte}`);
        }
        lignes.push('');
    }
    for (const n of notes) lignes.push(n);
    lignes.push(`VERDICT : ${final === 'OK' ? 'OK — tous les seuils sont tenus'
        : final === 'FAUSSÉE' ? 'MESURE FAUSSÉE, À RELANCER — aucune conclusion sur les seuils (relancer le job ; ce n’est pas un défaut des pages)'
            : 'HORS SEUIL — au moins une mesure ne tient pas son seuil (le run est rouge)'}`);
    return { ok: final === 'OK', etat: final, texte: `${lignes.join('\n')}\n` };
}
