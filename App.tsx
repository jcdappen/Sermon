
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SermonPlan, SyncLog, View } from './types';
import * as api from './services/api';
import YearlyViewLayout from './components/YearlyViewLayout';
import SyncLogView from './components/SyncLogView';
import DashboardView from './components/DashboardView';
import AssignSermonModal from './components/AssignSermonModal';
import RecurringAssignmentModal from './components/RecurringAssignmentModal';
import { SyncIcon, DocumentTextIcon, WrenchScrewdriverIcon, ChartBarIcon, UsersIcon, HomeIcon, CalendarDaysIcon } from './components/icons/Icons';

export type YearlyViewType = 'plan' | 'stats' | 'people';

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
  
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearlyView, setYearlyView] = useState<YearlyViewType>('plan');

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
      if (plans.length > 0 && !selectedYear) {
        setSelectedYear(new Date().getFullYear());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Generic error handling for database setup issues
      if (errorMessage.includes('does not exist') || errorMessage.includes('column') || errorMessage.includes('relation')) {
        setError('Die Datenbank ist noch nicht eingerichtet oder veraltet. Bitte führen Sie die Einrichtung durch.');
        setIsDbSetupError(true);
        setIsLoading(false);
        return;
      } else {
        setError('Fehler beim Laden der Plandaten.');
      }
      console.error("Error fetching sermon plans/logs:", err);
    }

    setIsLoading(false);
  }, [selectedYear]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uniqueYears = useMemo(() => {
    const years = new Set(sermonPlans.map(p => new Date(p.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [sermonPlans]);

  const filteredSermonPlans = useMemo(() => {
      if (!selectedYear) return [];
      return sermonPlans.filter(plan => new Date(plan.date).getFullYear() === selectedYear);
  }, [sermonPlans, selectedYear]);

  const filteredPeople = useMemo(() => {
    const preacherMap = new Map<string, { name: string; count: number }>();
    filteredSermonPlans.forEach(plan => {
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
  }, [filteredSermonPlans]);


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
    setError(null);
    try {
      await api.assignPreacher(
        selectedSermon.event_uid,
        details
      );
      await fetchData(); // Refresh data to show changes
      handleCloseModal();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
        setError('Die Datenbank-Struktur ist veraltet. Bitte führen Sie die Einrichtung erneut durch, um sie zu aktualisieren.');
        setIsDbSetupError(true);
        handleCloseModal();
      } else {
        setError('Fehler beim Zuweisen des Predigers.');
      }
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
      collection: string;
      familyTime: string;
      communion: string;
  }) => {
      const { startDate, endDate, pattern } = details;
      
      const parseDateAsLocal = (dateString: string) => {
        // Strips time/timezone info and appends a fixed local time to avoid UTC conversion.
        // '2024-10-27T00:00:00.000Z' becomes '2024-10-27'
        const datePart = dateString.split('T')[0];
        // '2024-10-27T12:00:00' ensures it's parsed as local time near midday,
        // avoiding edge cases with DST changes at midnight.
        return new Date(`${datePart}T12:00:00`);
      };

      const start = parseDateAsLocal(startDate);
      const end = parseDateAsLocal(endDate);
      
      const sermonsToUpdate = sermonPlans.filter(sermon => {
         const sermonDate = parseDateAsLocal(sermon.date);

         if (sermonDate < start || sermonDate > end) return false;
         
         const dayOfWeek = sermonDate.getDay();
         if(dayOfWeek !== 0) return false; // Only consider Sundays
         
         const date = sermonDate.getDate();
         // This is a robust way to determine the Nth occurrence of a weekday in a month.
         // e.g., dates 1-7 are the 1st occurrence, 8-14 are the 2nd, etc.
         const occurrenceInMonth = Math.floor((date - 1) / 7) + 1;

         switch(pattern) {
             case 'every-week': return true;
             case 'every-2-weeks': {
                const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
                const sermonDay = Date.UTC(sermonDate.getFullYear(), sermonDate.getMonth(), sermonDate.getDate());
                
                const dayDiff = (sermonDay - startDay) / (1000 * 60 * 60 * 24);

                if (dayDiff < 0) return false;
                
                const weekDiff = Math.floor(dayDiff / 7);
                return weekDiff % 2 === 0;
             }
             case 'first-sunday': return occurrenceInMonth === 1;
             case 'second-sunday': return occurrenceInMonth === 2;
             case 'third-sunday': return occurrenceInMonth === 3;
             case 'fourth-sunday': return occurrenceInMonth === 4;
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
      
      const confirmationMessage = `Wollen Sie wirklich ${sermonsToUpdate.length} Gottesdienste aktualisieren? Leere Felder in diesem Formular überschreiben bestehende Werte (z.B. Prediger, Thema, Kollekte, Abendmahl).`;

      const confirmed = confirm(confirmationMessage);
      if(!confirmed) return;
      
      setIsLoading(true);
      setError(null);
      try {
          for(const sermon of sermonsToUpdate) {
             const isAssigningPreacher = details.preacherName.trim() !== '';

             await api.assignPreacher(sermon.event_uid, {
                 preacherName: details.preacherName,
                 series: details.series,
                 topic: details.topic,
                 notes: sermon.sermon_notes || '',
                 family_time: details.familyTime,
                 collection: details.collection,
                 communion: details.communion,
                 status: isAssigningPreacher ? 'assigned' : sermon.status,
                 preacherCategory: isAssigningPreacher ? 'Gemeinde' : (sermon.preacher_category || ''),
             });
          }
          await fetchData();
          handleCloseModal();
      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
            setError('Die Datenbank-Struktur ist veraltet. Bitte führen Sie die Einrichtung erneut durch, um sie zu aktualisieren.');
            setIsDbSetupError(true);
            handleCloseModal();
          } else {
            setError('Fehler bei der Serienzuweisung.');
          }
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setView(View.YEARLY);
    setYearlyView('plan');
  };
  
  const NavItem: React.FC<{
    onClick: () => void;
    isActive: boolean;
    icon: React.ReactNode;
    label: string;
  }> = ({ onClick, isActive, icon, label }) => (
    <button
      onClick={onClick}
      className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );

  const renderView = () => {
    if (isLoading && !sermonPlans.length && !isDbSetupError) {
      return <div className="text-center p-8">Lade Daten...</div>;
    }
    if (error && !isDbSetupError) {
       return <div className="text-center p-8 text-red-500 whitespace-pre-wrap">{error}</div>;
    }
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
    

    switch (view) {
      case View.DASHBOARD:
        return (
            <DashboardView
                sermonPlans={sermonPlans}
                syncLogs={syncLogs}
                onSync={handleSyncEvents}
                isLoading={isLoading}
                onNavigateToPlan={() => {
                    if (uniqueYears.length > 0) {
                        handleYearSelect(uniqueYears[0]);
                    }
                }}
                setView={setView}
            />
        );
      case View.YEARLY:
        if (!selectedYear) {
            return <div className="text-center p-8">Bitte wählen Sie ein Jahr aus der Navigation aus.</div>;
        }
        return (
            <YearlyViewLayout
                year={selectedYear}
                activeView={yearlyView}
                onViewChange={setYearlyView}
                sermonPlans={filteredSermonPlans}
                peopleData={filteredPeople}
                onAssign={handleOpenModal}
                onRecurringAssign={handleOpenRecurringModal}
                onSync={handleSyncEvents}
                isLoading={isLoading}
            />
        );
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
          <p className="text-xs text-gray-500">iCal Sync</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
           <NavItem onClick={() => setView(View.DASHBOARD)} isActive={view === View.DASHBOARD} icon={<HomeIcon className="w-5 h-5" />} label="Dashboard" />
           <NavItem onClick={() => setView(View.SYNC_LOG)} isActive={view === View.SYNC_LOG} icon={<SyncIcon className="w-5 h-5" />} label="Sync Protokoll" />
           
           <div className="pt-4 mt-2 border-t">
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Jahresübersicht</h3>
                <div className="space-y-1">
                    {uniqueYears.map(year => (
                        <NavItem 
                            key={year}
                            onClick={() => handleYearSelect(year)}
                            isActive={view === View.YEARLY && selectedYear === year}
                            icon={<CalendarDaysIcon className="w-5 h-5" />}
                            label={String(year)}
                        />
                    ))}
                </div>
           </div>
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
