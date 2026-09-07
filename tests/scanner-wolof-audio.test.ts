import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Modules sous test
import {
    playWolofAudio,
    repeatLastWolofAudio,
    stopWolofAudio,
    isWolofMuted,
    setWolofMuted,
    toggleWolofMuted,
    hasWolofAudio,
    getWolofAudioUrl,
    normalizeWolofAudioType,
    WOLOF_AUDIO_MESSAGES,
} from '../lib/hardware/wolof-audio';

import {
    triggerHapticFeedback,
    playAudioFeedback,
    triggerCombatSensoryFeedback,
    type CombatFeedbackType,
} from '../lib/hardware/feedback';

import { CombatFlashOverlay, getCombatFlashConfig } from '../components/scan/CombatFlashOverlay';

describe('CHANTIER 3.5 — FEEDBACK SENSORIEL CRITIQUE & VOCALISATION WOLOF', () => {
    // Espions et mocks
    let audioInstances: any[] = [];
    let vibrateCalls: any[] = [];
    let localStorageStore: Record<string, string> = {};

    const originalWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalAudioContextDesc = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');

    beforeEach(() => {
        audioInstances = [];
        vibrateCalls = [];
        localStorageStore = {};
        stopWolofAudio();

        // 1. Mock étanche de window et Audio
        class MockAudio {
            src: string;
            preload: string = 'auto';
            currentTime: number = 0;
            paused: boolean = true;
            listeners: Record<string, Function[]> = {};
            playRejectionError: Error | null = null;
            shouldTriggerErrorEvent: boolean = false;

            constructor(src: string) {
                this.src = src;
                audioInstances.push(this);
            }

            addEventListener(event: string, callback: Function) {
                if (!this.listeners[event]) this.listeners[event] = [];
                this.listeners[event].push(callback);
            }

            removeEventListener(event: string, callback: Function) {
                if (this.listeners[event]) {
                    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
                }
            }

            async play() {
                if (this.shouldTriggerErrorEvent) {
                    const errCb = this.listeners['error'];
                    if (errCb) errCb.forEach(cb => cb(new Error('MEDIA_ELEMENT_ERROR: 404 Not Found')));
                    return Promise.reject(new Error('MEDIA_ELEMENT_ERROR: 404 Not Found'));
                }
                if (this.playRejectionError) {
                    throw this.playRejectionError;
                }
                this.paused = false;
                return Promise.resolve();
            }

            pause() {
                this.paused = true;
            }
        }

        const mockLocalStorage = {
            getItem: (key: string) => localStorageStore[key] ?? null,
            setItem: (key: string, val: string) => { localStorageStore[key] = String(val); },
            removeItem: (key: string) => { delete localStorageStore[key]; },
            clear: () => { localStorageStore = {}; },
        };

        Object.defineProperty(globalThis, 'window', {
            value: {
                Audio: MockAudio,
                localStorage: mockLocalStorage,
            },
            configurable: true,
            writable: true,
        });

        // 2. Mock étanche de navigator.vibrate
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                vibrate: (pattern: any) => {
                    vibrateCalls.push(pattern);
                    return true;
                },
            },
            configurable: true,
            writable: true,
        });

        // 3. Mock Web Audio
        class MockAudioContext {
            currentTime = 0;
            state = 'running';
            destination = {};
            createOscillator() {
                return {
                    type: 'sine',
                    frequency: {
                        value: 0,
                        setValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {},
                    },
                    connect: () => {},
                    start: () => {},
                    stop: () => {},
                };
            }
            createGain() {
                return {
                    gain: {
                        value: 1,
                        setValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {},
                    },
                    connect: () => {},
                };
            }
            async resume() {}
        }

        Object.defineProperty(globalThis, 'AudioContext', {
            value: MockAudioContext,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        stopWolofAudio();
        if (originalWindowDesc) Object.defineProperty(globalThis, 'window', originalWindowDesc);
        else delete (globalThis as any).window;

        if (originalNavigatorDesc) Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
        else delete (globalThis as any).navigator;

        if (originalAudioContextDesc) Object.defineProperty(globalThis, 'AudioContext', originalAudioContextDesc);
        else delete (globalThis as any).AudioContext;
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 1 : ALREADY_USED -> FICHIER AUDIO WOLOF EXACT
    // ────────────────────────────────────────────────────────────────
    test('1. ALREADY_USED -> Déclenche /sounds/wolof/already-used.mp3', async () => {
        const res = await playWolofAudio('ALREADY_USED');
        assert.equal(res.success, true);
        assert.equal(res.played, true);
        assert.equal(res.type, 'ALREADY_USED');
        assert.equal(audioInstances.length, 1);
        assert.equal(audioInstances[0].src, '/sounds/wolof/already-used.mp3');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 2 : INVALID -> FICHIER AUDIO WOLOF EXACT
    // ────────────────────────────────────────────────────────────────
    test('2. INVALID -> Déclenche /sounds/wolof/invalid.mp3', async () => {
        const res = await playWolofAudio('INVALID');
        assert.equal(res.success, true);
        assert.equal(res.played, true);
        assert.equal(res.type, 'INVALID');
        assert.equal(audioInstances.length, 1);
        assert.equal(audioInstances[0].src, '/sounds/wolof/invalid.mp3');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 3 : WRONG_EVENT -> FICHIER AUDIO WOLOF EXACT
    // ────────────────────────────────────────────────────────────────
    test('3. WRONG_EVENT / UNAUTHORIZED -> Déclenche /sounds/wolof/wrong-event.mp3', async () => {
        const res = await playWolofAudio('WRONG_EVENT');
        assert.equal(res.success, true);
        assert.equal(res.played, true);
        assert.equal(res.type, 'WRONG_EVENT');
        assert.equal(audioInstances[0].src, '/sounds/wolof/wrong-event.mp3');

        // Test normalisation depuis code API 'unauthorized'
        const resUnauth = await playWolofAudio('unauthorized');
        assert.equal(resUnauth.type, 'WRONG_EVENT');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 4 : VALID -> AUCUNE VOCALISATION WOLOF
    // ────────────────────────────────────────────────────────────────
    test('4. VALID -> Aucune vocalisation Wolof déclenchée (fluidité)', async () => {
        assert.equal(hasWolofAudio('valid'), false, 'Le statut valid ne doit pas avoir de fichier Wolof');
        const res = await playWolofAudio('valid');
        assert.equal(res.played, false);
        assert.equal(res.reason, 'UNKNOWN_TYPE');
        assert.equal(audioInstances.length, 0, 'Aucune instance Audio ne doit être créée');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 5 : MUTE -> AUCUNE LECTURE AUTOMATIQUE
    // ────────────────────────────────────────────────────────────────
    test('5. MUTE -> Aucune lecture automatique si voix Wolof désactivée', async () => {
        setWolofMuted(true);
        assert.equal(isWolofMuted(), true);

        const res = await playWolofAudio('ALREADY_USED');
        assert.equal(res.success, true);
        assert.equal(res.played, false);
        assert.equal(res.reason, 'MUTED');
        assert.equal(audioInstances.length, 0, 'Aucun audio ne doit être instancié en mode Mute');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 6 : UNMUTE -> LECTURE AUTORISÉE
    // ────────────────────────────────────────────────────────────────
    test('6. UNMUTE -> La réactivation de la voix autorise immédiatement la lecture', async () => {
        setWolofMuted(true);
        toggleWolofMuted(); // bascule à false
        assert.equal(isWolofMuted(), false);

        const res = await playWolofAudio('INVALID');
        assert.equal(res.played, true);
        assert.equal(audioInstances.length, 1);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 7 : BOUTON RÉPÉTER EN WOLOF
    // ────────────────────────────────────────────────────────────────
    test('7. REPEAT -> Rejoue le dernier message Wolof même si mute ou bloqué précédemment', async () => {
        // Simule un premier scan ALREADY_USED
        await playWolofAudio('ALREADY_USED');
        assert.equal(audioInstances.length, 1);

        // Mute le système après coup
        setWolofMuted(true);

        // Clic sur le bouton Répéter
        const repeatRes = await repeatLastWolofAudio();
        assert.equal(repeatRes.success, true);
        assert.equal(repeatRes.played, true);
        assert.equal(repeatRes.type, 'ALREADY_USED');
        assert.equal(audioInstances[1].src, '/sounds/wolof/already-used.mp3');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 8 : AUDIO.PLAY() REJETÉ (AUTOPLAY POLICY) SANS CRASH
    // ────────────────────────────────────────────────────────────────
    test('8. AUTOPLAY BLOCKED -> Gestion fail-safe sans exception non gérée', async () => {
        const AudioClass = (window as any).Audio;
        const originalProto = AudioClass.prototype.play;
        AudioClass.prototype.play = async function() {
            throw new Error('NotAllowedError: play() failed because the user didn\'t interact with the document first.');
        };

        const result = await playWolofAudio('INVALID');

        assert.ok(result);
        assert.equal(result.success, true, 'Le scanner ne doit jamais planter sur un rejet d\'autoplay');
        assert.equal(result.played, false);
        assert.equal(result.reason, 'AUTOPLAY_BLOCKED');

        AudioClass.prototype.play = originalProto;
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 9 : FICHIER AUDIO ABSENT -> SCANNER CONTINUE NORMALEMENT
    // ────────────────────────────────────────────────────────────────
    test('9. FICHIER ABSENT -> Événement error capté, scanner continue sans erreur', async () => {
        const AudioClass = (window as any).Audio;
        const originalProto = AudioClass.prototype.play;
        AudioClass.prototype.play = function() {
            this.shouldTriggerErrorEvent = true;
            return originalProto.call(this);
        };

        const res = await playWolofAudio('WRONG_EVENT');
        assert.equal(res.success, true);
        assert.equal(res.played, false);
        assert.equal(res.reason, 'FILE_NOT_FOUND');

        AudioClass.prototype.play = originalProto;
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 10 : UN SCAN -> UNE SEULE LECTURE AUDIO (ANTI-CHEVUCHEMENT)
    // ────────────────────────────────────────────────────────────────
    test('10. UN SCAN -> Arrêt propre de l\'audio précédent avant de lancer le nouveau', async () => {
        await playWolofAudio('ALREADY_USED');
        const firstAudio = audioInstances[0];
        assert.equal(firstAudio.paused, false);

        // Deuxième lecture immédiate
        await playWolofAudio('INVALID');
        assert.equal(firstAudio.paused, true, 'Le premier audio doit avoir été stoppé');
        assert.equal(audioInstances.length, 2);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 11 : MATRICE HAPTIQUE UNIQUE & COHÉRENTE
    // ────────────────────────────────────────────────────────────────
    test('11. MATRICE HAPTIQUE -> Signatures distinctes sans ambiguïté', () => {
        // Valid
        triggerHapticFeedback('valid');
        assert.deepEqual(vibrateCalls[0], [100, 50, 100], 'Valid: double courte');

        // Already used
        triggerHapticFeedback('already_used');
        assert.deepEqual(vibrateCalls[1], [500, 100, 500], 'Already used: double lourde');

        // Invalid
        triggerHapticFeedback('invalid');
        assert.deepEqual(vibrateCalls[2], [300, 100, 300, 100, 300], 'Invalid: triple tranchante');

        // Wrong event
        triggerHapticFeedback('wrong_event');
        assert.deepEqual(vibrateCalls[3], [200, 100, 200, 100, 200], 'Wrong event: triple pulsation');

        // QR Expired
        triggerHapticFeedback('qr_expired');
        assert.deepEqual(vibrateCalls[4], [100, 50, 100, 50, 100], 'QR expired: staccato rapide');

        // Network error
        triggerHapticFeedback('network_error');
        assert.deepEqual(vibrateCalls[5], [250], 'Network error: pulsation neutre');

        assert.equal(vibrateCalls.length, 6);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 12 : NETWORK_ERROR -> AUCUN FAUX REJET & AUCUNE ACCUSATION
    // ────────────────────────────────────────────────────────────────
    test('12. NETWORK_ERROR -> Retour neutre sans vocalisation accusatrice', () => {
        assert.equal(hasWolofAudio('network_error'), false, 'Pas de message Wolof sur erreur réseau');

        const config = getCombatFlashConfig('network_error');
        assert.ok(config);
        assert.equal(config.bgClass, 'bg-slate-700', 'Doit être en gris ardoise neutre');
        assert.equal(config.title, 'VÉRIFICATION IMPOSSIBLE');

        const html = renderToStaticMarkup(React.createElement(CombatFlashOverlay, {
            status: 'network_error',
            message: 'Erreur réseau.',
        }));

        assert.match(html, /bg-slate-700/);
        assert.match(html, /VÉRIFICATION IMPOSSIBLE/);
        assert.doesNotMatch(html, /baaxul|scan nañ/i, 'Ne doit contenir aucun message de fraude ou refus');
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 13 : CHANGEMENT RAPIDE DE RÉSULTAT -> AUCUN AUDIO OBSOLÈTE
    // ────────────────────────────────────────────────────────────────
    test('13. CHANGEMENT RAPIDE -> Stop audio immédiat lors du démontage ou reset', () => {
        playWolofAudio('ALREADY_USED');
        assert.equal(audioInstances.length, 1);
        assert.equal(audioInstances[0].paused, false);

        stopWolofAudio();
        assert.equal(audioInstances[0].paused, true);
        assert.equal(audioInstances[0].currentTime, 0);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 14 : DOUBLE CLIC BOUTON RÉPÉTER -> PAS DE BOUCLE INCONTRÔLÉE
    // ────────────────────────────────────────────────────────────────
    test('14. DOUBLE CLIC RÉPÉTER -> Exécution séquentielle propre sans superposition', async () => {
        await playWolofAudio('INVALID');

        // 2 clics consécutifs ultra-rapides sur Répéter
        const p1 = repeatLastWolofAudio();
        const p2 = repeatLastWolofAudio();

        await Promise.all([p1, p2]);

        // L'instance précédente est proprement mise en pause
        assert.equal(audioInstances[1].paused, true);
        assert.equal(audioInstances[2].paused, false);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 15 : RENDU OVERLAY FLASH AVEC BOUTON RÉPÉTER & WOLOF
    // ────────────────────────────────────────────────────────────────
    test('15. OVERLAY UI -> Affiche le bouton "Répéter en Wolof" et la transcription sur litige', () => {
        let repeatClicked = false;

        const html = renderToStaticMarkup(React.createElement(CombatFlashOverlay, {
            status: 'already_used',
            message: 'BILLET DÉJÀ COMPOSTÉ',
            ticketNumber: 'TCK-2026-888',
            onRepeatWolof: () => { repeatClicked = true; },
        }));

        assert.match(html, /bg-red-600/);
        assert.match(html, /BILLET DÉJÀ UTILISÉ/);
        assert.match(html, /Répéter en Wolof/);
        assert.match(html, /Billet bi ñu scan nañ ko ba pare/);
    });

    // ────────────────────────────────────────────────────────────────
    // TEST 16 : SUPPORT DE LA LANGUE FRANÇAISE (/sounds/fr/)
    // ────────────────────────────────────────────────────────────────
    test('16. SUPPORT MULTILINGUE -> Résolution des URLs Françaises (/sounds/fr/)', async () => {
        assert.equal(getWolofAudioUrl('ALREADY_USED', 'fr'), '/sounds/fr/already-used.mp3');
        assert.equal(getWolofAudioUrl('INVALID', 'fr'), '/sounds/fr/invalid.mp3');
        assert.equal(getWolofAudioUrl('WRONG_EVENT', 'fr'), '/sounds/fr/wrong-event.mp3');

        const resFr = await playWolofAudio('ALREADY_USED', 'fr');
        assert.equal(resFr.played, true);
        assert.equal(audioInstances[0].src, '/sounds/fr/already-used.mp3');
    });
});
