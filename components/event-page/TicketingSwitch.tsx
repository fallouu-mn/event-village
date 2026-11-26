'use client';

import React, { useEffect, useId, useState, type KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/components/ui/cn';
import { formatFcfa } from '@/lib/format';
import { loadTablesOffer } from '@/components/event-tables/client/load';

/**
 * Lot 11c-b — bascule « Billets | Tables » de la billetterie de la fiche.
 *
 *  - Rendue par la page serveur seulement si le service des tables est ouvert et qu'au moins un type est en vente
 *    (lib/event-tables/offer-summary.server.ts) : sans tables, la fiche est inchangée.
 *  - Seule partie des tables dans le premier chargement : deux onglets. L'onglet « Tables » (types, plan, devis, achat) est
 *    chargé à la demande par son chargeur unique, dès que la personne le survole, le touche ou l'ouvre ; il relit l'offre
 *    sur le serveur. Les montants viennent tous du serveur (ici : le plus petit prix d'une table, lu par la page).
 *  - La billetterie reste montée quand « Tables » est ouvert (panier gardé), simplement cachée.
 *  - /events/<id>?tables=1 ouvre l'onglet « Tables » (retour de la connexion, « Réessayer » d'un paiement de table).
 */

export interface TablesEventInfo {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
}

const TablesOffer = dynamic(() => loadTablesOffer().then((m) => ({ default: m.TablesOffer })), {
  ssr: false,
  loading: () => (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">Chargement des tables…</span>
      <div className="h-7 w-1/2 rounded-lg bg-muted" />
      <div className="h-28 rounded-xl bg-muted" />
      <div className="h-28 rounded-xl bg-muted" />
    </div>
  ),
});

type SwitchTab = 'billets' | 'tables';

export function TicketingSwitch({ event, fromPrice, children }: { event: TablesEventInfo; fromPrice: number; children: React.ReactNode }) {
  const uid = useId();
  const [tab, setTab] = useState<SwitchTab>('billets');
  const [tablesMounted, setTablesMounted] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tables') === '1') {
      setTab('tables');
      setTablesMounted(true);
    }
  }, []);

  const choose = (next: SwitchTab) => {
    setTab(next);
    if (next === 'tables') setTablesMounted(true);
  };

  // Préchargement au survol ou au focus : le module arrive pendant que la personne se décide
  const warm = () => { void loadTablesOffer(); };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next: SwitchTab = e.key === 'Home' ? 'billets' : e.key === 'End' ? 'tables' : tab === 'billets' ? 'tables' : 'billets';
    choose(next);
    document.getElementById(`${uid}-${next}`)?.focus();
  };

  const tabCls = (active: boolean) => cn(
    'flex min-h-11 flex-col items-center justify-center rounded-lg px-3 py-1.5 text-center transition-[background-color,color,box-shadow] duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
    active ? 'bg-card text-foreground-strong shadow-sm' : 'text-muted-foreground hover:text-foreground-strong',
  );

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Billets ou tables" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          role="tab"
          id={`${uid}-billets`}
          aria-selected={tab === 'billets'}
          aria-controls={`${uid}-panneau-billets`}
          tabIndex={tab === 'billets' ? 0 : -1}
          onClick={() => choose('billets')}
          onKeyDown={onKey}
          className={tabCls(tab === 'billets')}
        >
          <span className="text-base font-semibold">Billets</span>
        </button>
        <button
          type="button"
          role="tab"
          id={`${uid}-tables`}
          aria-selected={tab === 'tables'}
          aria-controls={`${uid}-panneau-tables`}
          tabIndex={tab === 'tables' ? 0 : -1}
          onClick={() => choose('tables')}
          onKeyDown={onKey}
          onPointerEnter={warm}
          onFocus={warm}
          className={tabCls(tab === 'tables')}
        >
          <span className="text-base font-semibold">Tables</span>
          <small className="text-caption tabular-nums">dès {formatFcfa(fromPrice)}</small>
        </button>
      </div>

      <div role="tabpanel" id={`${uid}-panneau-billets`} aria-labelledby={`${uid}-billets`} hidden={tab !== 'billets'}>
        {children}
      </div>
      <div role="tabpanel" id={`${uid}-panneau-tables`} aria-labelledby={`${uid}-tables`} hidden={tab !== 'tables'}>
        {tablesMounted && <TablesOffer event={event} active={tab === 'tables'} />}
      </div>
    </div>
  );
}
