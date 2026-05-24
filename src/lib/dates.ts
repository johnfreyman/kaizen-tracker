export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
}

/**
 * Formats a date string consistently across different user timezones.
 * For date-only strings (e.g. YYYY-MM-DD), it appends 'T12:00:00' so parsing is anchored to midday local time
 * and does not shift backward/forward based on timezone offsets.
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  if (!dateString) return "";
  // Check if the string already has a time component (contains 'T', ' ', or ':')
  const hasTime = dateString.includes("T") || dateString.includes(" ") || (dateString.includes(":") && !dateString.startsWith("http"));
  const parsedString = hasTime ? dateString : `${dateString}T12:00:00`;
  return new Date(parsedString).toLocaleDateString(undefined, options);
}
