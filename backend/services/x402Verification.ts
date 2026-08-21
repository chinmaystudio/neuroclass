import { isSupabaseServiceRoleConfigured, supabase } from '../database/supabase';

const X402_USDC_ASSET = 10458941;
const X402_TREASURY_ADDRESS = (process.env.NEUROCLASS_TREASURY_ADDRESS || 'HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A').trim();

export type ChainVerificationStatus = 'chain_verified' | 'pending' | 'not_found' | 'mismatch' | 'verification_unavailable';

export type ChainVerificationResult = {
  status: ChainVerificationStatus;
  verifiedAt: string;
  confirmedRound: number | null;
  error: string | null;
  metadata: Record<string, unknown>;
};

type PaymentForVerification = {
  id: string;
  settlement_tx_id: string | null;
  payer_address: string | null;
  receiver_address: string | null;
  asset_id: number | string | null;
  amount_usdc_micro: number | string | null;
};

const indexerBaseUrl = () => (process.env.ALGORAND_INDEXER_URL || 'https://testnet-idx.algonode.cloud').replace(/\/$/, '');
const validTransactionId = (transactionId: string) => /^[A-Z2-7]{40,64}$/i.test(transactionId);
const safeString = (value: unknown, max = 256) => typeof value === 'string' ? value.slice(0, max) : '';
const toNumber = (value: unknown): number | null => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0 ? numberValue : null;
};

export async function verifyPaymentOnAlgorand(payment: PaymentForVerification): Promise<ChainVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const transactionId = payment.settlement_tx_id;
  if (!transactionId || !validTransactionId(transactionId)) {
    return { status: 'not_found', verifiedAt, confirmedRound: null, error: 'The settlement transaction identifier is missing or invalid.', metadata: {} };
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.ALGORAND_INDEXER_API_TOKEN) headers['X-Indexer-API-Token'] = process.env.ALGORAND_INDEXER_API_TOKEN;
    const response = await fetch(`${indexerBaseUrl()}/v2/transactions/${encodeURIComponent(transactionId)}`, { headers, signal: AbortSignal.timeout(8_000) });
    if (response.status === 404) return { status: 'not_found', verifiedAt, confirmedRound: null, error: 'The transaction is not yet indexed on the configured Algorand Indexer.', metadata: { transactionId } };
    if (!response.ok) return { status: 'verification_unavailable', verifiedAt, confirmedRound: null, error: `Indexer lookup failed with HTTP ${response.status}.`, metadata: { transactionId } };

    const body = await response.json() as Record<string, any>;
    const transaction = body.transaction || body;
    const confirmedRound = toNumber(transaction['confirmed-round']);
    const transfer = transaction['asset-transfer-transaction'] || {};
    const sender = safeString(transaction.sender, 80);
    const receiver = safeString(transfer.receiver, 80);
    const assetId = toNumber(transfer['asset-id']);
    const amount = toNumber(transfer.amount);
    const type = safeString(transaction['tx-type'], 20);
    const expectedReceiver = payment.receiver_address || X402_TREASURY_ADDRESS;
    const expectedAsset = Number(payment.asset_id ?? X402_USDC_ASSET);
    const expectedAmount = Number(payment.amount_usdc_micro ?? 0);
    const checks = {
      type: type === 'axfer',
      confirmed: Boolean(confirmedRound && confirmedRound > 0),
      sender: !payment.payer_address || sender === payment.payer_address,
      receiver: receiver === expectedReceiver,
      asset: assetId === expectedAsset,
      amount: expectedAmount > 0 && amount === expectedAmount,
    };
    const metadata = { transactionId, type, sender, receiver, assetId, amount, expectedReceiver, expectedAsset, expectedAmount, checks };
    if (!checks.confirmed) return { status: 'pending', verifiedAt, confirmedRound, error: 'The transaction has not reached a confirmed round yet.', metadata };
    if (!checks.type || !checks.sender || !checks.receiver || !checks.asset || !checks.amount) return { status: 'mismatch', verifiedAt, confirmedRound, error: 'The confirmed transaction does not match the expected x402 USDC transfer.', metadata };
    return { status: 'chain_verified', verifiedAt, confirmedRound, error: null, metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Indexer error.';
    return { status: 'verification_unavailable', verifiedAt, confirmedRound: null, error: message.slice(0, 300), metadata: { transactionId } };
  }
}

export async function reconcilePaymentOnAlgorand(payment: PaymentForVerification): Promise<ChainVerificationResult> {
  const result = await verifyPaymentOnAlgorand(payment);
  if (!isSupabaseServiceRoleConfigured()) return result;

  const { error: updateError } = await (supabase.from('x402_payments') as any).update({
    verification_status: result.status,
    verified_at: result.verifiedAt,
    confirmed_round: result.confirmedRound,
    verification_error: result.error,
    chain_metadata: result.metadata,
    updated_at: result.verifiedAt,
  }).eq('id', payment.id);
  if (updateError) console.error('Unable to save x402 chain verification:', updateError.message);

  const { data: existingEvent } = await (supabase.from('x402_payment_events') as any)
    .select('id').eq('payment_id', payment.id).eq('event_type', `chain_${result.status}`).limit(1).maybeSingle();
  if (!existingEvent) {
    const { error: eventError } = await (supabase.from('x402_payment_events') as any).insert({
      payment_id: payment.id,
      event_type: `chain_${result.status}`,
      details: { transactionId: payment.settlement_tx_id, confirmedRound: result.confirmedRound, error: result.error, checks: result.metadata.checks || null },
    });
    if (eventError) console.error('Unable to save x402 chain verification event:', eventError.message);
  }
  return result;
}
