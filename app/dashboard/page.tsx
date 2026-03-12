'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Log {
  id: string;
  created_at: string;
  contact_name: string;
  address: string;
  ai_output: string;
  ghl_status: string;
  webhook_data: any;
  client_id: string;
  location_id: string;
}

interface Client {
  id: string;
  name: string;
  location_id: string;
  ghl_access_token: string;
  batchdialer_api_key: string;
  created_at: string;
}

interface Pipeline {
  id: string;
  client_id: string;
  name: string;
  pipeline_id: string;
  is_default: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Log | null>(null);
  const [activeTab, setActiveTab] = useState<'ai_output' | 'webhook'>('ai_output');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [activeNav, setActiveNav] = useState<'logs' | 'clients' | 'settings'>('logs');

  const fetchData = useCallback(async () => {
    try {
      const [logsRes, clientsRes] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/clients'),
      ]);
      if (logsRes.status === 401 || clientsRes.status === 401) {
        router.push('/login');
        return;
      }
      const [logsData, clientsData] = await Promise.all([
        logsRes.json().catch(() => ({ logs: [] })),
        clientsRes.json().catch(() => ({ clients: [] })),
      ]);
      setLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
      setClients(Array.isArray(clientsData.clients) ? clientsData.clients : []);
    } catch (err) {
      console.error('fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const filtered = logs.filter(l => {
    const matchesSearch = l.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.address?.toLowerCase().includes(search.toLowerCase());
    const matchesClient = clientFilter === 'all' || l.client_id === clientFilter;
    return matchesSearch && matchesClient;
  });

  const statusColor = (status: string) => {
    if (status === 'success') return '#63ffb4';
    if (status === 'pending') return '#ffcc63';
    if (status === 'missing_ghl_token') return '#f97316';
    return '#ff6b6b';
  };

  const getClientName = (clientId: string) =>
    clients.find(c => c.id === clientId)?.name || '—';

