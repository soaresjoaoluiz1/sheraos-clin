import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await login(email, password) }
    catch (err: any) { setError(err.message || 'Erro ao fazer login') }
    finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <img src="/clin/logo.png" alt="Sheraos Clin" style={{ height: 60 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
        <h1>Sheraos Clin</h1>
        <div className="subtitle">Sistema de gestao para consultorios</div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-group"><label>Email</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label>Senha</label><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
