import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SUPPORTED_LOCALES,
  RTL_LANGUAGES,
  LOCALE_CONFIG,
  t,
  tInterpolate,
  getPlural,
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  getDirection,
  isRTL,
  getBrowserLocale,
  getRTLAwareStyles,
  useTranslations,
} from "@/shared/lib/localization";

describe("SUPPORTED_LOCALES", () => {
  it("includes English, Swahili, Arabic, and French", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "sw", "ar", "fr"]);
  });
});

describe("RTL_LANGUAGES", () => {
  it("only lists Arabic as RTL", () => {
    expect(RTL_LANGUAGES).toEqual(["ar"]);
  });
});

describe("LOCALE_CONFIG", () => {
  it("has a config entry for every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_CONFIG[locale]).toBeDefined();
      expect(LOCALE_CONFIG[locale].name).toBeTruthy();
      expect(LOCALE_CONFIG[locale].nativeName).toBeTruthy();
      expect(LOCALE_CONFIG[locale].currencyCode).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("marks Arabic as rtl and the rest as ltr", () => {
    expect(LOCALE_CONFIG.ar.direction).toBe("rtl");
    expect(LOCALE_CONFIG.en.direction).toBe("ltr");
    expect(LOCALE_CONFIG.sw.direction).toBe("ltr");
    expect(LOCALE_CONFIG.fr.direction).toBe("ltr");
  });

  it("configures Swahili with the Kenyan shilling", () => {
    expect(LOCALE_CONFIG.sw.currencyCode).toBe("KES");
  });
});

describe("t", () => {
  it("returns the English translation by default", () => {
    expect(t("common.save")).toBe("Save");
  });

  it("returns the Swahili translation for the sw locale", () => {
    expect(t("common.save", "sw")).toBe("Hifadhi");
  });

  it("returns the Arabic translation for the ar locale", () => {
    expect(t("common.save", "ar")).toBe("حفظ");
  });

  it("returns the French translation for the fr locale", () => {
    expect(t("common.save", "fr")).toBe("Enregistrer");
  });

  it("translates navigation keys in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const value = t("nav.dashboard", locale);
      expect(value).toBeTruthy();
      expect(value).not.toBe("nav.dashboard");
    }
  });
});

describe("tInterpolate", () => {
  it("replaces placeholders with parameter values", () => {
    const message = tInterpolate("common.loading", {}, "en");
    expect(message).toBe("Loading...");
  });

  it("returns the base message when no placeholders exist", () => {
    const message = tInterpolate("common.save", { unused: "value" }, "en");
    expect(message).toBe("Save");
  });
});

describe("getPlural", () => {
  it("returns the zero form for count 0 when provided", () => {
    expect(getPlural(0, { zero: "no items", one: "one item", other: "items" })).toBe("no items");
  });

  it("falls back to other for count 0 when no zero form is provided", () => {
    expect(getPlural(0, { one: "one item", other: "items" })).toBe("items");
  });

  it("returns the one form for count 1", () => {
    expect(getPlural(1, { one: "one item", other: "items" })).toBe("one item");
  });

  it("returns the other form for counts above 1 in English", () => {
    expect(getPlural(5, { one: "one item", other: "items" })).toBe("items");
  });

  it("uses the two form for count 2 in Arabic", () => {
    expect(
      getPlural(2, { one: "واحد", two: "اثنان", other: "عدد" }, "ar"),
    ).toBe("اثنان");
  });

  it("uses the few form for counts 3-10 in Arabic", () => {
    expect(
      getPlural(5, { one: "واحد", few: "قليل", other: "عدد" }, "ar"),
    ).toBe("قليل");
  });

  it("uses the many form for counts above 10 in Arabic", () => {
    expect(
      getPlural(20, { one: "واحد", many: "كثير", other: "عدد" }, "ar"),
    ).toBe("كثير");
  });

  it("falls back to other when the specific Arabic form is missing", () => {
    expect(getPlural(2, { one: "واحد", other: "عدد" }, "ar")).toBe("عدد");
  });
});

