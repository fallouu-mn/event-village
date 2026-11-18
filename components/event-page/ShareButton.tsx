'use client';

import { Share2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
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
  return (
    <IconButton aria-label="Partager l’événement" variant="secondary" onClick={() => void share()}>
      <Share2 size={18} />
    </IconButton>
  );
}
