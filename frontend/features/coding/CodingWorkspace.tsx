import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { CheckCircle2, ChevronDown, Code2, Loader2, Moon, Play, ShieldAlert, Sun, Wand2, XCircle, FlaskConical } from '../../components/ui/icons-compat';
import './monacoSetup';
import { monaco } from './monacoSetup';
import { api, ApiRequestError } from '../lms/api';
import type { Language, LanguageId, RunResult } from '../lms/types';
import { cn } from '../../lib/utils';
import { useConfirm } from '../../components/ui';

/**
 * One reusable coding workspace for coding exams, coding assignments and
 * teacher test-case checks. Code always runs on the server-side sandbox via
 * /api/v1/code/run — never in the browser and never in the API process.
 */
export type CodingWorkspaceProps = {
  mode: 'exam' | 'assignment' | 'teacher';
  languages: LanguageId[];
  value: { language: LanguageId; source: string } | null;
  starterCode?: Record<string, string>;
  onChange: (value: { language: LanguageId; source: string }) => void;
  runContext: { contextType: 'test_attempt' | 'assignment' | 'teacher_question' | 'teacher_assignment'; contextId: string; questionId?: string };
  sampleTestCases?: Array<{ input: string; expectedOutput: string }>;
  /** Exam-mode deterrents. They discourage copying; they are not a security boundary. */
  blockClipboard?: boolean;
  onViolation?: (type: 'clipboard_blocked' | 'context_menu_blocked' | 'drop_blocked') => void;
  readOnly?: boolean;
  height?: string;
  saveState?: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
};

let languageCache: Language[] | null = null;
const FORMATTABLE = new Set(['javascript', 'typescript']);

function markersFrom(text: string, model: monaco.editor.ITextModel) {
  const markers: monaco.editor.IMarkerData[] = [];
  const seen = new Set<number>();
  // Typical compiler formats: "main.c:12:5: error: …", "File \"main.py\", line 3", "Main.java:7: error".
  const patterns = [/:(\d+):(\d+)?:?\s*(error|warning)?:?\s*(.*)/gi, /line (\d+)[,:]?\s*(.*)/gi];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const line = Number(match[1]);
      if (!Number.isFinite(line) || line < 1 || line > model.getLineCount() || seen.has(line)) continue;
      seen.add(line);
      markers.push({ startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: model.getLineMaxColumn(line), message: (match[4] || match[2] || 'Error reported by the compiler').toString().slice(0, 300), severity: /warning/i.test(match[0]) ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error });
      if (markers.length >= 20) return markers;
    }
  }
  return markers;
}

