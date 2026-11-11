import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { noStore } from '@/lib/auth/account-sync';
import { requireActiveSession } from '@/lib/auth/session';
import { sendEmailVerification } from '@/lib/email/verification';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/account/email/resend';
const FALLBACK = { message: 'Le lien n’a pas pu être envoyé. Réessayez dans un instant.', code: 'EMAIL_RESEND_FAILED' };

const NO_EMAIL_TO_VERIFY = new PublicError('Aucune adresse email à vérifier : ajoutez d’abord une adresse dans votre profil.', 'NO_EMAIL_TO_VERIFY', 400);
const EMAIL_TAKEN = new PublicError('Cette adresse est déjà vérifiée sur un autre compte Event Village.', 'EMAIL_TAKEN', 409);
const NOT_CONFIGURED = new PublicError(
    'L’envoi des emails n’est pas encore disponible. Votre adresse est enregistrée : vous pourrez la vérifier plus tard.',
    'EMAIL_NOT_CONFIGURED',
    503,
);
const NOT_SENT = new PublicError('Le lien n’a pas pu être envoyé. Réessayez dans quelques minutes.', 'EMAIL_NOT_SENT', 502);

function rateLimited(retryAfterSeconds: number): NextResponse {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    const res = NextResponse.json(
        { error: `Trop de liens demandés. Réessayez dans ${minutes} ${minutes > 1 ? 'minutes' : 'minute'}.`, code: 'EMAIL_VERIFY_RATE_LIMITED' },
        { status: 429 },
    );
    res.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
    return res;
}

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;
    try {
        const result = await sendEmailVerification(session.user.id);
        switch (result.outcome) {
            case 'SENT':
                return NextResponse.json({ sent: true });
            case 'NOT_CONFIGURED':
                return apiFailure(CONTEXT, NOT_CONFIGURED, FALLBACK);
            case 'RATE_LIMITED':
                return rateLimited(result.retryAfterSeconds);
            case 'REFUSED':
                return apiFailure(CONTEXT, result.code === 'EMAIL_TAKEN' ? EMAIL_TAKEN : NO_EMAIL_TO_VERIFY, FALLBACK);
            default:
                return apiFailure(CONTEXT, NOT_SENT, FALLBACK);
        }
    } catch (err) {
        return apiFailure(CONTEXT, err, FALLBACK);
    }
}

/**
 * POST /api/account/email/resend — lot 9 bis, tâche 48 (R87 ; contrat 4.6) : renvoie le lien de vérification de
 * l'adresse en attente (ou de l'adresse réelle non vérifiée d'un compte d'avant le lot, B98) du compte de la session
 * (ACTIF ou EN_ATTENTE). 200 { sent: true } ; 400 NO_EMAIL_TO_VERIFY ; 409 EMAIL_TAKEN ; 429
 * EMAIL_VERIFY_RATE_LIMITED (trois liens par heure et par compte, cinq par jour et par adresse) ; 503
 * EMAIL_NOT_CONFIGURED sans RESEND_API_KEY (aucun quota consommé) ; 502 EMAIL_NOT_SENT si le fournisseur refuse.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
