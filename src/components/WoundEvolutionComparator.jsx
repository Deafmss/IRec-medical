import { useState, useEffect } from 'react';

// Neutral SVG placeholder for missing/failed wound photo comparisons
const NEUTRAL_COMPARE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="280" viewBox="0 0 300 280"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="36">📷</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="12" font-weight="bold">Imagem Não Disponível</text></svg>`;

export default function WoundEvolutionComparator({ entries = [], onClose = () => {}, embeddedMode = false }) {
  const availableEntries = Array.isArray(entries) ? entries : [];
  
  const [indexA, setIndexA] = useState(0); // Older photo
  const [indexB, setIndexB] = useState(() => (availableEntries.length > 1 ? availableEntries.length - 1 : 0)); // Newer photo
  const [zoomLevel, setZoomLevel] = useState(1);

  // Modal ESC key listener (fixes IREC-0386)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (availableEntries.length < 2) {
    const emptyContent = (
      <div className="glass-card" style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '20px',
        maxWidth: '600px',
        width: '100%',
        padding: '36px 24px',
        border: '1px solid var(--border-color)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ fontSize: '42px' }}>🔀</div>
        <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          Comparador de Evolução de Lesão
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5', maxWidth: '420px' }}>
          São necessárias ao menos duas avaliações registradas no prontuário para realizar a comparação visual e dimensional de evolução lado a lado.
        </p>
        {onClose && !embeddedMode && (
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '13px', marginTop: '8px' }}
          >
            Fechar Comparador
          </button>
        )}
      </div>
    );

    if (embeddedMode) return emptyContent;

    return (
      <div 
        onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
        style={{
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
        }}
      >
        {emptyContent}
      </div>
    );
  }

  const safeIndexA = Math.min(Math.max(0, indexA), availableEntries.length - 1);
  const safeIndexB = Math.min(Math.max(0, indexB), availableEntries.length - 1);

  const entryA = availableEntries[safeIndexA];
  const entryB = availableEntries[safeIndexB];

  // Clean Area Parsing (fixes IREC-0161)
  const parseArea = (entry) => {
    if (!entry) return null;
    const val = entry.aiAreaCm2 ?? entry.areaCm2;
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const areaA = parseArea(entryA);
  const areaB = parseArea(entryB);
  const hasAreaComparison = areaA !== null && areaB !== null;

  const areaDiffNum = hasAreaComparison ? areaA - areaB : null;
  const areaDiffStr = hasAreaComparison ? Math.abs(areaDiffNum).toFixed(1) : null;
  const percentReductionNum = (hasAreaComparison && areaA > 0) ? ((areaA - areaB) / areaA) * 100 : null;
  const percentReductionStr = percentReductionNum !== null ? percentReductionNum.toFixed(1) : null;

  const painA = typeof entryA?.pain === 'number' ? entryA.pain : 0;
  const painB = typeof entryB?.pain === 'number' ? entryB.pain : 0;
  const painDiff = painA - painB;

  const isHealing = percentReductionNum !== null ? percentReductionNum > 0 : null;

  // Chronological order verification (fixes IREC-0383)
  const dateA = new Date(entryA?.date || 0);
  const dateB = new Date(entryB?.date || 0);
  const isChronologicalInverted = dateA > dateB;

  const innerContent = (
    <div className="glass-card" style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '20px',
      maxWidth: '1000px',
      width: '100%',
      padding: '24px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)',
      maxHeight: '92vh',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
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
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Comparador de Evolução de Lesão (Lado a Lado)
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)' }}
          aria-label="Fechar"
        >
          ✖
        </button>
      </div>

      {/* Selectors for Photo A and Photo B */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '16px',
        backgroundColor: 'var(--bg-primary)',
        padding: '14px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            📷 FOTO ANTERIOR (PONTO DE PARTIDA):
          </label>
          <select
            value={safeIndexA}
            onChange={e => setIndexA(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: '700',
              fontSize: '12.5px'
            }}
          >
            {availableEntries.map((e, idx) => (
              <option key={idx} value={idx}>
                {e.date || 'Data N/I'} — {e.type || 'Lesão'} ({parseArea(e) !== null ? `${parseArea(e)} cm²` : 'Sem área'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            📸 FOTO ATUAL (REAVALIAÇÃO):
          </label>
          <select
            value={safeIndexB}
            onChange={e => setIndexB(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: '700',
              fontSize: '12.5px'
            }}
          >
            {availableEntries.map((e, idx) => (
              <option key={idx} value={idx}>
                {e.date || 'Data N/I'} — {e.type || 'Lesão'} ({parseArea(e) !== null ? `${parseArea(e)} cm²` : 'Sem área'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chronological Inversion Warning */}
      {isChronologicalInverted && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '11px',
          color: '#f59e0b',
          fontWeight: '700',
          marginBottom: '16px'
        }}>
          ⚠️ <strong>Atenção:</strong> A Foto Anterior ({entryA.date}) é posterior à Foto Atual ({entryB.date}). Para uma comparação temporal correta, selecione a avaliação mais antiga à esquerda.
        </div>
      )}

      {/* Calculated Progress Summary Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
        backgroundColor: isHealing === true ? 'rgba(16, 185, 129, 0.08)' : (isHealing === false ? 'rgba(239, 68, 68, 0.08)' : 'rgba(100, 116, 139, 0.08)'),
        border: `1.5px solid ${isHealing === true ? '#10b981' : (isHealing === false ? '#ef4444' : 'var(--border-color)')}`,
        padding: '14px',
        borderRadius: '14px'
      }}>
        <div>
          <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)' }}>VARIAÇÃO DA ÁREA</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: isHealing === true ? '#10b981' : (isHealing === false ? '#ef4444' : 'var(--text-secondary)') }}>
            {hasAreaComparison ? (
              isHealing ? `🔻 ${percentReductionStr}%` : `🔺 +${Math.abs(Number(percentReductionStr))}%`
            ) : '—'}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            {hasAreaComparison ? (
              areaDiffNum > 0 ? `Diminuição de ${areaDiffStr} cm²` : (areaDiffNum < 0 ? `Aumento de ${areaDiffStr} cm²` : 'Sem alteração de área')
            ) : 'Área não mensurada nas avaliações'}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)' }}>EVOLUÇÃO DA DOR</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: painDiff >= 0 ? '#10b981' : '#ef4444' }}>
            {painDiff >= 0 ? `📉 -${painDiff} Níveis` : `📈 +${Math.abs(painDiff)} Níveis`}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            De {painA}/10 para {painB}/10
          </span>
        </div>

        <div>
          <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)' }}>STATUS CLÍNICO</span>
          <div style={{ fontSize: '15px', fontWeight: '800', color: isHealing === true ? '#10b981' : (isHealing === false ? '#ef4444' : 'var(--text-secondary)'), marginTop: '4px' }}>
            {isHealing === true ? '🟢 Cicatrização Favorável' : (isHealing === false ? '🔴 Necessita Revisão de Conduta' : '⚪ Monitoramento Clínico')}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Baseado na evolução estomaterápica
          </span>
        </div>
      </div>

      {/* Side by Side Image Comparison Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Photo A Panel */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '14px',
          padding: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--primary)' }}>
              📅 DATA: {entryA?.date || 'N/I'}
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)' }}>
              Área: {areaA !== null ? `${areaA} cm²` : 'N/A'}
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '240px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <img
              src={entryA?.photo || NEUTRAL_COMPARE_PLACEHOLDER}
              alt="Foto Anterior"
              onError={(e) => { e.target.src = NEUTRAL_COMPARE_PLACEHOLDER; }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease'
              }}
            />
          </div>

          <div style={{ width: '100%', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            <div><strong>Estágio:</strong> {entryA?.lesionStage || 'Não especificado'}</div>
            <div><strong>Exsudato:</strong> {entryA?.exudate || 'Normal'}</div>
            {entryA?.clinicalEvolution && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <strong>Evolução:</strong> {entryA.clinicalEvolution}
              </div>
            )}
          </div>
        </div>

        {/* Photo B Panel */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '14px',
          padding: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#10b981' }}>
              📅 DATA: {entryB?.date || 'N/I'}
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)' }}>
              Área: {areaB !== null ? `${areaB} cm²` : 'N/A'}
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '240px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <img
              src={entryB?.photo || NEUTRAL_COMPARE_PLACEHOLDER}
              alt="Foto Atual"
              onError={(e) => { e.target.src = NEUTRAL_COMPARE_PLACEHOLDER; }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease'
              }}
            />
          </div>

          <div style={{ width: '100%', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            <div><strong>Estágio:</strong> {entryB?.lesionStage || 'Não especificado'}</div>
            <div><strong>Exsudato:</strong> {entryB?.exudate || 'Normal'}</div>
            {entryB?.clinicalEvolution && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <strong>Evolução:</strong> {entryB.clinicalEvolution}
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
        padding: '8px 12px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: '12px', fontWeight: '700' }}>🔍 Zoom Síncrono:</span>
        <input
          type="range"
          min="1"
          max="2.5"
          step="0.1"
          value={zoomLevel}
          onChange={e => setZoomLevel(Number(e.target.value))}
          style={{ width: '180px', accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--primary)' }}>
          {zoomLevel.toFixed(1)}x
        </span>
        <button
          type="button"
          onClick={() => setZoomLevel(1)}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '3px 8px',
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
    <div 
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{
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
      }}
    >
      {innerContent}
    </div>
  );
}
