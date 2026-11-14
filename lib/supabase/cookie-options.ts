/**
 * Lot 9 quinquies (A4 : AUTH-04) — options des cookies de session @supabase/ssr : attribut Secure en production.
 *
 * « Production » = application servie en HTTPS (NEXT_PUBLIC_APP_URL en https://) : le cookie de session ne part jamais
 * sur une connexion en clair. En local et en e2e (http://localhost), Secure n'est pas posé, sinon la session ne tiendrait
 * pas. SameSite=Lax et chemin « / » comme les valeurs par défaut de @supabase/ssr. HttpOnly reste impossible : le client
 * Supabase du navigateur lit sa session dans ce cookie (constat AUTH-04, mesure réaliste : durée et inactivité).
 * Module partagé (navigateur et serveur).
 */
export function secureCookies(): boolean {
    // indexOf (et non startsWith) : dans le navigateur, l'adresse est écrite à la construction et le minificateur réduit
    // toute l'expression à une constante (poids JavaScript commun, run 173)
    return (process.env.NEXT_PUBLIC_APP_URL || '').trim().toLowerCase().indexOf('https://') === 0;
}

export function supabaseCookieOptions(): { secure: boolean; sameSite: 'lax'; path: string } {
    return { secure: secureCookies(), sameSite: 'lax', path: '/' };
}
