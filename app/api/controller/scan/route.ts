import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';
import { isEventEligibleForController } from '@/lib/events/event-status';

export const dynamic = 'force-dynamic';

const ScanSchema = z.object({
    qr_code: z.string().min(1, 'QR Code requis.'),
});

/**
 * POST /api/controller/scan
 * Validation sécurisée d'un billet par un contrôleur assigné.
 * - Vérifie le rôle CONTROLEUR
 * - Vérifie l'assignation event_controllers
 * - pg_advisory_xact_lock anti-double-scan
 * - Gère le cas "paiement espèces à l'entrée"
 */
export async function POST(req: NextRequest) {
    try {
        // ─── Authentification + RBAC ───
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (user.role !== 'CONTROLEUR' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = ScanSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message }, { status: 400 });
        }

        const rawCode = parse.data.qr_code.trim();
        const supabase = getServiceRoleClient();

        // Sanitize: reject codes containing Supabase filter operators
        if (/[(),.]/.test(rawCode) && !rawCode.startsWith('EV-') && !rawCode.startsWith('TCK-')) {
            return NextResponse.json({ scan_result: 'invalid', message: 'Format de code invalide.' });
        }

        // ─── 1. Recherche du billet (deux requêtes séparées pour éviter l'injection .or()) ───
        const ticketSelect = `
                id,
                ticket_number,
                qr_code,
                status,
                price,
                checked_in_at,
                checked_in_by,
                event_id,
                category_id,
                user_id,
                order_id,
                events (id, title, start_date, location, partner_id, status),
                ticket_categories (id, name, price)
            `;

        let ticket: any = null;
        let ticketErr: any = null;

        const { data: t1, error: e1 } = await supabase
            .from('tickets')
            .select(ticketSelect)
            .eq('ticket_number', rawCode)
            .maybeSingle();

        if (t1) {
            ticket = t1;
            ticketErr = e1;
        } else {
            const { data: t2, error: e2 } = await supabase
                .from('tickets')
                .select(ticketSelect)
                .eq('qr_code', rawCode)
                .maybeSingle();
            ticket = t2;
            ticketErr = e2;
        }

        if (ticketErr || !ticket) {
            return NextResponse.json({
                scan_result: 'invalid',
                message: 'Billet inexistant ou QR Code non reconnu.',
            });
        }

        const eventData = ticket.events as any;
        const categoryData = ticket.ticket_categories as any;

        // ─── 2.0. Vérification statut de l'événement (Partie 7 CDC & Hotfix opérationnel) ───
        if (eventData?.status === 'TERMINE') {
            return NextResponse.json({
                code: 'event_ended',
                scan_result: 'event_ended',
                message: 'Cet événement est terminé. Les scans ne sont plus autorisés.',
            }, { status: 400 });
        }
        if (eventData?.status === 'SUSPENDU') {
            return NextResponse.json({
                code: 'event_suspended',
                scan_result: 'event_suspended',
                message: 'Cet événement est suspendu. Les scans ne sont pas autorisés.',
            }, { status: 400 });
        }
        if (eventData?.status && !isEventEligibleForController(eventData.status)) {
            return NextResponse.json({
                code: 'event_not_ready',
                scan_result: 'event_not_ready',
                message: `Cet événement n'est pas actif (statut: ${eventData.status}). Les scans ne sont pas autorisés.`,
            }, { status: 400 });
        }

        // ─── 2. Vérifier l'assignation contrôleur ↔ événement ───
        if (user.role === 'CONTROLEUR') {
            const { data: assignment } = await supabase
                .from('event_controllers')
                .select('id, can_accept_cash')
                .eq('event_id', ticket.event_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!assignment) {
                return NextResponse.json({
                    scan_result: 'unauthorized',
                    message: 'Vous n\'êtes pas assigné à cet événement.',
                }, { status: 403 });
            }

            // ─── 3. Billet déjà utilisé ───
            if (ticket.status === 'UTILISE') {
                const checkedTime = ticket.checked_in_at
                    ? new Date(ticket.checked_in_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                return NextResponse.json({
                    scan_result: 'already_used',
                    message: `Billet déjà scanné${checkedTime ? ` à ${checkedTime}` : ''}.`,
                    ticket_info: {
                        ticket_number: ticket.ticket_number,
                        event_title: eventData?.title,
                        category: categoryData?.name || 'Standard',
                        checked_in_at: ticket.checked_in_at,
                    },
                });
            }

            // ─── 4. Billet annulé / remboursé ───
            if (ticket.status === 'ANNULE' || ticket.status === 'REMBOURSE') {
                return NextResponse.json({
                    scan_result: 'invalid',
                    message: `Ce billet est ${ticket.status === 'ANNULE' ? 'annulé' : 'remboursé'}.`,
                });
            }

            // ─── 5. Vérification paiement — "cash gate" ───
            // Si le billet est VALIDE mais rattaché à une commande non payée
            if (ticket.order_id) {
                const { data: order } = await supabase
                    .from('orders')
                    .select('id, payment_status, total_amount, balance_amount')
                    .eq('id', ticket.order_id)
                    .maybeSingle();

                if (order && order.payment_status !== 'SUCCESS') {
                    const amountDue = Number(order.balance_amount || order.total_amount || ticket.price);

                    if (!assignment.can_accept_cash) {
                        return NextResponse.json({
                            scan_result: 'payment_required',
                            message: 'Paiement requis à la caisse principale. Vous n\'êtes pas autorisé à encaisser.',
                            ticket_info: {
                                ticket_number: ticket.ticket_number,
                                event_title: eventData?.title,
                                category: categoryData?.name || 'Standard',
                                amount_due: amountDue,
                            },
                        });
                    }

                    // Le contrôleur PEUT encaisser → retourner la demande de confirmation
                    return NextResponse.json({
                        scan_result: 'cash_required',
                        message: `Paiement en espèces requis : ${amountDue.toLocaleString('fr-FR')} FCFA`,
                        ticket_info: {
                            ticket_number: ticket.ticket_number,
                            event_title: eventData?.title,
                            category: categoryData?.name || 'Standard',
                            amount_due: amountDue,
                            ticket_id: ticket.id,
                            order_id: order.id,
                        },
                    });
                }
            }

            // ─── 6. Compostage atomique avec advisory lock ───
            const { data: lockResult, error: lockErr } = await supabase.rpc('atomic_ticket_checkin', {
                p_ticket_id: ticket.id,
                p_controller_id: user.id,
            });

            if (lockErr) {
                console.error('[controller/scan] RPC atomic_ticket_checkin error:', lockErr.message);
                // Fallback sans lock si la RPC n'existe pas encore
                if (lockErr.message.includes('does not exist')) {
                    await supabase.from('tickets').update({
                        status: 'UTILISE',
                        checked_in_at: new Date().toISOString(),
                        checked_in_by: user.id,
                    }).eq('id', ticket.id).eq('status', 'VALIDE');
                } else {
                    return NextResponse.json({ error: 'Erreur lors du compostage.' }, { status: 500 });
                }
            } else if (lockResult && lockResult.already_used) {
                return NextResponse.json({
                    scan_result: 'already_used',
                    message: 'Billet déjà scanné par un autre contrôleur à l\'instant.',
                });
            }
        } else {
            // Partenaire — vérifie qu'il est propriétaire de l'événement
            if (user.role === 'PARTENAIRE' && eventData?.partner_id !== user.id) {
                return NextResponse.json({
                    scan_result: 'unauthorized',
                    message: 'Vous n\'êtes pas autorisé à scanner les billets de cet événement.',
                });
            }

            if (ticket.status === 'UTILISE') {
                const checkedTime = ticket.checked_in_at
                    ? new Date(ticket.checked_in_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '';
                return NextResponse.json({
                    scan_result: 'already_used',
                    message: `Billet déjà scanné${checkedTime ? ` à ${checkedTime}` : ''}.`,
                    ticket_info: {
                        ticket_number: ticket.ticket_number,
                        event_title: eventData?.title,
                        category: categoryData?.name || 'Standard',
                        checked_in_at: ticket.checked_in_at,
                    },
                });
            }
            if (ticket.status === 'ANNULE' || ticket.status === 'REMBOURSE') {
                return NextResponse.json({
                    scan_result: 'invalid',
                    message: `Ce billet est ${ticket.status === 'ANNULE' ? 'annulé' : 'remboursé'}.`,
                });
            }

            await supabase.from('tickets').update({
                status: 'UTILISE',
                checked_in_at: new Date().toISOString(),
                checked_in_by: user.id,
            }).eq('id', ticket.id).eq('status', 'VALIDE');
        }

        // ─── 7. Audit ───
        await AdminService.logAudit({
            userId: user.id,
            userRole: user.role as any,
            action: 'TICKET_SCAN',
            objectType: 'tickets',
            objectId: ticket.id,
            newValue: { status: 'UTILISE', scanned_by: user.id },
            metadata: {
                ticket_number: ticket.ticket_number,
                event_id: ticket.event_id,
                controller_id: user.id,
            },
        });

        // ─── 8. Stats du jour ───
        const today = new Date().toISOString().split('T')[0];
        const [{ count: scannedToday }, { count: totalTickets }] = await Promise.all([
            supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', ticket.event_id)
                .eq('status', 'UTILISE')
                .gte('checked_in_at', `${today}T00:00:00`),
            supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', ticket.event_id)
                .in('status', ['VALIDE', 'UTILISE']),
        ]);

        return NextResponse.json({
            scan_result: 'valid',
            message: 'Accès autorisé — Billet validé.',
            ticket_info: {
                ticket_number: ticket.ticket_number,
                event_title: eventData?.title,
                category: categoryData?.name || 'Standard',
                checked_in_at: new Date().toISOString(),
            },
            stats: {
                scanned_today: scannedToday ?? 0,
                total_tickets: totalTickets ?? 0,
            },
        });

    } catch (err: unknown) {
        console.error('[API /api/controller/scan]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}

const CashConfirmSchema = z.object({
    ticket_id: z.string().uuid('ticket_id invalide.'),
    order_id:  z.string().uuid('order_id invalide.').optional(),
});

/**
 * PUT /api/controller/scan
 * Confirme l'encaissement espèces et valide l'entrée
 */
export async function PUT(req: NextRequest) {
    try {
        // ─── Authentification + RBAC ───
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (user.role !== 'CONTROLEUR' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = CashConfirmSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.' }, { status: 400 });
        }

        const { ticket_id: ticketId, order_id: orderId } = parse.data;
        const supabase = getServiceRoleClient();

        // Vérif assignation + permission cash
        const { data: ticket } = await supabase
            .from('tickets').select('id, event_id, status, price, events(status)').eq('id', ticketId).single();

        if (!ticket || ticket.status !== 'VALIDE') {
            return NextResponse.json({ error: 'Billet invalide ou déjà utilisé.' }, { status: 400 });
        }

        const evStatus = (ticket.events as any)?.status;
        if (evStatus === 'TERMINE' || evStatus === 'SUSPENDU') {
            return NextResponse.json({ error: 'Cet événement est terminé ou suspendu. Encaissement impossible.' }, { status: 400 });
        }

        if (user.role === 'CONTROLEUR') {
            const { data: assignment } = await supabase
                .from('event_controllers')
                .select('can_accept_cash')
                .eq('event_id', ticket.event_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!assignment?.can_accept_cash) {
                return NextResponse.json({ error: 'Non autorisé à encaisser.' }, { status: 403 });
            }
        }

        const now = new Date().toISOString();

        // Compostage atomique + encaissement via advisory lock
        const { data: lockResult, error: lockErr } = await supabase.rpc('atomic_ticket_checkin', {
            p_ticket_id: ticketId,
            p_controller_id: user.id,
        });

        if (lockErr) {
            if (lockErr.message.includes('does not exist')) {
                // Fallback: update avec condition d'état
                const { data: updated } = await supabase.from('tickets').update({
                    status: 'UTILISE',
                    checked_in_at: now,
                    checked_in_by: user.id,
                }).eq('id', ticketId).eq('status', 'VALIDE').select('id').maybeSingle();

                if (!updated) {
                    return NextResponse.json({ error: 'Billet déjà traité par un autre contrôleur.' }, { status: 409 });
                }
            } else {
                return NextResponse.json({ error: 'Erreur lors du compostage.' }, { status: 500 });
            }
        } else if (lockResult && lockResult.already_used) {
            return NextResponse.json({
                scan_result: 'already_used',
                message: 'Billet déjà scanné par un autre contrôleur à l\'instant.',
            });
        }

        // Marquer le paiement comme réglé en espèces
        if (orderId) {
            await supabase.from('orders').update({
                payment_status: 'SUCCESS',
                order_status: 'CONFIRMEE',
                updated_at: now,
            }).eq('id', orderId);
        }

        // Audit
        await AdminService.logAudit({
            userId: user.id,
            userRole: user.role as any,
            action: 'CASH_COLLECTION',
            objectType: 'tickets',
            objectId: ticketId,
            newValue: { payment: 'CASH', amount: ticket.price, order_id: orderId },
            metadata: { controller_id: user.id, event_id: ticket.event_id },
        });

        // Stats du jour
        const today = new Date().toISOString().split('T')[0];
        const [{ count: scannedToday }, { count: totalTickets }] = await Promise.all([
            supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', ticket.event_id)
                .eq('status', 'UTILISE')
                .gte('checked_in_at', `${today}T00:00:00`),
            supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', ticket.event_id)
                .in('status', ['VALIDE', 'UTILISE']),
        ]);

        return NextResponse.json({
            scan_result: 'valid',
            message: 'Encaissement confirmé — Accès autorisé.',
            stats: {
                scanned_today: scannedToday ?? 0,
                total_tickets: totalTickets ?? 0,
            },
        });

    } catch (err: unknown) {
        console.error('[API controller/scan confirm-cash]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
