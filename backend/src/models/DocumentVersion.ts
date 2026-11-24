import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocumentVersion extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  version: number;
  content: any; // Yjs document state snapshot
  changes: string; // Human-readable description of changes
  authorId: mongoose.Types.ObjectId;
  deviceId?: string; // Device identifier for offline edits
  isOffline: boolean; // Whether this version was created offline
  createdAt: Date;
}

const DocumentVersionSchema = new Schema<IDocumentVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    version: { type: Number, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    changes: { type: String, default: '' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: String },
    isOffline: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true },
  }
);

// A document can have each version number only once. This also protects
// against duplicate snapshots when multiple clients save concurrently.
DocumentVersionSchema.index({ documentId: 1, version: 1 }, { unique: true });
DocumentVersionSchema.index({ createdAt: 1 }); // For cleanup job

export const DocumentVersion = mongoose.model<IDocumentVersion>('DocumentVersion', DocumentVersionSchema);
