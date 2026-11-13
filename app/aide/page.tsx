import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, Mail, MessageCircle, Phone, ShieldAlert, Store, Ticket, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { displayPhone, getSupportContact, hasSupportContact, type SupportContact } from '@/lib/support-contact';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Aide et contact — Event Village',
    description: 'Joindre le support Event Village et réponses courtes : billet, remboursement, mot de passe, compte suspendu, devenir organisateur.',
};

/**
 * Lot 9 quinquies (B1 : AUTH-06) — page publique d'aide (servie sans session) : le contact du support (réglages du
 * SUPERADMIN support.whatsapp, support.phone, support.email) et cinq réponses courtes. Chaque message « contactez le
 * support » de l'application renvoie ici. Contact illisible : la page le dit, jamais un contact inventé.
 */

const ANSWERS: Array<{ id: string; title: string; icon: React.ReactNode; body: React.ReactNode }> = [
    {
        id: 'billet',
        title: 'Mon billet',
        icon: <Ticket size={20} aria-hidden="true" />,
        body: (
            <>
                Vos billets sont dans <Link href="/tickets" className="font-semibold text-brand-fg underline underline-offset-4">Mes billets</Link>.
                Ouvrez votre billet avec du réseau avant d’arriver : il reste disponible sans connexion. À l’entrée, si le QR code
                ne passe pas, donnez le numéro du billet et une pièce d’identité.
            </>
        ),
    },
    {
        id: 'remboursement',
        title: 'Un remboursement',
        icon: <Undo2 size={20} aria-hidden="true" />,
        body: (
            <>
                Un événement annulé est remboursé automatiquement sur le compte Wave ou Orange Money qui a payé ; vous êtes
                prévenu par SMS. Un billet acheté au guichet est remboursé par l’organisateur. Le suivi est dans Mes billets,
                onglet Historique.
            </>
        ),
    },
    {
        id: 'mot-de-passe',
        title: 'Mot de passe oublié',
        icon: <KeyRound size={20} aria-hidden="true" />,
        body: (
            <>
                Sur la page de connexion, choisissez <Link href="/forgot-password" className="font-semibold text-brand-fg underline underline-offset-4">Mot de passe oublié</Link> :
                un code arrive par SMS (ou un lien par email si votre adresse est vérifiée). Si vous recevez un message de
                changement de mot de passe que vous n’avez pas demandé, faites-le tout de suite.
            </>
        ),
    },
    {
        id: 'compte-suspendu',
        title: 'Compte suspendu',
        icon: <ShieldAlert size={20} aria-hidden="true" />,
        body: (
            <>
                Le motif vous a été envoyé par SMS. Vos billets payés restent valables à l’entrée. Pour comprendre la
                suspension ou demander la réactivation, contactez le support avec les moyens ci-dessus.
            </>
        ),
    },
    {
        id: 'organisateur',
        title: 'Devenir organisateur',
        icon: <Store size={20} aria-hidden="true" />,
        body: (
            <>
                Créez un compte partenaire depuis <Link href="/partner/register" className="font-semibold text-brand-fg underline underline-offset-4">l’espace professionnel</Link>,
                avec vos pièces. Votre demande est examinée sous 48 heures ; vous êtes prévenu par SMS.
            </>
        ),
    },
];

function ContactList({ contact }: { contact: SupportContact }) {
    const items: Array<{ key: string; href: string; label: string; icon: React.ReactNode }> = [];
    if (contact.whatsapp) items.push({ key: 'whatsapp', href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`, label: `WhatsApp : ${displayPhone(contact.whatsapp)}`, icon: <MessageCircle size={20} aria-hidden="true" /> });
    if (contact.phone) items.push({ key: 'phone', href: `tel:${contact.phone}`, label: `Téléphone : ${displayPhone(contact.phone)}`, icon: <Phone size={20} aria-hidden="true" /> });
    if (contact.email) items.push({ key: 'email', href: `mailto:${contact.email}`, label: `Email : ${contact.email}`, icon: <Mail size={20} aria-hidden="true" /> });
    return (
        <ul className="space-y-2">
            {items.map((i) => (
                <li key={i.key}>
                    <a
                        href={i.href}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface-sunken p-3 text-sm font-semibold text-fg transition-colors duration-200 hover:border-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...(i.key === 'whatsapp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg">{i.icon}</span>
                        <span className="min-w-0 break-words">{i.label}</span>
                    </a>
                </li>
            ))}
        </ul>
    );
}

export default async function AidePage() {
    let contact: SupportContact | null = null;
    try {
        contact = await getSupportContact();
    } catch (err) {
        console.error('[/aide] contact du support illisible :', err instanceof Error ? err.message : String(err));
    }

    return (
        <div className="mx-auto w-full max-w-2xl space-y-6 py-4 sm:py-8">
            <PageHeader title="Aide et contact" description="Joindre le support Event Village et réponses aux questions les plus fréquentes." />

            <section aria-labelledby="aide-contact" className="space-y-3 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
                <h2 id="aide-contact" className="text-lg font-bold text-fg">Contacter le support</h2>
                {contact && hasSupportContact(contact) ? (
                    <ContactList contact={contact} />
                ) : (
                    <StatusBanner tone="warning" title="Contact du support pas encore renseigné">
                        {contact
                            ? 'Le contact du support n’est pas encore publié. Réessayez plus tard.'
                            : 'Le contact du support est momentanément indisponible. Rechargez la page dans un instant.'}
                    </StatusBanner>
                )}
            </section>

            <section aria-labelledby="aide-questions" className="space-y-3">
                <h2 id="aide-questions" className="text-lg font-bold text-fg">Réponses courtes</h2>
                <div className="space-y-3">
                    {ANSWERS.map((a) => (
                        <article key={a.id} id={a.id} className="space-y-2 rounded-3xl border border-border bg-surface p-5 shadow-sm">
                            <h3 className="flex items-center gap-2 text-base font-bold text-fg">
                                <span className="text-brand-fg">{a.icon}</span>
                                {a.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-fg">{a.body}</p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
