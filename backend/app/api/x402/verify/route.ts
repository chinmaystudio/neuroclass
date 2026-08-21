import { NextResponse } from 'next/server';
import { isSupabaseServiceRoleConfigured, supabase } from '../../../../database/supabase';
import { getAlgorandExplorerUrl } from '../../../../services/x402Routes';
import { reconcilePaymentOnAlgorand } from '../../../../services/x402Verification';
import { withCors, handleOptions } from '../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

const getOwner = async (request: Request) => {
  const reqOrigin = request.headers.get('origin');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: withCors(NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }), reqOrigin) };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: withCors(NextResponse.json({ error: 'Authentication is invalid or expired.' }, { status: 401 }), reqOrigin) };
  return { userId: data.user.id };
};

const getPayment = async (paymentId: string, ownerUserId: string, reqOrigin?: string | null) => {
  if (!isSupabaseServiceRoleConfigured()) return { error: withCors(NextResponse.json({ error: 'Payment verification is not configured on this deployment.' }, { status: 503 }), reqOrigin) };
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return { error: withCors(NextResponse.json({ error: 'A valid payment identifier is required.' }, { status: 400 }), reqOrigin) };
  const { data, error } = await (supabase.from('x402_payments') as any)
    .select('id,settlement_tx_id,payer_address,receiver_address,asset_id,amount_usdc_micro,service_name,status,network,verification_status,verified_at,confirmed_round,verification_error,chain_metadata,created_at')
    .eq('id', paymentId).eq('owner_user_id', ownerUserId).maybeSingle();
  if (error) return { error: withCors(NextResponse.json({ error: 'Payment receipt could not be loaded.' }, { status: 500 }), reqOrigin) };
  if (!data) return { error: withCors(NextResponse.json({ error: 'Payment receipt was not found for this account.' }, { status: 404 }), reqOrigin) };
  return { payment: data };
};

const publicReceipt = (payment: any) => ({
  paymentId: payment.id,
  serviceName: payment.service_name,
  status: payment.status,
  network: payment.network,
  transactionId: payment.settlement_tx_id,
  amountMicroUsdc: payment.amount_usdc_micro,
  payerAddress: payment.payer_address,
  receiverAddress: payment.receiver_address,
  verificationStatus: payment.verification_status,
  verifiedAt: payment.verified_at,
  confirmedRound: payment.confirmed_round,
  verificationError: payment.verification_error,
  explorerUrl: payment.settlement_tx_id ? getAlgorandExplorerUrl(payment.settlement_tx_id) : null,
  createdAt: payment.created_at,
});

export async function GET(request: Request): Promise<Response> {
  const reqOrigin = request.headers.get('origin');
  const owner = await getOwner(request);
  if (owner.error) return owner.error;
  const paymentId = new URL(request.url).searchParams.get('paymentId') || '';
  const result = await getPayment(paymentId, owner.userId!, reqOrigin);
  if (result.error) return result.error;
  return withCors(NextResponse.json({ receipt: publicReceipt(result.payment) }), reqOrigin);
}

export async function POST(request: Request): Promise<Response> {
  const reqOrigin = request.headers.get('origin');
  const owner = await getOwner(request);
  if (owner.error) return owner.error;
  const body = await request.json().catch(() => ({}));
  const result = await getPayment(typeof body.paymentId === 'string' ? body.paymentId : '', owner.userId!, reqOrigin);
  if (result.error) return result.error;
  const verification = await reconcilePaymentOnAlgorand(result.payment);
  const refreshed = { ...result.payment, verification_status: verification.status, verified_at: verification.verifiedAt, confirmed_round: verification.confirmedRound, verification_error: verification.error };
  return withCors(NextResponse.json({ receipt: publicReceipt(refreshed), verification }), reqOrigin);
}

