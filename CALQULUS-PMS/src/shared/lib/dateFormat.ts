import { format, isValid } from "date-fns";

// Base date format - dd/MM/yy used everywhere for display
export const DATE_FORMAT = "dd/MM/yy";

// Time format constants
export const TIME_24H = "HH:mm";
export const TIME_12H = "h:mm a";

// Date-time format combinations (24-hour default)
export const DATE_TIME_FORMAT = `dd/MM/yy 'at' ${TIME_24H}`;
export const DATE_TIME_FORMAT_12H = `dd/MM/yy 'at' ${TIME_12H}`;

// GMT-aware formats
export const DATE_TIME_GMT_24H = `dd/MM/yy 'at' ${TIME_24H} 'GMT'`;
export const DATE_TIME_GMT_12H = `dd/MM/yy 'at' ${TIME_12H} 'GMT'`;

const FALLBACK = "Invalid date";

// Get stored time format preference (24h or 12h)
export const getTimeFormat = (): "24h" | "12h" => {
  if (typeof window === "undefined") return "24h";
  return (localStorage.getItem("timeFormat") as "24h" | "12h") || "24h";
};

// Get stored timezone preference (GMT or local)
export const getTimezoneDisplay = (): "gmt" | "local" => {
  if (typeof window === "undefined") return "local";
  return (localStorage.getItem("timezoneDisplay") as "gmt" | "local") || "local";
};

// Set time format preference
export const setTimeFormat = (fmt: "24h" | "12h") => {
  if (typeof window !== "undefined") {
    localStorage.setItem("timeFormat", fmt);
  }
};

// Set timezone display preference
export const setTimezoneDisplay = (tz: "gmt" | "local") => {
  if (typeof window !== "undefined") {
    localStorage.setItem("timezoneDisplay", tz);
  }
};

// Get the correct date-time format based on user preferences
export const getDateTimeFormat = (): string => {
  const timeFmt = getTimeFormat();
  const tz = getTimezoneDisplay();

  if (tz === "gmt") {
    return timeFmt === "12h" ? DATE_TIME_GMT_12H : DATE_TIME_GMT_24H;
  }
  return timeFmt === "12h" ? DATE_TIME_FORMAT_12H : DATE_TIME_FORMAT;
};

// Format date using the preferred format
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return FALLBACK;
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!isValid(dateObj)) return FALLBACK;
  return format(dateObj, DATE_FORMAT);
};

// Format date-time using user preferences (12h/24h, GMT/local)
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return FALLBACK;
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!isValid(dateObj)) return FALLBACK;
  const fmt = getDateTimeFormat();
  return format(dateObj, fmt);
};

// Force 12-hour format (legacy compatibility)
export const formatDateTime12h = (date: string | Date | null | undefined): string => {
  if (!date) return FALLBACK;
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!isValid(dateObj)) return FALLBACK;
  return format(dateObj, DATE_TIME_FORMAT_12H);
};

// Force 24-hour format
export const formatDateTime24h = (date: string | Date | null | undefined): string => {
  if (!date) return FALLBACK;
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!isValid(dateObj)) return FALLBACK;
  return format(dateObj, DATE_TIME_FORMAT);
};

// Format with GMT timezone display
export const formatDateTimeGMT = (date: string | Date | null | undefined): string => {
  if (!date) return FALLBACK;
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!isValid(dateObj)) return FALLBACK;
  const timeFmt = getTimeFormat();
  const fmt = timeFmt === "12h" ? DATE_TIME_GMT_12H : DATE_TIME_GMT_24H;
  return format(dateObj, fmt);
};
