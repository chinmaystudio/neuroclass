import { useEffect, useState } from 'react';
import { FileText, UploadCloud, RefreshCw, CheckCircle2, Clock3, AlertTriangle, LockKeyhole, HardDrive, ExternalLink, Import } from '../ui/icons-compat';
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
    <div className="rounded-card border border-line bg-surface p-6 shadow-raised space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><LockKeyhole size={17} className="text-primary" /><h3 className="text-xl font-bold">Classroom knowledge base</h3></div>
          <p className="text-sm text-ink-2 mt-2 max-w-2xl">Upload approved notes, slides, PDFs, or structured files. Materials stay private to this classroom; the adaptive tutor will use them only after extraction is ready.</p>
        </div>
        <label className="inline-flex items-center justify-center gap-2 rounded-button bg-primary px-4 py-3 text-xs font-bold text-on-primary cursor-pointer hover:bg-primary-hover disabled:opacity-50">
          <UploadCloud size={15} /> {uploading ? 'Uploading…' : 'Upload material'}
          <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={upload} disabled={uploading} />
        </label>
      </div>

      <div className="rounded-card border border-primary-soft bg-primary-light p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><HardDrive size={20} className="mt-0.5 text-primary" /><div><p className="font-bold">Google Drive classroom folder</p><p className="mt-1 text-xs text-ink-2">Connect Drive once, then use the in-app upload control to add approved files to the automatically created folder. Each selected file is copied into this classroom’s private knowledge base.</p>{driveConnected && <p className="mt-2 text-meta font-semibold text-success-ink">Connected as {driveEmail || 'your Google account'}{driveFolderName ? ` · ${driveFolderName}` : ''}</p>}</div></div>
          {!driveConnected ? <button type="button" onClick={connectDrive} disabled={driveLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-button bg-primary px-4 py-3 text-xs font-bold text-on-primary disabled:opacity-50"><HardDrive size={15} /> {driveLoading ? 'Connecting…' : 'Connect Drive'}</button> : driveFolderId ? <a href={`https://drive.google.com/drive/folders/${encodeURIComponent(driveFolderId)}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-button border border-primary-soft px-4 py-3 text-xs font-bold text-primary-dark "><ExternalLink size={15} /> Open folder</a> : null}
        </div>
        {driveConnected && <div className="space-y-3"><div className="flex flex-col gap-3 rounded-button border border-dashed border-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-ink-2 ">Upload directly to this classroom folder</p><p className="mt-1 text-meta text-ink-2">The file is copied to Drive and imported into the private classroom knowledge base.</p></div><label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-meta font-bold text-on-primary disabled:opacity-50"><UploadCloud size={13} /> {driveUploading ? 'Uploading…' : 'Upload to Drive'}<input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={uploadToDrive} disabled={driveUploading} /></label></div><div className="flex items-center justify-between"><p className="text-meta font-bold text-ink-2">Files waiting in classroom folder</p><button type="button" onClick={() => void loadDriveFiles()} disabled={driveLoading} className="text-ink-2 hover:text-primary disabled:opacity-50" aria-label="Refresh Drive files"><RefreshCw size={15} /></button></div>{driveFiles.length === 0 ? <p className="rounded-button border border-dashed border-primary-soft p-4 text-xs text-ink-2">No supported files found yet. Use Upload to Drive for a PDF, DOCX, TXT, Markdown, CSV, JSON, or Google Doc, then refresh.</p> : <div className="space-y-2">{driveFiles.map((file) => <div key={file.id} className="flex flex-col gap-3 rounded-button border border-primary-soft bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-meta text-ink-2">{file.mimeType} {file.size ? `· ${formatBytes(file.size)}` : ''}</p></div><button type="button" onClick={() => void importDriveFile(file)} disabled={driveImporting === file.id} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-meta font-bold text-on-primary disabled:opacity-50"><Import size={13} /> {driveImporting === file.id ? 'Importing…' : 'Import selected'}</button></div>)}</div>}</div>}
      </div>

      {message && <div className="rounded-button border border-primary-soft bg-primary-light p-3 text-xs font-semibold text-primary-dark ">{message}</div>}
      <div className="flex items-center justify-between"><p className="text-meta text-ink-2 font-bold">{materials.length} classroom materials</p><button onClick={() => void loadMaterials()} className="text-ink-2 hover:text-primary" aria-label="Refresh materials"><RefreshCw size={15} /></button></div>
      {loading ? <div className="py-12 text-center text-sm text-ink-2">Loading material status…</div> : materials.length === 0 ? <div className="rounded-card border border-dashed border-line p-10 text-center text-sm text-ink-2">No materials uploaded yet.</div> : (
        <div className="space-y-3">
          {materials.map((material) => {
            const ready = material.extraction_status === 'ready';
            const failed = material.extraction_status === 'failed';
            return <div key={material.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-card border border-line p-4">
              <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-button bg-primary-light text-primary flex items-center justify-center shrink-0"><FileText size={18} /></div><div className="min-w-0"><p className="font-bold truncate">{material.name}</p><p className="text-xs text-ink-2">{material.source_type === 'google_drive' ? 'Google Drive · ' : ''}{material.mime_type} · {formatBytes(Number(material.size_bytes))} · {material.chunk_count || 0} chunks</p></div></div>
              <div className={`flex items-center gap-2 text-meta font-bold ${ready ? 'text-success-ink' : failed ? 'text-danger-ink' : 'text-warning-ink'}`}>{ready ? <CheckCircle2 size={15} /> : failed ? <AlertTriangle size={15} /> : <Clock3 size={15} />} {ready ? 'Tutor ready' : failed ? 'Needs retry' : 'Processing pending'}</div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
};
