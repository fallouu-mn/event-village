// [lot 0] Garde-fou anti-base réelle + environnement de test (.env.test, instance locale)
import './helpers/env';
// Lot 7 (7.2, T15) : l'audio du scanner est supprimé (décision du client). Assertions audio retirées
// (oscillateurs, AudioContext simulé, `audio: true`, playAudioFeedback) ; classes de palette brute remplacées
// par les jetons --scan-* ; vibrations du contrat D50 (accepté et refusé distincts, aucune pour un incident
// technique) ; aucun texte ni bouton wolof dans le HTML. Gardés : torche (1.1, 1.2), flash plein écran
// (fixed inset-0), nom du porteur en très grand, message affiché, robustesse sans navigator.vibrate.
// Le module de retour et le flash sont réécrits en 7.2 (fix(7.2e)) : importés dynamiquement, le typecheck
// passe aujourd'hui et le test échoue sur le comportement.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Modules sous test
import { isTorchSupported, setTorchState } from '../lib/hardware/torch';

/** Import dynamique (chemin relatif à ce fichier) : module typé `any`, absent ou réécrit sans erreur de typage. */
async function importModule(relPath: string): Promise<any> {
    const target: string = relPath;
    return import(target);
}

type FeedbackModule = {
    triggerHapticFeedback?: (category: string) => boolean;
    vibrationPattern?: (category: string) => number[] | null;
    [name: string]: unknown;
};

async function feedbackModule(): Promise<FeedbackModule> {
    const mod = (await importModule('../lib/hardware/feedback')) as FeedbackModule;
    assert.equal(typeof mod.triggerHapticFeedback, 'function', 'lib/hardware/feedback.ts : triggerHapticFeedback(catégorie) exportée');
    return mod;
}

async function renderFlash(props: Record<string, unknown>): Promise<string> {
    const mod = (await importModule('../components/scan/CombatFlashOverlay')) as { CombatFlashOverlay?: React.FC<Record<string, unknown>> };
    assert.equal(typeof mod.CombatFlashOverlay, 'function', 'components/scan/CombatFlashOverlay.tsx : CombatFlashOverlay exporté');
    return renderToStaticMarkup(React.createElement(mod.CombatFlashOverlay!, props));
}

function assertNoWolof(html: string, label: string): void {
    assert.doesNotMatch(html, /wolof/i, `${label} : aucun texte wolof dans le HTML`);
    assert.doesNotMatch(html, /repeat-wolof-btn|Répéter/i, `${label} : aucun bouton « Répéter » dans le HTML`);
}

