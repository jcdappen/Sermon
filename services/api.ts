import { SermonPlan, SyncLog, PersonSearchResult } from '../types';

// Helper interface for the standardized API response
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Helper function to handle API requests to Netlify functions
// Wird ausgelöst, wenn der Server "nicht angemeldet" meldet – die App zeigt dann den Login.
export const UNAUTHORIZED_EVENT = 'sermon:unauthorized';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/.netlify/functions/${endpoint}`, { credentials: 'same-origin', ...options });

  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
    } catch (e) {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
     const text = await response.text();
     if (!text) {
         return null as T;
     }
     const jsonResponse: ApiResponse<T> = JSON.parse(text);
     if (!jsonResponse.success) {
         throw new Error(jsonResponse.error || jsonResponse.message || 'An unknown API error occurred.');
     }
     return jsonResponse.data;
  }
  
  return null as T;
}


export const getSermonPlans = async (): Promise<SermonPlan[]> => {
  const plans = await apiRequest<SermonPlan[]>('get-sermon-plans');
  if (!plans) return [];
  // Data comes pre-structured from the backend now, no parsing needed.
  return plans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const getSyncLogs = async (): Promise<SyncLog[]> => {
  return await apiRequest<SyncLog[]>('get-sync-logs') || [];
};

export const syncEvents = async (): Promise<{ message: string; synced: number }> => {
  return await apiRequest<{ message: string; synced: number }>('sync-events', {
    method: 'POST',
  });
};

export const assignPreacher = async (
  eventUid: string,
  sermonDetails: { 
    preacherName: string;
    preacherPersonId: number | null;
    series: string; 
    topic: string; 
    notes: string; 
    family_time: string;
    collection: string;
    communion: string;
    status: SermonPlan['status'];
    preacherCategory: string;
  }
): Promise<{ message: string; ctSynced?: boolean }> => {
  return await apiRequest<{ message: string; ctSynced?: boolean }>('assign-preacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventUid,
      sermonDetails
    }),
  });
};

export const searchPersons = async (query: string): Promise<PersonSearchResult[]> => {
  return await apiRequest<PersonSearchResult[]>(`search-persons?q=${encodeURIComponent(query)}`) || [];
};

export const setupDatabase = async (): Promise<{ message: string }> => {
  return await apiRequest<{ message: string }>('setup-database', {
    method: 'POST',
  });
};

export const getSession = async (): Promise<{ loggedIn: boolean }> => {
  return await apiRequest<{ loggedIn: boolean }>('session');
};

export type LoginResult = { ok: true } | { ok: false; error: string; needsTotp: boolean };

// Login liefert bei falschen Daten bewusst 401 – hier ohne globales Abmelde-Event auswerten.
export const login = async (username: string, password: string, totpCode?: string): Promise<LoginResult> => {
  const response = await fetch('/.netlify/functions/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, totpCode: totpCode || undefined }),
  });
  let body: { success?: boolean; error?: string; needsTotp?: boolean } = {};
  try {
    body = await response.json();
  } catch {
    // keine JSON-Antwort
  }
  if (response.ok && body.success) return { ok: true };
  return { ok: false, error: body.error || 'Anmeldung fehlgeschlagen.', needsTotp: Boolean(body.needsTotp) };
};

export const logout = async (): Promise<void> => {
  await apiRequest<{ loggedOut: boolean }>('logout', { method: 'POST' });
};
