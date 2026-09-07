/**
 * Module de contrôle matériel de la torche (Flashlight)
 * Utilise l'API WebRTC MediaStreamTrack.applyConstraints.
 * Gère gracieusement le fallback sans jamais faire crasher le flux vidéo.
 */

export interface TorchToggleResult {
    success: boolean;
    isOn: boolean;
    error?: string;
}

/**
 * Vérifie si la piste vidéo supporte le contrôle matériel de la torche.
 * Résistant aux environnements non compatibles (iOS Safari, caméras frontales, webcams PC).
 */
export function isTorchSupported(track: MediaStreamTrack | null | undefined): boolean {
    if (!track) return false;
    if (typeof track.getCapabilities !== 'function') return false;

    try {
        const capabilities = track.getCapabilities() as any;
        return Boolean(capabilities && capabilities.torch);
    } catch {
        return false;
    }
}

/**
 * Active ou désactive la torche matérielle sur la piste vidéo active.
 * 
 * @param track La piste vidéo active (issue de stream.getVideoTracks()[0])
 * @param enabled true pour allumer, false pour éteindre
 * @returns Résultat de l'opération avec statut success/error
 */
export async function setTorchState(
    track: MediaStreamTrack | null | undefined,
    enabled: boolean
): Promise<TorchToggleResult> {
    if (!track) {
        return {
            success: false,
            isOn: false,
            error: 'Aucune piste vidéo active disponible.',
        };
    }

    if (typeof track.applyConstraints !== 'function') {
        return {
            success: false,
            isOn: false,
            error: 'applyConstraints non supporté par ce navigateur.',
        };
    }

    try {
        await track.applyConstraints({
            advanced: [{ torch: enabled } as any],
        });

        return {
            success: true,
            isOn: enabled,
        };
    } catch (err: any) {
        // En cas de rejet par le matériel ou le navigateur
        return {
            success: false,
            isOn: false,
            error: err?.message || 'Impossible de modifier l\'état de la torche.',
        };
    }
}
