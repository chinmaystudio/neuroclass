import { supabase } from '../database/supabase';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

type PendingMaterial = {
  id: string;
  classroom_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  extraction_status: string;
  metadata: Record<string, unknown> | null;
};

type WorkerSummary = {
  requested: number;
  claimed: number;
  processed: number;
  failed: number;
  remaining: number;
};

const MAX_BATCH = 10;
const MAX_ATTEMPTS = 3;
const MAX_TEXT_BYTES = 2_000_000;
const CHUNK_SIZE = 1_800;
const bucket = () => process.env.CLASSROOM_MATERIALS_BUCKET || 'classroom-materials';

function cleanText(value: string): string {
  return value.replace(/\u0000/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT_BYTES);
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += CHUNK_SIZE) {
    const chunk = text.slice(index, index + CHUNK_SIZE).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

async function extractText(material: PendingMaterial, bytes: Buffer): Promise<string> {
  const extension = material.name.toLowerCase().split('.').pop() || '';
  if (material.mime_type.startsWith('text/') || ['json', 'md', 'csv', 'txt'].includes(extension)) {
    return cleanText(bytes.toString('utf8'));
  }
  if (material.mime_type === 'application/pdf' || extension === 'pdf') {
    const parser = new PDFParse({ data: bytes });
    try {
      const parsed = await parser.getText();
      return cleanText(parsed.text || '');
    } finally {
      await parser.destroy();
    }
  }
  if (material.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
    const parsed = await mammoth.extractRawText({ buffer: bytes });
    return cleanText(parsed.value || '');
  }
  throw new Error('Unsupported material type for ingestion.');
}

async function claimMaterial(material: PendingMaterial): Promise<{ claimed: boolean; attempt: number }> {
  const attempt = Number(material.metadata?.ingestion_attempts || 0) + 1;
  const { data, error } = await supabase
    .from('classroom_materials')
    .update({ extraction_status: 'processing', extraction_error: null, metadata: { ...(material.metadata || {}), ingestion: 'worker-processing', ingestion_attempts: attempt, processing_started_at: new Date().toISOString() } })
    .eq('id', material.id)
    .eq('extraction_status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return { claimed: Boolean(data), attempt };
}

async function processMaterial(material: PendingMaterial): Promise<void> {
  const claim = await claimMaterial(material);
  if (!claim.claimed) return;
  try {
    const { data: file, error: downloadError } = await supabase.storage.from(bucket()).download(material.storage_path);
    if (downloadError || !file) throw new Error(downloadError?.message || 'Material file could not be downloaded.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const text = await extractText(material, bytes);
    if (!text) throw new Error('No readable text was found in this material.');
    const chunks = chunkText(text);
    const { error: deleteError } = await supabase.from('classroom_material_chunks').delete().eq('material_id', material.id);
    if (deleteError) throw deleteError;
    if (chunks.length) {
      const { error: chunkError } = await supabase.from('classroom_material_chunks').insert(chunks.map((content, index) => ({ material_id: material.id, classroom_id: material.classroom_id, chunk_index: index, content, token_count: Math.ceil(content.length / 4) })));
      if (chunkError) throw chunkError;
    }
    const { error: updateError } = await supabase.from('classroom_materials').update({ extracted_text: text, extraction_status: 'ready', extraction_error: null, chunk_count: chunks.length, processed_at: new Date().toISOString(), metadata: { ...(material.metadata || {}), ingestion: 'worker', worker_version: '2026-08-23' } }).eq('id', material.id);
    if (updateError) throw updateError;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Material ingestion failed.';
    const retryable = claim.attempt < MAX_ATTEMPTS;
    await supabase.from('classroom_materials').update({ extraction_status: retryable ? 'pending' : 'failed', extraction_error: message.slice(0, 500), metadata: { ...(material.metadata || {}), ingestion: retryable ? 'worker-retry' : 'worker-failed', failed_at: new Date().toISOString(), next_retry_at: retryable ? new Date(Date.now() + 5 * 60_000).toISOString() : null } }).eq('id', material.id);
    throw error;
  }
}

export async function runMaterialIngestion(requested = 5): Promise<WorkerSummary> {
  const limit = Math.max(1, Math.min(requested, MAX_BATCH));
  const { data, error } = await supabase.from('classroom_materials').select('id,classroom_id,name,storage_path,mime_type,extraction_status,metadata').eq('extraction_status', 'pending').order('created_at', { ascending: true }).limit(limit);
  if (error) throw error;
  const materials = (data || []) as PendingMaterial[];
  let processed = 0;
  let failed = 0;
  for (const material of materials) {
    try {
      await processMaterial(material);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  const { count, error: countError } = await supabase.from('classroom_materials').select('id', { count: 'exact', head: true }).eq('extraction_status', 'pending');
  if (countError) throw countError;
  return { requested: limit, claimed: materials.length, processed, failed, remaining: count || 0 };
}
