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
    <>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Personen (Prediger)</h2>
      <p className="text-gray-600 mb-6">Diese Liste zeigt alle Personen, die im ausgewählten Jahr gepredigt haben.</p>
      
      {people.length === 0 ? (
        <p className="text-gray-500">Für dieses Jahr wurden noch keine Prediger zugewiesen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Anzahl Predigten</th>
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
    </>
  );
};

export default PeopleView;