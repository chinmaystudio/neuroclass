import { NextResponse } from 'next/server';
import { supabase, isSupabaseServiceRoleConfigured } from '../../../../database/supabase';
import { withCors, handleOptions } from '../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const reqOrigin = request.headers.get('origin');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return withCors(NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }), reqOrigin);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return withCors(NextResponse.json({ error: 'Authentication is invalid or expired.' }, { status: 401 }), reqOrigin);
  if (!isSupabaseServiceRoleConfigured()) return withCors(NextResponse.json({ payments: [] }), reqOrigin);

  const url = new URL(request.url);
  const payer = url.searchParams.get('payer');
  if (payer && payer.length > 64) return withCors(NextResponse.json({ error: 'The wallet address is invalid.' }, { status: 400 }), reqOrigin);

  let query = (supabase.from('x402_payments') as any)
    .select('id,service_name,status,network,asset_id,amount_usdc_micro,payer_address,receiver_address,settlement_tx_id,request_path,verification_status,verified_at,confirmed_round,verification_error,created_at,updated_at')
    .eq('owner_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (payer) query = query.eq('payer_address', payer);
  const { data, error } = await query;
  if (error) return withCors(NextResponse.json({ error: 'Unable to read the payment ledger.' }, { status: 500 }), reqOrigin);

  return withCors(NextResponse.json({ payments: (data || []).map((payment: any) => ({
    ...payment,
    explorerUrl: payment.settlement_tx_id ? `https://testnet.explorer.perawallet.app/tx/${encodeURIComponent(payment.settlement_tx_id)}` : null,
    receiptUrl: payment.id ? `/api/x402/verify?paymentId=${encodeURIComponent(payment.id)}` : null,
  })) }), reqOrigin);
}

