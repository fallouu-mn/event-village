'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
    value: string;
    onChange: (url: string) => void;
    folder: string;
    label?: string;
    className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
    value,
    onChange,
    folder,
    label = 'Image',
    className = '',
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const upload = useCallback(async (file: File) => {
        setError(null);

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Format non supporte (JPEG, PNG, WebP uniquement).');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Fichier trop volumineux (5 Mo max).');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);

            const res = await fetch('/api/partner/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.success && data.url) {
                onChange(data.url);
            } else {
                setError(data.error || 'Echec de l\'upload.');
            }
        } catch {
            setError('Erreur reseau lors de l\'upload.');
        } finally {
            setIsUploading(false);
        }
    }, [folder, onChange]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) upload(file);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) upload(file);
    };

    const handleRemove = () => {
        onChange('');
        setError(null);
    };

    return (
        <div className={className}>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                {label}
            </label>

            {value ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                    <img
                        src={value}
                        alt="Apercu"
                        className="w-full h-40 object-cover"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                        dragOver
                            ? 'border-[#FF5722] bg-orange-50/50 dark:bg-orange-950/20'
                            : 'border-slate-300 dark:border-zinc-700 hover:border-[#FF5722]/50 bg-slate-50 dark:bg-zinc-800/50'
                    }`}
                >
                    {isUploading ? (
                        <>
                            <Loader2 size={24} className="text-[#FF5722] animate-spin" />
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                Upload en cours...
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center">
                                {dragOver ? <Upload size={20} /> : <ImageIcon size={20} />}
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    Cliquez ou glissez-deposez
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                    JPEG, PNG ou WebP &bull; 5 Mo max
                                </p>
                            </div>
                        </>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>
            )}

            {error && (
                <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
};
