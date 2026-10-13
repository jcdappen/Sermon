import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SermonPlan } from '../types';
import { SyncIcon, CalendarDaysIcon, SunIcon, ExclamationCircleIcon } from './icons/Icons';

interface YearCalendarViewProps {
  year: number;
  sermonPlans: SermonPlan[];
  onAssign: (sermon: SermonPlan) => void;
  onRecurringAssign: () => void;
  onSync: () => void;
  isLoading: boolean;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Kategorie-Farben nach Konkordia-Styleguide (Balken links an der Kachel).
const CATEGORIES: { name: string; bar: string; text: string }[] = [
  { name: 'Leitender Pastor', bar: 'bg-brand-dark', text: 'text-brand-dark' },
  { name: 'Gemeinderat', bar: 'bg-kk-teal-dark', text: 'text-kk-teal-dark' },
  { name: 'Gast', bar: 'bg-kk-gold-dark', text: 'text-kk-gold-dark' },
  { name: 'Gemeinde', bar: 'bg-kk-grey-dark', text: 'text-kk-grey-dark' },
];
const categoryStyle = (category: string | null) =>
  CATEGORIES.find(c => c.name === category) ?? { name: '', bar: 'bg-kk-grey', text: 'text-kk-grey-dark' };

// Schulferien Baden-Württemberg (Start/Ende inklusive).
const HOLIDAYS_BW: [string, string][] = [
  ['2024-03-23', '2024-04-05'], ['2024-05-21', '2024-05-31'], ['2024-07-25', '2024-09-07'],
  ['2024-10-28', '2024-10-31'], ['2024-12-23', '2025-01-04'],
  ['2025-04-14', '2025-04-26'], ['2025-06-10', '2025-06-21'], ['2025-07-31', '2025-09-13'],
  ['2025-10-27', '2025-10-31'], ['2025-12-22', '2026-01-05'],
];
const isHoliday = (isoDate: string) => HOLIDAYS_BW.some(([from, to]) => isoDate >= from && isoDate <= to);

// Datum als YYYY-MM-DD – unabhängig von der Zeitzone des Browsers.
const isoDay = (sermon: SermonPlan) => String(sermon.date).slice(0, 10);

const isOpen = (sermon: SermonPlan) => !sermon.preacher_name;

const detailsTooltip = (sermon: SermonPlan) => [
  sermon.preacher_name && `Prediger: ${sermon.preacher_name}${sermon.preacher_category ? ` (${sermon.preacher_category})` : ''}`,
  sermon.theme_series && `Serie: ${sermon.theme_series}`,
  sermon.theme_topic && `Thema: ${sermon.theme_topic}`,
  sermon.family_time_topic && `Familytime: ${sermon.family_time_topic}`,
  sermon.collection_purpose && `Kollekte: ${sermon.collection_purpose}`,
  sermon.communion_responsible && `Abendmahl: ${sermon.communion_responsible}`,
  sermon.sync_status === 'error' && `ChurchTools-Sync fehlgeschlagen: ${sermon.sync_error || 'unbekannt'}`,
  sermon.sync_status === 'pending' && 'Wird beim nächsten Sync an ChurchTools übertragen',
].filter(Boolean).join('\n');

const SermonTile: React.FC<{
  sermon: SermonPlan;
  isPast: boolean;
  isNext: boolean;
  onAssign: (sermon: SermonPlan) => void;
}> = ({ sermon, isPast, isNext, onAssign }) => {
  const day = isoDay(sermon);
  const date = new Date(`${day}T12:00:00`);
  const open = isOpen(sermon);
  const requested = sermon.status === 'assigned';
  const category = categoryStyle(sermon.preacher_category);
  const subline = sermon.theme_topic || sermon.theme_series || (open ? '' : 'Thema offen');

  return (
    <button
      type="button"
      onClick={() => onAssign(sermon)}
      title={detailsTooltip(sermon) || 'Prediger zuweisen'}
      className={`relative w-full flex items-stretch text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand ${
        open
          ? 'bg-brand text-white hover:bg-brand-dark'
          : `bg-white hover:bg-brand/5 border ${requested ? 'border-dashed border-kk-gold-dark' : 'border-kk-grey-light'}`
      } ${isPast ? 'opacity-60' : ''} ${isNext ? 'ring-2 ring-brand ring-offset-1' : ''}`}
    >
      {!open && <span className={`w-1.5 shrink-0 ${category.bar}`} aria-hidden="true" />}
      <span className={`w-12 shrink-0 flex flex-col items-center justify-center py-2 ${open ? '' : 'border-r border-kk-grey-light'}`}>
        <span className="text-xl font-bold leading-none">{date.getDate().toString().padStart(2, '0')}</span>
        <span className={`text-xs ${open ? 'text-white/80' : 'text-kk-grey-dark'}`}>{WEEKDAYS[date.getDay()]}</span>
      </span>
      <span className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center">
        {open ? (
          <span className="font-bold text-sm tracking-wide">{isPast ? 'Ohne Prediger' : 'OFFEN – zuweisen'}</span>
        ) : (
          <span className={`font-bold text-sm truncate ${category.text}`}>{sermon.preacher_name}</span>
        )}
        {subline && (
          <span className={`text-xs truncate ${open ? 'text-white/80' : 'text-kk-grey-dark'}`}>{subline}</span>
        )}
        {requested && <span className="text-[11px] uppercase tracking-wider text-kk-gold-dark">angefragt</span>}
      </span>
      <span className="flex flex-col items-center justify-center gap-1 pr-2">
        {isHoliday(day) && <SunIcon className={`w-4 h-4 ${open ? 'text-white' : 'text-kk-gold-dark'}`} />}
        {sermon.sync_status === 'error' && <ExclamationCircleIcon className={`w-4 h-4 ${open ? 'text-white' : 'text-brand'}`} />}
        {sermon.sync_status === 'pending' && <SyncIcon className={`w-4 h-4 ${open ? 'text-white' : 'text-kk-gold-dark'}`} />}
      </span>
      {isNext && (
        <span className="absolute -top-2 right-2 bg-brand text-white text-[10px] uppercase tracking-wider px-1.5">Nächster</span>
      )}
    </button>
  );
};

const LegendItem: React.FC<{ swatch: string; label: string }> = ({ swatch, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block w-3 h-3 ${swatch}`} aria-hidden="true" />
    {label}
  </span>
);

const YearCalendarView: React.FC<YearCalendarViewProps> = ({ year, sermonPlans, onAssign, onRecurringAssign, onSync, isLoading }) => {
  const [onlyOpen, setOnlyOpen] = useState(false);
  const monthRefs = useRef<(HTMLElement | null)[]>([]);
  const now = new Date();

  const sorted = useMemo(
    () => [...sermonPlans].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [sermonPlans]
  );
  const nextId = useMemo(() => sorted.find(s => new Date(s.start_time) >= now)?.id ?? null, [sorted]); // eslint-disable-line react-hooks/exhaustive-deps

  const byMonth = useMemo(() => {
    const months: SermonPlan[][] = Array.from({ length: 12 }, () => []);
    for (const sermon of sorted) {
      const month = Number(isoDay(sermon).slice(5, 7)) - 1;
      if (month >= 0 && month < 12) months[month].push(sermon);
    }
    return months;
  }, [sorted]);

  const totals = useMemo(() => ({
    all: sorted.length,
    open: sorted.filter(isOpen).length,
    requested: sorted.filter(s => s.status === 'assigned').length,
  }), [sorted]);

  // Im laufenden Jahr direkt zum aktuellen Monat springen.
  useEffect(() => {
    if (year === now.getFullYear()) {
      monthRefs.current[now.getMonth()]?.scrollIntoView({ block: 'start' });
    }
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span><strong>{totals.all}</strong> Gottesdienste</span>
          <span className={totals.open ? 'text-brand' : 'text-kk-olive'}><strong>{totals.open}</strong> offen</span>
          {totals.requested > 0 && <span className="text-kk-gold-dark"><strong>{totals.requested}</strong> angefragt</span>}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-brand w-4 h-4" />
            Nur offene
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRecurringAssign}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-kk-teal-dark text-white hover:bg-kk-grey-dark disabled:bg-kk-teal-light transition-colors duration-200"
          >
            <CalendarDaysIcon className="w-5 h-5 mr-2" />
            Serienzuweisung
          </button>
          <button
            onClick={onSync}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-brand text-white hover:bg-brand-dark disabled:bg-brand-light transition-colors duration-200"
          >
            <SyncIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Synchronisiere...' : 'Events synchronisieren'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-kk-grey-dark mb-6 pb-4 border-b">
        {CATEGORIES.map(c => <LegendItem key={c.name} swatch={c.bar} label={c.name} />)}
        <LegendItem swatch="bg-brand" label="Offen" />
        <LegendItem swatch="border border-dashed border-kk-gold-dark" label="Angefragt" />
        <span className="inline-flex items-center gap-1.5"><SunIcon className="w-3.5 h-3.5 text-kk-gold-dark" /> Schulferien BW</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {byMonth.map((sermons, month) => {
          const openCount = sermons.filter(isOpen).length;
          const visible = onlyOpen ? sermons.filter(isOpen) : sermons;
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
          return (
            <section
              key={month}
              ref={(el) => { monthRefs.current[month] = el; }}
              className={`bg-kk-grey-light/40 p-3 scroll-mt-4 ${isCurrentMonth ? 'outline outline-2 outline-brand/30' : ''}`}
            >
              <header className="flex items-baseline justify-between mb-3">
                <h3 className="text-lg text-brand-dark">{MONTHS[month]}</h3>
                {sermons.length > 0 && (
                  <span className="text-xs text-kk-grey-dark">
                    {sermons.length} GD{openCount > 0 && <span className="text-brand"> · {openCount} offen</span>}
                  </span>
                )}
              </header>
              <div className="space-y-2">
                {sermons.length === 0 && <p className="text-xs text-kk-grey">Keine Gottesdienste</p>}
                {sermons.length > 0 && visible.length === 0 && <p className="text-xs text-kk-olive">Alles besetzt ✓</p>}
                {visible.map(sermon => (
                  <SermonTile
                    key={sermon.id}
                    sermon={sermon}
                    isPast={new Date(sermon.start_time) < now}
                    isNext={sermon.id === nextId}
                    onAssign={onAssign}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
};

export default YearCalendarView;
