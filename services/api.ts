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


/**
 * Parses the combined `sermon_notes` field from a SermonPlan object into its
 * constituent parts (notes, family time, collection, communion).
 * This allows storing multiple details in a single database column to avoid
 * schema-related errors.
 * @param plan The original sermon plan object from the database.
 * @returns A new sermon plan object with parsed and populated fields.
 */
function parseSermonPlanNotes(plan: SermonPlan): SermonPlan {
    const notes = plan.sermon_notes;
    // Create a mutable copy of the plan to modify
    let newPlan = { ...plan };

    // Default values if notes are empty
    if (!notes) {
        newPlan.sermon_notes = null;
        newPlan.family_time_responsible = null;
        newPlan.collection_responsible = null;
        newPlan.communion_responsible = null;
        return newPlan;
    }

    const details = {
        sermon_notes_parts: [] as string[],
        family_time_responsible: null as string | null,
        collection_responsible: null as string | null,
        communion_responsible: null as string | null
    };

    const parts = notes.split('|').map(p => p.trim());

    for (const part of parts) {
        if (part.toLowerCase().startsWith('familytime:')) {
            details.family_time_responsible = part.substring('familytime:'.length).trim();
        } else if (part.toLowerCase().startsWith('kollekte:')) {
            details.collection_responsible = part.substring('kollekte:'.length).trim();
        } else if (part.toLowerCase().startsWith('abendmahl:')) {
            details.communion_responsible = part.substring('abendmahl:'.length).trim();
        } else if (part.toLowerCase().startsWith('notizen:')) {
            details.sermon_notes_parts.push(part.substring('notizen:'.length).trim());
        } else {
            // Treat parts without a key as general notes for backward compatibility
            details.sermon_notes_parts.push(part);
        }
    }
    
    // Reconstruct the sermon_notes from only the note parts
    newPlan.sermon_notes = details.sermon_notes_parts.join(' | ') || null;
    newPlan.family_time_responsible = details.family_time_responsible;
    newPlan.collection_responsible = details.collection_responsible;
    newPlan.communion_responsible = details.communion_responsible;

    return newPlan;
}

export const getSermonPlans = async (): Promise<SermonPlan[]> => {
  const plans = await apiRequest<SermonPlan[]>('get-sermon-plans');
  if (!plans) return [];

  // After fetching, parse the combined notes field for each plan
  const transformedPlans = plans.map(parseSermonPlanNotes);

  return transformedPlans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
  }
): Promise<{ message: string }> => {
  return await apiRequest<{ message: string }>('assign-preacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventUid,
      preacherName: sermonDetails.preacherName,
      sermonDetails
    }),
  });
};

export const setupDatabase = async (): Promise<{ message: string }> => {
  return await apiRequest<{ message: string }>('setup-database', {
    method: 'POST',
  });
};
