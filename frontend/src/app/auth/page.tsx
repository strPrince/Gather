"use client";

import React, { useState } from "react";
import { ArrowRight, Check, FileText, LockKeyhole, Sparkles, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AuthPage() {
  const router = useRouter();
  const { login, register, isLoading, error } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLocalError(null);
    try { mode === "login" ? await login(email, password) : await register(email, password, name); router.push("/"); }
    catch (err: any) { setLocalError(err?.response?.data?.error?.message || "We could not authenticate you. Check your details and try again."); }
  }

  const benefits = [
    { icon: Zap, title: "Move from idea to draft", body: "Write, organize, and refine without leaving your workspace." },
    { icon: Users, title: "Keep everyone aligned", body: "Collaborate in context with clear ownership and shared history." },
    { icon: LockKeyhole, title: "Stay in control", body: "Role-aware access and offline support keep your work close." },
  ];

  return (
    <main className="auth-saas-page">
      <header className="auth-saas-header"><a className="auth-brand" href="/"><span className="auth-brand-mark"><Sparkles size={16} /></span><span>Synapsribe</span></a><span className="auth-header-note">Private beta <span className="auth-header-dot" /> Secure by design</span></header>
      <div className="auth-saas-layout">
        <section className="auth-saas-intro" aria-labelledby="auth-intro-title"><div className="auth-kicker"><span className="auth-kicker-line" /> Collaborative docs for focused teams</div><h1 id="auth-intro-title">Turn scattered thoughts into shared momentum.</h1><p className="auth-intro-copy">A calmer place to write, review, and move important work forward, together.</p><div className="auth-benefits">{benefits.map(({ icon: Icon, title, body }) => <div className="auth-benefit" key={title}><span className="auth-benefit-icon"><Icon size={17} /></span><div><strong>{title}</strong><p>{body}</p></div></div>)}</div><div className="auth-proof"><div className="auth-avatars"><span>R</span><span>M</span><span>S</span><span>+</span></div><div><strong>Built for teams that care about clarity.</strong><small>Join the next generation of thoughtful workspaces.</small></div></div></section>
        <section className="auth-form-panel" aria-labelledby="auth-form-title"><div className="auth-panel-top"><span className="auth-form-icon"><FileText size={18} /></span><div><span className="auth-panel-kicker">Your workspace</span><h2 id="auth-form-title">{mode === "login" ? "Welcome back" : "Create your workspace"}</h2></div></div><div className="auth-tabs" role="tablist"><button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setLocalError(null); }}>Sign in</button><button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => { setMode("register"); setLocalError(null); }}>Create account</button></div><form onSubmit={handleSubmit} className="auth-form"><div className="auth-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" /></div>{mode === "register" && <div className="auth-field"><label htmlFor="auth-name">Full name</label><input id="auth-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" required autoComplete="name" /></div>}<div className="auth-field"><div className="auth-label-row"><label htmlFor="auth-password">Password</label>{mode === "login" && <button type="button" className="auth-inline-link">Forgot password?</button>}</div><input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required autoComplete={mode === "login" ? "current-password" : "new-password"} /></div>{(error || localError) && <div className="auth-error" role="alert">{localError || error}</div>}<button type="submit" className="auth-submit" disabled={isLoading}>{isLoading ? <><span className="auth-spinner" /> Working...</> : <>{mode === "login" ? "Sign in to workspace" : "Create your account"}<ArrowRight size={16} /></>}</button></form><p className="auth-terms">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p><div className="auth-security"><LockKeyhole size={14} /><span>Your work is protected with encrypted storage and secure sessions.</span></div></section>
      </div>
      <footer className="auth-saas-footer"><span>© 2026 Synapsribe</span><span className="auth-footer-links"><a href="#status"><span className="auth-status-dot" /> All systems operational</a><a href="#help">Need help?</a></span></footer>
    </main>
  );
}
