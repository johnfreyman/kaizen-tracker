import React from "react";

interface TeamLogoProps {
  /** Team display name. Used for monogram fallback + alt text. */
  team: string | null;
  /** Uploaded logo URL (from CoachSummaryRow.team_logo). When set, takes precedence over monogram. */
  logoUrl?: string | null;
  /** Tile size in pixels. Default 44. */
  size?: number;
}

/**
 * Square logo tile with three rendering modes:
 *   - <img> when logoUrl is present
 *   - Generated monogram tile (deterministic color + variant) when team has a name
 *   - Dashed placeholder when team is null
 *
 * Variants (driven by hash of team name): solid, diagonal split, diagonal
 * stripe, inner ring. Keeps logos visually distinct without designing each.
 */
export function TeamLogo({ team, logoUrl, size = 44 }: TeamLogoProps) {
  const radius = size * 0.22;

  // Real uploaded logo wins
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={team ?? "Team logo"}
        width={size}
        height={size}
        className="shrink-0 object-cover bg-slate-100"
        style={{ borderRadius: radius }}
      />
    );
  }

  // No team registered
  if (!team) {
    return (
      <div
        className="shrink-0 border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-300 font-bold"
        style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.45 }}
        title="No team registered"
        aria-label="No team registered"
      >
        ?
      </div>
    );
  }

  // Deterministic visual treatment
  let h = 0;
  for (const ch of team) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const variant = h % 4;

  const words = team.split(/\s+/).filter(Boolean);
  const monogram = (
    words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 2).map(w => w[0]).join("")
  ).toUpperCase();

  const bg1 = `oklch(0.50 0.13 ${hue})`;
  const bg2 = `oklch(0.62 0.13 ${(hue + 35) % 360})`;

  let background = bg1;
  let overlay: React.ReactNode = null;
  if (variant === 1) {
    background = `linear-gradient(135deg, ${bg1} 0%, ${bg1} 50%, ${bg2} 50%, ${bg2} 100%)`;
  } else if (variant === 2) {
    overlay = (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          background: `repeating-linear-gradient(135deg, transparent 0, transparent ${size * 0.12}px, rgba(255,255,255,0.16) ${size * 0.12}px, rgba(255,255,255,0.16) ${size * 0.2}px)`,
        }}
      />
    );
  } else if (variant === 3) {
    overlay = (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: size * 0.12,
          borderRadius: radius * 0.7,
          border: `${Math.max(1, size * 0.04)}px solid rgba(255,255,255,0.4)`,
        }}
      />
    );
  }

  return (
    <div
      className="shrink-0 relative flex items-center justify-center text-white font-bold tracking-tight"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background,
        fontSize: size * 0.42,
        textShadow: "0 1px 1px rgba(0,0,0,0.18)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(15,23,42,0.08)",
      }}
      title={team}
      aria-label={team}
    >
      {overlay}
      <span style={{ position: "relative" }}>{monogram}</span>
    </div>
  );
}
