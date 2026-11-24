import { create } from 'zustand';
import { apiClient } from '../utils/api';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (payload: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isLoading: false,
  error: null,

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.register(email, password, name);
      set({
        user: response.user,
        token: response.token,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Registration failed',
        isLoading: false,
      });
      throw err;
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(email, password);
      set({
        user: response.user,
        token: response.token,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Login failed',
        isLoading: false,
      });
      throw err;
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await apiClient.getProfile();
      set({ user, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Failed to load profile',
        isLoading: false,
      });
      throw err;
    }
  },

  updateProfile: async (payload: { name?: string; currentPassword?: string; newPassword?: string }) => {
    set({ isLoading: true, error: null });
    try {
      const user = await apiClient.updateProfile(payload);
      set({ user, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Failed to update profile',
        isLoading: false,
      });
      throw err;
    }
  },

  logout: () => {
    apiClient.clearToken();
    set({ user: null, token: null });
  },

  setUser: (user: User | null) => {
    set({ user });
  },
}));
