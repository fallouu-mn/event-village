'use client';

/**
 * Finition 2b (B, E-23) — étape 5 « Contrôle à l'entrée (facultatif) » en modification : la configuration actuelle
 * (GET /api/partner/events/[id]/zones), les couleurs au contrôle des catégories (enregistrées par PATCH …/categories/[id],
 * la route des catégories) et l'éditeur des zones (ZonesEditor : PUT …/zones, l'enregistrement d'aujourd'hui). Cible du
 * lien « Modifier les portes et les couleurs » de la page Équipe (…/edit?etape=controle). Le serveur décide des droits
 * (propriétaire, fiche, statut) : `can_edit` et `edit_block` de la lecture.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, fetchJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { ZonesEditor, type ZonesConfig } from '@/components/partner/zones/ZonesEditor';
import { isScanCategoryColor } from '@/lib/scan/scan-result';
import { ScanColorSelect } from './ScanColorPicker';

interface EntryControlEditorProps {
    eventId: string;
    /** Couleurs enregistrées (identifiant de catégorie → couleur) : l'étape Billets les reprend. */
    onColorsSaved: (colors: Record<string, string>) => void;
}

export function EntryControlEditor({ eventId, onColorsSaved }: EntryControlEditorProps) {
    const toast = useToast();
    const [signal, setSignal] = useState(0);
    const zones = useServerData<ZonesConfig>(`/api/partner/events/${eventId}/zones`, signal);
    const config = zones.data;
    const base = useMemo<Record<string, string>>(
        () => Object.fromEntries((config?.categories ?? []).map((c) => [c.id, isScanCategoryColor(c.scan_color) ? c.scan_color : ''])),
        [config],
    );
    const [colors, setColors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    useEffect(() => {
        setColors(base);
    }, [base]);

    const changed = Object.keys(colors).filter((id) => colors[id] !== base[id] && isScanCategoryColor(colors[id]));
    const editable = config?.can_edit === true;

    const saveColors = async () => {
        setSaving(true);
        setFailure(null);
        const saved: Record<string, string> = {};
        try {
            for (const id of changed) {
                await fetchJson(`/api/partner/events/${eventId}/categories/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scan_color: colors[id] }),
                });
                saved[id] = colors[id];
            }
            toast.success(changed.length > 1 ? 'Couleurs enregistrées.' : 'Couleur enregistrée.');
        } catch (err) {
            setFailure(errorMessage(err, 'Enregistrement des couleurs impossible pour le moment.'));
        } finally {
            setSaving(false);
            if (Object.keys(saved).length > 0) {
                onColorsSaved(saved);
                setSignal((n) => n + 1);
            }
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
                Facultatif. Les portes, les zones et les couleurs s’enregistrent ici, chacune avec son bouton.
            </p>

            {config && config.categories.length > 0 && (
                <section aria-labelledby="ev-controle-couleurs" className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                    <h3 id="ev-controle-couleurs" className="text-base font-semibold text-foreground-strong">Couleurs au contrôle</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">Bande de couleur montrée au contrôleur avec le nom de la catégorie.</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {config.categories.map((c, i) => (
                            <ScanColorSelect
                                key={c.id}
                                id={`ev-controle-couleur-${i}`}
                                label={c.name}
                                value={colors[c.id] ?? ''}
                                onChange={(color) => setColors((m) => ({ ...m, [c.id]: color }))}
                                disabled={!editable || saving}
                            />
                        ))}
                    </div>
                    {failure && <StatusBanner tone="danger" title="Couleurs non enregistrées" announce="alert">{failure}</StatusBanner>}
                    {editable && (
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant={changed.length > 0 ? 'primary' : 'secondary'} disabled={changed.length === 0}
                                isLoading={saving} onClick={() => void saveColors()}>
                                Enregistrer les couleurs
                            </Button>
                            {changed.length > 0 && (
                                <Button type="button" variant="ghost" disabled={saving} onClick={() => { setColors(base); setFailure(null); }}>
                                    Annuler les modifications
                                </Button>
                            )}
                        </div>
                    )}
                </section>
            )}

            <ZonesEditor
                eventId={eventId}
                config={config}
                loading={zones.loading}
                error={zones.error}
                refreshing={zones.refreshing}
                reload={zones.reload}
                onSaved={() => setSignal((n) => n + 1)}
            />
        </div>
    );
}
