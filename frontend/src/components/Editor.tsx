'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { apiClient } from '../utils/api';
import { getSyncService } from '../services/syncService';
import { Node } from '@tiptap/core';
import { keymap } from '@tiptap/pm/keymap';
import { Plugin } from '@tiptap/pm/state';
import type { DrawingData } from './InteractiveDrawing';
import PenCanvasOverlay from './PenCanvasOverlay';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Drawing from './extensions/Drawing';
import MobileToolbar from './MobileToolbar';
import type { PresenceUser } from '@/types/collaboration';

// Custom Page Extension
const Page = Node.create({
  name: 'page',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-page]' }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ['div', { 'data-page': '', ...HTMLAttributes }, 0];
  },
  addNodeView() {
    return ({ node, getPos, editor }: { node: any; getPos: () => number; editor: any }) => {
      const dom = document.createElement('div');
      dom.className = 'page';

      const content = document.createElement('div');
      content.className = 'page-content';

      dom.appendChild(content);

      return {
        dom,
        contentDOM: content,
      };
    };
  },
});

// Keymap for manual page break (Ctrl+Enter)
//TODO: create a new page on page break
const PageBreakKeymap = keymap({
  'Mod-Enter': (state, dispatch) => {
    const { $from } = state.selection;
    const pageNode = $from.node($from.depth);
    if (pageNode.type.name === 'page') {
      // Insert new page after current
      const pos = $from.end($from.depth);
      const tr = state.tr.insert(pos, state.schema.nodes.page.create(null, state.schema.nodes.paragraph.create()));
      if (dispatch) dispatch(tr);
      return true;
    }
    return false;
  },
});

// Plugin for basic automatic page overflow (simplified)
const AutoPageBreakPlugin = new Plugin({
  view() {
    return {
      update(view) {
        // Simple check: if last page content height exceeds, insert new page
        // This is a basic implementation; full automatic pagination requires complex layout calculations
        const pages = view.dom.querySelectorAll('.page');
        const lastPage = pages[pages.length - 1];
        if (lastPage) {
          const content = lastPage.querySelector('.page-content');
          if (content && content.scrollHeight > 297 * 3.78) { // Approximate mm to px
            const state = view.state;
            const pos = state.doc.content.size;
            const tr = state.tr.insert(pos, state.schema.nodes.page.create(null, state.schema.nodes.paragraph.create()));
            view.dispatch(tr);
          }
        }
      },
    };
  },
});

const PAGE_COLORS = [
  { name: 'Graphite', value: '#18282b', text: '#e9f7f3', border: '#30514e' },
  { name: 'White', value: '#ffffff', text: '#1a1a1a', border: '#e2e8f0' },
  { name: 'Sepia', value: '#fdf6e3', text: '#433422', border: '#e6dbb9' },
  { name: 'Gray', value: '#f3f4f6', text: '#1f2937', border: '#e5e7eb' },
  { name: 'Dark', value: '#1e293b', text: '#e2e8f0', border: '#334155' },
  { name: 'Black', value: '#020617', text: '#f8fafc', border: '#1e293b' },
];

interface EditorProps {
  docId: string;
  initialContent?: any;
  initialMetadata?: {
    header?: string;
    footer?: string;
    drawing?: string;
  };
  onSave: (content: any) => Promise<void>;
  onSaveMetadata?: (metadata: { header?: string; footer?: string; drawing?: string | null }) => Promise<void>;
  currentUser: {
    name: string;
    color?: string;
  };
  onDirtyChange?: (dirty: boolean) => void;
  onToggleComments?: () => void;
  onAddComment?: (text: string, range: { start: number; end: number }) => Promise<void>;
  onRegisterSave?: (fn: () => Promise<void>) => void;
  onPresenceChange?: (users: PresenceUser[]) => void;
}

