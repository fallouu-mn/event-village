'use client';

import React, { useCallback, useId, useState } from 'react';
import { AlertCircle, ImageIcon, RefreshCw, Trash2, Upload } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';

interface ImageUploadProps {
    value: string;
    onChange: (url: string) => void;
    /** Dossier de dépôt côté serveur (events, halls, products, misc). */
    folder: string;
    label?: string;
    /** Aide sous le champ (format, usage de l'image). */
    hint?: string;
    /** Erreur venue du formulaire ou du serveur (origine refusée…), affichée sous le champ. */
    error?: string;
    required?: boolean;
    /** Identifiant imposé du champ fichier (lien depuis un récapitulatif d'erreurs). */
    id?: string;
    className?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Dépôt d'une image publique (affiche, salle, produit) — lot 5 (contrat Q, DoD 7) : libellé lié au champ
 * fichier (htmlFor/id), champ atteignable au clavier (zone de dépôt focalisable), aide et erreur reliées par
 * aria-describedby, état d'envoi annoncé, erreur réseau ou serveur toujours affichée.
 */
export const ImageUpload: React.FC<ImageUploadProps> = ({
    value,
    onChange,
    folder,
    label = 'Image',
    hint = 'JPEG, PNG ou WebP, 5 Mo au plus.',
    error,
    required = false,
    id,
    className,
}) => {
    const generated = useId();
    const inputId = id ?? `image-${generated}`;
    const hintId = `${inputId}-aide`;
    const errorId = `${inputId}-erreur`;
    const statusId = `${inputId}-etat`;

    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const shownError = uploadError ?? error ?? null;
    const describedBy = [shownError ? errorId : null, hintId, isUploading ? statusId : null].filter(Boolean).join(' ');

    const upload = useCallback(async (file: File) => {
        setUploadError(null);
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setUploadError('Format non pris en charge : choisissez une image JPEG, PNG ou WebP.');
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            setUploadError('Image trop lourde : 5 Mo au plus.');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);
            const res = await fetch('/api/partner/upload', { method: 'POST', body: formData });
            let data: { success?: boolean; url?: string; error?: string } = {};
            try {
                data = await res.json();
            } catch {
                data = {};
            }
            if (res.ok && data.success && typeof data.url === 'string') {
                onChange(data.url);
            } else {
                setUploadError(data.error || 'Le dépôt de l’image a échoué. Réessayez.');
            }
        } catch {
            setUploadError('Connexion impossible : l’image n’a pas été envoyée. Vérifiez votre réseau, puis réessayez.');
        } finally {
            setIsUploading(false);
        }
    }, [folder, onChange]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void upload(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
    };

    const handleRemove = () => {
        onChange('');
        setUploadError(null);
    };

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <label htmlFor={inputId} className="text-sm font-semibold text-fg">
                {label}
                {required && (
                    <>
                        <span className="ml-0.5 text-danger-fg" aria-hidden="true">*</span>
                        <span className="sr-only"> (obligatoire)</span>
                    </>
                )}
            </label>

            <input
                id={inputId}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                disabled={isUploading}
                aria-describedby={describedBy || undefined}
                aria-invalid={shownError ? true : undefined}
                className="peer sr-only"
            />

            {value ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-surface-sunken peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu de l'image déposée (URL du stockage du projet) */}
                    <img src={value} alt={`Aperçu : ${label}`} className="aspect-video w-full object-cover" />
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface p-2">
                        <span className="px-2 text-sm text-fg-muted">Image enregistrée</span>
                        <div className="flex items-center gap-1">
                            <label
                                htmlFor={inputId}
                                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-fg transition-colors duration-200 hover:bg-surface-sunken"
                            >
                                <RefreshCw size={16} aria-hidden="true" />
                                Remplacer l’image
                            </label>
                            <IconButton aria-label="Supprimer l’image sélectionnée" variant="danger" onClick={handleRemove} disabled={isUploading}>
                                <Trash2 size={18} />
                            </IconButton>
                        </div>
                    </div>
                </div>
            ) : (
                <label
                    htmlFor={inputId}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                        'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors duration-200',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
                        dragOver ? 'border-brand-fg bg-brand-bg' : 'border-border-strong bg-surface-sunken hover:border-brand-fg',
                        shownError && !dragOver && 'border-danger',
                    )}
                >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
                        {isUploading ? (
                            <span className="inline-block h-5 w-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
                        ) : dragOver ? <Upload size={20} /> : <ImageIcon size={20} />}
                    </span>
                    <span className="text-sm font-semibold text-fg">
                        {isUploading ? 'Envoi de l’image en cours…' : 'Choisir une image ou la déposer ici'}
                    </span>
                </label>
            )}

            {isUploading && (
                <p id={statusId} role="status" className="sr-only">Envoi de l’image en cours.</p>
            )}
            <p id={hintId} className="text-sm leading-snug text-fg-muted">{hint}</p>
            {shownError && (
                <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium leading-snug text-danger-fg">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{shownError}</span>
                </p>
            )}
        </div>
    );
};
