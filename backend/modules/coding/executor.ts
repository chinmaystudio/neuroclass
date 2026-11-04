import { LANGUAGES, type LanguageId } from './languages';
import { unavailable, ApiError } from '../core/http';

/**
 * Untrusted student code runs ONLY inside an external, isolated sandbox
 * (Judge0 or Piston). Both run each submission in a throw-away isolate/cgroup
 * sandbox with CPU, memory, process, output and wall-clock limits and without
 * network access. This module never evaluates code locally.
 */
export type ExecutionLimits = { timeLimitMs: number; memoryLimitMb: number };
export type ExecutionRequest = { language: LanguageId; source: string; stdin: string; limits: ExecutionLimits };
export type ExecutionStatus = 'ok' | 'compile_error' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'output_limit' | 'internal_error';
export type ExecutionResult = {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number | null;
  timeMs: number | null;
  memoryKb: number | null;
  truncated: boolean;
};

export interface ExecutionProvider {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

export const MAX_SOURCE_BYTES = 100_000;
export const MAX_STDIN_BYTES = 64_000;
export const MAX_OUTPUT_CHARS = 16_000;

export function truncate(value: string | null | undefined, max = MAX_OUTPUT_CHARS) {
  const text = value ?? '';
  return text.length > max ? { text: `${text.slice(0, max)}\n… output truncated …`, truncated: true } : { text, truncated: false };
}

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const unb64 = (value: string | null | undefined) => (value ? Buffer.from(value, 'base64').toString('utf8') : '');

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new ApiError(504, 'The code runner did not respond in time.', 'runner_timeout');
    throw unavailable('The code runner is unreachable right now.');
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------- Judge0 ---------------------------- */
export class Judge0Provider implements ExecutionProvider {
  readonly name = 'judge0';
  constructor(private baseUrl: string, private headers: Record<string, string>) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const lang = LANGUAGES[request.language];
    const cpuSeconds = Math.min(10, Math.max(0.5, request.limits.timeLimitMs / 1000));
    const body = {
      language_id: lang.judge0Id,
      source_code: b64(request.source),
      stdin: b64(request.stdin),
      cpu_time_limit: cpuSeconds,
      wall_time_limit: Math.min(20, cpuSeconds * 2 + 1),
      memory_limit: request.limits.memoryLimitMb * 1024,
      max_processes_and_or_threads: 32,
      max_file_size: 1024,
      enable_network: false,
      redirect_stderr_to_stdout: false,
    };
    const response = await fetchWithTimeout(`${this.baseUrl.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,status,time,memory,exit_code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(body),
    }, 30_000);
    if (response.status === 429) throw new ApiError(429, 'The code runner is busy. Try again in a few seconds.', 'runner_busy');
    if (!response.ok) throw unavailable(`The code runner returned an error (${response.status}).`);
    const payload = await response.json() as any;
    const statusId = Number(payload?.status?.id);
    // Judge0 status ids: 3 accepted, 4 wrong answer, 5 TLE, 6 compile error, 7-12 runtime errors, 13 internal, 14 exec format.
    const status: ExecutionStatus = statusId === 3 || statusId === 4 ? 'ok'
      : statusId === 5 ? 'time_limit'
      : statusId === 6 ? 'compile_error'
      : statusId >= 7 && statusId <= 12 ? (/memory/i.test(payload?.status?.description ?? '') ? 'memory_limit' : 'runtime_error')
      : 'internal_error';
    const stdout = truncate(unb64(payload.stdout));
    const stderr = truncate(unb64(payload.stderr));
    const compile = truncate(unb64(payload.compile_output));
    return {
      status,
      stdout: stdout.text,
      stderr: stderr.text,
      compileOutput: compile.text,
      exitCode: payload.exit_code ?? null,
      timeMs: payload.time ? Math.round(Number(payload.time) * 1000) : null,
      memoryKb: payload.memory ?? null,
      truncated: stdout.truncated || stderr.truncated || compile.truncated,
    };
  }
}

/* ---------------------------- Piston ---------------------------- */
export class PistonProvider implements ExecutionProvider {
  readonly name = 'piston';
  constructor(private baseUrl: string, private headers: Record<string, string>) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const lang = LANGUAGES[request.language];
    const body = {
      language: lang.piston.language,
      version: lang.piston.version,
      files: [{ name: lang.fileName, content: request.source }],
      stdin: request.stdin,
      compile_timeout: 10_000,
      run_timeout: request.limits.timeLimitMs,
      compile_memory_limit: 512 * 1024 * 1024,
      run_memory_limit: request.limits.memoryLimitMb * 1024 * 1024,
    };
    const response = await fetchWithTimeout(`${this.baseUrl.replace(/\/$/, '')}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(body),
    }, 30_000);
    if (response.status === 429) throw new ApiError(429, 'The code runner is busy. Try again in a few seconds.', 'runner_busy');
    if (!response.ok) throw unavailable(`The code runner returned an error (${response.status}).`);
    const payload = await response.json() as any;
    const compile = payload.compile;
    if (compile && compile.code !== 0 && compile.code !== null) {
      const c = truncate(compile.output || compile.stderr);
      return { status: 'compile_error', stdout: '', stderr: '', compileOutput: c.text, exitCode: compile.code, timeMs: null, memoryKb: null, truncated: c.truncated };
    }
    const run = payload.run ?? {};
    const stdout = truncate(run.stdout);
    const stderr = truncate(run.stderr);
    const signal = String(run.signal ?? '');
    const status: ExecutionStatus = signal === 'SIGKILL' ? (/memory/i.test(run.message ?? '') ? 'memory_limit' : 'time_limit')
      : run.code === 0 ? 'ok'
      : run.code === null && signal ? 'runtime_error'
      : 'runtime_error';
    return { status, stdout: stdout.text, stderr: stderr.text, compileOutput: '', exitCode: run.code ?? null, timeMs: run.cpu_time ?? run.wall_time ?? null, memoryKb: run.memory ? Math.round(run.memory / 1024) : null, truncated: stdout.truncated || stderr.truncated };
  }
}

