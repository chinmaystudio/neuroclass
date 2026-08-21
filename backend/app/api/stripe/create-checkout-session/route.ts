import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireGatewayAuth } from '../../../../lib/aiGateway';
import { withCors } from '../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get('origin'));
}

export async function POST(request: Request) {
  try {
    const auth = await requireGatewayAuth(request);
    const body = await request.json();
    
    // In test mode, we just return a simulated session ID
    // If STRIPE_SECRET_KEY is provided, we would use the real Stripe SDK
    const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
    
    if (stripeKey.startsWith('sk_test_mock')) {
      return withCors(NextResponse.json({
        sessionId: 'cs_test_' + Math.random().toString(36).substring(7),
        url: 'simulated_checkout_url'
      }), request.headers.get('origin'));
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-07-29.dahlia' as any });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: body.productName || 'NeuroClass Service',
            },
            unit_amount: body.amount || 100, // $1.00 by default
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: body.successUrl || 'http://localhost:3000/success',
      cancel_url: body.cancelUrl || 'http://localhost:3000/cancel',
    });
    
    return withCors(NextResponse.json({
      sessionId: session.id,
      url: session.url
    }), request.headers.get('origin'));
    
  } catch (error: any) {
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }), request.headers.get('origin'));
  }
}
