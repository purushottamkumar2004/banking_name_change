import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import IntakeForm from './pages/IntakeForm';
import NotFound from './pages/NotFound';
import CheckerDashboard from './pages/CheckerDashboard';
import RequestDetail from './pages/RequestDetail';

const navStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '0 32px',
  height: 56,
  background: '#fff',
  borderBottom: '1px solid var(--ink-100)',
  boxShadow: 'var(--shadow-sm)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

const logoStyle = {
  fontWeight: 600,
  fontSize: '0.95rem',
  color: 'var(--ink-900)',
  letterSpacing: '-0.01em',
  marginRight: 32,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const linkStyle = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--ink-500)',
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  transition: 'all 0.15s',
  textDecoration: 'none',
};

const activeLinkStyle = {
  ...linkStyle,
  color: 'var(--blue-700)',
  background: 'var(--blue-50)',
};

export default function App() {
  return (
    <>
      <nav style={navStyle}>
        <div style={logoStyle}>
          <span style={{ fontSize: 18 }}>🏦</span>
          Account Servicing
        </div>
        <NavLink
          to="/"
          end
          style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}
        >
          New Request
        </NavLink>
        <NavLink
          to="/checker"
          style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}
        >
          Checker Dashboard
        </NavLink>
      </nav>

      <Routes>
        <Route path="/"            element={<IntakeForm />} />
        <Route path="/checker"     element={<CheckerDashboard />} />
        <Route path="/checker/:id" element={<RequestDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
