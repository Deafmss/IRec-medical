import React from 'react';

export default function TelemedicineClinicalCopilot({
  isTranscribing,
  transcriptText,
  aiReport,
  generatingReport,
  onGenerateReport,
  onSaveToEvolution,
  safetyAlerts = []
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '340px',
      backgroundColor: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      height: '100%',
      flexShrink: 0,
      overflowY: 'auto',
      padding: '16px',
      gap: '16px'
    }}>
      {/* Copilot Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📝</span>
          <div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Assistente Clínico & Transcrição
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Módulo Integrado iRec</span>
          </div>
        </div>
        {isTranscribing && (
          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '50px' }}>
            ● Ao Vivo
          </span>
        )}
      </div>

      {/* Safety Alerts */}
      {safetyAlerts.length > 0 && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ Alertas Clínicos Detectados
          </span>
          {safetyAlerts.map((alert, idx) => (
            <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              • {alert}
            </div>
          ))}
        </div>
      )}

      {/* Live Transcript Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            🎙️ Transcrição da Consulta
          </span>
        </div>
        <div style={{
          minHeight: '120px',
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap'
        }}>
          {transcriptText || (isTranscribing ? 'Aguardando voz...' : 'Nenhum áudio gravado ainda nesta sessão.')}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onGenerateReport}
        disabled={generatingReport || !transcriptText}
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '12.5px',
          fontWeight: '700',
          borderRadius: '10px',
          backgroundColor: '#0284c7'
        }}
      >
        {generatingReport ? '⏳ Sintetizando Evolução...' : '💡 Gerar Sintese Clínica'}
      </button>

      {/* Clinical Report / SOAP Output */}
      {aiReport && (
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <h4 style={{ fontSize: '13px', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>
            📋 Parecer & Evolução Estruturada
          </h4>

          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <strong>Resumo:</strong>
            <p style={{ margin: '2px 0 8px 0', color: 'var(--text-secondary)' }}>{aiReport.executiveSummary}</p>

            <strong>Evolução Médica:</strong>
            <textarea
              id="ai-evolution-text"
              defaultValue={aiReport.clinicalEvolution}
              style={{
                width: '100%',
                minHeight: '90px',
                marginTop: '4px',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '11.5px'
              }}
            />
          </div>

          <button
            onClick={onSaveToEvolution}
            className="btn btn-primary"
            style={{
              padding: '8px',
              fontSize: '11.5px',
              borderRadius: '8px',
              backgroundColor: '#10b981'
            }}
          >
            ✅ Gravar no Prontuário do Paciente
          </button>
        </div>
      )}
    </div>
  );
}
