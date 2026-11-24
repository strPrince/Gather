'use client';

import React from 'react';
import { Activity, CheckCircle2, ChevronRight, ListTree, MessageCircle, Users } from 'lucide-react';
import type { PresenceUser } from '@/types/collaboration';

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  isCurrentUser?: boolean;
}

interface DocumentInspectorProps {
  activeTab: 'outline' | 'activity' | 'chat';
  onTabChange: (tab: 'outline' | 'activity' | 'chat') => void;
  outlineItems: OutlineItem[];
  currentUserName: string;
  commentsCount: number;
  onOpenComments: () => void;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void | Promise<void>;
  collaborators: PresenceUser[];
}

export default function DocumentInspector({
  activeTab,
  onTabChange,
  outlineItems,
  currentUserName,
  commentsCount,
  onOpenComments,
  chatMessages,
  onSendChat,
  collaborators,
}: DocumentInspectorProps) {
  const activeCollaborators = collaborators.length > 0
    ? collaborators
    : [{ id: 'current-user', name: currentUserName || 'You', color: '#c76b48', isCurrentUser: true }];
  const [chatDraft, setChatDraft] = React.useState('');

  const submitChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatDraft.trim()) return;
    await onSendChat(chatDraft.trim());
    setChatDraft('');
  };

  return (
    <aside className="document-inspector hidden xl:flex">
      <div className="document-inspector__tabs" role="tablist" aria-label="Document context">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'outline'}
          onClick={() => onTabChange('outline')}
          className={activeTab === 'outline' ? 'is-active' : ''}
        >
          <ListTree size={15} />
          Outline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'activity'}
          onClick={() => onTabChange('activity')}
          className={activeTab === 'activity' ? 'is-active' : ''}
        >
          <Activity size={15} />
          Activity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chat'}
          onClick={() => onTabChange('chat')}
          className={activeTab === 'chat' ? 'is-active' : ''}
        >
          <MessageCircle size={15} />
          Chat
        </button>
      </div>

      {activeTab === 'outline' ? (
        <div className="document-inspector__body">
          <div className="inspector-section-heading">
            <span>Document outline</span>
            <span className="inspector-count">{outlineItems.length}</span>
          </div>

          {outlineItems.length > 0 ? (
            <nav className="outline-list" aria-label="Document outline">
              {outlineItems.map((item) => (
                <button key={item.id} type="button" className={`outline-item level-${item.level}`}>
                  <span>{item.text}</span>
                  <ChevronRight size={13} />
                </button>
              ))}
            </nav>
          ) : (
            <div className="inspector-empty">
              <ListTree size={20} />
              <p>Add headings to build an outline as you write.</p>
            </div>
          )}

          <div className="inspector-divider" />
          <div className="inspector-section-heading">
            <span>Collaborators <span className="inspector-count">{activeCollaborators.length}</span></span>
            <Users size={15} />
          </div>
          {activeCollaborators.map((collaborator) => (
            <div className="collaborator-row" key={collaborator.id}>
              <span className="avatar" style={{ backgroundColor: collaborator.color }}>
                {collaborator.name.charAt(0).toUpperCase()}
              </span>
              <span className="collaborator-name">
                {collaborator.name} {collaborator.isCurrentUser && <em>(You)</em>}
              </span>
              <span className="presence-status"><i /> {collaborator.isCurrentUser ? 'You' : 'Editing'}</span>
            </div>
          ))}

          <button type="button" className="inspector-comments-link" onClick={onOpenComments}>
            <span><MessageCircle size={15} /> Comments</span>
            <span>{commentsCount || 'View'} <ChevronRight size={13} /></span>
          </button>
        </div>
      ) : activeTab === 'activity' ? (
        <div className="document-inspector__body">
          <div className="activity-summary">
            <div className="activity-summary__icon"><CheckCircle2 size={18} /></div>
            <div>
              <strong>All changes saved</strong>
              <p>Your latest edits are synced and available offline.</p>
            </div>
          </div>
          <div className="inspector-divider" />
          <div className="inspector-section-heading"><span>Live presence <span className="inspector-count">{activeCollaborators.length}</span></span><Users size={15} /></div>
          {activeCollaborators.map((collaborator) => (
            <div className="collaborator-row" key={collaborator.id}>
              <span className="avatar" style={{ backgroundColor: collaborator.color }}>
                {collaborator.name.charAt(0).toUpperCase()}
              </span>
              <span className="collaborator-name">
                {collaborator.name} {collaborator.isCurrentUser && <em>(You)</em>}
              </span>
              <span className="presence-status"><i /> Online</span>
            </div>
          ))}
          <button type="button" className="inspector-comments-link" onClick={onOpenComments}>
            <span><MessageCircle size={15} /> Open comments</span>
            <span>{commentsCount} <ChevronRight size={13} /></span>
          </button>
        </div>
      ) : (
        <div className="document-inspector__body chat-panel">
          <div className="chat-panel__intro">
            <div className="chat-panel__icon"><MessageCircle size={17} /></div>
            <div>
              <strong>Document chat</strong>
              <p>Keep the conversation close to the work.</p>
            </div>
          </div>

          <div className="chat-list" aria-live="polite">
            {chatMessages.length > 0 ? chatMessages.map((message) => (
              <div key={message.id} className={`chat-message ${message.isCurrentUser ? 'is-self' : ''}`}>
                <div className="chat-message__meta">
                  <span>{message.author}</span>
                  <time>{message.timestamp}</time>
                </div>
                <p>{message.text}</p>
              </div>
            )) : (
              <div className="chat-empty">
                <MessageCircle size={21} />
                <p>No messages yet. Start the conversation.</p>
              </div>
            )}
          </div>

          <form className="chat-composer" onSubmit={submitChat}>
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Message collaborators..."
              aria-label="Message collaborators"
              rows={3}
            />
            <button type="submit" disabled={!chatDraft.trim()}>Send</button>
          </form>
        </div>
      )}
    </aside>
  );
}
