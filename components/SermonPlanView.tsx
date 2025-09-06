
import React from 'react';
import { SermonPlan } from '../types';
import { SyncIcon, PencilIcon } from './icons/Icons';

interface SermonPlanViewProps {
  sermonPlans: SermonPlan[];
  onAssign: (sermon: SermonPlan) => void;
  onSync: () => void;
  isLoading: boolean;
}

const StatusBadge: React.FC<{ status: SermonPlan['status'] }> = ({ status }) => {
  const statusClasses = {
    planned: 'bg-yellow-100 text-yellow-800',
    assigned: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
  };
  const statusText = {
    planned: 'Geplant',
    assigned: 'Zugewiesen',
    confirmed: 'Bestätigt',
    completed: 'Abgeschlossen',
  }
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClasses[status]}`}>
      {statusText[status]}
    </span>
  );
};

const SermonPlanView: React.FC<SermonPlanViewProps> = ({ sermonPlans, onAssign, onSync, isLoading }) => {
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Predigtplan</h2>
        <button
          onClick={onSync}
          disabled={isLoading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200"
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
              <th className="p-4 text-sm font-semibold text-gray-600">Familytime</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Kollekte</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Abendmahl</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
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
                <td className="p-4 text-sm text-gray-500">{sermon.preacher_name || 'N/A'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.theme_series || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.theme_topic || 'Thema offen'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.family_time_responsible || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.collection_responsible || '-'}</td>
                <td className="p-4 text-sm text-gray-500">{sermon.communion_responsible || '-'}</td>
                <td className="p-4"><StatusBadge status={sermon.status} /></td>
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
