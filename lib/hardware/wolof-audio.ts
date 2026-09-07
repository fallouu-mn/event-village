/**
 * Service Audio Autonome pour la Vocalisation Wolof / Français
 * Scanner Contrôleur — UX Terrain / Résilience Tolérance Zéro
 * 
 * - Ne bloque jamais le scanner (asynchrone avec gestion d'erreur fail-safe)
 * - Empêche les lectures simultanées superposées (stop automatique de l'audio précédent)
 * - Mute persistant dans le localStorage ('event_village_wolof_muted')
 * - Supporte le rejeu immédiat via bouton "Répéter en Wolof"
 * - Tolérant à l'absence de fichiers MP3 et aux restrictions d'autoplay navigateur
 */

export type WolofAudioType = 'ALREADY_USED' | 'INVALID' | 'WRONG_EVENT';
export type AudioLanguage = 'wolof' | 'fr';

export interface PlayWolofResult {
    success: boolean;
    played: boolean;
    type?: WolofAudioType;
    reason?: 'MUTED' | 'SSR_OR_NO_AUDIO_API' | 'FILE_NOT_FOUND' | 'AUTOPLAY_BLOCKED' | 'UNKNOWN_TYPE' | 'SUCCESS';
    error?: unknown;
}

const STORAGE_KEY_MUTED = 'event_village_wolof_muted';

// Descriptions textuelles et transcriptions conceptuelles
export const WOLOF_AUDIO_MESSAGES: Record<WolofAudioType, { wolof: string; fr: string; filename: string }> = {
    ALREADY_USED: {
        wolof: 'Billet bi ñu scan nañ ko ba pare.',
        fr: 'Billet déjà scanné et utilisé.',
        filename: 'already-used.mp3',
    },
    INVALID: {
        wolof: 'Billet bi baaxul.',
        fr: 'Billet invalide ou non reconnu.',
        filename: 'invalid.mp3',
    },
    WRONG_EVENT: {
        wolof: 'Billet bi du fi.',
        fr: 'Ce billet n\'est pas pour cet événement.',
        filename: 'wrong-event.mp3',
    },
};

// Instance singleton locale
let activeAudio: HTMLAudioElement | null = null;
let lastPlayedAudioType: WolofAudioType | null = null;

/**
 * Récupère de manière sécurisée l'instance localStorage (compatible SSR, Browser et Tests)
 */
function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    } catch {
        return null;
    }
}

/**
 * Normalise un type de résultat de scan en type de vocalisation Wolof
 */
export function normalizeWolofAudioType(type: string | null | undefined): WolofAudioType | null {
    if (!type) return null;
    const upper = type.toUpperCase().replace('-', '_');
    if (upper === 'ALREADY_USED' || upper === 'ALREADYUSED') return 'ALREADY_USED';
    if (upper === 'INVALID' || upper === 'ANNULE' || upper === 'REMBOURSE') return 'INVALID';
    if (upper === 'WRONG_EVENT' || upper === 'UNAUTHORIZED' || upper === 'EVENT_ENDED' || upper === 'EVENT_SUSPENDED' || upper === 'EVENT_NOT_READY') {
        return 'WRONG_EVENT';
    }
    return null;
}

/**
 * Vérifie si un résultat de scan dispose d'une vocalisation Wolof associée
 */
export function hasWolofAudio(type: string | null | undefined): boolean {
    return normalizeWolofAudioType(type) !== null;
}

/**
 * Récupère l'URL du fichier audio correspondant
 */
export function getWolofAudioUrl(type: WolofAudioType, lang: AudioLanguage = 'wolof'): string {
    const config = WOLOF_AUDIO_MESSAGES[type];
    const filename = config ? config.filename : 'invalid.mp3';
    return `/sounds/${lang}/${filename}`;
}

/**
 * Vérifie si la voix Wolof est actuellement en mode silencieux (Mute)
 */
export function isWolofMuted(): boolean {
    const storage = getStorage();
    if (!storage) return false;
    try {
        const stored = storage.getItem(STORAGE_KEY_MUTED);
        return stored === 'true';
    } catch {
        return false;
    }
}

/**
 * Modifie l'état de mise en sourdine de la voix Wolof (persistant)
 */
export function setWolofMuted(muted: boolean): void {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(STORAGE_KEY_MUTED, muted ? 'true' : 'false');
    } catch {
        // Silencieux si localStorage inaccessible (mode privé strict)
    }
}

/**
 * Bascule l'état de mise en sourdine (toggle)
 */
export function toggleWolofMuted(): boolean {
    const newMuted = !isWolofMuted();
    setWolofMuted(newMuted);
    if (newMuted) {
        stopWolofAudio();
    }
    return newMuted;
}

/**
 * Arrête immédiatement toute lecture audio Wolof en cours
 */
