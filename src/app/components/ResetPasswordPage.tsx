import React, { useState } from "react";
import { Trophy, Lock, ArrowRight, Eye, EyeOff, Sparkles, AlertCircle } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";

export default function ResetPasswordPage() {
  const { updatePassword } = useTeamStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setValidationError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    await updatePassword(password);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950 to-slate-950 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="relative size-20 mx-auto flex items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-[0_8px_30px_rgb(59,130,246,0.3)] border border-blue-400/30">
            <Trophy className="size-10 text-white" />
            <Sparkles className="absolute -top-1 -right-1 size-5 text-yellow-300 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Kaizen Tracker</h1>
            <p className="mt-2 text-sm text-gray-400">Set a new password for your account</p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Set New Password</h2>
            <p className="text-xs text-gray-400">Choose a strong password to secure your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {validationError && (
              <div className="flex gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm animate-shake">
                <AlertCircle className="size-5 shrink-0" />
                <p>{validationError}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                New Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock className="size-5" />
                </div>
                <input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="block w-full pl-11 pr-12 py-3.5 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/15 text-slate-900 text-sm placeholder-slate-400 font-semibold transition-all duration-200 shadow-sm"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm" className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                Confirm Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock className="size-5" />
                </div>
                <input
                  id="reset-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  className="block w-full pl-11 pr-4 py-3.5 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/15 text-slate-900 text-sm placeholder-slate-400 font-semibold transition-all duration-200 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-700/50 disabled:to-indigo-700/50 text-white font-bold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/15 active:scale-[0.98] disabled:cursor-not-allowed text-sm uppercase tracking-wider"
            >
              {isSubmitting ? (
                <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Set Password
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
