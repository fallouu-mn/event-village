/**
 * Design 1a (direction.md, sections 5 et 9, décision 2) — repère « Repère » des événements sur la carte : petit billet à
 * encoches, talon perforé à l'orange de la marque, pointe vers le lieu. Rendu en HTML pour un `L.divIcon` de Leaflet (style
 * `.ev-repere` dans app/globals.css), sans dépendance : importable partout.
 *
 *  - `prix` : « 10 000 F » ou « Gratuit », sur le fond du thème ;
 *  - `choisi` et `une` (« À la une ») : sur l'orange de la marque, texte #1A1A1A (7,42:1) ;
 *  - `pile` : regroupement (« 3 événements »), pile de billets avec le nombre ; le toucher agrandit le plan (Leaflet).
 * Zone tactile de 44 px au moins. Le nom accessible du repère est l'`alt` du marqueur Leaflet (ou `label` ici).
 */
export type MarkerKind = 'prix' | 'choisi' | 'une' | 'pile';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** HTML du repère ; `text` : prix, « À la une » ou nombre d'événements selon `kind`. */
export function mapMarkerHtml(kind: MarkerKind, text: string): string {
  const t = escapeHtml(text);
  if (kind === 'pile') {
    return `<span class="ev-repere ev-repere--pile"><span class="ev-repere__billet">${t}</span></span>`;
  }
  return `<span class="ev-repere ev-repere--${kind}"><span class="ev-repere__billet"><span class="ev-repere__talon" aria-hidden="true"></span>${t}</span></span>`;
}

/** Libellé d'un regroupement : « 1 événement », « 3 événements ». */
export function clusterLabel(count: number): string {
  return `${count} ${count > 1 ? 'événements' : 'événement'}`;
}
