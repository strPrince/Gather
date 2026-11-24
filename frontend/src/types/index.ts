export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface Document {
  id: string;
  title: string;
  ownerId: string;
  permissions: {
    role: 'owner' | 'editor' | 'viewer';
  };
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  docId: string;
  authorId: string;
  text: string;
  range: { start: number; end: number };
  resolved: boolean;
  replies: Array<{
    id: string;
    authorId: string;
    text: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AIAssistRequest {
  selection: string;
  action: 'rewrite' | 'summarize' | 'expand';
  tone?: string;
}

export interface AIAssistResponse {
  variants: string[];
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}
