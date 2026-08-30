"use client";

import React, { useState, useEffect } from "react";
import { Save, User, MapPin, Phone, Mail, Building2, Briefcase, ImageIcon, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const ACTIVITY_TYPES = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "TRAITEUR", label: "Traiteur" },
  { value: "SALLE", label: "Salle de Réception" },
  { value: "ORGANISATEUR", label: "Organisateur Événements" },
  { value: "PRESTATAIRE", label: "Prestataire de Services" },
  { value: "PATISSERIE", label: "Pâtisserie / Boulangerie" },
  { value: "ETABLISSEMENT_ALIMENTAIRE", label: "Établissement Alimentaire" },
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
    if (isSaving) return;
    setIsSaving(true); setFeedback(null);
    try {
      const res = await fetch("/api/partner/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, activities }) });
      const data = await res.json();
      if (data.success) setFeedback({ type: "success", message: "Page professionnelle mise à jour avec succès !" });
      else setFeedback({ type: "error", message: data.error || "Échec de la sauvegarde." });
    } catch { setFeedback({ type: "error", message: "Erreur réseau." }); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center gap-3 min-h-[50vh]">
      <RefreshCw className="animate-spin w-6 h-6 text-[#FF5722]" />
      <span className="text-sm font-bold text-slate-600 dark:text-zinc-400">Chargement du profil...</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8 pb-16">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white flex items-center justify-center shadow-md shadow-[#FF5722]/30">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Page Professionnelle</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Votre vitrine publique sur Event Village</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border transition-all ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"}`}>
          {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Informations Générales */}
        <div className="bg-white dark:bg-[#1D1D22] border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-card">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#FF5722]" />
            Informations Générales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ key: "company_name", label: "Nom de l'entreprise *", placeholder: "Event Prestige Dakar" }, { key: "commercial_name", label: "Nom commercial (enseigne)", placeholder: "Prestige Events" }].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/80 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Description / Présentation</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="Décrivez votre activité, vos services, votre spécialité..."
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/80 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-[#FF5722] resize-none transition-all"
            />
          </div>
        </div>

        {/* Activités avec Dégradé Sunset */}
        <div className="bg-white dark:bg-[#1D1D22] border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-card">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#FF5722]" />
            Activités
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {ACTIVITY_TYPES.map(act => {
              const isSelected = activities.includes(act.value);
              return (
                <button
                  key={act.value}
                  type="button"
                  onClick={() => toggleActivity(act.value)}
                  className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                    isSelected
                      ? "bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold scale-[1.02]"
                      : "bg-slate-50 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-[#FF5722] hover:text-[#FF5722]"
                  }`}
                >
                  {act.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact & Localisation */}
        <div className="bg-white dark:bg-[#1D1D22] border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-card">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#FF5722]" />
            Contact & Localisation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ key: "phone", label: "Téléphone", placeholder: "+221 77 000 00 00", Icon: Phone }, { key: "email", label: "Email professionnel", placeholder: "contact@maboutique.sn", Icon: Mail }, { key: "address", label: "Adresse", placeholder: "Almadies Zone 2, Dakar", Icon: MapPin }, { key: "city", label: "Ville", placeholder: "Dakar", Icon: MapPin }].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">{f.label}</label>
                <div className="relative">
                  <f.Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/80 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visuels */}
        <div className="bg-white dark:bg-[#1D1D22] border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-card">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#FF5722]" />
            Visuels
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ key: "logo_url", label: "URL du Logo" }, { key: "cover_url", label: "URL de la Photo de Couverture" }].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="https://..."
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/80 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bouton de Sauvegarde */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            leftIcon={<Save className="w-5 h-5" />}
          >
            {isSaving ? "Sauvegarde en cours..." : "Sauvegarder la Page"}
          </Button>
        </div>
      </form>
    </div>
  );
}