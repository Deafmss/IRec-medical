import { useState, useEffect, useRef } from 'react';

function WoundTissueOverlay({ entry }) {
  const canvasRef = useRef(null);
  const [hoveredTissue, setHoveredTissue] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);

    const necrose = parseFloat(entry.aiTissueAnalysis?.necrose || 0);
    const fibrina = parseFloat(entry.aiTissueAnalysis?.fibrina || 0);
    const granulacao = parseFloat(entry.aiTissueAnalysis?.granulacao || 0);
    const total = necrose + fibrina + granulacao;

    if (total === 0) return;

    const centerX = 60;
    const centerY = 60;
    const radius = 35;

    let startAngle = -0.5 * Math.PI;

    const tissues = [
      { name: 'Necrose', value: necrose, color: 'rgba(0, 0, 0, 0.55)' },
      { name: 'Fibrina', value: fibrina, color: 'rgba(240, 173, 78, 0.55)' },
      { name: 'Granulação', value: granulacao, color: 'rgba(217, 83, 79, 0.55)' }
    ].filter(t => t.value > 0);

    tissues.forEach(t => {
      const sliceAngle = (t.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [entry]);

  const handleMouseMove = (e) => {
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

      const necrose = parseFloat(entry.aiTissueAnalysis?.necrose || 0);
      const fibrina = parseFloat(entry.aiTissueAnalysis?.fibrina || 0);
      const granulacao = parseFloat(entry.aiTissueAnalysis?.granulacao || 0);
      const total = necrose + fibrina + granulacao;

      let currentAngle = 0;
      const tissues = [
        { name: 'Necrose', value: necrose },
        { name: 'Fibrina', value: fibrina },
        { name: 'Granulação', value: granulacao }
      ].filter(t => t.value > 0);

      let found = null;
      tissues.forEach(t => {
        const sliceAngle = (t.value / total) * 2 * Math.PI;
        if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + sliceAngle) {
          found = `${t.name}: ${t.value}%`;
        }
        currentAngle += sliceAngle;
      });

      setHoveredTissue(found || 'Lesão Segmentada');
    } else {
      setHoveredTissue(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTissue(null);
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '120px', height: '120px', cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <canvas ref={canvasRef} width={120} height={120} />
      {hoveredTissue && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          right: '4px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          color: '#fff',
          fontSize: '9.5px',
          padding: '4px 6px',
          borderRadius: '4px',
          textAlign: 'center',
          fontWeight: '700',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          pointerEvents: 'none',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
          zIndex: 10
        }}>
          {hoveredTissue}
        </div>
      )}
    </div>
  );
}

