import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
      <div className="w-20 h-20 rounded-3xl bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center border border-orange-200 dark:border-orange-900/30">
        <Compass size={40} />
      </div>
      <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">404</h1>
      <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">Page introuvable</h2>
      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
        La ressource que vous recherchez a été déplacée ou n&apos;existe plus.
      </p>
      <Link href="/">
        <Button variant="primary" size="md" leftIcon={<ArrowLeft size={16} />}>
          Retour à l&apos;accueil
        </Button>
      </Link>
    </div>
  );
}
