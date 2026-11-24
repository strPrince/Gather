# Vellum Backend

Express + Socket.io + MongoDB server for collaborative editing, auth, AI assist, and exports.

## Tech Stack
- **Framework**: Express.js (Node.js)
- **Real-time**: Socket.io (Yjs room provider)
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT + bcryptjs
- **Task Queue**: Bull + Redis (for AI jobs, exports)
- **Yjs Persistence**: y-mongodb-provider (or custom adapter)
- **Types**: TypeScript

## Folder Structure (to be created)
```
backend/
├── src/
│   ├── server.ts       # Entry point
│   ├── socket/         # Socket.io handlers (rooms, awareness, sync)
│   ├── routes/         # Express routes (auth, docs, ai, exports)
│   ├── models/         # Mongoose schemas (User, Doc, Comment, etc.)
│   ├── middleware/     # Auth, error handling, validation
│   ├── controllers/    # Logic for routes and socket events
│   ├── services/       # Business logic (AI, export, Yjs sync)
│   ├── types/          # TypeScript interfaces
│   └── utils/          # Helpers (JWT, password hashing, logging)
├── package.json
├── tsconfig.json
└── .env.local          # Local overrides
```

## Key Features
1. **Auth**: JWT-based login/refresh; users and orgs.
2. **Docs**: CRUD endpoints; Yjs room server for real-time sync.
3. **Socket.io**: Per-doc rooms; Yjs awareness provider; presence broadcasts.
4. **AI Assist**: `/api/ai/assist` endpoint; single LLM provider (OpenAI default); queues for offload.
5. **Exports**: PDF/Markdown generation via headless renderer or Web Workers callback.
6. **Comments**: Thread management; anchored to doc ranges.
7. **Persistence**: Yjs updates stored in MongoDB; snapshots for performance.

## API Endpoints
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh JWT
- `GET /api/docs` - List user's docs
- `POST /api/docs` - Create doc
- `GET /api/docs/:id` - Get doc metadata
- `PUT /api/docs/:id` - Update doc metadata
- `DELETE /api/docs/:id` - Delete doc
- `POST /api/ai/assist` - AI suggest/rewrite/summarize
- `POST /api/exports/pdf` - Export to PDF (async job)
- `POST /api/exports/markdown` - Export to Markdown
- `GET /api/comments/:docId` - Get doc comments
- `POST /api/comments/:docId` - Create comment thread
- `PATCH /api/comments/:id` - Update comment

## Socket.io Events
- `join_room` - Join doc collaborative room
- `leave_room` - Leave room
- `sync_step1`, `sync_step2`, `update` - Yjs sync protocol
- `awareness` - Presence/cursor updates
- `comment:create`, `comment:update` - Comment events
- `ai:suggestion` - AI response streams

## Scripts
- `npm run dev`: Dev server with hot reload on :3001
- `npm run build`: TypeScript build to dist/
- `npm run start`: Start production server
- `npm run type-check`: TypeScript check

## Environment Variables
See `.env.example` at repo root.