describe("formatDate", () => {
  it("formats a Date object", () => {
    const out = formatDate(new Date("2026-01-15T12:00:00Z"), "en");
    expect(out).toBeTruthy();
    expect(typeof out).toBe("string");
  });

  it("accepts an ISO date string", () => {
    const out = formatDate("2026-01-15T12:00:00Z", "en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    });
    expect(out).toContain("2026");
    expect(out).toContain("01");
    expect(out).toContain("15");
  });

  it("honours per-locale formatting", () => {
    const en = formatDate("2026-01-15T12:00:00Z", "en", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    const fr = formatDate("2026-01-15T12:00:00Z", "fr", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    expect(en.toLowerCase()).toContain("january");
    expect(fr.toLowerCase()).toContain("janvier");
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes times seconds ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    const out = formatRelativeTime(new Date("2026-06-01T11:59:30Z"), "en");
    expect(out.toLowerCase()).toContain("second");
  });

  it("describes times minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    const out = formatRelativeTime(new Date("2026-06-01T11:30:00Z"), "en");
    expect(out.toLowerCase()).toContain("minute");
  });

  it("describes times hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    const out = formatRelativeTime(new Date("2026-06-01T09:00:00Z"), "en");
    expect(out.toLowerCase()).toContain("hour");
  });

  it("describes times days ago and accepts ISO strings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
    const out = formatRelativeTime("2026-06-07T12:00:00Z", "en");
    expect(out.toLowerCase()).toContain("day");
  });

  it("describes future times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    const out = formatRelativeTime(new Date("2026-06-01T14:00:00Z"), "en");
    expect(out.toLowerCase()).toContain("hour");
  });
});

describe("formatNumber", () => {
  it("groups thousands with commas in English", () => {
    expect(formatNumber(1234567, "en")).toBe("1,234,567");
  });

  it("passes through Intl.NumberFormat options", () => {
    expect(formatNumber(0.42, "en", { style: "percent" })).toBe("42%");
  });
});

describe("formatCurrency", () => {
  it("uses the locale's configured currency by default", () => {
    const out = formatCurrency(1500, "sw");
    expect(out).toContain("1,500");
    expect(out).toMatch(/KES|KSh/i);
  });

  it("formats USD for the English locale", () => {
    const out = formatCurrency(1500, "en");
    expect(out).toContain("$");
    expect(out).toContain("1,500");
  });

  it("allows overriding the currency", () => {
    const out = formatCurrency(1500, "en", "KES");
    expect(out).toMatch(/KES|KSh/);
    expect(out).toContain("1,500");
  });
});

describe("getDirection", () => {
  it("returns rtl for Arabic", () => {
    expect(getDirection("ar")).toBe("rtl");
  });

  it("returns ltr for non-Arabic locales and the default", () => {
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("sw")).toBe("ltr");
    expect(getDirection("fr")).toBe("ltr");
    expect(getDirection()).toBe("ltr");
  });
});

describe("isRTL", () => {
  it("is true only for Arabic", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("en")).toBe(false);
    expect(isRTL("sw")).toBe(false);
    expect(isRTL("fr")).toBe(false);
  });
});

describe("getBrowserLocale", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a supported locale matching the browser language", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("sw-KE");
    expect(getBrowserLocale()).toBe("sw");
  });

  it("falls back to English for unsupported browser languages", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("de-DE");
    expect(getBrowserLocale()).toBe("en");
  });
});

describe("getRTLAwareStyles", () => {
  it("returns styles unchanged for LTR locales", () => {
    const styles = { paddingLeft: "8px", color: "red" };
    expect(getRTLAwareStyles(styles, "en")).toEqual(styles);
  });

  it("swaps paddingLeft to paddingRight for RTL locales", () => {
    const out = getRTLAwareStyles({ marginRight: "4px" }, "ar");
    expect(out.marginLeft).toBe("4px");
    expect("marginRight" in out).toBe(false);
  });

  it("does not mutate the input styles object", () => {
    const styles = { marginRight: "4px" };
    getRTLAwareStyles(styles, "ar");
    expect(styles).toEqual({ marginRight: "4px" });
  });
});

describe("useTranslations", () => {
  it("binds translation helpers to the given locale", () => {
    const tr = useTranslations("sw");
    expect(tr.t("common.save")).toBe("Hifadhi");
    expect(tr.locale).toBe("sw");
    expect(tr.direction).toBe("ltr");
    expect(tr.isRTL).toBe(false);
  });

  it("reports RTL metadata for Arabic", () => {
    const tr = useTranslations("ar");
    expect(tr.direction).toBe("rtl");
    expect(tr.isRTL).toBe(true);
  });

  it("exposes bound pluralization and formatting helpers", () => {
    const tr = useTranslations("en");
    expect(tr.getPlural(1, { one: "one item", other: "items" })).toBe("one item");
    expect(tr.formatNumber(1000)).toBe("1,000");
    expect(tr.formatCurrency(100, "KES")).toContain("100");
    expect(typeof tr.formatDate("2026-01-15T12:00:00Z")).toBe("string");
  });

  it("defaults to English", () => {
    const tr = useTranslations();
    expect(tr.t("common.save")).toBe("Save");
    expect(tr.locale).toBe("en");
  });
});
