import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatPrice, formatDate, statusLabel, statusBadgeClass, paymentStatusBadge } from '../utils/helpers';
import PickupCode from '../components/PickupCode';
import './Profile.css';

const TABS = ['My Purchases', 'Payment Methods', 'Become a Seller'];

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [memberships, setMemberships] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState({ memberships: true, pm: true });
  const [showPickup, setShowPickup] = useState(null);
  const [addCardForm, setAddCardForm] = useState({ card_number: '', expiry: '', cvv: '' });
  const [addingCard, setAddingCard] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [sellerRequestSent, setSellerRequestSent] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [reviewForm, setReviewForm] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth/login'); return; }
    fetchMemberships();
    fetchPaymentMethods();
  }, [user]);

  async function fetchMemberships() {
    try { const r = await api.get('/users/me/memberships'); setMemberships(r.data); }
    catch {} finally { setLoading(l => ({ ...l, memberships: false })); }
  }

  async function fetchPaymentMethods() {
    try { const r = await api.get('/users/me/payment-methods'); setPaymentMethods(r.data); }
    catch {} finally { setLoading(l => ({ ...l, pm: false })); }
  }

  async function addCard(e) {
    e.preventDefault();
    setAddingCard(true);
    try {
      await api.post('/users/me/payment-methods', addCardForm);
      toast.success('Card added successfully');
      setShowAddCard(false);
      setAddCardForm({ card_number: '', expiry: '', cvv: '' });
      fetchPaymentMethods();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add card');
    } finally { setAddingCard(false); }
  }

  async function deleteCard(id) {
    if (!confirm('Remove this payment method?')) return;
    try {
      await api.delete(`/users/me/payment-methods/${id}`);
      toast.success('Card removed');
      fetchPaymentMethods();
    } catch { toast.error('Failed to remove card'); }
  }

  async function setDefaultCard(id) {
    try {
      await api.put(`/users/me/payment-methods/${id}/default`);
      fetchPaymentMethods();
    } catch { toast.error('Failed to set default'); }
  }

  async function submitSellerRequest() {
    setSendingRequest(true);
    try {
      await api.post('/users/me/seller-request');
      setSellerRequestSent(true);
      toast.success('Seller request submitted!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally { setSendingRequest(false); }
  }

  async function submitReview(e) {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post('/users/me/reviews', reviewForm);
      toast.success('Review submitted!');
      setReviewForm(null);
      fetchMemberships();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    } finally { setSubmittingReview(false); }
  }

  const groupedMemberships = {
    active: memberships.filter(m => m.group_status === 'active'),
    success: memberships.filter(m => m.payment_status === 'charged'),
    other: memberships.filter(m => !['active'].includes(m.group_status) && m.payment_status !== 'charged'),
  };

  return (
    <div className="page">
      <div className="container">
        <div className="profile-header">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <h1 className="profile-name">{user?.name}</h1>
            <div className="profile-email">{user?.email}</div>
            <span className={`badge ${user?.role === 'seller' ? 'badge-brand' : 'badge-neutral'}`}>{user?.role}</span>
          </div>
        </div>

        <div className="profile-tabs">
          {TABS.map((t, i) => (
            user?.role === 'seller' && i === 2 ? null :
            <button key={i} className={`profile-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>

        {/* MY PURCHASES */}
        {tab === 0 && (
          <div className="profile-section fade-in">
            {loading.memberships ? (
              <div className="memberships-grid">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />)}
              </div>
            ) : memberships.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <h3>No purchases yet</h3>
                <p>Browse groups and join your first group buy!</p>
                <button className="btn btn-primary" onClick={() => navigate('/groups')}>Browse Groups</button>
              </div>
            ) : (
              <>
                {groupedMemberships.success.length > 0 && (
                  <>
                    <h3 className="membership-section-title">✅ Ready for Pickup</h3>
                    <div className="memberships-grid">
                      {groupedMemberships.success.map(m => (
                        <MembershipCard
                          key={m.id} m={m}
                          onPickup={() => setShowPickup(showPickup === m.id ? null : m.id)}
                          showPickup={showPickup === m.id}
                          onReview={() => setReviewForm({ group_id: m.group_id, rating: 5, comment: '' })}
                        />
                      ))}
                    </div>
                  </>
                )}
                {groupedMemberships.active.length > 0 && (
                  <>
                    <h3 className="membership-section-title">⏳ Active Groups</h3>
                    <div className="memberships-grid">
                      {groupedMemberships.active.map(m => <MembershipCard key={m.id} m={m} />)}
                    </div>
                  </>
                )}
                {groupedMemberships.other.length > 0 && (
                  <>
                    <h3 className="membership-section-title">📁 Past</h3>
                    <div className="memberships-grid">
                      {groupedMemberships.other.map(m => <MembershipCard key={m.id} m={m} />)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* PAYMENT METHODS */}
        {tab === 1 && (
          <div className="profile-section fade-in">
            <div className="section-header">
              <h2 className="section-title">Payment Methods</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddCard(true)}>+ Add Card</button>
            </div>
            {loading.pm ? (
              <div className="pm-list">{[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}</div>
            ) : paymentMethods.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💳</div>
                <h3>No payment methods</h3>
                <p>Add a card to start joining groups</p>
              </div>
            ) : (
              <div className="pm-list">
                {paymentMethods.map(pm => (
                  <div key={pm.id} className={`pm-card card ${pm.is_default ? 'default' : ''}`}>
                    <div className="pm-card-left">
                      <span className="pm-card-icon">💳</span>
                      <div>
                        <div className="pm-card-name">{pm.card_type} •••• {pm.last4}</div>
                        <div className="pm-card-added">Added {formatDate(pm.created_at)}</div>
                      </div>
                      {pm.is_default && <span className="badge badge-brand">Default</span>}
                    </div>
                    <div className="pm-card-actions">
                      {!pm.is_default && <button className="btn btn-ghost btn-sm" onClick={() => setDefaultCard(pm.id)}>Set default</button>}
                      <button className="btn btn-ghost btn-sm danger-text" onClick={() => deleteCard(pm.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddCard && (
              <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddCard(false); }}>
                <div className="modal">
                  <div className="modal-header">
                    <h3>Add Payment Method</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCard(false)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <form id="add-card-form" onSubmit={addCard} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="form-group">
                        <label className="form-label">Card Number</label>
                        <input className="form-input" placeholder="4242 4242 4242 4242" value={addCardForm.card_number} onChange={e => setAddCardForm(f => ({ ...f, card_number: e.target.value.replace(/\s/g, '') }))} required maxLength={16} />
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Expiry</label>
                          <input className="form-input" placeholder="MM/YY" value={addCardForm.expiry} onChange={e => setAddCardForm(f => ({ ...f, expiry: e.target.value }))} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">CVV</label>
                          <input className="form-input" placeholder="123" value={addCardForm.cvv} onChange={e => setAddCardForm(f => ({ ...f, cvv: e.target.value }))} required maxLength={4} />
                        </div>
                      </div>
                      <div className="form-hint">🔒 Card is validated via Tranzila secure tokenization. We never store your raw card number.</div>
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline" onClick={() => setShowAddCard(false)}>Cancel</button>
                    <button type="submit" form="add-card-form" className="btn btn-primary" disabled={addingCard}>
                      {addingCard ? <><span className="spinner" />Validating…</> : 'Add Card'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BECOME A SELLER */}
        {tab === 2 && user?.role === 'buyer' && (
          <div className="profile-section fade-in">
            <div className="become-seller-card card">
              <div className="become-seller-icon">🏪</div>
              <h2>Become a Seller on Bundl</h2>
              <p>Create group buys for products you source at wholesale prices. Reach thousands of buyers and build your store.</p>
              <ul className="become-seller-perks">
                <li>✅ Create unlimited group buys</li>
                <li>✅ Analytics dashboard for your groups</li>
                <li>✅ Verified seller badge</li>
                <li>✅ Manage your product catalog</li>
              </ul>
              {sellerRequestSent ? (
                <div className="seller-request-sent">
                  <span>🎉</span> Request submitted! An admin will review your account.
                </div>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={submitSellerRequest} disabled={sendingRequest}>
                  {sendingRequest ? <><span className="spinner" />Submitting…</> : 'Request Seller Access'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReviewForm(null); }}>
          <div className="modal">
            <div className="modal-header"><h3>Rate this seller</h3><button className="btn btn-ghost btn-sm" onClick={() => setReviewForm(null)}>✕</button></div>
            <div className="modal-body">
              <form id="review-form" onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Rating</label>
                  <div className="star-rating">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" className={`star-btn ${reviewForm.rating >= s ? 'active' : ''}`} onClick={() => setReviewForm(f => ({ ...f, rating: s }))}>★</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Comment (optional)</label>
                  <textarea className="form-input" rows={3} placeholder="How was your pickup experience?" value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setReviewForm(null)}>Cancel</button>
              <button type="submit" form="review-form" className="btn btn-primary" disabled={submittingReview}>
                {submittingReview ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MembershipCard({ m, onPickup, showPickup, onReview }) {
  const snap = m.product_snapshot || {};
  return (
    <div className="membership-card card">
      <div className="membership-card-inner">
        <img src={snap.image_url} alt={snap.name} className="membership-img" />
        <div className="membership-info">
          <div className="membership-brand">{snap.brand}</div>
          <div className="membership-name">{snap.name}</div>
          <div className="membership-meta">
            <span className={`badge ${statusBadgeClass(m.group_status)}`}>{statusLabel(m.group_status)}</span>
            <span className={`badge ${paymentStatusBadge(m.payment_status)}`}>{m.payment_status}</span>
          </div>
          <div className="membership-details">
            <span>by {m.seller_name}</span>
            <span>{formatPrice(m.price)}</span>
          </div>
        </div>
      </div>
      {m.pickup_code && (
        <div className="membership-actions">
          <button className="btn btn-primary btn-sm" onClick={onPickup}>
            {showPickup ? 'Hide Code' : '🎁 Show Pickup Code'}
          </button>
          {onReview && <button className="btn btn-outline btn-sm" onClick={onReview}>★ Rate Seller</button>}
        </div>
      )}
      {showPickup && m.pickup_code && (
        <div style={{ marginTop: 16 }}>
          <PickupCode membershipId={m.id} code={m.pickup_code} />
        </div>
      )}
    </div>
  );
}
