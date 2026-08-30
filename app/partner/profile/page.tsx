"use client";
import React, { useState, useEffect } from "react";
import { Save, User, MapPin, Phone, Mail, Building2, Briefcase, ImageIcon, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const ACTIVITY_TYPES = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "TRAITEUR", label: "Traiteur" },
  { value: "SALLE", label: "Salle de Reception" },
  { value: "ORGANISATEUR", label: "Organisateur Evenements" },
  { value: "PRESTATAIRE", label: "Prestataire de Services" },
  { value: "PATISSERIE", label: "Patisserie / Boulangerie" },
  { value: "ETABLISSEMENT_ALIMENTAIRE", label: "Etablissement Alimentaire" },
  { value: "AUTRE", label: "Autre" },
];

export default function PartnerProfilePage() {
  const [form, setForm] = useState({ company_name: "", commercial_name: "", description: "", address: "", city: "", phone: "", email: "", logo_url: "", cover_url: "" });
  const [activities, setActivities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/partner/profile").then(r => r.json()).then(d => {
      if (d.success && d.partner) {
        const p = d.partner;
        setForm({ company_name: p.company_name || "", commercial_name: p.commercial_name || "", description: p.description || "", address: p.address || "", city: p.city || "", phone: p.phone || "", email: p.email || "", logo_url: p.logo_url || "", cover_url: p.cover_url || "" });
        setActivities((p.partner_activities || []).map((a: any) => a.activity_type));
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  const toggleActivity = (val: string) => setActivities(prev => prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true); setFeedback(null);
    try {
      const res = await fetch("/api/partner/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, activities }) });
      const data = await res.json();
      if (data.success) setFeedback({ type: "success", message: "Page professionnelle mise a jour avec succes !" });
      else setFeedback({ type: "error", message: data.error || "Echec de la sauvegarde." });
    } catch { setFeedback({ type: "error", message: "Erreur reseau." }); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <div className="p-8 flex items-center gap-3"><RefreshCw className="animate-spin w-5 h-5 text-[#FF6B35]" /><span>Chargement du profil...</span></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Building2 className="w-8 h-8 text-[#FF6B35]" />
        <div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Page Professionnelle</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Votre vitrine publique sur Event Village</p></div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"}`}>
          {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><User className="w-5 h-5 text-[#FF6B35]" />Informations Generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ key: "company_name", label: "Nom de l entreprise *", placeholder: "Event Prestige Dakar" }, { key: "commercial_name", label: "Nom commercial (enseigne)", placeholder: "Prestige Events" }].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Description / Presentation</label>
            <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={4} placeholder="Decrivez votre activite, vos services, votre specialite..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50 resize-none" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#FF6B35]" />Activites</h2>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map(act => (
              <button key={act.value} type="button" onClick={() => toggleActivity(act.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${activities.includes(act.value) ? "bg-[#FF6B35] text-white border-[#FF6B35]" : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:border-[#FF6B35]"}`}>
                {act.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><MapPin className="w-5 h-5 text-[#FF6B35]" />Contact & Localisation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ key: "phone", label: "Telephone", placeholder: "+221 77 000 00 00", Icon: Phone }, { key: "email", label: "Email professionnel", placeholder: "contact@maboutique.sn", Icon: Mail }, { key: "address", label: "Adresse", placeholder: "Almadies Zone 2, Dakar", Icon: MapPin }, { key: "city", label: "Ville", placeholder: "Dakar", Icon: MapPin }].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{f.label}</label>
                <div className="relative"><f.Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#FF6B35]" />Visuels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ key: "logo_url", label: "URL du Logo" }, { key: "cover_url", label: "URL de la Photo de Couverture" }].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="bg-[#FF6B35] hover:bg-[#ff5719] text-white flex items-center gap-2 px-8 py-3 shadow-lg shadow-[#FF6B35]/20">
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Sauvegarde en cours..." : "Sauvegarder la Page"}
          </Button>
        </div>
      </form>
    </div>
  );
}