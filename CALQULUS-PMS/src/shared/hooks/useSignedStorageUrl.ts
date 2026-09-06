import { useEffect, useState } from "react";
import { toDisplayUrl } from "@/shared/lib/storageUtils";

/** Resolves a stored public/path URL to a time-limited signed URL for private buckets. */
export function useSignedStorageUrl(storedUrl: string | null | undefined): string {
  const [url, setUrl] = useState(storedUrl ?? "");

  useEffect(() => {
    let cancelled = false;
    setUrl(storedUrl ?? "");
    if (!storedUrl) return;
    void toDisplayUrl(storedUrl).then((signed) => {
      if (!cancelled && signed) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  return url;
}
