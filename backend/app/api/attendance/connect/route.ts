import { connectToSession } from '../../../../services/attendanceApi';

export async function POST(request: Request) {
  return connectToSession(request);
}
