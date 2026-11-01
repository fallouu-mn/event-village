/**
 * Lot 5 — liste blanche des fichiers migrés sur le système de design (contrat, section Q).
 *
 * tests/parcours/design-systeme.test.ts applique à chaque fichier listé ici les règles du contrat Q :
 * aucune couleur codée en dur (#hex, slate-, zinc-, gray-, palette brute), aucun text-[9-13px], text-xs
 * réservé aux badges, horodatages secondaires et légendes, aucun « § », aucun emoji, aucun enum en dur
 * dans le JSX, aucun <Link><Button> imbriqué.
 *
 * Vide au départ : chaque correctif d'interface du lot 5 y ajoute, dans le même commit, les fichiers
 * qu'il crée ou qu'il touche. Chemins relatifs à la racine du dépôt, séparateur « / »
 * (par exemple 'components/ui/Modal.tsx').
 */
export const MIGRATED_DESIGN_FILES: string[] = [];
