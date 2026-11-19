import React from 'react';
import { cn } from './cn';

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Classe des cellules de la colonne (tableau). */
  className?: string;
  /** Masquée dans la carte mobile (déjà dans le titre de la carte, par exemple). */
  hideOnCard?: boolean;
}

export interface DataListProps<T> {
  items: T[];
  columns: DataColumn<T>[];
  getKey: (item: T) => string;
  /** Légende du tableau (lue par les lecteurs d'écran, masquée visuellement si `captionHidden`). */
  caption: string;
  captionHidden?: boolean;
  /** Carte mobile sur mesure ; sinon, les colonnes en liste de définitions. */
  renderCard?: (item: T) => React.ReactNode;
  /** Titre de la carte mobile par défaut. */
  cardTitle?: (item: T) => React.ReactNode;
  /** Affiché quand `items` est vide (EmptyState). */
  empty?: React.ReactNode;
  className?: string;
  /**
   * Largeur à partir de laquelle le tableau remplace les cartes. Design 1c : `lg` par défaut (à 768 px, cartes) ; `xl` pour
   * un tableau large dans une page à menu latéral (256 px à 1 024 px : la place manque) ; `md` pour un petit tableau.
   */
  breakpoint?: 'md' | 'lg' | 'xl';
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/** Tableau (affiché à partir du point de rupture) et cartes (en dessous). Classes écrites en entier pour Tailwind. */
const SHOW_TABLE = { md: 'hidden md:block', lg: 'hidden lg:block', xl: 'hidden xl:block' } as const;
const SHOW_CARDS = { md: 'md:hidden', lg: 'lg:hidden', xl: 'xl:hidden' } as const;

/**
 * Données tabulaires responsives (contrat Q) : cartes sous le point de rupture, tableau au-dessus ; jamais de défilement
 * horizontal à 390 px. Design 1c (contrôle responsive de la CI) : tableau à partir de lg par défaut (avant : md, des
 * colonnes entières étaient coupées à 768 et 1 024 px) ; cellules qui passent à la ligne ; en dernier recours, un tableau
 * plus large que sa boîte défile dans la boîte, jamais de texte masqué par le bord ; la page ne défile jamais en largeur.
 * Cartes : libellé au-dessus de la valeur sous 360 px (un mot long ne chevauche plus la valeur).
 */
export function DataList<T>({ items, columns, getKey, caption, captionHidden = true, renderCard, cardTitle, empty, className, breakpoint = 'lg' }: DataListProps<T>) {
  if (items.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={className}>
      <div className={cn(SHOW_TABLE[breakpoint], 'overflow-x-auto rounded-xl border border-border bg-card')}>
        <table className="w-full border-collapse text-sm">
          <caption className={cn('px-4 py-3 text-left text-sm font-semibold text-foreground-strong', captionHidden && 'sr-only')}>{caption}</caption>
          <thead className="bg-background">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 align-bottom font-semibold text-muted-foreground', ALIGN[c.align ?? 'left'], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={getKey(item)} className="border-t border-border">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle break-words text-foreground-strong', ALIGN[c.align ?? 'left'], c.className)}>
                    {c.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={cn(SHOW_CARDS[breakpoint], 'flex flex-col gap-3')} aria-label={caption}>
        {items.map((item) => (
          <li key={getKey(item)} className="rounded-xl border border-border bg-card p-4">
            {renderCard ? (
              renderCard(item)
            ) : (
              <>
                {cardTitle && <div className="mb-3 text-base font-semibold text-foreground-strong">{cardTitle(item)}</div>}
                <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm min-[360px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] min-[360px]:gap-y-2">
                  {columns.filter((c) => !c.hideOnCard).map((c) => (
                    <React.Fragment key={c.key}>
                      <dt className="min-w-0 break-words text-muted-foreground">{c.header}</dt>
                      <dd className="min-w-0 break-words text-foreground-strong max-[359px]:mb-1">{c.render(item)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
