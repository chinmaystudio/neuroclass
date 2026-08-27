import { googleDriveCallback } from '../../../../services/googleDriveApi';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return googleDriveCallback(request);
}
