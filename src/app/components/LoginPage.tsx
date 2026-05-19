import React, { useState } from "react";
import { Trophy, Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";

export default function LoginPage() {
  const { login, isAuthLoading, authError } = useTeamStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"password" | "magic-link">("password");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError("Please enter your email address.");
      return;
    }

    if (authMode === "password" && !password) {
      setValidationError("Please enter your password.");
      return;
    }

    if (authMode === "password") {
      const success = await login(trimmedEmail, password);
      if (success) {
        // App state automatically handles auth state updates and re-renders AppContent
      }
    } else {
      const success = await login(trimmedEmail);
      if (success) {
        setMagicLinkSent(true);
      }
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-fade-in">
          <div className="size-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Check your email</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              We have sent a secure magic link to <span className="font-semibold text-blue-400">{email}</span>. Click the link in the email to log in instantly.
            </p>
          </div>
          <button
            onClick={() => setMagicLinkSent(false)}
            className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-2xl border border-white/10 hover:border-white/20 transition-all text-sm active:scale-[0.98]"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950 to-slate-950 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* App Logo */}
        <div className="text-center space-y-3">
          <div className="relative size-20 mx-auto flex items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-[0_8px_30px_rgb(59,130,246,0.3)] border border-blue-400/30">
            <Trophy className="size-10 text-white" />
            <Sparkles className="absolute -top-1 -right-1 size-5 text-yellow-300 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-clip-text bg-gradient-to-r from-white via-blue-100 to-indigo-200">
              Kaizen Tracker
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Sign in to manage team attendance & training hours
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-black/35 rounded-2xl border border-white/5">
            <button
              onClick={() => {
                setAuthMode("password");
                setValidationError(null);
              }}
              disabled={isAuthLoading}
              className={`py-2 text-sm font-semibold rounded-xl transition-all ${
                authMode === "password"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => {
                setAuthMode("magic-link");
                setValidationError(null);
              }}
              disabled={isAuthLoading}
              className={`py-2 text-sm font-semibold rounded-xl transition-all ${
                authMode === "magic-link"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error alerts */}
            {(authError || validationError) && (
              <div className="flex gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm animate-shake">
                <AlertCircle className="size-5 shrink-0" />
                <p>{validationError || authError}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail className="size-5" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isAuthLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full pl-11 pr-4 py-3.5 bg-black/20 hover:bg-black/35 focus:bg-black/30 border border-white/10 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-white text-sm placeholder-gray-500 font-medium transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            {authMode === "password" && (
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Lock className="size-5" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isAuthLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-11 pr-12 py-3.5 bg-black/20 hover:bg-black/35 focus:bg-black/30 border border-white/10 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 text-white text-sm placeholder-gray-500 font-medium transition-all"
                  />
                  <button
                    type="button"
                    disabled={isAuthLoading}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              id="login-submit-button"
              disabled={isAuthLoading}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-700/50 disabled:to-indigo-700/50 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.98] disabled:cursor-not-allowed text-sm uppercase tracking-wider"
            >
              {isAuthLoading ? (
                <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {authMode === "password" ? "Sign In" : "Send Magic Link"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