describe('CHANTIER 3 — ERGONOMIE DE COMBAT (FRONTEND HARDWARE)', () => {
    // Espions et mocks
    let vibrateCalls: any[] = [];
    let constraintsApplied: any[] = [];

    // Sauvegarde des descripteurs initiaux pour restauration propre
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    beforeEach(() => {
        vibrateCalls = [];
        constraintsApplied = [];

        // Mock étanche de navigator (via Object.defineProperty car Node 21+ définit un getter natif)
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                vibrate: (pattern: any) => {
                    vibrateCalls.push(pattern);
                    return true;
                },
                mediaDevices: {
                    getUserMedia: async () => ({}),
                    enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'cam-back' }],
                },
            },
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        if (originalNavigatorDesc) {
            Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
        } else {
            delete (globalThis as any).navigator;
        }
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 1 : CONTRÔLE MATÉRIEL DE LA TORCHE (FLASHLIGHT)
    // ────────────────────────────────────────────────────────────────
    test('1.1 Contrôle Torche : allumage et extinction via MediaStreamTrack.applyConstraints', async () => {
        const mockTrack = {
            kind: 'video',
            getCapabilities: () => ({ torch: true }),
            applyConstraints: async (constraints: any) => {
                constraintsApplied.push(constraints);
                return true;
            },
        } as unknown as MediaStreamTrack;

        // Vérification détection du support
        assert.equal(isTorchSupported(mockTrack), true, 'La torche doit être détectée comme supportée');

        // Activation torche
        const turnOn = await setTorchState(mockTrack, true);
        assert.equal(turnOn.success, true);
        assert.equal(turnOn.isOn, true);
        assert.deepEqual(constraintsApplied[0], { advanced: [{ torch: true }] });

        // Extinction torche
        const turnOff = await setTorchState(mockTrack, false);
        assert.equal(turnOff.success, true);
        assert.equal(turnOff.isOn, false);
        assert.deepEqual(constraintsApplied[1], { advanced: [{ torch: false }] });
    });

    test('1.2 Contrôle Torche : fallback gracieux sans crash si non supporté ou erreur matérielle', async () => {
        // Cas A : Pas de capacité torche (ex: webcam PC ou caméra frontale selfie)
        const unsupportedTrack = {
            kind: 'video',
            getCapabilities: () => ({}), // pas de propriété torch
            applyConstraints: async () => {},
        } as unknown as MediaStreamTrack;

        assert.equal(isTorchSupported(unsupportedTrack), false, 'Doit retourner false si pas de torch');

        // Cas B : applyConstraints échoue (ex: verrou système ou iOS Safari)
        const failingTrack = {
            kind: 'video',
            getCapabilities: () => ({ torch: true }),
            applyConstraints: async () => {
                throw new Error('OverconstrainedError: Torch hardware busy');
            },
        } as unknown as MediaStreamTrack;

        const result = await setTorchState(failingTrack, true);
        assert.equal(result.success, false, 'Doit retourner success=false sans crasher');
        assert.equal(result.isOn, false);
        assert.match(result.error || '', /Torch hardware busy/);

        // Cas C : Piste nulle
        const nullResult = await setTorchState(null, true);
        assert.equal(nullResult.success, false);
        assert.equal(nullResult.isOn, false);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 2 : SCAN SUCCÈS (API 200) -> VIBRATION COURTE + FOND ACCEPTÉ
    // ────────────────────────────────────────────────────────────────
    test('2.1 Succès (Validé) : vibration courte [60], aucun son, flash plein écran sur le jeton scan-accept', async () => {
        const feedback = await feedbackModule();
        assert.equal(feedback.triggerHapticFeedback!('accepte'), true, 'Haptique actif');

        // 1. Vérification haptique : une impulsion courte (D50)
        assert.equal(vibrateCalls.length, 1);
        assert.deepEqual(vibrateCalls[0], [60], 'Signature haptique succès exacte [60]');

        // 2. Rendu composant Flash Plein Écran (Succès)
        const html = await renderFlash({
            status: 'valid',
            holderName: 'Moussa Ndiaye',
            category: 'VIP Pass',
            ticketNumber: 'TCK-2026-999',
        });

        assert.match(html, /scan-accept/, 'Le conteneur doit utiliser le jeton du scanner scan-accept');
        assert.doesNotMatch(html, /bg-emerald-600/, 'Plus de palette brute bg-emerald-600 (3,77:1 avec le blanc)');
        assert.match(html, /fixed inset-0/, 'Doit couvrir l écran entier (fixed inset-0)');
        assert.match(html, /Moussa Ndiaye/i, 'Doit afficher le nom du porteur');
        assert.match(html, /text-5xl|text-6xl/, 'Doit afficher le nom en typographie géante');
        assertNoWolof(html, 'succès');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 3 : SCAN REJET -> VIBRATION MARQUÉE + FOND REFUSÉ
    // ────────────────────────────────────────────────────────────────
    test('3.1 Rejet (Billet Utilisé / Faux) : vibration [120, 60, 120, 60, 120] distincte du succès, flash scan-used / scan-refuse', async () => {
        const feedback = await feedbackModule();
        assert.equal(feedback.triggerHapticFeedback!('refuse'), true);

        // 1. Vérification haptique : trois impulsions marquées, différentes du succès (D50)
        assert.equal(vibrateCalls.length, 1);
        assert.deepEqual(vibrateCalls[0], [120, 60, 120, 60, 120], 'Signature haptique rejet exacte [120, 60, 120, 60, 120]');
        assert.notDeepEqual(vibrateCalls[0], [60], 'Motifs accepté et refusé distincts');
        feedback.triggerHapticFeedback!('deja_utilise');
        assert.deepEqual(vibrateCalls[1], [120, 60, 120, 60, 120], 'Billet déjà utilisé : même motif que le refus');

        // 2. Rendu composant Flash Plein Écran (Rejet)
        const used = await renderFlash({
            status: 'already_used',
            message: 'BILLET DÉJÀ COMPOSTÉ',
            ticketNumber: 'TCK-2026-000',
        });
        assert.match(used, /scan-used/, 'Billet déjà utilisé : jeton scan-used');
        assert.doesNotMatch(used, /bg-red-600/, 'Plus de palette brute bg-red-600');
        assert.match(used, /fixed inset-0/, 'Doit être plein écran (fixed inset-0)');
        assert.match(used, /BILLET DÉJÀ COMPOSTÉ/i, 'Doit afficher le message de refus');
        assertNoWolof(used, 'déjà utilisé');

        const invalid = await renderFlash({ status: 'invalid', message: 'BILLET INCONNU', ticketNumber: 'TCK-2026-001' });
        assert.match(invalid, /scan-refuse/, 'Billet invalide : jeton scan-refuse');
        assert.match(invalid, /fixed inset-0/, 'Doit être plein écran (fixed inset-0)');
        assert.match(invalid, /BILLET INCONNU/i, 'Doit afficher le message de refus');
        assertNoWolof(invalid, 'invalide');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 4 : QR EXPIRÉ (REFUS) ET HORS FENÊTRE (ATTENTION)
    // ────────────────────────────────────────────────────────────────
    test('4.1 QR expiré (refus, scan-refuse) et hors fenêtre (attention [250, 100, 250], scan-window)', async () => {
        const feedback = await feedbackModule();
        assert.equal(feedback.triggerHapticFeedback!('hors_fenetre'), true);

        // 1. Vérification haptique : deux impulsions longues (D50)
        assert.equal(vibrateCalls.length, 1);
        assert.deepEqual(vibrateCalls[0], [250, 100, 250], 'Signature haptique attention [250, 100, 250]');

        // 2. QR expiré : catégorie « refuse » du contrat (§6.2), message affiché
        const expired = await renderFlash({
            status: 'qr_expired',
            message: 'QR CODE EXPIRÉ',
            holderName: 'Fatou Sow',
        });
        assert.match(expired, /scan-refuse/, 'QR expiré : jeton scan-refuse');
        assert.doesNotMatch(expired, /bg-amber-500/, 'Plus de palette brute bg-amber-500 (2,15:1 avec le blanc)');
        assert.match(expired, /fixed inset-0/, 'Doit être plein écran (fixed inset-0)');
        assert.match(expired, /QR CODE EXPIRÉ/i, 'Doit afficher le message');
        assertNoWolof(expired, 'QR expiré');

        // 3. Hors fenêtre : catégorie « hors_fenetre », fond scan-window
        const closed = await renderFlash({ status: 'event_not_open', message: 'CONTRÔLE PAS ENCORE OUVERT' });
        assert.match(closed, /scan-window/, 'Hors fenêtre : jeton scan-window');
        assert.match(closed, /fixed inset-0/, 'Doit être plein écran (fixed inset-0)');
        assert.match(closed, /CONTRÔLE PAS ENCORE OUVERT/i, 'Doit afficher le message');
        assertNoWolof(closed, 'hors fenêtre');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 5 : RÉSILIENCE EN ENVIRONNEMENT DÉGRADÉ / SANS SUPPORT
    // ────────────────────────────────────────────────────────────────
    test('5.1 Résilience fail-safe : aucun crash sans navigator.vibrate ; aucune vibration pour un incident technique ; aucun son exporté', async () => {
        const feedback = await feedbackModule();

        // Incident technique : jamais de vibration, même si l'appareil sait vibrer (D47)
        let technical = true;
        assert.doesNotThrow(() => {
            technical = feedback.triggerHapticFeedback!('technique');
        }, 'triggerHapticFeedback ne doit jamais lever d exception');
        assert.equal(technical, false, 'Incident technique : aucune vibration');
        assert.equal(vibrateCalls.length, 0, 'Incident technique : navigator.vibrate non appelé');

        // Mock d'un environnement sans API vibrate (ex: iPhone dans Safari, WebView bridée)
        Object.defineProperty(globalThis, 'navigator', {
            value: {}, // pas de vibrate
            configurable: true,
            writable: true,
        });

        let hapticOk = true;
        assert.doesNotThrow(() => {
            hapticOk = feedback.triggerHapticFeedback!('accepte');
        }, 'triggerHapticFeedback ne doit jamais lever d exception');
        assert.equal(hapticOk, false, 'Doit retourner false sans planter');

        // Aucun son : plus aucune fonction audio exportée par le module de retour
        const audioExports = Object.keys(feedback).filter((k) => /audio|sound/i.test(k));
        assert.deepEqual(audioExports, [], `lib/hardware/feedback.ts : fonctions audio encore exportées (${audioExports.join(', ')})`);
    });
});