export default function Editor({ docId, initialContent, initialMetadata, onSave, onSaveMetadata, currentUser, onDirtyChange, onToggleComments, onAddComment, onRegisterSave, onPresenceChange }: EditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isPenMode, setIsPenMode] = useState(false);
  const [pageColor, setPageColor] = useState(PAGE_COLORS[0].value);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const activePageColor = PAGE_COLORS.find(c => c.value === pageColor) || PAGE_COLORS[0];
  const ydoc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);
  const indexeddbProviderRef = useRef<IndexeddbPersistence | null>(null);
  const websocketProviderRef = useRef<WebsocketProvider | null>(null);
  const cursorColor = currentUser.color || '#c76b48';

  useEffect(() => {
    awareness.setLocalStateField('user', {
      name: currentUser.name || 'You',
      color: cursorColor,
    });

    const publishPresence = () => {
      const users = Array.from(awareness.getStates().entries())
        .map(([clientId, state]) => {
          const user = state.user as { name?: string; color?: string } | undefined;
          if (!user?.name) return null;
          return {
            id: String(clientId),
            name: user.name,
            color: user.color || '#c76b48',
            isCurrentUser: clientId === awareness.clientID,
          };
        })
        .filter(Boolean) as PresenceUser[];
      onPresenceChange?.(users);
    };

    awareness.on('change', publishPresence);
    publishPresence();
    return () => {
      awareness.off('change', publishPresence);
    };
  }, [awareness, currentUser.name, cursorColor, onPresenceChange]);

  // Setup network status listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const syncService = getSyncService();
    const unsubscribe = syncService.onNetworkChange((online) => {
      setIsOnline(online);
      if (online) {
        // Reconnect WebSocket when coming back online
        if (!websocketProviderRef.current && ydoc) {
          syncService.syncYjsDocument(ydoc, docId, awareness).then(({ websocketProvider }) => {
            websocketProviderRef.current = websocketProvider || null;
          });
        }
      } else {
        // Disconnect WebSocket when going offline
        if (websocketProviderRef.current) {
          syncService.disconnectWebsocket(websocketProviderRef.current);
          websocketProviderRef.current = null;
        }
      }
    });

    return unsubscribe;
  }, [docId, ydoc, awareness]);

  // Initialize providers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let mounted = true;
    const syncService = getSyncService();

    const initProviders = async () => {
      try {
        const { indexeddbProvider, websocketProvider } = await syncService.syncYjsDocument(ydoc, docId, awareness);
        
        if (mounted) {
          indexeddbProviderRef.current = indexeddbProvider;
          websocketProviderRef.current = websocketProvider || null;
        }
      } catch (error) {
        console.error('Failed to initialize providers:', error);
      }
    };

    initProviders();

    return () => {
      mounted = false;
      if (websocketProviderRef.current) {
        syncService.disconnectWebsocket(websocketProviderRef.current);
      }
      if (indexeddbProviderRef.current) {
        indexeddbProviderRef.current.destroy();
      }
    };
  }, [docId, ydoc, awareness]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        document: false, // Disable default document
        history: {},
      }),
      Node.create({
        name: 'doc',
        topNode: true,
        content: 'page+',
      }),
      Page,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[var(--accent)] underline cursor-pointer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontFamily,
      TextStyle,
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Drawing,
      Collaboration.configure({ 
        fragment: ydoc.getXmlFragment('prosemirror'),
      }),
      CollaborationCursor.configure({
        provider: { awareness } as any,
        user: {
          name: currentUser.name || 'You',
          color: cursorColor,
        },
        render: (user) => {
          const cursor = document.createElement('span');
          cursor.className = 'collaboration-cursor__caret';
          cursor.setAttribute('data-collaborator', user.name || 'Collaborator');
          cursor.style.borderColor = user.color || cursorColor;

          const label = document.createElement('span');
          label.className = 'collaboration-cursor__label';
          label.textContent = user.name || 'Collaborator';
          label.style.backgroundColor = user.color || cursorColor;
          cursor.appendChild(label);
          return cursor;
        },
        selectionRender: (user) => ({
          nodeName: 'span',
          class: 'collaboration-cursor__selection',
          style: `background-color: ${user.color || cursorColor};`,
          'data-collaborator': user.name || 'Collaborator',
        }),
      }),
    ],
    content: initialContent || '<page><p>Start writing...</p></page>',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)]',
      },
    },
    immediatelyRender: false,
  });

  // Update content when initialContent changes (e.g. switching docs)
  useEffect(() => {
    if (editor && initialContent) {
      // Only update if content is different to avoid cursor jumps
      // For simplicity, we just set it if it's a new doc load
      // In a real app, we'd check if docId changed
      editor.commands.setContent(initialContent);
      setIsDirty(false);
    }
  }, [docId, initialContent, editor]);

  // Notify parent when dirty changes
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      const content = editor.getJSON();
      await onSave(content);
      if (onSaveMetadata) {
        await onSaveMetadata({ header: '', footer: '', drawing: null });
      }
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!editor) return;
    const element = document.querySelector('[data-editor-container]') as HTMLElement;
    if (!element) return;

    try {
      // Get rendered HTML and the compiled CSS from the current app build so the PDF looks the same
      const html = element.outerHTML;
      // try to find the compiled CSS file (Next static css), fall back to the known path
      const linkEl = document.querySelector('link[rel="stylesheet"][href*="/_next/static/css/app/"]') as HTMLLinkElement | null;
      const cssHref = linkEl?.href || '/_next/static/css/app/layout.css';
      let css = '';
      try {
        const cssResp = await fetch(cssHref);
        if (cssResp.ok) css = await cssResp.text();
      } catch (e) {
        console.warn('Could not fetch compiled CSS for PDF export:', e);
      }

      const pdfBlob = await apiClient.generatePdf(docId, html, css);

      // Download the blob
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docId || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF via server', err);
    }
  };

  // register save handler with parent
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(() => handleSave());
    // cleanup: register a noop when unmounted
    return () => onRegisterSave(async () => {});
  }, [onRegisterSave, handleSave]);

  // Listen for updates to mark document dirty
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setIsDirty(true);
    editor.on('update', onUpdate);
    return () => {
      // call off and ignore any return value
      void editor.off('update', onUpdate);
    };
  }, [editor]);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  // Scroll to zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom(prev => Math.max(50, Math.min(200, prev + delta)));
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const handleInsertInteractiveDrawing = (data: DrawingData) => {
    if (editor) {
      editor.chain().focus().setDrawing({ data }).run();
    }
    setIsPenMode(false);
  };

  // Context menu for adding comment (right-click)
  useEffect(() => {
    if (!editor || !onAddComment) return;
    const dom = editor.view.dom;
    const handler = async (e: MouseEvent) => {
      // If right click, prevent native context menu
      if (e.button !== 2) return;
      e.preventDefault();
      // get selection
      const { from, to } = editor.state.selection;
      if (from === to) {
        // no selection
        return;
      }
      const text = window.prompt('Add comment for selection');
      if (!text) return;
      try {
        await onAddComment(text, { start: from, end: to });
        // Optionally show the comment was created
      } catch (err) {
        console.error('Failed to add comment from editor context', err);
      }
    };
    dom.addEventListener('contextmenu', handler);
    return () => dom.removeEventListener('contextmenu', handler);
  }, [editor, onAddComment]);

  if (!editor) {
    return null;
  }

  return (
    <div className="hybrid-editor">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="sticky top-0 z-50 bg-yellow-500/20 border-b border-yellow-500/50 px-4 py-2 text-center">
          <p className="text-yellow-200 text-sm font-medium">
            ⚠️ You are currently offline. Edits are saved locally and will sync when you reconnect.
          </p>
        </div>
      )}
      
      {/* Mobile Toolbar */}
      <MobileToolbar editor={editor} />
      
      {/* Desktop Toolbar */}
      <div className="hybrid-format-toolbar sticky top-0 z-50 bg-[var(--hybrid-shell-raised)] border-b border-gray-700/50 shadow-sm mb-6 rounded-xl mx-auto w-full flex-col hidden md:flex">
        {/* Top Row: Primary Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40">
          <div className="flex items-center gap-3">
             {/* History */}
            <div className="flex items-center gap-1.5 pr-3 border-r border-gray-700/50">
              <button onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} className="group relative p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Undo</span>
              </button>
              <button onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} className="group relative p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Redo (Ctrl+Y)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Redo</span>
              </button>
            </div>
            
            {/* Font Family & Size */}
            <div className="flex items-center gap-2 px-3">
               <select
                onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                className="h-9 px-3 text-sm rounded-lg bg-[var(--hybrid-surface)] border border-gray-700/60 text-gray-200 focus:outline-none focus:border-gray-500 transition-colors cursor-pointer hover:border-gray-600"
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
              </select>
              <select
                onChange={(e) => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}
                className="h-9 px-3 text-sm rounded-lg bg-[var(--hybrid-surface)] border border-gray-700/60 text-gray-200 focus:outline-none focus:border-gray-500 transition-colors cursor-pointer hover:border-gray-600 w-20"
              >
                <option value="12px">12</option>
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="20px">20</option>
                <option value="24px">24</option>
                <option value="30px">30</option>
              </select>
            </div>

            {/* Formatting */}
            <div className="flex items-center gap-1.5 px-3 border-l border-gray-700/50">
              <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} title="Bold (Ctrl+B)"><span className="font-bold text-sm">B</span></button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} title="Italic (Ctrl+I)"><span className="italic text-sm">I</span></button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} title="Underline (Ctrl+U)"><span className="underline text-sm">U</span></button>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Page Color Swatches */}
             <div className="hybrid-theme-control flex items-center gap-2 px-3 py-1.5 bg-[var(--hybrid-surface)] rounded-full border border-gray-700/60">
               <span className="text-xs text-gray-400 font-medium mr-1">Theme</span>
                {PAGE_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setPageColor(color.value)}
                  className={`w-4 h-4 rounded-full transition-opacity ${pageColor === color.value ? 'opacity-100 ring-1 ring-white/40' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: color.value, border: `1px solid ${color.border}` }}
                    title={color.name}
                  />
                ))}
             </div>

             <div className="h-6 w-px bg-gray-700/60"></div>

             <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="group relative btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  Save
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/10 rounded">Ctrl+S</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Row: Secondary Actions */}
          <div className="flex items-center gap-5 px-4 py-2.5 bg-[var(--hybrid-shell)] rounded-b-xl overflow-x-auto">
           {/* Styles */}
           <div className="flex items-center gap-1.5 pr-4 border-r border-gray-700/30">
              <button onClick={() => editor.chain().focus().setParagraph().run()} className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${editor.isActive('paragraph') ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>Normal</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>H1</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>H2</button>
           </div>

           {/* Alignment */}
           <div className="flex items-center gap-1.5 pr-4 border-r border-gray-700/30">
              <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Align Left">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Align Center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Align Right">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>
              </button>
           </div>

           {/* Lists */}
           <div className="flex items-center gap-1.5 pr-4 border-r border-gray-700/30">
              <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Bullet List">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Numbered List">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
              </button>
              <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('taskList') ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Todo List">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </button>
           </div>

           {/* Insert */}
           <div className="flex items-center gap-2 border-r border-gray-700/30 pr-4">
               <button onClick={() => setIsPenMode((active) => !active)} className={`hybrid-drawing-control flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${isPenMode ? 'bg-[var(--hybrid-accent-soft)] text-[var(--hybrid-accent)]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} title="Draw directly on the page">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                {isPenMode ? 'Drawing' : 'Draw'}
              </button>
               <button onClick={() => editor?.chain().focus().insertContent('<page><p></p></page>').run()} className="hybrid-optional-control flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors" title="Insert Page Break (Ctrl+Enter)">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Page Break
              </button>
           </div>

           {/* View & Status */}
           <div className="flex items-center gap-3 pl-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--hybrid-surface)] rounded-lg border border-gray-700/60">
                <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Zoom Out">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <span className="text-xs text-gray-300 font-medium w-10 text-center">{zoom}%</span>
                <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Zoom In">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
              
              <div className="h-5 w-px bg-gray-700/60"></div>
              
              {isDirty ? (
                <span className="text-xs text-gray-300 font-medium">Unsaved</span>
              ) : (
                <span className="text-xs text-gray-400 font-medium">Saved</span>
              )}
           </div>
        </div>
      </div>


      <div data-editor-container className="hybrid-canvas relative w-full h-full min-h-screen bg-[var(--hybrid-canvas)] overflow-auto">
        {/* Editor Content */}
        <div className="w-full min-h-screen p-2 sm:p-4 md:p-6" style={{ position: 'relative' }}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', position: 'relative' }}>
            <div className="editor-paper" style={{ '--paper-bg': activePageColor.value, '--paper-text': activePageColor.text } as React.CSSProperties}>
              <EditorContent editor={editor} style={{ position: 'relative', zIndex: 2 }} />
              {isPenMode && <PenCanvasOverlay onSave={handleInsertInteractiveDrawing} onCancel={() => setIsPenMode(false)} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
