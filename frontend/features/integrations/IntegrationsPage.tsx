import React from 'react';
import { api } from '../lms/api';
import { PageBody } from '../shell/RoleShell';
import { usePageMeta } from '../public/usePageMeta';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, CardFooter, CardHeader, DataTable, EmptyState, ErrorState, Field, IconButton, InfoCard, Input, Modal, PageHeader, Skeleton, Tabs, TabPanel, useConfirm, useToast } from '../../components/ui';
import { Copy, ExternalLink, Plus } from '../../components/ui/icons-compat';

type Token = { id: string; name: string; prefix: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string };

const MCP_ENDPOINT = (() => {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (raw) return `${raw}/api/mcp`;
  // In production the API shares the frontend origin through Pages routing;
  // fall back to the current origin if no explicit API URL is set.
  if (typeof window !== 'undefined') return `${window.location.origin}/api/mcp`;
  return 'https://neuroclass-swart.vercel.app/api/mcp';
})();

const INTEGRATIONS_URL = (() => {
  if (typeof window !== 'undefined') return `${window.location.origin}/app/integrations`;
  return 'https://neuroclass-swart.vercel.app/app/integrations';
})();

const CLAUDE_DESKTOP = (token = 'nc_live_YOUR_TOKEN') => JSON.stringify({ mcpServers: { neuroclass: { url: MCP_ENDPOINT, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
const CHATGPT_CONFIG = (token = 'nc_live_YOUR_TOKEN') => `URL: ${MCP_ENDPOINT}\nAuthentication: Custom\nHeader name: Authorization\nHeader value: Bearer ${token}`;
const CURSOR_CONFIG = (token = 'nc_live_YOUR_TOKEN') => JSON.stringify({ mcpServers: { neuroclass: { url: MCP_ENDPOINT, env: { AUTHORIZATION: `Bearer ${token}` } } } }, null, 2);

// A natural-language prompt the user can paste into Claude, ChatGPT or Cursor.
// The agent reads it and walks the user through adding the MCP server, or (in
// clients that support it, like Claude Desktop with filesystem access, or
// Claude Code) adds it directly.
const SETUP_PROMPT = (client: 'claude-desktop' | 'chatgpt' | 'cursor' | 'generic', token = 'nc_live_YOUR_TOKEN') => {
  const hasToken = token !== 'nc_live_YOUR_TOKEN';
  const tokenLine = hasToken
    ? `My personal access token is: ${token}`
    : `First open ${INTEGRATIONS_URL} in my browser, sign in, open "Connect AI (MCP)" and create a token. Paste it back here, then continue.`;
  const intro = `Please connect me to the NeuroClass MCP server so you can act on my account (classrooms, tests, assignments, grading — whatever my role allows).`;
  const endpointLine = `MCP endpoint: ${MCP_ENDPOINT}
Transport: Streamable HTTP (JSON-RPC 2.0)
Auth: Bearer token in the Authorization header`;
  switch (client) {
    case 'claude-desktop':
      return `${intro}

${tokenLine}

Add this server to Claude Desktop:
1. Open Settings → Developer → Edit Config (claude_desktop_config.json).
2. Merge this block into "mcpServers":
${CLAUDE_DESKTOP(token)}
3. Save and restart Claude Desktop.
4. Confirm the "neuroclass" tools appear in the tool picker and call tools/list once to list them.

${endpointLine}`;
    case 'chatgpt':
      return `${intro}

${tokenLine}

Add this server to ChatGPT (Team/Enterprise or Plus with Developer Mode):
1. Settings → Connectors → Add connector → Custom MCP server.
2. URL: ${MCP_ENDPOINT}
3. Authentication: Custom header; Header name: Authorization; Header value: Bearer <my token>
4. Save, then confirm you can list my NeuroClass tools.

${endpointLine}`;
    case 'cursor':
      return `${intro}

${tokenLine}

Add this server to Cursor:
1. Settings → MCP → Add new MCP server.
2. Paste:
${CURSOR_CONFIG(token)}
3. Save and reload. The NeuroClass tools should appear in Composer.

${endpointLine}`;
    default:
      return `${intro}

${tokenLine}

${endpointLine}

Please help me add this MCP server to my current client and verify it connects. If you can add it yourself (filesystem or CLI access), do so; otherwise walk me through the exact steps for this client.`;
  }
};

const CodeBlock: React.FC<{ code: string; language?: string; label?: string }> = ({ code, language = 'json', label }) => {
  const toast = useToast();
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast.success('Copied to clipboard.'); } catch { toast.error('Couldn’t copy. Select the text and copy it manually.'); } };
  return (
    <div className="relative">
      {label && <p className="mb-1.5 text-support text-ink-2">{label}</p>}
      <pre className="overflow-x-auto rounded-control border border-line bg-surface-2 p-3 text-support leading-6 text-ink" data-language={language}><code>{code}</code></pre>
      <div className="mt-2 flex justify-end"><Button size="sm" variant="outline" iconLeft={<Copy size={14} />} onClick={() => void copy()}>Copy</Button></div>
    </div>
  );
};

// Shows a one-paste prompt the user drops into Claude/ChatGPT/Cursor to get
// the agent to walk them through (or do) the MCP setup on their end.
const PromptBlock: React.FC<{ prompt: string; hasRealToken: boolean }> = ({ prompt, hasRealToken }) => {
  const toast = useToast();
  const copy = async () => { try { await navigator.clipboard.writeText(prompt); toast.success('Prompt copied. Paste it into your AI client.'); } catch { toast.error('Couldn’t copy. Select the text and copy it manually.'); } };
  return (
    <div className="rounded-control border border-dashed border-primary/50 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-support font-medium text-ink">One-paste setup prompt</p>
        <Button size="sm" variant="primary" iconLeft={<Copy size={14} />} onClick={() => void copy()}>Copy prompt</Button>
      </div>
      <p className="mb-2 text-support text-ink-2">
        {hasRealToken
          ? 'Paste this straight into your AI client. It has your real token baked in and will guide the client through adding NeuroClass — in many clients it does it for you.'
          : 'Create a token above first, then come back — the prompt will carry your token in. (Pasting this version still works: the client will ask you to create a token and come back.)'}
      </p>
      <pre className="max-h-48 overflow-auto rounded border border-line bg-surface-2 p-2 text-support leading-5 text-ink-2 whitespace-pre-wrap break-words">{prompt}</pre>
    </div>
  );
};

export const IntegrationsPage: React.FC = () => {
  const { userRole } = useAuth();
  usePageMeta({ title: 'Integrations', noindex: true });
  const toast = useToast();
  const confirm = useConfirm();
  const [tokens, setTokens] = React.useState<Token[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [issued, setIssued] = React.useState<{ token: string; name: string } | null>(null);
  const [tab, setTab] = React.useState('claude-desktop');

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const data = await api.get<{ tokens: Token[] }>('me/tokens');
      setTokens(data.tokens);
    } catch (e) { setLoadError((e as Error).message); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      const data = await api.post<Token & { token: string }>('me/tokens', { name: newName.trim() });
      setIssued({ token: data.token, name: data.name });
      setCreating(false); setNewName('');
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };
  const revoke = async (t: Token) => {
    if (!(await confirm({ title: `Revoke "${t.name}"?`, body: 'Any AI client using this token will lose access to your NeuroClass account right away. This can’t be undone, but you can create a new token any time.', confirmLabel: 'Revoke token', tone: 'danger' }))) return;
    try {
      await api.del<void>(`me/tokens/${t.id}`);
      toast.success('Token revoked.');
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const tokenValue = issued?.token ?? 'nc_live_YOUR_TOKEN';
  const tabs = [
    { id: 'claude-desktop', label: 'Claude Desktop' },
    { id: 'chatgpt', label: 'ChatGPT' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'other', label: 'Anything else' },
  ];

  return (
    <PageBody className="max-w-5xl">
      <PageHeader title="Integrations" description="Connect NeuroClass to Claude, ChatGPT, Cursor and other AI tools. They can create classrooms, publish tests, grade attempts and more — using your account." />

      <Card as="section" className="mt-6" aria-labelledby="mcp-overview">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="mcp-overview" className="text-card text-ink">NeuroClass MCP server</h2>
            <p className="mt-1 text-support text-ink-2">The Model Context Protocol (MCP) is how AI clients call tools. The NeuroClass MCP server lets any MCP-capable client do what you can do in the app — nothing more. Teacher tokens act as a teacher, student tokens act as a student. <a className="text-primary hover:underline" href="/help" onClick={(e) => { e.preventDefault(); window.open('/help', '_blank', 'noopener'); }}>See the setup guide</a>.</p>
          </div>
          <Badge tone="primary">Role: {userRole ?? 'none'}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
          <dt className="text-support text-ink-2">Endpoint</dt>
          <dd className="text-body font-mono text-ink">{MCP_ENDPOINT}</dd>
          <dt className="text-support text-ink-2">Transport</dt>
          <dd className="text-body text-ink">Streamable HTTP (JSON-RPC 2.0)</dd>
          <dt className="text-support text-ink-2">Authentication</dt>
          <dd className="text-body text-ink">Bearer token (<code className="font-mono">nc_live_…</code>)</dd>
        </dl>
      </Card>

      <Card as="section" padding="none" className="mt-4" aria-labelledby="tokens">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-5 py-4">
          <div><h2 id="tokens" className="text-card text-ink">Access tokens</h2><p className="text-support text-ink-2">Each token acts as your account. Give one token per client, so you can revoke it if a device is lost.</p></div>
          <Button iconLeft={<Plus size={16} />} onClick={() => setCreating(true)}>Create token</Button>
        </div>
        {loadError ? <div className="p-4"><ErrorState message={loadError} onRetry={() => void load()} /></div>
          : tokens === null ? <div className="space-y-3 p-4"><Skeleton className="h-10" rounded="control" /><Skeleton className="h-10" rounded="control" /></div>
          : tokens.length === 0 ? <div className="p-4"><EmptyState title="No tokens yet" body="Create a token and paste it into Claude, ChatGPT or another MCP client." action={<Button onClick={() => setCreating(true)}>Create your first token</Button>} /></div>
          : <DataTable
              caption="Your personal access tokens"
              rows={tokens}
              rowKey={(t) => t.id}
              primaryColumn="name"
              columns={[
                { key: 'name', header: 'Name', cell: (t) => <span className="font-medium text-ink">{t.name}</span> },
                { key: 'prefix', header: 'Token', cell: (t) => <code className="font-mono text-support text-ink-2">{t.prefix}</code> },
                { key: 'created', header: 'Created', cell: (t) => new Date(t.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), hideOnMobile: true },
                { key: 'used', header: 'Last used', cell: (t) => t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : <span className="text-ink-3">Never</span> },
                { key: 'actions', header: '', align: 'right', cell: (t) => <Button variant="text" size="sm" className="text-danger-ink hover:bg-danger-bg" onClick={() => void revoke(t)}>Revoke</Button> },
              ]}
            />
        }
      </Card>

      <Card as="section" padding="none" className="mt-4" aria-labelledby="setup">
        <div className="border-b border-line-2 px-5 py-4"><h2 id="setup" className="text-card text-ink">Set up your AI client</h2><p className="text-support text-ink-2">Paste one of the snippets below. Replace <code className="font-mono">nc_live_YOUR_TOKEN</code> with a token you created above.</p></div>
        <div className="p-5">
          <Tabs items={tabs} value={tab} onChange={setTab} label="Client" idPrefix="mcp-client" />
          <TabPanel tabId={tab} idPrefix="mcp-client" className="pt-4">
            {tab === 'claude-desktop' && (
              <div className="flex flex-col gap-3">
                <PromptBlock prompt={SETUP_PROMPT('claude-desktop', tokenValue)} hasRealToken={Boolean(issued)} />
                <p className="text-support text-ink-3">Or set it up by hand:</p>
                <ol className="list-decimal space-y-1 pl-6 text-body text-ink-2">
                  <li>Open Claude Desktop, then <strong className="text-ink">Settings → Developer → Edit Config</strong>.</li>
                  <li>Merge the snippet below into <code className="font-mono">claude_desktop_config.json</code>.</li>
                  <li>Save and restart Claude Desktop. NeuroClass appears in the tools menu.</li>
                </ol>
                <CodeBlock code={CLAUDE_DESKTOP(tokenValue)} label="claude_desktop_config.json" />
              </div>
            )}
            {tab === 'chatgpt' && (
              <div className="flex flex-col gap-3">
                <PromptBlock prompt={SETUP_PROMPT('chatgpt', tokenValue)} hasRealToken={Boolean(issued)} />
                <p className="text-support text-ink-3">Or set it up by hand:</p>
                <ol className="list-decimal space-y-1 pl-6 text-body text-ink-2">
                  <li>Open <strong className="text-ink">Settings → Connectors</strong> in ChatGPT (Team, Enterprise or Plus with Developer Mode).</li>
                  <li>Choose <strong className="text-ink">Add connector</strong>, then <strong className="text-ink">Custom MCP server</strong>.</li>
                  <li>Enter the details below. ChatGPT handles the authentication header.</li>
                </ol>
                <CodeBlock code={CHATGPT_CONFIG(tokenValue)} language="text" label="Custom connector" />
                <InfoCard tone="info" title="Haven’t got the Connectors section?">Custom MCP servers are available on Team, Enterprise and Plus with Developer Mode. Free accounts can use NeuroClass through Claude or Cursor instead.</InfoCard>
              </div>
            )}
            {tab === 'cursor' && (
              <div className="flex flex-col gap-3">
                <PromptBlock prompt={SETUP_PROMPT('cursor', tokenValue)} hasRealToken={Boolean(issued)} />
                <p className="text-support text-ink-3">Or set it up by hand:</p>
                <ol className="list-decimal space-y-1 pl-6 text-body text-ink-2">
                  <li>In Cursor, open <strong className="text-ink">Settings → MCP → Add new MCP server</strong>.</li>
                  <li>Paste the configuration below.</li>
                  <li>Save. The NeuroClass tools appear in the Composer agent.</li>
                </ol>
                <CodeBlock code={CURSOR_CONFIG(tokenValue)} label="Cursor MCP configuration" />
              </div>
            )}
            {tab === 'other' && (
              <div className="flex flex-col gap-3">
                <PromptBlock prompt={SETUP_PROMPT('generic', tokenValue)} hasRealToken={Boolean(issued)} />
                <p className="text-support text-ink-3">Or set it up by hand:</p>
                <p className="text-body text-ink-2">Any MCP-compatible client works. Point it at the NeuroClass MCP endpoint with a Bearer token in the Authorization header.</p>
                <dl className="grid gap-2 sm:grid-cols-[auto_1fr] text-body">
                  <dt className="font-medium text-ink">URL</dt><dd className="font-mono text-ink-2">{MCP_ENDPOINT}</dd>
                  <dt className="font-medium text-ink">Auth header</dt><dd className="font-mono text-ink-2">Authorization: Bearer {tokenValue}</dd>
                  <dt className="font-medium text-ink">Transport</dt><dd className="text-ink-2">Streamable HTTP (POST with JSON-RPC 2.0 requests)</dd>
                  <dt className="font-medium text-ink">Protocol version</dt><dd className="font-mono text-ink-2">2025-06-18</dd>
                </dl>
                <CodeBlock language="bash" code={`curl -s -X POST ${MCP_ENDPOINT} \\\n  -H "Authorization: Bearer ${tokenValue}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`} label="Quick test from the command line" />
              </div>
            )}
          </TabPanel>
        </div>
      </Card>

      <Card as="section" className="mt-4">
        <CardHeader title="What your AI can do" subtitle="Tokens inherit your role; the client sees only tools that your account can use." />
        <div className="mt-3 grid gap-5 sm:grid-cols-2 text-body text-ink-2">
          <div>
            <p className="font-medium text-ink">If you’re a teacher</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>list and create classrooms, read their roster and class code;</li>
              <li>create, fill and publish tests (standard or coding) in one call;</li>
              <li>read test results, grade attempts and release results;</li>
              <li>create and publish assignments, review submissions and grade them.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">If you’re a student</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>join a classroom with a code;</li>
              <li>list the classes you’re in and the tests waiting for you;</li>
              <li>read assignments and your own draft submissions;</li>
              <li>get your released results.</li>
            </ul>
          </div>
        </div>
        <CardFooter>
          <a href="/help" className="text-primary hover:underline inline-flex items-center gap-1" target="_blank" rel="noopener">Setup guide and tool list <ExternalLink size={14} /></a>
        </CardFooter>
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="sm"
        title="Create an access token"
        description="Name the client so you’ll recognise it later (for example: “My laptop — Claude Desktop”)."
        footer={<><Button variant="text" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={() => void create()} disabled={!newName.trim()}>Create token</Button></>}
      >
        <Field label="Name" required><Input value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} maxLength={80} onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) void create(); }} /></Field>
      </Modal>

      <Modal
        open={Boolean(issued)}
        onClose={() => setIssued(null)}
        size="md"
        title="Copy your token now"
        description={<>This is the only time you’ll see <strong className="font-semibold text-ink">{issued?.name}</strong> in full. If you lose it, revoke it and create a new one.</>}
        footer={<Button onClick={() => setIssued(null)}>I’ve saved it</Button>}
      >
        {issued && <>
          <CodeBlock code={issued.token} language="text" label="Token" />
          <div className="mt-4">
            <PromptBlock prompt={SETUP_PROMPT(tab === 'chatgpt' || tab === 'cursor' || tab === 'claude-desktop' ? tab : 'generic', issued.token)} hasRealToken={true} />
          </div>
          <p className="mt-3 text-support text-ink-2">The token acts as your NeuroClass account. Treat it like a password: don’t commit it to source control or paste it into a public chat.</p>
        </>}
      </Modal>
    </PageBody>
  );
};
