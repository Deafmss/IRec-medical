import { useEffect, useMemo } from 'react';
import { speakNaturalText } from '../utils/speechUtils';

export default function ReportPDFGenerator({ clinicalProfile, entries, onClose }) {
  const patientName = clinicalProfile?.name || 'Paciente iRec';
  const patientCpf = clinicalProfile?.cpf || 'Não informado';
  const allergy = clinicalProfile?.allergies || 'Nenhuma declarada';

  const docId = useMemo(() => {
    const seed = (clinicalProfile?.id || clinicalProfile?.cpf || patientName).replace(/\D/g, '');
    const num = seed ? (parseInt(seed.slice(-6), 10) || 102938) : 102938;
    return 'EVOL-' + num;
  }, [clinicalProfile?.id, clinicalProfile?.cpf, patientName]);
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Calculate dynamic reduction percentage from entries using real aiAreaCm2 field
  let healingPercentage = null;
  let healingLabel = "Dados insuficientes para cálculo de evolução";
  let isWorsening = false;

  if (entries && entries.length >= 2) {
    const first = entries[0];
    const latest = entries[entries.length - 1];
    const firstArea = parseFloat(first.aiAreaCm2 || first.area || first.woundArea);
    const latestArea = parseFloat(latest.aiAreaCm2 || latest.area || latest.woundArea);

    if (!isNaN(firstArea) && !isNaN(latestArea) && firstArea > 0) {
      const pct = Math.round(((firstArea - latestArea) / firstArea) * 100);
      if (pct > 0) {
        healingPercentage = pct;
        healingLabel = `${pct}% de Redução da Lesão`;
      } else if (pct === 0) {
        healingPercentage = 0;
        healingLabel = "Área da lesão mantida (Estável)";
      } else {
        isWorsening = true;
        healingPercentage = Math.abs(pct);
        healingLabel = `Aumento de ${Math.abs(pct)}% na área da lesão (Reavaliação recomendada)`;
      }
    }
  }

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handlePrint = () => {
    triggerVibration();
    speakNaturalText("Gerando relatório evolutivo impresso em PDF.");
    window.print();
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Relatório Evolutivo de Estomaterapia & Cicatrização"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: 'var(--font-primary, sans-serif)'
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        overflowY: 'auto',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '2px solid #10b981',
        boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.4)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-report, #printable-report * {
              visibility: visible !important;
            }
            #printable-report {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-height: none !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📊</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
                Relatório Evolutivo de Estomaterapia & Cicatrização
              </h3>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                Gerado para apresentação médica e acompanhamento continuado
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            ×
          </button>
        </div>

        {/* PRINTABLE PDF CONTAINER */}
        <div id="printable-report" style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '28px',
          border: '2px solid #cbd5e1',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          fontFamily: 'Arial, sans-serif'
        }}>
          {/* Document Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #10b981', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#10b981', fontSize: '24px', fontWeight: 'bold' }}>iRec Saúde</h2>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                Plataforma de Navegação e Acompanhamento de Feridas e Crônicos
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block' }}>
                LAUDO EVOLUTIVO DE CICATRIZAÇÃO
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                CÓDIGO: {docId}
              </span>
            </div>
          </div>

          {/* Patient Card */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
            <strong>PACIENTE:</strong> {patientName} &nbsp;|&nbsp; <strong>CPF:</strong> {patientCpf}<br />
            <strong>ALERGIAS DECLARADAS:</strong> {allergy} &nbsp;|&nbsp; <strong>DATA DO RELATÓRIO:</strong> {currentDate}
          </div>

          {/* Healing Percentage Bar */}
          <div style={{
            backgroundColor: isWorsening ? '#fef2f2' : (healingPercentage !== null ? '#ecfdf5' : '#f8fafc'),
            border: `1px solid ${isWorsening ? '#fca5a5' : (healingPercentage !== null ? '#a7f3d0' : '#e2e8f0')}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: isWorsening ? '#991b1b' : (healingPercentage !== null ? '#047857' : '#64748b'), display: 'block' }}>
                EVOLUÇÃO DA CICATRIZAÇÃO
              </span>
              <h3 style={{ margin: '4px 0 0 0', color: isWorsening ? '#7f1d1d' : (healingPercentage !== null ? '#065f46' : '#1e293b'), fontSize: '20px', fontWeight: '900' }}>
                {healingLabel}
              </h3>
            </div>
            {healingPercentage !== null && (
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: isWorsening ? '#ef4444' : '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '18px'
              }}>
                {isWorsening ? `+${healingPercentage}%` : `${healingPercentage}%`}
              </div>
            )}
          </div>

          {/* Evolution Records Table */}
          <h4 style={{ margin: '0 0 10px 0', color: '#047857', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
            HISTÓRICO DE REGISTROS DE LESÃO:
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Data</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Tipo de Lesão</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Dor (0-10)</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Aspecto do Tecido / Anotações</th>
              </tr>
            </thead>
            <tbody>
              {entries && entries.length > 0 ? (
                entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.date || currentDate}</td>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.type || '—'}</td>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.pain !== undefined && entry.pain !== null ? `${entry.pain}/10` : '—'}</td>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.doctorNotes || entry.clinicalEvolution || entry.aiRecommendation || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: '16px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    Nenhum registro de lesão disponível no histórico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Document Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #10b981', paddingTop: '16px', marginTop: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#047857', display: 'block' }}>
                🛡️ LAUDO REGISTRADO NA PLATAFORMA iREC
              </span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                Acompanhamento Clínico de Estomaterapia
              </span>
              <span style={{ fontSize: '10px', color: '#0f172a', fontWeight: 'bold', display: 'block' }}>
                Código: {docId}
              </span>
            </div>

            <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
              Gerado automaticamente pela Plataforma iRec<br />
              https://i-rec-medical.vercel.app
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontWeight: '900',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🖨️</span>
            <span>IMPRIMIR / GERAR PDF</span>
          </button>

          <button
            type="button"
            onClick={() => { triggerVibration(); onClose(); }}
            style={{
              backgroundColor: '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontWeight: '800',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}
