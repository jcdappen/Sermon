

import React, { useState, useEffect, useCallback } from 'react';
import { SermonPlan, SyncLog, View } from './types';
import * as api from './services/api';
import SermonPlanView from './components/SermonPlanView';
import SyncLogView from './components/SyncLogView';
import StatisticsView from './components/StatisticsView';
import AssignSermonModal from './components/AssignSermonModal';
import { SyncIcon, DocumentTextIcon, WrenchScrewdriverIcon, ChartBarIcon } from './components/icons/Icons';

// FIX: Removed React.FC type annotation to resolve a component type inference issue.
// This was causing a cascade of scope errors where variables and functions inside the component
// were reported as not being defined. Allowing TypeScript to infer the type fixes the issue.
const App = () => {
  const [view, setView] = useState<View>(View.SERMON_PLAN);
  const [sermonPlans, setSermonPlans] = useState<SermonPlan[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSermon, setSelectedSermon] = useState<SermonPlan | null>(null);
  const [isDbSetupError, setIsDbSetupError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsDbSetupError(false);
    try {
      const [plans, logs] = await Promise.all([
        api.getSermonPlans(),
        api.getSyncLogs(),
      ]);
      setSermonPlans(plans);
      setSyncLogs(logs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('relation "sermon_plans" does not exist')) {
        setError('Die Datenbank ist noch nicht eingerichtet. Bitte führen Sie die Ersteinrichtung durch.');
        setIsDbSetupError(true);
      } else {
        setError('Fehler beim Laden der Daten.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncEvents = async () => {
    setIsLoading(true);
    try {
      const result = await api.syncEvents();
      alert(result.message);
      await fetchData(); // Refresh all data
    } catch (err) {
      setError('Fehler bei der Synchronisation der Events.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSetupDatabase = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.setupDatabase();
      alert(result.message);
      await fetchData(); // Refresh all data after setup
    } catch (err) {
      setError('Fehler beim Einrichten der Datenbank.');
      console.error(err);
      setIsDbSetupError(true); // Keep the setup screen visible on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (sermon: SermonPlan) => {
    setSelectedSermon(sermon);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedSermon(null);
    setIsModalOpen(false);
  };

  const handleSaveAssignment = async (details: {
    preacherName: string;
    series: string;
    topic: string;
    notes: string;
    family_time: string;
    collection: string;
    communion: string;
  }) => {
    if (!selectedSermon) return;

    setIsLoading(true);
    try {
      await api.assignPreacher(
        selectedSermon.event_uid,
        details
      );
      await fetchData(); // Refresh data to show changes
      handleCloseModal();
    } catch (err) {
      setError('Fehler beim Zuweisen des Predigers.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const NavItem: React.FC<{
    targetView: View;
    icon: React.ReactNode;
    label: string;
  }> = ({ targetView, icon, label }) => (
    <button
      onClick={() => setView(targetView)}
      className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
        view === targetView
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );

  const renderView = () => {
    if (isLoading && !sermonPlans.length && !error) {
      return <div className="text-center p-8">Lade Daten...</div>;
    }
    if (error) {
      if (isDbSetupError) {
        return (
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <WrenchScrewdriverIcon className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Datenbank-Einrichtung erforderlich</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleSetupDatabase}
              disabled={isLoading}
              className="flex items-center justify-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200"
            >
              <WrenchScrewdriverIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Richte ein...' : 'Datenbank jetzt einrichten'}
            </button>
          </div>
        );
      }
      return <div className="text-center p-8 text-red-500">{error}</div>;
    }

    switch (view) {
      case View.SERMON_PLAN:
        return (
          <SermonPlanView
            sermonPlans={sermonPlans}
            onAssign={handleOpenModal}
            onSync={handleSyncEvents}
            isLoading={isLoading}
          />
        );
      case View.SYNC_LOG:
        return <SyncLogView syncLogs={syncLogs} />;
      case View.STATISTICS:
        return <StatisticsView sermonPlans={sermonPlans} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">Predigtplaner</h1>
          <p className="text-xs text-gray-500">iCal Sync</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
           <NavItem targetView={View.SERMON_PLAN} icon={<DocumentTextIcon className="w-5 h-5" />} label="Predigtplan" />
           <NavItem targetView={View.STATISTICS} icon={<ChartBarIcon className="w-5 h-5" />} label="Statistiken" />
           <NavItem targetView={View.SYNC_LOG} icon={<SyncIcon className="w-5 h-5" />} label="Sync Protokoll" />
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {renderView()}
      </main>

      {isModalOpen && selectedSermon && (
        <AssignSermonModal
          sermon={selectedSermon}
          onClose={handleCloseModal}
          onSave={handleSaveAssignment}
        />
      )}
    </div>
  );
};

export default App;