import React, { useState } from 'react';

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
  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Calendar Controls & Month Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🗓️ {monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
          </h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
              style={{ padding: '4px 10px', fontSize: '13px', borderRadius: '8px' }}
            >
              ◀
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => { setCalendarViewDate(new Date()); setSelectedCalendarDateStr(new Date().toISOString().split('T')[0]); }}
              style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '8px' }}
            >
              Hoje
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
              style={{ padding: '4px 10px', fontSize: '13px', borderRadius: '8px' }}
            >
              ▶
            </button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `Todas (${doctorAppointments.length})` },
            { id: 'Agendado', label: `🔵 Agendadas (${doctorAppointments.filter(a => a.status === 'Agendado' || a.status === 'confirmed').length})` },
            { id: 'Em Espera', label: `🟡 Em Espera (${doctorAppointments.filter(a => a.status === 'Em Espera').length})` },
            { id: 'Concluído', label: `🟢 Concluídas (${doctorAppointments.filter(a => a.status === 'Concluído').length})` },
            { id: 'Cancelado', label: `🔴 Canceladas (${doctorAppointments.filter(a => a.status === 'Cancelado' || a.status === 'canceled').length})` }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setAgendaStatusFilter(filter.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '50px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1px solid var(--border-color)',
                backgroundColor: agendaStatusFilter === filter.id ? '#0284c7' : 'var(--bg-secondary)',
                color: agendaStatusFilter === filter.id ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', paddingBottom: '4px' }}>
            {d}
          </div>
        ))}

        {getCalendarDays().map((dayObj, index) => {
          if (!dayObj) {
            return <div key={`empty_${index}`} style={{ minHeight: '70px', opacity: 0.2 }} />;
          }

          const isToday = dayObj.dateStr === new Date().toISOString().split('T')[0];
          const isSelected = dayObj.dateStr === selectedCalendarDateStr;
          const dayApps = doctorAppointments.filter(a => {
            const matchesDate = a.appointmentDate === dayObj.dateStr;
            if (!matchesDate) return false;
            if (agendaStatusFilter === 'all') return true;
            return a.status === agendaStatusFilter;
          });

          return (
            <div
              key={dayObj.dateStr}
              onClick={() => setSelectedCalendarDateStr(dayObj.dateStr)}
              style={{
                minHeight: '75px',
                padding: '6px',
                borderRadius: '12px',
                backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-primary)',
                border: isSelected ? '2px solid #0284c7' : (isToday ? '2px solid #10b981' : '1px solid var(--border-color)'),
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: isToday ? '900' : '700', color: isToday ? '#10b981' : 'var(--text-primary)' }}>
                  {dayObj.day}
                </span>
                {dayApps.length > 0 && (
                  <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '50px' }}>
                    {dayApps.length}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                {dayApps.slice(0, 2).map((app, appIdx) => (
                  <div 
                    key={appIdx} 
                    style={{ 
                      fontSize: '9.5px', 
                      fontWeight: '700',
                      padding: '2px 4px', 
                      borderRadius: '4px', 
                      backgroundColor: app.status === 'Em Espera' ? 'rgba(234, 179, 8, 0.2)' : (app.status === 'Concluído' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.2)'),
                      color: app.status === 'Em Espera' ? '#eab308' : (app.status === 'Concluído' ? '#10b981' : '#0284c7'),
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {app.appointmentTime} {app.patientName}
                  </div>
                ))}
                {dayApps.length > 2 && (
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>+{dayApps.length - 2} consultas</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Day Appointments List Panel */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
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
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '50px',
                        backgroundColor: app.status === 'Em Espera' ? 'rgba(234, 179, 8, 0.15)' : (app.status === 'Concluído' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)'),
                        color: app.status === 'Em Espera' ? '#eab308' : (app.status === 'Concluído' ? '#10b981' : '#0284c7')
                      }}>
                        ● {app.status || 'Agendado'}
                      </span>
                      <h5 style={{ fontSize: '14px', fontWeight: '700', margin: '6px 0 2px 0', color: 'var(--text-primary)' }}>
                        {app.patientName}
                      </h5>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        ⏰ {app.appointmentTime} • {app.modality === 'online' ? '💻 Telemedicina' : '🏥 Presencial'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                      {app.price ? `R$ ${app.price.toFixed(2)}` : 'Pago'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => onSelectPatient && onSelectPatient(app)}
                      style={{ flex: 1, padding: '8px', fontSize: '11.5px', borderRadius: '8px', backgroundColor: '#0284c7' }}
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
