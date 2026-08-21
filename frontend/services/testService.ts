import { supabase } from '../database/supabase';
import { Test } from '../types';

export const testService = {
  async saveTest(test: Test) {
    const testId = test.id || crypto.randomUUID();
    const { data, error } = await supabase
      .from('tests')
      .upsert({
        id: testId,
        title: test.settings?.title || 'Untitled Test',
        test_data: { ...test, id: testId }
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAllTests() {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getTestById(id: string) {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTest(id: string) {
    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
