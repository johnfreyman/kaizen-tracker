import React, { useState, useEffect, useRef } from "react";
import { X, UserPlus, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface InviteCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteCoachModal({ isOpen, onClose }: InviteCoachModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-coach-actions", {
        body: { action: "invite-coach", email: trimmed },
      });

      if (error) {
        let message = error.message;
        try {
          const parsed = await (error as any).context?.json?.();
          if (parsed?.error) message = parsed.error;
        } catch {}
        throw new Error(message);
      }

      toast.success(`Invite sent to ${trimmed}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send invite.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto border border-slate-200 animate-in zoom-in-95 slide-in-from-top-4 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <UserPlus className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Invite Coach</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <p className="text-sm text-slate-500">
              An invite link will be emailed to the address below. The coach will be prompted to set a password on first sign-in.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-email" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@example.com"
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send Invite"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
