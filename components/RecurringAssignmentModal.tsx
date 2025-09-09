
import React, { useState } from 'react';
import { XMarkIcon } from './icons/Icons';

interface RecurringAssignmentModalProps {
  onClose: () => void;
  onSave: (details: {
    preacherName: string;
    series: string;
    topic: string;
    startDate: string;
    endDate: string;
    pattern: string;
    collection: string;
    familyTime: string;
    communion: string;
  }) => void;
}

// Helper to get local date string in YYYY-MM-DD format, avoiding timezone issues.
const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const RecurringAssignmentModal: React.FC<RecurringAssignmentModalProps> = ({
  onClose,
  onSave,
}) => {
  const [preacherName, setPreacherName] = useState('');
  const [series, setSeries] = useState('');
  const [topic, setTopic] = useState('');
  const [collection, setCollection] = useState('');
  const [familyTime, setFamilyTime] = useState('');
  const [communion, setCommunion] = useState('');
  const [startDate, setStartDate] = useState(getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return getLocalDateString(date);
  });
  const [pattern, setPattern] = useState('every-week');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasData = [preacherName, series, topic, collection, familyTime, communion]
        .some(field => field.trim() !== '');

    if (!hasData) {
        alert('Bitte füllen Sie mindestens ein Zuweisungsfeld aus (Prediger, Serie, Thema, Kollekte, Familytime oder Abendmahl).');
        return;
    }
    
    if (!startDate || !endDate) {
        alert('Bitte wählen Sie ein Start- und Enddatum.');
        return;
    }
    onSave({
      preacherName,
      series,
      topic,
      startDate,
      endDate,
      pattern,
      collection,
      familyTime,
      communion,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg m-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">Serienzuweisung erstellen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* General Details */}
            <div>
              <label htmlFor="preacher" className="block text-sm font-medium text-gray-700 mb-1">
                Prediger (optional)
              </label>
              <input
                type="text"
                id="preacher"
                value={preacherName}
                onChange={(e) => setPreacherName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Name des Predigers"
              />
            </div>
            <div>
              <label htmlFor="series" className="block text-sm font-medium text-gray-700 mb-1">
                Predigtserie (optional)
              </label>
              <input
                type="text"
                id="series"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="z.B. Grundlagen des Glaubens"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
                Thema (optional)
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Wird für alle Termine übernommen"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
             <div>
              <label htmlFor="familyTime" className="block text-sm font-medium text-gray-700 mb-1">
                Familytime-Thema
              </label>
              <input
                type="text"
                id="familyTime"
                value={familyTime}
                onChange={(e) => setFamilyTime(e.target.value)}
                placeholder="Thema der Familytime"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
             <div>
              <label htmlFor="collection" className="block text-sm font-medium text-gray-700 mb-1">
                Kollekte für
              </label>
              <input
                type="text"
                id="collection"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Zweck der Kollekte"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
             <div>
              <label htmlFor="communion" className="block text-sm font-medium text-gray-700 mb-1">
                Abendmahl (Verantwortlich)
              </label>
              <input
                type="text"
                id="communion"
                value={communion}
                onChange={(e) => setCommunion(e.target.value)}
                placeholder="Name der verantwortlichen Person"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Recurrence Rule */}
            <div className="pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Wiederholungsmuster</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Startdatum</label>
                        <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                     <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">Enddatum</label>
                        <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                </div>
                <div className="mt-4">
                    <label htmlFor="pattern" className="block text-sm font-medium text-gray-700 mb-1">Wiederholen an jedem</label>
                    <select id="pattern" value={pattern} onChange={e => setPattern(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        <option value="every-week">Sonntag (Jede Woche)</option>
                        <option value="every-2-weeks">Sonntag (Alle 2 Wochen)</option>
                        <option value="first-sunday">1. Sonntag im Monat</option>
                        <option value="second-sunday">2. Sonntag im Monat</option>
                        <option value="third-sunday">3. Sonntag im Monat</option>
                        <option value="fourth-sunday">4. Sonntag im Monat</option>
                        <option value="last-sunday">Letzten Sonntag im Monat</option>
                    </select>
                </div>
            </div>
          </div>
          <div className="flex justify-end p-4 bg-gray-50 border-t rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Zuweisungen speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecurringAssignmentModal;