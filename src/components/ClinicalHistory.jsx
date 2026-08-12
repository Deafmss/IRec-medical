import { useState, useEffect, useRef } from 'react';
import { createAuditLog, getAssignedDoctor } from '../services/supabaseService';
import WoundEvolutionComparator from './WoundEvolutionComparator';
import VitalsTelemetry from './VitalsTelemetry';

// Neutral placeholder SVG for broken/missing patient wound photos (no fake stock photos)
const NEUTRAL_IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" viewBox="0 0 130 130"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="28">📷</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="10" font-weight="bold">Foto Indisponível</text></svg>`;

// Interactive Tissue Overlay Canvas for Segmented Wound Areas
function WoundTissueOverlay({ entry }) {
  const canvasRef = useRef(null);
  const [hoveredTissue, setHoveredTissue] = useState(null);

  const necrose = parseFloat(entry?.aiTissueAnalysis?.necrose || 0);
  const fibrina = parseFloat(entry?.aiTissueAnalysis?.fibrina || 0);
  const granulacao = parseFloat(entry?.aiTissueAnalysis?.granulacao || 0);
  const epitelizacao = parseFloat(entry?.aiTissueAnalysis?.epitelizacao || 0);
  const total = necrose + fibrina + granulacao + epitelizacao;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);

    if (total === 0) return;

    const centerX = 60;
    const centerY = 60;
    const radius = 35;

    let startAngle = -0.5 * Math.PI;

    const tissues = [
      { name: 'Necrose', value: necrose, color: 'rgba(15, 23, 42, 0.85)' },
      { name: 'Esfacelo / Fibrina', value: fibrina, color: 'rgba(245, 158, 11, 0.85)' },
      { name: 'Granulação', value: granulacao, color: 'rgba(239, 68, 68, 0.85)' },
      { name: 'Epitelização', value: epitelizacao, color: 'rgba(16, 185, 129, 0.85)' }
    ].filter(t => t.value > 0);

    tissues.forEach(t => {
      const sliceAngle = (t.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [entry, necrose, fibrina, granulacao, epitelizacao, total]);

  const handleMouseMove = (e) => {
    if (total === 0) {
      setHoveredTissue(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dist = Math.sqrt((x - 60) * (x - 60) + (y - 60) * (y - 60));
    if (dist <= 35) {
      const angle = Math.atan2(y - 60, x - 60);
      let normalizedAngle = angle + 0.5 * Math.PI;
      if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

      let currentAngle = 0;
      const tissues = [
        { name: 'Necrose', value: necrose },
        { name: 'Esfacelo / Fibrina', value: fibrina },
        { name: 'Granulação', value: granulacao },
        { name: 'Epitelização', value: epitelizacao }
      ].filter(t => t.value > 0);

      let found = null;
      tissues.forEach(t => {
        const sliceAngle = (t.value / total) * 2 * Math.PI;
        if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + sliceAngle) {
          found = `${t.name}: ${t.value}%`;
        }
        currentAngle += sliceAngle;
      });

      setHoveredTissue(found || (total > 0 ? `Análise: ${total}% tecidos` : null));
    } else {
      setHoveredTissue(null);
    }
  };

  if (total === 0) return null;

  return (
    <div 
      style={{ position: 'absolute', top: 0, left: 0, width: '120px', height: '120px', cursor: 'crosshair' }} 
      onMouseMove={handleMouseMove} 
      onMouseLeave={() => setHoveredTissue(null)}
      onTouchStart={handleMouseMove}
    >
      <canvas ref={canvasRef} width={120} height={120} />
      {hoveredTissue && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          right: '4px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          color: '#ffffff',
          fontSize: '10px',
          padding: '4px 6px',
          borderRadius: '6px',
          textAlign: 'center',
          fontWeight: '700',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          pointerEvents: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          zIndex: 10
        }}>
          {hoveredTissue}
        </div>
      )}
    </div>
  );
}