export function stopWolofAudio(): void {
    if (activeAudio) {
        try {
            activeAudio.pause();
            activeAudio.currentTime = 0;
            activeAudio.src = '';
        } catch {
            // Silencieux
        }
        activeAudio = null;
    }
}

/**
 * Retourne le dernier type d'audio Wolof joué ou demandé
 */
export function getLastWolofAudioType(): WolofAudioType | null {
    return lastPlayedAudioType;
}

/**
 * Déclenche la lecture vocale Wolof pour un type d'erreur donné.
 * 
 * - Ne bloque jamais l'exécution du code appelant
 * - Arrête immédiatement l'audio en cours avant de démarrer
 * - Respecte le mode silencieux (sauf si forceEvenIfMuted=true lors d'une action manuelle explicite)
 */
export async function playWolofAudio(
    rawType: WolofAudioType | string,
    lang: AudioLanguage = 'wolof',
    forceEvenIfMuted: boolean = false
): Promise<PlayWolofResult> {
    const type = normalizeWolofAudioType(rawType);
    if (!type) {
        return { success: true, played: false, reason: 'UNKNOWN_TYPE' };
    }

    lastPlayedAudioType = type;

    // 1. Vérification de l'environnement (Browser vs Node/SSR)
    if (typeof window === 'undefined' || typeof (window as any).Audio === 'undefined') {
        return { success: true, played: false, type, reason: 'SSR_OR_NO_AUDIO_API' };
    }

    // 2. Vérification du statut Mute
    if (isWolofMuted() && !forceEvenIfMuted) {
        return { success: true, played: false, type, reason: 'MUTED' };
    }

    // 3. Arrêt de la piste précédente pour éviter la cacophonie
    stopWolofAudio();

    // 4. Instanciation sécurisée de l'Audio
    try {
        const audioUrl = getWolofAudioUrl(type, lang);
        const AudioClass = (window as any).Audio;
        const audio = new AudioClass(audioUrl) as HTMLAudioElement;
        activeAudio = audio;

        // Configuration pour une réponse immédiate
        audio.preload = 'auto';

        return new Promise<PlayWolofResult>((resolve) => {
            let hasResolved = false;

            const cleanupAndResolve = (result: PlayWolofResult) => {
                if (hasResolved) return;
                hasResolved = true;
                resolve(result);
            };

            // Écouteur d'erreur de chargement (ex: fichier MP3 absent)
            audio.addEventListener('error', () => {
                cleanupAndResolve({
                    success: true, // Le scanner continue normalement
                    played: false,
                    type,
                    reason: 'FILE_NOT_FOUND',
                });
            }, { once: true });

            audio.addEventListener('ended', () => {
                if (activeAudio === audio) {
                    activeAudio = null;
                }
            }, { once: true });

            // Tentative de lecture avec capture du rejet de promesse (ex: blocage autoplay)
            try {
                const playPromise = audio.play();

                if (playPromise !== undefined && typeof playPromise.then === 'function') {
                    playPromise
                        .then(() => {
                            cleanupAndResolve({
                                success: true,
                                played: true,
                                type,
                                reason: 'SUCCESS',
                            });
                        })
                        .catch((err) => {
                            cleanupAndResolve({
                                success: true,
                                played: false,
                                type,
                                reason: 'AUTOPLAY_BLOCKED',
                                error: err,
                            });
                        });
                } else {
                    cleanupAndResolve({
                        success: true,
                        played: true,
                        type,
                        reason: 'SUCCESS',
                    });
                }
            } catch (syncErr) {
                cleanupAndResolve({
                    success: true,
                    played: false,
                    type,
                    reason: 'AUTOPLAY_BLOCKED',
                    error: syncErr,
                });
            }
        });
    } catch (err) {
        // Tolérance zéro aux crashs : retour silencieux et propre
        return {
            success: true,
            played: false,
            type,
            reason: 'AUTOPLAY_BLOCKED',
            error: err,
        };
    }
}

/**
 * Rejoue le dernier message Wolof (action manuelle du contrôleur via le bouton "Répéter en Wolof").
 * Répond au clic utilisateur, ce qui lève la restriction d'autoplay du navigateur.
 */
export async function repeatLastWolofAudio(
    lang: AudioLanguage = 'wolof',
    fallbackType?: WolofAudioType | string
): Promise<PlayWolofResult> {
    const targetType = lastPlayedAudioType || normalizeWolofAudioType(fallbackType);
    if (!targetType) {
        return { success: true, played: false, reason: 'UNKNOWN_TYPE' };
    }

    // Lors d'une interaction explicite de répétition, si l'utilisateur appuie sur "Répéter",
    // on joue le son même si le mute global était actif.
    return playWolofAudio(targetType, lang, true);
}
