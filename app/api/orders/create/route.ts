import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/create
 * Crée une commande de repas / traiteur en base et retourne l'ID réel pour paiement
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        let userId: string | null = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id || null;
        }

        let body: {
            partnerId: string;
            items: Array<{ id: string; quantity: number }>;
            deliveryMode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE';
            clientId?: string;
        };

        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const effectiveUserId = userId || body.clientId;
        if (!effectiveUserId) {
            return NextResponse.json({ error: 'Connexion requise pour passer une commande.' }, { status: 401 });
        }

        const { partnerId, items, deliveryMode } = body;
        if (!partnerId || !items || items.length === 0) {
            return NextResponse.json({ error: 'Le panier ne peut pas être vide.' }, { status: 400 });
        }

        // 1. Récupération des prix réels depuis la table products
        const productIds = items.map(i => i.id);
        const { data: dbProducts, error: prodErr } = await supabase
            .from('products')
            .select('id, name, price, partner_id')
            .in('id', productIds);

        if (prodErr || !dbProducts || dbProducts.length === 0) {
            return NextResponse.json({ error: 'Produits introuvables.' }, { status: 404 });
        }

        let subtotal = 0;
        const validatedItems: Array<{ productId: string; name: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

        for (const cartItem of items) {
            const dbProd = dbProducts.find(p => p.id === cartItem.id);
            if (dbProd) {
                const unitPrice = Number(dbProd.price);
                const itemTotal = unitPrice * cartItem.quantity;
                subtotal += itemTotal;
                validatedItems.push({
                    productId: dbProd.id,
                    name: dbProd.name,
                    quantity: cartItem.quantity,
                    unitPrice,
                    totalPrice: itemTotal,
                });
            }
        }

        if (subtotal <= 0) {
            return NextResponse.json({ error: 'Le montant de la commande doit être supérieur à 0.' }, { status: 400 });
        }

        const orderNumber = `CMD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 2. Insertion de la commande
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                client_id: effectiveUserId,
                partner_id: partnerId,
                subtotal,
                total_amount: subtotal,
                paid_amount: 0,
                balance_amount: subtotal,
                delivery_mode: deliveryMode || 'LIVRAISON',
                payment_type: 'INTEGRAL',
                order_status: 'EN_ATTENTE',
                payment_status: 'PENDING',
            })
            .select('*')
            .single();

        if (orderErr || !order) {
            console.error('[API /api/orders/create] Erreur création commande:', orderErr);
            return NextResponse.json({ error: 'Impossible de créer la commande.' }, { status: 500 });
        }

        // 3. Insertion des lignes de commande (order_items)
        const orderItemsPayload = validatedItems.map(item => ({
            order_id: order.id,
            product_id: item.productId,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
        }));

        await supabase.from('order_items').insert(orderItemsPayload);

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                orderNumber: order.order_number,
                totalAmount: subtotal,
                totalFormatted: `${subtotal.toLocaleString('fr-FR')} FCFA`,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/orders/create] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
