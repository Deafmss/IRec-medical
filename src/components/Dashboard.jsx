import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAssignedDoctor, getPatientAppointments, createAuditLog } from '../services/supabaseService';
import LocalResourcesPanel from './LocalResourcesPanel';

// Helper to generate REAL clinical tasks based strictly on active prescriptions, evaluation treatment plans, and profile data
const generateDynamicTasks = (profile, hasActiveWound = false, latestEntry = null) => {
  const list = [];
  
  // 1. REAL PRESCRIBED WOUND TREATMENT PLAN & DRESSING (fixes IREC-0263)
  if (hasActiveWound && latestEntry) {
    const planSource = latestEntry.treatmentPlan || latestEntry.aiRecommendation;
    if (planSource) {
      const planItems = Array.isArray(planSource)
        ? planSource
        : typeof planSource === 'string'
          ? planSource.split('\n').filter(Boolean)
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

// Safe date parser for pt-BR dd/mm/yyyy strings (fixes IREC-0083)
const parsePtBrDate = (dateStr) => {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

export default function Dashboard({ setActiveTab, clinicalProfile, entries = [], onTriggerSOS, onOpenProfileModal }) {
  const patientId = clinicalProfile?.id || 'guest';
  
  // Local YYYY-MM-DD date string preventing UTC reset at 21h (fixes IREC-0081)
  const getLocalDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr();
  const storageKey = `irec_checklist_${patientId}_${todayStr}`;

  const hasActiveWound = entries && entries.length > 0;
  const latestEntry = hasActiveWound ? entries[entries.length - 1] : null;

  // Initialize tasks with local storage persistence by date
  const [completedTaskIds, setCompletedTaskIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync checklist when storageKey changes e.g. when patientId arrives (fixes IREC-0082)
  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (!isMounted) return;
      try {
        const saved = localStorage.getItem(storageKey);
        setCompletedTaskIds(saved ? JSON.parse(saved) : []);
      } catch {
        setCompletedTaskIds([]);
      }
    });
    return () => { isMounted = false; };
  }, [storageKey]);

  const baseTasks = generateDynamicTasks(clinicalProfile, hasActiveWound, latestEntry);

  const toggleTask = (id) => {
    setCompletedTaskIds(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Safe fallback
      }
      return next;
    });
  };

  const [myAppointments, setMyAppointments] = useState([]);
  const [assignedClinician, setAssignedClinician] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showFullRecordModal, setShowFullRecordModal] = useState(false);

  const profileId = clinicalProfile?.id;

  // Load appointments with cleanup and error handling (fixes IREC-0264, IREC-0469)
  useEffect(() => {
    let isCancelled = false;
    if (profileId) {
      getPatientAppointments(profileId)
        .then(apps => {
          if (!isCancelled) setMyAppointments(apps || []);
        })
        .catch(() => {
          if (!isCancelled) setMyAppointments([]);
        });
    }
    return () => { isCancelled = true; };
  }, [profileId]);

  // Load assigned doctor with reset when unassigned (fixes IREC-0265)
  useEffect(() => {
    let isCancelled = false;
    async function loadDoctor() {
      if (profileId) {
        try {
          const doc = await getAssignedDoctor(profileId);
          if (!isCancelled) {
            setAssignedClinician(doc || null);
          }
        } catch {
          if (!isCancelled) setAssignedClinician(null);
        }
      } else {
        if (!isCancelled) setAssignedClinician(null);
      }
    }
    loadDoctor();
    return () => { isCancelled = true; };
  }, [profileId]);

  // Modal ESC key listener (fixes IREC-0470)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowMapModal(false);
        setShowFullRecordModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Calculate days active in treatment with safe anchor parsing (fixes IREC-0083)
  let daysActive = 0;
  if (hasActiveWound && entries.length > 0) {
    const anchorDateStr = entries[0].date || entries[0].appearanceDate;
    const startDate = parsePtBrDate(anchorDateStr);
    if (startDate) {
      const now = new Date();
      const diffTime = now.getTime() - startDate.getTime();
      if (diffTime >= 0) {
        daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
  }

  // Calculate healing progress % with strict area check (fixes IREC-0009 & IREC-0266)
  let healingProgress = 0;
  let isTissueFallback = false;
  if (hasActiveWound) {
    if (entries.length >= 2) {
      const firstArea = parseFloat(entries[0].aiAreaCm2 ?? entries[0].areaCm2) || 0;
      const latestArea = parseFloat(latestEntry.aiAreaCm2 ?? latestEntry.areaCm2) || 0;
      if (firstArea > 0 && latestArea > 0) {
        const areaReduction = ((firstArea - latestArea) / firstArea) * 100;
        healingProgress = Math.max(0, Math.min(100, Math.round(areaReduction)));
      } else {
        const epitelizacao = parseInt(latestEntry.aiTissueAnalysis?.epitelizacao) || 0;
        healingProgress = Math.min(100, epitelizacao);
        isTissueFallback = true;
      }
    } else {
      const epitelizacao = parseInt(latestEntry.aiTissueAnalysis?.epitelizacao) || 0;
      healingProgress = Math.min(100, epitelizacao);
      isTissueFallback = true;
    }
  }

  // Compliance score over active task intersection (fixes IREC-0267)
  const validCompletedCount = completedTaskIds.filter(id => baseTasks.some(t => t.id === id)).length;
  const complianceScore = baseTasks.length > 0
    ? Math.min(100, Math.round((validCompletedCount / baseTasks.length) * 100))
    : 0;

  // Next appointment info filtering out canceled/past consultations (fixes IREC-0084 & IREC-0268)
  const getNextAppointment = (apps) => {
    if (!Array.isArray(apps) || apps.length === 0) return null;
    const valid = apps.filter(a => {
      const status = String(a.status || '').toLowerCase();
      if (status === 'canceled' || status === 'cancelado') return false;
      return true;
    });
    if (valid.length === 0) return null;
    valid.sort((a, b) => {
      const dateA = a.appointmentDate || a.date || '';
      const dateB = b.appointmentDate || b.date || '';
      return dateA.localeCompare(dateB);
    });
    return valid[0];
  };

  const nextApp = getNextAppointment(myAppointments);

  // Open Record Modal with LGPD Audit Log (fixes IREC-0467)
  const handleOpenFullRecordModal = () => {
    if (profileId) {
      createAuditLog(
        'Acesso ao Prontuário Completo',
        profileId,
        `Visualização da Ficha Clínica Completa por ${clinicalProfile?.name || 'Paciente'}`
      ).catch(() => {});
    }
    setShowFullRecordModal(true);
  };

  // Function to print/download official medical PDF with Audit Log (fixes IREC-0269, IREC-0467)
  const handlePrintFullRecord = () => {
    if (profileId) {
      createAuditLog(
        'Exportação do Prontuário Completo (PDF)',
        profileId,
        `Impressão/Exportação do Prontuário por ${clinicalProfile?.name || 'Paciente'}`
      ).catch(() => {});
    }
    window.print();
  };

  // Helper for height parsing in metres/cm (fixes IREC-0086)
  const parseHeightMetres = (rawHeight) => {
    if (!rawHeight) return null;
    const num = parseFloat(String(rawHeight).replace(',', '.'));
    if (isNaN(num) || num <= 0) return null;
    if (num > 3) return num / 100; // Entered in cm (e.g. 175)
    return num; // Entered in metres (e.g. 1.75)
  };

  const parseWeightKg = (rawWeight) => {
    if (!rawWeight) return null;
    const num = parseFloat(String(rawWeight).replace(',', '.'));
    if (isNaN(num) || num <= 0) return null;
    return num;
  };

  const heightM = parseHeightMetres(clinicalProfile?.height);
  const weightKg = parseWeightKg(clinicalProfile?.weight);
  
  let imcDisplay = null;
  if (heightM && weightKg && heightM >= 0.5 && heightM <= 2.5 && weightKg >= 20 && weightKg <= 300) {
    const val = weightKg / (heightM * heightM);
    let category = '(Obesidade)';
    if (val < 18.5) category = '(Abaixo do peso)';
    else if (val < 25) category = '(Peso normal)';
    else if (val < 30) category = '(Sobrepeso)';
    imcDisplay = `${val.toFixed(1)} ${category}`;
  }

  // 3-state comorbidity chip renderer (fixes IREC-0087)
  const renderComorbidityChip = (value, positiveLabel, negativeLabel) => {
    let bg = 'var(--bg-secondary)';
    let color = 'var(--text-muted)';
    let label = `⚪ ${positiveLabel} (Não informado)`;

    if (value === true) {
      bg = 'rgba(239, 68, 68, 0.12)';
      color = '#ef4444';
      label = `✓ ${positiveLabel}`;
    } else if (value === false) {
      bg = 'rgba(16, 185, 129, 0.1)';
      color = '#10b981';
      label = `✕ ${negativeLabel}`;
    }

    return (
      <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: bg, color: color, border: '1px solid var(--border-color)' }}>
        {label}
      </span>
    );
  };

  const isNurseClinician = assignedClinician && (
    assignedClinician.role === 'nurse' ||
    (assignedClinician.specialty && assignedClinician.specialty.toLowerCase().includes('enferm')) ||
    (assignedClinician.crm && assignedClinician.crm.toUpperCase().includes('COREN'))
  );

  return (
    <div className="animate-fade-in" style={{ position: 'relative', width: '100%' }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-record-content, .printable-record-content * {
            visibility: visible !important;
          }
          .printable-record-content {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            z-index: 99999 !important;
            background-color: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

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
          <button
            type="button"
            onClick={() => onTriggerSOS && onTriggerSOS()}
            className="btn"
            style={{ 
              padding: '8px 16px', 
              fontSize: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.4)',
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
          
          {/* Hero Healing Progress Ring Card */}
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
                  {isTissueFallback ? 'Composição de epitelização tecidual (avaliação inicial)' : 'Estimativa baseada na redução dimensional da lesão'}
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

          {/* Next Appointment Card (fixes IREC-0084, IREC-0268) */}
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
                  {nextApp ? `${nextApp.appointmentDate || nextApp.date || 'A definir'} às ${nextApp.appointmentTime || nextApp.time || 'A definir'}` : 'Nenhuma consulta agendada'}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {nextApp ? `Com Dr(a). ${nextApp.doctorName || 'Especialista'}` : 'Agende sua teleconsulta para acompanhamento com a equipe'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab(nextApp ? 'telemedicine' : 'doctors_directory')}
              className="btn btn-glow-emerald"
              style={{ whiteSpace: 'nowrap', padding: '10px 18px', fontSize: '12.5px' }}
            >
              {nextApp ? '🎥 Acessar Sala HD' : '📅 Agendar'}
            </button>
          </div>

          {/* Daily Care Checklist */}
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
              type="button"
              onClick={() => setActiveTab('upload')}
              className="btn btn-glow-emerald"
              style={{ padding: '16px', fontSize: '14px' }}
            >
              <span style={{ fontSize: '18px' }}>📷</span>
              <span>Fotografar Ferida</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className="btn btn-glass-action"
              style={{ padding: '16px', fontSize: '14px' }}
            >
              <span style={{ fontSize: '18px' }}>💬</span>
              <span>Assistente Clínico</span>
            </button>
          </div>

        </div>

        {/* Right Column: Clinical Profile Summary, Local Health Network & Safety */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Clinical Profile Summary Card */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                👤 Sua Ficha Clínica
              </h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleOpenFullRecordModal}
                  className="btn btn-glass-action"
                  style={{ padding: '5px 10px', fontSize: '11.5px' }}
                  title="Visualizar a Ficha Clínica Completa em formato prontuário"
                >
                  🔍 Ver Ficha
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProfileModal ? onOpenProfileModal() : setActiveTab('profile')}
                  className="btn btn-glass-action"
                  style={{ padding: '5px 10px', fontSize: '11.5px' }}
                  title="Editar dados da Ficha Clínica"
                >
                  ✏️ Editar
                </button>
              </div>
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
                <strong style={{ color: clinicalProfile?.allergies ? '#ef4444' : 'var(--text-primary)' }}>{clinicalProfile?.allergies || 'Nenhuma alergia relatada'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Medicamentos:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.medications || 'Uso contínuo não informado'}</strong>
              </div>
            </div>
          </div>

          {/* Assigned Doctor & Local Health Resources (fixes IREC-0085) */}
          <div className="glass-card neon-edge-emerald" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '800', margin: '0 0 14px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🩺 Profissional Responsável & Rede Local
            </h3>

            {assignedClinician ? (
              <div style={{ padding: '14px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '14px' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>
                  {isNurseClinician ? 'Enfermeiro(a) Responsável' : 'Médico(a) Assistente'}
                </span>
                <h4 style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                  {isNurseClinician ? `Enf. ${assignedClinician.name}` : `Dr(a). ${assignedClinician.name}`}
                </h4>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                  {assignedClinician.crm ? (assignedClinician.crm.toUpperCase().includes('COREN') ? assignedClinician.crm : `CRM: ${assignedClinician.crm}`) : 'Registro não informado'} • {assignedClinician.specialty || 'Especialista'}
                </p>
              </div>
            ) : null}

            <LocalResourcesPanel clinicalProfile={clinicalProfile} compact={true} />

            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="btn btn-glass-action"
              style={{ width: '100%', padding: '10px 14px', fontSize: '12.5px', marginTop: '12px' }}
            >
              🗺️ Ver Mapa Completo de Hospitais & UPAs
            </button>
          </div>

          {/* Red Flags / Emergency Warnings */}
          <div className="glass-card glass-card-danger-glow neon-edge-danger" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              <h4 style={{ fontSize: '14.5px', fontWeight: '900', color: '#ef4444', margin: 0 }}>
                Sinais de Urgência (Red Flags)
              </h4>
            </div>
            <p style={{ position: 'relative', zIndex: 1, fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.4' }}>
              Se notar sangramento abundante, febre superior a 38°C, calafrios ou dor intensa súbita na lesão:
            </p>
            <button
              type="button"
              onClick={() => onTriggerSOS && onTriggerSOS()}
              className="btn"
              style={{ 
                width: '100%', 
                padding: '12px', 
                fontSize: '13px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)',
                fontWeight: '800'
              }}
            >
              Relatar Sintoma Grave (SOS)
            </button>
          </div>

        </div>
      </div>

      {/* Full Record Printable Modal Portal (fixes IREC-0269, IREC-0467, IREC-0470) */}
      {showFullRecordModal && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Ficha Clínica e Prontuário Oficial"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }} 
          onClick={() => setShowFullRecordModal(false)}
        >
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            margin: 0
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header Fixo Elegante */}
            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '26px' }}>📋</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    Ficha Clínica & Prontuário Oficial
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    iRec Saúde • CFM Res. 2.314/2022 & COFEN Res. 0567/2018
                  </p>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => setShowFullRecordModal(false)}
                style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'var(--bg-secondary)', 
                  color: 'var(--text-primary)', 
                  fontSize: '16px', 
                  fontWeight: '800', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                aria-label="Fechar janela"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Rolável (Corpo Prontuário Médico Impresso) */}
            <div className="printable-record-content" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Section 1: Identificação & Emergência */}
              <div style={{ padding: '18px', backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  👤 Identificação & Contato de Emergência
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Nome Completo:</span> <br /><strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.name || 'Não informado'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>CPF:</span> <br /><strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.cpf || 'Não informado'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Data de Nasc.:</span> <br /><strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.birthDate ? new Date(clinicalProfile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Sexo:</span> <br /><strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.gender || 'Não informado'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Telefone:</span> <br /><strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.phone || 'Não informado'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Cidade / UF:</span> <br /><strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.city ? `${clinicalProfile.city}/${clinicalProfile.state || ''}` : 'Não informada'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Endereço Residencial:</span> <br />
                    <strong style={{ color: 'var(--text-primary)' }}>{clinicalProfile?.street ? `${clinicalProfile.street}, ${clinicalProfile.number || 'S/N'} ${clinicalProfile.complement ? '- ' + clinicalProfile.complement : ''} - Bairro: ${clinicalProfile.neighborhood || ''} (CEP: ${clinicalProfile.cep || ''})` : 'Não informado'}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1', marginTop: '6px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                    <span style={{ fontWeight: '800', color: '#ef4444' }}>🚨 Contato para Casos de Emergência:</span> <br />
                    <strong style={{ fontSize: '13.5px', color: '#ef4444' }}>
                      {clinicalProfile?.emergencyContactName || 'Não cadastrado'} {clinicalProfile?.emergencyContactPhone ? `(${clinicalProfile.emergencyContactPhone})` : ''}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Section 2: Biometria & IMC (fixes IREC-0086) */}
              <div style={{ padding: '18px', backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚖️ Dados Biométricos & Atendimento
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Tipo Sanguíneo:</span> <br /><strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{clinicalProfile?.bloodType || 'Não informado'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Peso Corporal:</span> <br /><strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{weightKg ? `${weightKg} kg` : 'Não informado'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Altura Tecnológica:</span> <br /><strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{heightM ? `${(heightM * 100).toFixed(0)} cm (${heightM.toFixed(2)} m)` : 'Não informada'}</strong></div>
                </div>

                {imcDisplay && (
                  <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>IMC (Índice de Massa Corporal):</span>
                    <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)' }}>
                      {imcDisplay}
                    </span>
                  </div>
                )}
              </div>

              {/* Section 3: Comorbidades & Fatores de Risco (fixes IREC-0087) */}
              <div style={{ padding: '18px', backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🩺 Comorbidades & Condições Clínicas Registradas
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {renderComorbidityChip(clinicalProfile?.hasDiabetes, 'Diabetes Mellitus', 'Sem Diabetes')}
                  {renderComorbidityChip(clinicalProfile?.hasHypertension, 'Hipertensão Arterial', 'Sem Hipertensão')}
                  {renderComorbidityChip(clinicalProfile?.hasVenousInsufficiency, 'Insuficiência Venosa', 'Sem Insuficiência Venosa')}
                  {renderComorbidityChip(clinicalProfile?.hasPeripheralArterialDisease, 'D. Art. Periférica', 'Sem Doença Arterial Periférica')}
                  {renderComorbidityChip(clinicalProfile?.isSmoker, 'Tabagista', 'Não Tabagista')}
                  {renderComorbidityChip(clinicalProfile?.isObese, 'Obesidade', 'Peso Normal')}
                  {clinicalProfile?.hasAmputationHistory && (
                    <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444' }}>
                      ⚠️ Histórico de Amputação
                    </span>
                  )}
                </div>
              </div>

              {/* Section 4: Alergias & Prescrições */}
              <div style={{ padding: '18px', backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  💊 Medicamentos Contínuos & Alergias Cadastradas
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: clinicalProfile?.allergies ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)', border: clinicalProfile?.allergies ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)' }}>
                    <span style={{ fontWeight: '800', color: clinicalProfile?.allergies ? '#ef4444' : 'var(--text-muted)' }}>⚠️ Alergias Conhecidas:</span>{' '}
                    <strong style={{ color: clinicalProfile?.allergies ? '#ef4444' : 'var(--text-primary)', fontSize: '14px' }}>{clinicalProfile?.allergies || 'Nenhuma alergia relatada'}</strong>
                  </div>

                  <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontWeight: '800', color: 'var(--primary)' }}>💊 Medicamentos de Uso Contínuo:</span>{' '}
                    <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{clinicalProfile?.medications || 'Nenhum uso contínuo informado'}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justify: 'center',
              alignItems: 'center',
              padding: '18px 24px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              gap: '14px',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={handlePrintFullRecord}
                className="btn btn-glow-emerald"
                style={{ padding: '12px 22px', fontSize: '13.5px', borderRadius: '12px' }}
              >
                🖨️ Imprimir / Baixar Prontuário em PDF
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowFullRecordModal(false);
                  onOpenProfileModal ? onOpenProfileModal() : setActiveTab('profile');
                }}
                className="btn btn-glass-action"
                style={{ padding: '12px 22px', fontSize: '13.5px', borderRadius: '12px' }}
              >
                ✏️ Editar Ficha Clínica
              </button>

              <button
                type="button"
                onClick={() => setShowFullRecordModal(false)}
                className="btn btn-neon-outline"
                style={{ padding: '12px 22px', fontSize: '13.5px', borderRadius: '12px' }}
              >
                ✕ Fechar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Map Modal Portal (fixes IREC-0470) */}
      {showMapModal && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Rede Local de Saúde: Hospitais & Farmácias"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }} 
          onClick={() => setShowMapModal(false)}
        >
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
                type="button"
                onClick={() => setShowMapModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px' }}
                aria-label="Fechar mapa"
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
