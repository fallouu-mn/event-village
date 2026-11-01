import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LinkButton } from './LinkButton';
import { cn } from './cn';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Boutons d'action : ils passent à la ligne sous le titre à 390 px. */
  actions?: React.ReactNode;
  /** Ligne au-dessus du titre (badge de statut, rubrique). */
  eyebrow?: React.ReactNode;
  /** Lien de retour (« Retour à la liste »). */
  back?: { href: string; label: string };
  className?: string;
}

/** En-tête d'écran (contrat Q) : un seul <h1>, description, actions qui passent à la ligne. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, eyebrow, back, className }) => (
  <header className={cn('flex flex-col gap-3 pb-4 sm:pb-6', className)}>
    {back && (
      <div>
        <LinkButton href={back.href} variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">
          {back.label}
        </LinkButton>
      </div>
    )}
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>}
        <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-base leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  </header>
);
