import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { isChronologicallyInverted, formatClinicalDate } from '../utils/clinicalDate';

// Neutral SVG placeholder for missing/failed wound photo comparisons
const NEUTRAL_COMPARE_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="280" viewBox="0 0 300 280"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="36">📷</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="12" font-weight="bold">Imagem Não Disponível</text></svg>`;

export default function WoundEvolutionComparator({ entries = [], onClose = () => {}, embeddedMode = false }) {
  const availableEntries = Array.isArray(entries) ? entries : [];
  
  const [indexA, setIndexA] = useState(0); // Older photo
  const [indexB, setIndexB] = useState(() => (availableEntries.length > 1 ? availableEntries.length - 1 : 0)); // Newer photo
  
  // Independent / Synchronized Zoom & Pan state
  const [zoomA, setZoomA] = useState(1);
  const [zoomB, setZoomB] = useState(1);
  const [panA, setPanA] = useState({ x: 0, y: 0 });
  const [panB, setPanB] = useState({ x: 0, y: 0 });
  const [isSyncMode, setIsSyncMode] = useState(true);

  // Dragging state for Image A
  const [isDraggingA, setIsDraggingA] = useState(false);
  const [dragStartA, setDragStartA] = useState({ x: 0, y: 0 });

  // Dragging state for Image B
  const [isDraggingB, setIsDraggingB] = useState(false);
  const [dragStartB, setDragStartB] = useState({ x: 0, y: 0 });

  // Modal ESC key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Sync zoom handler
  const handleZoomChange = (newZoom, target = 'both') => {
    if (isSyncMode || target === 'both') {
      setZoomA(newZoom);
      setZoomB(newZoom);
    } else if (target === 'A') {
      setZoomA(newZoom);
    } else if (target === 'B') {
      setZoomB(newZoom);
    }
  };

  const handleResetFocal = () => {
    setZoomA(1);
    setZoomB(1);
    setPanA({ x: 0, y: 0 });
    setPanB({ x: 0, y: 0 });
  };

  // Drag handlers Image A
  const handleMouseDownA = (e) => {
    if (zoomA > 1) {
      setIsDraggingA(true);
      setDragStartA({ x: e.clientX - panA.x, y: e.clientY - panA.y });
    }
  };

  const handleMouseMoveA = (e) => {
    if (isDraggingA) {
      const newX = e.clientX - dragStartA.x;
      const newY = e.clientY - dragStartA.y;
      setPanA({ x: newX, y: newY });
      if (isSyncMode) {
        setPanB({ x: newX, y: newY });
      }
    }
  };

  const handleMouseUpA = () => {
    setIsDraggingA(false);
  };

  // Drag handlers Image B
  const handleMouseDownB = (e) => {
    if (zoomB > 1) {
      setIsDraggingB(true);
      setDragStartB({ x: e.clientX - panB.x, y: e.clientY - panB.y });
    }
  };

  const handleMouseMoveB = (e) => {
    if (isDraggingB) {
      const newX = e.clientX - dragStartB.x;
      const newY = e.clientY - dragStartB.y;
      setPanB({ x: newX, y: newY });
      if (isSyncMode) {
        setPanA({ x: newX, y: newY });
      }
    }
  };

  const handleMouseUpB = () => {
    setIsDraggingB(false);
  };

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

  // Verificacao de ordem cronologica (IREC-0383).
  //
  // Antes: `new Date(entryA?.date)` sobre "20/08/2026" — Invalid Date em todos
  // os navegadores, porque o parser espera MM/DD e nao existe mes 20. Entao
  // `dateA > dateB` era `NaN > NaN`, ou seja SEMPRE false: este aviso nunca
  // aparecia, e o medico podia ler "30% de reducao" com as fotos na ordem
  // trocada, quando a ferida havia piorado.
  //
  // `isChronologicallyInverted` devolve null quando nao consegue interpretar
  // alguma das datas — caso que agora e tratado, em vez de virar um false
  // silencioso.
  const inversaoCronologica = isChronologicallyInverted(entryA, entryB);
  const isChronologicalInverted = inversaoCronologica === true;
  const datasIndeterminadas = inversaoCronologica === null;
  const dataA = formatClinicalDate(entryA?.entryDate || entryA?.date) || 'data nao registrada';
  const dataB = formatClinicalDate(entryB?.entryDate || entryB?.date) || 'data nao registrada';

  const innerContent = (
    <div className="glass-card glass-card-cyan-glow" style={{
      borderRadius: '20px',
      maxWidth: 'min(960px, 94vw)',
      width: '100%',
      maxHeight: 'calc(100vh - 48px)',
      overflow: 'hidden',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-lg)',
      boxSizing: 'border-box'
    }}>
      <style>{`
        .irec-glass-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .irec-glass-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 8px 0;
        }
        .irec-glass-scroll::-webkit-scrollbar-thumb {
          background: rgba(2, 132, 199, 0.4);
          border-radius: 10px;
        }
        .irec-glass-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(2, 132, 199, 0.8);
        }

        @media (max-width: 768px) {
          .irec-compare-selectors-grid {
            grid-template-columns: 1fr !important;
          }
          .irec-compare-photos-grid {
            grid-template-columns: 1fr !important;
          }
          .irec-compare-hint-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .irec-compare-toggle-track {
            width: 100% !important;
            justify-content: center !important;
          }
          .irec-compare-image-container {
            height: 210px !important;
          }
        }
      `}</style>

      {/* 1. FIXED HEADER LAYER */}
      <div style={{
        padding: '18px 24px 14px 24px',
        borderBottom: '1px solid var(--glass-border)',
        backgroundColor: 'rgba(2, 132, 199, 0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            color: '#0284c7',
            fontSize: '11px',
            fontWeight: '800',
            padding: '3px 10px',
            borderRadius: '50px',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            marginBottom: '4px'
          }}>
            🔀 ESTOMATERAPIA COMPUTADORIZADA
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Comparador de Evolução de Lesão (Lado a Lado)
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--glass-border)',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          aria-label="Fechar"
        >
          ✖
        </button>
      </div>

      {/* 2. MIDDLE SCROLLABLE BODY LAYER */}
      <div className="irec-glass-scroll" style={{
        overflowY: 'auto',
        padding: '20px 24px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Selectors for Photo A and Photo B */}
        <div className="irec-compare-selectors-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          backgroundColor: 'rgba(2, 132, 199, 0.05)',
          padding: '14px 16px',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(10px)'
        }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              📷 FOTO ANTERIOR (PONTO DE PARTIDA):
            </label>
            <select
              value={safeIndexA}
              onChange={e => setIndexA(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontWeight: '700',
                fontSize: '13px'
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
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              📸 FOTO ATUAL (REAVALIAÇÃO):
            </label>
            <select
              value={safeIndexB}
              onChange={e => setIndexB(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontWeight: '700',
                fontSize: '13px'
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
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#f59e0b',
            fontWeight: '700'
          }}>
            ⚠️ <strong>Atenção:</strong> A avaliação da esquerda ({dataA}) é posterior à da direita ({dataB}). Para uma comparação temporal correta, selecione a avaliação mais antiga à esquerda.
          </div>
        )}

        {/* Datas ilegíveis: sem isto, o painel apresentaria a comparação como se
            a ordem estivesse conferida. */}
        {datasIndeterminadas && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#f87171',
            fontWeight: '700'
          }}>
            ⚠️ <strong>Não foi possível conferir a ordem das datas</strong> ({dataA} / {dataB}).
            Confirme qual avaliação é a mais antiga antes de interpretar a evolução.
          </div>
        )}

        {/* Calculated Progress Summary Banner */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
          backgroundColor: isHealing === true ? 'rgba(16, 185, 129, 0.1)' : (isHealing === false ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)'),
          border: `1.5px solid ${isHealing === true ? '#10b981' : (isHealing === false ? '#ef4444' : 'var(--glass-border)')}`,
          padding: '14px 16px',
          borderRadius: '16px'
        }}>
          <div>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', letterSpacing: '0.5px' }}>VARIAÇÃO DA ÁREA</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: isHealing === true ? '#10b981' : (isHealing === false ? '#ef4444' : 'var(--text-secondary)'), fontFamily: 'var(--font-display)' }}>
              {hasAreaComparison ? (
                isHealing ? `🔻 ${percentReductionStr}%` : `🔺 +${Math.abs(Number(percentReductionStr))}%`
              ) : '—'}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: '700' }}>
              {hasAreaComparison ? (
                areaDiffNum > 0 ? `Diminuição de ${areaDiffStr} cm²` : (areaDiffNum < 0 ? `Aumento de ${areaDiffStr} cm²` : 'Sem alteração de área')
              ) : 'Área não mensurada nas avaliações'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', letterSpacing: '0.5px' }}>EVOLUÇÃO DA DOR</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: painDiff >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-display)' }}>
              {painDiff >= 0 ? `📉 -${painDiff} Níveis` : `📈 +${Math.abs(painDiff)} Níveis`}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: '700' }}>
              De {painA}/10 para {painB}/10
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', letterSpacing: '0.5px' }}>STATUS CLÍNICO</span>
            <div style={{ fontSize: '14px', fontWeight: '800', color: isHealing === true ? '#10b981' : (isHealing === false ? '#ef4444' : 'var(--text-secondary)'), marginTop: '2px', fontFamily: 'var(--font-display)' }}>
              {isHealing === true ? '🟢 Cicatrização Favorável' : (isHealing === false ? '🔴 Necessita Revisão de Conduta' : '⚪ Monitoramento Clínico')}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: '700' }}>
              Baseado na evolução estomaterápica
            </span>
          </div>
        </div>

        {/* Hint & Focal Sync Mode Toggle */}
        <div className="irec-compare-hint-bar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(2, 132, 199, 0.05)',
          padding: '10px 14px',
          borderRadius: '14px',
          border: '1px solid var(--glass-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#0284c7', fontWeight: '800' }}>
            <span>🔍</span>
            <span>Dica: Use os sliders de zoom em cada foto e clique-e-arraste para focalizar no leito da lesão.</span>
          </div>

          {/* Sync vs Individual Toggle Track */}
          <div className="irec-compare-toggle-track" style={{
            display: 'flex',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            padding: '3px',
            borderRadius: '30px',
            border: '1px solid rgba(2, 132, 199, 0.2)'
          }}>
            <button
              type="button"
              onClick={() => setIsSyncMode(true)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: isSyncMode ? '#0284c7' : 'transparent',
                color: isSyncMode ? '#ffffff' : '#0284c7',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSyncMode ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none'
              }}
            >
              🔗 Sincronizar Zooms
            </button>
            <button
              type="button"
              onClick={() => setIsSyncMode(false)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: !isSyncMode ? '#0284c7' : 'transparent',
                color: !isSyncMode ? '#ffffff' : '#0284c7',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: !isSyncMode ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none'
              }}
            >
              🔍 Zooms Independentes
            </button>
          </div>
        </div>

        {/* Side by Side Image Comparison Grid */}
        <div className="irec-compare-photos-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Photo A Panel */}
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '16px',
            padding: '14px',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0284c7' }}>
                📅 DATA: {entryA?.date || 'N/I'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7' }}>
                Área: {areaA !== null ? `${areaA} cm²` : 'N/A'}
              </span>
            </div>

            {/* Interactive Drag-to-Pan Container Image A */}
            <div 
              className="irec-compare-image-container"
              onMouseDown={handleMouseDownA}
              onMouseMove={handleMouseMoveA}
              onMouseUp={handleMouseUpA}
              onMouseLeave={handleMouseUpA}
              style={{
                width: '100%',
                height: '240px',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                position: 'relative',
                cursor: zoomA > 1 ? (isDraggingA ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none'
              }}
            >
              <img
                src={entryA?.photo || NEUTRAL_COMPARE_PLACEHOLDER}
                alt="Foto Anterior"
                onError={(e) => { e.target.src = NEUTRAL_COMPARE_PLACEHOLDER; }}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: `translate(${panA.x}px, ${panA.y}px) scale(${zoomA})`,
                  transition: isDraggingA ? 'none' : 'transform 0.2s ease',
                  pointerEvents: 'none'
                }}
              />
              {zoomA > 1 && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(2, 132, 199, 0.9)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '3px 10px',
                  borderRadius: '50px',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  ✋ Arraste p/ Mover ({zoomA.toFixed(1)}x)
                </div>
              )}
            </div>

            {/* ALWAYS-VISIBLE Individual Zoom Slider A */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '6px 10px', backgroundColor: 'rgba(2, 132, 199, 0.08)', borderRadius: '10px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', whiteSpace: 'nowrap' }}>Zoom Foto A:</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={zoomA}
                onChange={e => handleZoomChange(Number(e.target.value), 'A')}
                style={{ flex: 1, accentColor: '#0284c7' }}
              />
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', minWidth: '34px', textAlign: 'right' }}>{zoomA.toFixed(1)}x</span>
            </div>

            <div style={{ width: '100%', fontSize: '12px', color: 'var(--text-primary)' }}>
              <div><strong style={{ color: '#0284c7' }}>Estágio:</strong> <span style={{ fontWeight: '700' }}>{entryA?.lesionStage || 'Não especificado'}</span></div>
              <div><strong style={{ color: '#0284c7' }}>Exsudato:</strong> <span style={{ fontWeight: '700' }}>{entryA?.exudate || 'Normal'}</span></div>
              {entryA?.clinicalEvolution && (
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#0284c7' }}>Evolução:</strong> {entryA.clinicalEvolution}
                </div>
              )}
            </div>
          </div>

          {/* Photo B Panel */}
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '16px',
            padding: '14px',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#10b981' }}>
                📅 DATA: {entryB?.date || 'N/I'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7' }}>
                Área: {areaB !== null ? `${areaB} cm²` : 'N/A'}
              </span>
            </div>

            {/* Interactive Drag-to-Pan Container Image B */}
            <div 
              className="irec-compare-image-container"
              onMouseDown={handleMouseDownB}
              onMouseMove={handleMouseMoveB}
              onMouseUp={handleMouseUpB}
              onMouseLeave={handleMouseUpB}
              style={{
                width: '100%',
                height: '240px',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                position: 'relative',
                cursor: zoomB > 1 ? (isDraggingB ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none'
              }}
            >
              <img
                src={entryB?.photo || NEUTRAL_COMPARE_PLACEHOLDER}
                alt="Foto Atual"
                onError={(e) => { e.target.src = NEUTRAL_COMPARE_PLACEHOLDER; }}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: `translate(${panB.x}px, ${panB.y}px) scale(${zoomB})`,
                  transition: isDraggingB ? 'none' : 'transform 0.2s ease',
                  pointerEvents: 'none'
                }}
              />
              {zoomB > 1 && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.9)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '3px 10px',
                  borderRadius: '50px',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  ✋ Arraste p/ Mover ({zoomB.toFixed(1)}x)
                </div>
              )}
            </div>

            {/* ALWAYS-VISIBLE Individual Zoom Slider B */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '6px 10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', whiteSpace: 'nowrap' }}>Zoom Foto B:</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={zoomB}
                onChange={e => handleZoomChange(Number(e.target.value), 'B')}
                style={{ flex: 1, accentColor: '#10b981' }}
              />
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#10b981', minWidth: '34px', textAlign: 'right' }}>{zoomB.toFixed(1)}x</span>
            </div>

            <div style={{ width: '100%', fontSize: '12px', color: 'var(--text-primary)' }}>
              <div><strong style={{ color: '#0284c7' }}>Estágio:</strong> <span style={{ fontWeight: '700' }}>{entryB?.lesionStage || 'Não especificado'}</span></div>
              <div><strong style={{ color: '#0284c7' }}>Exsudato:</strong> <span style={{ fontWeight: '700' }}>{entryB?.exudate || 'Normal'}</span></div>
              {entryB?.clinicalEvolution && (
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#0284c7' }}>Evolução:</strong> {entryB.clinicalEvolution}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. FIXED FOOTER LAYER */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid var(--glass-border)',
        backgroundColor: 'rgba(2, 132, 199, 0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <button
          type="button"
          onClick={handleResetFocal}
          style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '30px',
            padding: '9px 24px',
            fontSize: '12.5px',
            fontWeight: '800',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🎯</span>
          <span>Resetar Foco & Zoom (Ambas as Fotos)</span>
        </button>
      </div>
    </div>
  );

  if (embeddedMode) return innerContent;

  return createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        margin: 0,
        boxSizing: 'border-box'
      }}
    >
      {innerContent}
    </div>,
    document.body
  );
}
