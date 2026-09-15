import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, X, Check } from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';

interface AdminDateTimePickerProps {
  value: string | null; // ISO string
  onChange: (isoString: string) => void;
  min?: string; // ISO string
  placeholder?: string;
  className?: string;
}

export const AdminDateTimePicker: React.FC<AdminDateTimePickerProps> = ({
  value,
  onChange,
  min,
  placeholder = 'Select date and time',
  className = '',
}) => {
  const formatDateTime = (val: string | null): string => val ? new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value or default to tomorrow if empty
  const initialDate = value ? new Date(value) : new Date(Date.now() + 86400000);
  
  // Internal State
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  
  // Date selected in calendar (might not be applied yet)
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  
  // Time state
  const isPm = initialDate.getHours() >= 12;
  const initialHour = initialDate.getHours() % 12 || 12;
  const [hourInput, setHourInput] = useState(String(initialHour).padStart(2, '0'));
  const [minuteInput, setMinuteInput] = useState(String(initialDate.getMinutes()).padStart(2, '0'));
  const [period, setPeriod] = useState<'AM' | 'PM'>(isPm ? 'PM' : 'AM');
  
  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Update internal state when value prop changes externally (e.g. initial load)
  useEffect(() => {
    if (value && !isOpen) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setSelectedDate(d);
        setCurrentMonth(d.getMonth());
        setCurrentYear(d.getFullYear());
        const pm = d.getHours() >= 12;
        setHourInput(String(d.getHours() % 12 || 12).padStart(2, '0'));
        setMinuteInput(String(d.getMinutes()).padStart(2, '0'));
        setPeriod(pm ? 'PM' : 'AM');
      }
    }
  }, [value, isOpen]);

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="pf-admin-calendar__day is-empty" />);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentYear, currentMonth, i);
    const isSelected = selectedDate.getDate() === i && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear;
    
    // Check if past minimum date
    let isDisabled = false;
    if (min) {
      const minDate = new Date(min);
      // For the calendar, we only disable if the entire day is strictly before the min day
      const dateEnd = new Date(currentYear, currentMonth, i, 23, 59, 59);
      if (dateEnd.getTime() < minDate.getTime()) {
        isDisabled = true;
      }
    }

    days.push(
      <button
        key={`day-${i}`}
        type="button"
        disabled={isDisabled}
        className={`pf-admin-calendar__day ${isSelected ? 'is-selected' : ''}`}
        onClick={() => setSelectedDate(date)}
      >
        {i}
      </button>
    );
  }

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentCalendarYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 126 }, (_, index) => currentCalendarYear - 100 + index);

  // Time Handlers
  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(val.length - 2);
    setHourInput(val);
  };

  const handleHourBlur = () => {
    let num = parseInt(hourInput, 10);
    if (isNaN(num) || num < 1) num = 12;
    if (num > 12) num = 12;
    setHourInput(String(num).padStart(2, '0'));
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(val.length - 2);
    setMinuteInput(val);
  };

  const handleMinuteBlur = () => {
    let num = parseInt(minuteInput, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 59) num = 59;
    setMinuteInput(String(num).padStart(2, '0'));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextField?: 'minute' | 'am-pm') => {
    if (e.key === 'Enter') {
      applyValue();
    }
  };

  const applyQuickSelect = (h: number, m: number, p: 'AM' | 'PM') => {
    setHourInput(String(h).padStart(2, '0'));
    setMinuteInput(String(m).padStart(2, '0'));
    setPeriod(p);
  };

  // Compile final value
  const applyValue = () => {
    handleHourBlur();
    handleMinuteBlur();
    
    let h = parseInt(hourInput || '12', 10);
    let m = parseInt(minuteInput || '0', 10);
    
    if (isNaN(h)) h = 12;
    if (isNaN(m)) m = 0;
    
    let hours24 = h;
    if (period === 'PM' && h !== 12) hours24 += 12;
    if (period === 'AM' && h === 12) hours24 = 0;

    const finalDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hours24, m, 0);
    
    // Ensure it's not before min
    if (min) {
      const minDate = new Date(min);
      if (finalDate.getTime() < minDate.getTime()) {
        // Automatically bump to min date if invalid
        onChange(minDate.toISOString());
        setIsOpen(false);
        return;
      }
    }
    
    onChange(finalDate.toISOString());
    setIsOpen(false);
  };
  
  // Format the display string
  const displayString = value ? formatDateTime(value) : '';

  return (
    <div className={`pf-admin-datetime-picker ${className}`} ref={containerRef}>
      <button
        type="button"
        className="pf-admin-datetime-picker__trigger pf-admin-input"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <CalendarIcon size={16} />
        <span>{displayString || placeholder}</span>
      </button>

      {isOpen && (
        <div className="pf-admin-datetime-picker__popover">
          <div className="pf-admin-datetime-picker__panels">
            {/* Calendar Panel */}
            <div className="pf-admin-datetime-picker__calendar">
              <header>
                <div className="pf-admin-calendar__selectors">
                  <AppSelect value={String(currentMonth)} onChange={(event) => setCurrentMonth(Number(event.target.value))} aria-label="Month">{monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</AppSelect>
                  <AppSelect value={String(currentYear)} onChange={(event) => setCurrentYear(Number(event.target.value))} aria-label="Year">{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</AppSelect>
                </div>
                <div className="pf-admin-calendar__nav">
                  <button type="button" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={18} /></button>
                  <button type="button" onClick={nextMonth} aria-label="Next month"><ChevronRight size={18} /></button>
                </div>
              </header>
              <div className="pf-admin-calendar__weekdays">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>
              <div className="pf-admin-calendar__grid">
                {days}
              </div>
            </div>

            {/* Time Panel */}
            <div className="pf-admin-datetime-picker__time">
              <div className="pf-admin-time__header">Time</div>
              
              <div className="pf-admin-time__controls">
                <div className="pf-admin-time__inputs">
                  <div className="pf-admin-time__field">
                    <label>Hour</label>
                    <input 
                      type="text" 
                      value={hourInput} 
                      onChange={handleHourChange} 
                      onBlur={handleHourBlur}
                      onKeyDown={(e) => handleKeyDown(e, 'minute')}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      aria-label="Hour"
                    />
                  </div>
                  <span className="pf-admin-time__colon">:</span>
                  <div className="pf-admin-time__field">
                    <label>Minute</label>
                    <input 
                      type="text" 
                      value={minuteInput} 
                      onChange={handleMinuteChange} 
                      onBlur={handleMinuteBlur}
                      onKeyDown={(e) => handleKeyDown(e)}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      aria-label="Minute"
                    />
                  </div>
                </div>
                
                <div className="pf-admin-time__period">
                  <button 
                    type="button" 
                    className={period === 'AM' ? 'is-active' : ''} 
                    onClick={() => setPeriod('AM')}
                  >AM</button>
                  <button 
                    type="button" 
                    className={period === 'PM' ? 'is-active' : ''} 
                    onClick={() => setPeriod('PM')}
                  >PM</button>
                </div>
              </div>

              <div className="pf-admin-time__quick">
                <span>Quick select</span>
                <div className="pf-admin-time__quick-grid">
                  <button type="button" onClick={() => applyQuickSelect(9, 0, 'AM')}>9:00 AM</button>
                  <button type="button" onClick={() => applyQuickSelect(12, 0, 'PM')}>12:00 PM</button>
                  <button type="button" onClick={() => applyQuickSelect(3, 0, 'PM')}>3:00 PM</button>
                  <button type="button" onClick={() => applyQuickSelect(6, 0, 'PM')}>6:00 PM</button>
                </div>
              </div>
            </div>
          </div>

          <div className="pf-admin-datetime-picker__footer">
            <div className="pf-admin-datetime-picker__preview">
              <small>Selected:</small>
              <strong>
                {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()} &middot; {String(parseInt(hourInput || '12', 10) || 12).padStart(2, '0')}:{String(parseInt(minuteInput || '0', 10) || 0).padStart(2, '0')} {period}
              </strong>
            </div>
            <div className="pf-admin-datetime-picker__actions">
              <button type="button" className="pf-admin-button pf-admin-button--quiet" onClick={() => setIsOpen(false)}>Cancel</button>
              <button type="button" className="pf-admin-button" onClick={applyValue}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
