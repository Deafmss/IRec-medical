import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAssignedDoctor, getPatientAppointments, createAuditLog } from '../services/supabaseService';
import LocalResourcesPanel from './LocalResourcesPanel';

// Helper to generate REAL clinical tasks based strictly on active prescriptions, evaluation treatment plans, and profile data
const generateDynamicTasks = (profile, hasActiveWound = false, latestEntry = null) => {
  const list = [];
  
  // 1. REAL PRESCRIBED WOUND TREATMENT PLAN & DRESSING (ONLY IF AN ACTIVE OPEN WOUND HAS AN EXPLICIT PRESCRIBED TREATMENT OR DRESSING)
  if (hasActiveWound && latestEntry) {
    if (latestEntry.treatmentPlan) {
      const planItems = Array.isArray(latestEntry.treatmentPlan)
        ? latestEntry.treatmentPlan
        : typeof latestEntry.treatmentPlan === 'string'
          ? latestEntry.treatmentPlan.split('\n').filter(Boolean)
          : [];

      planItems.forEach((item, idx) => {
        const cleanText = item.replace(/^[-*•\d.]+\s*/, '').trim();
        if (cleanText.length > 3) {
          list.push({
            id: `prescribed_plan_${idx}`,
            text: cleanText,
            category: '📌 Prescrição da Lesão',
            isPrescribed: true
          });
        }
      });
    }

    if (latestEntry.appliedDressing) {
      const freqText = latestEntry.dressingFrequency ? ` [Frequência: ${latestEntry.dressingFrequency}]` : '';
      list.push({
        id: 'prescribed_dressing',
        text: `Aplicar cobertura prescrita: ${latestEntry.appliedDressing}${freqText}`,
        category: '📌 Curativo Prescrito',
        isPrescribed: true
      });
    }
  }
  
  // 2. REAL CONTINUOUS MEDICATIONS FROM CLINICAL PROFILE
  if (profile?.medications && profile.medications.trim().length > 0) {
    const medList = profile.medications
      .split(/[,;\n]/)
      .map(m => m.trim())
      .filter(m => m.length > 1);

    if (medList.length > 0) {
      medList.forEach((med, idx) => {
        list.push({
          id: `real_med_${idx}`,
          text: `Tomar medicamento de uso contínuo prescrito: ${med}`,
          category: '💊 Medicamento Prescrito',
          isPrescribed: true
        });
      });
    }
  }

  // 3. ALLERGIES & SENSITIVITIES ALERT FROM PROFILE
  if (profile?.allergies && profile.allergies.trim().length > 0) {
    list.push({
      id: 'allergy_caution',
      text: `Evitar exposição a alergênicos cadastrados na ficha: ${profile.allergies}`,
      category: '⚠️ Alerta de Alergia',
      isPrescribed: true
    });
  }

  // 4. CLINICAL PROFILE COMORBIDITIES & SPECIFIC GUIDELINES
  if (profile?.hasDiabetes) {
    list.push({ 
      id: 'glucose_control', 
      text: 'Aferir glicemia capilar (jejum e pós-prandial) e registrar no diário', 
      category: 'Controle Glicêmico' 
    });
    list.push({ 
      id: 'foot_check', 
      text: 'Inspeção visual diária dos pés em busca de rubor, calosidades ou atrito', 
      category: 'Prevenção' 
    });
    list.push({ 
      id: 'dry_toes', 
      text: 'Secar meticulosamente os espaços entre os dedos dos pés após o banho', 
      category: 'Higiene' 
    });
  }

  if (profile?.hasVenousInsufficiency) {
    if (hasActiveWound) {
      list.push({ 
        id: 'compression', 
        text: 'Calçar meia de compressão prescrita ou aplicar bandagem vascular', 
        category: 'Terapia Vascular' 
      });
    }
    list.push({ 
      id: 'leg_elevation', 
      text: 'Elevar os membros inferiores acima do nível do coração (30 min, 3x ao dia)', 
      category: 'Fisiológico' 
    });
  }

  if (profile?.hasPeripheralArterialDisease) {
    list.push({ 
      id: 'pad_pulse', 
      text: 'Verificar pulsos periféricos do pé e avaliar temperatura dos dedos', 
      category: 'Avaliação Arterial' 
    });
  }

  if (profile?.hasHypertension) {
    list.push({ 
      id: 'bp_check', 
      text: 'Verificar a pressão arterial sistêmica (alvo: abaixo de 140/90 mmHg)', 
      category: 'Controle Vascular' 
    });
    list.push({ 
      id: 'low_sodium', 
      text: 'Manter dieta hipossódica restrita em sal para prevenção de retenção líquida', 
      category: 'Nutrição' 
    });
  }

  if (profile?.isSmoker) {
    list.push({ 
      id: 'stop_smoking', 
      text: 'Evitar fumar hoje para preservar a oxigenação arterial e capilar', 
      category: 'Hábitos' 
    });
  }

  if (profile?.hasAmputationHistory) {
    list.push({ 
      id: 'amputee_check', 
      text: 'Inspecionar a pele ao redor do coto de amputação em busca de atrito', 
      category: 'Prevenção' 
    });
  }

  // 5. GENERAL TISSUE HYDRATION & NUTRITION
  list.push({ 
    id: 'hydration', 
    text: 'Ingerir pelo menos 2 a 2.5 litros de água para hidratação tecidual', 
    category: 'Nutrição' 
  });

  return list;
};

