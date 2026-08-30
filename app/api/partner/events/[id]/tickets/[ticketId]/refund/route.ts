import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { EventService } from '@/lib/events/event.service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 });
        }
        const allowedRoles = ['PARTENAIRE', 'ADMIN', 'SUPERADMIN', 'CONTROLEUR'];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({ error: 'Acces non autorise.' }, { status: 403 });
        }
        const { ticketId } = await params;
        const body = await request.json();
        if (!body.reason || !String(body.reason).trim()) {
            return NextResponse.json({ error: 'Le motif de remboursement est obligatoire.' }, { status: 400 });
        }
        const result = await EventService.refundTicket({
            ticketId,
            operatorId: user.id,
            operatorRole: user.role,
            reason: String(body.reason).trim(),
        });
        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Echec du remboursement.' },
            { status: 400 }
        );
    }
}