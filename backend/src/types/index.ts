export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Document {
  id: string;
  title: string;
  ownerId: string;
  content: any; // Yjs doc serialized
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  docId: string;
  authorId: string;
  text: string;
  range: { start: number; end: number };
  createdAt: Date;
}

export interface AIRequest {
  docId: string;
  userId: string;
  selection: string;
  action: 'rewrite' | 'summarize' | 'expand';
}

export interface AIResponse {
  id: string;
  variants: string[];
  status: 'pending' | 'completed' | 'error';
}
