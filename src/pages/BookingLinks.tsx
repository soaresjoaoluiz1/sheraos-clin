import { useState, useEffect, useCallback } from 'react';
import { Link, Plus, Trash2, Copy, Check, User, Search, Clock } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';

const BASE = import.meta.env.BASE_URL;

interface Lead { id: number; name: string; phone: string; }
interface Professional { id: number; name: string; }
interface BookingLink {
  id: number; token: string; lead_name: string; lead_phone: string;
  professional_name: string; status: 'active' | 'used' | 'expired';
  created_by_name: string; created_at: string; used_at?: string;
}

function StatusBadge({ status }: { status: BookingLink['status'] }) {
  const map = { active: { label: 'Ativo', color: '#22c55e' }, used: { label: 'Usado', color: '#718096' }, expired: { label: 'Expirado', color: '#ef4444' } };
  const s = map[status];
  return <span style={{ background: s.color, color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
}

export default function BookingLinks() {
  const { accountId } = useAccount();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [links, setLinks] = useState<BookingLink[]>([]);

  const [search, setSearch] = useState('');
  const [showLeadDrop, setShowLeadDrop] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedProfId, setSelectedProfId] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [generatedInfo, setGeneratedInfo] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/booking/links?account_id=${accountId}`);
      setLinks(data.links || []);
    } finally { setLoading(false); }
  }, [accountId]);

  const fetchProfessionals = useCallback(async () => {
    if (!accountId) return;
    const data = await apiFetch(`/api/appointments/professionals?account_id=${accountId}`);
    setProfessionals(data.professionals || []);
  }, [accountId]);

  useEffect(() => { fetchLinks(); fetchProfessionals(); }, [fetchLinks, fetchProfessionals]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search || !accountId) { setLeads([]); return; }
      const data = await apiFetch(`/api/leads?account_id=${accountId}&search=${encodeURIComponent(search)}`);
      setLeads(data.leads || []);
      setShowLeadDrop(true);
    }, 350);
    return () => clearTimeout(t);
  }, [search, accountId]);

  const handleGenerate = async () => {
    if (!selectedLead || !selectedProfId || !accountId) return;
    setGenerating(true);
    setGeneratedUrl('');
    try {
      const data = await apiFetch(`/api/booking/generate?account_id=${accountId}`, {
        method: 'POST',
        body: JSON.stringify({ lead_id: selectedLead.id, professional_id: Number(selectedProfId) }),
      });
      const url = `${window.location.origin}${BASE}agendar/${data.token}`;
      setGeneratedUrl(url);
      setGeneratedInfo(`${data.lead_name} com ${data.professional_name}`);
      fetchLinks();
    } finally { setGenerating(false); }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este link de agendamento?')) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/booking/links/${id}?account_id=${accountId}`, { method: 'DELETE' });
      setLinks(prev => prev.filter(l => l.id !== id));
    } finally { setDeletingId(null); }
  };

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ padding: '24px', background: '#F0F4F8', minHeight: '100vh' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#2D3748', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link size={22} color="#5CB8B2" /> Links de Agendamento
        </h1>
        <p style={{ color: '#718096', fontSize: 14, marginTop: 4 }}>Gere links privados para pacientes agendarem online</p>
      </div>

      {/* Generate Section */}
      <div className="card" style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2D3748', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} color="#5CB8B2" /> Gerar Novo Link
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Lead Search */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <label style={{ fontSize: 12, color: '#718096', fontWeight: 500, display: 'block', marginBottom: 4 }}>Paciente</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#718096' }} />
              <input
                className="input"
                style={{ paddingLeft: 32, width: '100%' }}
                placeholder="Buscar paciente..."
                value={selectedLead ? selectedLead.name : search}
                onChange={e => { setSearch(e.target.value); setSelectedLead(null); setGeneratedUrl(''); }}
                onFocus={() => leads.length > 0 && setShowLeadDrop(true)}
              />
            </div>
            {showLeadDrop && leads.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 180, overflowY: 'auto' }}>
                {leads.map(l => (
                  <div key={l.id} onClick={() => { setSelectedLead(l); setSearch(''); setShowLeadDrop(false); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F0F4F8')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <User size={14} color="#5CB8B2" />
                    <span style={{ fontSize: 14, color: '#2D3748' }}>{l.name}</span>
                    <span style={{ fontSize: 12, color: '#718096' }}>{l.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Professional */}
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, color: '#718096', fontWeight: 500, display: 'block', marginBottom: 4 }}>Profissional</label>
            <select className="select" style={{ width: '100%' }} value={selectedProfId} onChange={e => setSelectedProfId(e.target.value)}>
              <option value="">Selecionar...</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" onClick={handleGenerate} disabled={!selectedLead || !selectedProfId || generating}
            style={{ background: '#5CB8B2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, height: 40, whiteSpace: 'nowrap', opacity: (!selectedLead || !selectedProfId || generating) ? 0.6 : 1 }}>
            <Plus size={16} /> {generating ? 'Gerando...' : 'Gerar Link'}
          </button>
        </div>

        {generatedUrl && (
          <div style={{ marginTop: 16, background: '#F0F4F8', borderRadius: 8, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>Link gerado para <strong style={{ color: '#2D3748' }}>{generatedInfo}</strong>:</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, fontSize: 13, color: '#2D3748', wordBreak: 'break-all' }}>{generatedUrl}</code>
              <button onClick={() => handleCopy(generatedUrl, 'new')} style={{ background: '#5CB8B2', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, whiteSpace: 'nowrap' }}>
                {copied === 'new' ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Links Table */}
      <div className="table-card card" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color="#5CB8B2" /> Links Gerados
          </h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>Carregando...</div>
        ) : links.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>Nenhum link gerado ainda.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F0F4F8' }}>
                  {['Paciente', 'Profissional', 'Status', 'Criado por', 'Data', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#718096', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid #e2e8f0' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 16px', color: '#2D3748', fontWeight: 500 }}>
                      {l.lead_name}<br /><span style={{ color: '#718096', fontWeight: 400, fontSize: 12 }}>{l.lead_phone}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#2D3748' }}>{l.professional_name}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={l.status} />
                      {l.status === 'used' && l.used_at && <div style={{ fontSize: 11, color: '#718096', marginTop: 2 }}>Usado em: {fmt(l.used_at)}</div>}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#718096' }}>{l.created_by_name}</td>
                    <td style={{ padding: '10px 16px', color: '#718096', whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleCopy(`${window.location.origin}${BASE}agendar/${l.token}`, `row-${l.id}`)}
                          style={{ background: '#e2e8f0', color: '#2D3748', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          {copied === `row-${l.id}` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        <button onClick={() => handleDelete(l.id)} disabled={deletingId === l.id}
                          style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: deletingId === l.id ? 0.6 : 1 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
