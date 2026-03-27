import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!isAuth) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuth]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await api.get('/users/me/notifications');
      setNotifications(res.data);
      setUnread(res.data.filter((n) => !n.read).length);
    } catch {}
  }

  async function markAllRead() {
    await api.put('/users/me/notifications/read');
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  function handleLogout() {
    logout();
    navigate('/');
    setMenuOpen(false);
  }

  const notifIcon = {
    join_confirm: '🛒',
    group_success: '🎉',
    group_cancelled: '❌',
    expiry_reminder: '⏰',
    seller_decision: '⚠️',
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-logo">
          Bundl<span className="logo-dot">.</span>
        </Link>

        <div className="navbar-search">
          <form onSubmit={(e) => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) navigate(`/groups?search=${encodeURIComponent(q)}`); }}>
            <div className="search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input name="q" className="search-input" placeholder="Search group buys…" defaultValue={new URLSearchParams(location.search).get('search') || ''} />
            </div>
          </form>
        </div>

        <div className="navbar-actions">
          {isAuth ? (
            <>
              {/* Notifications bell */}
              <div className="notif-wrap" ref={notifRef}>
                <button className="notif-btn" onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen && unread > 0) markAllRead(); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  {unread > 0 && <span className="notif-badge">{unread}</span>}
                </button>
                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <span>Notifications</span>
                      {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
                    </div>
                    <div className="notif-list">
                      {notifications.length === 0 ? (
                        <div className="notif-empty">No notifications yet</div>
                      ) : notifications.slice(0, 8).map((n) => (
                        <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                          <span className="notif-icon">{notifIcon[n.type] || '📢'}</span>
                          <div>
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="user-menu-wrap">
                <button className="user-avatar-btn" onClick={() => setMenuOpen(!menuOpen)}>
                  <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
                </button>
                {menuOpen && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <div className="user-name">{user?.name}</div>
                      <div className="user-role">{user?.role}</div>
                    </div>
                    <div className="dropdown-divider" />
                    <Link to="/profile" className="dropdown-item" onClick={() => setMenuOpen(false)}>My Purchases</Link>
                    {user?.role === 'seller' && <Link to="/seller" className="dropdown-item" onClick={() => setMenuOpen(false)}>Seller Dashboard</Link>}
                    {user?.role === 'admin' && <Link to="/admin" className="dropdown-item" onClick={() => setMenuOpen(false)}>Admin Panel</Link>}
                    {user?.role === 'buyer' && <Link to="/profile/become-seller" className="dropdown-item" onClick={() => setMenuOpen(false)}>Become a Seller</Link>}
                    <div className="dropdown-divider" />
                    <button className="dropdown-item danger" onClick={handleLogout}>Log out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/auth/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
