'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Editor from '@/components/Editor';
import ShareModal from '@/components/ShareModal';
import Sidebar from '@/components/Sidebar';
import DocumentInspector, { type ChatMessage, type OutlineItem } from '@/components/DocumentInspector';
import { apiClient } from '@/utils/api';
import type { Comment } from '@/types';
import type { PresenceUser } from '@/types/collaboration';
import { ChevronDown, ChevronUp, Menu, MessageCircle, PanelRightClose, PanelRightOpen, Save, Share2, Star } from 'lucide-react';

function extractOutlineItems(content: any): OutlineItem[] {
  const items: OutlineItem[] = [];
  let index = 0;

  const visit = (node: any) => {
    if (!node) return;
    if (node.type === 'heading') {
      const text = (node.content || [])
        .map((child: any) => child.text || '')
        .join('')
        .trim();
      if (text) items.push({ id: `heading-${index++}`, text, level: node.attrs?.level || 1 });
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };

  visit(content);
  return items;
}

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, fetchProfile } = useAuthStore();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docDirty, setDocDirty] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'outline' | 'activity' | 'chat'>('outline');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isChromeCollapsed, setIsChromeCollapsed] = useState(true);
  const editorSaveRef = useRef<(() => Promise<void>) | null>(null);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(10);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const docId = params.id as string;
  const outlineItems = useMemo(() => extractOutlineItems(doc?.content), [doc?.content]);
  const visibleCollaborators = presenceUsers.length > 0
    ? presenceUsers
    : user?.name
      ? [{ id: 'current-user', name: user.name, color: '#c76b48', isCurrentUser: true }]
      : [];

  useEffect(() => {
    if (token && !user) {
      void fetchProfile().catch(() => undefined);
    }
  }, [fetchProfile, token, user]);

  useEffect(() => {
    if (!token) {
      router.push('/auth');
      return;
    }

    const fetchDoc = async () => {
      try {
        const data = await apiClient.getDoc(docId);
        setDoc(data);
        await Promise.all([loadComments(), loadChatMessages()]);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docId, token, router]);

  async function loadComments() {
    try {
      const list = await apiClient.listComments(docId);
      setComments(list);
    } catch (err) {
      console.error('Failed to load comments', err);
    }
  }

  async function handleSaveDoc(content: any) {
    try {
      await apiClient.updateDoc(docId, undefined, undefined, content);
      // Update local doc content
      setDoc((prev: any) => ({ ...(prev || {}), content }));
      setDocDirty(false);
      // Refresh comments if needed
      await loadComments();
    } catch (err: any) {
      console.error('Failed to save doc:', err);
      alert(err.response?.data?.error?.message || 'Failed to save document');
      throw err; // rethrow so Editor can report
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    await createComment(commentText, { start: rangeStart, end: rangeEnd });
  }

  async function createComment(text: string, range: { start: number; end: number }) {
    if (!text.trim()) return;
    setCommentsLoading(true);
    try {
      await apiClient.createComment(docId, text, range);
      setCommentText('');
      await loadComments();
      setShowComments(true);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add comment');
      throw err;
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleResolve(commentId: string, resolved: boolean) {
    try {
      await apiClient.updateComment(commentId, resolved, undefined);
      await loadComments();
    } catch (err: any) {
      console.error('Resolve comment error:', err);
      alert(err.response?.data?.error?.message || 'Failed to update comment');
    }
  }

  async function handleReply(commentId: string) {
    const text = window.prompt('Reply text');
    if (!text) return;
    try {
      await apiClient.updateComment(commentId, undefined, { text });
      await loadComments();
    } catch (err: any) {
      console.error('Reply comment error:', err);
      alert(err.response?.data?.error?.message || 'Failed to add reply');
    }
  }

  async function loadChatMessages() {
    try {
      const messages = await apiClient.listChatMessages(docId);
      setChatMessages(messages.map((message: any) => ({
        id: message.id,
        author: message.authorName || 'Collaborator',
        text: message.text,
        timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        isCurrentUser: message.authorId === user?.id,
      })));
    } catch (err) {
      console.error('Failed to load chat messages', err);
    }
  }

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void loadChatMessages();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [docId, token, user?.id]);

  async function handleSendChat(message: string) {
    try {
      await apiClient.sendChatMessage(docId, message);
      await loadChatMessages();
    } catch (err: any) {
      console.error('Failed to send chat message', err);
      alert(err.response?.data?.error?.message || 'Failed to send chat message');
    }
  }

  function toggleNavigation() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen((open) => !open);
      return;
    }
    setIsSidebarCollapsed((collapsed) => !collapsed);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Error</h1>
          <p className="text-[var(--text-secondary)]">{error}</p>
          <button onClick={() => router.push('/')} className="btn-secondary mt-4">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`hybrid-document-page flex h-screen bg-[#060c18] ${isInspectorOpen ? '' : 'inspector-collapsed'} ${isChromeCollapsed ? 'chrome-collapsed' : ''}`}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        currentDocument={doc ? { id: docId, title: doc.title || 'Untitled document', updatedAt: doc.updatedAt } : undefined}
      />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        {/* Header */}
        <header className="hybrid-document-header h-[82px] flex items-center justify-between px-7 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleNavigation}
              className="hybrid-icon-button"
              aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="hybrid-document-title">{doc?.title || 'Untitled Document'}</h1>
                <Star size={16} className="text-slate-500" />
              </div>
              <div className="hybrid-save-status">
                <span className={docDirty ? 'is-dirty' : 'is-saved'} />
                <span>{docDirty ? 'Unsaved changes' : 'Saved just now'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hybrid-avatar-stack" aria-label={`${visibleCollaborators.length} people working`}>
              {visibleCollaborators.slice(0, 3).map((collaborator) => (
                <div className="hybrid-avatar" key={collaborator.id} title={collaborator.name} style={{ backgroundColor: collaborator.color }}>
                  {collaborator.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {visibleCollaborators.length > 3 && (
                <div className="hybrid-avatar avatar-muted" title={`${visibleCollaborators.length - 3} more collaborators`}>
                  +{visibleCollaborators.length - 3}
                </div>
              )}
              <span className="hybrid-presence-count">{visibleCollaborators.length} working</span>
            </div>
            <button
              onClick={() => { if (editorSaveRef.current) void editorSaveRef.current(); }}
              disabled={!docDirty}
              className="hybrid-header-button hybrid-save-button"
              title={docDirty ? 'Save (Ctrl+S)' : 'No changes to save'}
            >
              <Save size={16} /> Save
            </button>
            <button 
              onClick={() => setShowShareModal(true)} 
              className="hybrid-header-button hybrid-share-button"
            >
              <Share2 size={16} /> Share
            </button>
            <button
              onClick={() => {
                setShowComments((open) => !open);
                setInspectorTab('activity');
              }}
              className={`hybrid-icon-button ${showComments ? 'is-active' : ''}`}
              title="Comments"
            >
              <MessageCircle size={19} />
            </button>
            <button
              onClick={() => setIsInspectorOpen((open) => !open)}
              className="hybrid-icon-button"
              aria-label={isInspectorOpen ? 'Collapse document panel' : 'Expand document panel'}
              title={isInspectorOpen ? 'Collapse document panel' : 'Expand document panel'}
            >
              {isInspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
            <button
              onClick={() => setIsChromeCollapsed((collapsed) => !collapsed)}
              className="hybrid-icon-button hybrid-chrome-toggle"
              aria-label={isChromeCollapsed ? 'Expand editor controls' : 'Collapse editor controls'}
              title={isChromeCollapsed ? 'Expand editor controls' : 'Collapse editor controls'}
            >
              {isChromeCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </header>

        <div className="hybrid-document-workspace flex-1 overflow-hidden relative">
          <div className="hybrid-editor-pane absolute inset-0 overflow-auto">
            <div className="min-h-full">
              <div className="w-full h-full">
                <Editor 
                  docId={docId} 
                  initialContent={doc?.content}
                  onSave={handleSaveDoc}
                  currentUser={{ name: user?.name || 'User' }} 
                  onDirtyChange={(dirty) => setDocDirty(dirty)}
                  onToggleComments={() => {
                    setShowComments(true);
                    setInspectorTab('activity');
                  }}
                  onAddComment={async (text, range) => {
                    await createComment(text, range);
                  }}
                  onRegisterSave={(fn) => { editorSaveRef.current = fn; }}
                  onPresenceChange={setPresenceUsers}
                />
              </div>
            </div>
          </div>

          {isInspectorOpen && (
            <DocumentInspector
              activeTab={inspectorTab}
              onTabChange={(tab) => {
                setInspectorTab(tab);
                if (showComments) setShowComments(false);
              }}
              outlineItems={outlineItems}
              currentUserName={user?.name || 'You'}
              commentsCount={comments.length}
              onOpenComments={() => {
                setShowComments(true);
                setInspectorTab('activity');
              }}
              chatMessages={chatMessages}
              onSendChat={handleSendChat}
              collaborators={presenceUsers}
            />
          )}
        </div>

        {/* Comments Drawer */}
        {showComments && (
          <div className="hybrid-comments-drawer absolute right-0 top-0 bottom-0 w-[350px] bg-[var(--hybrid-shell)] border-l border-gray-800 z-50 shadow-xl flex flex-col">
            <div className="p-4 flex items-center justify-between border-b border-gray-800 bg-[var(--hybrid-shell)]">
              <h3 className="font-semibold text-white">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-[#1e293b] p-3 rounded-lg border border-gray-700 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-gray-200">{comment.text}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${comment.resolved ? 'bg-[var(--accent-glow)] text-[var(--accent)]' : 'bg-amber-900/30 text-amber-400'}`}>
                      {comment.resolved ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleResolve(comment.id, !comment.resolved)} className="hover:text-[var(--accent)] transition-colors">
                        {comment.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                      <button onClick={() => handleReply(comment.id)} className="hover:text-[var(--accent)] transition-colors">
                        Reply
                      </button>
                    </div>
                  </div>
                  {comment.replies?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="text-xs pl-2 border-l-2 border-gray-600 text-gray-400">
                          <p>{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {comments.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm">No comments yet</p>
                </div>
              )}
            </div>
            <form onSubmit={handleAddComment} className="p-4 border-t border-gray-800 bg-[var(--hybrid-shell)]">
              <textarea
                className="w-full p-2 border border-[var(--border)] rounded-md text-sm mb-2 focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none resize-none bg-[var(--bg-tertiary)] text-white placeholder-gray-500"
                placeholder="Add a comment..."
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  className="w-1/2 p-1.5 border border-gray-700 rounded text-xs bg-[#1e293b] text-white placeholder-gray-500"
                  placeholder="Start pos"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Number(e.target.value))}
                />
                <input
                  type="number"
                  className="w-1/2 p-1.5 border border-gray-700 rounded text-xs bg-[#1e293b] text-white placeholder-gray-500"
                  placeholder="End pos"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Number(e.target.value))}
                />
              </div>
              <button
                type="submit"
                disabled={commentsLoading || !commentText.trim()}
                className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {commentsLoading ? 'Adding...' : 'Add Comment'}
              </button>
            </form>
          </div>
        )}
      </main>

      <ShareModal
        docId={docId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        currentPermissions={doc?.permissions || { editors: [], viewers: [] }}
      />
    </div>
  );
}
