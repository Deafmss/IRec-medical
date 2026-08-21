// @ts-check
/**
 * Barramento de falhas da camada de dados.
 *
 * O padrão em supabaseService.js é `catch (err) { console.error(...); return []; }`.
 * Para a interface, erro de rede, RLS bloqueando ou tabela inexistente ficam
 * indistinguíveis de "não existe": o médico abre o prontuário, a leitura falha,
 * e a tela diz "sem registros". Num prontuário isso é perigoso — a conclusão de
 * que o paciente não tem histórico é clínica.
 *
 * Reescrever a assinatura de todas as funções de leitura seria uma mudança
 * grande e arriscada. Este barramento resolve o essencial com pouco: cada
 * `catch` registra aqui o que falhou, e a aplicação mostra um aviso. O valor de
 * retorno continua sendo `[]` — mas o usuário deixa de ler isso como "vazio".
 *
 * Não substitui a correção definitiva (cada leitura devolver
 * `{ data, error }`), mas fecha a lacuna que impede qualquer verificação.
 */

/**
 * Uma falha vale por este tempo. As telas releem a cada 10-30s (polling), então
 * uma leitura que voltou a funcionar simplesmente para de reportar e o aviso
 * desaparece por conta própria. Isso evita o problema oposto — aviso preso na
 * tela depois de o problema já ter passado — sem exigir que todas as funções de
 * leitura sinalizem sucesso explicitamente.
 */
export const FAILURE_TTL_MS = 45_000;

/**
 * `Date.now()` tem resolução de milissegundo: duas falhas no mesmo tique
 * empatavam e a ordenação caía na ordem de inserção, não na mais recente
 * primeiro. Esta sequência desempata.
 */
let seq = 0;

/** @type {Map<string, {operation: string, message: string, at: number, seq: number, count: number}>} */
const failures = new Map();

/** @type {Set<(list: Array) => void>} */
const listeners = new Set();

const notify = () => {
  const list = getDataFailures();
  listeners.forEach((fn) => {
    try {
      fn(list);
    } catch (err) {
      console.error('[iRec dataFailureBus] Ouvinte lançou exceção:', err);
    }
  });
};

/**
 * Registra uma falha de leitura ou escrita.
 *
 * @param {string} operation nome legível da operação, ex.: 'prontuário do paciente'
 * @param {unknown} error
 */
export const reportDataFailure = (operation, error) => {
  // `error` chega como unknown: pode ser Error, pode ser o objeto do PostgREST
  // ({ code, message, details }), pode ser string. A guarda evita ler
  // propriedade de algo que não é objeto.
  const asObj = typeof error === 'object' && error !== null
    ? /** @type {Record<string, unknown>} */ (error)
    : null;
  const message = String(
    (asObj && (asObj.message || asObj.error_description || asObj.details))
    || error
    || 'erro desconhecido'
  );

  const existing = failures.get(operation);
  seq += 1;
  failures.set(operation, {
    operation,
    message,
    at: Date.now(),
    seq,
    count: existing ? existing.count + 1 : 1
  });

  console.error(`[iRec] Falha ao carregar "${operation}":`, error);
  notify();
};

/** Marca a operação como recuperada — some o aviso quando a leitura volta a funcionar. */
export const clearDataFailure = (operation) => {
  if (failures.delete(operation)) notify();
};

export const clearAllDataFailures = () => {
  if (failures.size === 0) return;
  failures.clear();
  notify();
};

/** Lista de falhas ainda dentro da janela de validade, mais recente primeiro. */
export const getDataFailures = () => {
  const limite = Date.now() - FAILURE_TTL_MS;
  return Array.from(failures.values())
    .filter((f) => f.at >= limite)
    .sort((a, b) => b.at - a.at || b.seq - a.seq);
};

/**
 * @param {(list: Array) => void} listener
 * @returns {() => void} função de cancelamento
 */
export const subscribeToDataFailures = (listener) => {
  listeners.add(listener);
  // Mesma proteção do `notify`: um ouvinte que lança não deve derrubar quem o
  // inscreveu, nem impedir os outros de receberem.
  try {
    listener(getDataFailures());
  } catch (err) {
    console.error('[iRec dataFailureBus] Ouvinte lançou exceção na inscrição:', err);
  }
  return () => listeners.delete(listener);
};

/**
 * Envolve uma leitura: em caso de erro registra a falha e devolve o fallback.
 * Substitui o `catch { return [] }` mantendo o mesmo contrato de retorno.
 *
 * @template T
 * @param {string} operation
 * @param {() => Promise<T>} run
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export const withFailureReport = async (operation, run, fallback) => {
  try {
    const result = await run();
    clearDataFailure(operation);
    return result;
  } catch (err) {
    reportDataFailure(operation, err);
    return fallback;
  }
};
