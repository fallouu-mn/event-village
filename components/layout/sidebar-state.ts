/**
 * Design 1e (point 3) — barre latérale repliée ou non, gardée sur l'appareil. Le script ci-dessous tourne dans <head>
 * avant le premier affichage (app/layout.tsx, comme le script du thème) et pose <html data-sidebar="replie"> : la barre
 * s'affiche directement dans le bon état, sans saut. Stockage refusé (navigation privée, données bloquées) : barre
 * dépliée, sans erreur visible.
 */
export const SIDEBAR_KEY = 'ev-barre-laterale';
export const SIDEBAR_COLLAPSED = 'replie';

export const SIDEBAR_BOOT_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_KEY}')==='${SIDEBAR_COLLAPSED}')document.documentElement.dataset.sidebar='${SIDEBAR_COLLAPSED}'}catch(e){}`;
