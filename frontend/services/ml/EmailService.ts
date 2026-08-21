import { supabase } from '../../database/supabase';

export const EmailService = {
  /**
   * Sends an attendance confirmation email.
   * In a real app, this would call a backend or Supabase Edge Function.
   */
  async sendAttendanceEmail(studentEmail: string, studentName: string, className: string) {
    console.log(`[Email Service] Sending attendance confirmation to ${studentName} (${studentEmail}) for class ${className}`);
    
    // Log to a notifications collection as a record
    try {
      await (supabase.from('notifications') as any).insert({
        recipient: studentEmail,
        title: 'Attendance Marked ✨',
        message: `Hello ${studentName}, your attendance for ${className} has been successfully recorded.`,
        type: 'email',
        created_at: new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.warn("Failed to log notification to database:", error);
      return false;
    }
  }
};
