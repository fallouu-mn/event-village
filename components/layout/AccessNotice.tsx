'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { accessErrorMessage } from '@/lib/auth/access-errors';

/**
 * Message d'une redirection du middleware vers `/?error=<clé>` (lot 8, 8.2 j, L53, L54).
 * Le paramètre n'est jamais affiché : seule la table fermée de lib/auth/access-errors.ts fournit le texte, et une
 * clé inconnue ne rend rien. À monter sous <Suspense fallback={null}> : useSearchParams l'exige au rendu statique.
 */
export function AccessNotice() {
  const message = accessErrorMessage(useSearchParams()?.get('error'));
  if (!message) return null;
  return <StatusBanner tone="warning" announce="alert" title={message} />;
}