export const CodingWorkspace: React.FC<CodingWorkspaceProps> = ({ mode, languages, value, starterCode = {}, onChange, runContext, sampleTestCases = [], blockClipboard = false, onViolation, readOnly = false, height = '100%', saveState }) => {
  const askConfirm = useConfirm();
  const [allLanguages, setAllLanguages] = useState<Language[]>(languageCache ?? []);
  const [theme, setTheme] = useState<'vs-dark' | 'light'>(() => (document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'));
  const [stdin, setStdin] = useState(sampleTestCases[0]?.input ?? '');
  const [running, setRunning] = useState<null | 'custom' | 'samples' | 'all'>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'output' | 'tests'>('output');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (languageCache) return;
    api.get<{ languages: Language[] }>('code/languages').then((r) => { languageCache = r.languages; setAllLanguages(r.languages); }).catch(() => undefined);
  }, []);

  const available = useMemo(() => languages.map((id) => allLanguages.find((l) => l.id === id) ?? { id, label: id, monaco: id, fileName: '', compiled: false, starter: '' } as Language), [languages, allLanguages]);
  const language = value?.language ?? languages[0];
  const meta = available.find((l) => l.id === language);
  // The starter template is only displayed; nothing is saved (and the question
  // does not count as answered) until the student actually edits the code.
  const starterFor = (id: LanguageId) => starterCode[id] ?? allLanguages.find((l) => l.id === id)?.starter ?? '';
  const source = value ? value.source : starterFor(language);

  const switchLanguage = async (next: LanguageId) => {
    if (next === language) return;
    const dirty = source.trim() && source !== starterFor(language);
    if (dirty && !(await askConfirm({ title: 'Switch language?', body: 'Your current code will be replaced with the starter template for the new language.', confirmLabel: 'Switch language', tone: 'danger' }))) return;
    onChange({ language: next, source: starterFor(next) });
    setResult(null);
  };

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (blockClipboard) {
      // Deterrents only: block paste/drop/copy shortcuts inside the editor and log attempts.
      editor.onKeyDown((e) => {
        const mod = e.ctrlKey || e.metaKey;
        const isPaste = (mod && e.keyCode === monaco.KeyCode.KeyV) || (e.shiftKey && e.keyCode === monaco.KeyCode.Insert);
        const isCopy = mod && (e.keyCode === monaco.KeyCode.KeyC || e.keyCode === monaco.KeyCode.KeyX);
        if (isPaste || isCopy) {
          e.preventDefault();
          e.stopPropagation();
          onViolation?.('clipboard_blocked');
        }
      });
    }
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !blockClipboard) return;
    const stop = (type: 'clipboard_blocked' | 'context_menu_blocked' | 'drop_blocked') => (e: Event) => { e.preventDefault(); e.stopPropagation(); onViolation?.(type); };
    const onPaste = stop('clipboard_blocked'); const onCopy = stop('clipboard_blocked'); const onDrop = stop('drop_blocked'); const onMenu = stop('context_menu_blocked');
    node.addEventListener('paste', onPaste, true); node.addEventListener('copy', onCopy, true); node.addEventListener('cut', onCopy, true); node.addEventListener('drop', onDrop, true); node.addEventListener('contextmenu', onMenu, true);
    return () => { node.removeEventListener('paste', onPaste, true); node.removeEventListener('copy', onCopy, true); node.removeEventListener('cut', onCopy, true); node.removeEventListener('drop', onDrop, true); node.removeEventListener('contextmenu', onMenu, true); };
  }, [blockClipboard, onViolation]);

  const applyMarkers = useCallback((text: string) => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, 'neuroclass-runner', text ? markersFrom(text, model) : []);
  }, []);

  const run = async (runMode: 'custom' | 'samples' | 'all') => {
    if (!source.trim()) { setError('Write some code first.'); return; }
    setRunning(runMode);
    setError(null);
    setPanel(runMode === 'custom' ? 'output' : 'tests');
    try {
      const response = await api.post<RunResult>('code/run', { ...runContext, language, source, stdin: runMode === 'custom' ? stdin : undefined, mode: runMode });
      setResult(response);
      applyMarkers(response.compileError || response.run?.compileOutput || (response.run?.status === 'runtime_error' ? response.run.stderr : '') || '');
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiRequestError ? err.message : 'Code could not be run. Please try again.');
    } finally {
      setRunning(null);
    }
  };

  const format = () => editorRef.current?.getAction('editor.action.formatDocument')?.run();
  const canFormat = FORMATTABLE.has(meta?.monaco ?? '');
  const statusTone = (status?: string) => (status === 'ok' ? 'text-success-ink' : status === 'compile_error' ? 'text-warning-ink' : 'text-danger-ink');
  const statusLabel: Record<string, string> = { ok: 'Finished', compile_error: 'Compilation failed', runtime_error: 'Runtime error', time_limit: 'Time limit exceeded', memory_limit: 'Memory limit exceeded', output_limit: 'Output limit exceeded', internal_error: 'Runner error' };

  return (
    <div ref={containerRef} className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-card border border-line bg-surface " style={{ height }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 ">
        <Code2 size={16} className="text-primary" aria-hidden />
        <div className="relative">
          <select aria-label="Programming language" value={language} disabled={readOnly || available.length < 2} onChange={(e) => switchLanguage(e.target.value as LanguageId)} className="appearance-none rounded-lg border border-line bg-surface-2 py-1.5 pl-3 pr-8 text-xs font-bold ">
            {available.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2 text-ink-2" aria-hidden />
        </div>
        {meta?.fileName && <span className="hidden font-mono text-meta text-ink-2 sm:inline">{meta.fileName}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {saveState && saveState !== 'idle' && <span className={cn('mr-2 text-meta font-bold ', saveState === 'saved' ? 'text-success-ink' : saveState === 'offline' || saveState === 'error' ? 'text-warning-ink' : 'text-ink-2')}>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'offline' ? 'Saved on device' : 'Not saved'}</span>}
          <button type="button" title={canFormat ? 'Format code' : 'Formatting is available for JavaScript and TypeScript'} disabled={!canFormat || readOnly} onClick={format} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-30 " aria-label="Format code"><Wand2 size={15} /></button>
          <button type="button" title="Toggle editor theme" onClick={() => setTheme((t) => (t === 'vs-dark' ? 'light' : 'vs-dark'))} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 " aria-label="Toggle editor theme">{theme === 'vs-dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
          {mode === 'teacher' ? (
            <button type="button" disabled={Boolean(running)} onClick={() => run('all')} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-meta font-bold text-on-primary disabled:opacity-50">{running === 'all' ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Run all tests</button>
          ) : (
            <>
              <button type="button" disabled={Boolean(running) || !sampleTestCases.length} onClick={() => run('samples')} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-meta font-bold disabled:opacity-40 " title={sampleTestCases.length ? 'Run the visible sample tests' : 'No visible sample tests'}>{running === 'samples' ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Run tests</button>
              <button type="button" disabled={Boolean(running)} onClick={() => run('custom')} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-meta font-bold text-on-primary disabled:opacity-50">{running === 'custom' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} {meta?.compiled ? 'Compile & run' : 'Run'}</button>
            </>
          )}
        </div>
      </div>
      {blockClipboard && <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-bg px-3 py-1.5 text-meta font-semibold text-warning-ink "><ShieldAlert size={13} aria-hidden /> Secure mode: copy, paste and drag-and-drop are disabled in this editor and attempts are logged.</div>}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(240px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1">
        <div className="min-h-[240px]">
          <Editor
            height="100%"
            language={meta?.monaco ?? 'plaintext'}
            theme={theme}
            value={source}
            onMount={onMount}
            onChange={(next) => { if (!readOnly) onChange({ language, source: next ?? '' }); }}
            loading={<div className="p-6 text-xs text-ink-2">Loading editor…</div>}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 4,
              wordWrap: 'on',
              renderWhitespace: 'selection',
              contextmenu: !blockClipboard,
              dragAndDrop: !blockClipboard,
              dropIntoEditor: { enabled: !blockClipboard },
              accessibilitySupport: 'auto',
              ariaLabel: 'Code editor',
            }}
          />
        </div>

        {/* Input / output panel */}
        <div className="flex min-h-[220px] flex-col border-t border-line lg:border-l lg:border-t-0">
          <div className="flex border-b border-line text-meta font-bold ">
            {(['output', 'tests'] as const).map((p) => <button key={p} type="button" onClick={() => setPanel(p)} className={cn('flex-1 px-3 py-2', panel === p ? 'border-b-2 border-primary text-primary ' : 'text-ink-2')}>{p === 'output' ? 'Input & output' : `Tests${result?.total !== undefined ? ` (${result.passed}/${result.total})` : ''}`}</button>)}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-xs">
            {error && <p role="alert" className="rounded-button bg-danger-bg p-3 font-semibold text-danger-ink">{error}</p>}
            {panel === 'output' ? (
              <>
                <label className="block"><span className="text-meta font-bold text-ink-2">Standard input</span>
                  <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={4} spellCheck={false} className="mt-1 w-full rounded-lg border border-line bg-surface-2 p-2 font-mono text-xs " placeholder="Input passed to your program" />
                </label>
                {result?.run && (
                  <div className="space-y-2" aria-live="polite">
                    <div className="flex items-center justify-between"><span className={cn('font-bold', statusTone(result.run.status))}>{statusLabel[result.run.status] ?? result.run.status}</span><span className="font-mono text-ink-2">{result.run.timeMs ?? '—'} ms · {result.run.memoryKb ? `${Math.round(result.run.memoryKb / 1024)} MB` : '—'} · exit {result.run.exitCode ?? '—'}</span></div>
                    {result.run.compileOutput && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-warning-bg p-2 font-mono text-warning-ink ">{result.run.compileOutput}</pre>}
                    <span className="text-meta font-bold text-ink-2">Output</span>
                    <pre className="max-h-48 min-h-[3rem] overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-2 font-mono text-on-primary">{result.run.stdout || '(no output)'}</pre>
                    {result.run.stderr && <><span className="text-meta font-bold text-ink-2">Errors / debug output (stderr)</span><pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-danger/80 p-2 font-mono text-danger-ink">{result.run.stderr}</pre></>}
                  </div>
                )}
                {!result?.run && !error && <p className="text-ink-2">Run your code to see its output. Print to stderr for debugging; step-through debuggers are not available in the browser sandbox.</p>}
              </>
            ) : (
              <div className="space-y-2" aria-live="polite">
                {result?.compileError && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-warning-bg p-2 font-mono text-warning-ink ">{result.compileError}</pre>}
                {result?.results?.map((r, i) => (
                  <div key={r.testCaseId} className="rounded-button border border-line p-2.5 ">
                    <div className="flex items-center justify-between font-bold">{r.passed ? <span className="flex items-center gap-1 text-success-ink"><CheckCircle2 size={14} /> Test {i + 1} passed</span> : <span className="flex items-center gap-1 text-danger-ink"><XCircle size={14} /> Test {i + 1} {statusLabel[r.status] && r.status !== 'ok' ? `– ${statusLabel[r.status]}` : 'failed'}</span>}{r.hidden && <span className="text-meta text-ink-2">hidden</span>}</div>
                    {!r.hidden && r.input !== undefined && (
                      <div className="mt-2 grid gap-1.5 font-mono text-meta">
                        <div><span className="text-ink-2">input</span><pre className="whitespace-pre-wrap rounded bg-surface-2 p-1.5 ">{r.input || '(empty)'}</pre></div>
                        <div><span className="text-ink-2">expected</span><pre className="whitespace-pre-wrap rounded bg-surface-2 p-1.5 ">{r.expectedOutput}</pre></div>
                        {!r.passed && <div><span className="text-ink-2">your output</span><pre className="whitespace-pre-wrap rounded bg-danger-bg p-1.5">{r.stdout || '(no output)'}</pre></div>}
                      </div>
                    )}
                  </div>
                ))}
                {!result?.results && !result?.compileError && (
                  <div className="space-y-2 text-ink-2">
                    <p>{mode === 'teacher' ? 'Run your reference solution against every test case, hidden ones included.' : 'Run the visible sample tests. Hidden tests are run by the server when you submit.'}</p>
                    {sampleTestCases.map((c, i) => <div key={i} className="rounded-lg bg-surface-2 p-2 font-mono text-meta "><div>input: {c.input || '(empty)'}</div><div>expected: {c.expectedOutput}</div></div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodingWorkspace;
