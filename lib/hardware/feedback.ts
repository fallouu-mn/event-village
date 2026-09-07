/**
 * Module de retour sensoriel matériel de combat (Haptique & Synthèse Web Audio)
 * Conçu pour fonctionner sous 110 dB et de nuit sans dépendance réseau.
 * Tolérance zéro sur les crashs : vérifications strictes de l'environnement (browser vs Node.js).
 */

export type CombatFeedbackType =
    | 'valid'
    | 'already_used'
    | 'invalid'
    | 'wrong_event'
    | 'qr_expired'
    | 'cash_required'
    | 'network_error'
    | 'alert'
    | 'reject';

export interface CombatFeedbackResult {
    haptic: boolean;
    audio: boolean;
}

// ── 1. RETOUR HAPTIQUE (VIBRATION) ──────────────────────────────────

/**
 * Déclenche une signature haptique distincte selon le résultat du contrôle :
 * - VALID (Succès) : Double vibration courte [100, 50, 100]
 * - ALREADY_USED (Doublon) : Double vibration lourde et insistante [500, 100, 500]
 * - INVALID (Faux / Annulé) : Triple vibration abrasive [300, 100, 300, 100, 300]
 * - WRONG_EVENT (Mauvais événement) : Triple pulsation d'alerte [200, 100, 200, 100, 200]
 * - QR_EXPIRED / ALERT / CASH_REQUIRED : Staccato d'alerte [100, 50, 100, 50, 100]
 * - NETWORK_ERROR : Vibration neutre unique [250]
 * - REJECT (Générique) : Vibration lourde [500, 100, 500]
 * 
 * Gestion fail-safe : aucun crash si l'API navigator.vibrate est absente ou restreinte.
 */
export function triggerHapticFeedback(type: CombatFeedbackType): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return false;
    }

    try {
        let pattern: number[];
        switch (type) {
            case 'valid':
                pattern = [100, 50, 100];
                break;
            case 'already_used':
            case 'reject':
                pattern = [500, 100, 500];
                break;
            case 'invalid':
                pattern = [300, 100, 300, 100, 300];
                break;
            case 'wrong_event':
                pattern = [200, 100, 200, 100, 200];
                break;
            case 'qr_expired':
            case 'cash_required':
            case 'alert':
                pattern = [100, 50, 100, 50, 100];
                break;
            case 'network_error':
                pattern = [250];
                break;
            default:
                pattern = [100];
        }

        return Boolean(navigator.vibrate(pattern));
    } catch {
        // Silencieux : permissions refusées ou environnement restreint
        return false;
    }
}

// ── 2. RETOUR AUDIO (OSCILLATEURS WEB AUDIO PURS SANS RÉSEAU) ───────

let sharedAudioContext: AudioContext | null = null;

/**
 * Récupère ou instancie l'AudioContext du navigateur de manière sécurisée.
 */
function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;

    try {
        if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
            sharedAudioContext = new AudioCtxClass();
        }

        // Si le contexte est suspendu (politique d'autoplay mobile), tente la réactivation
        if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(() => {});
        }

        return sharedAudioContext;
    } catch {
        return null;
    }
}

/**
 * Joue une signature sonore synthétisée en temps réel sans latence ni requête réseau :
 * - VALID : Onde sinusoïdale 800 Hz -> montée légère 1000 Hz (160 ms)
 * - ALREADY_USED / REJECT : Buzzer grave en dents de scie (sawtooth) à 200 Hz (400 ms)
 * - INVALID : Buzzer tranchant onde carrée (square) à 150 Hz (350 ms)
 * - WRONG_EVENT : Alarme bitonale 350 Hz (250 ms)
 * - QR_EXPIRED / ALERT / CASH_REQUIRED : Onde carrée 440 Hz pulsée (3 bips staccato de 80 ms)
 * - NETWORK_ERROR : Bip neutre sinusoïdal 300 Hz (200 ms)
 */
export function playAudioFeedback(type: CombatFeedbackType): boolean {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
        const now = ctx.currentTime;

        if (type === 'valid') {
            // Son aigu cristallin 800 Hz (avec montée harmonique vers 1000 Hz)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
                osc.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
            }

            gain.gain.setValueAtTime(0.25, now);
            if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            }

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
            return true;
        }

        if (type === 'already_used' || type === 'reject') {
            // Buzzer rugueux 200 Hz en dent de scie
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);

            gain.gain.setValueAtTime(0.3, now);
            if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            }

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.4);
            return true;
        }

        if (type === 'invalid') {
            // Buzzer d'erreur grave 150 Hz onde carrée
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);

            gain.gain.setValueAtTime(0.28, now);
            if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            }

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
            return true;
        }

        if (type === 'wrong_event') {
            // Signal bitonal d'incompatibilité 350 Hz -> 250 Hz
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, now);
            if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
                osc.frequency.exponentialRampToValueAtTime(250, now + 0.25);
            }

            gain.gain.setValueAtTime(0.3, now);
            if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            }

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
            return true;
        }

        if (type === 'qr_expired' || type === 'alert' || type === 'cash_required') {
            // 3 bips staccato à 440 Hz
            const offsets = [0, 0.11, 0.22];
            for (const offset of offsets) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(440, now + offset);

                gain.gain.setValueAtTime(0.2, now + offset);
                if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
                    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
                }

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + offset);
                osc.stop(now + offset + 0.08);
            }
            return true;
        }

        if (type === 'network_error') {
            // Tonalité neutre d'attente technique 300 Hz
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);

            gain.gain.setValueAtTime(0.2, now);
            if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            }

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.2);
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

// ── 3. FEEDBACK SENSORIEL COMBINÉ (HAPTIQUE + AUDIO SYNTHÉTISÉ) ──────

/**
 * Déclenche simultanément le canal haptique et le canal audio de combat.
 */
export function triggerCombatSensoryFeedback(type: CombatFeedbackType): CombatFeedbackResult {
    const haptic = triggerHapticFeedback(type);
    const audio = playAudioFeedback(type);
    return { haptic, audio };
}
