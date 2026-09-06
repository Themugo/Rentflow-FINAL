import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

export function useCurrency() {
  const { user } = useAuth();
  const userId = user?.id;
  const [currency, setCurrencyState] = useState<CurrencyCode>("KES");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchCurrency = async () => {
      if (!userId) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("currency")
        .eq("id", userId)
        .maybeSingle();

      if (isMounted) {
        if (data?.currency) {
          setCurrencyState(data.currency as CurrencyCode);
        }
        setLoading(false);
      }
    };

    fetchCurrency();
    return () => { isMounted = false; };
  }, [userId]);

  const setCurrency = useCallback(async (value: CurrencyCode) => {
    setCurrencyState(value);
    if (userId) {
      await supabase.rpc('update_profile_currency_atomic', { p_currency: value });
    }
  }, [userId]);

  const formatCurrency = useCallback((amount: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    }).format(amount);
  }, [currency]);

  const formatCurrencyCompact = useCallback((value: number) => {
    if (value >= 1000) {
      const symbol = CURRENCIES.find(c => c.code === currency)?.symbol || "$";
      return `${symbol}${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  }, [currency, formatCurrency]);

  return useMemo(() => ({
    currency,
    setCurrency,
    formatCurrency,
    formatCurrencyCompact,
    loading,
    currencies: CURRENCIES,
  }), [currency, setCurrency, formatCurrency, formatCurrencyCompact, loading]);
}
