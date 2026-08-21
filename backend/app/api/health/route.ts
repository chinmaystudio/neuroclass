import { NextResponse } from 'next/server';
import { withCors, handleOptions } from '../../../lib/cors';

export async function GET() {
  const response = NextResponse.json({
    status: "online",
    service: "NeuroClass AI Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
  
  return withCors(response);
}

export async function OPTIONS() {
  return handleOptions();
}
