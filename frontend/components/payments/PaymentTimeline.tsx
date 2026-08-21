import React from 'react';
import { CheckCircle2, CircleDollarSign, Copy, ExternalLink, Loader2, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import type { SettlementReceipt } from '../../types/x402-domain';

export type PaymentStage = 'idle' | 'wallet' | 'challenge' | 'signing' | 'settling' | 'verified' | 'error';

interface PaymentTimelineProps {
  stage: PaymentStage;
  receipt?: SettlementReceipt | null;
  error?: string;
  priceLabel?: string;
}

const stages: Array<{ id: Exclude<PaymentStage, 'idle' | 'error'>; label: string; icon: React.ReactNode }> = [
  { id: 'wallet', label: 'Wallet connected', icon: <WalletCards size={15} /> },
  { id: 'challenge', label: '402 payment challenge received', icon: <ShieldCheck size={15} /> },
  { id: 'signing', label: 'Payment signed in Pera', icon: <CircleDollarSign size={15} /> },
  { id: 'settling', label: 'Algorand settlement verified', icon: <Loader2 size={15} /> },
  { id: 'verified', label: 'Receipt issued', icon: <CheckCircle2 size={15} /> },
];

export const PaymentTimeline: React.FC<PaymentTimelineProps> = ({ stage, receipt, error, priceLabel }) => {
  const stageIndex = stages.findIndex((item) => item.id === stage);
  const explorerUrl = receipt?.explorerUrl || (receipt?.transactionId ? `https://testnet.explorer.perawallet.app/tx/${encodeURIComponent(receipt.transactionId)}` : '');

  const copyTransaction = async () => {
    if (receipt?.transactionId) await navigator.clipboard?.writeText(receipt.transactionId);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">x402 payment ledger</p>
          <p className="text-xs text-slate-500">{priceLabel || 'USDC on Algorand Testnet'} · wallet signs locally</p>
        </div>
        {stage === 'error' ? <XCircle className="text-rose-500" size={20} /> : stage === 'verified' ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Loader2 className="animate-spin text-blue-500" size={18} />}
      </div>

      <div className="space-y-2">
        {stages.map((item, index) => {
          const complete = stage === 'verified' || (stageIndex >= 0 && index < stageIndex);
          const active = stage === item.id;
          return (
            <div key={item.id} className={`flex items-center gap-3 text-xs ${complete || active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-white/10'}`}>
                {complete ? <CheckCircle2 size={15} /> : item.icon}
              </span>
              <span className="font-semibold">{item.label}</span>
            </div>
          );
        })}
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600">{error}</p>}

      {receipt?.transactionId && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Settlement receipt</span>
            <span className="text-[10px] text-slate-500">{receipt.amount} micro-USDC</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]"><span className={`rounded-full px-2 py-1 font-bold uppercase tracking-wider ${receipt.verificationStatus === 'chain_verified' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'}`}>{String(receipt.verificationStatus || 'facilitator_verified').replace(/_/g, ' ')}</span>{receipt.confirmedRound ? <span className="text-slate-500">Round {receipt.confirmedRound}</span> : null}{receipt.paymentId ? <span className="font-mono text-slate-400">Receipt {receipt.paymentId.slice(0, 8)}</span> : null}</div>
          <p className="break-all font-mono text-[11px] text-slate-600 dark:text-slate-300">{receipt.transactionId}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyTransaction} className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-white"><Copy size={12} /> Copy hash</button>
            {explorerUrl && <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white"><ExternalLink size={12} /> Verify on explorer</a>}
          </div>
        </div>
      )}
    </div>
  );
};
