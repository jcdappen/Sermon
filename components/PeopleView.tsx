
import React from 'react';
import { Person } from '../types';

interface PeopleViewProps {
  people: Person[];
}

const PeopleView: React.FC<PeopleViewProps> = ({ people }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Personen</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Email</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Kann predigen</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-b hover:bg-gray-50">
                <td className="p-4 text-sm text-gray-800">{person.name}</td>
                <td className="p-4 text-sm text-gray-500">{person.email || 'Keine Angabe'}</td>
                <td className="p-4 text-sm">
                  {person.can_preach ? (
                    <span className="text-green-600 font-semibold">Ja</span>
                  ) : (
                    <span className="text-gray-500">Nein</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PeopleView;
