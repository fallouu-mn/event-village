import { PlanEditorView } from '@/components/tables/editor/PlanEditorView';

/**
 * Lot 11b : plan de salle d'un établissement (tables et zones placées au doigt, à la souris ou au clavier ; plan montré
 * ou non aux clients). Lecture GET /api/partner/venues/[id], enregistrement PUT /api/partner/venues/[id]/plan.
 * Garde de l'interrupteur : app/partner/tables/edition/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function VenuePlanPage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = await params;
    return <PlanEditorView venueId={venueId} />;
}
