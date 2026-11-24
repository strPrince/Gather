import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  docId: mongoose.Types.ObjectId; // Reference to Document
  authorId: mongoose.Types.ObjectId; // Reference to User
  text: string;
  range: {
    start: number;
    end: number;
  };
  resolved: boolean;
  replies: Array<{
    id: string;
    authorId: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    docId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    range: {
      start: { type: Number, required: true },
      end: { type: Number, required: true },
    },
    resolved: { type: Boolean, default: false },
    replies: [
      {
        id: { type: String, required: true },
        authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
