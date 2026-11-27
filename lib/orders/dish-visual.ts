/**
 * Lot 12b, correctifs après contre-vérification (idée 13) — visuel dessiné d'un plat sans photo, choisi d'après le nom de
 * sa catégorie (puis le nom du plat) : fichiers locaux public/images/plats/<visuel>.svg, jamais une image d'un site
 * extérieur. Choisi par le serveur (lib/orders/menu.server.ts) : rien de ce tri n'entre dans le navigateur.
 */

export const DISH_VISUALS = ['plat', 'poisson', 'grillade', 'boisson', 'dessert', 'entree', 'sandwich', 'petit-dejeuner'] as const;
export type DishVisual = (typeof DISH_VISUALS)[number];

/** Mots reconnus, du plus précis au plus large (texte sans accents, en minuscules). */
const RULES: ReadonlyArray<[DishVisual, RegExp]> = [
    ['boisson', /\b(boissons?|jus|bissap|bouye|gingembre|cafe|the|attaya|soda|eaux?|cocktails?|smoothies?|lait|bieres?|vins?)\b/],
    ['dessert', /\b(desserts?|thiakry|thiacry|glaces?|gateaux?|patisseries?|douceurs?|cremes?|fruits?|sucre|beignets?|crepes?)\b/],
    ['petit-dejeuner', /\b(petits?[- ]dejeuners?|brunch|matin|viennoiseries?|omelettes?)\b/],
    ['sandwich', /\b(sandwichs?|burgers?|chawarmas?|shawarmas?|fataya|pains?|tacos|pizzas?|snacks?|fast[- ]?food)\b/],
    ['entree', /\b(entrees?|salades?|soupes?|accras?|nems?|pastels?|amuse)/],
    ['grillade', /\b(grillades?|grill|dibi|brochettes?|viandes?|poulet braise|braise|agneau|mouton|choukouya)\b/],
    ['poisson', /\b(poissons?|thieb|thieboudienne|ceebu|fruits de mer|crevettes?|yassa poisson|capitaine|thiof)\b/],
];

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Visuel d'un plat sans photo : d'après sa catégorie, sinon son nom, sinon « plat ». */
export function dishVisual(categoryName: string | null | undefined, productName: string | null | undefined): DishVisual {
    for (const text of [categoryName, productName]) {
        if (!text) continue;
        const t = fold(text);
        for (const [visual, re] of RULES) if (re.test(t)) return visual;
    }
    return 'plat';
}

/** Chemin public du visuel (fichier local). */
export function dishVisualSrc(visual: DishVisual): string {
    return `/images/plats/${DISH_VISUALS.includes(visual) ? visual : 'plat'}.svg`;
}
