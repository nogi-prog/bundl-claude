export function formatPrice(amount) {
  return `₪${Number(amount).toLocaleString('he-IL')}`;
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  if (h > 0) return `${h}h left`;
  const m = Math.floor(diff / 60000);
  return `${m}m left`;
}

export function isLastChance(group) {
  const hoursLeft = (new Date(group.expires_at) - new Date()) / 3600000;
  const spotsLeft = group.target_buyers - group.current_buyers;
  return hoursLeft < 48 || spotsLeft < 5;
}

export function progressPct(current, target) {
  return Math.min(100, Math.round((current / target) * 100));
}

export function statusLabel(status) {
  const map = {
    active: 'Active',
    processing_payment: 'Processing',
    pending_seller_decision: 'Awaiting Decision',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export function statusBadgeClass(status) {
  const map = {
    active: 'badge-active',
    processing_payment: 'badge-info',
    pending_seller_decision: 'badge-warning',
    completed: 'badge-active',
    cancelled: 'badge-danger',
  };
  return map[status] || 'badge-neutral';
}

export function paymentStatusBadge(status) {
  const map = {
    pending: 'badge-neutral',
    charged: 'badge-active',
    failed: 'badge-danger',
    refunded: 'badge-info',
  };
  return map[status] || 'badge-neutral';
}
