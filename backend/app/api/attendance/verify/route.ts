import { verifyAttendance } from '../../../../services/attendanceApi';
import { handleOptions } from '../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  return verifyAttendance(request);
}
