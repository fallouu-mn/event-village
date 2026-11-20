'use client';

/**
 * Lot 10b (point 2) : état d'erreur d'une page des salles préparée par le serveur. « Réessayer » relance le rendu
 * serveur de la page (router.refresh), sans recharger tout le site. Message en français simple, jamais technique.
 */
import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui/EmptyState';

export function RetryError({ title, description }: { title: string; description?: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (
        <ErrorState
            title={title}
            description={description ?? 'Vérifiez votre connexion, puis réessayez.'}
            isRetrying={pending}
            onRetry={() => startTransition(() => router.refresh())}
        />
    );
}
