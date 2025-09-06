
export interface SermonPlan {
  id: number;
  churchtools_event_id: number;
  date: string;
  title: string;
  location: string;
  start_time: string;
  end_time: string;
  preacher_id: number | null;
  preacher_name: string | null;
  theme_series: string | null;
  theme_topic: string | null;
  sermon_notes: string | null;
  family_time_responsible: string | null;
  collection_responsible: string | null;
  communion_responsible: string | null;
  status: 'planned' | 'assigned' | 'confirmed' | 'completed';
  sync_status: 'synced' | 'pending' | 'error';
  last_synced: string;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  email: string | null;
  can_preach: boolean;
  last_updated: string;
}

export interface SyncLog {
  id: number;
  sync_type: 'pull_events' | 'assign_preacher' | 'update_event';
  status: 'success' | 'error' | 'warning';
  message: string;
  events_count: number;
  error_details: object | null;
  synced_at: string;
}

export enum View {
  SERMON_PLAN,
  PEOPLE,
  SYNC_LOG,
}
