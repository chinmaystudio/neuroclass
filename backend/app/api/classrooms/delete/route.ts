import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '../../../../lib/cors';
import { requireGatewayAuth, assertTeacherOwnsClassroom, jsonError, requireUuid } from '../../../../lib/aiGateway';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireGatewayAuth(request);
    const body = await request.json().catch(() => ({}));
    const classroomId = requireUuid(body.classroom_id, 'classroom_id');
    
    // Verify ownership before deleting
    await assertTeacherOwnsClassroom(auth, classroomId);
    
    // Delete the classroom using the service role key (bypassing RLS DELETE restrictions)
    const { error } = await auth.db.from('classrooms').delete().eq('id', classroomId);
    
    if (error) {
      throw new Error(`Failed to delete classroom: ${error.message}`);
    }
    
    return withCors(NextResponse.json({ success: true, deleted: classroomId }), request.headers.get('origin'));
  } catch (error) {
    return jsonError(error, request);
  }
}
