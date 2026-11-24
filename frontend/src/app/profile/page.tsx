"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, fetchProfile, updateProfile, logout, isLoading, error } = useAuthStore();

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push("/auth");
      return;
    }
    if (!user) {
      fetchProfile().catch(() => {
        logout();
        router.push("/auth");
      });
    }
  }, [token, user, fetchProfile, logout, router]);

  useEffect(() => {
    if (user) setName(user.name || "");
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await updateProfile({
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword("");
      setNewPassword("");
      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setLocalError(err?.response?.data?.error?.message || "Failed to update profile");
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </main>
    );
  }

  return (
    <main className="site-page site-profile min-h-screen p-6 relative overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">Profile</p>
            <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
            <p className="text-[var(--text-secondary)]">Manage your profile and security preferences</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              <span className="badge badge-neutral border-0 bg-white/10 text-white">Identity verified</span>
              <span className="badge badge-neutral border-0 bg-white/10 text-white">Session active</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push("/")} className="btn-secondary">
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to App
            </button>
            <button onClick={logout} className="btn-secondary text-red-400 hover:bg-red-500/10">
              <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="card p-6 text-center relative overflow-hidden">
              <div className="relative">
              <div className="w-20 h-20 mx-auto mb-4 bg-[var(--accent-glow)] rounded-full flex items-center justify-center text-2xl font-bold text-[var(--accent)]">
                {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-semibold mb-1">{user.name || "User"}</h2>
              <p className="text-[var(--text-secondary)] text-sm mb-4">{user.email}</p>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
                  <span>Member since</span>
                  <span className="text-white">{new Date((user as any).createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
                  <span>Status</span>
                  <span className="badge badge-success">Active</span>
                </div>
              </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {successMessage && (
              <div className="p-4 rounded-lg bg-[rgba(182,146,72,0.12)] border border-[rgba(182,146,72,0.24)] text-[#d0aa5d] flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {(error || localError) && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{localError || error}</span>
              </div>
            )}

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[var(--accent-glow)] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Personal Information</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Update your account details</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                    Email address
                  </label>
                  <input
                    type="email"
                    className="input w-full opacity-60 cursor-not-allowed"
                    value={user.email}
                    disabled
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                    Full name
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isLoading} className="btn-primary">
                    {isLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Security Settings</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Change your password</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                    Current password
                  </label>
                  <input
                    type="password"
                    className="input w-full"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                    New password
                  </label>
                  <input
                    type="password"
                    className="input w-full"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Use 8+ characters with a mix of letters, numbers & symbols
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading || !currentPassword || !newPassword}
                    className="btn-primary"
                  >
                    {isLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
