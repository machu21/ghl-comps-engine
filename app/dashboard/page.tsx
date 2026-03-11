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
}

export default function DashboardPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Log | null>(null);
  const [activeTab, setActiveTab] = useState<'ai_output' | 'webhook'>('ai_output');
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    const res = await fetch('/api/logs');
    if (res.status === 401) { router.push('/login'); return; }
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const filtered = logs.filter(l =>
    l.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.address?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status: string) => {
    if (status === 'success') return '#63ffb4';
    if (status === 'pending') return '#ffcc63';
    return '#ff6b6b';
  };

  const statusDot = (status: string) => ({
    width: 7, height: 7, borderRadius: '50%',
    background: statusColor(status),
    boxShadow: `0 0 8px ${statusColor(status)}`,
    display: 'inline-block', marginRight: 8, flexShrink: 0,
  });

  return (
    <main className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 3px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} }
        .log-row:hover { background: #13131a !important; cursor: pointer; }
        .tab-active { border-bottom: 2px solid #63ffb4 !important; color: #63ffb4 !important; }
        .refresh-btn:hover { background: #1e1e2e !important; }
        .logout-btn:hover { color: #ff6b6b !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: '#0d0d14', borderBottom: '1px solid #1e1e2e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, background: '#63ffb4', borderRadius: '50%', boxShadow: '0 0 12px #63ffb4', animation: 'flicker 4s infinite' }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#e2e2e8', letterSpacing: '-0.02em' }}>
            FILAM<span style={{ color: '#63ffb4' }}>REIVA</span>
          </span>
          <span style={{ color: '#333344', fontSize: 11, marginLeft: 8, letterSpacing: '0.1em' }}>/ DASHBOARD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="refresh-btn" onClick={fetchLogs} style={{ background: 'transparent', border: '1px solid #1e1e2e', borderRadius: 6, padding: '6px 12px', color: '#555566', fontSize: 11, cursor: 'pointer', transition: 'background 0.2s', letterSpacing: '0.05em' }}>
            ↻ Refresh
          </button>
          <button className="logout-btn" onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#555566', fontSize: 11, cursor: 'pointer', transition: 'color 0.2s', letterSpacing: '0.05em' }}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 24, maxWidth: 1400, margin: '0 auto', animation: 'fadeUp 0.4s ease' }}>

        {/* Stats row */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
          {[
            { label: 'Total Leads', value: logs.length },
            { label: 'Successful', value: logs.filter(l => l.ghl_status === 'success').length, color: '#63ffb4' },
            { label: 'Failed', value: logs.filter(l => l.ghl_status?.startsWith('error') || l.ghl_status?.startsWith('failed')).length, color: '#ff6b6b' },
            { label: 'Pending', value: logs.filter(l => l.ghl_status === 'pending').length, color: '#ffcc63' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px', flex: 1 }}>
              <div style={{ fontSize: 11, color: '#555566', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: stat.color || '#e2e2e8', fontFamily: "'Syne', sans-serif" }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Logs table */}
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#e2e2e8', margin: 0 }}>Webhook Logs</h2>
            <input
              placeholder="Search name or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '8px 12px', color: '#e2e2e8', fontSize: 12, outline: 'none', width: 240 }}
            />
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 100px 140px', padding: '10px 24px', borderBottom: '1px solid #1e1e2e' }}>
            {['Contact', 'Address', 'GHL Status', 'Time'].map(h => (
              <span key={h} style={{ fontSize: 10, color: '#333344', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#555566', fontSize: 13 }}>Loading logs...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#555566', fontSize: 13 }}>No logs found</div>
            ) : filtered.map((log, i) => (
              <div
                key={log.id}
                className="log-row"
                onClick={() => setSelected(selected?.id === log.id ? null : log)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1.4fr 100px 140px',
                  padding: '14px 24px', borderBottom: '1px solid #0f0f18',
                  background: selected?.id === log.id ? '#13131a' : 'transparent',
                  transition: 'background 0.15s',
                  animation: `fadeUp 0.3s ease ${i * 0.03}s both`
                }}
              >
                <span style={{ color: '#c8c8d8', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{log.contact_name || '—'}</span>
                <span style={{ color: '#888899', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{log.address || '—'}</span>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                  <span style={statusDot(log.ghl_status)} />
                  <span style={{ color: statusColor(log.ghl_status) }}>{log.ghl_status}</span>
                </span>
                <span style={{ color: '#444455', fontSize: 11 }}>
                  {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: 76 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#e2e2e8', marginBottom: 4 }}>{selected.contact_name}</div>
                <div style={{ fontSize: 12, color: '#555566' }}>{selected.address}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#555566', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
              {(['ai_output', 'webhook'] as const).map(tab => (
                <button
                  key={tab}
                  className={activeTab === tab ? 'tab-active' : ''}
                  onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: activeTab === tab ? '#63ffb4' : '#555566', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'color 0.2s' }}
                >
                  {tab === 'ai_output' ? 'AI Comps' : 'Webhook Data'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
              {activeTab === 'ai_output' ? (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c8c8d8', fontSize: 12, lineHeight: 1.8, margin: 0 }}>
                  {selected.ai_output || 'No AI output yet.'}
                </pre>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#888899', fontSize: 11, lineHeight: 1.7, margin: 0 }}>
                  {JSON.stringify(selected.webhook_data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}