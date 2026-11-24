# Vellum Frontend

Rich-text collaborative editor with offline PWA, Yjs real-time sync, and AI assist.

## Tech Stack
- **Framework**: Next.js 15 (React 18)
- **Editor**: Tiptap + ProseMirror
- **Real-time**: Yjs + Socket.io (y-websocket provider)
- **Offline**: next-pwa + y-indexeddb
- **State**: Zustand
- **HTTP**: Axios
- **Types**: TypeScript

## Folder Structure (to be created)
```
frontend/
├── src/
│   ├── app/          # Next.js App Router pages (layout, dashboard, editor)
│   ├── components/   # React components (Editor, Comments, Presence, ExportModal)
│   ├── hooks/        # Custom hooks (useYjsDoc, useSocket, useLocalStorage)
│   ├── store/        # Zustand stores (auth, ui, editor state)
│   ├── types/        # TypeScript interfaces
│   ├── utils/        # Helpers (api client, socket config, exports)
│   └── lib/          # Yjs/editor setup
├── public/           # Static assets, PWA manifest, service worker
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.local        # Local overrides
```

## Key Features
1. **Editor**: Tiptap + Yjs for CRDT-based collab; offline falls back to solo mode.
2. **Sync**: Socket.io rooms per doc; y-websocket provider; presence cursors online only.
3. **Offline**: Service worker + y-indexeddb; detects offline, hides collab UI, queues AI prompts.
4. **Exports**: Client-side PDF/Markdown via Web Workers (no server roundtrip).
5. **AI**: Right-click "Assist" → suggest/rewrite/summarize; streams via Socket.io/SSE.

## Printing & Page Breaks

You can insert print page breaks inside the editor with the `Insert Page Break` toolbar button. The editor inserts a div with `class="page-break"` which is styled in the global CSS so printed output starts a new page after the break.

How to use:
- Click the "Insert Page Break" button in the editor toolbar (or insert `<div class="page-break"></div>` manually in the document).
- On-screen you'll see a subtle dashed line marking the break; when printing or exporting to PDF, the content after the break will start on a new page.

To preview: open the browser Print Preview (Ctrl/Cmd+P) or use "Save as PDF" in the print dialog.

## Scripts
- `npm run dev`: Dev server on :3000
- `npm run build`: Production build
- `npm run start`: Start production server
- `npm run type-check`: TypeScript check

## Environment Variables
See `.env.example` at repo root.
