import React from 'react';
import { Zap, CreditCard, CheckCircle2 } from '../../ui/icons-compat';

export const StripeDashboard: React.FC = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-3 mb-2">
        <Zap className="text-primary" size={32} />
        <h1 className="text-4xl font-semibold tracking-tight text-ink ">Stripe Payments (Test Mode)</h1>
      </div>
      <p className="text-ink-2">
        NeuroClass now uses Stripe Test Mode for all simulated payments. No real money is transacted.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="p-6 rounded-card bg-primary-light border border-primary-soft">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="text-primary" size={24} />
            <h3 className="text-lg font-bold">Test Cards</h3>
          </div>
          <p className="text-sm text-ink-2 mb-4">
            Use any of the official Stripe test cards when prompted for payment in the application.
          </p>
          <div className="p-4 bg-surface rounded-button font-mono text-sm border border-line ">
            4242 4242 4242 4242
          </div>
        </div>
        
        <div className="p-6 rounded-card bg-success-bg border border-success/30">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-success-ink" size={24} />
            <h3 className="text-lg font-bold">Simulated Transactions</h3>
          </div>
          <p className="text-sm text-ink-2 ">
            All AI generation features (Test Designer, Project Advisor) will automatically use the simulated Stripe payment flow without requiring real credentials.
          </p>
        </div>
      </div>
    </div>
  );
};