  return (
    <main className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 3px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} }
        .log-row:hover { background: #13131a !important; cursor: pointer; }
        .nav-btn { width:100%; text-align:left; background:transparent; border:none; border-left:2px solid transparent; padding:10px 20px; font-size:12px; letter-spacing:0.08em; cursor:pointer; transition:color 0.2s; text-transform:uppercase; font-family:'DM Mono',monospace; }
        .nav-btn:hover { color: #e2e2e8 !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{ width: 220, background: '#0d0d14', borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 50 }}>
          <div style={{ padding: '24px 20px', borderBottom: '1px solid #1e1e2e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, background: '#63ffb4', borderRadius: '50%', boxShadow: '0 0 10px #63ffb4', animation: 'flicker 4s infinite' }} />
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e2e8' }}>
                FILAM<span style={{ color: '#63ffb4' }}>REIVA</span>
              </span>
            </div>
          </div>
          <nav style={{ flex: 1, padding: '16px 0' }}>
            {[
              { key: 'logs', label: '⬡ Logs' },
              { key: 'clients', label: '⬡ Clients' },
              { key: 'settings', label: '⬡ Settings' },
            ].map(item => (
              <button key={item.key} className="nav-btn"
                onClick={() => setActiveNav(item.key as any)}
                style={{ color: activeNav === item.key ? '#63ffb4' : '#555566', borderLeft: activeNav === item.key ? '2px solid #63ffb4' : '2px solid transparent' }}>
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
            <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#555566', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
              → Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div style={{ marginLeft: 220, flex: 1, padding: 32 }}>

          {/* LOGS */}
          {activeNav === 'logs' && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Total Leads', value: filtered.length },
                  { label: 'Successful', value: filtered.filter(l => l.ghl_status === 'success').length, color: '#63ffb4' },
                  { label: 'Failed', value: filtered.filter(l => l.ghl_status?.startsWith('error') || l.ghl_status?.startsWith('failed')).length, color: '#ff6b6b' },
                  { label: 'Clients', value: clients.length, color: '#a78bfa' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px' }}>
                    <div style={{ fontSize: 10, color: '#555566', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{stat.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 500, color: stat.color || '#e2e2e8', fontFamily: "'Syne', sans-serif" }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 24 }}>
                <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2e', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input placeholder="Search name or address..." value={search} onChange={e => setSearch(e.target.value)}
                      style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '8px 12px', color: '#e2e2e8', fontSize: 12, outline: 'none', flex: 1 }} />
                    <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                      style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '8px 12px', color: '#e2e2e8', fontSize: 12, outline: 'none' }}>
                      <option value="all">All Clients</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={fetchData} style={{ background: '#1e1e2e', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#888899', fontSize: 11, cursor: 'pointer' }}>↻</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 110px 140px', padding: '10px 24px', borderBottom: '1px solid #1e1e2e' }}>
                    {['Contact', 'Address', 'Client', 'Status', 'Time'].map(h => (
                      <span key={h} style={{ fontSize: 10, color: '#333344', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
                    {loading ? (
                      <div style={{ padding: 40, textAlign: 'center', color: '#555566', fontSize: 13 }}>Loading...</div>
                    ) : filtered.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: '#555566', fontSize: 13 }}>No logs found</div>
                    ) : filtered.map((log, i) => (
                      <div key={log.id} className="log-row" onClick={() => setSelected(selected?.id === log.id ? null : log)}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 110px 140px', padding: '14px 24px', borderBottom: '1px solid #0f0f18', background: selected?.id === log.id ? '#1a1a24' : 'transparent', transition: 'background 0.15s', animation: `fadeUp 0.3s ease ${i * 0.03}s both` }}>
                        <span style={{ color: '#c8c8d8', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{log.contact_name || '—'}</span>
                        <span style={{ color: '#888899', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{log.address || '—'}</span>
                        <span style={{ color: '#a78bfa', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{getClientName(log.client_id)}</span>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(log.ghl_status), boxShadow: `0 0 8px ${statusColor(log.ghl_status)}`, display: 'inline-block', marginRight: 6, flexShrink: 0 }} />
                          <span style={{ color: statusColor(log.ghl_status), fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.ghl_status}</span>
                        </span>
                        <span style={{ color: '#444455', fontSize: 11 }}>
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selected && (
                  <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', position: 'sticky', top: 32 }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#e2e2e8', marginBottom: 4 }}>{selected.contact_name}</div>
                        <div style={{ fontSize: 12, color: '#555566', marginBottom: 4 }}>{selected.address}</div>
                        <div style={{ fontSize: 11, color: '#a78bfa' }}>{getClientName(selected.client_id)}</div>
                      </div>
                      <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#555566', cursor: 'pointer', fontSize: 18 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
                      {(['ai_output', 'webhook'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                          style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === tab ? '2px solid #63ffb4' : '2px solid transparent', color: activeTab === tab ? '#63ffb4' : '#555566', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                          {tab === 'ai_output' ? 'AI Comps' : 'Webhook Data'}
                        </button>
                      ))}
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: activeTab === 'ai_output' ? '#c8c8d8' : '#888899', fontSize: 12, lineHeight: 1.8, margin: 0 }}>
                        {activeTab === 'ai_output' ? (selected.ai_output || 'No AI output yet.') : JSON.stringify(selected.webhook_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeNav === 'clients' && <ClientsPanel clients={clients} onRefresh={fetchData} />}
          {activeNav === 'settings' && <SettingsPanel clients={clients} onRefresh={fetchData} />}
        </div>
      </div>
    </main>
  );
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
function SettingsPanel({ clients, onRefresh }: { clients: Client[], onRefresh: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [settingsTab, setSettingsTab] = useState<'prompt' | 'batchdialer'>('prompt');

  useEffect(() => {
    fetch('/api/settings?key=prompt_template')
      .then(r => r.json())
      .then(data => { setPrompt(data.setting?.value || ''); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'prompt_template', value: prompt }),
    });
    setSaving(false);
    setMsg(res.ok ? '✅ Prompt saved!' : '❌ Failed to save');
    if (res.ok) setTimeout(() => setMsg(''), 3000);
  };

  const handleReset = () => {
    setPrompt(`You are a real estate wholesale analyst.
Search for 3 recently SOLD comps within 1 mile of: {{address}}

Return ONLY this:

Property Address: {{address}}
AvgPPS: $X/sqft
ARV: $X
Repairs: $10,000 (medium)
MAO (ARV x 70% - $10,000 repairs): $X
Offer: $X

Profit 5K: $X | Profit 10K: $X | Profit 15K: $X

Comp 1: [Address] | Sold: $X | $/sqft: $X | [X] miles away
Comp 2: [Address] | Sold: $X | $/sqft: $X | [X] miles away
Comp 3: [Address] | Sold: $X | $/sqft: $X | [X] miles away

Analysis: [2 sentences max - good deal or not?]`);
    setMsg('↺ Reset to default — click Save to apply');
  };

  const inputStyle: React.CSSProperties = { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 12px', color: '#e2e2e8', fontSize: 13, outline: 'none', fontFamily: "'DM Mono', monospace" };

  return (
    <div style={{ animation: 'fadeUp 0.4s ease', maxWidth: 800 }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e2e2e8', marginBottom: 24 }}>Settings</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['prompt', 'batchdialer'] as const).map(t => (
          <button key={t} onClick={() => setSettingsTab(t)}
            style={{ background: settingsTab === t ? '#1e1e2e' : 'transparent', border: 'none', borderRadius: 7, padding: '8px 20px', color: settingsTab === t ? '#63ffb4' : '#555566', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'DM Mono', monospace", transition: 'all 0.2s' }}>
            {t === 'prompt' ? '⬡ Prompt' : '⬡ BatchDialer'}
          </button>
        ))}
      </div>

      {/* Prompt Settings */}
      {settingsTab === 'prompt' && (
        <div>
          <p style={{ color: '#555566', fontSize: 12, marginBottom: 16 }}>
            Use <span style={{ color: '#a78bfa', background: '#1a1a2e', padding: '2px 6px', borderRadius: 4 }}>{"{{address}}"}</span> as the property address placeholder.
          </p>
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28 }}>
            {loading ? <div style={{ color: '#555566', fontSize: 13 }}>Loading...</div> : (
              <>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={20}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ background: '#63ffb4', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 12, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace", opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving...' : '✓ Save Prompt'}
                  </button>
                  <button onClick={handleReset}
                    style={{ background: 'transparent', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 16px', color: '#555566', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                    ↺ Reset
                  </button>
                  {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#63ffb4' : msg.startsWith('↺') ? '#ffcc63' : '#ff6b6b' }}>{msg}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* BatchDialer Settings */}
      {settingsTab === 'batchdialer' && (
        <BatchDialerSettings clients={clients} onRefresh={onRefresh} />
      )}
    </div>
  );
}

// ─── BATCHDIALER SETTINGS ─────────────────────────────────────────────────────
function BatchDialerSettings({ clients, onRefresh }: { clients: Client[], onRefresh: () => void }) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [bdApiKey, setBdApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Pre-fill when client is selected
  useEffect(() => {
    if (selectedClient) {
      setBdApiKey(selectedClient.batchdialer_api_key || '');
    } else {
      setBdApiKey('');
    }
  }, [selectedClientId]);

  const handleSave = async () => {
    if (!selectedClientId) { setMsg('❌ Select a client first'); return; }
    setSaving(true); setMsg('');
    const res = await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedClientId,
        batchdialer_api_key: bdApiKey,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg('✅ BatchDialer settings saved!');
      onRefresh();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('❌ Failed to save');
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 12px', color: '#e2e2e8', fontSize: 13, outline: 'none', fontFamily: "'DM Mono', monospace" };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, color: '#555566', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 };

  return (
    <div>
      <p style={{ color: '#555566', fontSize: 12, marginBottom: 24 }}>
        Map a GHL client account to their BatchDialer integration.
      </p>
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Client dropdown */}
        <div>
          <label style={labelStyle}>Select GHL Client</label>
          <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— Choose a client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.batchdialer_api_key ? '✓' : '(not configured)'}
              </option>
            ))}
          </select>
        </div>

        {selectedClient && (
          <>
            {/* Client info */}
            <div style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: '#555566', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Client</div>
                <div style={{ fontSize: 13, color: '#c8c8d8' }}>{selectedClient.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#555566', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Location ID</div>
                <div style={{ fontSize: 13, color: '#a78bfa' }}>{selectedClient.location_id}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#555566', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>GHL Token</div>
                <div style={{ fontSize: 13, color: selectedClient.ghl_access_token ? '#63ffb4' : '#ff6b6b' }}>
                  {selectedClient.ghl_access_token ? '✓ configured' : '✗ not set'}
                </div>
              </div>
            </div>

            {/* BatchDialer API Key */}
            <div>
              <label style={labelStyle}>BatchDialer API Key</label>
              <input style={inputStyle} value={bdApiKey} onChange={e => setBdApiKey(e.target.value)}
                placeholder="From BatchDialer → Settings → Integrations → API Key" />
              <p style={{ fontSize: 11, color: '#444455', marginTop: 6 }}>
                This key is used to identify which client a BatchDialer webhook belongs to.
              </p>
            </div>

            {/* Pipelines info */}
            <div style={{ background: '#0d0d14', border: '1px solid #1e2e1e', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#63ffb4', marginBottom: 6 }}>⬡ Pipelines are managed per client</div>
              <div style={{ fontSize: 12, color: '#555566', lineHeight: 1.7 }}>
                Go to the <span style={{ color: '#a78bfa' }}>Clients</span> page → expand a client → add pipelines and set a default. Incoming BatchDialer webhooks will automatically route to that client&apos;s default pipeline.
              </div>
            </div>

            {/* Webhook URL */}
            <div>
              <label style={labelStyle}>Webhook URL for BatchDialer</label>
              <div style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'}/api/batchdialer
                </span>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/batchdialer`)}
                  style={{ background: '#1e1e2e', border: 'none', borderRadius: 6, padding: '4px 12px', color: '#888899', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                  Copy
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#444455', marginTop: 6 }}>
                Paste this URL in your GHL workflow webhook action for this client.
              </p>
            </div>

            {/* Save button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ background: '#63ffb4', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 12, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace", opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : '✓ Save BatchDialer Settings'}
              </button>
              {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#63ffb4' : '#ff6b6b' }}>{msg}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CLIENTS PANEL ───────────────────────────────────────────────────────────
function ClientsPanel({ clients, onRefresh }: { clients: Client[], onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', location_id: '', ghl_access_token: '', batchdialer_api_key: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 12px', color: '#e2e2e8', fontSize: 12, outline: 'none', fontFamily: "'DM Mono', monospace" };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, color: '#555566', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg('✅ Client added!');
      setForm({ name: '', location_id: '', ghl_access_token: '', batchdialer_api_key: '' });
      onRefresh();
    } else {
      setMsg(`❌ ${data.error}`);
    }
  };

  const handleEdit = async (id: string) => {
    setSaving(true);
    await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    });
    setSaving(false);
    setEditId(null);
    setEditForm({});
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client and all their pipelines?')) return;
    await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div style={{ animation: 'fadeUp 0.4s ease', maxWidth: 900 }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e2e2e8', marginBottom: 24 }}>Clients</h2>

      {/* Add form */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, color: '#888899', marginBottom: 20, fontFamily: "'DM Mono', monospace" }}>Add New Client</h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Client Name</label>
            <input style={inputStyle} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Jane Smith" required />
          </div>
          <div>
            <label style={labelStyle}>Location ID</label>
            <input style={inputStyle} value={form.location_id}
              onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}
              placeholder="GHL URL → /location/XXXXXX/dashboard" required />
          </div>
          <div>
            <label style={labelStyle}>GHL Access Token</label>
            <input style={inputStyle} value={form.ghl_access_token}
              onChange={e => setForm(f => ({ ...f, ghl_access_token: e.target.value }))}
              placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </div>
          <div>
            <label style={labelStyle}>BatchDialer API Key</label>
            <input style={inputStyle} value={form.batchdialer_api_key}
              onChange={e => setForm(f => ({ ...f, batchdialer_api_key: e.target.value }))}
              placeholder="From BatchDialer → Settings → API" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <button type="submit" disabled={saving}
              style={{ background: '#63ffb4', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 12, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace", opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding...' : '+ Add Client'}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#63ffb4' : '#ff6b6b' }}>{msg}</span>}
          </div>
        </form>
      </div>

      {/* Clients list */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e1e2e' }}>
          <span style={{ fontSize: 10, color: '#333344', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{clients.length} client{clients.length !== 1 ? 's' : ''} registered</span>
        </div>
        {clients.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#555566', fontSize: 13 }}>No clients yet</div>
        ) : clients.map(client => (
          <div key={client.id} style={{ borderBottom: '1px solid #0f0f18' }}>
            {editId === client.id ? (
              <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Name</label>
                  <input style={inputStyle} defaultValue={client.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label style={labelStyle}>Location ID</label>
                  <input style={inputStyle} defaultValue={client.location_id} onChange={e => setEditForm(f => ({ ...f, location_id: e.target.value }))} /></div>
                <div><label style={labelStyle}>GHL Token</label>
                  <input style={inputStyle} defaultValue={client.ghl_access_token} onChange={e => setEditForm(f => ({ ...f, ghl_access_token: e.target.value }))} /></div>
                <div><label style={labelStyle}>BatchDialer API Key</label>
                  <input style={inputStyle} defaultValue={client.batchdialer_api_key} onChange={e => setEditForm(f => ({ ...f, batchdialer_api_key: e.target.value }))} /></div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => handleEdit(client.id)} style={{ background: '#63ffb4', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Save</button>
                  <button onClick={() => { setEditId(null); setEditForm({}); }} style={{ background: 'transparent', border: '1px solid #1e1e2e', borderRadius: 8, padding: '8px 16px', color: '#555566', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {/* Client row */}
                <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#c8c8d8', fontSize: 14, marginBottom: 10, fontWeight: 500 }}>{client.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#555566', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Location ID</div>
                        <div style={{ fontSize: 11, color: '#a78bfa' }}>{client.location_id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#555566', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>GHL Token</div>
                        <div style={{ fontSize: 11, color: client.ghl_access_token ? '#888899' : '#ff6b6b' }}>
                          {client.ghl_access_token ? client.ghl_access_token.substring(0, 18) + '...' : 'not set'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#555566', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>BatchDialer</div>
                        <div style={{ fontSize: 11, color: client.batchdialer_api_key ? '#63ffb4' : '#555566' }}>
                          {client.batchdialer_api_key ? '✓ configured' : 'not set'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                    <button onClick={() => setExpandedClientId(expandedClientId === client.id ? null : client.id)}
                      style={{ background: '#1e1e2e', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#ffcc63', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                      {expandedClientId === client.id ? '▲ Pipelines' : '▼ Pipelines'}
                    </button>
                    <button onClick={() => { setEditId(client.id); setEditForm({}); }}
                      style={{ background: '#1e1e2e', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#a78bfa', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(client.id)}
                      style={{ background: 'transparent', border: '1px solid #2e1e1e', borderRadius: 6, padding: '6px 14px', color: '#ff6b6b', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Pipelines sub-panel */}
                {expandedClientId === client.id && (
                  <PipelinesSubPanel clientId={client.id} />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PIPELINES SUB-PANEL ─────────────────────────────────────────────────────
function PipelinesSubPanel({ clientId }: { clientId: string }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', pipeline_id: '', is_default: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const inputStyle: React.CSSProperties = { background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 7, padding: '8px 11px', color: '#e2e2e8', fontSize: 12, outline: 'none', fontFamily: "'DM Mono', monospace" };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, color: '#555566', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 };

  const fetchPipelines = async () => {
    setLoading(true);
    const res = await fetch(`/api/pipelines?client_id=${clientId}`);
    const data = await res.json();
    setPipelines(data.pipelines || []);
    setLoading(false);
  };

  useEffect(() => { fetchPipelines(); }, [clientId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, ...form }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg('✅ Pipeline added!');
      setForm({ name: '', pipeline_id: '', is_default: false });
      fetchPipelines();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg(`❌ ${data.error}`);
    }
  };

  const handleSetDefault = async (pipeline: Pipeline) => {
    await fetch('/api/pipelines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pipeline.id, client_id: clientId, is_default: true, name: pipeline.name, pipeline_id: pipeline.pipeline_id }),
    });
    fetchPipelines();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pipeline?')) return;
    await fetch(`/api/pipelines?id=${id}`, { method: 'DELETE' });
    fetchPipelines();
  };

  return (
    <div style={{ background: '#0d0d14', borderTop: '1px solid #1e1e2e', padding: '20px 24px 24px' }}>
      <div style={{ fontSize: 10, color: '#555566', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Pipelines</div>

      {/* Existing pipelines */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#555566', marginBottom: 16 }}>Loading...</div>
      ) : pipelines.length === 0 ? (
        <div style={{ fontSize: 12, color: '#444455', marginBottom: 16 }}>No pipelines yet — add one below.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {pipelines.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#13131a', border: `1px solid ${p.is_default ? '#2e3e2e' : '#1e1e2e'}`, borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: '#c8c8d8', marginRight: 10 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: '#444455', fontFamily: 'monospace' }}>{p.pipeline_id}</span>
              </div>
              {p.is_default ? (
                <span style={{ fontSize: 10, color: '#63ffb4', background: '#0d1f16', border: '1px solid #1e3e2e', borderRadius: 20, padding: '3px 10px', letterSpacing: '0.08em' }}>DEFAULT</span>
              ) : (
                <button onClick={() => handleSetDefault(p)}
                  style={{ fontSize: 10, color: '#888899', background: 'transparent', border: '1px solid #2e2e3e', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
                  Set Default
                </button>
              )}
              <button onClick={() => handleDelete(p.id)}
                style={{ background: 'transparent', border: 'none', color: '#ff6b6b', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add pipeline form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Pipeline Name</label>
          <input style={{ ...inputStyle, width: 160 }} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Acquisitions" required />
        </div>
        <div>
          <label style={labelStyle}>GHL Pipeline ID</label>
          <input style={{ ...inputStyle, width: 260 }} value={form.pipeline_id}
            onChange={e => setForm(f => ({ ...f, pipeline_id: e.target.value }))}
            placeholder="From GHL → Opportunities → pipeline URL" required />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <input type="checkbox" id={`default-${clientId}`} checked={form.is_default}
            onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
            style={{ accentColor: '#63ffb4', cursor: 'pointer' }} />
          <label htmlFor={`default-${clientId}`} style={{ fontSize: 11, color: '#888899', cursor: 'pointer' }}>Set as default</label>
        </div>
        <button type="submit" disabled={saving}
          style={{ background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: 8, padding: '8px 18px', color: '#63ffb4', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace", paddingBottom: 9 }}>
          {saving ? '...' : '+ Add Pipeline'}
        </button>
        {msg && <span style={{ fontSize: 11, color: msg.startsWith('✅') ? '#63ffb4' : '#ff6b6b' }}>{msg}</span>}
      </form>
    </div>
  );
}