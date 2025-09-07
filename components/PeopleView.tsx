import React from 'react';

// Use a specific, clear type for this component's data
interface PeopleListEntry {
  name: string;
  count: number;
}

interface PeopleViewProps {
  people: PeopleListEntry[];
}

const PeopleView: React.FC<PeopleViewProps> = ({ people }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Personen (Prediger)</h2>
      <p className="text-gray-600 mb-6">Diese Liste wird automatisch aus den zugewiesenen Predigern im Predigtplan generiert und zeigt alle Personen an, die jemals gepredigt haben.</p>
      
      {people.length === 0 ? (
        <p className="text-gray-500">Es wurden noch keine Prediger zugewiesen, um eine Personenliste zu erstellen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Anzahl Predigten (Gesamt)</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.name} className="border-b hover:bg-gray-50">
                  <td className="p-4 text-sm text-gray-800 font-medium">{person.name}</td>
                  <td className="p-4 text-sm text-gray-800 text-center">{person.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PeopleView;
