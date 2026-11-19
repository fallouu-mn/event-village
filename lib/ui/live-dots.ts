/**
 * Décision du 18/11 (aucune animation en boucle infinie) — point « En cours » (`.ev-live-dot`) : son halo pulse 3 fois
 * puis reste fixe (app/globals.css), et seulement à l'écran. Le halo est en pause tant que le point n'est pas visible ;
 * cet observateur pose `data-ev-onscreen` sur chaque point visible et le retire quand il sort de l'écran.
 *
 * Un seul observateur pour toute la page, quel que soit le nombre de composants qui l'appellent (compteur) ; il suit
 * aussi les points ajoutés après coup (badge affiché à la minute du début, cartes « Voir plus »).
 */
const DOT = '.ev-live-dot';
let users = 0;
let stop: (() => void) | null = null;

function start(): () => void {
    if (typeof IntersectionObserver !== 'function' || typeof MutationObserver !== 'function') {
        // Navigateur ancien : halo laissé en pause (point fixe), jamais d'animation hors de l'écran
        return () => undefined;
    }
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (e.isIntersecting) e.target.setAttribute('data-ev-onscreen', '');
            else e.target.removeAttribute('data-ev-onscreen');
        }
    });
    const scan = (): void => {
        document.querySelectorAll(DOT).forEach((el) => {
            if (seen.has(el)) return;
            seen.add(el);
            io.observe(el);
        });
    };
    let frame = 0;
    const mo = new MutationObserver(() => {
        if (frame) return;
        frame = requestAnimationFrame(() => { frame = 0; scan(); });
    });
    scan();
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
        mo.disconnect();
        io.disconnect();
        if (frame) cancelAnimationFrame(frame);
    };
}

/** À appeler dans un effet ; rend la fonction de nettoyage. */
export function watchLiveDots(): () => void {
    users += 1;
    if (users === 1) stop = start();
    return () => {
        users -= 1;
        if (users === 0 && stop) {
            stop();
            stop = null;
        }
    };
}
