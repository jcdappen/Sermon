import React from 'react';
import { SermonPlan } from '../types';
import { YearlyViewType } from '../App';
import SermonPlanView from './SermonPlanView';
import StatisticsView from './StatisticsView';
import PeopleView from './PeopleView';

interface YearlyViewLayoutProps {
  year: number;
  activeView: YearlyViewType;
  onViewChange: (view: YearlyViewType) => void;
  sermonPlans: SermonPlan[];
  peopleData: { name: string; count: number }[];
  onAssign: (sermon: SermonPlan) => void;
  onRecurringAssign: () => void;
  onSync: () => void;
  isLoading: boolean;
}

const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
            isActive 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-600 hover:bg-gray-200'
        }`}
    >
        {label}
    </button>
)

const YearlyViewLayout: React.FC<YearlyViewLayoutProps> = ({
  year,
  activeView,
  onViewChange,
  sermonPlans,
  peopleData,
  ...rest
}) => {
  const renderActiveView = () => {
    switch (activeView) {
      case 'plan':
        return <SermonPlanView sermonPlans={sermonPlans} {...rest} />;
      case 'stats':
        return <StatisticsView sermonPlans={sermonPlans} />;
      case 'people':
        return <PeopleView people={peopleData} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6 border-b pb-4 gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-800">Jahresübersicht {year}</h2>
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
            <TabButton label="Predigtplan" isActive={activeView === 'plan'} onClick={() => onViewChange('plan')} />
            <TabButton label="Statistiken" isActive={activeView === 'stats'} onClick={() => onViewChange('stats')} />
            <TabButton label="Personen" isActive={activeView === 'people'} onClick={() => onViewChange('people')} />
        </div>
      </div>
      {renderActiveView()}
    </div>
  );
};

export default YearlyViewLayout;