export default function ClinicalHistory({ entries, clinicalProfile }) {
  const maxPain = 10;
  
  const getEntryProgress = (entry) => {
    if (entry.progress !== undefined && entry.progress !== null) return entry.progress;
    if (entry.aiTissueAnalysis) {
      const epitelizacao = parseInt(entry.aiTissueAnalysis.epitelizacao) || 0;
      const granulacao = parseInt(entry.aiTissueAnalysis.granulacao) || 0;
      return Math.min(100, epitelizacao + granulacao);
    }
    return 0;
  };
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in">
      {/* 
         1. PRINT-ONLY PRONTUÁRIO HEADER
         Hidden on screen, rendered on paper/PDF export
      */}
      <div className="print-only" style={{ marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#0b1511' }}>
              iRec - Relatório Clínico de Evolução
            </h1>
            <p style={{ fontSize: '11px', color: '#555' }}>Plataforma Inteligente de Cuidado Domiciliar de Lesões</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', fontWeight: 'bold' }}>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            <p style={{ fontSize: '10px', color: '#666' }}>ID Prontuário: #IRC-99218A</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: '20px', marginTop: '20px', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '11px', backgroundColor: '#f9f9f9' }}>
          <div>
            <p><strong>Paciente:</strong> {clinicalProfile?.name || 'Paciente'}</p>
            <p><strong>Data de Nascimento:</strong> {clinicalProfile?.birthDate || 'Não informada'}</p>
            <p><strong>Sexo:</strong> {clinicalProfile?.gender || 'Não informado'}</p>
            <p><strong>Unidade de Saúde:</strong> {clinicalProfile?.healthUnit || 'Não informada'}</p>
            <p><strong>Medicamentos Contínuos:</strong> {clinicalProfile?.medications || 'Nenhum'}</p>
            <p><strong>Alergias:</strong> {clinicalProfile?.allergies || 'Nenhuma'}</p>
          </div>
          <div>
            <p><strong>Diabetes Metabólico:</strong> {clinicalProfile?.hasDiabetes ? 'Sim' : 'Não'}</p>
            <p><strong>Hipertensão Vascular:</strong> {clinicalProfile?.hasHypertension ? 'Sim' : 'Não'}</p>
            <p><strong>Insuficiência Venosa:</strong> {clinicalProfile?.hasVenousInsufficiency ? 'Sim' : 'Não'}</p>
            <p><strong>Doença Arterial:</strong> {clinicalProfile?.hasPeripheralArterialDisease ? 'Sim' : 'Não'}</p>
            <p><strong>Tabagismo:</strong> {clinicalProfile?.isSmoker ? 'Sim (Fumante)' : 'Não'}</p>
            <p><strong>Obesidade:</strong> {clinicalProfile?.isObese ? 'Sim' : 'Não'}</p>
            <p><strong>Histórico de Amputação:</strong> {clinicalProfile?.hasAmputationHistory ? 'Sim' : 'Não'}</p>
            {clinicalProfile?.otherConditions && <p><strong>Outras Condições:</strong> {clinicalProfile.otherConditions}</p>}
            <p style={{ marginTop: '4px' }}><strong>Responsável Primário:</strong> Enf. Mariana Souza (COREN-SP 288.192)</p>
          </div>

          {/* Dynamic attached exams and triage alerts for doctor review */}
          {((clinicalProfile?.attachedExams && clinicalProfile.attachedExams.length > 0) || (clinicalProfile?.triageAlerts && clinicalProfile.triageAlerts.length > 0)) && (
            <div style={{ 
              gridColumn: '1 / span 2', 
              borderTop: '1px dashed #ccc', 
              marginTop: '10px', 
              paddingTop: '10px', 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px' 
            }}>
              <div>
                <p><strong>Exames Anexados ao Prontuário:</strong></p>
                {clinicalProfile.attachedExams && clinicalProfile.attachedExams.length > 0 ? (
                  clinicalProfile.attachedExams.map((e, idx) => (
                    <p key={idx} style={{ margin: '2px 0', paddingLeft: '8px', fontSize: '10.5px', color: '#333' }}>
                      • {e.name} ({e.type}) - Anexado em {e.date}
                    </p>
                  ))
                ) : (
                  <p style={{ margin: '2px 0', paddingLeft: '8px', fontSize: '10.5px', color: '#666', fontStyle: 'italic' }}>
                    Nenhum exame anexado.
                  </p>
                )}
              </div>
              <div>
                <p><strong>Triagem de Riscos (Detectados):</strong></p>
                {clinicalProfile.triageAlerts && clinicalProfile.triageAlerts.length > 0 ? (
                  clinicalProfile.triageAlerts.map((alert, idx) => (
                    <p key={idx} style={{ margin: '2px 0', paddingLeft: '8px', fontSize: '10.5px', color: '#c53030', fontWeight: 'bold' }}>
                      • {alert.replace('⚠️ ', '')}
                    </p>
                  ))
                ) : (
                  <p style={{ margin: '2px 0', paddingLeft: '8px', fontSize: '10.5px', color: '#666', fontStyle: 'italic' }}>
                    Nenhum alerta de risco gerado.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: '700' }}>
          Linha do Tempo & Evolução
        </h2>
        <button 
          onClick={handlePrint}
          className="btn btn-secondary no-print" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
        >
          <svg style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 1.252A1.125 1.125 0 0 1 16.784 20.5H7.216a1.125 1.125 0 0 1-1.105-1.248L6.34 18m11.32 0H6.34M12 9v6m3-3H9m3-9h.008v.008H12V3z" />
          </svg>
          Exportar Prontuário Médico
        </button>
      </div>

      {/* Charts Grid - side-by-side on desktop */}
      <div className="history-charts-grid" style={{ marginBottom: '24px' }}>
        
        {/* Visual Progress Chart (Pure CSS) */}
        <div className="glass-card" style={{ marginBottom: 0 }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>Gráfico de Cicatrização (% de Evolução)</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '120px', padding: '10px 10px 0 10px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
            {entries.map((entry, idx) => {
              const progress = getEntryProgress(entry);
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    {progress}%
                  </span>
                  <div style={{ 
                    width: '24px', 
                    height: `${progress * 0.8}px`, // Max 80px
                    background: 'linear-gradient(to top, var(--primary), var(--primary-light))', 
                    borderRadius: '4px 4px 0 0',
                    boxShadow: '0 2px 8px var(--primary-glow)',
                    transition: 'height 0.5s ease-in-out'
                  }}></div>
                </div>
              );
            })}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
            {entries.map((entry, idx) => (
              <span key={idx} style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', flex: 1 }}>
                {entry.date.split('/')[0]}/{entry.date.split('/')[1]}
              </span>
            ))}
          </div>
        </div>

        {/* Pain Evolution Chart */}
        <div className="glass-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Controle de Dor (Escala 0-10)</h3>
            <span className="badge badge-success no-print" style={{ backgroundColor: 'rgba(43, 108, 176, 0.08)', color: 'var(--accent)' }}>Estável</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '120px', padding: '10px 10px 0 10px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
            {entries.map((entry, idx) => {
              const barHeightPct = (entry.pain / maxPain) * 120; // Max 120px height scale
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: entry.pain > 5 ? 'var(--danger)' : 'var(--accent)', marginBottom: '4px' }}>
                    {entry.pain}
                  </span>
                  <div style={{ 
                    width: '20px', 
                    height: `${barHeightPct * 0.67}px`, // Max 80px
                    background: entry.pain > 5 ? 'linear-gradient(to top, var(--danger), #f87171)' : 'linear-gradient(to top, var(--accent), var(--accent-light))', 
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.5s ease-in-out'
                  }}></div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
            {entries.map((entry, idx) => (
              <span key={idx} style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', flex: 1 }}>
                {entry.date.split('/')[0]}/{entry.date.split('/')[1]}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* History Items list */}
      <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', marginTop: '6px' }}>Histórico de Registros</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {entries.slice().reverse().map((entry, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', margin: 0 }}>
            {/* Card Header: Type, Stage, Evolution, Date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: '700', fontSize: '11.5px' }}>
                  {entry.type}
                </span>
                {entry.lesionStage && (
                  <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10.5px' }}>
                    {entry.lesionStage}
                  </span>
                )}
                {entry.clinicalEvolution && (
                  <span className={`badge ${
                    entry.clinicalEvolution === 'Melhorou' ? 'badge-success' :
                    entry.clinicalEvolution === 'Piorou' ? 'badge-danger' : ''
                  }`} style={{ 
                    fontSize: '10.5px',
                    backgroundColor: entry.clinicalEvolution === 'Melhorou' ? 'rgba(72, 187, 120, 0.1)' : entry.clinicalEvolution === 'Piorou' ? 'rgba(245, 101, 101, 0.1)' : 'rgba(237, 137, 54, 0.1)',
                    color: entry.clinicalEvolution === 'Melhorou' ? '#38a169' : entry.clinicalEvolution === 'Piorou' ? '#e53e3e' : '#dd6b20'
                  }}>
                    {entry.clinicalEvolution}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                {entry.date}
              </span>
            </div>

            {/* Card Body: Photo, Signs, Treatment */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
              {/* Photo Column */}
              <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <img 
                    src={entry.photo} 
                    alt="Lesão" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&auto=format&fit=crop&q=60';
                    }}
                  />
                  <WoundTissueOverlay entry={entry} />
                </div>
                {entry.clinicalOutcome && (
                  <div style={{ fontSize: '10px', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    {entry.clinicalOutcome}
                  </div>
                )}
              </div>

              {/* Signs & Symptoms Column */}
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <h5 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px', marginBottom: '2px' }}>
                  Sinais & Sintomas
                </h5>
                {entry.anatomicalLocation && (
                  <div><strong>Local Anatômico:</strong> {entry.anatomicalLocation}</div>
                )}
                {entry.appearanceDate && (
                  <div><strong>Aparecimento:</strong> {entry.appearanceDate}</div>
                )}
                <div><strong>Dor:</strong> <span style={{ fontWeight: '700', color: entry.pain > 5 ? 'var(--danger)' : 'var(--text-primary)' }}>{entry.pain}/10</span></div>
                <div><strong>Exsudato:</strong> <span style={{ textTransform: 'capitalize' }}>{entry.exudate}</span></div>
                <div><strong>Odor:</strong> {entry.odor ? '⚠️ Presente / Forte' : 'Ausente'}</div>
                {entry.localTemperature && (
                  <div><strong>Temp. Local:</strong> {entry.localTemperature}</div>
                )}
                {entry.infectionSigns && entry.infectionSigns !== 'Nenhum' ? (
                  <div style={{ color: 'var(--danger)', fontWeight: '600', marginTop: '2px' }}>
                    <strong>Sinais de Infecção:</strong> ⚠️ {entry.infectionSigns}
                  </div>
                ) : (
                  <div style={{ color: 'var(--success)', fontWeight: '500', marginTop: '2px' }}>
                    <strong>Sinais de Infecção:</strong> Nenhum detectado
                  </div>
                )}
              </div>

              {/* Treatment Column */}
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <h5 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px', marginBottom: '2px' }}>
                  Conduta & Procedimento
                </h5>
                {entry.appliedDressing ? (
                  <>
                    <div><strong>Cobertura:</strong> {entry.appliedDressing}</div>
                    {entry.dressingQuantity && (
                      <div><strong>Qtd. Usada:</strong> {entry.dressingQuantity} unid.</div>
                    )}
                    {entry.dressingFrequency && (
                      <div><strong>Troca:</strong> {entry.dressingFrequency}</div>
                    )}
                  </>
                ) : (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Nenhuma cobertura registrada.</div>
                )}
                {entry.performedProcedures && (
                  <div style={{ marginTop: '2px' }}><strong>Procedimentos:</strong> {entry.performedProcedures}</div>
                )}
                <div style={{ marginTop: '4px', color: 'var(--primary)', fontWeight: '600' }}>
                  Progresso Calculado: <strong>{getEntryProgress(entry)}%</strong>
                </div>
              </div>
            </div>

            {/* AI Segment */}
            {(entry.aiAreaCm2 || entry.aiLengthCm || entry.aiWidthCm || (entry.aiTissueAnalysis && Object.keys(entry.aiTissueAnalysis).length > 0) || entry.aiRecommendation) && (
              <div style={{ 
                marginTop: '4px', 
                backgroundColor: 'var(--primary-glow)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '10px', 
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg style={{ width: '16px', height: '16px', fill: 'var(--primary)', color: 'var(--bg-secondary)' }} viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Triagem & Análise de IA iRec
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                  {/* AI Dimensions & Tissues */}
                  <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                    {(entry.aiAreaCm2 || entry.aiLengthCm || entry.aiWidthCm) && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {entry.aiAreaCm2 && (
                          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            Área: <strong>{entry.aiAreaCm2} cm²</strong>
                          </div>
                        )}
                        {entry.aiLengthCm && entry.aiWidthCm && (
                          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            Dimensões: <strong>{entry.aiLengthCm} x {entry.aiWidthCm} cm</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.aiTissueAnalysis && Object.keys(entry.aiTissueAnalysis).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>Composição Tecidual:</div>
                        
                        {entry.aiTissueAnalysis.necrose > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '70px', fontSize: '10px', color: 'var(--text-secondary)' }}>Necrose ({entry.aiTissueAnalysis.necrose}%):</span>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${entry.aiTissueAnalysis.necrose}%`, height: '100%', backgroundColor: '#000000' }}></div>
                            </div>
                          </div>
                        )}
                        {entry.aiTissueAnalysis.fibrina > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '70px', fontSize: '10px', color: 'var(--text-secondary)' }}>Fibrina ({entry.aiTissueAnalysis.fibrina}%):</span>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${entry.aiTissueAnalysis.fibrina}%`, height: '100%', backgroundColor: '#f0ad4e' }}></div>
                            </div>
                          </div>
                        )}
                        {entry.aiTissueAnalysis.granulacao > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '70px', fontSize: '10px', color: 'var(--text-secondary)' }}>Granulação ({entry.aiTissueAnalysis.granulacao}%):</span>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${entry.aiTissueAnalysis.granulacao}%`, height: '100%', backgroundColor: '#d9534f' }}></div>
                            </div>
                          </div>
                        )}
                        {entry.aiTissueAnalysis.epitelizacao > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '70px', fontSize: '10px', color: 'var(--text-secondary)' }}>Epitelização ({entry.aiTissueAnalysis.epitelizacao}%):</span>
                            <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${entry.aiTissueAnalysis.epitelizacao}%`, height: '100%', backgroundColor: '#5cb85c' }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* AI Recommendations */}
                  {entry.aiRecommendation && (
                    <div style={{ flex: '1.2 1 240px', fontSize: '11px', borderLeft: '3px solid var(--accent)', paddingLeft: '10px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Recomendação de Cobertura / Conduta:</div>
                      <div style={{ lineHeight: '1.4', fontStyle: 'italic' }}>{entry.aiRecommendation}</div>
                    </div>
                  )}

                  {/* Entry Attachments */}
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div style={{ flex: '1 1 100%', fontSize: '11px', marginTop: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>Arquivos e Exames Anexados:</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                                gap: '6px', 
                                padding: '6px 10px', 
                                borderRadius: '6px', 
                                backgroundColor: 'var(--bg-primary)', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                fontSize: '10.5px',
                                transition: 'all 0.2s'
                              }}
                              className="attachment-pill"
                            >
                              <span>{isImg ? '🖼️' : (isVid ? '🎥' : '📄')}</span>
                              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
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
        ))}
      </div>

      {/* PRINT-ONLY SIGNATURE SECTION */}
      <div className="print-only-flex" style={{ marginTop: '50px', justifyContent: 'space-between', fontSize: '11px' }}>
        <div style={{ width: '220px', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
          Assinatura do Paciente / Cuidador
        </div>
        <div style={{ width: '220px', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
          Mariana Souza (COREN-SP 288.192)<br />Enfermeira Estomaterapeuta
        </div>
      </div>
    </div>
  );
}
