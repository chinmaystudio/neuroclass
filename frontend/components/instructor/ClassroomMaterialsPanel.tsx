import { useEffect, useState } from 'react';
import { FileText, UploadCloud, RefreshCw, CheckCircle2, Clock3, AlertTriangle, LockKeyhole, HardDrive, ExternalLink, Import } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';

interface ClassroomMaterialsPanelProps {
  classroomId: string;
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
};

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

export const ClassroomMaterialsPanel: React.FC<ClassroomMaterialsPanelProps> = ({ classroomId }) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFolderName, setDriveFolderName] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveImporting, setDriveImporting] = useState<string | null>(null);
  const [driveUploading, setDriveUploading] = useState(false);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${getApiUrl('/api/materials')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load materials.');
      setMaterials(payload.materials || []);
    } catch (error: any) {
      setMessage(error.message || 'Could not load materials.');
    } finally {
      setLoading(false);
    }
  };

  const loadDriveStatus = async () => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${getApiUrl('/api/google-drive/status')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load Google Drive status.');
      setDriveConnected(Boolean(payload.connected));
      setDriveEmail(payload.googleEmail || null);
      setDriveFolderId(payload.folder?.drive_folder_id || null);
      setDriveFolderName(payload.folder?.folder_name || null);
    } catch (error: any) {
      setMessage(error.message || 'Could not load Google Drive status.');
    }
  };

  const loadDriveFiles = async () => {
    setDriveLoading(true);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${getApiUrl('/api/google-drive/files')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not list Drive files.');
      setDriveFiles(payload.files || []);
      if (payload.folderName) setDriveFolderName(payload.folderName);
    } catch (error: any) {
      setMessage(error.message || 'Could not list Drive files.');
    } finally {
      setDriveLoading(false);
    }
  };

  useEffect(() => {
    void loadMaterials();
    void loadDriveStatus();
    const driveResult = new URLSearchParams(window.location.search).get('drive');
    if (driveResult === 'connected') setMessage('Google Drive connected. Your classroom folder is ready.');
    if (driveResult === 'denied') setMessage('Google Drive connection was cancelled.');
    if (driveResult === 'error') setMessage('Google Drive could not be connected. Please try again.');
  }, [classroomId]);

  const connectDrive = async () => {
    setDriveLoading(true);
    setMessage('Opening Google Drive permission…');
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${getApiUrl('/api/google-drive/connect')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error || 'Google Drive connection is not configured.');
      window.location.assign(payload.authorizationUrl);
    } catch (error: any) {
      setMessage(error.message || 'Could not start Google Drive connection.');
      setDriveLoading(false);
    }
  };

  const uploadToDrive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDriveUploading(true);
    setMessage('Uploading material to the classroom Google Drive folder…');
    try {
      const accessToken = await getAccessToken();
      const form = new FormData();
      form.append('classroomId', classroomId);
      form.append('file', file);
      const response = await fetch(getApiUrl('/api/google-drive/upload'), { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Drive upload failed.');
      setMessage(payload.message || `${file.name} uploaded to this classroom.`);
      await loadMaterials();
      await loadDriveFiles();
    } catch (error: any) {
      setMessage(error.message || 'Drive upload failed.');
    } finally {
      setDriveUploading(false);
    }
  };

  const importDriveFile = async (file: DriveFile) => {
    setDriveImporting(file.id);
    setMessage('Importing selected Drive material into this classroom…');
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(getApiUrl('/api/google-drive/import'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId, fileId: file.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Drive import failed.');
      setMessage(payload.message || `${file.name} imported into this classroom.`);
      await loadMaterials();
      await loadDriveFiles();
    } catch (error: any) {
      setMessage(error.message || 'Drive import failed.');
    } finally {
      setDriveImporting(null);
    }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const accessToken = await getAccessToken();
      const form = new FormData();
      form.append('classroomId', classroomId);
      form.append('file', file);
      const response = await fetch(getApiUrl('/api/materials'), { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
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

      <div className="rounded-2xl border border-sky-200 dark:border-sky-500/20 bg-sky-50/70 dark:bg-sky-500/5 p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><HardDrive size={20} className="mt-0.5 text-sky-600" /><div><p className="font-bold">Google Drive classroom folder</p><p className="mt-1 text-xs text-slate-500">Connect Drive once, then use the in-app upload control to add approved files to the automatically created folder. Each selected file is copied into this classroom’s private knowledge base.</p>{driveConnected && <p className="mt-2 text-[11px] font-semibold text-emerald-600">Connected as {driveEmail || 'your Google account'}{driveFolderName ? ` · ${driveFolderName}` : ''}</p>}</div></div>
          {!driveConnected ? <button type="button" onClick={connectDrive} disabled={driveLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"><HardDrive size={15} /> {driveLoading ? 'Connecting…' : 'Connect Drive'}</button> : driveFolderId ? <a href={`https://drive.google.com/drive/folders/${encodeURIComponent(driveFolderId)}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300 px-4 py-3 text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300"><ExternalLink size={15} /> Open folder</a> : null}
        </div>
        {driveConnected && <div className="space-y-3"><div className="flex flex-col gap-3 rounded-xl border border-dashed border-sky-200 dark:border-sky-500/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">Upload directly to this classroom folder</p><p className="mt-1 text-[11px] text-slate-500">The file is copied to Drive and imported into the private classroom knowledge base.</p></div><label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"><UploadCloud size={13} /> {driveUploading ? 'Uploading…' : 'Upload to Drive'}<input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={uploadToDrive} disabled={driveUploading} /></label></div><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Files waiting in classroom folder</p><button type="button" onClick={() => void loadDriveFiles()} disabled={driveLoading} className="text-slate-400 hover:text-sky-600 disabled:opacity-50" aria-label="Refresh Drive files"><RefreshCw size={15} /></button></div>{driveFiles.length === 0 ? <p className="rounded-xl border border-dashed border-sky-200 dark:border-white/10 p-4 text-xs text-slate-500">No supported files found yet. Use Upload to Drive for a PDF, DOCX, TXT, Markdown, CSV, JSON, or Google Doc, then refresh.</p> : <div className="space-y-2">{driveFiles.map((file) => <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-sky-100 dark:border-white/10 bg-white/70 dark:bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-[11px] text-slate-500">{file.mimeType} {file.size ? `· ${formatBytes(file.size)}` : ''}</p></div><button type="button" onClick={() => void importDriveFile(file)} disabled={driveImporting === file.id} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"><Import size={13} /> {driveImporting === file.id ? 'Importing…' : 'Import selected'}</button></div>)}</div>}</div>}
      </div>

      {message && <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 p-3 text-xs font-semibold text-blue-700 dark:text-blue-300">{message}</div>}
      <div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{materials.length} classroom materials</p><button onClick={() => void loadMaterials()} className="text-slate-400 hover:text-blue-500" aria-label="Refresh materials"><RefreshCw size={15} /></button></div>
      {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading material status…</div> : materials.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-sm text-slate-500">No materials uploaded yet.</div> : (
        <div className="space-y-3">
          {materials.map((material) => {
            const ready = material.extraction_status === 'ready';
            const failed = material.extraction_status === 'failed';
            return <div key={material.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/10 p-4">
              <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0"><FileText size={18} /></div><div className="min-w-0"><p className="font-bold truncate">{material.name}</p><p className="text-xs text-slate-500">{material.source_type === 'google_drive' ? 'Google Drive · ' : ''}{material.mime_type} · {formatBytes(Number(material.size_bytes))} · {material.chunk_count || 0} chunks</p></div></div>
              <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${ready ? 'text-emerald-600' : failed ? 'text-rose-600' : 'text-amber-600'}`}>{ready ? <CheckCircle2 size={15} /> : failed ? <AlertTriangle size={15} /> : <Clock3 size={15} />} {ready ? 'Tutor ready' : failed ? 'Needs retry' : 'Processing pending'}</div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
};
