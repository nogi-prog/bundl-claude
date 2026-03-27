import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './Auth.css';

export default function Auth() {
  const { mode } = useParams(); // 'login' or 'register'
  const isLogin = mode !== 'register';
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin ? { email: form.email, password: form.password } : form;
      const res = await api.post(endpoint, payload);
      login(res.data.token, res.data.user);
      toast.success(isLogin ? 'Welcome back!' : 'Account created!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // Quick demo logins
  const demoAccounts = [
    { label: 'Admin', email: 'admin@bundl.app', password: 'password123' },
    { label: 'Seller', email: 'tech_seller@bundl.app', password: 'password123' },
    { label: 'Buyer', email: 'buyer1@bundl.app', password: 'password123' },
  ];

  async function quickLogin(account) {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', account);
      login(res.data.token, res.data.user);
      toast.success(`Logged in as ${account.label}`);
      navigate('/');
    } catch { toast.error('Quick login failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">Bundl<span style={{ color: 'var(--brand)' }}>.</span></div>
        <h2 className="auth-title">{isLogin ? 'Welcome back' : 'Create account'}</h2>
        <p className="auth-sub">{isLogin ? 'Log in to your Bundl account' : 'Join Bundl and start saving together'}</p>

        {isLogin && (
          <div className="demo-accounts">
            <div className="demo-label">Quick demo login</div>
            <div className="demo-btns">
              {demoAccounts.map((a) => (
                <button key={a.label} className="btn btn-outline btn-sm" onClick={() => quickLogin(a)} disabled={loading}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="form-input" type="text" placeholder="Alice Cohen" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="alice@example.com" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setField('password', e.target.value)} required minLength={6} />
          </div>
          {error && <div className="form-error auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" />{isLogin ? 'Logging in…' : 'Creating account…'}</> : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? <>Don't have an account? <Link to="/auth/register">Sign up</Link></> : <>Already have an account? <Link to="/auth/login">Log in</Link></>}
        </div>
      </div>
    </div>
  );
}
