'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, ChevronDown, FileText, FolderKanban, LayoutDashboard, LogOut, Menu,
  MoreHorizontal, Plus, Search, Settings, Sparkles, Users, X, Pencil, Trash2,
  ArrowUpRight, Clock3, WifiOff,
} from 'lucide-react';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import type { Document } from '../types';

const OFFLINE_DOC_CACHE_KEY = 'offline-docs-v1';
const OFFLINE_DOC_LIMIT = 200;

function readOfflineDocs(): Document[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(OFFLINE_DOC_CACHE_KEY) || '[]') as Document[]; }
  catch { return []; }
}

function writeOfflineDocs(docs: Document[]) {
  if (typeof window === 'undefined') return;
  const compact = docs.map((doc) => ({ id: doc.id || (doc as any)._id, title: doc.title, updatedAt: doc.updatedAt, createdAt: doc.createdAt, permissions: doc.permissions })).filter((doc) => !!doc.id).slice(0, OFFLINE_DOC_LIMIT);
  localStorage.setItem(OFFLINE_DOC_CACHE_KEY, JSON.stringify(compact));
}

function formatDate(dateString?: string) {
  if (!dateString) return 'Recently';
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Home() {
  const router = useRouter();
  const { user, token, logout, fetchProfile } = useAuthStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<{ id: string; title: string } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!token) { router.push('/auth'); return; }
    if (!user) void fetchProfile().catch(() => { logout(); router.push('/auth'); });
  }, [token, user, router, fetchProfile, logout]);

  useEffect(() => { if (token) { const cached = readOfflineDocs(); if (cached.length) setDocs(cached); void loadDocs(); } }, [token]);

  async function loadDocs() {
    setError(null);
    try { const list = await apiClient.listDocs(); const normalized = (list || []).map((doc: any) => ({ ...doc, id: doc.id || doc._id })); setDocs(normalized); writeOfflineDocs(normalized); }
    catch (err: any) { const fallback = readOfflineDocs(); setError(fallback.length ? 'Offline mode: showing your last synced documents.' : err.response?.data?.error?.message || 'Could not load documents.'); if (fallback.length) setDocs(fallback); }
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault(); if (!docTitle.trim()) return; setLoading(true); setError(null);
    try { const doc = await apiClient.createDoc(docTitle.trim()); setCreateModalOpen(false); setDocTitle(''); router.push(`/documents/${doc.id || doc._id}`); }
    catch (err: any) { setError(err.response?.data?.error?.message || 'Could not create document.'); setLoading(false); }
  }

  async function handleDeleteDoc(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try { await apiClient.deleteDoc(id); await loadDocs(); setMenuOpen(null); } catch (err: any) { setError(err.response?.data?.error?.message || 'Could not delete document.'); }
  }

  async function handleRenameDoc(id: string, title: string) {
    if (!title.trim()) return;
    try { await apiClient.updateDoc(id, title.trim()); await loadDocs(); setRenameDoc(null); setMenuOpen(null); } catch (err: any) { setError(err.response?.data?.error?.message || 'Could not rename document.'); }
  }

  const filteredDocs = useMemo(() => docs.filter((doc) => doc.title.toLowerCase().includes(query.toLowerCase())), [docs, query]);

  if (!user) return <main className="saas-loading"><div className="loader" /> Loading workspace</main>;

  return (
    <main className="saas-shell">
      <aside className={`saas-sidebar ${mobileNav ? 'is-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>Synapsribe</span><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
        <div className="workspace-switcher"><span className="workspace-avatar">A</span><span><strong>Acme workspace</strong><small>Personal team</small></span><ChevronDown size={15} /></div>
        <nav aria-label="Primary navigation" className="primary-nav">
          <span className="nav-label">Workspace</span>
          <a className="nav-item active" href="#documents"><LayoutDashboard size={18} /> Overview</a>
          <a className="nav-item" href="#documents"><FileText size={18} /> Documents <span className="nav-count">{docs.length}</span></a>
          <a className="nav-item" href="#shared"><Users size={18} /> Shared with me</a>
          <a className="nav-item" href="#projects"><FolderKanban size={18} /> Projects</a>
          <span className="nav-label nav-label-spaced">Manage</span>
          <a className="nav-item" href="/profile"><Settings size={18} /> Settings</a>
        </nav>
        <div className="sidebar-footer"><div className="plan-card"><div className="plan-icon"><Sparkles size={16} /></div><strong>Free plan</strong><span>{docs.length} of 10 documents</span><div className="progress"><span style={{ width: `${Math.min(docs.length * 10, 100)}%` }} /></div><button onClick={() => router.push('/profile')}>Manage plan <ArrowUpRight size={14} /></button></div><button className="nav-item signout" onClick={logout}><LogOut size={18} /> Sign out</button></div>
      </aside>

      {mobileNav && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <section className="saas-main">
        <header className="topbar"><button className="icon-button mobile-only" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Overview</strong></div><div className="topbar-actions"><label className="search-box"><Search size={17} /><input aria-label="Search documents" placeholder="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>⌘ K</kbd></label><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><button className="profile-button" onClick={() => router.push('/profile')}><span className="avatar">{user.name?.charAt(0).toUpperCase()}</span><span className="profile-name">{user.name}</span><ChevronDown size={14} /></button></div></header>

        <div className="content-wrap">
          <div className="page-heading"><div><p className="eyebrow">Tuesday, September 29, 2026</p><h1>Good morning, {user.name?.split(' ')[0]}</h1><p className="lede">Pick up where you left off or start something new.</p></div><button className="primary-button" onClick={() => { setError(null); setDocTitle(''); setCreateModalOpen(true); }}><Plus size={18} /> New document</button></div>
          {error && <div className="alert"><WifiOff size={17} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss"><X size={16} /></button></div>}

          <div className="metric-grid"><div className="metric-card"><span className="metric-label">Total documents</span><strong>{docs.length}</strong><span className="metric-meta positive">+{Math.min(docs.length, 4)} this month</span></div><div className="metric-card"><span className="metric-label">Recently edited</span><strong>{docs.length ? 'Today' : '—'}</strong><span className="metric-meta">Your latest activity</span></div><div className="metric-card"><span className="metric-label">Plan usage</span><strong>{docs.length}<small> / 10</small></strong><span className="metric-meta">Documents in workspace</span></div><div className="metric-card accent-metric"><span className="metric-label">Workspace health</span><strong>Good</strong><span className="metric-meta positive"><span className="status-dot" /> All systems operational</span></div></div>

          <div className="workspace-grid"><section className="documents-panel" id="documents"><div className="section-heading"><div><h2>Your documents</h2><p>All the work in your personal workspace.</p></div><div className="section-actions"><button className="filter-button">All documents <ChevronDown size={15} /></button><button className="icon-button bordered" aria-label="More document options"><MoreHorizontal size={18} /></button></div></div><div className="document-table"><div className="table-head"><span>Name</span><span>Access</span><span>Last edited</span><span /></div>{filteredDocs.length ? filteredDocs.map((doc) => <div className="document-row" key={doc.id} onClick={() => router.push(`/documents/${doc.id}`)}><div className="doc-name"><span className="doc-icon"><FileText size={17} /></span><span><strong>{doc.title}</strong><small>Document</small></span></div><span className="access-badge">{doc.permissions?.role || 'Owner'}</span><span className="edited-date"><Clock3 size={14} />{formatDate(doc.updatedAt || doc.createdAt)}</span><div className="row-menu"><button className="icon-button" aria-label={`Options for ${doc.title}`} onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === doc.id ? null : doc.id); }}><MoreHorizontal size={17} /></button>{menuOpen === doc.id && <div className="context-menu"><button onClick={(e) => { e.stopPropagation(); setRenameDoc({ id: doc.id, title: doc.title }); }}><Pencil size={14} /> Rename</button><button className="danger" onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}><Trash2 size={14} /> Delete</button></div>}</div></div>) : <div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><h3>{query ? 'No matching documents' : 'Your workspace is ready'}</h3><p>{query ? 'Try another search term.' : 'Create your first document to start capturing ideas.'}</p>{!query && <button className="primary-button" onClick={() => setCreateModalOpen(true)}><Plus size={17} /> Create document</button>}</div>}</div></section><aside className="activity-panel" id="shared"><div className="section-heading"><div><h2>Activity</h2><p>Recent workspace updates.</p></div><button className="text-button">View all</button></div><div className="activity-list"><div className="activity-item"><span className="activity-avatar">{user.name?.charAt(0).toUpperCase()}</span><p><strong>{user.name}</strong> is online<span>Right now</span></p></div><div className="activity-item"><span className="activity-avatar neutral"><FileText size={15} /></span><p>Your workspace is ready<span>Synapsribe · Welcome</span></p></div><div className="activity-item muted"><span className="activity-avatar neutral"><Sparkles size={15} /></span><p>AI assistance is available<span>Use it inside any document</span></p></div></div><div className="tip-card"><Sparkles size={18} /><div><strong>Write with focus</strong><p>Open a document to use the distraction-free editor and AI assistant.</p><button onClick={() => setCreateModalOpen(true)}>Start writing <ArrowUpRight size={14} /></button></div></div></aside></div>
        </div>
      </section>

      {(createModalOpen || renameDoc) && <div className="modal-backdrop" onClick={() => { if (!loading) { setCreateModalOpen(false); setRenameDoc(null); } }}><form className="saas-modal" onSubmit={renameDoc ? (e) => { e.preventDefault(); void handleRenameDoc(renameDoc.id, renameDoc.title); } : handleCreateDoc} onClick={(e) => e.stopPropagation()}><div className="modal-header"><div><span className="modal-kicker">Workspace</span><h2>{renameDoc ? 'Rename document' : 'Create a document'}</h2></div><button type="button" className="icon-button" onClick={() => { setCreateModalOpen(false); setRenameDoc(null); }} aria-label="Close"><X size={18} /></button></div><label className="field-label" htmlFor="document-title">Document name</label><input id="document-title" autoFocus className="saas-input" value={renameDoc ? renameDoc.title : docTitle} onChange={(e) => renameDoc ? setRenameDoc({ ...renameDoc, title: e.target.value }) : setDocTitle(e.target.value)} placeholder="e.g. Product launch notes" disabled={loading} /><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setCreateModalOpen(false); setRenameDoc(null); }}>Cancel</button><button type="submit" className="primary-button" disabled={loading || !(renameDoc ? renameDoc.title : docTitle).trim()}>{loading ? 'Creating...' : renameDoc ? 'Save name' : 'Create document'}</button></div></form></div>}
    </main>
  );
}
