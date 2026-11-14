/**
 * Lot 9 quinquies, correctifs de la contre-vérification (point 2) — identifiant de connexion GoTrue d'un compte, pour les
 * tests qui ouvrent une session directement chez GoTrue (signInWithPassword) au lieu de passer par POST /api/auth/login.
 *
 * Depuis la migration 20261112000012, auth.users.email n'est plus jamais l'adresse réelle ni le numéro : c'est une adresse
 * technique tirée d'une empreinte secrète (HMAC). Un test connaît l'adresse réelle (public.users.email), l'adresse
 * technique du profil rendue par l'inscription ou le numéro ; cette aide relit, dans la base LOCALE (lecture seule),
 * l'adresse que GoTrue attend. Avant la migration, elle rend l'adresse de auth.users, c'est-à-dire la même qu'avant :
 * l'aide est neutre sur l'état d'avant. Identifiant inconnu : rendu tel quel (le refus de GoTrue reste celui d'avant).
 *
 * Les tests qui ATTAQUENT GoTrue avec l'adresse réelle (contre-vérification, cv9qq-2 c) ne l'utilisent pas.
 * Modification d'aide signalée au rapport du lot (section « Correctifs de la contre-vérification »).
 */
import { inspect } from './db';

export async function gotrueEmail(identifier: string): Promise<string> {
    const id = String(identifier ?? '').trim();
    if (!id) return id;
    const found = await inspect(async (c) => (await c.query<{ email: string }>(
        `SELECT email FROM (
             SELECT a.email, 0 AS rank FROM auth.users a WHERE lower(a.email) = lower($1)
             UNION ALL
             SELECT a.email, 1 AS rank FROM public.users u JOIN auth.users a ON a.id = u.id
              WHERE lower(u.email) = lower($1) OR u.phone IN ($1, ltrim($1, '+'), '+' || ltrim($1, '+'))
         ) x
          WHERE email IS NOT NULL
          ORDER BY rank
          LIMIT 1`,
        [id],
    )).rows);
    return found[0]?.email ?? id;
}
