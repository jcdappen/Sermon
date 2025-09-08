import React, { useMemo } from 'react';
import { SermonPlan, PreacherStat } from '../types';

interface StatisticsViewProps {
  sermonPlans: SermonPlan[];
}

interface CountStat {
  name: string;
  count: number;
}

const StatisticsView: React.FC<StatisticsViewProps> = ({ sermonPlans }) => {
  const preacherStats: PreacherStat[] = useMemo(() => {
    const sermonsWithPreacher = sermonPlans.filter(plan => plan.preacher_name);

    const totalSermons = sermonsWithPreacher.length;
    if (totalSermons === 0) {
      return [];
    }

    const preacherCounts = sermonsWithPreacher.reduce((acc, sermon) => {
      const name = sermon.preacher_name!;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const calculatedStats = Object.entries(preacherCounts).map(([name, count]) => ({
      name,
      count,
      percentage: (count / totalSermons) * 100,
    }));

    // Sort by count descending
    return calculatedStats.sort((a, b) => b.count - a.count);
  }, [sermonPlans]);

  const categoryStats: CountStat[] = useMemo(() => {
    const sermonsWithCategory = sermonPlans.filter(plan => plan.preacher_category);
    if (sermonsWithCategory.length === 0) return [];

    const categoryCounts = sermonsWithCategory.reduce((acc, sermon) => {
      const category = sermon.preacher_category!;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [sermonPlans]);

  const collectionStats: CountStat[] = useMemo(() => {
    const sermonsWithCollection = sermonPlans.filter(plan => plan.collection_purpose && plan.collection_purpose.trim() !== '' && plan.collection_purpose.trim() !== '-');
    if (sermonsWithCollection.length === 0) return [];

    const collectionCounts = sermonsWithCollection.reduce((acc, sermon) => {
      const purpose = sermon.collection_purpose!;
      acc[purpose] = (acc[purpose] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(collectionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [sermonPlans]);

  const StatTable: React.FC<{ title: string; data: CountStat[]; col1Header: string }> = ({ title, data, col1Header }) => (
     <div className="mt-12">
        <h3 className="text-xl font-bold text-gray-800 mb-6">{title}</h3>
        {data.length === 0 ? (
          <p className="text-gray-500">Für diesen Zeitraum sind keine Daten vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-600">{col1Header}</th>
                  <th className="p-4 text-sm font-semibold text-gray-600 text-center">Anzahl</th>
                </tr>
              </thead>
              <tbody>
                {data.map((stat) => (
                  <tr key={stat.name} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-800 font-medium">{stat.name}</td>
                    <td className="p-4 text-sm text-gray-800 text-center">{stat.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
     </div>
  );


  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Prediger-Statistik</h2>
        {preacherStats.length === 0 ? (
          <p className="text-gray-500">Für diesen Zeitraum sind noch keine Predigten mit zugewiesenem Prediger vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-600">Prediger</th>
                  <th className="p-4 text-sm font-semibold text-gray-600 text-center">Anzahl Predigten</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Anteil</th>
                </tr>
              </thead>
              <tbody>
                {preacherStats.map((stat) => (
                  <tr key={stat.name} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-800 font-medium">{stat.name}</td>
                    <td className="p-4 text-sm text-gray-800 text-center">{stat.count}</td>
                    <td className="p-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-4 mr-4">
                          <div
                            className="bg-blue-600 h-4 rounded-full"
                            style={{ width: `${stat.percentage}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-700 w-16 text-right">{stat.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StatTable title="Kategorie-Statistik" data={categoryStats} col1Header="Kategorie" />
      
      <StatTable title="Kollekten-Statistik" data={collectionStats} col1Header="Kollekte für" />

    </>
  );
};

export default StatisticsView;