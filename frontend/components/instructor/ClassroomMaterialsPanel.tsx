import { useEffect, useState } from 'react';
import { FileText, UploadCloud, RefreshCw, CheckCircle2, Clock3, AlertTriangle, LockKeyhole } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';

interface ClassroomMaterialsPanelProps {
  classroomId: string;
}

const formatBytes = (value: number) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export const ClassroomMaterialsPanel: React.FC<ClassroomMaterialsPanelProps> = ({ classroomId }) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch(`${getApiUrl('/api/materials')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load materials.');
      setMaterials(payload.materials || []);
    } catch (error: any) {
      setMessage(error.message || 'Could not load materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMaterials(); }, [classroomId]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Please sign in again.');
      const form = new FormData();
      form.append('classroomId', classroomId);
      form.append('file', file);
      const response = await fetch(getApiUrl('/api/materials'), { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` }, body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Upload failed.');
      setMessage(payload.message || 'Material uploaded.');
      await loadMaterials();
    } catch (error: any) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><LockKeyhole size={17} className="text-blue-600" /><h3 className="text-xl font-bold">Classroom knowledge base</h3></div>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">Upload approved notes, slides, PDFs, or structured files. Materials stay private to this classroom; the adaptive tutor will use them only after extraction is ready.</p>
        </div>
        <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white cursor-pointer hover:bg-blue-500 disabled:opacity-50">
          <UploadCloud size={15} /> {uploading ? 'Uploading…' : 'Upload material'}
          <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={upload} disabled={uploading} />
        </label>
      </div>
      {message && <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 p-3 text-xs font-semibold text-blue-700 dark:text-blue-300">{message}</div>}
      <div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{materials.length} classroom materials</p><button onClick={() => void loadMaterials()} className="text-slate-400 hover:text-blue-500" aria-label="Refresh materials"><RefreshCw size={15} /></button></div>
      {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading material status…</div> : materials.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-sm text-slate-500">No materials uploaded yet.</div> : (
        <div className="space-y-3">
          {materials.map((material) => {
            const ready = material.extraction_status === 'ready';
            const failed = material.extraction_status === 'failed';
            return <div key={material.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/10 p-4">
              <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0"><FileText size={18} /></div><div className="min-w-0"><p className="font-bold truncate">{material.name}</p><p className="text-xs text-slate-500">{material.mime_type} · {formatBytes(Number(material.size_bytes))} · {material.chunk_count || 0} chunks</p></div></div>
              <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${ready ? 'text-emerald-600' : failed ? 'text-rose-600' : 'text-amber-600'}`}>{ready ? <CheckCircle2 size={15} /> : failed ? <AlertTriangle size={15} /> : <Clock3 size={15} />} {ready ? 'Tutor ready' : failed ? 'Needs retry' : 'Processing pending'}</div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
};
