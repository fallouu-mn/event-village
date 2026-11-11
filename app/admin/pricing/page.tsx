'use client';

/**
 * /admin/pricing — « Tarification ».
 *
 * Lot 9 bis, tâche 41 (R21 ; contrat 5.41, B92, D-txt E.41) : les trois sections d'avant (packs d'abonnement, frais
 * des moyens de paiement, tarifs de communication) enregistraient des clés que rien ne relit (`subscription_packs`,
 * `aggregator_fees`, `communication_tariffs`) et affichaient des taux faux (1,0 % pour un opérateur quand le moteur
 * applique 1,5 %). La page ne garde qu'un renvoi : les frais de service, les taux des opérateurs et les règles de
 * retrait se règlent dans les Réglages de la plateforme (`/admin/finance-settings`, historisés, SUPERADMIN pour la
 * modification). La route `/api/admin/pricing` reste en place (garanties de sécurité testées par plusieurs suites).
 */

import React from 'react';
import { ArrowRight, Settings2 } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';

export default function AdminPricingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PageHeader
        title="Tarification"
        description="Les montants appliqués aux ventes et aux retraits ont une seule source : les Réglages de la plateforme."
        back={{ href: '/admin/dashboard', label: 'Tableau de bord' }}
      />

      <StatusBanner
        tone="neutral"
        icon={<Settings2 size={20} aria-hidden="true" />}
        title="Réglages de la plateforme"
        action={
          <LinkButton href="/admin/finance-settings" variant="primary" rightIcon={<ArrowRight size={18} aria-hidden="true" />}>
            Ouvrir les Réglages de la plateforme
          </LinkButton>
        }
      >
        Les frais de service, les taux des opérateurs et les règles de retrait se règlent dans les Réglages de la
        plateforme. Chaque modification y est historisée et ne s’applique qu’aux opérations futures.
      </StatusBanner>
    </div>
  );
}
