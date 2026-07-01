import React, { useState, useEffect } from 'react';
import { getAssignedPatients, getDoctorPatientsWoundEntries, getDoctorTelemedicineCalls } from '../services/supabaseService';

export default function DoctorDashboardAnalytics({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [woundEntries, setWoundEntries] = useState([]);
  const [calls, setCalls] = useState([]);
  const [timePeriod, setTimePeriod] = useState('30d'); // '24h', '7d', '30d', 'all'

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const [patientsData, entriesData, callsData] = await Promise.all([
          getAssignedPatients(currentUser.id),
          getDoctorPatientsWoundEntries(currentUser.id),
          getDoctorTelemedicineCalls(currentUser.id)
        ]);

        setPatients(patientsData);
        setWoundEntries(entriesData);
        setCalls(callsData);
      } catch (err) {
        console.error('Error fetching doctor analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Filter telemedicine calls based on the selected period
  const getFilteredCalls = () => {
    const now = new Date();
    let thresholdDate = new Date();

    if (timePeriod === '24h') {
      thresholdDate.setHours(now.getHours() - 24);
    } else if (timePeriod === '7d') {
      thresholdDate.setDate(now.getDate() - 7);
    } else if (timePeriod === '30d') {
      thresholdDate.setDate(now.getDate() - 30);
    } else {
      return calls; // 'all'
    }

    return calls.filter(c => new Date(c.created_at || c.createdAt) >= thresholdDate);
  };

  const filteredCalls = getFilteredCalls();

  // 1. Atendimentos Realizados (Calls in period)
  const totalCalls = filteredCalls.length;
  const completedCalls = filteredCalls.filter(c => c.status === 'completed' || c.status === 'finished').length;
  const totalCallDuration = filteredCalls.reduce((acc, c) => acc + (parseInt(c.duration_seconds || c.durationSeconds || 0) / 60), 0);
  const avgCallDuration = totalCalls > 0 ? Math.round(totalCallDuration / totalCalls) : 0;

  // 2. Pacientes Atendidos (Total assigned patients)
  const totalPatients = patients.length;

  // 3. Casos Clínicos Finalizados (Outcome is not 'Tratamento em andamento')
  // We identify the latest wound entry per patient
  const latestWoundEntriesPerPatient = woundEntries.reduce((acc, entry) => {
    const pId = entry.patient_id || entry.patientId;
    if (!acc[pId] || new Date(entry.created_at || entry.createdAt) > new Date(acc[pId].created_at || acc[pId].createdAt)) {
      acc[pId] = entry;
    }
    return acc;
  }, {});

  const finalizedCases = Object.values(latestWoundEntriesPerPatient).filter(
    (entry) => {
      const outcome = entry.clinical_outcome || entry.clinicalOutcome;
      return outcome && outcome !== 'Tratamento em andamento';
    }
  );
  const finalizedCount = finalizedCases.length;

  // 4. Retorno do Paciente (Follow-up rates - Patients with >= 2 entries)
  const patientEntryCounts = {};
  woundEntries.forEach(entry => {
    const pId = entry.patient_id || entry.patientId;
    patientEntryCounts[pId] = (patientEntryCounts[pId] || 0) + 1;
  });

  const totalPatientsWithWounds = Object.keys(patientEntryCounts).length;
  const returnedPatientsCount = Object.values(patientEntryCounts).filter(count => count >= 2).length;
  const returnRatePct = totalPatientsWithWounds > 0 
    ? Math.round((returnedPatientsCount / totalPatientsWithWounds) * 100) 
    : 0;

  // 5. Success Metrics: Average Healing Progress (Area shrinkage percentage)
  const calculateAverageHealingProgress = () => {
    const patientGroups = {};
    woundEntries.forEach(entry => {
      const pId = entry.patient_id || entry.patientId;
      if (!patientGroups[pId]) patientGroups[pId] = [];
      patientGroups[pId].push(entry);
    });

    let totalReductionPct = 0;
    let eligiblePatientsCount = 0;

    Object.entries(patientGroups).forEach(([pId, entries]) => {
      if (entries.length >= 2) {
        // Sort entries by date ascending
        const sorted = [...entries].sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const firstArea = parseFloat(first.ai_area_cm2 || first.aiAreaCm2);
        const lastArea = parseFloat(last.ai_area_cm2 || last.aiAreaCm2);

        if (!isNaN(firstArea) && !isNaN(lastArea) && firstArea > 0) {
          const reduction = ((firstArea - lastArea) / firstArea) * 100;
          totalReductionPct += reduction;
          eligiblePatientsCount++;
        }
      }
    });

    return eligiblePatientsCount > 0 
      ? Math.round(totalReductionPct / eligiblePatientsCount) 
      : null;
  };

  const avgHealingProgress = calculateAverageHealingProgress();

  // 6. Active infection alert signs in their patients' latest triages
  const infectionAlertsCount = Object.values(latestWoundEntriesPerPatient).filter(
    (entry) => {
      const signs = entry.infection_signs || entry.infectionSigns;
      return signs && signs !== 'Nenhum' && signs !== 'none' && signs !== '';
    }
  ).length;

  // 7. Pathology breakdown for this doctor's patients
  const getDoctorPathologyStats = () => {
    const counts = {
      'Diabetes': 0,
      'Hipertensão': 0,
      'Insuf. Venosa': 0,
      'Doença Arterial': 0,
      'Obesidade': 0,
      'Tabagismo': 0
    };

    patients.forEach(p => {
      if (p.hasDiabetes) counts['Diabetes']++;
      if (p.hasHypertension) counts['Hipertensão']++;
      if (p.hasVenousInsufficiency) counts['Insuf. Venosa']++;
      if (p.hasPeripheralArterialDisease) counts['Doença Arterial']++;
      if (p.isObese) counts['Obesidade']++;
      if (p.isSmoker) counts['Tabagismo']++;
    });

    return Object.entries(counts)
      .map(([name, count]) => {
        const pct = totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0;
        return { name, count, pct };
      })
      .sort((a, b) => b.count - a.count);
  };

  const doctorPathologyStats = getDoctorPathologyStats();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', fontWeight: '600' }}>Carregando dados do painel...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-primary)', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🩺 Meu Painel Clínico
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Acompanhe o desempenho dos seus atendimentos e evolução clínica dos seus pacientes.
          </p>
        </div>
        
        {/* Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '750', color: 'var(--text-secondary)' }}>Filtro por Período:</span>
          <select 
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: '700', outline: 'none', cursor: 'pointer' }}
          >
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="all">Todo o período</option>
          </select>
        </div>
      </header>

      {/* Main KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* 1. Atendimentos Realizados */}
        <div className="glass-card" style={{ padding: '20px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>ATENDIMENTOS NO PERÍODO</span>
            <span style={{ fontSize: '18px' }}>📞</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
            {totalCalls}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '8px' }}>
            {completedCalls} finalizados com sucesso.
          </div>
        </div>

        {/* 2. Pacientes Atendidos */}
        <div className="glass-card" style={{ padding: '20px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>PACIENTES VINCULADOS</span>
            <span style={{ fontSize: '18px' }}>👤</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
            {totalPatients}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', marginTop: '8px' }}>
            Carteira ativa sob seu acompanhamento.
          </div>
        </div>

        {/* 3. Casos Clínicos Finalizados */}
        <div className="glass-card" style={{ padding: '20px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>CASOS FINALIZADOS</span>
            <span style={{ fontSize: '18px' }}>✅</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
            {finalizedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--success-light)', fontWeight: '700', marginTop: '8px' }}>
            Pacientes com alta ou desfecho clínico.
          </div>
        </div>

        {/* 4. Retorno do Paciente */}
        <div className="glass-card" style={{ padding: '20px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>TAXA DE RETORNO</span>
            <span style={{ fontSize: '18px' }}>🔁</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
            {returnRatePct}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '8px' }}>
            {returnedPatientsCount} de {totalPatientsWithWounds} pacientes com evoluções.
          </div>
        </div>
      </div>

      {/* Advanced Clinical Insights Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        
        {/* Card: Wound area shrinkage success rate */}
        <div className="glass-card" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📈 Índice Médio de Cicatrização
            </h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '16px' }}>
              <span style={{ fontSize: '42px', fontWeight: '850', color: 'var(--success-light)' }}>
                {avgHealingProgress !== null ? `${avgHealingProgress}%` : '--'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>redução de área da lesão</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: '1.4' }}>
              Cálculo baseado na diferença percentual da área total mensurada por Inteligência Artificial entre a primeira e a última consulta dos pacientes em acompanhamento.
            </p>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--success-light)', fontWeight: '700', marginTop: '12px' }}>
            🎯 Meta clínica esperada: &gt; 30% de redução
          </div>
        </div>

        {/* Card: Active Alerts */}
        <div className="glass-card" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: infectionAlertsCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🚨 Alertas Críticos Ativos
            </h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '16px' }}>
              <span style={{ fontSize: '42px', fontWeight: '850', color: infectionAlertsCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {infectionAlertsCount}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>pacientes com sinais flogísticos</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: '1.4' }}>
              Sinalizações críticas de infecção ativa (calor local, rubor, odor fétido, exsudato purulento) identificadas nas triagens mais recentes dos seus pacientes.
            </p>
          </div>
          <div style={{ fontSize: '11.5px', color: infectionAlertsCount > 0 ? 'var(--danger)' : 'var(--success-light)', fontWeight: '750', marginTop: '12px' }}>
            {infectionAlertsCount > 0 ? '⚠️ Recomenda-se realizar contato ou prescrição.' : '✅ Nenhum sinal de infecção pendente.'}
          </div>
        </div>
      </div>

      {/* Grid: Comorbidities breakdown & Consultations overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Comorbidity list */}
        <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
          <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            🩺 Perfil Clínico da sua Carteira de Pacientes
          </h3>
          
          {totalPatients === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Sem pacientes vinculados no momento.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {doctorPathologyStats.map((item) => (
                <div key={item.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.name}</span>
                    <span style={{ fontWeight: '800' }}>{item.pct}% ({item.count})</span>
                  </div>
                  <div style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Telemedicine details & average call length */}
        <div className="glass-card" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              📞 Métricas de Teleconsultas no Período
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Média de Duração da Chamada:</span>
                <strong>{avgCallDuration} minutos</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total de Tempo Clínico On-line:</span>
                <strong>{Math.round(totalCallDuration)} minutos</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Taxa de Conclusão:</span>
                <strong>{totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0}%</strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '16px' }}>
            💡 Dica: Realizar teleconsultas regularmente reduz o tempo médio de internação e otimiza o ciclo de cicatrização.
          </div>
        </div>

      </div>

    </div>
  );
}
