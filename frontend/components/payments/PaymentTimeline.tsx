import React from 'react';
import { CheckCircle2, CircleDollarSign, Copy, ExternalLink, Loader2, ShieldCheck, WalletCards, XCircle } from '../ui/icons-compat';


export type PaymentStage = 'idle' | 'wallet' | 'challenge' | 'signing' | 'settling' | 'verified' | 'error';

interface PaymentTimelineProps {
  stage: PaymentStage;
  receipt?: any | null;
  error?: string;
  priceLabel?: string;
}

const stages: Array<{ id: Exclude<PaymentStage, 'idle' | 'error'>; label: string; icon: React.ReactNode }> = [
  { id: 'wallet', label: 'Payment session created', icon: <WalletCards size={15} /> },
  { id: 'challenge', label: 'Stripe test payment processing', icon: <ShieldCheck size={15} /> },
  { id: 'signing', label: 'Payment confirmed', icon: <CircleDollarSign size={15} /> },
  { id: 'settling', label: 'Server verification', icon: <Loader2 size={15} /> },
  { id: 'verified', label: 'Receipt issued', icon: <CheckCircle2 size={15} /> },
];

export const PaymentTimeline: React.FC<PaymentTimelineProps> = ({ stage, receipt, error, priceLabel }) => {
  const stageIndex = stages.findIndex((item) => item.id === stage);
  const explorerUrl = receipt?.explorerUrl || (receipt?.transactionId ? `https://testnet.explorer.perawallet.app/tx/${encodeURIComponent(receipt.transactionId)}` : '');

  const copyTransaction = async () => {
    if (receipt?.transactionId) await navigator.clipboard?.writeText(receipt.transactionId);
  };

  return (
    <div className="space-y-4 rounded-card border border-primary-soft bg-primary-light p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-meta font-bold text-primary ">Stripe payment ledger</p>
          <p className="text-xs text-ink-2">{priceLabel || 'USD on Stripe Testnet'} · simulated test cards only</p>
        </div>
        {stage === 'error' ? <XCircle className="text-danger-ink" size={20} /> : stage === 'verified' ? <CheckCircle2 className="text-success-ink" size={20} /> : <Loader2 className="animate-spin text-primary" size={18} />}
      </div>

      <div className="space-y-2">
        {stages.map((item, index) => {
          const complete = stage === 'verified' || (stageIndex >= 0 && index < stageIndex);
          const active = stage === item.id;
          return (
            <div key={item.id} className={`flex items-center gap-3 text-xs ${complete || active ? 'text-ink ' : 'text-ink-2'}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${complete ? 'bg-success text-on-primary' : active ? 'bg-primary text-on-primary' : 'bg-line-2 '}`}>
                {complete ? <CheckCircle2 size={15} /> : item.icon}
              </span>
              <span className="font-semibold">{item.label}</span>
            </div>
          );
        })}
      </div>

      {error && <p className="rounded-button bg-danger-bg p-3 text-xs font-semibold text-danger-ink">{error}</p>}

      {receipt?.transactionId && (
        <div className="rounded-button border border-success/30 bg-success-bg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-meta font-bold text-success-ink ">Settlement receipt</span>
            <span className="text-meta text-ink-2">{receipt.amount} micro-USDC</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-meta"><span className={`rounded-full px-2 py-1 font-bold ${receipt.verificationStatus === 'chain_verified' ? 'bg-success-bg text-success-ink ' : 'bg-primary-light text-primary-dark '}`}>{String(receipt.verificationStatus || 'facilitator_verified').replace(/_/g, ' ')}</span>{receipt.confirmedRound ? <span className="text-ink-2">Round {receipt.confirmedRound}</span> : null}{receipt.paymentId ? <span className="font-mono text-ink-2">Receipt {receipt.paymentId.slice(0, 8)}</span> : null}</div>
          <p className="break-all font-mono text-meta text-ink-2 ">{receipt.transactionId}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyTransaction} className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-meta font-bold text-ink-2 "><Copy size={12} /> Copy hash</button>
            {explorerUrl && <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-meta font-bold text-on-primary"><ExternalLink size={12} /> Verify on explorer</a>}
          </div>
        </div>
      )}
    </div>
  );
};
