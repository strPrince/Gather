import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  title: string;
  ownerId: mongoose.Types.ObjectId; // Reference to User
  content: any; // Yjs document serialized (or we can use separate collection for versioning)
  currentVersion: number; // Current version number
  lastSyncedAt?: Date; // Last time document was synced with server
  metadata: {
    description?: string;
    tags?: string[];
    header?: string;
    footer?: string;
    drawings?: any[]; // Store interactive drawing data
    hasTaskLists?: boolean; // Flag to indicate if document contains task lists
  };
  permissions: {
    editors: mongoose.Types.ObjectId[]; // User IDs
    viewers: mongoose.Types.ObjectId[]; // User IDs
  };
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: Schema.Types.Mixed, default: null }, // Placeholder for Yjs state
    currentVersion: { type: Number, default: 0 },
    lastSyncedAt: { type: Date },
    metadata: {
      description: String,
      tags: [String],
      header: String,
      footer: String,
      drawings: [Schema.Types.Mixed], // Store interactive drawing data as JSON
      hasTaskLists: { type: Boolean, default: false },
    },
    permissions: {
      editors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      viewers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
  },
  { timestamps: true }
);

export const Document = mongoose.model<IDocument>('Document', DocumentSchema);
