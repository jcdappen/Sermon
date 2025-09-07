
import React, { useMemo } from 'react';
import { SermonPlan, SyncLog, View } from '../types';
import { CalendarIcon, UserPlusIcon, UsersIcon, CheckCircleIcon, ExclamationCircleIcon, SyncIcon, DocumentTextIcon } from './icons/Icons';

interface DashboardViewProps {
  sermonPlans: SermonPlan[];
  syncLogs: SyncLog[];
  onSync: () => void;
  isLoading: boolean;
  setView: (view: View) => void;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string | number;
  colorClass: string;
}> = ({ icon, title, value, colorClass }) => (
  <div className={`bg-white p-6 rounded-lg shadow flex items-center ${colorClass}`}>
    <div className="mr-4">{icon}</div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ sermonPlans, syncLogs, onSync, isLoading, setView }) => {

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    }).format(new Date(dateString));
  };
  
  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date(dateString));
  };
  
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const next90Days = new Date();
    next90Days.setDate(today.getDate() + 90);

    const servicesInNext90Days = sermonPlans.filter(plan => {
        const planDate = new Date(plan.date);
        return planDate >= today && planDate <= next90Days;
    });
    
    const unassignedInNext90Days = servicesInNext90Days.filter(p => !p.preacher_name).length;

    const currentYear = today.getFullYear();
    const sermonsThisYear = sermonPlans.filter(plan =>
        plan.preacher_name && new Date(plan.date).getFullYear() === currentYear
    );
    const activePreachersThisYear = new Set(sermonsThisYear.map(p => p.preacher_name)).size;
    
    const upcomingServices = sermonPlans
      .filter(p => new Date(p.date) >= today)
      .slice(0, 2);

    return {
        servicesInNext90Days: servicesInNext90Days.length,
        unassignedInNext90Days,
        activePreachersThisYear,
        upcomingServices,
        lastSync: syncLogs[0] || null,
    }
  }, [sermonPlans, syncLogs]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          icon={<CalendarIcon className="w-8 h-8 text-blue-500" />}
          title="Gottesdienste (Nächste 90 Tage)"
          value={stats.servicesInNext90Days}
          colorClass="border-l-4 border-blue-500"
        />
        <StatCard 
          icon={<UserPlusIcon className="w-8 h-8 text-red-500" />}
          title="Offene Zuweisungen (90 Tage)"
          value={stats.unassignedInNext90Days}
          colorClass="border-l-4 border-red-500"
        />
        <StatCard 
          icon={<UsersIcon className="w-8 h-8 text-green-500" />}
          title="Aktive Prediger (Dieses Jahr)"
          value={stats.activePreachersThisYear}
          colorClass="border-l-4 border-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Services */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Nächste Gottesdienste</h3>
          {stats.upcomingServices.length > 0 ? (
            <ul className="space-y-4">
              {stats.upcomingServices.map(sermon => (
                <li key={sermon.id} className="p-4 border rounded-lg hover:bg-gray-50">
                   <p className="font-semibold text-gray-800">{sermon.title}</p>
                   <p className="text-sm text-gray-500 mb-1">{formatDate(sermon.date)}</p>
                   <p className="text-sm">
                        <span className="font-medium text-gray-600">Prediger: </span> 
                        {sermon.preacher_name || <span className="text-red-500 font-semibold">Offen</span>}
                   </p>
                    <p className="text-sm">
                        <span className="font-medium text-gray-600">Thema: </span> 
                        {sermon.theme_topic || 'Thema offen'}
                   </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">Keine bevorstehenden Gottesdienste gefunden.</p>
          )}
        </div>

        {/* Quick Actions & Sync Status */}
        <div className="space-y-6">
           {/* Last Sync */}
           <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Letzte Synchronisation</h3>
                {stats.lastSync ? (
                    <div>
                        <p className={`flex items-center font-semibold mb-2 ${stats.lastSync.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.lastSync.status === 'success' 
                                ? <CheckCircleIcon className="w-5 h-5 mr-2" /> 
                                : <ExclamationCircleIcon className="w-5 h-5 mr-2" />}
                            {stats.lastSync.status === 'success' ? 'Erfolgreich' : 'Fehlgeschlagen'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {formatDateTime(stats.lastSync.synced_at)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{stats.lastSync.message}</p>
                        <button onClick={() => setView(View.SYNC_LOG)} className="text-sm text-blue-600 hover:underline mt-2">
                          Protokoll ansehen
                        </button>
                    </div>
                ) : (
                    <p className="text-gray-500">Noch keine Synchronisation durchgeführt.</p>
                )}
           </div>

           {/* Quick Access */}
           <div className="bg-white p-6 rounded-lg shadow">
             <h3 className="text-lg font-semibold text-gray-800 mb-4">Schnellzugriff</h3>
             <div className="space-y-3">
               <button
                  onClick={() => setView(View.SERMON_PLAN)}
                  className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  <DocumentTextIcon className="w-5 h-5 mr-2" />
                  Zum Predigtplan
                </button>
                <button
                  onClick={onSync}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200"
                >
                  <SyncIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Synchronisiere...' : 'Events synchronisieren'}
                </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
