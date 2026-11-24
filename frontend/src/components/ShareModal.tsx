'use client';

import React, { useState } from 'react';
import { apiClient } from '@/utils/api';

interface ShareModalProps {
  docId: string;
  isOpen: boolean;
  onClose: () => void;
  currentPermissions: { editors: string[]; viewers: string[] };
}

export default function ShareModal({ docId, isOpen, onClose, currentPermissions }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await apiClient.shareDoc(docId, email, permission);
      setEmail('');
      alert('Document shared successfully!');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to share document');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Share Document</h2>
        <form onSubmit={handleShare}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 sm:p-2 border border-[var(--border)] rounded bg-[var(--bg-primary)] text-gray-200 focus:outline-none focus:border-[var(--accent)] text-base"
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-300">Permission</label>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'editor' | 'viewer')}
              className="w-full p-3 sm:p-2 border border-[var(--border)] rounded bg-[var(--bg-primary)] text-gray-200 focus:outline-none focus:border-[var(--accent)] text-base"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 sm:py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors text-base sm:text-sm min-h-[44px] sm:min-h-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-3 sm:py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors text-base sm:text-sm min-h-[44px] sm:min-h-0"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
