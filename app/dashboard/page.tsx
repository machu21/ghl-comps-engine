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
  const [activeNav, setActiveNav] = useState<'logs' | 'clients'>('logs');

  const fetchData = useCallback(async () => {
    const [logsRes, clientsRes] = await Promise.all([
      fetch('/api/logs'),
      fetch('/api/clients'),
    ]);
    if (logsRes.status === 401) { router.push('/login'); return; }
    const logsData = await logsRes.json();
    const clientsData = await clientsRes.json();
    setLogs(logsData.logs || []);
    setClients(clientsData.clients || []);
    setLoading(false);
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
    return '#ff6b6b';
  };

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || '—';
  };

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
            {[{ key: 'logs', label: '⬡ Logs' }, { key: 'clients', label: '⬡ Clients' }].map(item => (
              <button key={item.key} className="nav-btn"
                onClick={() => setActiveNav(item.key as any)}
                style={{ color: activeNav === item.key ? '#63ffb4' : '#555566', borderLeft: activeNav === item.key ? '2px solid #63ffb4' : '2px solid transparent' }}>
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
            <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#555566', fontSize: 11, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>
              → Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div style={{ marginLeft: 220, flex: 1, padding: 32 }}>

          {activeNav === 'logs' && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              {/* Stats */}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 100px 140px', padding: '10px 24px', borderBottom: '1px solid #1e1e2e' }}>
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
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 100px 140px', padding: '14px 24px', borderBottom: '1px solid #0f0f18', background: selected?.id === log.id ? '#1a1a24' : 'transparent', transition: 'background 0.15s', animation: `fadeUp 0.3s ease ${i * 0.03}s both` }}>
                        <span style={{ color: '#c8c8d8', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{log.contact_name || '—'}</span>
                        <span style={{ color: '#888899', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{log.address || '—'}</span>
                        <span style={{ color: '#a78bfa', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{getClientName(log.client_id)}</span>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(log.ghl_status), boxShadow: `0 0 8px ${statusColor(log.ghl_status)}`, display: 'inline-block', marginRight: 8, flexShrink: 0 }} />
                          <span style={{ color: statusColor(log.ghl_status), fontSize: 11 }}>{log.ghl_status}</span>
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

          {activeNav === 'clients' && (
            <ClientsPanel clients={clients} onRefresh={fetchData} />
          )}
        </div>
      </div>
    </main>
  );
}

function ClientsPanel({ clients, onRefresh }: { clients: Client[], onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [msg, setMsg] = useState('');


  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ghl_access_token: token, location_id: locationId }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg('✅ Client added!');
      setName(''); setToken(''); setLocationId(''); setLocationName('');
      onRefresh();
    } else {
      setMsg(`❌ ${data.error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client?')) return;
    await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const inputStyle: React.CSSProperties = { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 12px', color: '#e2e2e8', fontSize: 13, outline: 'none', fontFamily: "'DM Mono', monospace" };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, color: '#555566', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 };

  return (
    <div style={{ animation: 'fadeUp 0.4s ease', maxWidth: 800 }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e2e2e8', marginBottom: 24 }}>Clients</h2>

      {/* Add client form */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, color: '#888899', marginBottom: 20, letterSpacing: '0.05em' }}>Add New Client</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step 1 - Token  */}
          <div>
            <label style={labelStyle}>Step 1 — GHL Access Token</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={token} onChange={e => { setToken(e.target.value); setLocationId(''); setLocationName(''); }} placeholder="pit-xxx-..." required />
            </div>
            <p style={{ fontSize: 11, color: '#444455', marginTop: 6 }}>
              Find in GHL → Settings → Integrations → API Key
            </p>
          </div>

          {/* Step 2 - Location ID ( or manual) */}
          <div>
            <label style={labelStyle}>Step 2 — Location ID {locationName && <span style={{ color: '#63ffb4', marginLeft: 8 }}>✓ {locationName}</span>}</label>
            <input style={{ ...inputStyle, borderColor: locationId ? '#2e3e2e' : '#1e1e2e' }} value={locationId} onChange={e => setLocationId(e.target.value)}
              placeholder="Paste manually" required />
            <p style={{ fontSize: 11, color: '#444455', marginTop: 6 }}>
              Or find manually: GHL URL → /location/<span style={{ color: '#a78bfa' }}>THIS_PART</span>/dashboard
            </p>
          </div>

          {/* Step 3 - Name */}
          <div>
            <label style={labelStyle}>Step 3 — Client Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" required />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="submit" disabled={saving || !locationId}
              style={{ background: locationId ? '#63ffb4' : '#1e1e2e', color: locationId ? '#0a0a0f' : '#555566', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 12, fontWeight: 500, cursor: saving || !locationId ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace" }}>
              {saving ? 'Adding...' : '+ Add Client'}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#63ffb4' : '#ff6b6b' }}>{msg}</span>}
          </div>
        </form>
      </div>

      {/* Clients list */}
      <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e1e2e' }}>
          <span style={{ fontSize: 10, color: '#333344', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{clients.length} clients registered</span>
        </div>
        {clients.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#555566', fontSize: 13 }}>No clients yet</div>
        ) : clients.map(client => (
          <div key={client.id} style={{ padding: '16px 24px', borderBottom: '1px solid #0f0f18', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#c8c8d8', fontSize: 14, marginBottom: 4 }}>{client.name}</div>
              <div style={{ color: '#444455', fontSize: 11 }}>Location ID: <span style={{ color: '#a78bfa' }}>{client.location_id}</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#333344', fontFamily: 'monospace' }}>{client.ghl_access_token?.substring(0, 16)}...</span>
              <button onClick={() => handleDelete(client.id)}
                style={{ background: 'transparent', border: '1px solid #2e1e1e', borderRadius: 6, padding: '4px 10px', color: '#ff6b6b', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}