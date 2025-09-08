import { SermonPlan, SyncLog } from '../types';

// Helper interface for the standardized API response
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Helper function to handle API requests to Netlify functions
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/.netlify/functions/${endpoint}`, options);

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
    series: string; 
    topic: string; 
    notes: string; 
    family_time: string;
    collection: string;
    communion: string;
    status: SermonPlan['status'];
    preacherCategory: string;
  }
): Promise<{ message: string }> => {
  return await apiRequest<{ message: string }>('assign-preacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventUid,
      sermonDetails
    }),
  });
};

export const setupDatabase = async (): Promise<{ message: string }> => {
  return await apiRequest<{ message: string }>('setup-database', {
    method: 'POST',
  });
};
