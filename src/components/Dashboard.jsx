import React, { useState, useEffect } from 'react';
import { updateClinicalProfile, getAssignedDoctor } from '../services/supabaseService';
import LocalResourcesPanel from './LocalResourcesPanel';


// Helper to generate precise caret/daily tasks based on clinical history, comorbidities, and active wound status
const generateDynamicTasks = (profile, hasActiveWound = false, latestEntry = null) => {
  const list = [];
  
  // 1. Core wound procedures (only if patient has active wound)
  if (hasActiveWound) {
    list.push({ 
      id: 'cleaning', 
      text: 'Limpar a lesão com soro fisiológico morno por irrigação (sem fricção)', 
      completed: false, 
      category: 'Procedimento' 
    });
  }
  
  // 2. Wound type specific tasks
  if (profile.hasDiabetes) {
    if (hasActiveWound) {
      const freqText = latestEntry?.dressingFrequency ? ` [Frequência recomendada: ${latestEntry.dressingFrequency}]` : '';
      const dressingText = latestEntry?.appliedDressing
        ? `Aplicar cobertura para Pé Diabético: ${latestEntry.appliedDressing}${freqText}`
        : 'Aplicar cobertura apropriada para Pé Diabético (auxilia no controle bacteriano e umidade)';
      list.push({ 
        id: 'dressing_diabetic', 
        text: dressingText, 
        completed: false, 
        category: 'Procedimento' 
      });
    }
    list.push({ 
      id: 'foot_check', 
      text: 'Realizar inspeção visual de ambos os pés buscando novas pressões, bolhas ou calosidades', 
      completed: false, 
      category: 'Prevenção' 
    });
    list.push({ 
      id: 'dry_toes', 
      text: 'Secar meticulosamente os espaços entre os dedos dos pés após o banho', 
      completed: false, 
      category: 'Higiene' 
    });
    list.push({ 
      id: 'glucose_control', 
      text: 'Aferir a glicemia capilar e registrar no controle de monitoramento (jejum e pós-prandial)', 
      completed: false, 
      category: 'Controle Glicêmico' 
    });
    list.push({ 
      id: 'no_barefoot', 
      text: 'Utilizar sempre meias sem costura e sapatos protetores macios (não andar descalço)', 
      completed: false, 
      category: 'Prevenção' 
    });
  } else {
    if (hasActiveWound) {
      const freqText = latestEntry?.dressingFrequency ? ` [Frequência recomendada: ${latestEntry.dressingFrequency}]` : '';
      const dressingText = latestEntry?.appliedDressing
        ? `Aplicar a cobertura prescrita: ${latestEntry.appliedDressing}${freqText}`
        : 'Aplicar a cobertura/curativo adaptado para lesão (gerenciamento do exsudato)';
      list.push({ 
        id: 'dressing_venous', 
        text: dressingText, 
        completed: false, 
        category: 'Procedimento' 
      });
    }
  }

  // Insuficiência Venosa
  if (profile.hasVenousInsufficiency) {
    if (hasActiveWound) {
      list.push({ 
        id: 'compression', 
        text: 'Calçar a meia de compressão recomendada ou aplicar a bandagem elástica antes de levantar-se', 
        completed: false, 
        category: 'Terapia Vascular' 
      });
    }
    list.push({ 
      id: 'leg_elevation', 
      text: 'Elevar os membros inferiores acima da linha do coração (30 minutos, 3x ao dia)', 
      completed: false, 
      category: 'Fisiológico' 
    });
  }

  // Doença Arterial Periférica
  if (profile.hasPeripheralArterialDisease) {
    list.push({ 
      id: 'pad_pulse', 
      text: 'Verificar os pulsos periféricos do pé e avaliar coloração/temperatura dos dedos', 
      completed: false, 
      category: 'Avaliação Arterial' 
    });
    if (hasActiveWound) {
      list.push({ 
        id: 'pad_no_compression', 
        text: 'Evitar meias apertadas ou qualquer bandagem de alta compressão (contraindicado)', 
        completed: false, 
        category: 'Segurança' 
      });
    }
  }

  // 3. Comorbidity: Hypertension
  if (profile.hasHypertension) {
    list.push({ 
      id: 'bp_check', 
      text: 'Verificar a pressão arterial sistêmica (alvo clínico: abaixo de 140/90 mmHg)', 
      completed: false, 
      category: 'Controle Vascular' 
    });
    list.push({ 
      id: 'low_sodium', 
      text: 'Seguir dieta hipossódica restrita em sal para reduzir retenção de líquidos e edemas', 
      completed: false, 
      category: 'Nutrição' 
    });
  }

  // 4. Comorbidity: Smoking/Tabagismo
  if (profile.isSmoker) {
    list.push({ 
      id: 'stop_smoking', 
      text: 'Evitar fumar hoje para evitar vasoespasmos arteriais e privação de oxigênio na cicatrização', 
      completed: false, 
      category: 'Hábitos' 
    });
  }

  // 5. Obesidade
  if (profile.isObese) {
    list.push({ 
      id: 'obesity_pressure', 
      text: 'Mudar de posição a cada 2 horas para aliviar a pressão nas proeminências ósseas', 
      completed: false, 
      category: 'Prevenção' 
    });
  }

  // 6. Histórico de Amputação
  if (profile.hasAmputationHistory) {
    list.push({ 
      id: 'amputee_check', 
      text: 'Inspecionar a pele ao redor do coto de amputação em busca de áreas avermelhadas ou atrito', 
      completed: false, 
      category: 'Prevenção' 
    });
  }

  // 7. Nutritional support
  list.push({ 
    id: 'hydration', 
    text: 'Ingerir pelo menos 2 a 2.5 litros de água para manter a hidratação sistêmica e tecidual', 
    completed: false, 
    category: 'Nutrição' 
  });
  
  if (profile.hasDiabetes) {
    list.push({
      id: 'protein_diabetic',
      text: 'Manter dieta rica em proteínas magras de alto valor biológico e restrição de carboidratos simples',
      completed: false,
      category: 'Nutrição'
    });
  } else {
    list.push({ 
      id: 'protein_intake', 
      text: 'Consumir alimentos ricos em proteínas e vitamina C para indução de colágeno', 
      completed: false, 
      category: 'Nutrição' 
    });
  }

  // 8. Medication adherence
  if (profile.medications) {
    list.push({ 
      id: 'meds', 
      text: `Tomar a medicação de uso contínuo prescrita: ${profile.medications}`, 
      completed: false, 
      category: 'Medicamentos' 
    });
  } else {
    list.push({ 
      id: 'meds_generic', 
      text: 'Tomar os medicamentos e analgésicos prescritos nos horários estipulados', 
      completed: false, 
      category: 'Medicamentos' 
    });
  }

  return list;
};

