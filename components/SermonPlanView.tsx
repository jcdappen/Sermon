

import React from 'react';
import { SermonPlan } from '../types';
import { SyncIcon, PencilIcon, CalendarDaysIcon } from './icons/Icons';

interface SermonPlanViewProps {
  sermonPlans: SermonPlan[];
  onAssign: (sermon: SermonPlan) => void;
  onRecurringAssign: () => void;
  onSync: () => void;
  isLoading: boolean;
}

const getCategoryColor = (category: string | null): string => {
    switch(category) {
        case 'Leitender Pastor': return 'text-purple-700';
        case 'Gemeinderat': return 'text-sky-700';
        case 'Gast': return 'text-amber-700';
        case 'Gemeinde': return 'text-slate-700';
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
                <span className="font-semibold text-red-600">{name}</span>
                <span className="ml-2 text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Angefragt</span>
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


const SermonPlanView: React.FC<SermonPlanViewProps> = ({ sermonPlans, onAssign, onRecurringAssign, onSync, isLoading }) => {
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }).format(new Date(dateString));
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6 gap-2 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-800">Predigtplan</h2>
        <div className="flex gap-2">
         <button
            onClick={onRecurringAssign}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors duration-200"
          >
            <CalendarDaysIcon className="w-5 h-5 mr-2" />
            Serienzuweisung
          </button>
          <button
            onClick={onSync}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200"
          >
            <SyncIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Synchronisiere...' : 'Events synchronisieren'}
          </button>
        </div>
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
                <td className="p-4 text-sm text-gray-800 whitespace-nowrap">{formatDate(sermon.date)}</td>
                <td className="p-4 text-sm text-gray-800">
                  <div>{sermon.title}</div>
                  <div className="text-xs text-gray-500">{sermon.location}</div>
                </td>
                <td className="p-4 text-sm">
                    <PreacherDisplay name={sermon.preacher_name} category={sermon.preacher_category} status={sermon.status} />
                </td>
                <td className="p-4 text-sm text-gray-500">{sermon.theme_series || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.theme_topic || 'Thema offen'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.family_time_topic || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.collection_purpose || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.communion_responsible || '-'}</td>
                <td className="p-4">
                  <button
                    onClick={() => onAssign(sermon)}
                    className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
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
    </div>
  );
};

export default SermonPlanView;