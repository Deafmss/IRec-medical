import React, { useState } from 'react';

export default function VitalsTelemetry({ patientId, isDoctorView = false }) {
  const [activeSubTab, setActiveSubTab] = useState('vitals');
  const [syncing, setSyncing] = useState(false);

  // Sinais vitais gerais
  const [vitals, setVitals] = useState({
    heartRate: 72,
    bloodPressure: '120/80',
    spo2: 98,
    bodyTemp: 36.6,
    glucose: 95
  });

  // Temperaturas plantar do pé diabético (compatibilidade)
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
      // Gera flutuações sutis e normais para simular medição em tempo real de sensores pareados
      setVitals({
        heartRate: Math.floor(65 + Math.random() * 15),
        bloodPressure: `${115 + Math.floor(Math.random() * 10)}/${75 + Math.floor(Math.random() * 8)}`,
        spo2: Math.floor(96 + Math.random() * 4),
        bodyTemp: parseFloat((36.2 + Math.random() * 0.7).toFixed(1)),
        glucose: Math.floor(85 + Math.random() * 20)
      });

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
      {/* Header com Sincronizador Geral */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🩺</span>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>Telemetria de Saúde & Sinais Vitais IoT</h4>
            <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: 0 }}>Monitoramento integrado de métricas vitais e dados plantares</p>
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
            ● Dispositivos Pareados
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

      {/* Abas Internas da Telemetria */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
        <button
          onClick={() => setActiveSubTab('vitals')}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '11.5px',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'vitals' ? 'var(--primary)' : 'transparent',
            color: activeSubTab === 'vitals' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'var(--transition-fast)'
          }}
        >
          📈 Sinais Vitais Gerais
        </button>
        <button
          onClick={() => setActiveSubTab('plantar')}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '11.5px',
            fontWeight: '700',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'plantar' ? 'var(--primary)' : 'transparent',
            color: activeSubTab === 'plantar' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'var(--transition-fast)'
          }}
        >
          👣 Temperatura Local (Plantar)
        </button>
      </div>

      {/* Conteúdo Aba 1: Sinais Vitais Gerais */}
      {activeSubTab === 'vitals' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          
          {/* Card: Frequência Cardíaca */}
          <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <span style={{ fontSize: '20px' }}>❤️</span>
            <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '4px' }}>Batimentos</span>
            <strong style={{ fontSize: '16px', display: 'block', margin: '4px 0' }}>{vitals.heartRate} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>BPM</span></strong>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(72, 187, 120, 0.1)', color: 'var(--success)', fontWeight: '700' }}>Normal</span>
          </div>

          {/* Card: Pressão Arterial */}
          <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <span style={{ fontSize: '20px' }}>🩺</span>
            <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '4px' }}>Pressão Arterial</span>
            <strong style={{ fontSize: '16px', display: 'block', margin: '4px 0' }}>{vitals.bloodPressure} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>mmHg</span></strong>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(72, 187, 120, 0.1)', color: 'var(--success)', fontWeight: '700' }}>Normal</span>
          </div>

          {/* Card: Saturação O2 */}
          <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <span style={{ fontSize: '20px' }}>💨</span>
            <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '4px' }}>Saturação O₂</span>
            <strong style={{ fontSize: '16px', display: 'block', margin: '4px 0' }}>{vitals.spo2}%</strong>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(72, 187, 120, 0.1)', color: 'var(--success)', fontWeight: '700' }}>Excelente</span>
          </div>

          {/* Card: Temperatura Corporal */}
          <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <span style={{ fontSize: '20px' }}>🌡️</span>
            <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '4px' }}>Temp. Corporal</span>
            <strong style={{ fontSize: '16px', display: 'block', margin: '4px 0' }}>{vitals.bodyTemp}°C</strong>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(72, 187, 120, 0.1)', color: 'var(--success)', fontWeight: '700' }}>Normal</span>
          </div>

          {/* Card: Glicemia */}
          <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <span style={{ fontSize: '20px' }}>🩸</span>
            <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '4px' }}>Glicemia (Jejum)</span>
            <strong style={{ fontSize: '16px', display: 'block', margin: '4px 0' }}>{vitals.glucose} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>mg/dL</span></strong>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(72, 187, 120, 0.1)', color: 'var(--success)', fontWeight: '700' }}>Estável</span>
          </div>

        </div>
      )}

      {/* Conteúdo Aba 2: Temperatura Plantar (Pé Diabético) */}
      {activeSubTab === 'plantar' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
      )}
      
      {/* Transparency Note */}
      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(245, 158, 11, 0.06)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        fontSize: '10px',
        color: '#f59e0b',
        textAlign: 'left',
        lineHeight: '1.4'
      }}>
        ⚠️ <strong>Nota de Transparência:</strong> Este ambiente clínico de demonstração não possui sensores de IoT ou eletrodos de ECG acoplados fisicamente neste dispositivo. Os valores vitais e variações térmicas exibidos são simulações clínicas para fins ilustrativos e didáticos.
      </div>
    </div>
  );
}
