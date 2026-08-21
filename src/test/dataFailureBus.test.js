import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  reportDataFailure,
  clearDataFailure,
  clearAllDataFailures,
  getDataFailures,
  subscribeToDataFailures,
  withFailureReport,
  FAILURE_TTL_MS
} from '../services/dataFailureBus';

describe('dataFailureBus', () => {
  beforeEach(() => {
    clearAllDataFailures();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('registra a falha com a mensagem do erro', () => {
    reportDataFailure('prontuário', new Error('conexão perdida'));
    const [f] = getDataFailures();
    expect(f.operation).toBe('prontuário');
    expect(f.message).toBe('conexão perdida');
    expect(f.count).toBe(1);
  });

  it('agrupa repetições da mesma operação', () => {
    reportDataFailure('prontuário', new Error('x'));
    reportDataFailure('prontuário', new Error('y'));
    reportDataFailure('prontuário', new Error('z'));
    const falhas = getDataFailures();
    expect(falhas).toHaveLength(1);
    expect(falhas[0].count).toBe(3);
    expect(falhas[0].message).toBe('z');
  });

  it('mantém operações distintas separadas, mais recente primeiro', () => {
    reportDataFailure('agenda', new Error('a'));
    reportDataFailure('prontuário', new Error('b'));
    const falhas = getDataFailures();
    expect(falhas.map((f) => f.operation)).toEqual(['prontuário', 'agenda']);
  });

  it('extrai mensagem de erro do PostgREST, que não é uma Error', () => {
    reportDataFailure('agenda', { code: 'PGRST205', message: 'Could not find the table' });
    expect(getDataFailures()[0].message).toBe('Could not find the table');
  });

  it('não quebra com erro sem mensagem', () => {
    reportDataFailure('agenda', null);
    expect(getDataFailures()[0].message).toBe('erro desconhecido');
  });

  it('clearDataFailure remove só a operação indicada', () => {
    reportDataFailure('agenda', new Error('a'));
    reportDataFailure('prontuário', new Error('b'));
    clearDataFailure('agenda');
    expect(getDataFailures().map((f) => f.operation)).toEqual(['prontuário']);
  });

  it('descarta falha que passou da janela de validade', () => {
    vi.useFakeTimers();
    reportDataFailure('agenda', new Error('a'));
    expect(getDataFailures()).toHaveLength(1);
    vi.advanceTimersByTime(FAILURE_TTL_MS + 1000);
    expect(getDataFailures()).toHaveLength(0);
  });

  it('notifica ouvintes na inscrição e a cada falha', () => {
    const visto = [];
    const cancelar = subscribeToDataFailures((lista) => visto.push(lista.length));
    expect(visto).toEqual([0]);

    reportDataFailure('agenda', new Error('a'));
    expect(visto).toEqual([0, 1]);

    cancelar();
    reportDataFailure('prontuário', new Error('b'));
    expect(visto).toEqual([0, 1]);
  });

  it('um ouvinte que lança não impede os outros', () => {
    const ok = vi.fn();
    subscribeToDataFailures(() => {
      throw new Error('ouvinte ruim');
    });
    subscribeToDataFailures(ok);
    reportDataFailure('agenda', new Error('a'));
    expect(ok).toHaveBeenCalled();
  });

  describe('withFailureReport', () => {
    it('devolve o resultado e limpa falha anterior quando dá certo', async () => {
      reportDataFailure('agenda', new Error('antiga'));
      const r = await withFailureReport('agenda', async () => [1, 2], []);
      expect(r).toEqual([1, 2]);
      expect(getDataFailures()).toHaveLength(0);
    });

    it('devolve o fallback e registra a falha quando dá erro', async () => {
      const r = await withFailureReport('agenda', async () => {
        throw new Error('falhou');
      }, []);
      expect(r).toEqual([]);
      expect(getDataFailures()[0].operation).toBe('agenda');
    });
  });
});
