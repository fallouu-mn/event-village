'use client';

import React, { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Avatar, isAvatarUrl } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';

/**
 * Photo de profil (lot 9, tâche 9.2, contrat 4.3, 5.3, AR3) : POST et DELETE /api/account/avatar. Le navigateur ne
 * contrôle que la taille et le type déclaré, pour répondre vite ; le contenu réel est vérifié par la route, qui écrit seule le fichier.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function AvatarEditor({ avatarUrl, initials }: { avatarUrl: string | null | undefined; initials: string }) {
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const busy = isUploading || isDeleting;
  const hasPhoto = isAvatarUrl(avatarUrl);

  const upload = async (file: File) => {
    setError(null);
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      setError('Format non pris en charge. Choisissez une photo JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Cette photo dépasse 2 Mo. Choisissez une photo plus légère.');
      return;
    }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await fetchJson<{ ok: true; avatar_url: string }>('/api/account/avatar', { method: 'POST', body: form });
      await refreshProfile();
      toast.success('Photo de profil enregistrée.');
    } catch (err) {
      console.error('[AvatarEditor] envoi refusé :', err instanceof Error ? err.message : String(err));
      setError(errorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await sendJson<{ ok: true }>('/api/account/avatar', 'DELETE');
      await refreshProfile();
      setIsConfirmOpen(false);
      toast.success('Photo de profil supprimée.');
    } catch (err) {
      console.error('[AvatarEditor] suppression refusée :', err instanceof Error ? err.message : String(err));
      setIsConfirmOpen(false);
      setError(errorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-3 sm:w-48 sm:flex-shrink-0 sm:items-start">
      <Avatar src={avatarUrl} initials={initials} size="lg" />
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        aria-label="Photo de profil"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInput.current?.click()}
          isLoading={isUploading}
          disabled={isDeleting}
          leftIcon={<Camera size={16} aria-hidden="true" />}
        >
          Choisir une photo
        </Button>
        {hasPhoto && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsConfirmOpen(true)} disabled={busy} leftIcon={<Trash2 size={16} aria-hidden="true" />}>
            Supprimer la photo
          </Button>
        )}
      </div>
      <p className="text-center text-sm text-fg-muted sm:text-left">JPEG, PNG ou WebP, 2 Mo au plus.</p>
      {error && (
        <StatusBanner tone="danger" announce="alert" title="Photo non enregistrée" className="w-full text-left">
          {error}
        </StatusBanner>
      )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => void removePhoto()}
        title="Supprimer votre photo ?"
        message="Vos initiales s’afficheront à la place de votre photo."
        confirmLabel="Supprimer la photo"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
