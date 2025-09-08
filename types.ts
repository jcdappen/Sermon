export interface SermonPlan {
  id: number;
  event_uid: string;
  date: string;
  title: string;
  location: string;
  start_time: string;
  end_time: string;
  preacher_name: string | null;
  preacher_category: string | null;
  theme_series: string | null;
  theme_topic: string | null;
  sermon_notes: string | null;
  family_time_topic: string | null;
  collection_purpose: string | null;
  communion_responsible: string | null;
  status: 'planned' | 'assigned' | 'confirmed' | 'completed';
  sync_status: 'synced' | 'pending' | 'error';
  last_synced: string;
  created_at: string;
  updated_at: string;
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

export interface PreacherStat {
    name: string;
    count: number;
    percentage: number;
}

export enum View {
  DASHBOARD,
  SERMON_PLAN, // Remains for potential future use, but YEARLY is now primary
  SYNC_LOG,
  STATISTICS, // Remains for potential future use
  PEOPLE, // Remains for potential future use
  YEARLY,
}
