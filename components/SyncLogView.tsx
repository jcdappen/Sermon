
import React from 'react';
import { SyncLog } from '../types';
import { CheckCircleIcon, ExclamationCircleIcon } from './icons/Icons';

interface SyncLogViewProps {
  syncLogs: SyncLog[];
}

const SyncLogView: React.FC<SyncLogViewProps> = ({ syncLogs }) => {
    
  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date(dateString));
  };
    
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Synchronisationsprotokoll</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Zeitstempel</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Typ</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Nachricht</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Anzahl</th>
            </tr>
          </thead>
          <tbody>
            {syncLogs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="p-4 text-sm text-gray-500 whitespace-nowrap">{formatDateTime(log.synced_at)}</td>
                <td className="p-4 text-sm text-gray-800">{log.sync_type}</td>
                <td className="p-4 text-sm">
                  {log.status === 'success' ? (
                     <span className="flex items-center text-green-600">
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                        Erfolgreich
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600">
                        <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                        Fehler
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-gray-800">{log.message}</td>
                <td className="p-4 text-sm text-gray-500 text-right">{log.events_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SyncLogView;
