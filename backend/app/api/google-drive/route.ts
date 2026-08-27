import { NextResponse } from 'next/server';
import { handleOptions } from '../../../../lib/cors';
import { uploadDriveFile } from '../../../../services/googleDriveApi';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  return uploadDriveFile(request);
}
