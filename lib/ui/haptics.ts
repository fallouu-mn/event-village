/**
 * Design 1d (point 10) — vibration légère (12 ms) au favori ajouté et à l'achat confirmé, quand le téléphone sait le
 * faire. Jamais d'erreur : un navigateur sans vibration (iPhone, ordinateur) ou qui la refuse ne fait rien.
 */
export function lightVibration(): void {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
    } catch {
        // vibration refusée par le navigateur : rien d'autre à faire
    }
}