/* ------------------------- Provider config ------------------------- */
let override: ExecutionProvider | null = null;
export function __setProviderForTests(provider: ExecutionProvider | null) { override = provider; }

export function getProvider(): ExecutionProvider {
  if (override) return override;
  const kind = (process.env.CODE_RUNNER_PROVIDER || '').toLowerCase();
  const url = process.env.CODE_RUNNER_URL || '';
  if (!kind || kind === 'disabled' || !url) throw unavailable('Code execution is not configured on this server yet. Ask your administrator to set CODE_RUNNER_PROVIDER and CODE_RUNNER_URL.');
  const headers: Record<string, string> = {};
  if (process.env.CODE_RUNNER_AUTH_HEADER && process.env.CODE_RUNNER_AUTH_TOKEN) headers[process.env.CODE_RUNNER_AUTH_HEADER] = process.env.CODE_RUNNER_AUTH_TOKEN;
  if (process.env.CODE_RUNNER_RAPIDAPI_HOST) headers['X-RapidAPI-Host'] = process.env.CODE_RUNNER_RAPIDAPI_HOST;
  if (kind === 'judge0') return new Judge0Provider(url, headers);
  if (kind === 'piston') return new PistonProvider(url, headers);
  throw unavailable(`Unknown code runner provider "${kind}".`);
}

export function enabledLanguages(): LanguageId[] {
  const configured = (process.env.CODE_RUNNER_LANGUAGES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const known = Object.keys(LANGUAGES) as LanguageId[];
  return configured.length ? known.filter((id) => configured.includes(id)) : known;
}

/* ------------------------- Output comparison ------------------------- */
export function normalizeOutput(value: string) {
  return value.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n').replace(/\n+$/g, '');
}

export function outputsMatch(actual: string, expected: string) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export type TestCaseRow = { id: string; input: string; expected_output: string; is_hidden: boolean; weight: number };
export type TestCaseResult = { testCaseId: string; hidden: boolean; passed: boolean; weight: number; status: ExecutionStatus; timeMs: number | null; stdout?: string; expectedOutput?: string; stderr?: string; input?: string };

/** Runs test cases with bounded parallelism. Hidden-case details are stripped for students by the caller. */
export async function runTestCases(provider: ExecutionProvider, language: LanguageId, source: string, cases: TestCaseRow[], limits: ExecutionLimits, concurrency = 3) {
  const results: TestCaseResult[] = new Array(cases.length);
  let compileError: string | null = null;
  let cursor = 0;
  async function worker() {
    while (cursor < cases.length) {
      const index = cursor++;
      const tc = cases[index];
      if (compileError !== null) {
        results[index] = { testCaseId: tc.id, hidden: tc.is_hidden, passed: false, weight: Number(tc.weight), status: 'compile_error', timeMs: null };
        continue;
      }
      const run = await provider.execute({ language, source, stdin: tc.input, limits });
      if (run.status === 'compile_error') compileError = run.compileOutput;
      results[index] = {
        testCaseId: tc.id,
        hidden: tc.is_hidden,
        passed: run.status === 'ok' && outputsMatch(run.stdout, tc.expected_output),
        weight: Number(tc.weight),
        status: run.status,
        timeMs: run.timeMs,
        stdout: run.stdout,
        expectedOutput: tc.expected_output,
        stderr: run.stderr || run.compileOutput,
        input: tc.input,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker));
  return { results, compileError };
}

/** Removes hidden test inputs/outputs before anything reaches a student. */
export function redactForStudent(results: TestCaseResult[]) {
  return results.map((r) => (r.hidden
    ? { testCaseId: r.testCaseId, hidden: true, passed: r.passed, weight: r.weight, status: r.status, timeMs: r.timeMs }
    : r));
}
