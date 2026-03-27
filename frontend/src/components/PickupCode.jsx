import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import './PickupCode.css';

export default function PickupCode({ membershipId, code }) {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/users/me/memberships/${membershipId}/qr`)
      .then((res) => setQr(res.data.qr))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [membershipId]);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="pickup-code-card">
      <div className="pickup-code-header">
        <div className="pickup-code-icon">🎁</div>
        <div>
          <h4>Your Pickup Code</h4>
          <p>Show this at pickup — seller will scan or enter the code</p>
        </div>
      </div>

      <div className="pickup-qr-wrap">
        {loading ? (
          <div className="qr-skeleton skeleton" style={{ width: 160, height: 160, borderRadius: 8 }} />
        ) : qr ? (
          <img src={qr} alt="QR pickup code" className="pickup-qr" />
        ) : (
          <div className="qr-fallback">QR unavailable</div>
        )}
      </div>

      <div className="pickup-code-alphanumeric">
        <div className="pickup-code-chars">
          {code.split('').map((char, i) => (
            <span key={i} className="pickup-char">{char}</span>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={copyCode}>
          {copied ? '✓ Copied' : 'Copy code'}
        </button>
      </div>
    </div>
  );
}
