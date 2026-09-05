export const EVENT_CATEGORIES = [
    { id: 'CONCERT', label: 'Concerts & Musique' },
    { id: 'FESTIVAL', label: 'Festivals' },
    { id: 'FOOD', label: 'Gastronomie & Tables' },
    { id: 'SALLE', label: 'Salles & Réceptions' },
] as const;

export type EventCategoryId = typeof EVENT_CATEGORIES[number]['id'];

export function getCategoryLabel(id: string | null | undefined): string {
    const found = EVENT_CATEGORIES.find((c) => c.id === id);
    return found ? found.label : 'Événement';
}