export default function Dashboard({ setActiveTab, clinicalProfile, setClinicalProfile, entries = [], onTriggerSOS, onOpenProfileModal }) {
  const patientId = clinicalProfile?.id || 'guest';
  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `irec_checklist_${patientId}_${todayStr}`;

  const hasActiveWound = entries && entries.length > 0;
  const latestEntry = hasActiveWound ? entries[entries.length - 1] : null;

  // Initialize tasks with local storage persistence by date
  const [completedTaskIds, setCompletedTaskIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const baseTasks = generateDynamicTasks(clinicalProfile, hasActiveWound, latestEntry);

  const toggleTask = (id) => {
    setCompletedTaskIds(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('[iRec] Falha ao salvar checklist:', e);
      }
      return next;
    });
  };

  const [myAppointments, setMyAppointments] = useState([]);
  const [assignedClinician, setAssignedClinician] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Load appointments
  useEffect(() => {
    if (clinicalProfile?.id) {
      getPatientAppointments(clinicalProfile.id).then(apps => {
        setMyAppointments(apps || []);
      });
    }
  }, [clinicalProfile]);

  // Load assigned doctor
  useEffect(() => {
    async function loadDoctor() {
      if (clinicalProfile?.id) {
        const doc = await getAssignedDoctor(clinicalProfile.id);
        if (doc) {
          setAssignedClinician(doc);
        }
      }
    }
    loadDoctor();
  }, [clinicalProfile]);

  // Calculate profile completeness %
  const calculateProfileProgress = (profile) => {
    if (!profile) return 0;
    let filled = 0;
    const fields = [
      profile.name,
      profile.birthDate,
      profile.gender,
      profile.healthUnit,
      profile.medications,
      profile.allergies,
      profile.city,
      profile.state,
      profile.street,
      profile.number,
      profile.phone,
      profile.cpf
    ];
    fields.forEach(f => {
      if (f && f.toString().trim().length > 0) filled++;
    });
    return Math.round((filled / fields.length) * 100);
  };

  const profileProgress = calculateProfileProgress(clinicalProfile);

  // Calculate days active in treatment
  let daysActive = 0;
  if (hasActiveWound) {
    const startDateStr = latestEntry.appearanceDate || entries[0].date;
    if (startDateStr) {
      const startDate = new Date(startDateStr);
      if (!isNaN(startDate.getTime())) {
        const diffTime = Math.abs(new Date() - startDate);
        daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
  }

  // Calculate healing progress %
  let healingProgress = 0;
  if (hasActiveWound) {
    if (entries.length >= 2) {
      const firstArea = parseFloat(entries[0].aiAreaCm2) || 0;
      const latestArea = parseFloat(latestEntry.aiAreaCm2) || 0;
      if (firstArea > 0) {
        const areaReduction = ((firstArea - latestArea) / firstArea) * 100;
        healingProgress = Math.max(0, Math.min(100, Math.round(areaReduction)));
      } else {
        const epitelizacao = parseInt(latestEntry.aiTissueAnalysis?.epitelizacao) || 0;
        const granulacao = parseInt(latestEntry.aiTissueAnalysis?.granulacao) || 0;
        healingProgress = Math.min(100, epitelizacao + granulacao);
      }
    } else {
      const epitelizacao = parseInt(latestEntry.aiTissueAnalysis?.epitelizacao) || 0;
      const granulacao = parseInt(latestEntry.aiTissueAnalysis?.granulacao) || 0;
      healingProgress = Math.min(100, epitelizacao + granulacao);
    }
  }

  // Compliance score
  const complianceScore = baseTasks.length > 0
    ? Math.round((completedTaskIds.length / baseTasks.length) * 100)
    : 0;

  // Next appointment info
  const nextApp = myAppointments.length > 0 ? myAppointments[0] : null;

  return (
    <div className="animate-fade-in" style={{ position: 'relative', width: '100%' }}>

      {/* Header Profile & Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
            Olá, {clinicalProfile?.name || 'Paciente'} 👋
          </span>
          <h2 style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
            Seu Painel de Monitoramento
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {assignedClinician ? (
            <span style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              border: '1px solid #10b981',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.15)'
            }}>
              <span style={{ width: '7px', height: '7px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
              Em Acompanhamento ({assignedClinician.name})
            </span>
          ) : (
            <span style={{
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(2, 132, 199, 0.15)'
            }}>
              <span style={{ width: '7px', height: '7px', backgroundColor: 'var(--primary)', borderRadius: '50%' }}></span>
              Cadastro Ativo (Aguardando Profissional)
            </span>
          )}

          <button
            onClick={() => onTriggerSOS && onTriggerSOS()}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid #ef4444',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.2)'
            }}
          >
            🚨 SOS 192
          </button>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px' }}>
        
        {/* Left Column: Progress, Appointments & Care Diary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Hero Healing Progress Ring Card (Glassmorphism Consistente + Luz Vazada Esmeralda) */}
          <div className="glass-card glass-card-emerald-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  EVOLUÇÃO DA LESÃO
                </span>
                <h1 style={{ fontSize: '38px', fontFamily: 'var(--font-display)', fontWeight: '900', color: 'var(--primary)', margin: '4px 0 2px 0' }}>
                  {healingProgress}%
                </h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  Estimativa baseada na área e tecido das fotos evolutivas
                </p>
              </div>

              {/* Circular Progress Ring */}
              <div style={{ position: 'relative', width: '84px', height: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '84px', height: '84px', transform: 'rotate(-90deg)' }}>
                  <circle cx="42" cy="42" r="35" stroke="var(--border-color)" strokeWidth="7" fill="transparent" />
                  <circle cx="42" cy="42" r="35" stroke="var(--primary)" strokeWidth="7" fill="transparent" 
                    strokeDasharray="219.9" 
                    strokeDashoffset={219.9 - (219.9 * healingProgress) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                  />
                </svg>
                <div style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  fontFamily: 'var(--font-display)', 
                  fontWeight: '900', 
                  fontSize: '13px',
                  color: 'var(--primary)'
                }}>
                  iRec
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', marginTop: '18px', paddingTop: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lesão Ativa</span>
                <p style={{ fontSize: '13px', fontWeight: '700', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {hasActiveWound ? latestEntry.type : 'Nenhuma'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dor Relatada</span>
                <p style={{ fontSize: '13px', fontWeight: '800', margin: '2px 0 0 0', color: hasActiveWound && latestEntry.pain > 6 ? '#ef4444' : 'var(--primary)' }}>
                  {hasActiveWound ? `${latestEntry.pain}/10` : 'Sem dor'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acompanhamento</span>
                <p style={{ fontSize: '13px', fontWeight: '700', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {daysActive} dias
                </p>
              </div>
            </div>
          </div>

          {/* Next Appointment Card (Glassmorphism Consistente + Luz Vazada Azul) */}
          <div className="glass-card glass-card-cyan-glow neon-edge-blue" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            margin: 0
          }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                color: 'var(--primary)',
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                📅
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>
                  PRÓXIMA CONSULTA
                </span>
                <h4 style={{ fontSize: '14.5px', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {nextApp ? `${nextApp.date} às ${nextApp.time}` : 'Nenhuma consulta agendada'}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {nextApp ? `Com Dr(a). ${nextApp.doctorName || 'Especialista'}` : 'Agende sua teleconsulta para acompanhamento com a equipe'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab(nextApp ? 'telemedicine' : 'my-appointments')}
              style={{
                position: 'relative',
                zIndex: 1,
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '12.5px',
                fontWeight: '800',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)'
              }}
            >
              {nextApp ? '🎥 Acessar Sala HD' : '📅 Agendar'}
            </button>
          </div>

          {/* Daily Care Checklist (Glassmorphism Consistente + Luz Vazada Azul) */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  📋 Diário de Cuidados de Hoje
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Reflexo direto das prescrições médicas, alergias e ficha clínica
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '20px', fontWeight: '900', color: complianceScore > 60 ? '#10b981' : '#f59e0b' }}>
                  {complianceScore}%
                </span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Adesão Hoje
                </span>
              </div>
            </div>

            {/* Compliance Bar */}
            <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '7px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '18px', overflow: 'hidden' }}>
              <div style={{
                width: `${complianceScore}%`,
                height: '100%',
                backgroundColor: complianceScore > 60 ? '#10b981' : '#f59e0b',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }}></div>
            </div>

            {/* Checklist Tasks */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {baseTasks.map(task => {
                const isChecked = completedTaskIds.includes(task.id);
                return (
                  <label
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: isChecked
                        ? 'rgba(16, 185, 129, 0.08)'
                        : task.isPrescribed
                          ? 'rgba(2, 132, 199, 0.05)'
                          : 'var(--bg-primary)',
                      border: isChecked
                        ? '1px solid #10b981'
                        : task.isPrescribed
                          ? '1px solid rgba(2, 132, 199, 0.3)'
                          : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isChecked ? '0 0 10px rgba(16, 185, 129, 0.1)' : 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTask(task.id)}
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: '#10b981' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: task.isPrescribed ? 'var(--primary)' : 'var(--text-muted)',
                          textTransform: 'uppercase'
                        }}>
                          {task.category}
                        </span>
                        {task.isPrescribed && (
                          <span style={{ fontSize: '9px', fontWeight: '800', backgroundColor: 'rgba(2, 132, 199, 0.15)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px' }}>
                            Prescrição Oficial
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        margin: 0,
                        textDecoration: isChecked ? 'line-through' : 'none',
                        color: isChecked ? 'var(--text-muted)' : 'var(--text-primary)'
                      }}>
                        {task.text}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <button
              onClick={() => setActiveTab('upload')}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(2, 132, 199, 0.25)'
              }}
            >
              <span>📷</span>
              <span>Fotografar Ferida</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)'
              }}
            >
              <span>💬</span>
              <span>Assistente Clínico</span>
            </button>
          </div>

        </div>

        {/* Right Column: Clinical Profile Summary, Local Health Network & Safety */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Clinical Profile Summary Card (Glassmorphism Consistente + Luz Vazada Azul) */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                👤 Sua Ficha Clínica
              </h3>
              <button
                onClick={() => onOpenProfileModal ? onOpenProfileModal() : setActiveTab('profile')}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Editar Perfil ✏️
              </button>
            </div>

            {/* Profile Completeness Bar */}
            <div style={{ position: 'relative', zIndex: 1, padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  COMPLETUDE DA FICHA
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>
                  {profileProgress}%
                </span>
              </div>
              <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${profileProgress}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>

            {/* Key Clinical Summary Data */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Paciente:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.name || 'Não informado'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cidade / UF:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.city ? `${clinicalProfile.city}/${clinicalProfile.state || ''}` : 'Não informada'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tipo Sanguíneo:</span>
                <strong style={{ color: 'var(--primary)' }}>{clinicalProfile?.bloodType || 'Não informado'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Alergias:</span>
                <strong style={{ color: clinicalProfile?.allergies ? '#ef4444' : 'var(--text-primary)' }}>
                  {clinicalProfile?.allergies || 'Nenhuma alergia relatada'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Medicamentos:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.medications || 'Uso contínuo não informado'}</strong>
              </div>
            </div>
          </div>

          {/* Assigned Doctor & Local Health Resources (Glassmorphism Consistente + Borda Esmeralda) */}
          <div className="glass-card neon-edge-emerald" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: '0 0 14px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🩺 Profissional Responsável & Rede Local
            </h3>

            {assignedClinician ? (
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', borderLeft: '4px solid #10b981', marginBottom: '14px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>Médico Assistente</span>
                <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>Dr(a). {assignedClinician.name}</h4>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>CRM: {assignedClinician.crm} • {assignedClinician.specialty || 'Clínica Médica'}</p>
              </div>
            ) : null}

            <LocalResourcesPanel clinicalProfile={clinicalProfile} compact={true} />

            <button
              onClick={() => setShowMapModal(true)}
              style={{
                width: '100%',
                marginTop: '12px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              🗺️ Ver Mapa Completo de Hospitais & UPAs
            </button>
          </div>

          {/* Safety & Red Flag Alert Box (Glassmorphism Consistente + Luz Vazada Vermelha) */}
          <div className="glass-card glass-card-danger-glow neon-edge-danger" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#ef4444' }}>
                Sinais de Urgência (Red Flags)
              </h3>
            </div>
            <p style={{ position: 'relative', zIndex: 1, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 14px 0' }}>
              Se notar sangramento abundante, febre superior a 38°C, calafrios ou dor intensa súbita na lesão:
            </p>
            <button
              onClick={() => onTriggerSOS ? onTriggerSOS() : alert("Procure um pronto-socorro ou ligue SAMU 192!")}
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
              }}
            >
              Relatar Sintoma Grave (SOS)
            </button>
          </div>

        </div>
      </div>

      {/* Map Modal Portal */}
      {showMapModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }} onClick={() => setShowMapModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-lg)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🗺️ Rede Local de Saúde: Hospitais & Farmácias
              </h3>
              <button 
                onClick={() => setShowMapModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px' }}
              >
                ✖
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <LocalResourcesPanel clinicalProfile={clinicalProfile} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
