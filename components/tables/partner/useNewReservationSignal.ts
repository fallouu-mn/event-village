'use client';

/**
 * Lot 11b : signal discret d'une nouvelle réservation sur le planning du jour.
 *  - Choix « Signal des nouvelles réservations » gardé sur l'appareil (préférences de l'appareil, lib/device/device-prefs.ts :
 *    effacées à la déconnexion, audit cvf2b-6), activé par défaut.
 *  - Vibration courte (navigator.vibrate) si le téléphone la propose et si la personne ne demande pas à réduire les
 *    animations ; sinon un petit bip généré (Web Audio, aucun fichier), jamais avant une première interaction de la
 *    personne avec la page (règle des navigateurs, et pas de son surprise à l'ouverture).
 *  - Aucun signal quand l'onglet est caché : le planning est relu au retour et la nouveauté reste surlignée.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readTableSignal, saveTableSignal } from '@/lib/device/device-prefs';

const readPreference = readTableSignal;

/** Stockage refusé (navigation privée) : le choix vaut pour cette visite seulement. */
function writePreference(on: boolean): void {
    saveTableSignal(on);
}

type AudioCtor = typeof AudioContext;

function audioCtor(): AudioCtor | null {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export interface NewReservationSignal {
    enabled: boolean;
    setEnabled: (on: boolean) => void;
    /** Ce que fera le signal sur cet appareil (affiché sous la bascule). */
    mode: 'vibration' | 'son' | 'son-apres-toucher';
    /** Joue le signal (une fois par lecture, quel que soit le nombre de nouveautés). */
    ring: () => void;
}

export function useNewReservationSignal(): NewReservationSignal {
    const [enabled, setEnabledState] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [canVibrate, setCanVibrate] = useState(false);
    const [interacted, setInteracted] = useState(false);
    const ctx = useRef<AudioContext | null>(null);

    useEffect(() => {
        setEnabledState(readPreference());
        setCanVibrate(typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReducedMotion(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    // Première interaction : le son devient permis (contexte audio créé et repris dans le geste lui-même)
    useEffect(() => {
        if (interacted) return;
        const unlock = () => {
            setInteracted(true);
            const Ctor = audioCtor();
            if (Ctor && !ctx.current) {
                try {
                    ctx.current = new Ctor();
                } catch {
                    ctx.current = null;
                }
            }
            void ctx.current?.resume().catch(() => undefined);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, [interacted]);

    useEffect(() => () => {
        void ctx.current?.close().catch(() => undefined);
        ctx.current = null;
    }, []);

    const setEnabled = useCallback((on: boolean) => {
        setEnabledState(on);
        writePreference(on);
    }, []);

    const vibrationAllowed = canVibrate && !reducedMotion;

    const beep = useCallback(() => {
        const ac = ctx.current;
        if (!ac || ac.state !== 'running') return;
        const t0 = ac.currentTime;
        // Deux notes courtes et douces (≈ 0,35 s en tout), volume bas
        [[880, 0], [1175, 0.16]].forEach(([freq, at]) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t0 + at);
            gain.gain.exponentialRampToValueAtTime(0.08, t0 + at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.16);
            osc.connect(gain).connect(ac.destination);
            osc.start(t0 + at);
            osc.stop(t0 + at + 0.18);
        });
    }, []);

    const ring = useCallback(() => {
        if (!enabled || document.visibilityState !== 'visible') return;
        if (vibrationAllowed) {
            try {
                if (navigator.vibrate([90, 60, 90])) return;
            } catch {
                // Vibration refusée : on passe au son
            }
        }
        if (interacted) beep();
    }, [enabled, vibrationAllowed, interacted, beep]);

    return {
        enabled,
        setEnabled,
        mode: vibrationAllowed ? 'vibration' : interacted ? 'son' : 'son-apres-toucher',
        ring,
    };
}
