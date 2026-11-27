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
    /** Lot 12a : établissement (choisi à la création, jamais changé), case « réglementé » et sorte, décision de l'administration. */
    venue_id?: string | null;
    is_regulated?: boolean;
    regulated_kind?: 'ALCOOL' | 'TABAC' | null;
    regulated_admin?: boolean | null;
    /** Lot 12c : « à vérifier » (mots trouvés) tant que l'administration n'a pas décidé ; archivé (retiré de la carte). */
    review_state?: 'A_VERIFIER' | null;
    review_words?: string[] | null;
    review_requested_at?: string | null;
    archived_at?: string | null;
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
        // Lot 12c : enregistré par order_product_save (fiche VALIDE, établissement de la partenaire, prix entier borné,
        // « à vérifier » posé par la base) ; la partenaire est celle de la session, jamais prise du corps
        return this.saveProduct(partnerUserId, null, fields);
    }

    /**
     * Lot 12c : écriture d'un produit par la fonction en base order_product_save, seul chemin d'écriture de la partenaire
     * (la garde products_order_guard refuse qu'une autre écriture pose ou efface l'état « à vérifier » ou l'archivage).
     */
    private static async saveProduct(partnerUserId: string, productId: string | null, fields: Record<string, unknown>): Promise<Product> {
        if (productId !== null && !UUID_RE.test(productId)) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        const { data, error } = await getServiceRoleClient().rpc('order_product_save', {
            p: { actor_id: partnerUserId, product_id: productId, fields },
        });
        if (error) throw new Error(`order_product_save : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) throw catalogRefusal(r, 'Produit non enregistré.');
        return r.product as Product;
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
        
        // Lot 12c : un produit archivé n'est plus dans les listes (il reste dans l'historique des commandes)
        let query = supabase.from('products').select('*').eq('partner_id', partnerId).is('archived_at', null);
        
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
        return this.saveProduct(partnerUserId, productId, fields);
    }

    private static async writeProduct(productId: string, partnerId: string, fields: Record<string, unknown>): Promise<Product> {
        if (!UUID_RE.test(productId)) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase
            .from('products')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', productId)
            .eq('partner_id', partnerId)
            // Contre-vérification du lot 12c (T6) : un produit archivé ne change plus (la base le refuse aussi)
            .is('archived_at', null)
            .select()
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) {
            const { data: archived, error: readErr } = await supabase.from('products').select('id')
                .eq('id', productId).eq('partner_id', partnerId).not('archived_at', 'is', null).maybeSingle();
            if (readErr) throw new Error(`produit ${productId} illisible : ${readErr.message}`);
            if (archived) throw new PublicError('Ce produit est archivé : il ne se modifie plus.', 'PRODUCT_ARCHIVED', 409);
            throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        }
        return data as Product;
    }

    /**
     * Contre-vérification du lot 12c (point 8) : « Remettre en vente » un produit archivé, par order_product_save (restore) :
     * il revient sur la carte et il est revu par la liste des mots (sauf les mots déjà autorisés par l'administration).
     */
    static async restoreProduct(productId: string, partnerUserId: string): Promise<Product> {
        if (!UUID_RE.test(productId)) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        const { data, error } = await getServiceRoleClient().rpc('order_product_save', {
            p: { actor_id: partnerUserId, product_id: productId, restore: true, fields: {} },
        });
        if (error) throw new Error(`order_product_save : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) throw catalogRefusal(r, 'Produit non remis en vente.');
        return r.product as Product;
    }

    /**
     * Lot 12c : retrait d'un produit par order_product_remove — supprimé s'il n'a jamais été vendu, archivé sinon (avant :
     * erreur 500 de clé étrangère pour un produit vendu). Rend l'issue et le message à afficher.
     */
    static async deleteProduct(productId: string, partnerUserId: string): Promise<{ success: boolean; outcome: 'DELETED' | 'ARCHIVED'; message: string }> {
        if (!UUID_RE.test(productId)) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
        const { data, error } = await getServiceRoleClient().rpc('order_product_remove', { p: { actor_id: partnerUserId, product_id: productId } });
        if (error) throw new Error(`order_product_remove : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) throw catalogRefusal(r, 'Produit non retiré.');
        return { success: true, outcome: r.outcome === 'ARCHIVED' ? 'ARCHIVED' : 'DELETED', message: String(r.message ?? 'Produit retiré.') };
    }

    /** Statut d'un produit (route POST /api/partner/products/[id]/status) : seul chemin qui le change (R2). */
    static async setProductStatus(productId: string, partnerUserId: string, status: unknown): Promise<Product> {
        // Lot 12c : « épuisé » se choisit aussi à la main (CDC § 61 : disponible, indisponible, épuisé, suspendu)
        if (status !== 'DISPONIBLE' && status !== 'INDISPONIBLE' && status !== 'EPUISE' && status !== 'SUSPENDU') {
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
    // Lot 12c : F CFA entiers, comme la base (products_price_franc_chk, order_product_save)
    price: z.number().int('Le prix est un nombre entier de F CFA.').min(0, 'Le prix ne peut pas être négatif.').max(10_000_000, 'Le prix compte au plus 10 000 000 F CFA.'),
    is_daily_special: z.boolean().optional(),
    daily_special_date: z.string().regex(DATE_RE, 'Date invalide (format AAAA-MM-JJ).').nullable().optional(),
    stock_quantity: z.number().int('Le stock est un nombre entier.').min(0, 'Le stock ne peut pas être négatif.').max(1_000_000).nullable().optional(),
    is_stock_managed: z.boolean().optional(),
    images: z.array(z.string().max(600, 'Adresse d’image trop longue.')).max(10, '10 images au plus.').optional(),
    // Lot 12c : établissement (à la création seulement : il ne change jamais ensuite), case « réglementé » et sorte
    venue_id: z.string().regex(UUID_RE, 'Établissement invalide.').optional(),
    is_regulated: z.boolean().optional(),
    regulated_kind: z.enum(['ALCOOL', 'TABAC'], { message: 'Choisissez alcool ou tabac.' }).nullable().optional(),
}).strict();

/** Lot 12c : à la modification, l'établissement ne se change pas (refus FIELD_NOT_EDITABLE, comme les autres champs fermés). */
const productUpdateSchema = productFieldsSchema.omit({ venue_id: true }).partial().strict();

/** Champs d'un produit lus du corps : liste blanche (strict), tous facultatifs à la modification. */
function parseProductFields(input: unknown, mode: 'create' | 'update'): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new PublicError('Données du produit illisibles.', 'INVALID_INPUT', 400);
    }
    const schema = mode === 'create' ? productFieldsSchema : productUpdateSchema;
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        const unknownKey = parsed.error.issues.find((i) => i.code === 'unrecognized_keys') as { keys?: string[] } | undefined;
        if (unknownKey?.keys?.length) {
            // Contre-vérification du lot 12c (point « mots techniques ») : aucun nom de champ dans le texte
            throw new PublicError('Ce champ ne se modifie pas ici.', 'FIELD_NOT_EDITABLE', 400);
        }
        throw new PublicError(parsed.error.issues[0]?.message ?? 'Données du produit invalides.', 'INVALID_INPUT', 400);
    }
    if (mode === 'update' && Object.keys(parsed.data).length === 0) {
        throw new PublicError('Aucune modification à enregistrer.', 'INVALID_INPUT', 400);
    }
    return parsed.data as Record<string, unknown>;
}

/** Lot 12c : refus d'une fonction du catalogue (message déjà en français simple), avec le statut HTTP de son code. */
export function catalogRefusal(r: Record<string, unknown>, fallback: string): PublicError {
    const code = typeof r.code === 'string' ? r.code : 'CATALOG_REFUSED';
    const status = code.endsWith('_NOT_FOUND') ? 404
        : code === 'FORBIDDEN' || code === 'PARTNER_SUSPENDED' || code === 'PARTNER_NOT_VALIDATED' ? 403
            : code.startsWith('TOO_MANY') ? 429
                : code === 'PRODUCT_ARCHIVED' || code === 'PRODUCT_NOT_ARCHIVED' || code === 'ZONE_EXISTS' || code === 'INVALID_ORDER'
                    || code === 'CATEGORY_EXISTS' ? 409 : 400;
    return new PublicError(typeof r.message === 'string' && r.message ? r.message : fallback, code, status);
}
