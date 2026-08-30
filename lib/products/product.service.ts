import { getServiceRoleClient } from '../supabase/server';

export interface ProductCategory {
    id: string;
    partner_id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Product {
    id: string;
    partner_id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    price: number;
    is_daily_special: boolean;
    daily_special_date: string | null;
    stock_quantity: number | null;
    is_stock_managed: boolean;
    status: 'DISPONIBLE' | 'INDISPONIBLE' | 'EPUISE' | 'SUSPENDU';
    images: string[];
    created_at: string;
    updated_at: string;
}

export interface CreateProductInput {
    category_id?: string;
    name: string;
    description?: string;
    price: number;
    is_daily_special?: boolean;
    daily_special_date?: string;
    stock_quantity?: number;
    is_stock_managed?: boolean;
    status?: 'DISPONIBLE' | 'INDISPONIBLE' | 'EPUISE' | 'SUSPENDU';
    images?: string[];
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export class ProductService {
    static async resolvePartnerId(userId: string): Promise<string> {
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from('partners')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (error || !partner) {
            throw new Error('Profil partenaire introuvable.');
        }

        return partner.id;
    }

    // --- Catégories produits ---

    static async createCategory(partnerUserId: string, input: { name: string, description?: string, sort_order?: number }): Promise<ProductCategory> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('product_categories')
            .insert([{
                partner_id: partnerId,
                name: input.name,
                description: input.description || null,
                sort_order: input.sort_order || 0
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as ProductCategory;
    }

    static async getPartnerCategories(partnerUserId: string): Promise<ProductCategory[]> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('product_categories')
            .select('*')
            .eq('partner_id', partnerId)
            .order('sort_order', { ascending: true });

        if (error) throw new Error(error.message);
        return data as ProductCategory[];
    }

    static async updateCategory(categoryId: string, partnerUserId: string, input: Partial<{ name: string, description: string, sort_order: number, is_active: boolean }>): Promise<ProductCategory> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('product_categories')
            .update(input)
            .eq('id', categoryId)
            .eq('partner_id', partnerId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as ProductCategory;
    }

    static async deleteCategory(categoryId: string, partnerUserId: string): Promise<{ success: boolean }> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { error } = await supabase
            .from('product_categories')
            .delete()
            .eq('id', categoryId)
            .eq('partner_id', partnerId);

        if (error) throw new Error(error.message);
        return { success: true };
    }

    // --- Produits ---

    static async createProduct(partnerUserId: string, input: CreateProductInput): Promise<Product> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .insert([{
                partner_id: partnerId,
                ...input
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Product;
    }

    static async getPartnerProducts(partnerUserId: string, filters?: { status?: string, category_id?: string, is_daily_special?: boolean }): Promise<Product[]> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        
        let query = supabase.from('products').select('*').eq('partner_id', partnerId);
        
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }
        if (filters?.category_id) {
            query = query.eq('category_id', filters.category_id);
        }
        if (filters?.is_daily_special !== undefined) {
            query = query.eq('is_daily_special', filters.is_daily_special);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data as Product[];
    }

    static async getProductById(productId: string): Promise<Product> {
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !data) throw new Error(`Produit introuvable: ${productId}`);
        return data as Product;
    }

    static async updateProduct(productId: string, partnerUserId: string, input: UpdateProductInput): Promise<Product> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .update(input)
            .eq('id', productId)
            .eq('partner_id', partnerId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Product;
    }

    static async deleteProduct(productId: string, partnerUserId: string): Promise<{ success: boolean }> {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const supabase = getServiceRoleClient();
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .eq('partner_id', partnerId);

        if (error) throw new Error(error.message);
        return { success: true };
    }

    static async setProductStatus(productId: string, partnerUserId: string, status: 'DISPONIBLE' | 'INDISPONIBLE' | 'SUSPENDU'): Promise<Product> {
        return this.updateProduct(productId, partnerUserId, { status });
    }
}
