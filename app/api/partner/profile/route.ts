import { NextRequest, NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from("partners")
            .select("*, partner_activities(*)")
            .eq("user_id", user.id)
            .single();
        if (error || !partner) return NextResponse.json({ error: "Profil partenaire introuvable." }, { status: 404 });
        return NextResponse.json({ success: true, partner });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || !["PARTENAIRE", "ADMIN", "SUPERADMIN"].includes(user.role)) {
            return NextResponse.json({ error: "Acces refuse." }, { status: 403 });
        }
        const body = await request.json();
        const supabase = getServiceRoleClient();
        const { data: existing } = await supabase.from("partners").select("id").eq("user_id", user.id).single();
        if (!existing) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
        const allowedFields: Record<string, unknown> = {};
        const updatableFields = ["company_name","commercial_name","description","logo_url","cover_url","address","city","latitude","longitude","phone","email"];
        for (const field of updatableFields) {
            if (body[field] !== undefined) allowedFields[field] = body[field];
        }
        allowedFields.updated_at = new Date().toISOString();
        const { data: updated, error: updateErr } = await supabase
            .from("partners")
            .update(allowedFields)
            .eq("id", existing.id)
            .select("*, partner_activities(*)")
            .single();
        if (updateErr || !updated) {
            return NextResponse.json({ error: updateErr?.message || "Echec mise a jour." }, { status: 400 });
        }
        if (body.activities && Array.isArray(body.activities)) {
            await supabase.from("partner_activities").delete().eq("partner_id", existing.id);
            if (body.activities.length > 0) {
                await supabase.from("partner_activities").insert(
                    body.activities.map((act: string) => ({ partner_id: existing.id, activity_type: act, is_active: true }))
                );
            }
        }
        return NextResponse.json({ success: true, partner: updated });
    } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 500 });
    }
}