/**
 * fetch sans cache pour les clients Supabase côté serveur.
 *
 * Next 14 met en cache par défaut les fetch faits pendant le traitement d'une route, POST compris, et
 * supabase-js passe par fetch : une lecture faite après une écriture pouvait renvoyer l'état d'avant
 * (constaté au lot 5 : la fiche admin relue après une validation restait « En attente », run CI 51), et une
 * vérification de session pouvait être servie depuis le cache. Les tests appellent les routes hors du
 * serveur Next et ne voyaient pas ce cache. Toute requête vers Supabase est donc faite en no-store.
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });
