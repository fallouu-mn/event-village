'use client';

/**
 * Lot 12c — son et vibration à chaque nouvelle commande, tant que l'écran des commandes est ouvert (décision du client du
 * 26/11, en plus des avis existants : SMS, notification, email).
 *  - Choix « son des nouvelles commandes » gardé sur l'appareil (lib/device/device-prefs.ts : effacé à la déconnexion,
 *    audit cvf2b-6), activé par défaut ; bouton pour le couper ou le remettre.
 *  - Son généré (Web Audio, aucun fichier), seulement après un premier toucher de la page : règle des navigateurs. Tant
 *    que ce toucher n'a pas eu lieu, l'écran montre « Activer le son ».
 *  - Vibration (navigator.vibrate) en plus, si le téléphone la propose.
 *  - Rien quand l'onglet est caché : la commande reste surlignée au retour.
 *  - Contre-vérification du lot 12c (point 11) : rappel sonore 5 et 2 minutes avant la fin du délai de réponse (remind),
 *    même interrupteur que le son des nouvelles commandes, son différent (deux notes descendantes).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readOrderSound, saveOrderSound } from '@/lib/device/device-prefs';

type AudioCtor = typeof AudioContext;

function audioCtor(): AudioCtor | null {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export interface OrderSound {
    enabled: boolean;
    setEnabled: (on: boolean) => void;
    /** Le navigateur permet le son (premier toucher fait). */
    ready: boolean;
    /** À appeler dans le geste « Activer le son ». */
    unlock: () => void;
    /** Son et vibration d'une nouvelle commande (une fois par relecture). */
    ring: () => void;
    /** Rappel avant la fin du délai de réponse (5 et 2 minutes). */
    remind: () => void;
}

export function useOrderSound(): OrderSound {
    const [enabled, setEnabledState] = useState(true);
    const [ready, setReady] = useState(false);
    const ctx = useRef<AudioContext | null>(null);

    useEffect(() => {
        setEnabledState(readOrderSound());
    }, []);

    const unlock = useCallback(() => {
        const Ctor = audioCtor();
        if (Ctor && !ctx.current) {
            try {
                ctx.current = new Ctor();
            } catch (err) {
                console.error('[commandes] son indisponible sur cet appareil', err);
                ctx.current = null;
            }
        }
        const ac = ctx.current;
        if (!ac) return;
        void ac.resume().then(() => setReady(ac.state === 'running')).catch((err: unknown) => {
            console.error('[commandes] son refusé par le navigateur', err);
        });
    }, []);

    // Premier toucher ou première touche du clavier : le son devient permis (contexte repris dans le geste lui-même).
    // Contre-vérification du lot 12c (run 744) : au « click », après l'action du bouton touché, et non à l'appui : le
    // bouton « Activer le son » disparaissait entre l'appui et le relâchement, la rangée glissait et le geste n'atteignait
    // pas le bouton visé (« Mode comptoir »).
    useEffect(() => {
        if (ready) return undefined;
        const onGesture = () => unlock();
        window.addEventListener('click', onGesture);
        window.addEventListener('keydown', onGesture);
        return () => {
            window.removeEventListener('click', onGesture);
            window.removeEventListener('keydown', onGesture);
        };
    }, [ready, unlock]);

    useEffect(() => () => {
        void ctx.current?.close().catch(() => undefined);
        ctx.current = null;
    }, []);

    const setEnabled = useCallback((on: boolean) => {
        setEnabledState(on);
        saveOrderSound(on);
    }, []);

    const chime = useCallback(() => {
        const ac = ctx.current;
        if (!ac || ac.state !== 'running') return;
        const t0 = ac.currentTime;
        // Trois notes montantes, deux fois (≈ 1,2 s), assez fortes pour une cuisine sans être criardes
        [[784, 0], [988, 0.14], [1319, 0.28], [784, 0.62], [988, 0.76], [1319, 0.9]].forEach(([freq, at]) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t0 + at);
            gain.gain.exponentialRampToValueAtTime(0.22, t0 + at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.24);
            osc.connect(gain).connect(ac.destination);
            osc.start(t0 + at);
            osc.stop(t0 + at + 0.26);
        });
    }, []);

    const tones = useCallback((notes: ReadonlyArray<readonly [number, number]>) => {
        const ac = ctx.current;
        if (!ac || ac.state !== 'running') return;
        const t0 = ac.currentTime;
        notes.forEach(([freq, at]) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t0 + at);
            gain.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.32);
            osc.connect(gain).connect(ac.destination);
            osc.start(t0 + at);
            osc.stop(t0 + at + 0.34);
        });
    }, []);

    const remind = useCallback(() => {
        if (!enabled || document.visibilityState !== 'visible') return;
        // Deux notes descendantes, deux fois : distinct de l'arrivée d'une commande
        tones([[1047, 0], [698, 0.22], [1047, 0.6], [698, 0.82]]);
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
                navigator.vibrate([400, 150, 400]);
            } catch (err) {
                console.error('[commandes] vibration refusée', err);
            }
        }
    }, [enabled, tones]);

    const ring = useCallback(() => {
        if (!enabled || document.visibilityState !== 'visible') return;
        chime();
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
                navigator.vibrate([200, 100, 200, 100, 200]);
            } catch (err) {
                console.error('[commandes] vibration refusée', err);
            }
        }
    }, [enabled, chime]);

    return { enabled, setEnabled, ready, unlock, ring, remind };
}
