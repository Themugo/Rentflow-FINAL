import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if a URL is a full URL or a storage path
 */
export const isFullUrl = (url: string): boolean => {
  return url.startsWith('http://') || url.startsWith('https://');
};

/**
 * Extracts bucket name and file path from a storage path
 * Format: "bucket-name/path/to/file.ext" or full path
 */
export const parseStoragePath = (storagePath: string): { bucket: string; path: string } | null => {
  if (isFullUrl(storagePath)) {
    const match = storagePath.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)/);
    if (match) {
      return { bucket: match[1], path: decodeURIComponent(match[2].split("?")[0]) };
    }
    return null;
  }

  const parts = storagePath.split("/");
  if (parts.length < 2) return null;

  const bucket = parts[0];
  const path = parts.slice(1).join("/");
  return { bucket, path };
};

/** Signed URL for private buckets, or the original URL for external hosts. */
export const toDisplayUrl = async (
  storedUrl: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> => {
  if (!storedUrl) return null;
  if (isFullUrl(storedUrl) && !storedUrl.includes("supabase.co/storage")) {
    return storedUrl;
  }
  return getSignedUrl(storedUrl, expiresIn);
};

/**
 * Gets a signed URL for a storage file
 * @param storagePath - Either a full URL or storage path (bucket/path)
 * @param expiresIn - Expiry time in seconds (default: 1 hour)
 * @returns Signed URL or null if failed
 */
export const getSignedUrl = async (
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> => {
  if (!storagePath) return null;
  
  // If it's already a full URL that's not a supabase storage URL, return as-is
  if (isFullUrl(storagePath) && !storagePath.includes('supabase.co/storage')) {
    return storagePath;
  }
  
  const parsed = parseStoragePath(storagePath);
  if (!parsed) {
    return null;
  }
  
  const { bucket, path } = parsed;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    return null;
  }
  
  return data.signedUrl;
};

/**
 * Gets a signed URL for contracts bucket
 */
export const getSignedContractUrl = async (storagePath: string): Promise<string | null> => {
  return getSignedUrl(storagePath, 3600); // 1 hour expiry
};

/**
 * Gets a signed URL for signed-contracts bucket
 */
export const getSignedContractDocumentUrl = async (storagePath: string): Promise<string | null> => {
  return getSignedUrl(storagePath, 3600); // 1 hour expiry
};

/**
 * Gets a signed URL for receipts bucket
 */
export const getSignedReceiptUrl = async (storagePath: string): Promise<string | null> => {
  return getSignedUrl(storagePath, 3600); // 1 hour expiry
};
