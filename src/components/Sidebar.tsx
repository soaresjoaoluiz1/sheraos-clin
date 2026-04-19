import { useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAccount } from '../context/AccountContext'
import { useSSE } from '../context/SSEContext'
import { apiFetch, fetchTaskCounts } from '../lib/api'
import {
  LayoutDashboard, Kanban, Users, MessageCircle, UserCog, GitBranch,
  Plug, Settings, Building2, LogOut, UsersRound, Menu, X,
  ListOrdered, MessageSquarePlus, ClipboardList, Rocket, ListTodo,
  Calendar, FileText, Clock, Link,
} from 'lucide-react'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { accountId } = useAccount()
  const [newLeadsCount, setNewLeadsCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)

  const loadTaskCount = useCallback(() => {
    if (!accountId) return
    fetchTaskCounts(accountId).then(c => setTaskCount(c.overdue + c.today)).catch(() => {})
  }, [accountId])
  useEffect(() => { loadTaskCount() }, [loadTaskCount])
  useSSE('task:updated', loadTaskCount)
  useSSE('task:due', loadTaskCount)
  const [mobileOpen, setMobileOpen] = useState(false)
  if (!user) return null

  const isAdmin = user.role === 'super_admin'
  const isGerente = user.role === 'gerente'
  const isProfissional = user.role === 'profissional'

  // Fetch new leads count (unassigned)
  useEffect(() => {
    if (!accountId) return
    apiFetch(`/api/dashboard/stats?account_id=${accountId}&days=1`)
      .then((data: any) => setNewLeadsCount(data.leadsToday || 0))
      .catch(() => {})
  }, [accountId])

  // Listen for new leads via SSE
  useSSE('lead:created', () => setNewLeadsCount(prev => prev + 1))

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* Mobile hamburger */}
      <button className="hamburger-btn" onClick={() => setMobileOpen(true)}>
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#5CB8B2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/clin/logo.png" alt="Sheraos Clin" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>Sheraos Clin</div>
                  <div className="sidebar-subtitle">Massoterapia</div>
                </div>
              </div>
            </div>
            <button className="sidebar-close-btn" onClick={closeMobile}><X size={18} /></button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin && (
            <>
              <div className="nav-section">Admin</div>
              <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
                <LayoutDashboard size={16} /> Dashboard Global
              </NavLink>
              <NavLink to="/admin/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
                <Building2 size={16} /> Consultorios
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
                <UsersRound size={16} /> Usuarios
              </NavLink>
            </>
          )}

          {(isGerente || isAdmin) && <div className="nav-section">Gestao</div>}
          {(isGerente || isAdmin) && (
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
          )}
          <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
            <MessageCircle size={16} /> Chat
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
            <ListTodo size={16} /> Tarefas
            {taskCount > 0 && <span className="nav-badge" style={{ background: '#FF6B6B' }}>{taskCount > 99 ? '99+' : taskCount}</span>}
          </NavLink>
          <NavLink to="/pipeline" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
            <Kanban size={16} /> Pipeline
            {newLeadsCount > 0 && <span className="nav-badge">{newLeadsCount > 99 ? '99+' : newLeadsCount}</span>}
          </NavLink>
          <NavLink to="/leads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
            <Users size={16} /> Pacientes
          </NavLink>
          <NavLink to="/agenda" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
            <Calendar size={16} /> Agenda
          </NavLink>
          {(isGerente || isAdmin || isProfissional) && (
            <NavLink to="/anamnese" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
              <FileText size={16} /> Anamnese
            </NavLink>
          )}
          {(isGerente || isAdmin || !isProfissional) && (
            <NavLink to="/booking-links" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
              <Link size={16} /> Links de Agendamento
            </NavLink>
          )}
          {isProfissional && (
            <NavLink to="/meus-horarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}>
              <Clock size={16} /> Meus Horários
            </NavLink>
          )}

          {(isGerente || isAdmin) && (
            <>
              <div className="nav-section">Configuracoes</div>
              <NavLink to="/messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><MessageCircle size={16} /> Disparos</NavLink>
              <NavLink to="/team" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><UserCog size={16} /> Equipe</NavLink>
              <NavLink to="/funnels" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><GitBranch size={16} /> Funis</NavLink>
              <NavLink to="/integrations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><Plug size={16} /> Integracoes</NavLink>
              <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><Settings size={16} /> Configuracoes</NavLink>
              <div className="nav-section">Automacao</div>
              <NavLink to="/cadences" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><ListOrdered size={16} /> Cadencias</NavLink>
              <NavLink to="/ready-messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><MessageSquarePlus size={16} /> Msgs Prontas</NavLink>
              <NavLink to="/qualifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><ClipboardList size={16} /> Qualificacao</NavLink>
              <NavLink to="/launches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={closeMobile}><Rocket size={16} /> Lancamentos</NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div>
            <div className="sidebar-user">{user.name}</div>
            <div className="sidebar-role">{user.role === 'super_admin' ? 'Admin' : user.role === 'gerente' ? 'Gerente' : user.role === 'profissional' ? 'Profissional' : 'Atendente'}</div>
          </div>
          <button className="logout-btn" onClick={logout} title="Sair"><LogOut size={16} /></button>
        </div>
      </aside>
    </>
  )
}
