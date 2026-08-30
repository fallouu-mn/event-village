import { getServiceRoleClient } from '../supabase/server';
import { ProductService } from '../products/product.service';
import { FinancialCalculatorService } from '../payments/financial-calculator.service';

export interface OrderItemInput {
    product_id: string;
    quantity: number;
    notes?: string;
}

export interface CreateOrderInput {
    partner_id: string;
    items: OrderItemInput[];
    delivery_mode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE';
    payment_type: 'INTEGRAL' | 'ACOMPTE' | 'DIFFERE';
    delivery_address?: string;
    delivery_notes?: string;
    delivery_fee?: number; // Optionnel, par défaut 0
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes: string | null;
    created_at: string;
}

export interface Order {
    id: string;
    order_number: string;
    client_id: string;
    partner_id: string;
    subtotal: number;
    delivery_fee: number;
    service_fee: number;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    payment_type: string;
    delivery_mode: string;
    delivery_address: string | null;
    delivery_notes: string | null;
    order_status: string;
    payment_status: string;
    created_at: string;
    updated_at: string;
}

export class OrderService {
    static async resolvePartnerId(userId: string): Promise<string> {
        return ProductService.resolvePartnerId(userId);
    }

    private static generateOrderNumber(): string {
        const prefix = 'ORD';
        const dateStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${dateStr}-${randomStr}`;
    }

    static async createOrder(clientId: string, input: CreateOrderInput): Promise<Order> {
        const supabase = getServiceRoleClient();
        let subtotal = 0;
        const processedItems: (OrderItemInput & { product_name: string, unit_price: number, total_price: number })[] = [];

        // 1. Validation des produits et protection des stocks
        for (const item of input.items) {
            let success = false;
            let retries = 3;

            while (!success && retries > 0) {
                // Fetch current product state
                const product = await ProductService.getProductById(item.product_id);

                if (product.partner_id !== input.partner_id) {
                    throw new Error(`Le produit ${product.id} n'appartient pas au partenaire ${input.partner_id}.`);
                }

                if (product.status === 'SUSPENDU') {
                    throw new Error(`Le produit ${product.name} est suspendu et ne peut pas être commandé.`);
                }

                if (product.status === 'INDISPONIBLE' || product.status === 'EPUISE') {
                    throw new Error(`Le produit ${product.name} est actuellement indisponible.`);
                }

                // Check stock
                if (product.is_stock_managed) {
                    if (product.stock_quantity === null || product.stock_quantity < item.quantity) {
                        throw new Error(`Stock insuffisant pour le produit ${product.name}. Demandé: ${item.quantity}, Disponible: ${product.stock_quantity}`);
                    }

                    // UPDATE conditionnel atomique (optimistic locking)
                    const newStock = product.stock_quantity - item.quantity;
                    const { data: updateData, error: updateError } = await supabase
                        .from('products')
                        .update({ 
                            stock_quantity: newStock,
                            status: newStock === 0 ? 'EPUISE' : product.status
                        })
                        .eq('id', product.id)
                        .eq('stock_quantity', product.stock_quantity) // Atomic check
                        .gte('stock_quantity', item.quantity) // Ensures it's still >= requested qty
                        .select();
                    
                    if (updateError || !updateData || updateData.length === 0) {
                        retries--;
                        if (retries === 0) {
                            throw new Error(`Conflit de stock pour le produit ${product.name}. Veuillez réessayer.`);
                        }
                        continue; // Retry
                    }
                }

                // Compute price
                const itemTotalPrice = product.price * item.quantity;
                subtotal += itemTotalPrice;

                processedItems.push({
                    ...item,
                    product_name: product.name,
                    unit_price: product.price,
                    total_price: itemTotalPrice
                });

