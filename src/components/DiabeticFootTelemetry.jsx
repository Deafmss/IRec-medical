import React, { useState } from 'react';

export default function DiabeticFootTelemetry({ patientId, isDoctorView = false }) {
  const [paired, setPaired] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [temperatures, setTemperatures] = useState({
    leftToe: 31.2,
    rightToe: 31.5,
    leftPlantar: 32.1,
    rightPlantar: 34.8, // 2.7°C difference -> Trigger warning
    leftHeel: 30.8,
    rightHeel: 31.0
  });

  const handlePair = () => {
    setPairing(true);
    setTimeout(() => {
      setPairing(false);
      setPaired(true);
    }, 1500);
  };

  const handleSimulateHotspot = () => {
    // Increase right plantar temperature to exceed the 2°C threshold
    setTemperatures({
      leftToe: 31.0,
      rightToe: 31.4,
      leftPlantar: 32.0,
      rightPlantar: 34.8, 
      leftHeel: 30.7,
      rightHeel: 31.1
    });
  };

  const handleSimulateHealthy = () => {
    // Make temperatures symmetrical (variation < 1.0°C)
    setTemperatures({
      leftToe: 31.2,
      rightToe: 31.5,
      leftPlantar: 32.2,
      rightPlantar: 32.5, 
      leftHeel: 30.8,
      rightHeel: 31.0
    });
  };

  const diffToe = Math.abs(temperatures.leftToe - temperatures.rightToe).toFixed(1);
  const diffPlantar = Math.abs(temperatures.leftPlantar - temperatures.rightPlantar).toFixed(1);
  const diffHeel = Math.abs(temperatures.leftHeel - temperatures.rightHeel).toFixed(1);

  const hasCritialAsymmetry = diffToe >= 2.0 || diffPlantar >= 2.0 || diffHeel >= 2.0;

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
            <h4 style={{ fontSize: '13.5px', fontWeight: '700', margin: 0 }}>Monitoramento Térmico IoT (Pé Diabético)</h4>
            <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: 0 }}>Prevenção proativa de feridas via assimetria de temperatura</p>
          </div>
        </div>
        
        <div>
          {paired ? (
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              color: 'var(--success)',
              backgroundColor: 'rgba(72, 187, 120, 0.1)',
              padding: '4px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(72, 187, 120, 0.2)'
            }}>
              ● Conectado (Bluetooth)
            </span>
          ) : (
            <button 
              className="btn btn-secondary" 
              onClick={handlePair}
              disabled={pairing}
              style={{ fontSize: '11px', padding: '4px 10px', height: '28px', borderRadius: '6px' }}
            >
              {pairing ? 'Buscando...' : '🔌 Conectar Sensores'}
            </button>
          )}
        </div>
      </div>

      {!paired ? (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
          Conecte a palmilha ou meias inteligentes iRec para monitorar a temperatura plantar e receber alertas de risco de infecção perilesional.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Thermal alert banner */}
          {hasCritialAsymmetry ? (
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
              Há uma variação de <strong>{diffPlantar}°C</strong> na região plantar. Variações maiores que 2°C indicam alto risco de ulceração ou infecção silenciosa no pé direito. Evite caminhar excessivamente e consulte seu médico.
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
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: diffToe >= 2.0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 161, 219, 0.05)' }}>
                  <span>Dedos:</span>
                  <strong style={{ color: diffToe >= 2.0 ? 'var(--danger)' : 'inherit' }}>{temperatures.rightToe.toFixed(1)}°C</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: diffPlantar >= 2.0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 161, 219, 0.05)' }}>
                  <span>Plantar:</span>
                  <strong style={{ color: diffPlantar >= 2.0 ? 'var(--danger)' : 'inherit' }}>{temperatures.rightPlantar.toFixed(1)}°C</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', backgroundColor: diffHeel >= 2.0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 161, 219, 0.05)' }}>
                  <span>Calcanhar:</span>
                  <strong style={{ color: diffHeel >= 2.0 ? 'var(--danger)' : 'inherit' }}>{temperatures.rightHeel.toFixed(1)}°C</strong>
                </div>
              </div>
            </div>

          </div>

          {/* Simulation Tools for User/Clinician Demo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleSimulateHealthy}
              style={{ fontSize: '9.5px', padding: '4px 8px', flex: 1, height: '26px' }}
            >
              Simular Normal
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleSimulateHotspot}
              style={{ fontSize: '9.5px', padding: '4px 8px', flex: 1, height: '26px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
            >
              Simular Sobrecarga (Ponto Quente)
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
