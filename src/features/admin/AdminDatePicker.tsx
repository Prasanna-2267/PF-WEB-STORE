import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';

interface AdminDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  ariaInvalid?: boolean;
  clearable?: boolean;
}

const parseLocalDate = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const AdminDatePicker: React.FC<AdminDatePickerProps> = ({ value, onChange, min, max, placeholder = 'Select date', className = '', ariaInvalid, clearable = true }) => {
  const minimum = parseLocalDate(min);
  const maximum = parseLocalDate(max);
  const initial = parseLocalDate(value) ?? minimum ?? new Date();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initial);
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = parseLocalDate(value);
    if (!next || open) return;
    setSelected(next); setMonth(next.getMonth()); setYear(next.getFullYear());
  }, [value, open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const first = minimum?.getFullYear() ?? current - 100;
    const last = maximum?.getFullYear() ?? current + 25;
    return Array.from({ length: Math.max(1, last - first + 1) }, (_, index) => first + index);
  }, [min, max]);
  const firstDay = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const days: React.ReactNode[] = Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />);
  for (let day = 1; day <= count; day += 1) {
    const candidate = new Date(year, month, day, 12);
    const disabled = Boolean((minimum && candidate < minimum) || (maximum && candidate > maximum));
    const active = dateValue(candidate) === dateValue(selected);
    days.push(<button key={day} type="button" disabled={disabled} className={active ? 'is-selected' : ''} onClick={() => setSelected(candidate)}>{day}</button>);
  }
  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1, 12);
    setMonth(next.getMonth()); setYear(next.getFullYear());
  };

  return <div ref={root} className={`pf-admin-date-picker ${className}`}>
    <button type="button" className="pf-admin-input pf-admin-date-picker__trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-invalid={ariaInvalid}>
      <CalendarDays size={16} /><span>{value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseLocalDate(value)!) : placeholder}</span>
    </button>
    {open ? <div className="pf-admin-date-picker__popover" role="dialog" aria-label="Choose date">
      <header>
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={17} /></button>
        <div>
          <AppSelect value={String(month)} onChange={(event) => setMonth(Number(event.target.value))} aria-label="Month">{monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</AppSelect>
          <AppSelect value={String(year)} onChange={(event) => setYear(Number(event.target.value))} aria-label="Year">{years.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect>
        </div>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={17} /></button>
      </header>
      <div className="pf-admin-date-picker__weekdays"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
      <div className="pf-admin-date-picker__days">{days}</div>
      <footer>
        {clearable ? <button type="button" className="pf-admin-button pf-admin-button--quiet" onClick={() => { onChange(''); setOpen(false); }}><X size={15} /> Clear</button> : <span />}
        <button type="button" className="pf-admin-button pf-admin-button--primary" onClick={() => { onChange(dateValue(selected)); setOpen(false); }}><Check size={15} /> Apply</button>
      </footer>
    </div> : null}
  </div>;
};