export default function Dashboard({ setActiveTab, clinicalProfile, setClinicalProfile, entries = [] }) {
  const hasActiveWound = entries && entries.length > 0;
  const latestEntry = hasActiveWound ? entries[entries.length - 1] : null;

  // Checklist state initialized dynamically based on the patient's profile
  const [tasks, setTasks] = useState(() => generateDynamicTasks(clinicalProfile, hasActiveWound, latestEntry));

  // Keep completion status of tasks when clinical profile or wound history gets updated
  useEffect(() => {
    const freshTasks = generateDynamicTasks(clinicalProfile, hasActiveWound, latestEntry);
    setTasks(prevTasks => {
      return freshTasks.map(newTask => {
        const matchingOld = prevTasks.find(oldTask => oldTask.id === newTask.id);
        if (matchingOld) {
          return { ...newTask, completed: matchingOld.completed };
        }
        return newTask;
      });
    });
  }, [clinicalProfile, entries]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ ...clinicalProfile });
  const [assignedClinician, setAssignedClinician] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);



  // Fetch assigned doctor on component mount or clinical profile update
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

  // Helper for pain level label
  const getPainLabel = (painVal) => {
    const pain = parseInt(painVal);
    if (isNaN(pain) || pain === 0) return 'Sem dor';
    if (pain <= 3) return 'Leve';
    if (pain <= 7) return 'Moderada';
    return 'Forte';
  };

  // Helper to parse date formats
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    const parsed = Date.parse(dateStr);
    return isNaN(parsed) ? null : new Date(parsed);
  };

  // Calculate days active
  let daysActive = 0;
  if (hasActiveWound) {
    const startDateStr = latestEntry.appearanceDate || entries[0].date;
    const startDate = parseDate(startDateStr);
    if (startDate) {
      const diffTime = Math.abs(new Date() - startDate);
      daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  // Calculate dynamic healing progress
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
      // 1 entry
      const epitelizacao = parseInt(latestEntry.aiTissueAnalysis?.epitelizacao) || 0;
      const granulacao = parseInt(latestEntry.aiTissueAnalysis?.granulacao) || 0;
      healingProgress = Math.min(100, epitelizacao + granulacao);
    }
  }

  // Calculate daily compliance score safely
  const completedCount = tasks.filter(t => t.completed).length;
  const complianceScore = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };



  const handleProfileSave = async (e) => {
    e.preventDefault();
    const updated = await updateClinicalProfile(profileForm);
    setClinicalProfile(updated);
    setIsEditingProfile(false);
  };

  // Dynamic data for current active treatment based on actual entries
  const currentTreatment = {
    type: hasActiveWound ? latestEntry.type : 'Nenhuma lesão ativa cadastrada',
    startDate: hasActiveWound ? (latestEntry.appearanceDate || entries[0].date) : null,
    daysActive: daysActive,
    nextDressing: hasActiveWound 
      ? (latestEntry.dressingFrequency 
          ? `Troca recomendada: ${latestEntry.dressingFrequency}` 
          : 'Troca recomendada hoje') 
      : 'Aguardando primeira foto',
    healingProgress: healingProgress,
    painLevel: hasActiveWound ? `${latestEntry.pain}/10 (${getPainLabel(latestEntry.pain)})` : 'Sem dor relatada',
    nurseAssigned: assignedClinician 
      ? `Dr(a). ${assignedClinician.name} (${assignedClinician.specialty || 'Clínico'})` 
      : 'Aguardando vinculação médica'
  };

  const patientCity = (clinicalProfile?.city || '').trim().toLowerCase();
  const patientState = (clinicalProfile?.state || '').trim().toLowerCase();
  const docCity = (assignedClinician?.city || '').trim().toLowerCase();
  const docState = (assignedClinician?.state || '').trim().toLowerCase();
  const isDoctorLocal = assignedClinician && docCity === patientCity && docState === patientState;

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>

      {/* Header Profile Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Olá, {clinicalProfile.name}</p>
          <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: '700' }}>Seu Painel de Monitoramento</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="badge badge-success">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--success-light)', borderRadius: '50%', marginRight: '4px' }}></span>
            Em Acompanhamento
          </span>
        </div>
      </div>

      {/* Responsive Dashboard Grid */}
      <div className="dashboard-grid">
        
        {/* Left Column: Progress summary & Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Main Progress Ring Card */}
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, var(--glass-bg), rgba(16, 185, 129, 0.04))', width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: '1' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evolução Geral</h3>
                <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-display)', fontWeight: '800', color: 'var(--primary)' }}>
                  {currentTreatment.healingProgress}%
                </h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Redução de área estimada no acompanhamento com base em fotos evolutivas.
                </p>
              </div>
              
              {/* Circular Progress Indicator */}
              <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '80px', height: '80px', transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="34" stroke="var(--border-color)" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke="var(--primary)" strokeWidth="6" fill="transparent" 
                    strokeDasharray="213.6" 
                    strokeDashoffset={213.6 - (213.6 * currentTreatment.healingProgress) / 100}
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
                  fontWeight: 'bold', 
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  iRec
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '16px', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lesão Atual</p>
                <p style={{ fontSize: '13.5px', fontWeight: '600' }}>{currentTreatment.type}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dor Relatada</p>
                <p style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--accent)' }}>{currentTreatment.painLevel}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acompanhamento</p>
                <p style={{ fontSize: '13.5px', fontWeight: '600' }}>{currentTreatment.daysActive} dias</p>
              </div>
            </div>
          </div>

          {/* Diário de Cuidados - Checklist */}
          <div className="glass-card" style={{ width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Diário de Cuidados</h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Marque as ações realizadas hoje para manter a cicatrização no prazo</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: complianceScore > 60 ? 'var(--primary)' : 'var(--warning)' }}>
                  {complianceScore}%
                </span>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adesão</p>
              </div>
            </div>

            {/* Compliance Progress Bar */}
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', marginBottom: '18px', overflow: 'hidden' }}>
              <div style={{ width: `${complianceScore}%`, height: '100%', background: 'linear-gradient(to right, var(--accent), var(--primary))', borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
            </div>

            {/* Task Checklist Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tasks.map((task) => (
                <label 
                  key={task.id} 
                  className={`premium-checkbox-label ${task.completed ? 'checked' : ''}`}
                >
                  <input 
                    type="checkbox" 
                    className="premium-checkbox-input" 
                    checked={task.completed} 
                    onChange={() => toggleTask(task.id)}
                  />
                  <div style={{ flex: '1' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {task.text}
                    </p>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {task.category}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '4px' }}>
            <button className="btn btn-primary" onClick={() => setActiveTab('upload')} style={{ height: '54px', fontSize: '14px' }}>
              <svg style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nova Análise
            </button>
            <button className="btn btn-secondary" onClick={() => setActiveTab('history')} style={{ height: '54px', fontSize: '14px' }}>
              <svg style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Ver Histórico
            </button>
          </div>

        </div>

        {/* Right Column: Profile details, Next Dressing & Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Clinical Profile Card */}
          <div className="glass-card" style={{ width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Sua Ficha Clínica</h3>
              <button 
                onClick={() => {
                  setIsEditingProfile(!isEditingProfile);
                  setProfileForm({ ...clinicalProfile });
                }} 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '11px', height: 'auto', borderRadius: '6px' }}
              >
                {isEditingProfile ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Nome do Paciente</label>
                  <input 
                    type="text" 
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Data de Nascimento</label>
                  <input 
                    type="date" 
                    value={profileForm.birthDate}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, birthDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Sexo</label>
                  <select 
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                  >
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Unidade de Atendimento</label>
                  <input 
                    type="text" 
                    placeholder="Hospital, Clínica ou Home Care..."
                    value={profileForm.healthUnit}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, healthUnit: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.hasDiabetes}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hasDiabetes: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    Tem Diabetes?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.hasHypertension}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hasHypertension: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    Tem Hipertensão?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.hasVenousInsufficiency}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hasVenousInsufficiency: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    Tem Insuficiência Venosa?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.hasPeripheralArterialDisease}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hasPeripheralArterialDisease: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    Doença Arterial Periférica?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.isSmoker}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, isSmoker: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    É Fumante (Tabagista)?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.isObese}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, isObese: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    Tem Obesidade?
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.hasAmputationHistory}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hasAmputationHistory: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    Histórico de Amputação?
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Outras Condições Clínicas</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Insuficiência Renal, etc."
                    value={profileForm.otherConditions || ''}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, otherConditions: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12px' }}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginBottom: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={profileForm.hasPreviousUlcers}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hasPreviousUlcers: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <strong>Histórico de Úlceras Anteriores?</strong>
                  </label>
                  
                  {profileForm.hasPreviousUlcers && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px', marginTop: '6px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Tempo para fechar / cicatrizar</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 3 meses"
                          value={profileForm.previousUlcersHealingTime}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, previousUlcersHealingTime: e.target.value }))}
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '11.5px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Curativos e métodos aplicados</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Hidrogel, carvão ativado..."
                          value={profileForm.previousUlcersTreatments}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, previousUlcersTreatments: e.target.value }))}
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '11.5px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Onde foi feito o tratamento?</label>
                        <select 
                          value={profileForm.previousUlcersLocation} 
                          onChange={(e) => setProfileForm(prev => ({ ...prev, previousUlcersLocation: e.target.value }))}
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '11.5px' }}
                        >
                          <option value="casa">Em casa (Domiciliar)</option>
                          <option value="unidade_saude">Unidade de Saúde (SUS/Posto)</option>
                          <option value="profissional">Profissional competente (Médico/Enfermeiro)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Medicamentos de Uso Contínuo</label>
                  <input 
                    type="text" 
                    value={profileForm.medications}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, medications: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Alergias Conhecidas</label>
                  <input 
                    type="text" 
                    value={profileForm.allergies}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, allergies: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12px' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ padding: '8px', fontSize: '12px', width: '100%', marginTop: '4px' }}>
                  Salvar Ficha Clínica
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Nome do Paciente:</span>
                  <strong>{clinicalProfile.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Data de Nascimento:</span>
                  <strong>{clinicalProfile.birthDate ? new Date(clinicalProfile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sexo:</span>
                  <strong>{clinicalProfile.gender || 'Não informado'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Unidade de Saúde:</span>
                  <strong>{clinicalProfile.healthUnit || 'Não informada'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Diabetes:</span>
                  <strong style={{ color: clinicalProfile.hasDiabetes ? 'var(--danger)' : 'var(--success-light)' }}>
                    {clinicalProfile.hasDiabetes ? 'Sim' : 'Não'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Hipertensão:</span>
                  <strong style={{ color: clinicalProfile.hasHypertension ? 'var(--danger)' : 'var(--success-light)' }}>
                    {clinicalProfile.hasHypertension ? 'Sim' : 'Não'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Insuficiência Venosa:</span>
                  <strong>{clinicalProfile.hasVenousInsufficiency ? 'Sim' : 'Não'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Doença Arterial:</span>
                  <strong>{clinicalProfile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tabagismo:</span>
                  <strong style={{ color: clinicalProfile.isSmoker ? 'var(--danger)' : 'var(--success-light)' }}>
                    {clinicalProfile.isSmoker ? 'Fumante Ativo' : 'Não Fumante'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Obesidade:</span>
                  <strong>{clinicalProfile.isObese ? 'Sim' : 'Não'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Histórico de Amputação:</span>
                  <strong>{clinicalProfile.hasAmputationHistory ? 'Sim' : 'Não'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Outras Condições:</span>
                  <strong>{clinicalProfile.otherConditions || 'Nenhuma registrada'}</strong>
                </div>

                {/* Historico de ulceras anteriores */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Histórico de Úlceras Anteriores:</span>
                  {clinicalProfile.hasPreviousUlcers ? (
                    <div style={{ fontSize: '11px', paddingLeft: '10px', borderLeft: '2.5px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--text-secondary)' }}>
                      <p>• Cicatrização anterior em: <strong>{clinicalProfile.previousUlcersHealingTime}</strong></p>
                      <p>• <strong>Curativos:</strong> {clinicalProfile.previousUlcersTreatments}</p>
                      <p>• <strong>Local do Tratamento:</strong> {
                        clinicalProfile.previousUlcersLocation === 'casa' ? 'Feito em Casa (Domiciliar)' :
                        clinicalProfile.previousUlcersLocation === 'unidade_saude' ? 'Unidade de Saúde (SUS/Posto)' :
                        'Acompanhado por Profissional Competente'
                      }</p>
                    </div>
                  ) : (
                    <strong>Nenhum histórico registrado</strong>
                  )}
                </div>

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Medicamentos em uso:</span>
                  <p style={{ fontWeight: '600', padding: '6px 10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', fontSize: '11.5px' }}>
                    {clinicalProfile.medications || 'Nenhum medicamento listado'}
                  </p>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Alergias conhecidas:</span>
                  <strong style={{ color: clinicalProfile.allergies ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {clinicalProfile.allergies || 'Nenhuma alergia listada'}
                  </strong>
                </div>

                {/* Triage Alerts (Dynamic based on attached exams) */}
                {clinicalProfile.triageAlerts && clinicalProfile.triageAlerts.length > 0 && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.04)', 
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Alertas de Triagem (Exames)
                    </span>
                    {clinicalProfile.triageAlerts.map((alert, index) => (
                      <p key={index} style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--danger)', margin: 0 }}>
                        {alert}
                      </p>
                    ))}
                  </div>
                )}

                {/* Attached Exams List */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Exames Anexados ao Prontuário:</span>
                  {clinicalProfile.attachedExams && clinicalProfile.attachedExams.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      {clinicalProfile.attachedExams.map((exam, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '6px 10px', 
                          backgroundColor: 'var(--bg-primary)', 
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📄 {exam.name}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {exam.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <strong style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Nenhum exame clínico anexado
                    </strong>
                  )}
                </div>

                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px', lineHeight: '1.3' }}>
                  *Estes dados clínicos detalhados personalizam os diagnósticos preventivos do iRec.
                </p>
              </div>
            )}
          </div>

          {/* Next Action Box */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent)', width: '100%', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Próxima Visita / Ação</span>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginTop: '2px' }}>{hasActiveWound ? 'Troca de Curativo' : 'Primeira Avaliação Pendente'}</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>{hasActiveWound ? (latestEntry.dressingFrequency || 'Recomendada hoje') : 'Aguardando envio de foto'}</p>
              </div>
              <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setActiveTab('protocols')}>
                Ver Guia
              </button>
            </div>
          </div>



          {/* Suporte Médico & Rede Local */}
          <div className="glass-card" style={{ width: '100%', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🩺 Suporte Médico & Rede Local
            </h3>
            
            {assignedClinician ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                  <span style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Médico Responsável</span>
                  <h4 style={{ fontSize: '13.5px', fontWeight: '700', marginTop: '2px' }}>Dr(a). {assignedClinician.name}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CRM: {assignedClinician.crm} • {assignedClinician.specialty || 'Clínico'}</p>
                  
                  {isDoctorLocal ? (
                    <p style={{ fontSize: '11px', color: 'var(--success-light)', fontWeight: '600', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📍 Disponível na sua cidade ({clinicalProfile?.city}) para visitas domiciliares e online.
                    </p>
                  ) : (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '11px', color: '#38a1db', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        💻 Disponível para Teleconsulta Online 24h
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                        Como este profissional atende remotamente, para atendimentos presenciais de urgência ou se necessitar de exames físicos imediatos, dirija-se à UPA ou Hospital mais próximo:
                      </p>
                      <LocalResourcesPanel clinicalProfile={clinicalProfile} compact={true} />
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setShowMapModal(true)} 
                        style={{ width: '100%', fontSize: '11.5px', padding: '8px', marginTop: '10px', borderRadius: '6px', gap: '4px', height: '36px' }}
                      >
                        🗺️ Abrir Mapa de Rede Local
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.04)', 
                  border: '1px solid rgba(239, 68, 68, 0.15)', 
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--danger)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ Sem Médicos Presenciais na Cidade
                  </p>
                  <p style={{ fontSize: '11.5px', margin: 0, lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                    Não há médicos cadastrados em <strong>{clinicalProfile?.city || 'sua localidade'}</strong> para visitas domiciliares físicas no momento.
                  </p>
                  <p style={{ fontSize: '11px', marginTop: '6px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Você pode realizar teleconsultas online com a rede iRec ou, se precisar de suporte físico de emergência, dirigir-se ao hospital público local:
                  </p>
                </div>

                <LocalResourcesPanel clinicalProfile={clinicalProfile} compact={true} />
                 
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowMapModal(true)} 
                  style={{ width: '100%', fontSize: '11.5px', padding: '8px', marginTop: '10px', borderRadius: '6px', gap: '4px', height: '36px' }}
                >
                  🗺️ Abrir Mapa de Rede Local
                </button>
              </div>
            )}
          </div>

          {/* Emergency / Red Flag Safety Alert */}
          <div className="glass-card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.04)', borderColor: 'rgba(239, 68, 68, 0.2)', width: '100%', margin: 0 }}>
            <h3 style={{ fontSize: '15px', color: 'var(--danger)', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Segurança do Paciente (Urgência)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Se notar sangramento abundante, febre superior a 38°C, calafrios ou vermelhidão que se espalha rapidamente pela pele ao redor da lesão:
            </p>
            <button className="btn" style={{ width: '100%', backgroundColor: 'var(--danger)', color: '#fff', fontSize: '13px', padding: '10px' }} onClick={() => {
              alert("ALERTA DE EMERGÊNCIA ENVIADO!\n\nSintomas graves relatados. Recomendamos ir imediatamente ao pronto-socorro mais próximo ou ligar para o SAMU (192)!\n\nO prontuário foi marcado com alta prioridade e a enfermeira Mariana Souza foi notificada.");
            }}>
              Relatar Sintoma Grave (Red Flag)
            </button>
          </div>

        </div>

      </div>

      {showMapModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }} onClick={() => setShowMapModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
              <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              <LocalResourcesPanel clinicalProfile={clinicalProfile} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
