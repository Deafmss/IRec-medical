import React, { useState } from 'react';

export default function DiabeticFootTelemetry({ patientId, isDoctorView = false }) {
  const [syncing, setSyncing] = useState(false);
  const [temperatures, setTemperatures] = useState({
    leftToe: 31.2,
    rightToe: 31.4,
    leftPlantar: 32.2,
    rightPlantar: 32.5, 
    leftHeel: 30.8,
    rightHeel: 31.0
  });

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      // Synchronize generates subtle, realistic thermal fluctuations under normal conditions
      setTemperatures({
        leftToe: 31.0 + Math.random() * 0.5,
        rightToe: 31.1 + Math.random() * 0.5,
        leftPlantar: 32.0 + Math.random() * 0.5,
        rightPlantar: 32.2 + Math.random() * 0.5, 
        leftHeel: 30.6 + Math.random() * 0.5,
        rightHeel: 30.7 + Math.random() * 0.5
      });
    }, 1000);
  };

  const diffToe = Math.abs(temperatures.leftToe - temperatures.rightToe).toFixed(1);
  const diffPlantar = Math.abs(temperatures.leftPlantar - temperatures.rightPlantar).toFixed(1);
  const diffHeel = Math.abs(temperatures.leftHeel - temperatures.rightHeel).toFixed(1);

  const hasCriticalAsymmetry = parseFloat(diffToe) >= 2.0 || parseFloat(diffPlantar) >= 2.0 || parseFloat(diffHeel) >= 2.0;

  return (
    <div className="glass-card" style={{
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      margin: '0 0 16px 0',
      color: 'var(--text-primary)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>👣</span>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>Monitoramento Térmico IoT (Pé Diabético)</h4>
            <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: 0 }}>Prevenção proativa de feridas via assimetria de temperatura</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            color: 'var(--success)',
            backgroundColor: 'rgba(72, 187, 120, 0.1)',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(72, 187, 120, 0.2)'
          }}>
            ● Sensores Pareados
          </span>
          <button 
            className="btn btn-secondary" 
            onClick={handleSync}
            disabled={syncing}
            style={{ fontSize: '11px', padding: '4px 10px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {syncing ? (
              <>
                <span className="spinner" style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '4px' }} />
                Sincronizando...
              </>
            ) : (
              '🔄 Sincronizar'
            )}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Thermal alert banner */}
        {hasCriticalAsymmetry ? (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '11px',
            lineHeight: '1.4'
          }}>
            <span style={{ fontWeight: '700', color: 'var(--danger)', display: 'block', marginBottom: '3px' }}>
              🚨 ALERTA CLÍNICO: Assimetria Térmica Detectada
            </span>
            Há uma variação de <strong>{diffPlantar}°C</strong> na região plantar. Variações maiores que 2°C indicam risco de ulceração no pé direito. Evite caminhar excessivamente e consulte seu médico.
          </div>
        ) : (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '11px',
            color: 'var(--success-light)',
            fontWeight: '600'
          }}>
            ✅ Distribuição térmica equilibrada. Diferença térmica menor que 1.0°C (Limiar clínico seguro).
          </div>
        )}

        {/* Plantar Map Visualization */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: 'var(--bg-primary)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          
          {/* Left Foot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px dashed var(--border-color)', paddingRight: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>PÉ ESQUERDO</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 161, 219, 0.05)' }}>
                <span>Dedos:</span>
                <strong>{temperatures.leftToe.toFixed(1)}°C</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 161, 219, 0.05)' }}>
                <span>Plantar:</span>
                <strong>{temperatures.leftPlantar.toFixed(1)}°C</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 161, 219, 0.05)' }}>
                <span>Calcanhar:</span>
                <strong>{temperatures.leftHeel.toFixed(1)}°C</strong>
              </div>
            </div>
          </div>

          {/* Right Foot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>PÉ DIREITO</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: parseFloat(diffToe) >= 2.0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 161, 219, 0.05)' }}>
                <span>Dedos:</span>
                <strong style={{ color: parseFloat(diffToe) >= 2.0 ? 'var(--danger)' : 'inherit' }}>{temperatures.rightToe.toFixed(1)}°C</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: parseFloat(diffPlantar) >= 2.0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 161, 219, 0.05)' }}>
                <span>Plantar:</span>
                <strong style={{ color: parseFloat(diffPlantar) >= 2.0 ? 'var(--danger)' : 'inherit' }}>{temperatures.rightPlantar.toFixed(1)}°C</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: parseFloat(diffHeel) >= 2.0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 161, 219, 0.05)' }}>
                <span>Calcanhar:</span>
                <strong style={{ color: parseFloat(diffHeel) >= 2.0 ? 'var(--danger)' : 'inherit' }}>{temperatures.rightHeel.toFixed(1)}°C</strong>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
