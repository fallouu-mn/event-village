'use client';

/**
 * Lot 11b — photos d'un établissement : de 1 à 12, déposées une à une par ImageUpload (POST /api/partner/upload,
 * dossier « venues », photo réencodée par la route), à ordonner et à retirer ; la première est la couverture, montrée
 * sur la carte de l'établissement. Les adresses gardées sont celles que la route de dépôt a rendues.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { ImageUpload } from '@/components/ui/ImageUpload';

export const MAX_PHOTOS = 12;

export function PhotosEditor({ id, photos, onChange, error }: { id: string; photos: string[]; onChange: (next: string[]) => void; error?: string }) {
    const [notice, setNotice] = useState('');

    const add = (url: string) => {
        if (!url || photos.includes(url) || photos.length >= MAX_PHOTOS) return;
        onChange([...photos, url]);
        setNotice(photos.length === 0 ? 'Photo ajoutée : c’est la photo de couverture.' : 'Photo ajoutée.');
    };
    const move = (from: number, to: number) => {
        if (to < 0 || to >= photos.length) return;
        const next = [...photos];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange(next);
        setNotice(to === 0 ? 'Photo placée en premier : c’est la photo de couverture.' : `Photo placée en position ${to + 1}.`);
    };
    const remove = (index: number) => {
        onChange(photos.filter((_, i) => i !== index));
        setNotice(`Photo ${index + 1} retirée.`);
    };

    return (
        <div className="flex flex-col gap-4">
            {photos.length > 0 && (
                <ol className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3" aria-label="Photos de l’établissement, dans l’ordre d’affichage">
                    {photos.map((url, i) => (
                        <li key={url} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
                            <div className="relative aspect-[4/3] w-full bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element -- photo déposée (stockage du projet), aperçu seulement */}
                                <img
                                    src={url}
                                    alt={i === 0 ? 'Photo de couverture de l’établissement' : `Photo ${i + 1} de l’établissement`}
                                    loading={i === 0 ? 'eager' : 'lazy'}
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                />
                                {i === 0 && (
                                    <span className="absolute left-2 top-2 rounded-lg border border-border bg-card px-2 py-1 text-sm font-semibold text-foreground-strong shadow-sm">
                                        Couverture
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-1">
                                <span className="px-2 text-sm font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                                <div className="flex items-center">
                                    <IconButton aria-label={`Placer la photo ${i + 1} avant`} onClick={() => move(i, i - 1)} disabled={i === 0}>
                                        <ArrowLeft size={18} />
                                    </IconButton>
                                    <IconButton aria-label={`Placer la photo ${i + 1} après`} onClick={() => move(i, i + 1)} disabled={i === photos.length - 1}>
                                        <ArrowRight size={18} />
                                    </IconButton>
                                    <IconButton aria-label={`Retirer la photo ${i + 1}`} variant="danger" onClick={() => remove(i)}>
                                        <Trash2 size={18} />
                                    </IconButton>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            <p className="sr-only" aria-live="polite">{notice}</p>
            {photos.length < MAX_PHOTOS ? (
                <ImageUpload
                    id={id}
                    label={photos.length === 0 ? 'Ajouter une photo' : 'Ajouter une autre photo'}
                    folder="venues"
                    value=""
                    onChange={add}
                    required={photos.length === 0}
                    downscale={1600}
                    hint="JPEG, PNG ou WebP, 5 Mo au plus. Une photo à la fois ; la salle, la terrasse, une table dressée, un plat."
                    error={error}
                />
            ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">{`${MAX_PHOTOS} photos au plus : retirez-en une pour en ajouter une autre.`}</p>
            )}
        </div>
    );
}
