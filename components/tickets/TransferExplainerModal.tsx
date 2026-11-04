'use client';

import React from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ChevronDown, Send, Smartphone, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/**
 * Aide au transfert d'un billet (écran Mes billets). Lot 7 (7.0 f) : rendue par Modal (titre lié, Escape, piège de
 * focus, bouton Fermer de 44 px), sans framer-motion ; jetons du système de design, 14 px au moins.
 * Questions fréquentes en <details>/<summary> natifs : ouverture au clavier et annoncée sans script, aucune
 * animation de hauteur (seule la flèche tourne, et seulement sans « réduire les animations »).
 * Contenu exact : le PDF n'a pas de QR et ne permet pas d'entrer (lib/tickets/ticket-pdf.service.ts) ; le code
 * change toutes les 20 s (lib/security/totp.ts, TOTP_STEP_SECONDS) ; un transfert attend 48 h
 * (lib/tickets/ticket-transfer.service.ts) ; un transfert accepté change le secret du billet (lot 7, 7.1).
 */

interface TransferExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS: Array<{ title: string; text: string; icon: React.ReactNode }> = [
  {
    title: 'Indiquez le destinataire',
    text: 'Saisissez son numéro de téléphone. Le transfert est gratuit.',
    icon: <Smartphone size={18} aria-hidden="true" />,
  },
  {
    title: 'Il est prévenu par SMS',
    text: 'Votre proche reçoit un SMS. Il se connecte avec ce numéro et accepte le billet dans « Mes billets » sous 48 heures.',
    icon: <Send size={18} aria-hidden="true" />,
  },
  {
    title: 'Le billet est à lui',
    text: 'Le billet passe sur son compte avec un nouveau code d’entrée. L’ancien code ne fonctionne plus.',
    icon: <UserCheck size={18} aria-hidden="true" />,
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Mon proche doit-il avoir un compte pour recevoir le billet ?',
    a: 'Oui. Le compte est gratuit et se crée en quelques instants avec le numéro auquel vous envoyez le billet, confirmé par un code SMS. Lui seul peut ensuite présenter ce billet.',
  },
  {
    q: 'Pourquoi une capture d’écran ne fonctionne-t-elle pas ?',
    a: 'Le code d’entrée change toutes les 20 secondes. Une capture garde un code figé, refusé par les contrôleurs à l’entrée.',
  },
  {
    q: 'Que se passe-t-il si le destinataire n’accepte pas le billet ?',
    a: 'Le transfert reste en attente pendant 48 heures. Sans réponse dans ce délai, le billet revient dans vos billets sans aucune action de votre part.',
  },
  {
    q: 'Puis-je annuler le transfert si je me suis trompé de numéro ?',
    a: 'Oui. Tant que le destinataire n’a pas accepté le billet, touchez « Annuler le transfert » sur la carte du billet. Le billet vous revient aussitôt.',
  },
  {
    q: 'Puis-je télécharger le billet en PDF et l’imprimer ?',
    a: 'Le PDF n’est pas un billet d’entrée : il ne contient pas de QR. À l’entrée, ouvrez le billet dans l’application ; il reste disponible sans réseau si vous l’avez ouvert avant d’arriver.',
  },
];

export const TransferExplainerModal: React.FC<TransferExplainerModalProps> = ({ isOpen, onClose }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Comment fonctionne le transfert ?"
    subtitle="Donnez un billet à un proche en trois étapes."
    icon={<ArrowRightLeft size={20} />}
    maxWidth="2xl"
    footer={(
      <Button variant="primary" onClick={onClose} fullWidth className="sm:w-auto">
        J’ai compris
      </Button>
    )}
  >
    <div className="space-y-6 text-sm text-fg">
      <section aria-labelledby="transfert-etapes" className="space-y-3">
        <h3 id="transfert-etapes" className="text-sm font-semibold text-fg-muted">Les trois étapes</h3>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-sunken p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg text-sm font-bold text-brand-fg" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="text-brand-fg">{step.icon}</span>
              </div>
              <p className="font-semibold text-fg">
                <span className="sr-only">{`Étape ${index + 1} : `}</span>
                {step.title}
              </p>
              <p className="leading-relaxed text-fg-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="transfert-pourquoi" className="space-y-3">
        <h3 id="transfert-pourquoi" className="text-sm font-semibold text-fg-muted">Pourquoi passer par le transfert</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 rounded-2xl border border-danger-border bg-danger-bg p-4">
            <p className="flex items-center gap-2 font-semibold text-danger-fg">
              <AlertTriangle size={16} aria-hidden="true" />
              Capture d’écran : refusée
            </p>
            <p className="leading-relaxed text-fg">
              Le code change toutes les 20 secondes : une capture est refusée à l’entrée.
            </p>
          </div>
          <div className="space-y-1.5 rounded-2xl border border-success-border bg-success-bg p-4">
            <p className="flex items-center gap-2 font-semibold text-success-fg">
              <CheckCircle2 size={16} aria-hidden="true" />
              Transfert : accepté
            </p>
            <p className="leading-relaxed text-fg">
              Votre proche présente son propre billet, à son nom de compte, depuis son téléphone.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="transfert-questions" className="space-y-2">
        <h3 id="transfert-questions" className="text-sm font-semibold text-fg-muted">Questions fréquentes</h3>
        <div className="space-y-2">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group overflow-hidden rounded-2xl border border-border bg-surface">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-fg transition-colors duration-200 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>{faq.q}</span>
                <ChevronDown size={18} className="flex-shrink-0 text-fg-muted motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="border-t border-border px-4 py-3 leading-relaxed text-fg-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  </Modal>
);
