/**
 * Design 1b (décision 3 de l'utilisateur, scanner) — préchargement des morceaux accessoires (cartes des toasts, barre de
 * progression de navigation) quand le navigateur est libre, MAIS jamais pendant qu'une page charge son premier écran
 * utile côté client.
 *
 * Pourquoi : le scanner attend ses affectations (réseau) avant son écran de départ ; pendant cette attente le navigateur
 * est « libre » et requestIdleCallback lançait ces préchargements, qui arrivaient avant l'écran utile (run 376 :
 * 261,1 Ko de JavaScript avant le marqueur pour 254,9 Ko permis ; 240,3 Ko pour l'écran lui-même, + 12,3 Ko de
 * préchargement de la page profil, + ≈ 8,5 Ko de toasts et de barre).
 *
 * Règle : une page qui charge son premier écran rend un élément `[data-ev-hold-warm]` (ex. l'écran « Chargement de vos
 * événements… » du scanner) ; le préchargement attend qu'il n'y en ait plus, puis le prochain moment libre. Garde-fou :
 * au plus `maxHoldMs` d'attente (20 s), le préchargement n'est jamais perdu. Sans réseau : rien (le morceau viendra à la
 * demande, ou le repli prévu par l'appelant).
 */
export const HOLD_WARM_ATTR = 'data-ev-hold-warm';

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/** Lance `run` au prochain moment libre une fois la page prête ; rend une fonction d'annulation (démontage). */
export function warmWhenIdle(run: () => void, fallbackMs = 3_000, maxHoldMs = 20_000): () => void {
    const w = window as IdleWindow;
    let cancelled = false;
    let idleId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const fire = (): void => {
        if (cancelled) return;
        if (navigator.onLine === false) return;
        run();
    };
    const schedule = (): void => {
        observer?.disconnect();
        observer = null;
        if (timer) clearTimeout(timer);
        timer = null;
        if (cancelled) return;
        if (w.requestIdleCallback) idleId = w.requestIdleCallback(fire);
        else timer = setTimeout(fire, fallbackMs);
    };
    const held = (): boolean => document.querySelector(`[${HOLD_WARM_ATTR}]`) !== null;

    if (!held()) {
        schedule();
    } else {
        observer = new MutationObserver(() => { if (!held()) schedule(); });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [HOLD_WARM_ATTR] });
        timer = setTimeout(schedule, maxHoldMs);
    }

    return () => {
        cancelled = true;
        observer?.disconnect();
        if (timer) clearTimeout(timer);
        if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
    };
}
