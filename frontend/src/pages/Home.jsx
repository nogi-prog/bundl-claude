import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import GroupCard from '../components/GroupCard';
import './Home.css';

function GroupRow({ title, subtitle, groups, loading, viewAllHref }) {
  return (
    <section className="home-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
        {viewAllHref && <Link to={viewAllHref} className="btn btn-ghost btn-sm">View all →</Link>}
      </div>
      {loading ? (
        <div className="grid-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-skeleton">
              <div className="skeleton" style={{ paddingTop: '62%' }} />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
                <div className="skeleton" style={{ height: 16, width: '80%' }} />
                <div className="skeleton" style={{ height: 28, width: '50%' }} />
                <div className="skeleton" style={{ height: 8 }} />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No groups here yet</h3>
          <p>Check back soon!</p>
        </div>
      ) : (
        <div className="grid-4">
          {groups.map((g) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayGroups, setTodayGroups] = useState([]);
  const [lastChanceGroups, setLastChanceGroups] = useState([]);
  const [recommendedGroups, setRecommendedGroups] = useState([]);
  const [loading, setLoading] = useState({ today: true, lastChance: true, recommended: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchSection('today', setTodayGroups, 'today');
    fetchSection('last_chance', setLastChanceGroups, 'lastChance');
    fetchSection('recommended', setRecommendedGroups, 'recommended');
    api.get('/catalog/categories').then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  async function fetchSection(section, setter, key) {
    try {
      const res = await api.get('/groups', {
        params: { section, limit: 8, user_category: user?.last_category || 'Computing' }
      });
      setter(res.data.groups);
    } catch {}
    finally { setLoading((l) => ({ ...l, [key]: false })); }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/groups?search=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <div className="home-page">
      {/* Hero */}
      <div className="hero">
        <div className="hero-bg" />
        <div className="container hero-inner">
          <div className="hero-text">
            <div className="hero-eyebrow">Group buying, reimagined</div>
            <h1 className="hero-title">Buy together.<br />Save together.</h1>
            <p className="hero-sub">Join group buys for top tech and gadgets at wholesale prices. Hit the target — everyone wins.</p>
            <form className="hero-search" onSubmit={handleSearch}>
              <input
                className="hero-search-input"
                placeholder="Search for products, brands, or categories…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-lg">Search</button>
            </form>
            <div className="hero-categories">
              {categories.map((cat) => (
                <Link key={cat} to={`/groups?category=${encodeURIComponent(cat)}`} className="cat-chip">{cat}</Link>
              ))}
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-value">10,000+</div>
              <div className="stat-label">Group buyers</div>
            </div>
            <div className="hero-stat-card accent">
              <div className="stat-icon">💰</div>
              <div className="stat-value">Up to 40%</div>
              <div className="stat-label">Average savings</div>
            </div>
            <div className="hero-stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">500+</div>
              <div className="stat-label">Completed groups</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container home-content">
        <GroupRow
          title="⚡ Last Chance"
          subtitle="Closing soon or almost full — don't miss out"
          groups={lastChanceGroups}
          loading={loading.lastChance}
          viewAllHref="/groups?section=last_chance"
        />
        <GroupRow
          title="🆕 Today's Groups"
          subtitle="Fresh group buys added in the last 24 hours"
          groups={todayGroups}
          loading={loading.today}
          viewAllHref="/groups?section=today"
        />
        <GroupRow
          title="✨ Recommended For You"
          subtitle={`Based on ${user?.last_category || 'Computing'} — your most purchased category`}
          groups={recommendedGroups}
          loading={loading.recommended}
          viewAllHref="/groups?section=recommended"
        />
      </div>
    </div>
  );
}
