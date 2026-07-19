const SUPABASE_CREDENTIAL_FRAGMENT_KEYS = ["access_token", "refresh_token"] as const;

export function buildSanitizedAuthCallbackUrl(
  pathname: string,
  search: string,
  hash: string,
): string | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  const containsCredential = SUPABASE_CREDENTIAL_FRAGMENT_KEYS.some((key) => params.has(key));
  return containsCredential ? `${pathname}${search}` : null;
}
