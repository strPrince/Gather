'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Settings, Home, LogOut, Plus, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  currentDocument?: { id: string; title: string; updatedAt?: string };
}

export default function Sidebar({ isOpen, onClose, isCollapsed = false, currentDocument }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/documents/new', label: 'New Document', icon: Plus },
    { href: '/profile', label: 'Settings', icon: Settings },
  ];

  // Close sidebar on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {onClose && (
        <div
          className={`mobile-overlay ${isOpen ? 'open' : ''} md:hidden`}
          onClick={onClose}
          aria-hidden={!isOpen}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative
          top-0 left-0 h-screen
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isOpen ? 'w-64' : isCollapsed ? 'w-0 md:w-[72px]' : 'w-0 md:w-64'}
          bg-[var(--bg-primary)] border-r border-[var(--border)]
          flex flex-col text-gray-300
          transition-all duration-300 ease-in-out
          overflow-hidden
          z-[1000] md:z-auto
        `}
      >
        <div className={`p-6 border-b border-white/[0.07] flex items-center justify-between ${isCollapsed ? 'md:justify-center md:px-3' : ''}`}>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--accent)] flex-shrink-0" />
            <span className={`whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>Synapsribe</span>
          </h1>
          
          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <nav className={`flex-1 p-4 space-y-1 overflow-y-auto ${isCollapsed ? 'md:px-2' : ''}`}>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => {
                  // Close mobile menu when clicking a link
                  if (onClose && window.innerWidth < 768) {
                    onClose();
                  }
                }}
                aria-label={isCollapsed ? link.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isCollapsed ? 'md:justify-center md:px-2' : ''} ${
                  isActive
                    ? 'bg-[var(--accent-glow)] text-white'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={isCollapsed ? 'md:hidden' : ''}>{link.label}</span>
              </Link>
            );
          })}

          {currentDocument && (
            <div className={`mt-8 pt-6 border-t border-white/[0.07] ${isCollapsed ? 'md:hidden' : ''}`}>
              <p className="px-3 mb-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">RECENT DOCUMENTS</p>
              <Link
                href={`/documents/${currentDocument.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 bg-white/[0.04] text-white hover:bg-white/[0.08] transition-colors"
              >
                <FileText className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{currentDocument.title}</span>
                  <span className="block mt-0.5 text-[11px] text-slate-500">Edited just now</span>
                </span>
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-label="Current document" />
              </Link>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/[0.07]">
          <button
            onClick={() => {
              logout();
              if (onClose && window.innerWidth < 768) {
                onClose();
              }
            }}
            aria-label={isCollapsed ? 'Sign Out' : undefined}
            className={`flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-red-400 hover:bg-red-900/20 transition-colors whitespace-nowrap ${isCollapsed ? 'md:justify-center md:px-2' : ''}`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={isCollapsed ? 'md:hidden' : ''}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
