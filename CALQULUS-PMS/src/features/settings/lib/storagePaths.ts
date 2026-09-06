export function imageExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;

  const fromMime = file.type.split("/").pop()?.toLowerCase();
  return fromMime && /^[a-z0-9]+$/.test(fromMime) ? fromMime : "jpg";
}

export function publicStoragePath(publicUrl: string | null | undefined, bucket: string): string | null {
  if (!publicUrl) return null;
  // Accept canonical bucket/path references used by private-storage writes.
  const raw = publicUrl.split("?")[0];
  const prefix = `${bucket}/`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);

  const markerPublic = `/object/public/${bucket}/`;
  const markerSign = `/object/sign/${bucket}/`;
  const markerAuth = `/object/authenticated/${bucket}/`;

  const indexOfMarker = (pathname: string) => {
    const publicIdx = pathname.indexOf(markerPublic);
    if (publicIdx !== -1) return { index: publicIdx, length: markerPublic.length };
    const signIdx = pathname.indexOf(markerSign);
    if (signIdx !== -1) return { index: signIdx, length: markerSign.length };
    const authIdx = pathname.indexOf(markerAuth);
    if (authIdx !== -1) return { index: authIdx, length: markerAuth.length };
    return null;
  };

  try {
    const url = new URL(publicUrl);
    const found = indexOfMarker(url.pathname);
    if (!found) return null;
    return decodeURIComponent(url.pathname.slice(found.index + found.length));
  } catch {
    const [withoutQuery] = publicUrl.split("?");
    const found = indexOfMarker(withoutQuery);
    if (!found) return null;
    return decodeURIComponent(withoutQuery.slice(found.index + found.length));
  }
}