export default function ClinicalHistory({ entries = [], clinicalProfile, currentUser, setActiveTab }) {
  const maxPain = 10;
  const [assignedDoctor, setAssignedDoctor] = useState(null);
  const [showComparatorModal, setShowComparatorModal] = useState(false);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const loggedRef = useRef(false);

  // Fetch real assigned doctor from database (fixes IREC-0006)
  useEffect(() => {
    let isCancelled = false;
    if (clinicalProfile?.id) {
      getAssignedDoctor(clinicalProfile.id)
        .then(doc => {
          if (!isCancelled && doc) {
            setAssignedDoctor(doc);
          }
        })
        .catch(() => {});
    }
    return () => { isCancelled = true; };
  }, [clinicalProfile?.id]);

  // Record audit log via Supabase (fixes IREC-0066, IREC-0067, IREC-0068, IREC-0246)
  useEffect(() => {
    if (clinicalProfile?.id && currentUser && !loggedRef.current) {
      // Only log clinician/admin reading patient record
      if (currentUser.role === 'doctor' || currentUser.role === 'nurse' || currentUser.role === 'admin') {
        createAuditLog(
          'Leitura de Prontuário', 
          clinicalProfile.id, 
          `Acesso de leitura ao prontuário do paciente ${clinicalProfile.name || ''} por ${currentUser.name || 'Profissional'}`
        ).catch(() => {});
        loggedRef.current = true;
      }
    }
  }, [clinicalProfile?.id, clinicalProfile?.name, currentUser]);

  const getEntryProgress = (entry) => {
    if (entry?.progress !== undefined && entry?.progress !== null) return entry.progress;
    if (entry?.aiTissueAnalysis && Object.keys(entry.aiTissueAnalysis).length > 0) {
      // Epithelial skin is the true healed tissue metric (fixes IREC-0069, IREC-0247)
      const epitelizacao = parseInt(entry.aiTissueAnalysis.epitelizacao);
      if (!isNaN(epitelizacao)) return epitelizacao;
    }
    return null;
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '--';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return `${parts[0]}/${parts[1]}`;
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };
  
  const handlePrint = () => {
    if (currentUser) {
      createAuditLog(
        'Exportação PDF / Impressão', 
        clinicalProfile?.id || 'PRONTUARIO', 
        `Exportação em PDF do prontuário por ${currentUser.name || 'Usuário'}`
      ).catch(() => {});
    }
    window.print();
  };

  // Real assigned doctor resolution (no hardcoded fake doctor/CRM) (IREC-0006)
  const assignedDoctorName = assignedDoctor?.name 
    ? `Dr(a). ${assignedDoctor.name}` 
    : (clinicalProfile?.assignedDoctorName || 'Profissional não vinculado');
  
  const assignedDoctorSpecialty = assignedDoctor?.crm 
    ? `CRM-${assignedDoctor.state || 'BR'} ${assignedDoctor.crm} (${assignedDoctor.specialty || 'Médico Assistente'})` 
    : (clinicalProfile?.assignedDoctorSpecialty || 'Sem médico assistente vinculado');

  // Dynamic document authentication code (fixes IREC-0248)
  const authCode = `#IRC-${(clinicalProfile?.id || 'LOCAL').slice(0, 6).toUpperCase()}-${new Date().getFullYear()}`;

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      
      {/* 
         1. PRINT-ONLY PRONTUÁRIO HEADER (Padrão CFM Res. 2.314/2022 & COFEN Res. 0567/2018)
         Rendered strictly on paper/PDF export
      */}
      <div className="print-only" style={{ marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#0b1511' }}>
              iRec Saúde - Prontuário Clínico & Relatório de Evolução
            </h1>
            <p style={{ fontSize: '11px', color: '#555' }}>Plataforma Médica de Acompanhamento Multidisciplinar e Saúde Digital</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', fontWeight: 'bold' }}>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            <p style={{ fontSize: '10px', color: '#666' }}>Autenticação Digital: {authCode}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: '20px', marginTop: '16px', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '11px', backgroundColor: '#f9f9f9' }}>
          <div>
            <p><strong>Paciente:</strong> {clinicalProfile?.name || 'Paciente'}</p>
            <p><strong>Nascimento:</strong> {clinicalProfile?.birthDate || 'Não informada'}</p>
            <p><strong>CPF:</strong> {clinicalProfile?.cpf || 'Não informado'}</p>
            <p><strong>Unidade de Saúde / Clínica:</strong> {clinicalProfile?.healthUnit || 'Atendimento Residencial iRec'}</p>
            <p><strong>Medicamentos em Uso:</strong> {clinicalProfile?.medications || 'Nenhum'}</p>
            <p><strong>Alergias Relatadas:</strong> {clinicalProfile?.allergies || 'Nenhuma'}</p>
          </div>
          <div>
            <p><strong>Diabetes Metabólico:</strong> {clinicalProfile?.hasDiabetes ? 'Sim' : 'Não'}</p>
            <p><strong>Hipertensão Arterial:</strong> {clinicalProfile?.hasHypertension ? 'Sim' : 'Não'}</p>
            <p><strong>Insuficiência Venosa:</strong> {clinicalProfile?.hasVenousInsufficiency ? 'Sim' : 'Não'}</p>
            <p><strong>Doença Arterial Periférica:</strong> {clinicalProfile?.hasPeripheralArterialDisease ? 'Sim' : 'Não'}</p>
            <p><strong>Tabagismo Ativo:</strong> {clinicalProfile?.isSmoker ? 'Sim (Fumante)' : 'Não'}</p>
            <p style={{ marginTop: '6px', color: '#0284c7', fontWeight: 'bold' }}>
              <strong>Médico Responsável:</strong> {assignedDoctorName} ({assignedDoctorSpecialty})
            </p>
          </div>
        </div>
      </div>

      {/* Screen Title & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
            Prontuário Médico Digital 📄
          </span>
          <h2 style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
            Linha do Tempo & Evolução
          </h2>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={() => setShowComparatorModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontSize: '13px', borderRadius: '12px' }}
          >
            <span>🔀</span>
            <span>Comparar Evolução</span>
          </button>

          <button 
            type="button"
            onClick={() => setShowTelemetryModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontSize: '13px', borderRadius: '12px' }}
          >
            <span>🩺</span>
            <span>Sinais Vitais</span>
          </button>

          <button 
            type="button"
            onClick={handlePrint}
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13px', borderRadius: '12px' }}
          >
            <span>🖨️</span>
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Modal / Embedded Views for Comparator & Telemetry (fixes IREC-0376, IREC-0381) */}
      {showComparatorModal && (
        <WoundEvolutionComparator 
          entries={entries} 
          onClose={() => setShowComparatorModal(false)} 
        />
      )}

      {showTelemetryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button 
                type="button" 
                onClick={() => setShowTelemetryModal(false)} 
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✖ Fechar Sinais Vitais
              </button>
            </div>
            <VitalsTelemetry patientId={clinicalProfile?.id} isDoctorView={currentUser?.role === 'doctor' || currentUser?.role === 'nurse'} />
          </div>
        </div>
      )}

      {/* Empty State when no entries exist */}
      {entries.length === 0 ? (
        <div className="glass-card glass-card-cyan-glow" style={{ padding: '50px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(2, 132, 199, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
            📜
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              Nenhum Registro de Avaliação no Prontuário
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '380px', lineHeight: '1.5' }}>
              Realize a sua primeira avaliação de pele ou sintomas para acompanhar a evolução clínica e gráficos aqui!
            </p>
          </div>
          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('triage')}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '14px', borderRadius: '12px', marginTop: '6px' }}
            >
              📷 Fazer Primeira Triagem Agora
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Charts Grid (Evolution % and Pain Level 0-10) */}
          <div className="history-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginBottom: '24px' }}>
            
            {/* Chart 1: Visual Healing Evolution (% Progress) with horizontal scroll fix (IREC-0249) */}
            <div className="glass-card glass-card-emerald-glow" style={{ margin: 0, overflowX: 'auto', minWidth: 0 }}>
              <div style={{ position: 'relative', zIndex: 1, minWidth: entries.length > 8 ? `${entries.length * 40}px` : 'auto' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                  📈 Epitelização / Pele Cicatrizada (%)
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '120px', padding: '10px 10px 0 10px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                  {entries.map((entry, idx) => {
                    const progress = getEntryProgress(entry);
                    const hasData = progress !== null;
                    const displayProgress = hasData ? progress : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: hasData ? '#10b981' : 'var(--text-muted)', marginBottom: '4px' }}>
                          {hasData ? `${displayProgress}%` : '—'}
                        </span>
                        <div style={{ 
                          width: '24px', 
                          height: `${Math.max(4, displayProgress * 0.85)}px`,
                          background: hasData ? 'linear-gradient(to top, #10b981, #34d399)' : 'var(--border-color)', 
                          borderRadius: '6px 6px 0 0',
                          boxShadow: hasData ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none',
                          transition: 'height 0.5s ease-in-out'
                        }}></div>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
                  {entries.map((entry, idx) => (
                    <span key={idx} style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'center', flex: 1 }}>
                      {formatDateShort(entry.date)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 2: Pain Level Control (0-10) with horizontal scroll fix (IREC-0249) */}
            <div className="glass-card glass-card-cyan-glow" style={{ margin: 0, overflowX: 'auto', minWidth: 0 }}>
              <div style={{ position: 'relative', zIndex: 1, minWidth: entries.length > 8 ? `${entries.length * 40}px` : 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    🩸 Controle de Dor (Escala 0-10)
                  </h3>
                  <span className="badge" style={{ backgroundColor: 'rgba(2, 132, 199, 0.15)', color: 'var(--primary)', fontWeight: '800', fontSize: '11px' }}>
                    Monitorado
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '120px', padding: '10px 10px 0 10px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                  {entries.map((entry, idx) => {
                    const painVal = typeof entry.pain === 'number' ? entry.pain : 0;
                    const barHeightPct = (painVal / maxPain) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: painVal > 5 ? '#ef4444' : 'var(--primary)', marginBottom: '4px' }}>
                          {painVal}
                        </span>
                        <div style={{ 
                          width: '22px', 
                          height: `${Math.max(6, barHeightPct * 0.8)}px`,
                          background: painVal > 5 ? 'linear-gradient(to top, #ef4444, #f87171)' : 'linear-gradient(to top, var(--primary), var(--accent-light))', 
                          borderRadius: '6px 6px 0 0',
                          boxShadow: painVal > 5 ? '0 2px 8px rgba(239, 68, 68, 0.4)' : '0 2px 8px var(--primary-glow)',
                          transition: 'height 0.5s ease-in-out'
                        }}></div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
                  {entries.map((entry, idx) => (
                    <span key={idx} style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'center', flex: 1 }}>
                      {formatDateShort(entry.date)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Timeline Entries List */}
          <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', color: 'var(--text-primary)' }}>
            📋 Registros Cronológicos de Avaliação
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {entries.slice().reverse().map((entry, idx) => {
              const progressVal = getEntryProgress(entry);
              const photoSrc = entry.photo || NEUTRAL_IMAGE_PLACEHOLDER;
              return (
                <div key={idx} className="glass-card glass-card-cyan-glow" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', margin: 0 }}>
                  
                  {/* Timeline Card Header */}
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: '800', fontSize: '12px' }}>
                        {entry.type}
                      </span>
                      {entry.lesionStage && (
                        <span className="badge" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700' }}>
                          {entry.lesionStage}
                        </span>
                      )}
                      {entry.clinicalEvolution && (
                        <span className="badge" style={{ 
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: entry.clinicalEvolution === 'Melhorou' ? 'rgba(16, 185, 129, 0.15)' : entry.clinicalEvolution === 'Piorou' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: entry.clinicalEvolution === 'Melhorou' ? '#10b981' : entry.clinicalEvolution === 'Piorou' ? '#ef4444' : '#f59e0b'
                        }}>
                          Evolução: {entry.clinicalEvolution}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)' }}>
                      🗓️ {entry.date}
                    </span>
                  </div>

                  {/* Timeline Card Body */}
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                    
                    {/* Photo Column with Neutral Fallback (fixes IREC-0070) */}
                    <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                      <div style={{ width: '130px', height: '130px', borderRadius: '14px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '2px solid var(--border-color)', position: 'relative', boxShadow: 'var(--shadow-md)' }}>
                        <img 
                          src={photoSrc} 
                          alt="Lesão" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = NEUTRAL_IMAGE_PLACEHOLDER;
                          }}
                        />
                        <WoundTissueOverlay entry={entry} />
                      </div>
                      {entry.clinicalOutcome && (
                        <div style={{ fontSize: '10.5px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          {entry.clinicalOutcome}
                        </div>
                      )}
                    </div>

                    {/* Signs & Symptoms Column */}
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <h5 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px', margin: 0 }}>
                        🩺 Sinais & Sintomas
                      </h5>
                      {entry.anatomicalLocation && (
                        <div><strong>Local:</strong> {entry.anatomicalLocation}</div>
                      )}
                      <div><strong>Dor Sentida:</strong> <span style={{ fontWeight: '800', color: entry.pain > 5 ? '#ef4444' : 'var(--text-primary)' }}>{entry.pain}/10</span></div>
                      <div><strong>Exsudato:</strong> <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{entry.exudate}</span></div>
                      <div><strong>Odor Local:</strong> {entry.odor ? '⚠️ Presente / Forte' : 'Ausente'}</div>
                      {entry.localTemperature && (
                        <div><strong>Temp. Local:</strong> {entry.localTemperature}</div>
                      )}
                      {entry.infectionSigns && entry.infectionSigns !== 'Nenhum' ? (
                        <div style={{ color: '#ef4444', fontWeight: '700', marginTop: '2px' }}>
                          <strong>Sinais de Infecção:</strong> ⚠️ {entry.infectionSigns}
                        </div>
                      ) : (
                        <div style={{ color: '#10b981', fontWeight: '600', marginTop: '2px' }}>
                          <strong>Sinais de Infecção:</strong> Nenhum detectado
                        </div>
                      )}
                    </div>

                    {/* Conduct & Treatment Column */}
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <h5 style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px', margin: 0 }}>
                        📌 Conduta & Curativos
                      </h5>
                      {entry.appliedDressing ? (
                        <>
                          <div><strong>Cobertura:</strong> {entry.appliedDressing}</div>
                          {entry.dressingQuantity && (
                            <div><strong>Quantidade:</strong> {entry.dressingQuantity} unid.</div>
                          )}
                          {entry.dressingFrequency && (
                            <div><strong>Frequência de Troca:</strong> {entry.dressingFrequency}</div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Nenhuma cobertura cadastrada.</div>
                      )}
                      {entry.performedProcedures && (
                        <div style={{ marginTop: '2px' }}><strong>Procedimentos:</strong> {entry.performedProcedures}</div>
                      )}
                      <div style={{ marginTop: '4px', color: 'var(--primary)', fontWeight: '800' }}>
                        Pele Epitelizada: <strong>{progressVal !== null ? `${progressVal}%` : '— (Sem medição)'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis Box inside Timeline Item */}
                  {(entry.aiAreaCm2 || entry.aiLengthCm || entry.aiWidthCm || (entry.aiTissueAnalysis && Object.keys(entry.aiTissueAnalysis).length > 0) || entry.aiRecommendation) && (
                    <div style={{ 
                      position: 'relative',
                      zIndex: 1,
                      marginTop: '6px', 
                      backgroundColor: 'var(--primary-glow)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '12px', 
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>🔬</span>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Análise de Visão Computacional iRec
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
                        {/* AI Dimensions & Tissues */}
                        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                          {(entry.aiAreaCm2 || entry.aiLengthCm || entry.aiWidthCm) && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {entry.aiAreaCm2 && (
                                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: '700' }}>
                                  Área: <span style={{ color: 'var(--primary)' }}>{entry.aiAreaCm2} cm²</span>
                                </div>
                              )}
                              {entry.aiLengthCm && entry.aiWidthCm && (
                                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: '700' }}>
                                  Dimensões: <span style={{ color: 'var(--primary)' }}>{entry.aiLengthCm} x {entry.aiWidthCm} cm</span>
                                </div>
                              )}
                            </div>
                          )}

                          {entry.aiTissueAnalysis && Object.keys(entry.aiTissueAnalysis).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                              <div style={{ fontWeight: '700', fontSize: '11.5px' }}>Composição Tecidual:</div>
                              
                              {entry.aiTissueAnalysis.necrose > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '80px', fontSize: '10.5px', color: 'var(--text-secondary)' }}>Necrose ({entry.aiTissueAnalysis.necrose}%):</span>
                                  <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${entry.aiTissueAnalysis.necrose}%`, height: '100%', backgroundColor: '#0f172a' }}></div>
                                  </div>
                                </div>
                              )}
                              {entry.aiTissueAnalysis.fibrina > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '80px', fontSize: '10.5px', color: 'var(--text-secondary)' }}>Esfacelo ({entry.aiTissueAnalysis.fibrina}%):</span>
                                  <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${entry.aiTissueAnalysis.fibrina}%`, height: '100%', backgroundColor: '#f59e0b' }}></div>
                                  </div>
                                </div>
                              )}
                              {entry.aiTissueAnalysis.granulacao > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '80px', fontSize: '10.5px', color: 'var(--text-secondary)' }}>Granulação ({entry.aiTissueAnalysis.granulacao}%):</span>
                                  <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${entry.aiTissueAnalysis.granulacao}%`, height: '100%', backgroundColor: '#ef4444' }}></div>
                                  </div>
                                </div>
                              )}
                              {/* 4th tissue: Epitelização (fixes IREC-0250) */}
                              {entry.aiTissueAnalysis.epitelizacao > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '80px', fontSize: '10.5px', color: 'var(--text-secondary)' }}>Epitelização ({entry.aiTissueAnalysis.epitelizacao}%):</span>
                                  <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${entry.aiTissueAnalysis.epitelizacao}%`, height: '100%', backgroundColor: '#10b981' }}></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* AI Recommendations */}
                        {entry.aiRecommendation && (
                          <div style={{ flex: '1.2 1 240px', fontSize: '12px', borderLeft: '3px solid var(--primary)', paddingLeft: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontWeight: '800', color: 'var(--primary)' }}>Orientação / Conduta Sugerida:</div>
                            <div style={{ lineHeight: '1.5', fontStyle: 'italic' }}>{entry.aiRecommendation}</div>
                          </div>
                        )}

                        {/* Entry Attachments */}
                        {entry.attachments && entry.attachments.length > 0 && (
                          <div style={{ flex: '1 1 100%', fontSize: '12px', marginTop: '10px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                            <div style={{ fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>📎 Arquivos e Exames Anexados:</div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              {entry.attachments.map((att, attIdx) => {
                                const isImg = att.fileType === 'image' || att.file_type === 'image';
                                const isVid = att.fileType === 'video' || att.file_type === 'video';
                                const url = att.fileUrl || att.file_url;
                                const name = att.fileName || att.file_name;
                                return (
                                  <a 
                                    key={attIdx} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px', 
                                      padding: '8px 12px', 
                                      borderRadius: '10px', 
                                      backgroundColor: 'var(--bg-primary)', 
                                      border: '1px solid var(--border-color)', 
                                      color: 'var(--text-primary)',
                                      textDecoration: 'none',
                                      fontSize: '11.5px',
                                      fontWeight: '700',
                                      transition: 'all 0.2s ease',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                    className="attachment-pill"
                                  >
                                    <span style={{ fontSize: '14px' }}>{isImg ? '🖼️' : (isVid ? '🎥' : '📄')}</span>
                                    <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* PRINT-ONLY SIGNATURE SECTION WITH ASSIGNED DOCTOR (IREC-0006) */}
      <div className="print-only-flex" style={{ marginTop: '50px', justifyContent: 'space-between', fontSize: '11px' }}>
        <div style={{ width: '220px', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
          Assinatura do Paciente / Cuidador
        </div>
        <div style={{ width: '250px', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
          <strong>{assignedDoctorName}</strong><br />
          {assignedDoctorSpecialty}
        </div>
      </div>
    </div>
  );
}
