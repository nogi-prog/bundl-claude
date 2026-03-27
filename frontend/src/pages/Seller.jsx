import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatPrice, formatDate, timeLeft, progressPct, statusLabel, statusBadgeClass } from '../utils/helpers';
import './Seller.css';

const TABS = ['My Groups', 'Create Group', 'Catalog'];

export default function Seller() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [groups, setGroups] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState({ groups: true, catalog: true });
  const [decisionGroupId, setDecisionGroupId] = useState(null);
  const [processingDecision, setProcessingDecision] = useState(false);

  const [createForm, setCreateForm] = useState({
    product_id: '', price: '', target_buyers: '', expires_at: '', pickup_location: '', pickup_hours: ''
  });
  const [creating, setCreating] = useState(false);
  const [suggestForm, setSuggestForm] = useState({ name: '', brand: '', category: '', image_url: '', description: '' });
  const [suggesting, setSuggesting] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'seller') { navigate('/'); return; }
    fetchGroups();
    fetchCatalog();
    api.get('/catalog/categories').then(r => setCategories(r.data)).catch(() => {});
  }, [user]);

  async function fetchGroups() {
    try { const r = await api.get('/groups/seller/my'); setGroups(r.data); }
    catch {} finally { setLoading(l => ({ ...l, groups: false })); }
  }

  async function fetchCatalog() {
    try { const r = await api.get('/catalog'); setCatalog(r.data); }
    catch {} finally { setLoading(l => ({ ...l, catalog: false })); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/groups', createForm);
      toast.success('Group created!');
      setCreateForm({ product_id: '', price: '', target_buyers: '', expires_at: '', pickup_location: '', pickup_hours: '' });
      setTab(0);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    } finally { setCreating(false); }
  }

  async function handleDecision(groupId, decision) {
    setProcessingDecision(true);
    try {
      await api.post(`/groups/${groupId}/decision`, { decision });
      toast.success(decision === 'accept_partial' ? 'Group completed with partial buyers' : 'Group reopened for remaining spots');
      setDecisionGroupId(null);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process decision');
    } finally { setProcessingDecision(false); }
  }

  async function handleSuggest(e) {
    e.preventDefault();
    setSuggesting(true);
    try {
      await api.post('/catalog/suggest', suggestForm);
      toast.success('Product suggested! Admin will review it.');
      setShowSuggest(false);
      setSuggestForm({ name: '', brand: '', category: '', image_url: '', description: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to suggest product');
    } finally { setSuggesting(false); }
  }

  const pendingDecision = groups.filter(g => g.status === 'pending_seller_decision');

  return (
    <div className="page">
      <div className="container">
        <div className="seller-header">
          <div>
            <h1 className="seller-title">Seller Dashboard</h1>
            <p className="seller-sub">Welcome back, {user?.name}</p>
          </div>
          <div className="seller-stats">
            <div className="seller-stat">
              <div className="seller-stat-value">{groups.filter(g => g.status === 'active').length}</div>
              <div className="seller-stat-label">Active</div>
            </div>
            <div className="seller-stat">
              <div className="seller-stat-value">{groups.filter(g => g.status === 'completed').length}</div>
              <div className="seller-stat-label">Completed</div>
            </div>
            <div className="seller-stat accent">
              <div className="seller-stat-value">{formatPrice(groups.filter(g => g.status === 'completed').reduce((sum, g) => sum + parseFloat(g.price) * parseInt(g.member_count || 0), 0))}</div>
              <div className="seller-stat-label">Total Revenue</div>
            </div>
          </div>
        </div>

        {/* Pending decision alert */}
        {pendingDecision.length > 0 && (
          <div className="seller-alert">
            <span>⚠️</span>
            <div>
              <strong>{pendingDecision.length} group{pendingDecision.length > 1 ? 's' : ''} need{pendingDecision.length === 1 ? 's' : ''} your decision</strong>
              <p>Some payments failed. Choose to proceed with partial group or reopen the spots.</p>
            </div>
          </div>
        )}

        <div className="profile-tabs">
          {TABS.map((t, i) => <button key={i} className={`profile-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>)}
        </div>

        {/* MY GROUPS */}
        {tab === 0 && (
          <div className="fade-in">
            {loading.groups ? (
              <div className="seller-groups-list">{[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}</div>
            ) : groups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No groups yet</h3>
                <p>Create your first group buy to start selling</p>
                <button className="btn btn-primary" onClick={() => setTab(1)}>Create Group</button>
              </div>
            ) : (
              <div className="seller-groups-list">
                {groups.map(g => (
                  <SellerGroupRow
                    key={g.id} group={g}
                    onDecision={() => setDecisionGroupId(g.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* CREATE GROUP */}
        {tab === 1 && (
          <div className="create-group-wrap fade-in">
            <div className="create-group-card card">
              <h2 className="create-title">Create a Group Buy</h2>
              <form onSubmit={handleCreate} className="create-form">
                <div className="form-group">
                  <label className="form-label">Product from catalog *</label>
                  <select className="form-input" value={createForm.product_id} onChange={e => setCreateForm(f => ({ ...f, product_id: e.target.value }))} required>
                    <option value="">Select a product…</option>
                    {catalog.map(p => <option key={p.id} value={p.id}>{p.name} — {p.brand}</option>)}
                  </select>
                  <span className="form-hint">
                    Product not in catalog? <button type="button" className="link-btn" onClick={() => setShowSuggest(true)}>Suggest a new product</button>
                  </span>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Group price (₪) *</label>
                    <input className="form-input" type="number" min="1" step="0.01" placeholder="2999" value={createForm.price} onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target buyers *</label>
                    <input className="form-input" type="number" min="2" max="500" placeholder="10" value={createForm.target_buyers} onChange={e => setCreateForm(f => ({ ...f, target_buyers: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Expiration date *</label>
                  <input className="form-input" type="datetime-local" value={createForm.expires_at} onChange={e => setCreateForm(f => ({ ...f, expires_at: e.target.value }))} required min={new Date(Date.now() + 86400000).toISOString().slice(0, 16)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup location</label>
                  <input className="form-input" placeholder="Tel Aviv – Dizengoff Center" value={createForm.pickup_location} onChange={e => setCreateForm(f => ({ ...f, pickup_location: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup hours</label>
                  <input className="form-input" placeholder="Sun–Thu 10:00–20:00" value={createForm.pickup_hours} onChange={e => setCreateForm(f => ({ ...f, pickup_hours: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary btn-lg" disabled={creating}>
                  {creating ? <><span className="spinner" />Creating…</> : 'Create Group Buy'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CATALOG */}
        {tab === 2 && (
          <div className="fade-in">
            <div className="section-header">
              <h2 className="section-title">Product Catalog</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowSuggest(true)}>+ Suggest Product</button>
            </div>
            <div className="catalog-grid">
              {catalog.map(p => (
                <div key={p.id} className="catalog-item card">
                  <img src={p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200'} alt={p.name} className="catalog-img" />
                  <div className="catalog-info">
                    <div className="catalog-brand">{p.brand}</div>
                    <div className="catalog-name">{p.name}</div>
                    <div className="catalog-category">{p.category}</div>
                    <button className="btn btn-outline btn-sm" onClick={() => { setCreateForm(f => ({ ...f, product_id: p.id })); setTab(1); }}>Use in Group</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seller decision modal */}
      {decisionGroupId && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDecisionGroupId(null); }}>
          <div className="modal">
            <div className="modal-header"><h3>Payment Decision Required</h3><button className="btn btn-ghost btn-sm" onClick={() => setDecisionGroupId(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{ color: 'var(--ink-3)', marginBottom: 20 }}>Some buyers' payments failed. How would you like to proceed?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="decision-option" onClick={() => !processingDecision && handleDecision(decisionGroupId, 'accept_partial')}>
                  <div className="decision-icon">✅</div>
                  <div>
                    <div className="decision-title">Accept Partial Group</div>
                    <div className="decision-desc">Proceed with buyers whose payments succeeded. Group is marked completed.</div>
                  </div>
                </div>
                <div className="decision-option" onClick={() => !processingDecision && handleDecision(decisionGroupId, 'reopen')}>
                  <div className="decision-icon">🔄</div>
                  <div>
                    <div className="decision-title">Reopen Group</div>
                    <div className="decision-desc">Remove failed buyers and re-list the missing spots for 7 more days.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggest product modal */}
      {showSuggest && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSuggest(false); }}>
          <div className="modal">
            <div className="modal-header"><h3>Suggest a New Product</h3><button className="btn btn-ghost btn-sm" onClick={() => setShowSuggest(false)}>✕</button></div>
            <div className="modal-body">
              <form id="suggest-form" onSubmit={handleSuggest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Product name *</label>
                    <input className="form-input" placeholder="iPhone 16 Pro" value={suggestForm.name} onChange={e => setSuggestForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Brand</label>
                    <input className="form-input" placeholder="Apple" value={suggestForm.brand} onChange={e => setSuggestForm(f => ({ ...f, brand: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-input" value={suggestForm.category} onChange={e => setSuggestForm(f => ({ ...f, category: e.target.value }))} required>
                    <option value="">Select category…</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Image URL</label>
                  <input className="form-input" placeholder="https://…" value={suggestForm.image_url} onChange={e => setSuggestForm(f => ({ ...f, image_url: e.target.value }))} type="url" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={3} value={suggestForm.description} onChange={e => setSuggestForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-hint">Once an admin approves this product, you'll be able to create a group buy with it.</div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSuggest(false)}>Cancel</button>
              <button type="submit" form="suggest-form" className="btn btn-primary" disabled={suggesting}>{suggesting ? 'Submitting…' : 'Submit Suggestion'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SellerGroupRow({ group, onDecision }) {
  const snap = group.product_snapshot || {};
  const pct = progressPct(group.current_buyers, group.target_buyers);
  const isPending = group.status === 'pending_seller_decision';

  return (
    <div className={`seller-group-row card ${isPending ? 'pending-decision' : ''}`}>
      <img src={snap.image_url} alt={snap.name} className="seller-group-img" />
      <div className="seller-group-info">
        <div className="seller-group-name">{snap.name}</div>
        <div className="seller-group-meta">
          <span className={`badge ${statusBadgeClass(group.status)}`}>{statusLabel(group.status)}</span>
          <span className="seller-group-time">{timeLeft(group.expires_at)}</span>
        </div>
        <div className="seller-group-progress">
          <div className="progress-wrap" style={{ height: 6 }}>
            <div className={`progress-bar ${pct >= 100 ? 'full' : pct >= 80 ? 'almost' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-text">{group.current_buyers}/{group.target_buyers} buyers ({pct}%)</span>
        </div>
      </div>
      <div className="seller-group-right">
        <div className="seller-group-price">{formatPrice(group.price)}</div>
        <div className="seller-group-revenue">Revenue: {formatPrice(parseFloat(group.price) * parseInt(group.member_count || 0))}</div>
        <div className="seller-group-actions">
          <Link to={`/groups/${group.id}`} className="btn btn-outline btn-sm">View</Link>
          {isPending && <button className="btn btn-primary btn-sm" onClick={onDecision}>⚠️ Decide</button>}
        </div>
      </div>
    </div>
  );
}
