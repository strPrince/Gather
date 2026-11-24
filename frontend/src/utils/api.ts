import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    // Load token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }

    // Add auth header to requests
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  // Auth endpoints
  async register(email: string, password: string, name: string) {
    const response = await this.client.post('/api/auth/register', {
      email,
      password,
      name,
    });
    this.setToken(response.data.token);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', {
      email,
      password,
    });
    this.setToken(response.data.token);
    return response.data;
  }

  async refreshToken() {
    const response = await this.client.post('/api/auth/refresh');
    this.setToken(response.data.token);
    return response.data;
  }

  // Doc endpoints
  async listDocs() {
    const response = await this.client.get('/api/docs');
    return response.data.docs;
  }

  async createDoc(title: string) {
    const response = await this.client.post('/api/docs', { title });
    return response.data;
  }

  async getDoc(docId: string) {
    const response = await this.client.get(`/api/docs/${docId}`);
    return response.data;
  }

  async updateDoc(docId: string, title?: string, metadata?: any, content?: any) {
    const response = await this.client.put(`/api/docs/${docId}`, {
      title,
      metadata,
      content,
    });
    return response.data;
  }

  async deleteDoc(docId: string) {
    await this.client.delete(`/api/docs/${docId}`);
  }

  async shareDoc(docId: string, email: string, permission: 'editor' | 'viewer') {
    const response = await this.client.post(`/api/docs/${docId}/share`, {
      email,
      permission,
    });
    return response.data;
  }

  async generatePdf(docId: string, html: string, css?: string) {
    const response = await this.client.post(`/api/docs/${docId}/export/pdf`, { html, css }, { responseType: 'blob' });
    return response.data;
  }

  // Comments endpoints
  async listComments(docId: string) {
    const response = await this.client.get(`/api/comments/${docId}`);
    return response.data.comments;
  }

  async createComment(docId: string, text: string, range: { start: number; end: number }) {
    const response = await this.client.post(`/api/comments/${docId}`, {
      text,
      range,
    });
    return response.data;
  }

  async updateComment(commentId: string, resolved?: boolean, reply?: { text: string }) {
    const response = await this.client.patch(`/api/comments/${commentId}`, {
      resolved,
      reply,
    });
    return response.data;
  }

  async listChatMessages(docId: string) {
    const response = await this.client.get(`/api/chat/${docId}`);
    return response.data.messages;
  }

  async sendChatMessage(docId: string, text: string) {
    const response = await this.client.post(`/api/chat/${docId}`, { text });
    return response.data.message;
  }

  // Profile endpoints
  async getProfile() {
    const response = await this.client.get('/api/auth/me');
    return response.data.user;
  }

  async updateProfile(payload: { name?: string; currentPassword?: string; newPassword?: string }) {
    const response = await this.client.put('/api/auth/me', payload);
    return response.data.user;
  }

  // AI endpoints
  async aiAssist(selection: string, action: 'rewrite' | 'summarize' | 'expand', tone?: string) {
    const response = await this.client.post('/api/ai/assist', {
      selection,
      action,
      tone,
    });
    return response.data;
  }

  // Version endpoints
  async createVersion(docId: string, content: any, changes: string, isOffline: boolean = false) {
    const response = await this.client.post(`/api/versions/${docId}`, {
      content,
      changes,
      isOffline,
    });
    return response.data;
  }

  async listVersions(docId: string, page: number = 1, limit: number = 50) {
    const response = await this.client.get(`/api/versions/${docId}?page=${page}&limit=${limit}`);
    return response.data;
  }

  async getVersion(docId: string, versionId: string) {
    const response = await this.client.get(`/api/versions/${docId}/${versionId}`);
    return response.data;
  }

  async getVersionDiff(docId: string, versionId: string, compareVersionId: string) {
    const response = await this.client.get(`/api/versions/${docId}/${versionId}/diff/${compareVersionId}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
