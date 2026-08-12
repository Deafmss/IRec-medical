import { useState, useEffect } from 'react';
import DoctorAgendaView from './DoctorAgendaView';
import { getDoctorAppointments, getAssignedPatients, getClinicalProfile } from '../../services/supabaseService';

const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DoctorAgendaPage({
  currentUser,
  setActiveTab,
  setSelectedPatient
}) {
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedCalendarDateStr, setSelectedCalendarDateStr] = useState(getLocalDateStr); // Fixes IREC-0089
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

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        if (currentUser?.id) {
          const [apps, assignedP] = await Promise.all([
            getDoctorAppointments(currentUser.id),
            getAssignedPatients(currentUser.id) // Fixes IREC-0090: load assigned patients only
          ]);
          if (isMounted) {
            setDoctorAppointments(apps || []);
            setPatients(assignedP || []);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar agenda do médico:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    Promise.resolve().then(() => {
      if (isMounted) loadData();
    });

    return () => { isMounted = false; };
  }, [currentUser]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div className="clinician-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
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
          onSelectPatient={async (app) => {
            // Fixes IREC-0010 & IREC-0091: exact ID match only, fetch full profile if missing
            let foundPatient = patients.find(p => p.id === app.patientId);
            if (!foundPatient && app.patientId) {
              try {
                foundPatient = await getClinicalProfile(app.patientId);
              } catch (err) {
                console.warn("Falha ao buscar perfil do paciente:", err);
              }
            }

            if (foundPatient) {
              setSelectedPatient(foundPatient);
              setActiveTab('doctor-dashboard');
            } else {
              alert("O perfil clínico completo deste paciente não foi encontrado no sistema.");
            }
          }}
        />
      )}
    </div>
  );
}
