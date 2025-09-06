import { SermonPlan, Person, SyncLog } from '../types';

// Helper function to handle API requests to Netlify functions
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/.netlify/functions/${endpoint}`, options);

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    // Read the body as text ONCE to avoid "body stream already read" errors.
    const errorText = await response.text();
    try {
      // Then, try to parse the text as JSON.
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
    } catch (e) {
      // If parsing fails, the raw text is our error message.
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  // Handle successful responses that might not have a body (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
     const text = await response.text();
     // Ensure text is not empty before parsing to avoid errors on empty bodies
     return text ? JSON.parse(text) : (null as T);
  }
  
  return null as T;
}

export const getSermonPlans = async (): Promise<SermonPlan[]> => {
  const plans = await apiRequest<SermonPlan[]>('get-sermon-plans');
  return plans ? plans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];
};

export const getPeople = async (): Promise<Person[]> => {
  const data = await apiRequest<{ persons: Person[] }>('get-persons');
  return data?.persons || [];
};

export const getSyncLogs = async (): Promise<SyncLog[]> => {
  const logs = await apiRequest<SyncLog[]>('get-sync-logs');
  return logs || [];
};

export const syncEvents = async (): Promise<{ success: boolean; message: string; synced: number }> => {
  return await apiRequest<{ success: boolean; message: string; synced: number }>('sync-events', {
    method: 'POST',
  });
};

export const assignPreacher = async (
  eventId: number,
  preacherId: number,
  sermonDetails: { 
    series: string; 
    topic: string; 
    notes: string; 
    family_time: string;
    collection: string;
    communion: string;
  }
): Promise<{ success: boolean; message: string }> => {
  const people = await getPeople();
  const person = people.find(p => p.id === preacherId);
  if (!person) {
      throw new Error('Selected preacher could not be found in the people list.');
  }
    
  return await apiRequest<{ success: boolean; message: string }>('assign-preacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      preacherId,
      preacherName: person.name, // Pass the name to the backend
      sermonDetails
    }),
  });
};