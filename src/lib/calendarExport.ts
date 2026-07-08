/**
 * Calendar Export Utility
 * Generates .ics files for adding events to calendar applications
 */

export interface CalendarEvent {
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate?: Date;
  url?: string;
}

/**
 * Format a date for ICS format (UTC)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text for ICS format
 * Handles special characters and line breaks
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Fold long lines per ICS spec (max 75 chars)
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }
  
  const result: string[] = [];
  let remaining = line;
  
  while (remaining.length > maxLength) {
    result.push(remaining.substring(0, maxLength));
    remaining = " " + remaining.substring(maxLength);
  }
  result.push(remaining);
  
  return result.join("\r\n");
}

/**
 * Generate a unique identifier for the event
 */
function generateUID(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}@zothub.app`;
}

/**
 * Generate ICS content for a calendar event
 */
export function generateICS(event: CalendarEvent): string {
  const now = new Date();
  const startDate = new Date(event.startDate);
  // Default to 2 hours if no end date provided
  const endDate = event.endDate || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZotHub//ZotHub Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${generateUID()}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ];
  
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }
  
  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
  }
  
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  
  lines.push("END:VEVENT", "END:VCALENDAR");
  
  // Fold long lines and join with CRLF
  return lines.map(foldLine).join("\r\n");
}

/**
 * Download ICS file
 */
export function downloadICS(event: CalendarEvent, filename?: string): void {
  const content = generateICS(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  
  const safeName = filename || event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${safeName}.ics`;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Add to Calendar links for various providers
 */
export function getCalendarLinks(event: CalendarEvent): {
  google: string;
  outlook: string;
  yahoo: string;
} {
  const startDate = new Date(event.startDate);
  const endDate = event.endDate || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  
  const formatGoogleDate = (date: Date): string => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, "");
  };
  
  const title = encodeURIComponent(event.title);
  const description = encodeURIComponent(event.description || "");
  const location = encodeURIComponent(event.location || "");
  
  // Google Calendar
  const googleUrl = new URL("https://calendar.google.com/calendar/render");
  googleUrl.searchParams.set("action", "TEMPLATE");
  googleUrl.searchParams.set("text", event.title);
  googleUrl.searchParams.set("dates", `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
  if (event.description) googleUrl.searchParams.set("details", event.description);
  if (event.location) googleUrl.searchParams.set("location", event.location);
  
  // Outlook
  const outlookUrl = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlookUrl.searchParams.set("subject", event.title);
  outlookUrl.searchParams.set("startdt", startDate.toISOString());
  outlookUrl.searchParams.set("enddt", endDate.toISOString());
  if (event.description) outlookUrl.searchParams.set("body", event.description);
  if (event.location) outlookUrl.searchParams.set("location", event.location);
  
  // Yahoo
  const yahooUrl = new URL("https://calendar.yahoo.com/");
  yahooUrl.searchParams.set("v", "60");
  yahooUrl.searchParams.set("title", event.title);
  yahooUrl.searchParams.set("st", formatGoogleDate(startDate));
  yahooUrl.searchParams.set("et", formatGoogleDate(endDate));
  if (event.description) yahooUrl.searchParams.set("desc", event.description);
  if (event.location) yahooUrl.searchParams.set("in_loc", event.location);
  
  return {
    google: googleUrl.toString(),
    outlook: outlookUrl.toString(),
    yahoo: yahooUrl.toString(),
  };
}
