import React, { useState, useEffect } from 'react';
import DoctorAgendaView from './DoctorAgendaView';
import { getDoctorAppointments, getAllPatients } from '../../services/supabaseService';

export default function DoctorAgendaPage({
  currentUser,
  setActiveTab,
  setSelectedPatient
}) {
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedCalendarDateStr, setSelectedCalendarDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [agendaStatusFilter, setAgendaStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const getCalendarDays = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateStr });
    }
    return days;
  };

  const loadData = async () => {
    try {
      if (currentUser?.id) {
        const apps = await getDoctorAppointments(currentUser.id);
        setDoctorAppointments(apps);
      }
      const allP = await getAllPatients();
      setPatients(allP);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div className="clinician-header" style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--bg-secondary)',
        padding: '20px 24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div className="clinician-welcome">
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            🗓️ Agenda de Consultas & Atendimentos
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Profissional logado: Dr(a). {currentUser?.name || 'Médico'} • {currentUser?.specialty || 'Clínica Geral'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '50px',
            backgroundColor: 'var(--primary-glow)',
            color: 'var(--primary)',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            CRM/Registro: {currentUser?.crm || 'N/A'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          Carregando agendamentos...
        </div>
      ) : (
        <DoctorAgendaView
          doctorAppointments={doctorAppointments}
          calendarViewDate={calendarViewDate}
          setCalendarViewDate={setCalendarViewDate}
          selectedCalendarDateStr={selectedCalendarDateStr}
          setSelectedCalendarDateStr={setSelectedCalendarDateStr}
          agendaStatusFilter={agendaStatusFilter}
          setAgendaStatusFilter={setAgendaStatusFilter}
          monthNames={monthNames}
          getCalendarDays={getCalendarDays}
          onSelectPatient={(app) => {
            const foundPatient = patients.find(p => p.id === app.patientId || p.name === app.patientName);
            if (foundPatient) {
              setSelectedPatient(foundPatient);
            } else {
              setSelectedPatient({ id: app.patientId, name: app.patientName, email: app.patientEmail });
            }
            setActiveTab('doctor-dashboard');
          }}
        />
      )}
    </div>
  );
}
