import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, Copy, ExternalLink, Zap, RefreshCw, ShieldCheck, Activity, LogOut } from 'lucide-react';
import { algoClient } from '../../../services/algoClient';
import { getApiUrl } from '../../../config/apiConfig';
import { supabase } from '../../../database/supabase';

interface WalletState {
  address: string;
  balanceAlgo: number;
}

export const ProtocolDashboard = () => {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);

  const loadPaymentLogs = async (address: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const response = await fetch(`${getApiUrl('/api/x402/ledger')}?payer=${encodeURIComponent(address)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setPayments((await response.json()).payments || []);
  };

  useEffect(() => {
    algoClient.reconnectWallet().then(async address => {
      if (!address) return;
      const balanceAlgo = await algoClient.getBalance(address).catch(() => 0);
      setWallet({ address, balanceAlgo });
      void loadPaymentLogs(address);
    });
  }, []);

  const connectWallet = async () => {
    setLoading(true);
    setError('');
    try {
      const address = await algoClient.connectWallet();
      const balanceAlgo = await algoClient.getBalance(address).catch(() => 0);
      setWallet({ address, balanceAlgo });
      void loadPaymentLogs(address);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Wallet connection failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (paymentId: string) => {
    setVerifyingPaymentId(paymentId);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Your signed-in session has expired.');
      const response = await fetch(getApiUrl('/api/x402/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ paymentId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Payment reconciliation failed.');
      setPayments((current) => current.map((payment) => payment.id === paymentId ? { ...payment, verification_status: body.receipt.verificationStatus, verified_at: body.receipt.verifiedAt, confirmed_round: body.receipt.confirmedRound, verification_error: body.receipt.verificationError } : payment));
    } catch (err: any) {
      setError(err.message || 'Payment reconciliation failed.');
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  const refreshBalance = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const balanceAlgo = await algoClient.getBalance(wallet.address);
      setWallet({ ...wallet, balanceAlgo });
      void loadPaymentLogs(wallet.address);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to refresh balance');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const disconnectWallet = async () => {
    await algoClient.disconnectWallet();
    setWallet(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="flex items-center gap-3 mb-2"><Zap className="text-yellow-500" size={32} /><h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">x402 Protocol</h1></div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Non-custodial AI payments on Algorand Testnet</p>
      </div>

      {!wallet ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-12 text-center space-y-6 shadow-xl">
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto text-yellow-600 dark:text-yellow-400"><Wallet size={40} /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Connect your Algorand wallet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">Connect Pera Wallet on Algorand Testnet to use paid NeuroClass features. Your private key and mnemonic remain inside the wallet.</p>
          </div>
          {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}
          <button onClick={connectWallet} disabled={loading} className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50">
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Wallet size={16} />} Connect Pera Wallet
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-white/10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px]" />
              <div className="relative z-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div><h3 className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">Available Balance</h3><div className="flex items-end gap-2"><span className="text-5xl font-black tracking-tighter">{wallet.balanceAlgo.toFixed(3)}</span><span className="text-xl font-medium text-yellow-500 mb-1">ALGO</span></div></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest"><Activity size={12} /> Testnet Active</div>
                </div>
                <div>
                  <label className="text-white/50 text-[10px] font-bold uppercase tracking-widest block mb-1">Connected Wallet</label>
                  <div className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/5"><code className="text-sm text-white/90 truncate flex-1 font-mono">{wallet.address}</code><button onClick={() => copyToClipboard(wallet.address)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white shrink-0" title="Copy address"><Copy size={16} /></button></div>
                  {copied && <p className="text-emerald-400 text-[10px] mt-2">Address copied</p>}
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                  <a href={`https://dispenser.testnet.aws.algodev.network?account=${wallet.address}`} target="_blank" rel="noreferrer" className="flex-1 py-3 bg-white text-black text-center rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-white transition-colors flex items-center justify-center gap-2">Fund via Dispenser <ExternalLink size={14} /></a>
                  <button onClick={refreshBalance} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors" title="Refresh balance"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 space-y-6">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4"><ShieldCheck size={24} /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">x402 Security</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">NeuroClass requests micro-payments with HTTP 402. The backend verifies the confirmed Algorand transfer to the configured treasury and consumes each transaction only once before running the AI service.</p>
              <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 space-y-2"><div className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold uppercase tracking-widest">Service</span><span className="text-slate-900 dark:text-white font-bold">Cost</span></div><div className="flex justify-between items-center text-sm border-t border-slate-200 dark:border-white/5 pt-2"><span className="text-slate-600 dark:text-slate-300">AI Test Generation</span><span className="text-yellow-600 dark:text-yellow-500 font-mono font-bold">0.10 USDC</span></div></div>
              {error && <p className="text-rose-500 text-xs">{error}</p>}
              <button onClick={disconnectWallet} className="w-full py-3 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"><LogOut size={14} /> Disconnect Wallet</button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-white/5">
          <div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Verified payment log</h3><p className="text-xs text-slate-500">Settlements persisted by the x402 backend for this wallet.</p></div><button onClick={() => wallet && loadPaymentLogs(wallet.address)} className="rounded-xl bg-slate-100 p-2 dark:bg-white/10"><RefreshCw size={15} /></button></div>
          {payments.length === 0 ? <p className="text-sm text-slate-500">No securely account-bound settled payments for this wallet yet. Complete a paid AI request while signed in to populate the ledger.</p> : <div className="space-y-3">{payments.map((payment) => <div key={payment.id} className="rounded-2xl border border-black/5 p-4 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">{payment.service_name}</p><p className="text-[10px] uppercase tracking-widest text-slate-500">{payment.status} · {payment.amount_usdc_micro || 0} micro-USDC</p></div><span className="text-xs text-slate-500">{payment.created_at ? new Date(payment.created_at).toLocaleString() : ''}</span></div>{payment.settlement_tx_id && <div className="mt-3 space-y-2"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${payment.verification_status === 'chain_verified' ? 'bg-emerald-500/10 text-emerald-600' : payment.verification_status === 'mismatch' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>{String(payment.verification_status || 'facilitator_verified').replace(/_/g, ' ')}</span>{payment.confirmed_round && <span className="text-[10px] text-slate-500">Round {payment.confirmed_round}</span>}</div><code className="block break-all text-[11px] text-slate-500">{payment.settlement_tx_id}</code><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void verifyPayment(payment.id)} disabled={verifyingPaymentId === payment.id} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{verifyingPaymentId === payment.id ? <RefreshCw className="animate-spin" size={12} /> : <ShieldCheck size={12} />} Reconcile chain</button><a href={payment.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white">Explorer <ExternalLink size={12} /></a></div>{payment.verification_error && <p className="text-xs text-amber-600">{payment.verification_error}</p>}</div>}</div>)}</div>}
        </div>
        </div>
      )}
    </div>
  );
};