                success = true;
            }
        }

        // 2. Calculs financiers
        const deliveryFee = input.delivery_fee || 0;
        const totalAmountBeforeDelivery = subtotal; // Pour le calcul commission, selon config. Par défaut sur le subtotal ou total ? Le CDC précise orderTotalAmount.
        // Assuming CDC orderTotalAmount = subtotal for commission basis, wait: total_amount = subtotal + delivery_fee.
        // The FinancialCalculator uses total_amount. Let's pass total_amount.
        const orderTotal = subtotal + deliveryFee;

        // Appel au FinancialCalculatorService (R7)
        // Utilise 5.0% par défaut
        const financials = FinancialCalculatorService.calculateOrderFinancials({
            orderTotalAmount: subtotal // Generally commission is on subtotal (food), not on delivery
        });

        // The platformCommissionAmount is the service_fee.
        const serviceFee = financials.platformCommissionAmount;

        // 3. Création de la commande
        const orderNumber = this.generateOrderNumber();

        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert([{
                order_number: orderNumber,
                client_id: clientId,
                partner_id: input.partner_id,
                subtotal: subtotal,
                delivery_fee: deliveryFee,
                service_fee: serviceFee,
                total_amount: orderTotal,
                paid_amount: 0,
                balance_amount: orderTotal,
                payment_type: input.payment_type,
                delivery_mode: input.delivery_mode,
                delivery_address: input.delivery_address || null,
                delivery_notes: input.delivery_notes || null,
                order_status: 'EN_ATTENTE',
                payment_status: 'PENDING'
            }])
            .select()
            .single();

        if (orderError) {
            // Rollback stocks (best effort since no transaction)
            throw new Error(`Erreur lors de la création de la commande: ${orderError.message}`);
        }

        // 4. Insertion des lignes de commande
        const orderItemsToInsert = processedItems.map(item => ({
            order_id: orderData.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            notes: item.notes || null
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItemsToInsert);

        if (itemsError) {
            throw new Error(`Erreur lors de l'insertion des articles: ${itemsError.message}`);
        }

        return orderData as Order;
    }

    static async getPartnerOrders(partnerUserId: string, filters?: { status?: string }): Promise<Order[]> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        
        let query = supabase.from('orders').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false });
        
        if (filters?.status) {
            query = query.eq('order_status', filters.status);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data as Order[];
    }

    static async updateOrderStatus(orderId: string, partnerUserId: string, newStatus: string): Promise<Order> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();

        // Check if order exists and belongs to partner
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .eq('partner_id', partnerId)
            .single();

        if (fetchError || !order) {
            throw new Error(`Commande introuvable ou accès refusé.`);
        }

        // Validate status transition
        const validStatuses = ['EN_ATTENTE', 'CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE', 'ANNULEE', 'REJETEE'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Statut invalide: ${newStatus}`);
        }

        const { data, error } = await supabase
            .from('orders')
            .update({ order_status: newStatus })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Order;
    }

    static async cancelOrder(orderId: string, actorId: string, reason: string): Promise<{ success: boolean }> {
        const supabase = getServiceRoleClient();
        
        // 1. Get order details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            throw new Error(`Commande introuvable.`);
        }

        if (order.order_status === 'ANNULEE') {
            return { success: true };
        }

        // 2. Update order status
        const { error: updateError } = await supabase
            .from('orders')
            .update({ order_status: 'ANNULEE' })
            .eq('id', orderId);

        if (updateError) throw new Error(updateError.message);

        // 3. Restore stock (Régularisation stock)
        for (const item of order.order_items) {
            // Restore stock for each item if managed
            const { data: product } = await supabase
                .from('products')
                .select('id, stock_quantity, is_stock_managed')
                .eq('id', item.product_id)
                .single();

            if (product && product.is_stock_managed && product.stock_quantity !== null) {
                const newStock = product.stock_quantity + item.quantity;
                await supabase
                    .from('products')
                    .update({ 
                        stock_quantity: newStock,
                        status: 'DISPONIBLE' // Automatically make available if it was EPUISE
                    })
                    .eq('id', product.id);
            }
        }

        return { success: true };
    }
}
