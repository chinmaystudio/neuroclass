import { listClassroomMaterials, uploadClassroomMaterial } from '../../../services/materialApi';
import { handleOptions } from '../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  return uploadClassroomMaterial(request);
}

export async function GET(request: Request): Promise<Response> {
  return listClassroomMaterials(request);
}
