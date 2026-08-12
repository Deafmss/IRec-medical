import { useState, useEffect } from 'react';
import { getPatientAppointments, cancelAppointment } from '../services/supabaseService';

export default function PatientAppointmentsCalendar({ currentUser, setActiveTab, setTelemedicineContactId }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [filterStatus, setFilterStatus] = useState('upcoming'); // 'all', 'upcoming', 'completed'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedAppDetail, setSelectedAppDetail] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (currentUser?.id) {
          const data = await getPatientAppointments(currentUser.id);
          setAppointments(data || []);
        } else {
          setAppointments([]);
        }
      } catch (err) {
        console.warn('Erro ao carregar agendamentos:', err);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser]);

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to check if a specific YYYY-MM-DD has appointments
  const getAppsForDate = (dateStr) => {
    return appointments.filter(a => a.appointmentDate === dateStr);
  };

  // Filtered list based on status & selected date
  const filteredAppointments = appointments.filter(app => {
    if (selectedDay) {
      if (app.appointmentDate !== selectedDay) return false;
    }
    if (filterStatus === 'upcoming') {
      return app.status === 'confirmed' || app.status === 'pending' || app.appointmentDate >= todayStr;
    }
    if (filterStatus === 'completed') {
      return app.status === 'completed' || app.status === 'canceled' || app.appointmentDate < todayStr;
    }
    return true;
  });

  const handleCancel = async (appId) => {
    if (!window.confirm('Tem certeza de que deseja cancelar esta consulta agendada?')) return;
    setCancelingId(appId);
    try {
      await cancelAppointment(appId);
      setAppointments(prev => prev.map(a => a.id === appId ? { ...a, status: 'canceled' } : a));
      if (selectedAppDetail?.id === appId) {
        setSelectedAppDetail(null);
      }
    } catch (e) {
      console.error('Erro ao cancelar agendamento:', e);
      alert('Erro ao cancelar agendamento. Tente novamente.');
    } finally {
      setCancelingId(null);
    }
  };

  const handleEnterTelemedicine = (docId) => {
    if (setTelemedicineContactId) {
      setTelemedicineContactId(docId || 'doc_1');
    }
    if (setActiveTab) {
      setActiveTab('telemedicine');
    }
  };

  const upcomingCount = appointments.filter(a => a.status === 'confirmed' && a.appointmentDate >= todayStr).length;
  const onlineCount = appointments.filter(a => a.modality === 'online' && a.status === 'confirmed').length;
  const presencialCount = appointments.filter(a => a.modality === 'presencial' && a.status === 'confirmed').length;

  return (
    <div className="dashboard-content-area" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header & Quick Action */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '28px' }}>📅</span>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Consultas Agendadas
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            Gerencie seus horários, acompanhe teleconsultas em HD e consultas presenciais.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab && setActiveTab('doctors_directory')}
            style={{
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              transition: 'transform 0.15s ease'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>➕</span>
            <span>Agendar Nova Consulta</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>
            🗓️ PRÓXIMAS CONSULTAS
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)' }}>
            {upcomingCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Confirmadas na agenda
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>
            📹 TELEMEDICINA HD
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981' }}>
            {onlineCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Atendimentos por vídeo
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>
            🏥 PRESENCIAIS
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#8b5cf6' }}>
            {presencialCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Em clínica ou consultório
          </div>
        </div>
      </div>

      {/* Main View Mode & Filter Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        {/* Toggle Calendar vs List */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              backgroundColor: viewMode === 'calendar' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'calendar' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📅 Calendário
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              backgroundColor: viewMode === 'list' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'list' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📋 Lista
          </button>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => { setFilterStatus('upcoming'); setSelectedDay(null); }}
            style={{
              backgroundColor: filterStatus === 'upcoming' ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
              color: filterStatus === 'upcoming' ? 'var(--primary)' : 'var(--text-muted)',
              border: filterStatus === 'upcoming' ? '1px solid var(--primary)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Próximas
          </button>
          <button
            onClick={() => { setFilterStatus('completed'); setSelectedDay(null); }}
            style={{
              backgroundColor: filterStatus === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: filterStatus === 'completed' ? '#10b981' : 'var(--text-muted)',
              border: filterStatus === 'completed' ? '1px solid #10b981' : '1px solid transparent',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Histórico / Concluídas
          </button>
          <button
            onClick={() => { setFilterStatus('all'); setSelectedDay(null); }}
            style={{
              backgroundColor: filterStatus === 'all' ? 'rgba(100, 116, 139, 0.15)' : 'transparent',
              color: filterStatus === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: filterStatus === 'all' ? '1px solid var(--border-color)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Todas
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'calendar' ? '1fr 340px' : '1fr', gap: '24px' }}>
        {/* CALENDAR VIEW GRID */}
        {viewMode === 'calendar' && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Month Navigation */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {monthNames[month]} {year}
              </h2>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handlePrevMonth}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Mês Anterior"
                >
                  ◀
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '0 12px',
                    height: '36px',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: '700'
                  }}
                >
                  Hoje
                </button>
                <button
                  onClick={handleNextMonth}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Próximo Mês"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              <div>DOM</div>
              <div>SEG</div>
              <div>TER</div>
              <div>QUA</div>
              <div>QUI</div>
              <div>SEX</div>
              <div>SÁB</div>
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {/* Empty leading slots for first day of month */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty_${i}`} style={{ height: '70px', borderRadius: '10px', backgroundColor: 'transparent' }} />
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const formattedDay = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                const formattedMonth = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
                const fullDateStr = `${year}-${formattedMonth}-${formattedDay}`;

                const dayApps = getAppsForDate(fullDateStr);
                const isToday = fullDateStr === todayStr;
                const isSelected = fullDateStr === selectedDay;

                return (
                  <div
                    key={`day_${dayNum}`}
                    onClick={() => setSelectedDay(isSelected ? null : fullDateStr)}
                    style={{
                      height: '75px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.15)' : (isToday ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)'),
                      border: isSelected ? '2px solid var(--primary)' : (isToday ? '2px solid #10b981' : '1px solid var(--border-color)'),
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: isToday || isSelected ? '800' : '600',
                        color: isToday ? '#10b981' : (isSelected ? 'var(--primary)' : 'var(--text-primary)')
                      }}>
                        {dayNum}
                      </span>
                      {isToday && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#ffffff', backgroundColor: '#10b981', padding: '1px 5px', borderRadius: '6px' }}>
                          Hoje
                        </span>
                      )}
                    </div>

                    {/* Appointment dots / badges inside day cell */}
                    {dayApps.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        {dayApps.slice(0, 2).map((app, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              backgroundColor: app.modality === 'online' ? 'rgba(2, 132, 199, 0.9)' : 'rgba(139, 92, 246, 0.9)',
                              color: '#ffffff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {app.appointmentTime} {app.modality === 'online' ? '📹' : '🏥'}
                          </div>
                        ))}
                        {dayApps.length > 2 && (
                          <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--primary)' }}>
                            +{dayApps.length - 2} mais
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* APPOINTMENTS CARDS LIST PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedDay && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--primary)'
            }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
                Filtro por data: {selectedDay.split('-').reverse().join('/')}
              </span>
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}
              >
                Limpar ✖
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Carregando suas consultas...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🩺</div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                Nenhuma consulta encontrada
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                {selectedDay ? 'Não há consultas agendadas para o dia selecionado.' : 'Você não possui consultas agendadas nesta categoria.'}
              </p>
              <button
                onClick={() => setActiveTab && setActiveTab('doctors_directory')}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Encontrar um Especialista
              </button>
            </div>
          ) : (
            filteredAppointments.map(app => {
              const isTodayApp = app.appointmentDate === todayStr;
              const isCanceled = app.status === 'canceled';

              return (
                <div
                  key={app.id}
                  className="glass-card"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: isTodayApp ? '2px solid #10b981' : '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: isCanceled ? 0.6 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Top Bar: Date & Modality */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        backgroundColor: app.modality === 'online' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                        color: app.modality === 'online' ? '#0284c7' : '#8b5cf6',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '4px 10px',
                        borderRadius: '20px'
                      }}>
                        {app.modality === 'online' ? '📹 TELEMEDICINA HD' : '🏥 PRESENCIAL'}
                      </span>

                      {isTodayApp && (
                        <span style={{ backgroundColor: '#10b981', color: '#ffffff', fontSize: '10.5px', fontWeight: '800', padding: '3px 8px', borderRadius: '12px' }}>
                          É HOJE!
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      🗓️ {app.appointmentDate?.split('-').reverse().join('/')} às {app.appointmentTime}
                    </span>
                  </div>

                  {/* Doctor Info */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(2, 132, 199, 0.15)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: '800',
                      flexShrink: 0
                    }}>
                      🩺
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 2px 0', color: 'var(--text-primary)' }}>
                        {app.doctorName || 'Dr. Profissional iRec'}
                      </h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                        {app.doctorSpecialty || 'Especialista em Saúde'}
                      </p>
                    </div>
                  </div>

                  {app.notes && (
                    <div style={{
                      fontSize: '12.5px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-primary)',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      marginBottom: '16px',
                      border: '1px solid var(--border-color)'
                    }}>
                      💬 <strong>Observação:</strong> {app.notes}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    {app.modality === 'online' && !isCanceled && (
                      <button
                        onClick={() => handleEnterTelemedicine(app.doctorId)}
                        style={{
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '10px 16px',
                          fontSize: '13px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        <span>🎥</span>
                        <span>Entrar na Chamada</span>
                      </button>
                    )}

                    {!isCanceled && (
                      <button
                        onClick={() => setSelectedAppDetail(app)}
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        📋 Ver Detalhes
                      </button>
                    )}

                    {!isCanceled && app.status !== 'completed' && (
                      <button
                        onClick={() => handleCancel(app.id)}
                        disabled={cancelingId === app.id}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          opacity: cancelingId === app.id ? 0.5 : 1
                        }}
                      >
                        {cancelingId === app.id ? 'Cancelando...' : 'Cancelamento'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Appointment Details Modal */}
      {selectedAppDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-card" style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '20px',
            maxWidth: '500px',
            width: '100%',
            padding: '28px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                📋 Detalhes da Consulta
              </h3>
              <button
                onClick={() => setSelectedAppDetail(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✖
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>PROFISSIONAL DE SAÚDE</span>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedAppDetail.doctorName}</div>
                <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600' }}>{selectedAppDetail.doctorSpecialty}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>DATA</span>
                  <div style={{ fontWeight: '700' }}>{selectedAppDetail.appointmentDate?.split('-').reverse().join('/')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>HORÁRIO</span>
                  <div style={{ fontWeight: '700' }}>{selectedAppDetail.appointmentTime}</div>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>MODALIDADE DE ATENDIMENTO</span>
                <div style={{ fontWeight: '700', color: selectedAppDetail.modality === 'online' ? '#0284c7' : '#8b5cf6' }}>
                  {selectedAppDetail.modality === 'online' ? '📹 Telemedicina HD (Vídeo)' : '🏥 Presencial'}
                </div>
              </div>

              {selectedAppDetail.address && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>ENDEREÇO DA CLÍNICA</span>
                  <div style={{ fontSize: '13px' }}>{selectedAppDetail.address}</div>
                </div>
              )}

              {selectedAppDetail.price > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>VALOR DA CONSULTA</span>
                  <div style={{ fontWeight: '800', color: '#10b981' }}>
                    R$ {selectedAppDetail.price.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              {selectedAppDetail.modality === 'online' && selectedAppDetail.status !== 'canceled' && (
                <button
                  onClick={() => {
                    handleEnterTelemedicine(selectedAppDetail.doctorId);
                    setSelectedAppDetail(null);
                  }}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    fontSize: '13.5px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  🎥 Entrar na Chamada de Vídeo
                </button>
              )}
              <button
                onClick={() => setSelectedAppDetail(null)}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
