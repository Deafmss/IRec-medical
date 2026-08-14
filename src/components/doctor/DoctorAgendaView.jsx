const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBrazilianHoliday = (monthIndex, dayNumber) => {
  const holidays = {
    '0-1': 'Ano Novo',
    '3-21': 'Tiradentes',
    '4-1': 'Dia do Trabalho',
    '8-7': 'Independência',
    '9-12': 'N. Sra. Aparecida',
    '10-2': 'Finados',
    '10-15': 'Proclamação República',
    '10-20': 'Consciência Negra',
    '11-25': 'Natal'
  };
  return holidays[`${monthIndex}-${dayNumber}`] || null;
};

export default function DoctorAgendaView({
  doctorAppointments = [],
  calendarViewDate,
  setCalendarViewDate,
  selectedCalendarDateStr,
  setSelectedCalendarDateStr,
  agendaStatusFilter,
  setAgendaStatusFilter,
  monthNames,
  getCalendarDays,
  onSelectPatient
}) {
  const todayDateStr = getLocalDateStr();

  return (
    <div className="glass-card glass-card-cyan-glow" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '20px' }}>
      {/* Calendar Controls & Month Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🗓️ {monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
          </h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '20px', cursor: 'pointer' }}
            >
              ◀
            </button>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={() => { setCalendarViewDate(new Date()); setSelectedCalendarDateStr(todayDateStr); }}
              style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700' }}
            >
              Hoje
            </button>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '20px', cursor: 'pointer' }}
            >
              ▶
            </button>
          </div>
        </div>

        {/* Status Filter Pills (Segmented Control Track) */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          background: 'rgba(2, 132, 199, 0.05)',
          border: '1px solid var(--glass-border)',
          borderRadius: '30px',
          backdropFilter: 'blur(10px)',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'all', label: `Todas (${doctorAppointments.length})` },
            { id: 'confirmed', label: `🔵 Agendadas (${doctorAppointments.filter(a => a.status === 'confirmed').length})` },
            { id: 'Em Espera', label: `🟡 Em Espera (${doctorAppointments.filter(a => a.status === 'Em Espera').length})` },
            { id: 'Concluído', label: `🟢 Concluídas (${doctorAppointments.filter(a => a.status === 'Concluído').length})` },
            { id: 'Cancelado', label: `🔴 Canceladas (${doctorAppointments.filter(a => a.status === 'Cancelado' || a.status === 'canceled').length})` }
          ].map(filter => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setAgendaStatusFilter(filter.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: agendaStatusFilter === filter.id ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                background: agendaStatusFilter === filter.id ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                color: agendaStatusFilter === filter.id ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: agendaStatusFilter === filter.id ? '0 3px 10px rgba(2, 132, 199, 0.3)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
          <div 
            key={d} 
            style={{ 
              textAlign: 'center', 
              fontSize: '12px', 
              fontWeight: '800', 
              color: i === 0 ? '#ef4444' : (i === 6 ? '#8b5cf6' : 'var(--text-muted)'), 
              paddingBottom: '4px' 
            }}
          >
            {d}
          </div>
        ))}

        {getCalendarDays().map((dayObj, index) => {
          if (!dayObj) {
            return <div key={`empty_${index}`} style={{ minHeight: '92px', opacity: 0.2 }} />;
          }

          const isToday = dayObj.dateStr === todayDateStr;
          const isSelected = dayObj.dateStr === selectedCalendarDateStr;
          const dayOfWeekIndex = index % 7;
          const isSunday = dayOfWeekIndex === 0;
          const isSaturday = dayOfWeekIndex === 6;
          const holidayName = getBrazilianHoliday(calendarViewDate.getMonth(), dayObj.day);

          const dayApps = doctorAppointments.filter(a => {
            const matchesDate = a.appointmentDate === dayObj.dateStr;
            if (!matchesDate) return false;
            if (agendaStatusFilter === 'all') return true;
            return a.status === agendaStatusFilter;
          });

          return (
            <button
              key={dayObj.dateStr}
              type="button"
              onClick={() => setSelectedCalendarDateStr(dayObj.dateStr)}
              style={{
                minHeight: '92px',
                padding: '8px',
                borderRadius: '14px',
                backgroundColor: isToday 
                  ? 'rgba(16, 185, 129, 0.15)' 
                  : (isSelected 
                    ? 'rgba(2, 132, 199, 0.15)' 
                    : (isSunday 
                      ? 'rgba(239, 68, 68, 0.05)' 
                      : (isSaturday 
                        ? 'rgba(139, 92, 246, 0.05)' 
                        : 'var(--bg-primary)'))),
                border: isToday 
                  ? '2px solid #10b981' 
                  : (isSelected 
                    ? '2px solid #0284c7' 
                    : '1px solid var(--border-color)'),
                boxShadow: isToday ? '0 0 20px rgba(16, 185, 129, 0.35)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '12.5px', 
                    fontWeight: isToday ? '900' : '700', 
                    color: isToday 
                      ? '#10b981' 
                      : (isSunday 
                        ? '#ef4444' 
                        : (isSaturday 
                          ? '#8b5cf6' 
                          : 'var(--text-primary)'))
                  }}>
                    {dayObj.day}
                  </span>
                  {isToday && (
                    <span style={{ fontSize: '9px', fontWeight: '900', backgroundColor: '#10b981', color: '#ffffff', padding: '1px 6px', borderRadius: '50px' }}>
                      HOJE
                    </span>
                  )}
                  {dayApps.length > 0 && !isToday && (
                    <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '50px' }}>
                      {dayApps.length}
                    </span>
                  )}
                </div>

                {holidayName && (
                  <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#f59e0b', display: 'block', marginTop: '2px' }}>
                    🎉 {holidayName.slice(0, 10)}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                {dayApps.slice(0, 2).map((app, appIdx) => {
                  const isCanceled = app.status === 'Cancelado' || app.status === 'canceled';
                  const isWaiting = app.status === 'Em Espera';
                  const isCompleted = app.status === 'Concluído';

                  return (
                    <div 
                      key={appIdx} 
                      style={{ 
                        fontSize: '9.5px', 
                        fontWeight: '700',
                        padding: '2px 5px', 
                        borderRadius: '6px', 
                        backgroundColor: isCanceled 
                          ? 'rgba(239, 68, 68, 0.15)' 
                          : (isWaiting 
                            ? 'rgba(234, 179, 8, 0.2)' 
                            : (isCompleted 
                              ? 'rgba(16, 185, 129, 0.2)' 
                              : 'rgba(2, 132, 199, 0.2)')),
                        color: isCanceled 
                          ? '#ef4444' 
                          : (isWaiting 
                            ? '#eab308' 
                            : (isCompleted 
                              ? '#10b981' 
                              : '#0284c7')),
                        textDecoration: isCanceled ? 'line-through' : 'none',
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}
                    >
                      {isCanceled ? '✕' : (isWaiting ? '⏳' : (isCompleted ? '🟢' : '✓'))} {app.appointmentTime || '14:00'} {app.patientName}
                    </div>
                  );
                })}
                {dayApps.length > 2 && (
                  <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: '700' }}>+{dayApps.length - 2} consultas</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Appointments List Panel */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          📋 Consultas do dia {selectedCalendarDateStr.split('-').reverse().join('/')}
        </h4>

        {(() => {
          const filteredDayApps = doctorAppointments.filter(a => {
            const matchesDate = a.appointmentDate === selectedCalendarDateStr;
            if (!matchesDate) return false;
            if (agendaStatusFilter === 'all') return true;
            return a.status === agendaStatusFilter;
          });

          if (filteredDayApps.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Nenhuma consulta agendada para o dia selecionado.
              </div>
            );
          }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {filteredDayApps.map(app => (
                <div
                  key={app.id}
                  className="glass-card"
                  style={{
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    margin: 0
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        padding: '3px 10px',
                        borderRadius: '50px',
                        backgroundColor: app.status === 'Em Espera' ? 'rgba(234, 179, 8, 0.15)' : (app.status === 'Concluído' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)'),
                        color: app.status === 'Em Espera' ? '#eab308' : (app.status === 'Concluído' ? '#10b981' : '#0284c7')
                      }}>
                        ● {app.status || 'confirmed'}
                      </span>
                      <h5 style={{ fontSize: '14.5px', fontWeight: '800', margin: '6px 0 2px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {app.patientName}
                      </h5>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        ⏰ {app.appointmentTime} • {app.modality === 'online' ? '📹 Telemedicina HD' : '🏥 Presencial'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                      {app.price ? `R$ ${app.price.toFixed(2)}` : 'Pago'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onSelectPatient && onSelectPatient(app)}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        fontSize: '12.5px',
                        borderRadius: '30px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                      }}
                    >
                      📹 Atender / Ver Prontuário
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
