import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import GroupCard from '../components/GroupCard';
import './Groups.css';

const SECTIONS = [
  { key: '', label: 'All Groups' },
  { key: 'today', label: "Today's" },
  { key: 'last_chance', label: 'Last Chance' },
  { key: 'recommended', label: 'Recommended' },
];

export default function Groups() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const section = searchParams.get('section') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    api.get('/catalog/categories').then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/groups', { params: { search, category, section, page, limit: 12 } })
      .then((res) => { setGroups(res.data.groups); setTotal(res.data.total); setPages(res.data.pages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, category, section, page]);

  function setParam(key, val) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  return (
    <div className="page">
      <div className="container">
        <div className="groups-layout">
          {/* Sidebar filters */}
          <aside className="groups-sidebar">
            <div className="filter-section">
              <div className="filter-label">Browse</div>
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  className={`filter-btn ${section === s.key ? 'active' : ''}`}
                  onClick={() => setParam('section', s.key)}
                >{s.label}</button>
              ))}
            </div>
            <div className="filter-section">
              <div className="filter-label">Category</div>
              <button className={`filter-btn ${!category ? 'active' : ''}`} onClick={() => setParam('category', '')}>All Categories</button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`filter-btn ${category === cat ? 'active' : ''}`}
                  onClick={() => setParam('category', cat)}
                >{cat}</button>
              ))}
            </div>
          </aside>

          {/* Main */}
          <div className="groups-main">
            <div className="groups-header">
              <h1 className="groups-title">
                {search ? `Results for "${search}"` : section ? SECTIONS.find(s => s.key === section)?.label : 'All Group Buys'}
              </h1>
              <span className="groups-count">{total} group{total !== 1 ? 's' : ''}</span>
            </div>

            {/* Active filters */}
            {(search || category) && (
              <div className="active-filters">
                {search && <span className="filter-tag">Search: {search} <button onClick={() => setParam('search', '')}>×</button></span>}
                {category && <span className="filter-tag">{category} <button onClick={() => setParam('category', '')}>×</button></span>}
              </div>
            )}

            {loading ? (
              <div className="grid-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card-skeleton" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <div className="skeleton" style={{ paddingTop: '62%' }} />
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="skeleton" style={{ height: 12, width: '40%' }} />
                      <div className="skeleton" style={{ height: 16, width: '80%' }} />
                      <div className="skeleton" style={{ height: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No groups found</h3>
                <p>Try a different search or category</p>
              </div>
            ) : (
              <div className="grid-3">
                {groups.map((g) => <GroupCard key={g.id} group={g} />)}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="pagination">
                {[...Array(pages)].map((_, i) => (
                  <button
                    key={i}
                    className={`page-btn ${page === i + 1 ? 'active' : ''}`}
                    onClick={() => { const next = new URLSearchParams(searchParams); next.set('page', i + 1); setSearchParams(next); }}
                  >{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
