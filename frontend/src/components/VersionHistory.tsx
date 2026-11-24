'use client';

import React, { useState, useEffect } from 'react';
import { versionService } from '../services/versionService';
import { Clock, User, Wifi, WifiOff, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VersionHistoryProps {
  docId: string;
  onRestore?: (versionContent: any) => void;
}

interface Version {
  id: string;
  version: number;
  changes: string;
  author: { name: string; email: string } | null;
  isOffline: boolean;
  deviceId?: string;
  createdAt: string;
}

export default function VersionHistory({ docId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [versionContent, setVersionContent] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOffline, setFilterOffline] = useState<boolean | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [docId, page]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const data = await versionService.listVersions(docId, page, 20);
      
      let filteredVersions = data.versions;
      if (filterOffline !== null) {
        filteredVersions = data.versions.filter((v: Version) => v.isOffline === filterOffline);
      }
      
      setVersions(filteredVersions);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionClick = async (version: Version) => {
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null);
      setVersionContent(null);
      setExpandedId(null);
      return;
    }

    try {
      setSelectedVersion(version);
      setExpandedId(version.id);
      const versionData = await versionService.loadVersion(docId, version.id);
      setVersionContent(versionData.content);
    } catch (error) {
      console.error('Failed to load version content:', error);
    }
  };

  const handleRestore = async (version: Version) => {
    if (!versionContent) return;

    if (confirm(`Are you sure you want to restore version ${version.version}? This will replace your current content.`)) {
      try {
        if (onRestore) {
          onRestore(versionContent);
        }
        alert('Version restored successfully!');
      } catch (error) {
        console.error('Failed to restore version:', error);
        alert('Failed to restore version. Please try again.');
      }
    }
  };

  if (loading && versions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Version History</h2>
        
        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterOffline(null)}
            className={`px-3 py-1 rounded text-sm ${
              filterOffline === null
                ? 'bg-[var(--accent)] text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterOffline(false)}
            className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
              filterOffline === false
                ? 'bg-[var(--accent)] text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Wifi size={14} /> Online
          </button>
          <button
            onClick={() => setFilterOffline(true)}
            className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
              filterOffline === true
                ? 'bg-[var(--accent)] text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <WifiOff size={14} /> Offline
          </button>
        </div>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No versions found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {versions.map((version) => (
              <div key={version.id} className="hover:bg-gray-800/50 transition-colors">
                <button
                  onClick={() => handleVersionClick(version)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className="flex-shrink-0 mt-1">
                    {version.isOffline ? (
                      <WifiOff size={16} className="text-yellow-500" />
                    ) : (
                      <Wifi size={16} className="text-[var(--success)]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">
                        Version {version.version}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <p className="text-sm text-gray-300 mb-2">{version.changes}</p>

                    {version.author && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <User size={12} />
                        <span>{version.author.name}</span>
                      </div>
                    )}

                    {version.isOffline && version.deviceId && (
                      <div className="text-xs text-yellow-500 mt-1">
                        Offline edit from {version.deviceId}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {expandedId === version.id ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedId === version.id && versionContent && (
                  <div className="px-4 pb-4 bg-gray-800/30">
                    <div className="border border-gray-700 rounded p-3 mb-3 bg-gray-900/50">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-64">
                        {JSON.stringify(versionContent, null, 2)}
                      </pre>
                    </div>

                    <button
                      onClick={() => handleRestore(version)}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded text-sm transition-colors"
                    >
                      <RotateCcw size={14} />
                      Restore this version
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
