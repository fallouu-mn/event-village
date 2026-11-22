import { z } from 'zod';
import { getServiceRoleClient } from '../supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { assertNoPosterFolder } from '@/lib/images/image-address';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
            .maybeSingle();

        // Lot 9 (A32) : une panne n'est pas un compte sans fiche ; l'absence garde son message et son statut.
        if (error) throw new Error(`partenaire du compte ${userId} illisible : ${error.message}`);
        if (!partner) throw new PublicError('Profil partenaire introuvable.');

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

    /**
     * Correctifs de la contre-vérification de la finition 2a (R2) : seuls les champs de la liste blanche sont lus (un autre
     * champ, dont partner_id, id, status, created_at : 400 FIELD_NOT_EDITABLE), la partenaire est celle de la session,
     * posée après les champs ; le statut prend sa valeur par défaut (DISPONIBLE) et ne change que par setProductStatus.
     */
    static async createProduct(partnerUserId: string, input: unknown): Promise<Product> {
        const fields = parseProductFields(input, 'create');
        // T6 : jamais une image du dossier des affiches (events/)
        assertNoPosterFolder(fields.images);
        const partnerId = await this.resolvePartnerId(partnerUserId);
        await this.assertOwnCategory(partnerId, fields.category_id as string | null | undefined);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .insert([{ ...fields, partner_id: partnerId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Product;
    }

    /** R2 : une catégorie donnée appartient à la partenaire de la session (sinon 400). */
    private static async assertOwnCategory(partnerId: string, categoryId: string | null | undefined): Promise<void> {
        if (!categoryId) return;
        const { data, error } = await getServiceRoleClient()
            .from('product_categories').select('id').eq('id', categoryId).eq('partner_id', partnerId).maybeSingle();
        if (error) throw new Error(`catégorie ${categoryId} illisible : ${error.message}`);
        if (!data) throw new PublicError('Catégorie de produit introuvable.', 'CATEGORY_NOT_FOUND', 400);
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

    static async getProductById(productId: string, partnerUserId: string): Promise<Product> {
        // Lot 9 (A32) : absence ou uuid invalide : 404 (500 auparavant) ; panne : erreur, journal et 500.
        const notFound = () => new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        if (!UUID_RE.test(productId)) throw notFound();
        // Contre-vérification (T8) : un produit de la partenaire de la session seulement (celui d'une autre : 404)
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('partner_id', partnerId)
            .maybeSingle();

        if (error) throw new Error(`produit ${productId} illisible : ${error.message}`);
        if (!data) throw notFound();
        return data as Product;
    }

    /** R2 : liste blanche, comme à la création ; ni partenaire, ni statut, ni identifiant pris du corps. */
    static async updateProduct(productId: string, partnerUserId: string, input: unknown): Promise<Product> {
        const fields = parseProductFields(input, 'update');
        // T6 : jamais une image du dossier des affiches (events/)
        assertNoPosterFolder(fields.images);
        const partnerId = await this.resolvePartnerId(partnerUserId);
        await this.assertOwnCategory(partnerId, fields.category_id as string | null | undefined);
        return this.writeProduct(productId, partnerId, fields);
    }

    private static async writeProduct(productId: string, partnerId: string, fields: Record<string, unknown>): Promise<Product> {
        if (!UUID_RE.test(productId)) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', productId)
            .eq('partner_id', partnerId)
            .select()
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
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

    /** Statut d'un produit (route POST /api/partner/products/[id]/status) : seul chemin qui le change (R2). */
    static async setProductStatus(productId: string, partnerUserId: string, status: unknown): Promise<Product> {
        if (status !== 'DISPONIBLE' && status !== 'INDISPONIBLE' && status !== 'SUSPENDU') {
            throw new PublicError('Statut de produit invalide.', 'INVALID_STATUS', 400);
        }
        const partnerId = await this.resolvePartnerId(partnerUserId);
        return this.writeProduct(productId, partnerId, { status });
    }
}

// ── Correctifs de la contre-vérification de la finition 2a (R2) : liste blanche des champs d'un produit ──────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const productFieldsSchema = z.object({
    category_id: z.string().regex(UUID_RE, 'Catégorie invalide.').nullable().optional(),
    name: z.string().trim().min(1, 'Le nom du produit est obligatoire.').max(200, 'Le nom compte au plus 200 caractères.'),
    description: z.string().trim().max(2000, 'La description compte au plus 2 000 caractères.').nullable().optional(),
    price: z.number().finite().min(0, 'Le prix ne peut pas être négatif.').max(100_000_000, 'Prix trop élevé.'),
    is_daily_special: z.boolean().optional(),
    daily_special_date: z.string().regex(DATE_RE, 'Date invalide (format AAAA-MM-JJ).').nullable().optional(),
    stock_quantity: z.number().int('Le stock est un nombre entier.').min(0, 'Le stock ne peut pas être négatif.').max(1_000_000).nullable().optional(),
    is_stock_managed: z.boolean().optional(),
    images: z.array(z.string().max(600, 'Adresse d’image trop longue.')).max(10, '10 images au plus.').optional(),
}).strict();

/** Champs d'un produit lus du corps : liste blanche (strict), tous facultatifs à la modification. */
function parseProductFields(input: unknown, mode: 'create' | 'update'): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new PublicError('Données du produit illisibles.', 'INVALID_INPUT', 400);
    }
    const schema = mode === 'create' ? productFieldsSchema : productFieldsSchema.partial().strict();
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        const unknownKey = parsed.error.issues.find((i) => i.code === 'unrecognized_keys') as { keys?: string[] } | undefined;
        if (unknownKey?.keys?.length) {
            throw new PublicError(`Ce champ ne se modifie pas ici : ${unknownKey.keys.join(', ')}.`, 'FIELD_NOT_EDITABLE', 400);
        }
        throw new PublicError(parsed.error.issues[0]?.message ?? 'Données du produit invalides.', 'INVALID_INPUT', 400);
    }
    if (mode === 'update' && Object.keys(parsed.data).length === 0) {
        throw new PublicError('Aucune modification à enregistrer.', 'INVALID_INPUT', 400);
    }
    return parsed.data as Record<string, unknown>;
}
