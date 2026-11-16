/**
 * Correctifs de la contre-vérification de la finition 2a (T5) — nom d'un fichier produit par la route de dépôt
 * POST /api/partner/upload : horodatage en millisecondes (13 chiffres), « _ », 8 caractères hexadécimaux, « .webp ».
 * Seul un fichier ainsi nommé est accepté comme affiche (formulaire, route, base : event_poster_path_ok) : un fichier
 * déposé autrement (avant la finition, ou directement dans le stockage) n'a jamais ce nom. Module sans dépendance serveur
 * (partagé avec le formulaire).
 */
export const STORED_IMAGE_NAME_RE = /^\d{13}_[0-9a-f]{8}\.webp$/;
