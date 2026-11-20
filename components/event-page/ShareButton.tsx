'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

/** Partage de la fiche (feuille de partage du téléphone, sinon copie du lien). */
export function ShareButton({ title }: { title: string }) {
  const toast = useToast();
  const share = async (): Promise<void> => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch (err) {
        // Partage annulé : rien à signaler ; toute autre erreur est affichée.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[événement] partage impossible :', err);
        toast.error('Le partage n’a pas abouti. Copiez l’adresse de la page.');
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien de l’événement copié.');
    } catch (err) {
      console.error('[événement] copie du lien impossible :', err);
      toast.error('Le lien n’a pas pu être copié. Copiez l’adresse de la page.');
    }
  };
  // Design 1d (point 5) : bouton « Partager » sur le haut de la fiche (pastille sombre, comme le cœur) ; le mot est écrit dès
  // 640 px, l'icône seule en dessous (place de « Retour aux événements » et du cœur). Le lien partagé montre l'aperçu de
  // l'événement publié (app/api/events/[id]/apercu).
  return (
    <button
      type="button"
      aria-label="Partager l’événement"
      onClick={() => void share()}
      className="ev-fav ev-press inline-flex h-11 min-w-11 flex-shrink-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4"
    >
      <Share2 size={18} aria-hidden="true" />
      <span className="hidden sm:inline" aria-hidden="true">Partager</span>
    </button>
  );
}
