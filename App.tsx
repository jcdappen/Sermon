

import React, { useState, useEffect, useCallback } from 'react';
import { SermonPlan, Person, SyncLog, View } from './types';
import * as api from './services/api';
import SermonPlanView from './components/SermonPlanView';
import PeopleView from './components/PeopleView';
import SyncLogView from './components/SyncLogView';
import AssignSermonModal from './components/AssignSermonModal';
import { SyncIcon, UserGroupIcon, DocumentTextIcon } from './components/icons/Icons';

// FIX: Removed React.FC type annotation to resolve a component type inference issue.
// This was causing a cascade of scope errors where variables and functions inside the component
// were reported as not being defined. Allowing TypeScript to infer the type fixes the issue.
const App = () => {
  const [view, setView] = useState<View>(View.SERMON_PLAN);
  const [sermonPlans, setSermonPlans] = useState<SermonPlan[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSermon, setSelectedSermon] = useState<SermonPlan | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [plans, persons, logs] = await Promise.all([
        api.getSermonPlans(),
        api.getPeople(),
        api.getSyncLogs(),
      ]);
      setSermonPlans(plans);
      setPeople(persons);
      setSyncLogs(logs);
    } catch (err) {
      setError('Fehler beim Laden der Daten.');
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

  const handleOpenModal = (sermon: SermonPlan) => {
    setSelectedSermon(sermon);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedSermon(null);
    setIsModalOpen(false);
  };

  const handleSaveAssignment = async (details: {
    preacherId: number;
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
        selectedSermon.churchtools_event_id,
        details.preacherId,
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
    if (isLoading && !sermonPlans.length) {
      return <div className="text-center p-8">Lade Daten...</div>;
    }
    if (error) {
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
      case View.PEOPLE:
        return <PeopleView people={people} />;
      case View.SYNC_LOG:
        return <SyncLogView syncLogs={syncLogs} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">Predigtplaner</h1>
          <p className="text-xs text-gray-500">ChurchTools Sync</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
           <NavItem targetView={View.SERMON_PLAN} icon={<DocumentTextIcon className="w-5 h-5" />} label="Predigtplan" />
           <NavItem targetView={View.PEOPLE} icon={<UserGroupIcon className="w-5 h-5" />} label="Personen" />
           <NavItem targetView={View.SYNC_LOG} icon={<SyncIcon className="w-5 h-5" />} label="Sync Protokoll" />
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {renderView()}
      </main>

      {isModalOpen && selectedSermon && (
        <AssignSermonModal
          sermon={selectedSermon}
          people={people.filter(p => p.can_preach)}
          onClose={handleCloseModal}
          onSave={handleSaveAssignment}
        />
      )}
    </div>
  );
};

export default App;
