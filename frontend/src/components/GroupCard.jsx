import React from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, timeLeft, progressPct, isLastChance } from '../utils/helpers';
import './GroupCard.css';

export default function GroupCard({ group }) {
  const pct = progressPct(group.current_buyers, group.target_buyers);
  const snap = group.product_snapshot || {};
  const lastChance = isLastChance(group);
  const spotsLeft = group.target_buyers - group.current_buyers;

  return (
    <Link to={`/groups/${group.id}`} className="group-card fade-in">
      <div className="group-card-image">
        <img src={snap.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'} alt={snap.name} loading="lazy" />
        <div className="group-card-badges">
          {lastChance && <span className="badge badge-warning">⚡ Last chance</span>}
          {spotsLeft === 1 && <span className="badge badge-danger">1 spot left!</span>}
        </div>
        <div className="group-card-category">{snap.category}</div>
      </div>

      <div className="group-card-body">
        <div className="group-card-brand">{snap.brand}</div>
        <h3 className="group-card-name">{snap.name}</h3>

        <div className="group-card-price">
          <span className="price-amount">{formatPrice(group.price)}</span>
          <span className="price-label">group price</span>
        </div>

        <div className="group-card-progress">
          <div className="progress-wrap">
            <div
              className={`progress-bar ${pct >= 100 ? 'full' : pct >= 80 ? 'almost' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="progress-meta">
            <span className="progress-count">
              <strong>{group.current_buyers}</strong>/{group.target_buyers} buyers
            </span>
            <span className="progress-time">{timeLeft(group.expires_at)}</span>
          </div>
        </div>

        <div className="group-card-footer">
          <span className="seller-name">by {group.seller_name}</span>
          {group.seller_rating && (
            <span className="seller-rating">
              ★ {parseFloat(group.seller_rating).toFixed(1)}
              <span className="rating-count">({group.seller_reviews})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
