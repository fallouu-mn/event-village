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
export const MIGRATED_DESIGN_FILES: string[] = [
    // Composants partagés (fondations du système de design, contrat Q)
    'components/ui/Badge.tsx',
    'components/ui/Button.tsx',
    'components/ui/ConfirmDialog.tsx',
    'components/ui/DataList.tsx',
    'components/ui/EmptyState.tsx',
    'components/ui/Field.tsx',
    'components/ui/IconButton.tsx',
    'components/ui/KpiCard.tsx',
    'components/ui/LinkButton.tsx',
    'components/ui/LiveIndicator.tsx',
    'components/ui/Modal.tsx',
    'components/ui/PageHeader.tsx',
    'components/ui/Pagination.tsx',
    'components/ui/ReasonDialog.tsx',
    'components/ui/StatusBadge.tsx',
    'components/ui/StatusBanner.tsx',
    'components/ui/Tabs.tsx',
];
