import { useState, useRef } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { useTeamStore } from "../hooks/useTeamStore";

export default function OnboardingPage() {
  const { updateSettings, uploadLogo, completeOnboarding } = useTeamStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [teamName, setTeamName] = useState("My Team");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameValid = teamName.trim().length >= 2;

  const handleContinue = () => {
    if (!nameValid) return;
    setStep(2);
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
    await updateSettings({ teamName: teamName.trim() });
    completeOnboarding();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) finish(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {([1, 2] as const).map((n) => (
            <div
              key={n}
              className={`h-2 rounded-full transition-all duration-300 ${
                n === step
                  ? "w-8 bg-blue-600"
                  : n < step
                  ? "w-2 bg-blue-400"
                  : "w-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8">
          {step === 1 ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Name your team</h2>
              <p className="text-sm text-gray-500 mb-6">You can change this anytime in Settings.</p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nameValid && handleContinue()}
                  placeholder="e.g. Varsity Soccer"
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all font-medium"
                />
                <button
                  onClick={handleContinue}
                  disabled={!nameValid}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Add a team logo</h2>
              <p className="text-sm text-gray-500 mb-6">
                Optional — you can add one later in Settings.
              </p>

              {uploadError && (
                <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
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
                  className="w-full py-3.5 px-6 rounded-2xl text-gray-600 font-semibold hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
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
