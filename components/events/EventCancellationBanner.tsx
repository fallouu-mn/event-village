'use client';

import React from 'react';
import { AlertOctagon, Info } from 'lucide-react';

interface EventCancellationBannerProps {
    title: string;
    publicNotice?: string;
}

export const EventCancellationBanner: React.FC<EventCancellationBannerProps> = ({
    title,
    publicNotice,
}) => {
    return (
        <div className="w-full mb-8 p-6 rounded-3xl bg-red-50 dark:bg-red-950/40 border-2 border-red-500/30 shadow-lg shadow-red-500/5 text-slate-900 dark:text-white space-y-3">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <AlertOctagon size={26} />
                </div>
                <div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-600 text-white inline-block mb-1">
                        Événement Annulé
                    </span>
                    <h2 className="text-xl font-black text-red-950 dark:text-red-200">
                        Annulation Officielle de cet Événement
                    </h2>
                </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Cet événement a été annulé par l&apos;organisateur. La billetterie en ligne est désormais définitivement clôturée.
                Tous les billets précédemment achetés sont intégralement remboursés sur les comptes Mobile Money respectifs des acheteurs (Wave / Orange Money).
            </p>

            {publicNotice && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-red-200 dark:border-red-900/40 text-xs text-slate-700 dark:text-zinc-300">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-[11px]">Message de l&apos;organisateur :</span>
                        <p className="italic mt-0.5">{publicNotice}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
