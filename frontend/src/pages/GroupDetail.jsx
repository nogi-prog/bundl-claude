import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatPrice, timeLeft, progressPct, statusLabel, statusBadgeClass } from '../utils/helpers';
import './GroupDetail.css';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuth } = useAuth();
  const toast = useToast();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [membership, setMembership] = useState(null);
  const [selectedPm, setSelectedPm] = useState('');
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    fetchGroup();
    if (isAuth) { fetchPaymentMethods(); fetchMyMembership(); }
  }, [id, isAuth]);

  async function fetchGroup() {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data);
    } catch { navigate('/groups'); }
    finally { setLoading(false); }
  }

  async function fetchPaymentMethods() {
    try { const res = await api.get('/users/me/payment-methods'); setPaymentMethods(res.data); setSelectedPm(res.data.find(p => p.is_default)?.id || res.data[0]?.id || ''); } catch {}
  }

  async function fetchMyMembership() {
    try {
      const res = await api.get('/users/me/memberships');
      const m = res.data.find(m => m.group_id === id);
      setMembership(m || null);
    } catch {}
  }

  async function handleJoin() {
    if (!selectedPm) { toast.error('Please select a payment method'); return; }
    setJoining(true);
    try {
      await api.post(`/groups/${id}/join`, { payment_method_id: selectedPm });
      toast.success('You joined the group buy! 🎉');
      setShowJoinModal(false);
      fetchGroup();
      fetchMyMembership();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join');
    } finally { setJoining(false); }
  }

  async function handleLeave() {
    if (!confirm('Are you sure you want to leave this group?')) return;
    setLeaving(true);
    try {
      await api.delete(`/groups/${id}/leave`);
      toast.success('You left the group');
      setMembership(null);
      fetchGroup();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot leave this group');
    } finally { setLeaving(false); }
  }

  if (loading) return <div className="page"><div className="container"><div className="detail-skeleton"><div className="skeleton" style={{ height: 400, borderRadius: 16 }} /></div></div></div>;
  if (!group) return null;

  const snap = group.product_snapshot || {};
  const pct = progressPct(group.current_buyers, group.target_buyers);
  const spotsLeft = group.target_buyers - group.current_buyers;
  const isMember = !!membership;
  const isOwner = user?.id === group.seller_id;
  const canJoin = !isMember && !isOwner && group.status === 'active' && spotsLeft > 0;

  return (
    <div className="page">
      <div className="container">
        <div className="detail-layout">
          {/* Left: Product info */}
          <div className="detail-main">
            <div className="detail-image-wrap">
              <img src={snap.image_url} alt={snap.name} className="detail-image" />
            </div>
            <div className="detail-product-info">
              <span className="detail-brand">{snap.brand}</span>
              <h1 className="detail-name">{snap.name}</h1>
              <p className="detail-description">{snap.description}</p>
              <div className="detail-meta">
                <div className="meta-item"><span className="meta-label">Category</span><span className="meta-value">{snap.category}</span></div>
                <div className="meta-item"><span className="meta-label">Pickup</span><span className="meta-value">{group.pickup_location}</span></div>
                <div className="meta-item"><span className="meta-label">Hours</span><span className="meta-value">{group.pickup_hours}</span></div>
                <div className="meta-item">
                  <span className="meta-label">Seller</span>
                  <span className="meta-value">
                    {group.seller_name}
                    {group.seller_rating && <span className="inline-rating"> ★ {parseFloat(group.seller_rating).toFixed(1)} ({group.seller_reviews})</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Buy box */}
          <div className="detail-sidebar">
            <div className="buy-box card">
              <div className="buy-box-status">
                <span className={`badge ${statusBadgeClass(group.status)}`}>{statusLabel(group.status)}</span>
                <span className="buy-box-timer">{timeLeft(group.expires_at)}</span>
              </div>

              <div className="buy-box-price">{formatPrice(group.price)}</div>
              <div className="buy-box-price-sub">per person · wholesale price</div>

              <div className="buy-box-progress">
                <div className="progress-wrap" style={{ height: 12 }}>
                  <div className={`progress-bar ${pct >= 100 ? 'full' : pct >= 80 ? 'almost' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="progress-stats">
                  <div className="progress-stat">
                    <div className="progress-stat-value">{group.current_buyers}</div>
                    <div className="progress-stat-label">Joined</div>
                  </div>
                  <div className="progress-stat center">
                    <div className="progress-stat-value">{spotsLeft}</div>
                    <div className="progress-stat-label">Spots left</div>
                  </div>
                  <div className="progress-stat right">
                    <div className="progress-stat-value">{group.target_buyers}</div>
                    <div className="progress-stat-label">Target</div>
                  </div>
                </div>
              </div>

              {/* Member badge */}
              {isMember && (
                <div className={`member-banner ${membership.payment_status === 'charged' ? 'success' : ''}`}>
                  {membership.payment_status === 'charged' ? '🎉 You\'re in! Payment charged.' : '✓ You\'re in this group buy'}
                </div>
              )}

              {/* CTA */}
              {canJoin && isAuth && (
                <button className="btn btn-primary btn-full btn-lg" onClick={() => setShowJoinModal(true)}>
                  Join Group Buy
                </button>
              )}
              {canJoin && !isAuth && (
                <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/auth/login')}>
                  Log in to Join
                </button>
              )}
              {isMember && group.status === 'active' && (
                <button className="btn btn-outline btn-full" onClick={handleLeave} disabled={leaving}>
                  {leaving ? 'Leaving…' : 'Leave Group'}
                </button>
              )}
              {isOwner && (
                <div className="owner-badge">👑 You created this group</div>
              )}
              {group.status === 'completed' && !isMember && (
                <div className="status-info">This group buy has completed.</div>
              )}
              {group.status === 'cancelled' && (
                <div className="status-info danger">This group was cancelled.</div>
              )}

              <div className="buy-box-guarantees">
                <div className="guarantee"><span>🔒</span> Card validated, only charged if target is met</div>
                <div className="guarantee"><span>↩️</span> Full refund if group doesn't reach target</div>
                <div className="guarantee"><span>🏪</span> Pickup at {group.pickup_location}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Join modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowJoinModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Join Group Buy</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowJoinModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="join-summary">
                <img src={snap.image_url} alt={snap.name} />
                <div>
                  <div className="join-product">{snap.name}</div>
                  <div className="join-price">{formatPrice(group.price)}</div>
                </div>
              </div>

              <div className="divider" />

              {paymentMethods.length === 0 ? (
                <div className="no-payment">
                  <p>You need a payment method to join.</p>
                  <button className="btn btn-outline btn-sm" onClick={() => navigate('/profile')}>Add Payment Method</button>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Pay with</label>
                  {paymentMethods.map((pm) => (
                    <label key={pm.id} className={`pm-option ${selectedPm === pm.id ? 'selected' : ''}`}>
                      <input type="radio" name="pm" value={pm.id} checked={selectedPm === pm.id} onChange={() => setSelectedPm(pm.id)} />
                      <span className="pm-icon">{pm.card_type === 'Visa' ? '💳' : '💳'}</span>
                      <span>{pm.card_type} •••• {pm.last4}</span>
                      {pm.is_default && <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>Default</span>}
                    </label>
                  ))}
                </div>
              )}

              <div className="join-notice">
                <strong>Note:</strong> Your card will be validated now but only charged once the group reaches {group.target_buyers} buyers.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleJoin} disabled={joining || !selectedPm}>
                {joining ? <><span className="spinner" />Joining…</> : `Confirm — ${formatPrice(group.price)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
