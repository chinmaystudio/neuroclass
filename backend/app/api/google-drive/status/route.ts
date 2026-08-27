import { NextResponse } from 'next/server';
import { handleOptions } from '../../../../lib/cors';
import { driveConnectionStatus } from '../../../../services/googleDriveApi';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  return driveConnectionStatus(request);
}
