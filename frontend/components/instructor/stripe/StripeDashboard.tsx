import React from 'react';
import { Zap, CreditCard, CheckCircle2 } from 'lucide-react';

export const StripeDashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-3 mb-2">
        <Zap className="text-blue-500" size={32} />
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Stripe Payments (Test Mode)</h1>
      </div>
      <p className="text-slate-500">
        NeuroClass now uses Stripe Test Mode for all simulated payments. No real money is transacted.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="p-6 rounded-3xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="text-blue-500" size={24} />
            <h3 className="text-lg font-bold">Test Cards</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Use any of the official Stripe test cards when prompted for payment in the application.
          </p>
          <div className="p-4 bg-white dark:bg-black/20 rounded-xl font-mono text-sm border border-slate-200 dark:border-white/10">
            4242 4242 4242 4242
          </div>
        </div>
        
        <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-emerald-500" size={24} />
            <h3 className="text-lg font-bold">Simulated Transactions</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            All AI generation features (Test Designer, Project Advisor) will automatically use the simulated Stripe payment flow without requiring real credentials.
          </p>
        </div>
      </div>
    </div>
  );
};
