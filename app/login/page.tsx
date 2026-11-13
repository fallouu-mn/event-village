import { Logo } from '@/components/ui/Logo';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeInternalPath } from '@/lib/auth/safe-redirect';

/**
 * Connexion (lot 6, contrat A5) : composant serveur. Les paramètres d'URL (`error`, `message`, `reset`, `redirect`)
 * sont lus ici et passés au formulaire client : la page arrive avec son formulaire dès le premier rendu
 * (plus de repli Suspense sans formulaire, cause de la course de e2e/auth.setup.ts:16-17 au lot 5).
 */

interface LoginPageProps {
    searchParams?: Record<string, string | string[] | undefined>;
}

/** Première valeur d'un paramètre d'URL (un paramètre répété garde sa première occurrence). */
function firstParam(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
    // Lot 9 quater (A1 : AUD-17, G-03) : seul un chemin interne du site est transmis au formulaire, sinon « / »
    const redirectUrl = safeInternalPath(firstParam(searchParams?.redirect)) ?? '/';
    const errorParam = firstParam(searchParams?.error);
    const messageParam = firstParam(searchParams?.message);
    const resetParam = firstParam(searchParams?.reset);

    return (
        <div className="flex justify-center py-4 sm:py-8">
            <div className="w-full max-w-md space-y-5">
                <div className="flex justify-center">
                    <Logo variant="full" />
                </div>
                <PageHeader
                    title="Connexion"
                    description="Accédez à vos billets, commandes, réservations et portefeuille."
                    className="pb-0 sm:pb-0"
                />
                <LoginForm redirectUrl={redirectUrl} errorParam={errorParam} messageParam={messageParam} resetParam={resetParam} />
            </div>
        </div>
    );
}
