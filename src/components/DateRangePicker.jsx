import React, { useState, useEffect, useRef } from 'react';

export default function DateRangePicker({ 
  timePeriod, 
  setTimePeriod, 
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Calendar navigation date representation
  const [viewDate, setViewDate] = useState(new Date());
  
  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Navigation helpers
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Quick Preset Actions
  const handlePreset = (preset) => {
    const now = new Date();
    let start = new Date();
    
    if (preset === '24h') {
      start.setHours(now.getHours() - 24);
      setTimePeriod('24h');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '7d') {
      start.setDate(now.getDate() - 7);
      setTimePeriod('7d');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '15d') {
      start.setDate(now.getDate() - 15);
      setTimePeriod('15d');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '30d') {
      start.setDate(now.getDate() - 30);
      setTimePeriod('30d');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '3m') {
      start.setMonth(now.getMonth() - 3);
      setTimePeriod('custom');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '1y') {
      start.setFullYear(now.getFullYear() - 1);
      setTimePeriod('custom');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setTimePeriod('all');
      setStartDate('');
      setEndDate('');
    }
    setIsOpen(false);
  };

  // Formatting helper for range preview
  const getLabel = () => {
    if (timePeriod === '24h') return 'Hoje';
    if (timePeriod === '7d') return 'Últimos 7 dias';
    if (timePeriod === '15d') return 'Últimos 15 dias';
    if (timePeriod === '30d') return 'Últimos 30 dias';
    if (timePeriod === 'all') return 'Todo o período';
    
    if (startDate && endDate) {
      const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return `${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
      };
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    
    return 'Selecione o período';
  };

  // Day Selection Logic
  const handleDayClick = (day) => {
    const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDateStr);
      setEndDate('');
      setTimePeriod('custom');
    } else {
      const start = new Date(startDate);
      const clicked = new Date(clickedDateStr);
      
      if (clicked < start) {
        setStartDate(clickedDateStr);
        setEndDate('');
      } else {
        setEndDate(clickedDateStr);
        setIsOpen(false); // Close calendar after a complete range selection
      }
      setTimePeriod('custom');
    }
  };

  const isSelected = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return startDate === dateStr || endDate === dateStr;
  };

  const isInRange = (day) => {
    if (!startDate || !endDate) return false;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(dateStr);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return d > start && d < end;
  };

  const renderDaysGrid = () => {
    const days = [];
    
    // Weekday alignment offset slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} style={{ width: '30px', height: '30px' }}></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const daySelected = isSelected(d);
      const dayInRange = isInRange(d);
      
      days.push(
        <button
          key={`day-${d}`}
          onClick={() => handleDayClick(d)}
          style={{
            width: '30px',
            height: '30px',
            border: 'none',
            borderRadius: daySelected ? '50%' : '6px',
            backgroundColor: daySelected 
              ? 'var(--primary)' 
              : dayInRange 
                ? 'rgba(59, 130, 246, 0.15)' 
                : 'transparent',
            color: daySelected 
              ? '#ffffff' 
              : 'var(--text-primary)',
            fontSize: '11.5px',
            fontWeight: daySelected ? '800' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!daySelected && !dayInRange) {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!daySelected && !dayInRange) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {d}
        </button>
      );
    }
    
    return days;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontSize: '12.5px',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
          minWidth: '220px',
          justifyContent: 'space-between'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📅</span>
          <span>{getLabel()}</span>
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          zIndex: 1050,
          display: 'flex',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
          padding: '16px',
          gap: '16px',
          width: '420px',
          animation: 'fadeIn 0.18s ease'
        }}>
          {/* Quick presets list */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderRight: '1px solid var(--border-color)',
            paddingRight: '16px',
            width: '130px',
            flexShrink: 0
          }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selecione</span>
            {[
              { id: '24h', label: 'Hoje' },
              { id: '7d', label: 'Últimos 7 dias' },
              { id: '15d', label: 'Últimos 15 dias' },
              { id: '30d', label: 'Últimos 30 dias' },
              { id: '3m', label: 'Últimos 3 meses' },
              { id: '1y', label: 'Último ano' },
              { id: 'all', label: 'Todo o período' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePreset(p.id)}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '12px',
                  fontWeight: timePeriod === p.id ? '750' : '500',
                  textAlign: 'left',
                  backgroundColor: timePeriod === p.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: timePeriod === p.id ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (timePeriod !== p.id) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  if (timePeriod !== p.id) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month Calendar Grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <button 
                onClick={prevMonth}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', padding: '2px 6px' }}
              >
                ◀
              </button>
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {monthNames[month]} {year}
              </span>
              <button 
                onClick={nextMonth}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', padding: '2px 6px' }}
              >
                ▶
              </button>
            </div>

            {/* Weekdays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
              {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map(w => (
                <span key={w} style={{ fontSize: '9px', fontWeight: '750', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{w}</span>
              ))}
            </div>

            {/* Days grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 2px', justifyItems: 'center' }}>
              {renderDaysGrid()}
            </div>
            
            {startDate && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                Período: <strong>{startDate}</strong> {endDate ? <> a <strong>{endDate}</strong></> : '(selecione data final)'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
