import React, { useEffect, useRef, useState } from 'react';
import { PersonSearchResult } from '../types';
import * as api from '../services/api';

interface PreacherInputProps {
  name: string;
  personId: number | null;
  onChange: (name: string, personId: number | null) => void;
  placeholder?: string;
}

// Prediger-Eingabe mit ChurchTools-Personensuche.
// Auswahl aus der Liste verknüpft die CT-Person; freier Text = Gast ohne CT-Person.
const PreacherInput: React.FC<PreacherInputProps> = ({ name, personId, onChange, placeholder }) => {
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      try {
        const persons = await api.searchPersons(trimmed);
        if (!cancelled) setResults(persons);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setSearchError(true);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = (value: string) => {
    onChange(value, null);
    setQuery(value);
    setIsOpen(true);
  };

  const handleSelect = (person: PersonSearchResult) => {
    onChange(person.name, person.id);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const showDropdown = isOpen && query.trim().length >= 3;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        id="preacher"
        value={name}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder || 'Name suchen oder eingeben'}
        autoComplete="off"
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand focus:border-brand"
      />
      {showDropdown && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
          {isSearching && <li className="px-3 py-2 text-sm text-gray-500">Suche in ChurchTools...</li>}
          {!isSearching && searchError && (
            <li className="px-3 py-2 text-sm text-brand-dark">ChurchTools-Suche nicht verfügbar</li>
          )}
          {!isSearching && !searchError && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">Keine Person gefunden – wird als Gast eingetragen</li>
          )}
          {!isSearching && results.map(person => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => handleSelect(person)}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-brand/5"
              >
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {name.trim() && (
        <p className="mt-1 text-xs text-gray-500">
          {personId ? 'Mit ChurchTools-Person verknüpft' : 'Gast (ohne ChurchTools-Person)'}
        </p>
      )}
    </div>
  );
};

export default PreacherInput;
