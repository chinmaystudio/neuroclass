export type PaymentRequirement = {
  scheme: 'exact';
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  serviceName: string;
  description: string;
};

export type SettlementReceipt = {
  protocolVersion: number;
  network: string;
  asset: string;
  transactionId: string;
  payer: string;
  amount: string;
  receiptHeader: string;
  explorerUrl?: string;
  serviceName?: string;
  paymentId?: string;
  verificationStatus?: 'facilitator_verified' | 'chain_verified' | 'pending' | 'not_found' | 'mismatch' | 'verification_unavailable';
  confirmedRound?: number | null;
};

export type AccessResolution<T = unknown> =
  | {
      status: 'payment_required';
      requirement: PaymentRequirement;
      challengeHeader: string;
    }
  | {
      status: 'authorised';
      receipt: SettlementReceipt;
      data: T;
    }
  | {
      status: 'failed';
      error: string;
      failureCode: string;
      retryable: boolean;
    };

export function parsePaymentRequirementHeader(header: string | null): PaymentRequirement | null {
  if (!header) return null;
  try {
    const raw = JSON.parse(atob(header));
    const accepts = Array.isArray(raw.accepts) ? raw.accepts[0] : raw.accepts || raw;
    if (!accepts) return null;
    return {
      scheme: accepts.scheme || 'exact',
      network: accepts.network || '',
      asset: accepts.asset || '',
      amount: String(accepts.amount || '0'),
      payTo: accepts.payTo || '',
      maxTimeoutSeconds: Number(accepts.maxTimeoutSeconds || 120),
      serviceName: raw.serviceName || accepts.description || 'NeuroClass AI Service',
      description: raw.description || accepts.description || '',
    };
  } catch {
    return null;
  }
}

export function parseSettlementReceiptHeader(header: string | null): SettlementReceipt | null {
  if (!header) return null;
  try {
    const raw = JSON.parse(atob(header));
    if (!raw || !raw.transaction) return null;
    return {
      protocolVersion: Number(raw.protocolVersion || 2),
      network: raw.network || '',
      asset: raw.asset || '',
      transactionId: raw.transaction,
      payer: raw.payer || '',
      amount: String(raw.amount || '0'),
      receiptHeader: header,
      explorerUrl: raw.explorerUrl || undefined,
      serviceName: raw.serviceName || undefined,
    };
  } catch {
    return null;
  }
}
