'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError(data.error || 'Invalid credentials');
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4"
      style={{ fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #13131a inset !important; -webkit-text-fill-color: #e2e2e8 !important; }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.8} 94%{opacity:1} 97%{opacity:0.9} 98%{opacity:1} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .card { animation: fadeUp 0.6s ease forwards; }
        .glow-btn:hover { box-shadow: 0 0 24px rgba(99,255,180,0.3); }
        .input-field:focus { border-color: #63ffb4 !important; box-shadow: 0 0 0 3px rgba(99,255,180,0.1); }
      `}</style>

      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.8) 2px, rgba(255,255,255,0.8) 4px)', width: '100%', height: '100%' }} />
      </div>

      <div className="card w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div style={{ width: 8, height: 8, background: '#63ffb4', borderRadius: '50%', boxShadow: '0 0 12px #63ffb4', animation: 'flicker 4s infinite' }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#e2e2e8', letterSpacing: '-0.02em' }}>
              FILAM<span style={{ color: '#63ffb4' }}>REIVA</span>
            </span>
          </div>
          <p style={{ color: '#555566', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>AI Comps Dashboard</p>
        </div>

        {/* Card */}
        <div style={{ background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 16, padding: '40px 36px' }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: '#e2e2e8', marginBottom: 8 }}>Sign in</h1>
          <p style={{ color: '#555566', fontSize: 13, marginBottom: 32 }}>Access your comps dashboard</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555566', marginBottom: 8 }}>Username</label>
              <input
                className="input-field"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                style={{ width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 14px', color: '#e2e2e8', fontSize: 14, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555566', marginBottom: 8 }}>Password</label>
              <input
                className="input-field"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 14px', color: '#e2e2e8', fontSize: 14, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="glow-btn"
              disabled={loading}
              style={{ background: '#63ffb4', color: '#0a0a0f', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'box-shadow 0.2s, opacity 0.2s', marginTop: 4 }}
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#333344', fontSize: 11, marginTop: 24, letterSpacing: '0.05em' }}>
          FILAM REIVA LLC · Sheridan, WY
        </p>
      </div>
    </main>
  );
}