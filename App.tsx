import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SermonPlan, SyncLog, View } from './types';
import * as api from './services/api';
import SermonPlanView from './components/SermonPlanView';
import SyncLogView from './components/SyncLogView';
import StatisticsView from './components/StatisticsView';
import DashboardView from './components/DashboardView';
import PeopleView from './components/PeopleView';
import AssignSermonModal from './components/AssignSermonModal';
import RecurringAssignmentModal from './components/RecurringAssignmentModal';
import { SyncIcon, DocumentTextIcon, WrenchScrewdriverIcon, ChartBarIcon, UsersIcon, HomeIcon } from './components/icons/Icons';


const App = () => {
  const [view, setView] = useState<View>(View.DASHBOARD);
  const [sermonPlans, setSermonPlans] = useState<SermonPlan[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
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

  const preachers = useMemo(() => {
    const preacherMap = new Map<string, { name: string; count: number }>();
    sermonPlans.forEach(plan => {
        if (plan.preacher_name) {
            const name = plan.preacher_name;
            const existing = preacherMap.get(name);
            if (existing) {
                existing.count++;
            } else {
                preacherMap.set(name, { name, count: 1 });
            }
        }
    });
    return Array.from(preacherMap.values()).sort((a, b) => b.count - a.count);
  }, [sermonPlans]);

  const handleSyncEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.syncEvents();
      alert(result.message);
      await fetchData(); // Refresh all data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
       if (errorMessage.includes('Missing required environment variables: ICAL_URL')) {
        setError('Die iCal-URL ist nicht konfiguriert. Bitte fügen Sie die Umgebungsvariable ICAL_URL in Ihren Netlify-Build-Einstellungen hinzu, um Gottesdienste synchronisieren zu können.');
      } else {
        setError('Fehler bei der Synchronisation der Events.');
      }
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
  
  const handleOpenRecurringModal = () => {
      setIsRecurringModalOpen(true);
  }

  const handleCloseModal = () => {
    setSelectedSermon(null);
    setIsModalOpen(false);
    setIsRecurringModalOpen(false);
  };

  const handleSaveAssignment = async (details: {
    preacherName: string;
    series: string;
    topic: string;
    notes: string;
    family_time: string;
    collection: string;
    communion: string;
    status: SermonPlan['status'];
    preacherCategory: string;
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
  
  const handleSaveRecurringAssignment = async (details: {
      preacherName: string;
      series: string;
      topic: string;
      startDate: string;
      endDate: string;
      pattern: string;
  }) => {
      const { startDate, endDate, pattern } = details;
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const sermonsToUpdate = sermonPlans.filter(sermon => {
         const sermonDate = new Date(sermon.date);
         // Timezone offset correction
         sermonDate.setMinutes(sermonDate.getMinutes() + sermonDate.getTimezoneOffset());

         if (sermonDate < start || sermonDate > end) return false;
         
         const dayOfWeek = sermonDate.getDay(); // 0 = Sunday, 1 = Monday...
         if(dayOfWeek !== 0) return false; // Only consider Sundays for now
         
         const date = sermonDate.getDate();
         const weekOfMonth = Math.ceil(date / 7);

         switch(pattern) {
             case 'every-week': return true;
             case 'every-2-weeks': {
                const diffTime = Math.abs(sermonDate.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const diffWeeks = Math.floor(diffDays / 7);
                return diffWeeks % 2 === 0;
             }
             case 'first-sunday': return weekOfMonth === 1;
             case 'second-sunday': return weekOfMonth === 2;
             case 'third-sunday': return weekOfMonth === 3;
             case 'fourth-sunday': return weekOfMonth === 4;
             case 'last-sunday': {
                const nextSunday = new Date(sermonDate);
                nextSunday.setDate(date + 7);
                return nextSunday.getMonth() !== sermonDate.getMonth();
             }
             default: return false;
         }
      });
      
      if(sermonsToUpdate.length === 0) {
          alert("Es wurden keine passenden Gottesdienste für dieses Muster gefunden.");
          return;
      }
      
      const confirmed = confirm(`Wollen Sie wirklich ${sermonsToUpdate.length} Gottesdienste mit den neuen Details aktualisieren?`);
      if(!confirmed) return;
      
      setIsLoading(true);
      try {
          for(const sermon of sermonsToUpdate) {
             await api.assignPreacher(sermon.event_uid, {
                 preacherName: details.preacherName,
                 series: details.series,
                 topic: details.topic,
                 // Other fields are set to default for bulk assignment
                 notes: '',
                 family_time: '',
                 collection: '',
                 communion: '',
                 status: 'assigned', // Default status for recurring
                 preacherCategory: 'Gemeinde', // Default category
             });
          }
          await fetchData();
          handleCloseModal();
      } catch (err) {
          setError('Fehler bei der Serienzuweisung.');
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
      case View.DASHBOARD:
        return (
            <DashboardView
                sermonPlans={sermonPlans}
                syncLogs={syncLogs}
                onSync={handleSyncEvents}
                isLoading={isLoading}
                setView={setView}
            />
        );
      case View.SERMON_PLAN:
        return (
          <SermonPlanView
            sermonPlans={sermonPlans}
            onAssign={handleOpenModal}
            onRecurringAssign={handleOpenRecurringModal}
            onSync={handleSyncEvents}
            isLoading={isLoading}
          />
        );
      case View.SYNC_LOG:
        return <SyncLogView syncLogs={syncLogs} />;
      case View.STATISTICS:
        return <StatisticsView sermonPlans={sermonPlans} />;
      case View.PEOPLE:
        return <PeopleView people={preachers} />;
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
           <NavItem targetView={View.DASHBOARD} icon={<HomeIcon className="w-5 h-5" />} label="Dashboard" />
           <NavItem targetView={View.SERMON_PLAN} icon={<DocumentTextIcon className="w-5 h-5" />} label="Predigtplan" />
           <NavItem targetView={View.STATISTICS} icon={<ChartBarIcon className="w-5 h-5" />} label="Statistiken" />
           <NavItem targetView={View.PEOPLE} icon={<UsersIcon className="w-5 h-5" />} label="Personen" />
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

      {isRecurringModalOpen && (
          <RecurringAssignmentModal
            onClose={handleCloseModal}
            onSave={handleSaveRecurringAssignment}
          />
      )}
    </div>
  );
};

export default App;
