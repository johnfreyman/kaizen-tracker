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
