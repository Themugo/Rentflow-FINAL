import { describe, it, expect, beforeEach } from "vitest";
import {
  DATE_FORMAT,
  TIME_24H,
  TIME_12H,
  DATE_TIME_FORMAT,
  DATE_TIME_FORMAT_12H,
  DATE_TIME_GMT_24H,
  DATE_TIME_GMT_12H,
  getTimeFormat,
  getTimezoneDisplay,
  setTimeFormat,
  setTimezoneDisplay,
  getDateTimeFormat,
  formatDate,
  formatDateTime,
  formatDateTime12h,
  formatDateTime24h,
  formatDateTimeGMT,
} from "@/shared/lib/dateFormat";

const FIXED_DATE = new Date("2026-08-13T14:05:00.000Z");

describe("format constants", () => {
  it("exposes the dd/MM/yy display format", () => {
    expect(DATE_FORMAT).toBe("dd/MM/yy");
  });

  it("exposes 24h and 12h time formats", () => {
    expect(TIME_24H).toBe("HH:mm");
    expect(TIME_12H).toBe("h:mm a");
  });

  it("composes a default 24h date-time format", () => {
    expect(DATE_TIME_FORMAT).toBe(`dd/MM/yy 'at' ${TIME_24H}`);
  });

  it("composes a 12h date-time format", () => {
    expect(DATE_TIME_FORMAT_12H).toBe(`dd/MM/yy 'at' ${TIME_12H}`);
  });

  it("composes GMT-aware formats for both clock styles", () => {
    expect(DATE_TIME_GMT_24H).toBe(`dd/MM/yy 'at' ${TIME_24H} 'GMT'`);
    expect(DATE_TIME_GMT_12H).toBe(`dd/MM/yy 'at' ${TIME_12H} 'GMT'`);
  });
});

describe("localStorage preference helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getTimeFormat defaults to 24h when unset", () => {
    expect(getTimeFormat()).toBe("24h");
  });

  it("setTimeFormat round-trips through localStorage", () => {
    setTimeFormat("12h");
    expect(localStorage.getItem("timeFormat")).toBe("12h");
    expect(getTimeFormat()).toBe("12h");
  });

  it("getTimezoneDisplay defaults to local when unset", () => {
    expect(getTimezoneDisplay()).toBe("local");
  });

  it("setTimezoneDisplay round-trips through localStorage", () => {
    setTimezoneDisplay("gmt");
    expect(localStorage.getItem("timezoneDisplay")).toBe("gmt");
    expect(getTimezoneDisplay()).toBe("gmt");
  });
});

describe("getDateTimeFormat", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the 24h local format by default", () => {
    expect(getDateTimeFormat()).toBe(DATE_TIME_FORMAT);
  });

  it("returns the 12h local format when timeFormat is 12h", () => {
    setTimeFormat("12h");
    expect(getDateTimeFormat()).toBe(DATE_TIME_FORMAT_12H);
  });

  it("returns the 24h GMT format when timezone is gmt", () => {
    setTimezoneDisplay("gmt");
    expect(getDateTimeFormat()).toBe(DATE_TIME_GMT_24H);
  });

  it("returns the 12h GMT format when both 12h and gmt are set", () => {
    setTimeFormat("12h");
    setTimezoneDisplay("gmt");
    expect(getDateTimeFormat()).toBe(DATE_TIME_GMT_12H);
  });
});

describe("formatDate", () => {
  it("formats a Date object using dd/MM/yy", () => {
    // Use a UTC-stable date to avoid TZ flakiness: 2026-08-13.
    expect(formatDate(new Date("2026-08-13T00:00:00Z"))).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
  });

  it("formats an ISO date string", () => {
    expect(formatDate("2026-08-13T00:00:00Z")).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
  });

  it("returns the fallback for null", () => {
    expect(formatDate(null)).toBe("Invalid date");
  });

  it("returns the fallback for undefined", () => {
    expect(formatDate(undefined)).toBe("Invalid date");
  });

  it("returns the fallback for an invalid date string", () => {
    expect(formatDate("not-a-date")).toBe("Invalid date");
  });
});

describe("formatDateTime (local 24h default)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("formats a valid date", () => {
    const out = formatDateTime(FIXED_DATE);
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{2} at \d{2}:\d{2}/);
  });

  it("returns the fallback for null", () => {
    expect(formatDateTime(null)).toBe("Invalid date");
  });

  it("returns the fallback for an invalid date", () => {
    expect(formatDateTime("nope")).toBe("Invalid date");
  });
});

describe("formatDateTime12h", () => {
  it("uses the 12h format regardless of preferences", () => {
    const out = formatDateTime12h(FIXED_DATE);
    expect(out).toMatch(/.M$/);
  });

  it("returns the fallback for null", () => {
    expect(formatDateTime12h(null)).toBe("Invalid date");
  });
});

describe("formatDateTime24h", () => {
  it("uses the 24h format regardless of preferences", () => {
    const out = formatDateTime24h(FIXED_DATE);
    expect(out).toMatch(/\d{2}:\d{2}$/);
  });

  it("returns the fallback for null", () => {
    expect(formatDateTime24h(null)).toBe("Invalid date");
  });
});

describe("formatDateTimeGMT", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("appends GMT and defaults to 24h", () => {
    const out = formatDateTimeGMT(FIXED_DATE);
    expect(out).toContain("GMT");
    expect(out).toMatch(/\d{2}:\d{2} GMT$/);
  });

  it("uses the 12h clock when timeFormat is 12h", () => {
    setTimeFormat("12h");
    const out = formatDateTimeGMT(FIXED_DATE);
    expect(out).toContain("GMT");
    expect(out).toMatch(/.M GMT$/);
  });

  it("returns the fallback for null", () => {
    expect(formatDateTimeGMT(null)).toBe("Invalid date");
  });
});
