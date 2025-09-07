

import React, { useState } from 'react';
import { SermonPlan } from '../types';
import { XMarkIcon } from './icons/Icons';

interface AssignSermonModalProps {
  sermon: SermonPlan;
  onClose: () => void;
  onSave: (details: {
    preacherName: string;
    series: string;
    topic: string;
    notes: string;
    family_time: string;
    collection: string;
    communion: string;
    status: SermonPlan['status'];
    preacherCategory: string;
  }) => void;
}

const PREACHER_CATEGORIES = ['Gemeinde', 'Gemeinderat', 'Gast', 'Leitender Pastor'];

const AssignSermonModal: React.FC<AssignSermonModalProps> = ({
  sermon,
  onClose,
  onSave,
}) => {
  const [preacherName, setPreacherName] = useState(sermon.preacher_name || '');
  const [preacherCategory, setPreacherCategory] = useState(sermon.preacher_category || 'Gemeinde');
  const [status, setStatus] = useState<SermonPlan['status']>(
    sermon.status === 'confirmed' ? 'confirmed' : 'assigned'
  );
  const [series, setSeries] = useState(sermon.theme_series || '');
  const [topic, setTopic] = useState(sermon.theme_topic || '');
  const [notes, setNotes] = useState(sermon.sermon_notes || '');
  const [familyTime, setFamilyTime] = useState(sermon.family_time_responsible || '');
  const [collection, setCollection] = useState(sermon.collection_responsible || '');
  const [communion, setCommunion] = useState(sermon.communion_responsible || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preacherName.trim()) {
        alert('Bitte geben Sie den Namen des Predigers ein.');
        return;
    }
    onSave({
      preacherName: preacherName.trim(),
      series,
      topic,
      notes,
      family_time: familyTime,
      collection,
      communion,
      status,
      preacherCategory,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg m-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">Prediger zuweisen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="preacher" className="block text-sm font-medium text-gray-700 mb-1">
                    Prediger
                  </label>
                  <input
                    type="text"
                    id="preacher"
                    value={preacherName}
                    onChange={(e) => setPreacherName(e.target.value)}
                    placeholder="Name des Predigers"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorie
                  </label>
                  <select
                    id="category"
                    value={preacherCategory}
                    onChange={(e) => setPreacherCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {PREACHER_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
            </div>
             <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                </label>
                <select 
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SermonPlan['status'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="assigned">Angefragt</option>
                    <option value="confirmed">Bestätigt</option>
                </select>
            </div>
            <div>
              <label htmlFor="series" className="block text-sm font-medium text-gray-700 mb-1">
                Predigtserie
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
                Predigtthema
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="z.B. Gnade und Vergebung"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
             <div>
              <label htmlFor="familyTime" className="block text-sm font-medium text-gray-700 mb-1">
                Familytime
              </label>
              <input
                type="text"
                id="familyTime"
                value={familyTime}
                onChange={(e) => setFamilyTime(e.target.value)}
                placeholder="Verantwortliche Person / Team"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="collection" className="block text-sm font-medium text-gray-700 mb-1">
                Kollekte
              </label>
              <input
                type="text"
                id="collection"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Verantwortliche Person / Team"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="communion" className="block text-sm font-medium text-gray-700 mb-1">
                Abendmahl
              </label>
              <input
                type="text"
                id="communion"
                value={communion}
                onChange={(e) => setCommunion(e.target.value)}
                placeholder="Verantwortliche Person / Team"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="z.B. Bibelstellen, wichtige Punkte"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
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
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignSermonModal;
