#!/usr/bin/env node
/**
 * Lot CI rapide — répartition des suites de tests en lots parallèles (.github/workflows/verify.yml, jobs « tests »).
 *
 * La liste des suites est TOUJOURS celle de `node scripts/run-tests.mjs --list` (même découverte que le run série) ;
 * ce script ne fait que la partager. Chaque lot tourne sur son propre runner, avec sa propre base Supabase locale
 * (mêmes migrations, même seed, mêmes invariants dans les after() des suites), par scripts/run-tests.mjs : même
 * lanceur, même garde-fou, même délai par suite, même ordre « temps réel avant suites lourdes » à l'intérieur du lot.
 *
 * Commandes :
 *   liste                         → la liste complète (une suite par ligne), telle que run-tests.mjs --list la donne
 *   plan <k>/<n> [--graine <g>]   → les suites du lot k sur n (affichage seul)
 *   lot <k>/<n> [--graine <g>]    → exécute le lot k sur n avec scripts/run-tests.mjs (code de sortie du lanceur)
 *   controle <liste> <journal…>   → vérifie que chaque suite de <liste> apparaît EXACTEMENT une fois dans les
 *                                   récapitulatifs des journaux de lots, et en PASS ; imprime le récapitulatif
 *                                   fusionné et le TOTAL au format du run série ; code 1 sinon
 *   durees <journal…>             → réécrit scripts/ci-durees.json à partir des récapitulatifs d'un run
 *
 * Équilibrage : durées mesurées (scripts/ci-durees.json, secondes par suite, run de référence) ; une suite absente
 * du fichier (suite nouvelle) compte pour la médiane. Plus longues d'abord, chacune dans le lot le moins chargé
 * (égalité : plus petit numéro) : la répartition ne dépend que de la liste et des durées, elle est reproductible.
 * Avec --graine g (ligne « ci-lots-graine: g » du commit), la liste est d'abord mélangée par un générateur
 * déterministe et répartie dans cet ordre (et non plus du plus long au plus court) : d'autres voisinages de suites,
 * pour montrer qu'aucune suite ne dépend de celles qui tournent avec elle.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DUREES = path.join(ROOT, 'scripts', 'ci-durees.json');
const TAG = '[ci-lots]';

function fail(message, code = 2) {
    console.error(`${TAG} ${message}`);
    process.exit(code);
}

/** Liste de run-tests.mjs --list : lignes « tests/… », dans l'ordre du lanceur. */
function liste() {
    const r = spawnSync(process.execPath, ['scripts/run-tests.mjs', '--list'], { cwd: ROOT, env: process.env, encoding: 'utf8' });
    if (r.status !== 0) fail(`run-tests.mjs --list a échoué (code ${r.status}) :\n${r.stdout}\n${r.stderr}`);
    const suites = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^tests\/.+\.test\.ts$/.test(l));
    const annonce = Number((r.stdout.match(/^(\d+) suite\(s\)\.$/m) || [])[1]);
    if (!Number.isFinite(annonce) || annonce !== suites.length) fail(`liste illisible : ${suites.length} ligne(s) lue(s), ${annonce} annoncée(s).`);
    if (new Set(suites).size !== suites.length) fail('liste avec doublons.');
    return suites;
}

