import React, { useState } from 'react';

export default function WoundEvolutionComparator({ entries = [], onClose, embeddedMode = false }) {
  // Mock data fallback if no historical entries with photos exist
  const defaultEntries = [
    {
      id: 'w_1',
      date: '2026-06-15',
      type: 'Úlcera por Pressão',
      lesionStage: 'Estágio III',
      aiAreaCm2: '14.5',
      pain: 7,
      exudate: 'Moderado (Seroso)',
      photo: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80',
      clinicalEvolution: 'Ferida com presença de esfacelo e exsudato moderado. Bordas irregulares.'
    },
    {
      id: 'w_2',
      date: '2026-07-01',
      type: 'Úlcera por Pressão',
      lesionStage: 'Estágio II',
      aiAreaCm2: '8.2',
      pain: 4,
      exudate: 'Leve',
      photo: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80',
      clinicalEvolution: 'Tecido de granulação abundante em 70% do leito. Redução significativa de exsudato.'
    },
    {
      id: 'w_3',
      date: '2026-07-28',
      type: 'Úlcera por Pressão',
      lesionStage: 'Estágio I (Em Cicatrização)',
      aiAreaCm2: '3.1',
      pain: 1,
      exudate: 'Ausente',
      photo: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
      clinicalEvolution: 'Epitelização em fases finais. Ótima evolução com terapia de curativo especial.'
    }
  ];

  const availableEntries = entries && entries.length >= 2 ? entries : defaultEntries;

  const [indexA, setIndexA] = useState(0); // Older photo
  const [indexB, setIndexB] = useState(availableEntries.length - 1); // Newer photo
  const [zoomLevel, setZoomLevel] = useState(1);

  const entryA = availableEntries[indexA] || availableEntries[0];
  const entryB = availableEntries[indexB] || availableEntries[availableEntries.length - 1];

  // Calculated Metrics
  const areaA = parseFloat(entryA.aiAreaCm2 || entryA.areaCm2 || '14.5');
  const areaB = parseFloat(entryB.aiAreaCm2 || entryB.areaCm2 || '3.1');
  
  const areaDiff = (areaA - areaB).toFixed(1);
  const percentReduction = areaA > 0 ? (((areaA - areaB) / areaA) * 100).toFixed(1) : '0';
  const painDiff = (entryA.pain || 0) - (entryB.pain || 0);

  const isHealing = parseFloat(percentReduction) > 0;

  const innerContent = (
    <div className="glass-card" style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '20px',
      maxWidth: '1000px',
      width: '100%',
      padding: '28px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            color: 'var(--primary)',
            fontSize: '11px',
            fontWeight: '800',
            padding: '4px 10px',
            borderRadius: '20px',
            marginBottom: '6px'
          }}>
            🔀 ESTOMATERAPIA COMPUTADORIZADA
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Comparador de Evolução de Lesão (Lado a Lado)
          </h2>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✖
          </button>
        )}
      </div>

      {/* Selectors for Photo A and Photo B */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '20px',
        backgroundColor: 'var(--bg-primary)',
        padding: '14px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            📷 SELECIONE FOTO ANTERIOR (PONTO DE PARTIDA):
          </label>
          <select
            value={indexA}
            onChange={e => setIndexA(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: '700',
              fontSize: '13px'
            }}
          >
            {availableEntries.map((e, idx) => (
              <option key={idx} value={idx}>
                {e.date} — {e.type || 'Lesão'} ({e.aiAreaCm2 || 'N/A'} cm²)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            📸 SELECIONE FOTO ATUAL (REAVALIAÇÃO):
          </label>
          <select
            value={indexB}
            onChange={e => setIndexB(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: '700',
              fontSize: '13px'
            }}
          >
            {availableEntries.map((e, idx) => (
              <option key={idx} value={idx}>
                {e.date} — {e.type || 'Lesão'} ({e.aiAreaCm2 || 'N/A'} cm²)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calculated Progress Summary Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
        backgroundColor: isHealing ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        border: `1.5px solid ${isHealing ? '#10b981' : '#ef4444'}`,
        padding: '16px',
        borderRadius: '14px'
      }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>REDUÇÃO DA ÁREA</span>
          <div style={{ fontSize: '24px', fontWeight: '900', color: isHealing ? '#10b981' : '#ef4444' }}>
            {isHealing ? `🔻 ${percentReduction}%` : `🔺 +${Math.abs(Number(percentReduction))}%`}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {areaDiff > 0 ? `Diminuição de ${areaDiff} cm²` : `Aumento de ${Math.abs(areaDiff)} cm²`}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>EVOLUÇÃO DA DOR</span>
          <div style={{ fontSize: '24px', fontWeight: '900', color: painDiff >= 0 ? '#10b981' : '#ef4444' }}>
            {painDiff >= 0 ? `📉 -${painDiff} Níveis` : `📈 +${Math.abs(painDiff)} Níveis`}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            De {entryA.pain || 0}/10 para {entryB.pain || 0}/10
          </span>
        </div>

        <div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>STATUS CLÍNICO</span>
          <div style={{ fontSize: '18px', fontWeight: '800', color: isHealing ? '#10b981' : '#ef4444', marginTop: '4px' }}>
            {isHealing ? '🟢 Cicatrização Favorável' : '🔴 Necessita Revisão de Conduta'}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Baseado na análise de estomaterapia
          </span>
        </div>
      </div>

      {/* Side by Side Image Comparison Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Photo A Panel */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>
              📅 DATA: {entryA.date}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
              Área: {entryA.aiAreaCm2 || entryA.areaCm2 || 'N/A'} cm²
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '280px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <img
              src={entryA.photo || entryA.photoUrl}
              alt="Foto Anterior"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease'
              }}
            />
          </div>

          <div style={{ width: '100%', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            <div><strong>Estágio:</strong> {entryA.lesionStage || 'Não especificado'}</div>
            <div><strong>Exsudato:</strong> {entryA.exudate || 'Normal'}</div>
            {entryA.clinicalEvolution && (
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <em>"{entryA.clinicalEvolution}"</em>
              </div>
            )}
          </div>
        </div>

        {/* Photo B Panel */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
              📅 DATA: {entryB.date}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
              Área: {entryB.aiAreaCm2 || entryB.areaCm2 || 'N/A'} cm²
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '280px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <img
              src={entryB.photo || entryB.photoUrl}
              alt="Foto Atual"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease'
              }}
            />
          </div>

          <div style={{ width: '100%', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            <div><strong>Estágio:</strong> {entryB.lesionStage || 'Não especificado'}</div>
            <div><strong>Exsudato:</strong> {entryB.exudate || 'Normal'}</div>
            {entryB.clinicalEvolution && (
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <em>"{entryB.clinicalEvolution}"</em>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Control Slider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        justifyContent: 'center',
        padding: '10px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: '13px', fontWeight: '700' }}>🔍 Zoom Síncrono das Lesões:</span>
        <input
          type="range"
          min="1"
          max="2.5"
          step="0.1"
          value={zoomLevel}
          onChange={e => setZoomLevel(Number(e.target.value))}
          style={{ width: '200px', accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>
          {zoomLevel.toFixed(1)}x
        </span>
        <button
          onClick={() => setZoomLevel(1)}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Resetar Zoom
        </button>
      </div>
    </div>
  );

  if (embeddedMode) return innerContent;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1500,
      padding: '16px'
    }}>
      {innerContent}
    </div>
  );
}
