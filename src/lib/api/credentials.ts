export interface SessionCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const STORAGE_KEY = 'pf_session_credentials';
const LEGACY_STORAGE_KEY = STORAGE_KEY;
let credentials: SessionCredentials | null = null;

function readStoredCredentials(): SessionCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null') as Partial<SessionCredentials> | null;
    if (
      !value ||
      typeof value.accessToken !== 'string' ||
      typeof value.refreshToken !== 'string' ||
      typeof value.expiresAt !== 'number'
    ) return null;
    return value as SessionCredentials;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    return null;
  }
}

export function getSessionCredentials(): SessionCredentials | null {
  credentials ??= readStoredCredentials();
  return credentials;
}

export function setSessionCredentials(next: SessionCredentials): void {
  credentials = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

export function clearSessionCredentials(): void {
  credentials = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
