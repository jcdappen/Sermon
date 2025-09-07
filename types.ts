

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
  family_time_responsible: string | null;
  collection_responsible: string | null;
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

// FIX: Add missing Person interface to fix type error in components/PeopleView.tsx.
export interface Person {
  id: number;
  name: string;
  email: string | null;
  can_preach: boolean;
}


export enum View {
  DASHBOARD,
  SERMON_PLAN,
  SYNC_LOG,
  STATISTICS,
}
