import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatPrice, formatDate } from '../utils/helpers';
import './Admin.css';

const TABS = ['Overview', 'Users', 'Seller Requests', 'Catalog Suggestions'];

export default function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [sellerRequests, setSellerRequests] = useState([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState([]);
  const [loading, setLoading] = useState({ stats: true, users: true, sellers: true, catalog: true });
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    fetchStats();
    fetchUsers();
    fetchSellerRequests();
    fetchCatalogSuggestions();
  }, [user]);

  async function fetchStats() {
    try { const r = await api.get('/admin/stats'); setStats(r.data); }
    catch {} finally { setLoading(l => ({ ...l, stats: false })); }
  }
  async function fetchUsers() {
    try { const r = await api.get('/admin/users', { params: { search: userSearch, role: userRole } }); setUsers(r.data); }
    catch {} finally { setLoading(l => ({ ...l, users: false })); }
  }
  async function fetchSellerRequests() {
    try { const r = await api.get('/admin/seller-requests'); setSellerRequests(r.data); }
    catch {} finally { setLoading(l => ({ ...l, sellers: false })); }
  }
  async function fetchCatalogSuggestions() {
    try { const r = await api.get('/admin/catalog-suggestions'); setCatalogSuggestions(r.data); }
    catch {} finally { setLoading(l => ({ ...l, catalog: false })); }
  }

  useEffect(() => { if (tab === 1) fetchUsers(); }, [userSearch, userRole]);

  async function freezeUser(id) {
    try { await api.put(`/admin/users/${id}/freeze`); toast.success('User frozen'); fetchUsers(); } catch { toast.error('Failed'); }
  }
  async function unfreezeUser(id) {
    try { await api.put(`/admin/users/${id}/unfreeze`); toast.success('User unfrozen'); fetchUsers(); } catch { toast.error('Failed'); }
  }
  async function deleteUser(id) {
    if (!confirm('Delete this user? This is irreversible.')) return;
    try { await api.delete(`/admin/users/${id}`); toast.success('User deleted'); fetchUsers(); } catch { toast.error('Failed'); }
  }
  async function approveSeller(id) {
    try { await api.post(`/admin/seller-requests/${id}/approve`); toast.success('Seller approved!'); fetchSellerRequests(); fetchUsers(); } catch { toast.error('Failed'); }
  }
  async function rejectSeller(id) {
    try { await api.post(`/admin/seller-requests/${id}/reject`); toast.success('Request rejected'); fetchSellerRequests(); } catch { toast.error('Failed'); }
  }
  async function approveProduct(id) {
    try { await api.post(`/admin/catalog-suggestions/${id}/approve`); toast.success('Product approved and live!'); fetchCatalogSuggestions(); } catch { toast.error('Failed'); }
  }
  async function rejectProduct(id) {
    try { await api.post(`/admin/catalog-suggestions/${id}/reject`); toast.success('Product rejected'); fetchCatalogSuggestions(); } catch { toast.error('Failed'); }
  }

  const groupStatusMap = {};
  (stats?.groups_by_status || []).forEach(g => { groupStatusMap[g.status] = parseInt(g.count); });

  return (
    <div className="page">
      <div className="container">
        <div className="admin-header">
          <h1 className="admin-title">Admin Panel</h1>
          <div className="admin-badges">
            {sellerRequests.length > 0 && <span className="badge badge-warning">{sellerRequests.length} seller request{sellerRequests.length > 1 ? 's' : ''}</span>}
            {catalogSuggestions.length > 0 && <span className="badge badge-info">{catalogSuggestions.length} catalog suggestion{catalogSuggestions.length > 1 ? 's' : ''}</span>}
          </div>
        </div>

        <div className="profile-tabs">
          {TABS.map((t, i) => (
            <button key={i} className={`profile-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
              {t}
              {i === 2 && sellerRequests.length > 0 && <span className="tab-dot" />}
              {i === 3 && catalogSuggestions.length > 0 && <span className="tab-dot" />}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 0 && (
          <div className="fade-in">
            <div className="admin-stats-grid">
              <StatCard icon="👥" label="Total Users" value={stats?.total_users ?? '—'} loading={loading.stats} />
              <StatCard icon="💰" label="Total Revenue" value={stats ? formatPrice(stats.total_revenue) : '—'} loading={loading.stats} accent />
              <StatCard icon="📦" label="Active Groups" value={groupStatusMap['active'] ?? 0} loading={loading.stats} />
              <StatCard icon="✅" label="Completed Groups" value={groupStatusMap['completed'] ?? 0} loading={loading.stats} />
              <StatCard icon="⏳" label="Pending Sellers" value={stats?.pending_seller_requests ?? 0} loading={loading.stats} warn />
              <StatCard icon="❌" label="Cancelled Groups" value={groupStatusMap['cancelled'] ?? 0} loading={loading.stats} />
            </div>

            <h2 className="section-title" style={{ marginTop: 40, marginBottom: 20 }}>Group Status Breakdown</h2>
            <div className="status-breakdown">
              {Object.entries(groupStatusMap).map(([status, count]) => (
                <div key={status} className="status-breakdown-row">
                  <span className="status-breakdown-label">{status.replace(/_/g, ' ')}</span>
                  <div className="status-breakdown-bar-wrap">
                    <div className="status-breakdown-bar" style={{ width: `${Math.min(100, (count / Math.max(...Object.values(groupStatusMap), 1)) * 100)}%` }} />
                  </div>
                  <span className="status-breakdown-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === 1 && (
          <div className="fade-in">
            <div className="admin-filters">
              <input className="form-input" placeholder="Search users…" value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ maxWidth: 280 }} />
              <select className="form-input" value={userRole} onChange={e => setUserRole(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="">All roles</option>
                <option value="buyer">Buyers</option>
                <option value="seller">Sellers</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            {loading.users ? (
              <div className="admin-table-skeleton">{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}</div>
            ) : (
              <div className="admin-table">
                <div className="admin-table-header">
                  <span>User</span><span>Role</span><span>Status</span><span>Joined</span><span>Actions</span>
                </div>
                {users.map(u => (
                  <div key={u.id} className="admin-table-row">
                    <div className="admin-user-cell">
                      <div className="admin-avatar">{u.name[0]}</div>
                      <div><div className="admin-user-name">{u.name}</div><div className="admin-user-email">{u.email}</div></div>
                    </div>
                    <span><span className={`badge ${u.role === 'admin' ? 'badge-brand' : u.role === 'seller' ? 'badge-info' : 'badge-neutral'}`}>{u.role}</span></span>
                    <span><span className={`badge ${u.status === 'active' ? 'badge-active' : 'badge-danger'}`}>{u.status}</span></span>
                    <span className="admin-date">{formatDate(u.created_at)}</span>
                    <div className="admin-row-actions">
                      {u.role !== 'admin' && (
                        <>
                          {u.status === 'active'
                            ? <button className="btn btn-outline btn-sm" onClick={() => freezeUser(u.id)}>Freeze</button>
                            : <button className="btn btn-success btn-sm" onClick={() => unfreezeUser(u.id)}>Unfreeze</button>}
                          <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="empty-state" style={{ padding: '40px 0' }}><p>No users found</p></div>}
              </div>
            )}
          </div>
        )}

        {/* SELLER REQUESTS */}
        {tab === 2 && (
          <div className="fade-in">
            <h2 className="section-title" style={{ marginBottom: 20 }}>Pending Seller Requests</h2>
            {loading.sellers ? (
              <div className="admin-table-skeleton">{[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}</div>
            ) : sellerRequests.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🎉</div><h3>No pending requests</h3></div>
            ) : (
              <div className="admin-request-list">
                {sellerRequests.map(r => (
                  <div key={r.id} className="admin-request-card card">
                    <div className="admin-avatar large">{r.name[0]}</div>
                    <div className="request-info">
                      <div className="request-name">{r.name}</div>
                      <div className="request-email">{r.email}</div>
                      <div className="request-date">Requested {formatDate(r.created_at)}</div>
                    </div>
                    <div className="request-actions">
                      <button className="btn btn-success" onClick={() => approveSeller(r.id)}>✓ Approve</button>
                      <button className="btn btn-danger" onClick={() => rejectSeller(r.id)}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CATALOG SUGGESTIONS */}
        {tab === 3 && (
          <div className="fade-in">
            <h2 className="section-title" style={{ marginBottom: 20 }}>Catalog Suggestions</h2>
            {loading.catalog ? (
              <div className="catalog-suggestion-grid">{[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />)}</div>
            ) : catalogSuggestions.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📚</div><h3>No pending suggestions</h3></div>
            ) : (
              <div className="catalog-suggestion-grid">
                {catalogSuggestions.map(p => (
                  <div key={p.id} className="suggestion-card card">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="suggestion-img" />}
                    <div className="suggestion-body">
                      <div className="suggestion-brand">{p.brand}</div>
                      <div className="suggestion-name">{p.name}</div>
                      <div className="suggestion-category">{p.category}</div>
                      {p.description && <div className="suggestion-desc">{p.description}</div>}
                      <div className="suggestion-by">Suggested by {p.suggested_by_name}</div>
                      <div className="suggestion-actions">
                        <button className="btn btn-success btn-sm" onClick={() => approveProduct(p.id)}>✓ Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => rejectProduct(p.id)}>✕ Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, loading, accent, warn }) {
  return (
    <div className={`stat-card card ${accent ? 'accent' : warn ? 'warn' : ''}`}>
      {loading ? <div className="skeleton" style={{ height: 60 }} /> : (
        <>
          <div className="stat-card-icon">{icon}</div>
          <div className="stat-card-value">{value}</div>
          <div className="stat-card-label">{label}</div>
        </>
      )}
    </div>
  );
}
