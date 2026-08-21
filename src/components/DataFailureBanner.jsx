import { useState, useEffect } from 'react';
import { subscribeToDataFailures, getDataFailures } from '../services/dataFailureBus';

/**
 * Aviso de falha na camada de dados.
 *
 * Existe para distinguir "não há registros" de "não foi possível ler". Sem ele,
 * uma leitura que falha aparece na tela como prontuário vazio, agenda vazia,
 * lista de pacientes vazia — e a conclusão que o profissional tira disso é
 * clínica.
 *
 * Fica fixo no topo porque a falha pode acontecer em qualquer aba, e some
 * sozinho quando as leituras voltam a funcionar (as telas releem por polling).
 */
export default function DataFailureBanner() {
  const [failures, setFailures] = useState([]);
  // Guarda o instante da falha que o usuário dispensou. Uma falha mais nova que
  // isso volta a mostrar o aviso; a mesma continua oculta.
  const [dismissedAt, setDismissedAt] = useState(0);

  useEffect(() => subscribeToDataFailures(setFailures), []);

  // `getDataFailures` já descarta o que passou da janela de validade. Reconsultar
  // periodicamente é o que faz o aviso sumir quando a última falha expira sem
  // novas ocorrências — e mantém `Date.now()` fora do render.
  useEffect(() => {
    if (failures.length === 0) return undefined;
    const id = setInterval(() => setFailures(getDataFailures()), 5000);
    return () => clearInterval(id);
  }, [failures.length]);

  const visiveis = failures.filter((f) => f.at > dismissedAt);
  if (visiveis.length === 0) return null;

  const principal = visiveis[0];
  const outras = visiveis.length - 1;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3000,
        backgroundColor: '#7f1d1d',
        color: '#fee2e2',
        borderBottom: '1px solid #ef4444',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        lineHeight: '1.45',
        fontFamily: 'var(--font-primary, sans-serif)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.35)'
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }} aria-hidden="true">⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: '#ffffff' }}>
          Não foi possível carregar {principal.operation}
          {outras > 0 && ` e mais ${outras} ${outras === 1 ? 'item' : 'itens'}`}.
        </strong>{' '}
        O que aparece na tela pode estar incompleto — <strong>não interprete como ausência
        de registros</strong>. Verifique a conexão e recarregue antes de tomar qualquer
        decisão clínica.
      </div>
      <button
        type="button"
        onClick={() => setDismissedAt(Date.now())}
        aria-label="Fechar aviso"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.35)',
          color: '#fee2e2',
          borderRadius: '8px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        Fechar
      </button>
    </div>
  );
}
