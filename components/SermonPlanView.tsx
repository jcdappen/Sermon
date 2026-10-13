import React from 'react';
import { SermonPlan } from '../types';
import { SyncIcon, PencilIcon, CalendarDaysIcon, SunIcon, ExclamationCircleIcon } from './icons/Icons';

interface SermonPlanViewProps {
  sermonPlans: SermonPlan[];
  onAssign: (sermon: SermonPlan) => void;
  onRecurringAssign: () => void;
  onSync: () => void;
  isLoading: boolean;
}

const getCategoryColor = (category: string | null): string => {
    switch(category) {
        case 'Leitender Pastor': return 'text-brand-dark';
        case 'Gemeinderat': return 'text-kk-teal-dark';
        case 'Gast': return 'text-kk-gold-dark';
        case 'Gemeinde': return 'text-kk-grey-dark';
        default: return 'text-gray-500';
    }
}

const PreacherDisplay: React.FC<{
    name: string | null;
    category: string | null;
    status: SermonPlan['status'];
}> = ({ name, category, status }) => {
    if (!name) {
        return <span className="text-gray-500">N/A</span>;
    }

    if (status === 'assigned') { // "assigned" is used for "angefragt"
        return (
            <div>
                <span className="font-semibold text-brand-dark">{name}</span>
                <span className="ml-2 text-xs text-brand-dark bg-brand-light/40 px-1.5 py-0.5 rounded-full">Angefragt</span>
            </div>
        );
    }
    
    if (status === 'confirmed') {
        const colorClass = getCategoryColor(category);
        return <span className={`font-semibold ${colorClass}`}>{name}</span>;
    }
    
    // Default fallback for other statuses
    return <span className="text-gray-500">{name}</span>;
}


const SyncStatusBadge: React.FC<{ sermon: SermonPlan }> = ({ sermon }) => {
    if (sermon.sync_status === 'error') {
        return (
            <span title={`ChurchTools-Sync fehlgeschlagen: ${sermon.sync_error || 'Unbekannter Fehler'}`} className="inline-flex items-center mt-1 text-xs text-brand-dark">
                <ExclamationCircleIcon className="w-4 h-4 mr-1" />
                Nicht in ChurchTools
            </span>
        );
    }
    if (sermon.sync_status === 'pending') {
        return (
            <span title="Wird beim nächsten Sync an ChurchTools übertragen" className="inline-flex items-center mt-1 text-xs text-kk-gold-dark">
                <SyncIcon className="w-4 h-4 mr-1" />
                Sync ausstehend
            </span>
        );
    }
    return null;
};


const SermonPlanView: React.FC<SermonPlanViewProps> = ({ sermonPlans, onAssign, onRecurringAssign, onSync, isLoading }) => {
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }).format(new Date(dateString));
  };
  
  // Holiday data and function here to keep it self-contained
  const holidaysBW = [
      // 2024
      { start: new Date('2024-03-23'), end: new Date('2024-04-05') }, // Ostern
      { start: new Date('2024-05-21'), end: new Date('2024-05-31') }, // Pfingsten
      { start: new Date('2024-07-25'), end: new Date('2024-09-07') }, // Sommer
      { start: new Date('2024-10-28'), end: new Date('2024-10-31') }, // Herbst
      { start: new Date('2024-12-23'), end: new Date('2025-01-04') }, // Weihnachten

      // 2025
      { start: new Date('2025-04-14'), end: new Date('2025-04-26') }, // Ostern
      { start: new Date('2025-06-10'), end: new Date('2025-06-21') }, // Pfingsten
      { start: new Date('2025-07-31'), end: new Date('2025-09-13') }, // Sommer
      { start: new Date('2025-10-27'), end: new Date('2025-10-31') }, // Herbst
      { start: new Date('2025-12-22'), end: new Date('2026-01-05') }, // Weihnachten
  ];

  holidaysBW.forEach(period => {
      period.start.setHours(0, 0, 0, 0);
      period.end.setHours(0, 0, 0, 0);
  });

  const isDateInBWHolidays = (dateString: string): boolean => {
      const checkDate = new Date(dateString);
      checkDate.setHours(0, 0, 0, 0);

      for (const period of holidaysBW) {
          if (checkDate >= period.start && checkDate <= period.end) {
              return true;
          }
      }
      return false;
  };

  return (
    <>
      <div className="flex justify-end items-center mb-6 gap-2 flex-wrap">
         <button
            onClick={onRecurringAssign}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-kk-teal-dark text-white rounded-lg hover:bg-kk-grey-dark disabled:bg-kk-teal-light transition-colors duration-200"
          >
            <CalendarDaysIcon className="w-5 h-5 mr-2" />
            Serienzuweisung
          </button>
          <button
            onClick={onSync}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:bg-brand-light transition-colors duration-200"
          >
            <SyncIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Synchronisiere...' : 'Events synchronisieren'}
          </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Datum</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Gottesdienst</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Prediger</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Predigtserie</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Thema</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Familytime-Thema</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Kollekte für</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Abendmahl</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {sermonPlans.map((sermon) => (
              <tr key={sermon.id} className="border-b hover:bg-gray-50">
                <td className="p-4 text-sm text-gray-800 whitespace-nowrap">
                   <div className="flex items-center gap-2">
                        <span>{formatDate(sermon.date)}</span>
                        {isDateInBWHolidays(sermon.date) && (
                            <span title="Liegt in den Schulferien (BW)">
                                <SunIcon className="w-5 h-5 text-kk-gold" />
                            </span>
                        )}
                    </div>
                </td>
                <td className="p-4 text-sm text-gray-800">
                  <div>{sermon.title}</div>
                </td>
                <td className="p-4 text-sm">
                    <PreacherDisplay name={sermon.preacher_name} category={sermon.preacher_category} status={sermon.status} />
                    <SyncStatusBadge sermon={sermon} />
                </td>
                <td className="p-4 text-sm text-gray-500">{sermon.theme_series || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.theme_topic || 'Thema offen'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.family_time_topic || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.collection_purpose || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.communion_responsible || '-'}</td>
                <td className="p-4">
                  <button
                    onClick={() => onAssign(sermon)}
                    className="flex items-center text-brand hover:text-brand-dark text-sm"
                  >
                    <PencilIcon className="w-4 h-4 mr-1" />
                    {sermon.preacher_name ? 'Bearbeiten' : 'Zuweisen'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default SermonPlanView;