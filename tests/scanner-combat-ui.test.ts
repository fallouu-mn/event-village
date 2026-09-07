import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Modules sous test
import {
    triggerHapticFeedback,
    playAudioFeedback,
    triggerCombatSensoryFeedback,
    type CombatFeedbackType,
} from '../lib/hardware/feedback';
import { isTorchSupported, setTorchState } from '../lib/hardware/torch';
import { CombatFlashOverlay, getCombatFlashConfig } from '../components/scan/CombatFlashOverlay';

describe('CHANTIER 3 — ERGONOMIE DE COMBAT (FRONTEND HARDWARE)', () => {
    // Espions et mocks
    let vibrateCalls: any[] = [];
    let oscillatorCreated: any[] = [];
    let gainCreated: any[] = [];
    let constraintsApplied: any[] = [];

    // Sauvegarde des descripteurs initiaux pour restauration propre
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalAudioContextDesc = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');

    beforeEach(() => {
        vibrateCalls = [];
        oscillatorCreated = [];
        gainCreated = [];
        constraintsApplied = [];

        // 1. Mock étanche de navigator (via Object.defineProperty car Node 21+ définit un getter natif)
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

        // 2. Mock étanche de Web Audio API (Oscillateurs & Gain synthétiques)
        class MockAudioContext {
            currentTime = 0;
            state = 'running';
            destination = {};

            createOscillator() {
                const osc = {
                    type: 'sine',
                    frequency: {
                        value: 0,
                        targetValue: 0,
                        setValueAtTime: (val: number, _t: number) => {
                            osc.frequency.value = val;
                        },
                        exponentialRampToValueAtTime: (val: number, _t: number) => {
                            osc.frequency.targetValue = val;
                        },
                    },
                    connect: (_dest: any) => {},
                    start: (_time?: number) => {},
                    stop: (_time?: number) => {},
                };
                oscillatorCreated.push(osc);
                return osc;
            }

            createGain() {
                const gain = {
                    gain: {
                        value: 1,
                        targetValue: 1,
                        setValueAtTime: (val: number, _t: number) => {
                            gain.gain.value = val;
                        },
                        exponentialRampToValueAtTime: (val: number, _t: number) => {
                            gain.gain.targetValue = val;
                        },
                    },
                    connect: (_dest: any) => {},
                };
                gainCreated.push(gain);
                return gain;
            }

            async resume() {
                this.state = 'running';
            }
        }

        Object.defineProperty(globalThis, 'AudioContext', {
            value: MockAudioContext,
            configurable: true,
            writable: true,
        });

        Object.defineProperty(globalThis, 'window', {
            value: {
                AudioContext: MockAudioContext,
                webkitAudioContext: MockAudioContext,
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

        if (originalWindowDesc) {
            Object.defineProperty(globalThis, 'window', originalWindowDesc);
        } else {
            delete (globalThis as any).window;
        }

        if (originalAudioContextDesc) {
            Object.defineProperty(globalThis, 'AudioContext', originalAudioContextDesc);
        } else {
            delete (globalThis as any).AudioContext;
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
    // TEST 2 : SCAN SUCCÈS (API 200) -> VIBRATION + SON AIGU + VERT
    // ────────────────────────────────────────────────────────────────
    test('2.1 Succès (Validé) : Déclenche [100, 50, 100], son 800Hz et flash Vert Émeraude', () => {
        // Simulation retour API 200
        const feedback = triggerCombatSensoryFeedback('valid');
        assert.equal(feedback.haptic, true, 'Haptique actif');
        assert.equal(feedback.audio, true, 'Audio actif');

        // 1. Vérification haptique : Double vibration courte
        assert.equal(vibrateCalls.length, 1);
        assert.deepEqual(vibrateCalls[0], [100, 50, 100], 'Signature haptique succès exacte [100, 50, 100]');

        // 2. Vérification audio : Onde sinusoïdale 800 Hz
        assert.equal(oscillatorCreated.length, 1);
        const osc = oscillatorCreated[0];
        assert.equal(osc.type, 'sine', 'Doit être une onde sinusoïdale cristalline');
        assert.equal(osc.frequency.value, 800, 'Fréquence aiguë initiale de 800 Hz');

        // 3. Rendu composant Flash Plein Écran (Succès)
        const config = getCombatFlashConfig('valid');
        assert.ok(config);
        assert.equal(config.bgClass, 'bg-emerald-600', 'Doit être configuré en Vert Émeraude bg-emerald-600');

        const html = renderToStaticMarkup(React.createElement(CombatFlashOverlay, {
            status: 'valid',
            holderName: 'Moussa Ndiaye',
            category: 'VIP Pass',
            ticketNumber: 'TCK-2026-999',
        }));

        assert.match(html, /bg-emerald-600/, 'Le conteneur doit contenir la classe bg-emerald-600');
        assert.match(html, /fixed inset-0/, 'Doit couvrir l écran entier (fixed inset-0)');
        assert.match(html, /Moussa Ndiaye/i, 'Doit afficher le nom du porteur');
        assert.match(html, /text-5xl|text-6xl/, 'Doit afficher le nom en typographie géante');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 3 : SCAN REJET (API 400) -> VIBRATION LOURDE + BUZZER 200Hz + ROUGE
    // ────────────────────────────────────────────────────────────────
    test('3.1 Rejet (Billet Utilisé / Faux) : Déclenche [500, 100, 500], buzzer 200Hz et flash Rouge Vermillon', () => {
        // Simulation retour API 400
        const feedback = triggerCombatSensoryFeedback('reject');
        assert.equal(feedback.haptic, true);
        assert.equal(feedback.audio, true);

        // 1. Vérification haptique : Vibration longue et lourde
        assert.equal(vibrateCalls.length, 1);
        assert.deepEqual(vibrateCalls[0], [500, 100, 500], 'Signature haptique rejet exacte [500, 100, 500]');

        // 2. Vérification audio : Buzzer rugueux 200 Hz
        assert.equal(oscillatorCreated.length, 1);
        const osc = oscillatorCreated[0];
        assert.equal(osc.type, 'sawtooth', 'Doit être une onde en dent de scie (sawtooth)');
        assert.equal(osc.frequency.value, 200, 'Fréquence grave de 200 Hz');

        // 3. Rendu composant Flash Plein Écran (Rejet)
        const config = getCombatFlashConfig('reject');
        assert.ok(config);
        assert.equal(config.bgClass, 'bg-red-600', 'Doit être configuré en Rouge Vermillon bg-red-600');

        const html = renderToStaticMarkup(React.createElement(CombatFlashOverlay, {
            status: 'reject',
            message: 'BILLET DÉJÀ COMPOSTÉ',
            ticketNumber: 'TCK-2026-000',
        }));

        assert.match(html, /bg-red-600/, 'Le conteneur doit contenir la classe bg-red-600');
        assert.match(html, /fixed inset-0/, 'Doit être plein écran (fixed inset-0)');
        assert.match(html, /BILLET DÉJÀ COMPOSTÉ/i, 'Doit afficher le message de refus');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 4 : SCAN ALERTE (QR EXPIRÉ / ATTENTION) -> VIBRATION SACCADÉE + AMBRE
    // ────────────────────────────────────────────────────────────────
    test('4.1 Alerte (QR Expiré) : Déclenche [100, 50, 100, 50, 100], bips 440Hz et flash Ambre/Orange', () => {
        const feedback = triggerCombatSensoryFeedback('alert');
        assert.equal(feedback.haptic, true);
        assert.equal(feedback.audio, true);

        // 1. Vérification haptique : Vibration staccato saccadée
        assert.equal(vibrateCalls.length, 1);
        assert.deepEqual(vibrateCalls[0], [100, 50, 100, 50, 100], 'Signature haptique alerte [100, 50, 100, 50, 100]');

        // 2. Vérification audio : 3 impulsions 440 Hz
        assert.equal(oscillatorCreated.length, 3, 'Doit générer 3 impulsions sonores distinctes');
        assert.equal(oscillatorCreated[0].frequency.value, 440, 'Fréquence de 440 Hz');

        // 3. Rendu composant Flash Plein Écran (Alerte)
        const config = getCombatFlashConfig('alert');
        assert.ok(config);
        assert.equal(config.bgClass, 'bg-amber-500', 'Doit être configuré en Ambre/Orange bg-amber-500');

        const html = renderToStaticMarkup(React.createElement(CombatFlashOverlay, {
            status: 'alert',
            message: 'QR CODE EXPIRÉ',
            holderName: 'Fatou Sow',
        }));

        assert.match(html, /bg-amber-500/, 'Le conteneur doit contenir la classe bg-amber-500');
        assert.match(html, /fixed inset-0/, 'Doit être plein écran (fixed inset-0)');
        assert.match(html, /QR CODE EXPIRÉ/i, 'Doit afficher le message d alerte');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 5 : RÉSILIENCE EN ENVIRONNEMENT DÉGRADÉ / SANS SUPPORT
    // ────────────────────────────────────────────────────────────────
    test('5.1 Résilience fail-safe : Aucun crash si navigator.vibrate ou window.AudioContext sont absents', () => {
        // Mock d'un environnement sans API vibrate ni Web Audio (ex: navigateur ancien ou WebView bridée)
        Object.defineProperty(globalThis, 'navigator', {
            value: {}, // pas de vibrate
            configurable: true,
            writable: true,
        });
        Object.defineProperty(globalThis, 'window', {
            value: {}, // pas d'AudioContext
            configurable: true,
            writable: true,
        });
        Object.defineProperty(globalThis, 'AudioContext', {
            value: undefined,
            configurable: true,
            writable: true,
        });

        // Doit s'exécuter sans lever d'exception
        let hapticOk = false;
        let audioOk = false;

        assert.doesNotThrow(() => {
            hapticOk = triggerHapticFeedback('valid');
        }, 'triggerHapticFeedback ne doit jamais lever d exception');

        assert.doesNotThrow(() => {
            audioOk = playAudioFeedback('valid');
        }, 'playAudioFeedback ne doit jamais lever d exception');

        assert.equal(hapticOk, false, 'Doit retourner false sans planter');
        assert.equal(audioOk, false, 'Doit retourner false sans planter');

        const combat = triggerCombatSensoryFeedback('valid');
        assert.deepEqual(combat, { haptic: false, audio: false });
    });
});