function lireDurees() {
    if (!fs.existsSync(DUREES)) return {};
    return JSON.parse(fs.readFileSync(DUREES, 'utf8')).suites ?? {};
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function aleatoire(graine) {
    let a = graine >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function repartir(suites, n, graine) {
    const durees = lireDurees();
    const connues = suites.map((s) => durees[s]).filter((d) => typeof d === 'number').sort((a, b) => a - b);
    const mediane = connues.length > 0 ? connues[Math.floor(connues.length / 2)] : 1;
    const poids = (s) => (typeof durees[s] === 'number' ? durees[s] : mediane);
    let ordre;
    if (graine === null) {
        ordre = [...suites].sort((a, b) => poids(b) - poids(a) || a.localeCompare(b));
    } else {
        const r = aleatoire(graine);
        ordre = [...suites];
        for (let i = ordre.length - 1; i > 0; i -= 1) {
            const j = Math.floor(r() * (i + 1));
            [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
        }
    }
    const lots = Array.from({ length: n }, () => ({ suites: [], charge: 0 }));
    for (const s of ordre) {
        let min = 0;
        for (let i = 1; i < n; i += 1) if (lots[i].charge < lots[min].charge) min = i;
        lots[min].suites.push(s);
        lots[min].charge += poids(s);
    }
    // Dans chaque lot : ordre alphabétique de la liste complète (celui du run série) ; run-tests.mjs applique ensuite
    // sa règle « suites lourdes après la dernière suite temps réel » sur les suites du lot.
    const rang = new Map(suites.map((s, i) => [s, i]));
    for (const l of lots) l.suites.sort((a, b) => rang.get(a) - rang.get(b));
    return { lots, mediane, inconnues: suites.filter((s) => typeof durees[s] !== 'number') };
}

function lireLot(arg) {
    const m = /^(\d+)\/(\d+)$/.exec(arg || '');
    if (!m) fail(`lot attendu sous la forme k/n (reçu : ${arg ?? '<rien>'}).`);
    const [k, n] = [Number(m[1]), Number(m[2])];
    if (n < 1 || k < 1 || k > n) fail(`lot ${arg} hors bornes.`);
    return { k, n };
}

function lireGraine(args) {
    const i = args.indexOf('--graine');
    if (i < 0) return null;
    const g = Number(args[i + 1]);
    if (!Number.isInteger(g) || g < 0) fail(`--graine attend un entier positif (reçu : ${args[i + 1]}).`);
    return g;
}

/** Lignes du récapitulatif de run-tests.mjs : « tests/… STATUT durée code journal ». */
function recapitulatif(journal) {
    const texte = fs.readFileSync(journal, 'utf8');
    const debut = texte.lastIndexOf('═══ RÉCAPITULATIF ═══');
    if (debut < 0) return null;
    const lignes = [];
    for (const l of texte.slice(debut).split(/\r?\n/)) {
        const m = /^(tests\/\S+\.test\.ts)\s+(PASS|FAIL|TIMEOUT)\s+(\S+)\s+(\S+)\s+(\S+)/.exec(l);
        if (m) lignes.push({ suite: m[1], statut: m[2], duree: m[3], code: m[4], journal: m[5], brut: l });
    }
    return lignes;
}

function enSecondes(d) {
    return d.endsWith('ms') ? Number(d.slice(0, -2)) / 1000 : Number(d.slice(0, -1));
}

const [commande, ...args] = process.argv.slice(2);

if (commande === 'liste') {
    for (const s of liste()) console.log(s);
} else if (commande === 'plan' || commande === 'lot') {
    const { k, n } = lireLot(args[0]);
    const graine = lireGraine(args);
    const suites = liste();
    const { lots, mediane, inconnues } = repartir(suites, n, graine);
    const lot = lots[k - 1];
    console.log(`${TAG} ${suites.length} suite(s) en ${n} lot(s)${graine === null ? ' (équilibrés par durée)' : ` (mélange, graine ${graine})`} ; durées : scripts/ci-durees.json`);
    if (inconnues.length > 0) console.log(`${TAG} ${inconnues.length} suite(s) sans durée mesurée, comptée(s) ${mediane} s : ${inconnues.join(', ')}`);
    console.log(`${TAG} charges estimées : ${lots.map((l, i) => `lot ${i + 1} ${Math.round(l.charge)} s (${l.suites.length})`).join(' · ')}`);
    console.log(`${TAG} lot ${k}/${n} : ${lot.suites.length} suite(s)`);
    if (commande === 'plan') {
        for (const s of lot.suites) console.log(s);
        process.exit(0);
    }
    if (lot.suites.length === 0) fail(`lot ${k}/${n} vide.`, 1);
    const r = spawnSync(process.execPath, ['scripts/run-tests.mjs', ...lot.suites], { cwd: ROOT, env: process.env, stdio: 'inherit' });
    process.exit(r.status ?? 1);
} else if (commande === 'controle') {
    const [fichierListe, ...journaux] = args;
    if (!fichierListe || journaux.length === 0) fail('usage : controle <liste> <journal de lot…>');
    const attendues = fs.readFileSync(fichierListe, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const vues = new Map();
    const problemes = [];
    for (const j of journaux) {
        if (!fs.existsSync(j)) {
            problemes.push(`journal absent : ${j}`);
            continue;
        }
        const r = recapitulatif(j);
        if (r === null) {
            problemes.push(`aucun récapitulatif dans ${j} (lot interrompu ?)`);
            continue;
        }
        for (const l of r) {
            if (vues.has(l.suite)) problemes.push(`suite exécutée deux fois : ${l.suite} (${vues.get(l.suite).lot} et ${j})`);
            vues.set(l.suite, { ...l, lot: j });
        }
    }
    const manquantes = attendues.filter((s) => !vues.has(s));
    const enTrop = [...vues.keys()].filter((s) => !attendues.includes(s));
    for (const s of manquantes) problemes.push(`suite non exécutée : ${s}`);
    for (const s of enTrop) problemes.push(`suite hors liste : ${s}`);
    const resultats = attendues.filter((s) => vues.has(s)).map((s) => vues.get(s));
    const compte = { PASS: 0, FAIL: 0, TIMEOUT: 0 };
    for (const r of resultats) compte[r.statut] += 1;
    const largeur = Math.max(...attendues.map((s) => s.length), 10);
    console.log('\n\n═══════════════════ RÉCAPITULATIF ═══════════════════');
    console.log(`${'Suite'.padEnd(largeur)}  Statut   Durée     Code  Journal`);
    for (const r of resultats) console.log(`${r.suite.padEnd(largeur)}  ${r.statut.padEnd(8)} ${r.duree.padEnd(9)} ${r.code.padEnd(5)} ${r.journal}`);
    console.log('──────────────────────────────────────────────────────');
    console.log(`TOTAL : ${resultats.length} suite(s) — ${compte.PASS} réussie(s), ${compte.FAIL} en échec, ${compte.TIMEOUT} expirée(s)`);
    console.log(`${TAG} contrôle : ${attendues.length} suite(s) attendue(s) (run-tests.mjs --list), ${vues.size} exécutée(s) dans ${journaux.length} lot(s)`);
    for (const p of problemes) console.log(`${TAG} PROBLÈME : ${p}`);
    const ok = problemes.length === 0 && compte.FAIL + compte.TIMEOUT === 0;
    console.log(`${TAG} contrôle ${ok ? 'OK' : 'EN ÉCHEC'}`);
    process.exit(ok ? 0 : 1);
} else if (commande === 'durees') {
    if (args.length === 0) fail('usage : durees <journal…>');
    const suites = {};
    for (const j of args) for (const l of recapitulatif(j) ?? []) suites[l.suite] = Math.round(enSecondes(l.duree) * 10) / 10;
    const trie = Object.fromEntries(Object.entries(suites).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(DUREES, `${JSON.stringify({ source: args.map((a) => path.basename(a)).join(', '), suites: trie }, null, 2)}\n`);
    console.log(`${TAG} ${Object.keys(trie).length} durée(s) écrite(s) dans scripts/ci-durees.json`);
} else {
    fail('commande attendue : liste | plan k/n | lot k/n | controle <liste> <journaux…> | durees <journaux…>');
}
