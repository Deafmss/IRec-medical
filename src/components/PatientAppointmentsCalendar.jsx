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

  const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr();

  // Helper to check if a specific YYYY-MM-DD has appointments
  const getAppsForDate = (dateStr) => {
    return appointments.filter(a => a.appointmentDate === dateStr);
  };

  // Brazilian National Holidays Map Helper
  const getBrazilianHoliday = (monthNum, dayNum) => {
    const key = `${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const holidays = {
      '01-01': 'Ano Novo',
      '04-21': 'Tiradentes',
      '05-01': 'Trabalho',
      '09-07': 'Independência',
      '10-12': 'N. Sra. Ap.',
      '11-02': 'Finados',
      '11-15': 'Proclamação',
      '11-20': 'Consc. Negra',
      '12-25': 'Natal'
    };
    return holidays[key] || null;
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
    <div className="dashboard-content-area" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>      {/* Header Banner */}
      <div className="glass-card-cyan-glow" style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        padding: '24px',
        borderRadius: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '28px' }}>📅</span>
            <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Consultas Agendadas
            </h1>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            Gerencie seus horários, acompanhe teleconsultas em HD e consultas presenciais.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab && setActiveTab('doctors_directory')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontWeight: '700',
              fontSize: '13.5px',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
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
        <div className="glass-card glass-card-cyan-glow" style={{ padding: '20px', borderRadius: '16px', margin: 0 }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px' }}>
            🗓️ PRÓXIMAS CONSULTAS
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
            {upcomingCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Confirmadas na agenda
          </div>
        </div>

        <div className="glass-card glass-card-emerald-glow" style={{ padding: '20px', borderRadius: '16px', margin: 0 }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px' }}>
            📹 TELEMEDICINA HD
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#10b981', fontFamily: 'var(--font-display)' }}>
            {onlineCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Atendimentos por vídeo
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', margin: 0 }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px' }}>
            🏥 PRESENCIAIS
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#8b5cf6', fontFamily: 'var(--font-display)' }}>
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
        padding: '12px 16px',
        borderRadius: '20px',
        backgroundColor: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)'
      }}>
        {/* Toggle Calendar vs List */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px',
          background: 'rgba(2, 132, 199, 0.05)',
          border: '1px solid var(--glass-border)',
          borderRadius: '30px',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              background: viewMode === 'calendar' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: viewMode === 'calendar' ? '#ffffff' : 'var(--text-secondary)',
              border: viewMode === 'calendar' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
              borderRadius: '24px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: viewMode === 'calendar' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            📅 Calendário
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              background: viewMode === 'list' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: viewMode === 'list' ? '#ffffff' : 'var(--text-secondary)',
              border: viewMode === 'list' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
              borderRadius: '24px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: viewMode === 'list' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
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
              backgroundColor: filterStatus === 'upcoming' ? 'rgba(2, 132, 199, 0.15)' : 'var(--glass-bg)',
              color: filterStatus === 'upcoming' ? '#0284c7' : 'var(--text-muted)',
              border: filterStatus === 'upcoming' ? '1px solid #0284c7' : '1px solid var(--glass-border)',
              borderRadius: '20px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Próximas
          </button>
          <button
            onClick={() => { setFilterStatus('completed'); setSelectedDay(null); }}
            style={{
              backgroundColor: filterStatus === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'var(--glass-bg)',
              color: filterStatus === 'completed' ? '#10b981' : 'var(--text-muted)',
              border: filterStatus === 'completed' ? '1px solid #10b981' : '1px solid var(--glass-border)',
              borderRadius: '20px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Histórico / Concluídas
          </button>
          <button
            onClick={() => { setFilterStatus('all'); setSelectedDay(null); }}
            style={{
              backgroundColor: filterStatus === 'all' ? 'rgba(100, 116, 139, 0.15)' : 'var(--glass-bg)',
              color: filterStatus === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: filterStatus === 'all' ? '1px solid var(--text-muted)' : '1px solid var(--glass-border)',
              borderRadius: '20px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
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
          <div className="glass-card glass-card-cyan-glow" style={{
            padding: '24px',
            borderRadius: '20px',
            margin: 0
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: '800', fontSize: '11.5px', marginBottom: '12px' }}>
              <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '4px', borderRadius: '6px' }}>DOM</div>
              <div style={{ color: 'var(--text-muted)' }}>SEG</div>
              <div style={{ color: 'var(--text-muted)' }}>TER</div>
              <div style={{ color: 'var(--text-muted)' }}>QUA</div>
              <div style={{ color: 'var(--text-muted)' }}>QUI</div>
              <div style={{ color: 'var(--text-muted)' }}>SEX</div>
              <div style={{ color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)', padding: '4px', borderRadius: '6px' }}>SÁB</div>
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {/* Empty leading slots for first day of month */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty_${i}`} style={{ height: '90px', borderRadius: '12px', backgroundColor: 'transparent' }} />
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
                const dayOfWeekIndex = (firstDayOfMonth + i) % 7; // 0 = DOM, 6 = SÁB
                const isSunday = dayOfWeekIndex === 0;
                const isSaturday = dayOfWeekIndex === 6;
                const holidayName = getBrazilianHoliday(month + 1, dayNum);

                // Cell styling logic
                let bgStyle = 'var(--bg-primary)';
                let borderStyle = '1px solid var(--glass-border)';
                let boxShadowStyle = 'none';

                if (isSelected) {
                  bgStyle = 'rgba(2, 132, 199, 0.16)';
                  borderStyle = '2px solid #0284c7';
                  boxShadowStyle = '0 0 16px rgba(2, 132, 199, 0.3)';
                } else if (isToday) {
                  bgStyle = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(2, 132, 199, 0.12) 100%)';
                  borderStyle = '2px solid #10b981';
                  boxShadowStyle = '0 0 20px rgba(16, 185, 129, 0.35)';
                } else if (holidayName) {
                  bgStyle = 'rgba(239, 68, 68, 0.05)';
                  borderStyle = '1px dashed rgba(239, 68, 68, 0.4)';
                } else if (isSunday) {
                  bgStyle = 'rgba(239, 68, 68, 0.03)';
                } else if (isSaturday) {
                  bgStyle = 'rgba(139, 92, 246, 0.03)';
                }

                return (
                  <div
                    key={`day_${dayNum}`}
                    onClick={() => setSelectedDay(isSelected ? null : fullDateStr)}
                    style={{
                      height: '92px',
                      borderRadius: '12px',
                      backgroundColor: bgStyle,
                      border: borderStyle,
                      boxShadow: boxShadowStyle,
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: isToday || isSelected ? '800' : '600',
                        color: isToday ? '#10b981' : (isSelected ? '#0284c7' : (isSunday ? '#ef4444' : (isSaturday ? '#8b5cf6' : 'var(--text-primary)')))
                      }}>
                        {dayNum}
                      </span>
                      {isToday && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#ffffff', backgroundColor: '#10b981', padding: '1px 6px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)' }}>
                          HOJE
                        </span>
                      )}
                      {!isToday && holidayName && (
                        <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '1px 5px', borderRadius: '6px' }} title={holidayName}>
                          🎉 {holidayName}
                        </span>
                      )}
                    </div>

                    {/* Appointment pills inside day cell */}
                    {dayApps.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                        {dayApps.slice(0, 2).map((app, idx) => {
                          const isCanceled = app.status === 'canceled';
                          const isPending = app.status === 'pending';

                          let pillBg = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
                          let pillColor = '#ffffff';
                          let pillBorder = '1px solid rgba(255, 255, 255, 0.2)';
                          let textDecor = 'none';

                          if (isCanceled) {
                            pillBg = 'rgba(239, 68, 68, 0.18)';
                            pillColor = '#ef4444';
                            pillBorder = '1px solid rgba(239, 68, 68, 0.4)';
                            textDecor = 'line-through';
                          } else if (isPending) {
                            pillBg = 'rgba(245, 158, 11, 0.18)';
                            pillColor = '#f59e0b';
                            pillBorder = '1px solid rgba(245, 158, 11, 0.4)';
                          }

                          return (
                            <div
                              key={idx}
                              style={{
                                fontSize: '9.5px',
                                fontWeight: '700',
                                padding: '2px 5px',
                                borderRadius: '6px',
                                background: pillBg,
                                color: pillColor,
                                border: pillBorder,
                                textDecoration: textDecor,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                boxShadow: isCanceled || isPending ? 'none' : '0 2px 6px rgba(2, 132, 199, 0.3)'
                              }}
                            >
                              {isCanceled ? '✕ ' : (isPending ? '⏳ ' : '✓ ')}{app.appointmentTime} {app.modality === 'online' ? '📹' : '🏥'}
                            </div>
                          );
                        })}
                        {dayApps.length > 2 && (
                          <span style={{ fontSize: '9px', fontWeight: '800', color: '#0284c7', paddingLeft: '2px' }}>
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
