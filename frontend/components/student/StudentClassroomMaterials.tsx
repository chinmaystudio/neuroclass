import { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw, ShieldCheck, Clock3, AlertTriangle } from '../ui/icons-compat';
import { supabase } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';

interface StudentClassroomMaterialsProps {
  classroomId: string;
}

const formatBytes = (value: number) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Please sign in again.');
  return data.session.access_token;
};

export const StudentClassroomMaterials: React.FC<StudentClassroomMaterialsProps> = ({ classroomId }) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadMaterials = async () => {
    setLoading(true);
    setMessage('');
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${getApiUrl('/api/materials')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load classroom materials.');
      setMaterials(payload.materials || []);
    } catch (error: any) {
      setMessage(error.message || 'Could not load classroom materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMaterials(); }, [classroomId]);

  const download = async (material: any) => {
    setDownloading(material.id);
    setMessage('Preparing a secure download…');
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${getApiUrl('/api/materials/download')}?classroomId=${encodeURIComponent(classroomId)}&materialId=${encodeURIComponent(material.id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Could not prepare this material.');
      window.open(payload.url, '_blank', 'noopener,noreferrer');
      setMessage('Secure download opened. Access expires shortly.');
    } catch (error: any) {
      setMessage(error.message || 'Could not download this material.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-raised space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 text-success-ink" /><div><h3 className="text-xl font-bold">Classroom study materials</h3><p className="mt-2 max-w-2xl text-sm text-ink-2">These materials are visible only because you are enrolled in this classroom. Downloads use short-lived secure access.</p></div></div>
        <button type="button" onClick={() => void loadMaterials()} disabled={loading} className="text-ink-2 hover:text-success-ink disabled:opacity-50" aria-label="Refresh classroom materials"><RefreshCw size={16} /></button>
      </div>
      {message && <div className="rounded-button border border-success bg-success-bg p-3 text-xs font-semibold text-success-ink ">{message}</div>}
      {loading ? <div className="py-12 text-center text-sm text-ink-2">Loading secure material list…</div> : materials.length === 0 ? <div className="rounded-card border border-dashed border-line p-10 text-center text-sm text-ink-2">Your teacher has not published study materials yet.</div> : <div className="space-y-3">{materials.map((material) => { const ready = material.extraction_status === 'ready'; const failed = material.extraction_status === 'failed'; return <div key={material.id} className="flex flex-col gap-4 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-success-bg text-success-ink"><FileText size={18} /></div><div className="min-w-0"><p className="truncate font-bold">{material.name}</p><p className="text-xs text-ink-2">{material.source_type === 'google_drive' ? 'Google Drive · ' : ''}{material.mime_type} · {formatBytes(Number(material.size_bytes))}</p><p className={`mt-1 flex items-center gap-1 text-meta font-bold ${ready ? 'text-success-ink' : failed ? 'text-danger-ink' : 'text-warning-ink'}`}>{ready ? <ShieldCheck size={12} /> : failed ? <AlertTriangle size={12} /> : <Clock3 size={12} />} {ready ? 'Tutor ready' : failed ? 'Processing failed' : 'Processing pending'}</p></div></div><button type="button" onClick={() => void download(material)} disabled={downloading === material.id} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-button bg-success px-4 py-3 text-xs font-bold text-on-primary disabled:opacity-50"><Download size={15} /> {downloading === material.id ? 'Preparing…' : 'Download'}</button></div>; })}</div>}
    </div>
  );
};
