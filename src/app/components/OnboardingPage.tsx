import { useState, useRef } from "react";
import { ArrowRight, Upload, ShieldCheck } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";

const CONSENT_VERSION = "1.0";

export default function OnboardingPage() {
  const { updateSettings, uploadLogo, completeOnboarding } = useTeamStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [consentChecked, setConsentChecked] = useState(false);
  const [teamName, setTeamName] = useState("My Team");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consentTimestampRef = useRef<string | null>(null);

  const nameValid = teamName.trim().length >= 2;

  const handleConsentAgree = () => {
    if (!consentChecked) return;
    consentTimestampRef.current = new Date().toISOString();
    setStep(2);
  };

  const handleContinue = () => {
    if (!nameValid) return;
    setStep(3);
  };

  const finish = async (file?: File) => {
    if (file) {
      setIsUploading(true);
      setUploadError(null);
      try {
        await uploadLogo(file);
      } catch {
        setUploadError("Upload failed. You can add a logo later in Settings.");
      } finally {
        setIsUploading(false);
      }
    }
    await updateSettings({
      teamName: teamName.trim(),
      ...(consentTimestampRef.current && {
        consentAgreedAt: consentTimestampRef.current,
        consentVersion:  CONSENT_VERSION,
      }),
    });
    completeOnboarding();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) finish(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-[#0b1329] dark:via-[#0d1117] dark:to-[#0b1329] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {([1, 2, 3] as const).map((n) => (
            <div
              key={n}
              className={`h-2 rounded-full transition-all duration-300 ${
                n === step
                  ? "w-8 bg-indigo-600"
                  : n < step
                  ? "w-2 bg-indigo-400"
                  : "w-2 bg-gray-200 dark:bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="backdrop-blur-sm rounded-3xl shadow-xl p-8 border mc-border" style={{ background: "var(--mc-card)" }}>

          {/* ── Step 1: Consent ─────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="size-5 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mc-text leading-tight">Before you get started</h2>
                  <p className="text-xs mc-text-secondary">Data & Privacy Agreement</p>
                </div>
              </div>

              <div
                className="rounded-2xl border mc-border p-4 mb-5 text-sm mc-text-secondary space-y-3 overflow-y-auto"
                style={{ background: "var(--mc-surface)", maxHeight: "260px" }}
              >
                <p className="font-semibold mc-text">What data this app collects</p>
                <p>
                  Kaizen Tracker stores the following information in a secured cloud database on
                  behalf of your organization:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Player first and last names</li>
                  <li>Session attendance records (dates, session type, duration)</li>
                  <li>Team name and logo</li>
                  <li>Your coach account email address</li>
                </ul>

                <p className="font-semibold mc-text pt-1">Your responsibility as the coach</p>
                <p>
                  This platform is intended for use by coaches and authorized staff only. Player
                  data is entered by you — players do not have accounts and do not submit their own
                  information.
                </p>
                <p>
                  By using this app you represent that you are an authorized representative of
                  your sports organization and that you have obtained, or your organization has
                  obtained, consent from the parent or legal guardian of each minor athlete whose
                  information you enter. This includes consent to collect and store their child's
                  name and attendance records for the purpose of tracking sports participation.
                </p>

                <p className="font-semibold mc-text pt-1">How data is used</p>
                <p>
                  Data is used solely to display attendance reports and leaderboard information
                  within this tool. It is not sold, shared with third parties, or used for
                  advertising. You can delete a player's data at any time from the Settings page.
                </p>

                <p className="font-semibold mc-text pt-1">Children's privacy (COPPA notice)</p>
                <p>
                  This application is not directed at children and does not knowingly collect
                  information directly from minors. All data about minor athletes is entered
                  by an authorized adult coach. If you believe data has been entered without
                  proper parental consent, contact us immediately to have it removed.
                </p>

                <p className="text-xs mc-text-muted pt-1">
                  This agreement will be updated as the platform evolves. Material changes will
                  be communicated at your next login.
                </p>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 mb-5 cursor-pointer group">
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`size-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      consentChecked
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-gray-300 dark:border-white/20 group-hover:border-indigo-400"
                    }`}
                  >
                    {consentChecked && (
                      <svg className="size-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm mc-text-secondary leading-snug">
                  I confirm that I have obtained, or my organization has obtained, parental or
                  guardian consent for all minor athletes I add to this platform.
                </span>
              </label>

              <button
                onClick={handleConsentAgree}
                disabled={!consentChecked}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/25 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                I Agree — Continue
                <ArrowRight className="size-4" />
              </button>
            </>
          )}

          {/* ── Step 2: Team name ────────────────────────────────── */}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold mc-text mb-1">Name your team</h2>
              <p className="text-sm mc-text-secondary mb-6">You can change this anytime in Settings.</p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nameValid && handleContinue()}
                  placeholder="e.g. Varsity Soccer"
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-2xl border mc-border focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 transition-all font-medium"
                  style={{ background: "var(--mc-surface)", color: "var(--mc-text-primary)" }}
                />
                <button
                  onClick={handleContinue}
                  disabled={!nameValid}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/25 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Logo ─────────────────────────────────────── */}
          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold mc-text mb-1">Add a team logo</h2>
              <p className="text-sm mc-text-secondary mb-6">
                Optional — you can add one later in Settings.
              </p>

              {uploadError && (
                <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {uploadError}
                </div>
              )}

              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/25 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isUploading ? (
                    <>
                      <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Upload logo
                    </>
                  )}
                </button>
                <button
                  onClick={() => finish()}
                  disabled={isUploading}
                  className="w-full py-3.5 px-6 rounded-2xl mc-text-secondary font-semibold hover:bg-[var(--mc-card-hover)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
