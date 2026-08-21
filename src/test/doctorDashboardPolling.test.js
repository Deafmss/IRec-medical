import { describe, it, expect } from 'vitest';

export async function simulateRaceConditionPolling(activePatientIdRef, targetPatientId, fetchPromise) {
  const docs = await fetchPromise;

  // Race condition check: verify if active patient hasn't changed during async call
  if (activePatientIdRef.current === targetPatientId) {
    const isUpdated = true;
    return { isUpdated, docs };
  }

  return { isUpdated: false, docs: null };
}

describe('DoctorDashboard - Proteção de Race Condition no Polling de Pacientes', () => {
  it('deve aceitar os dados se o paciente ativo continuar o mesmo após o término da requisição', async () => {
    const activePatientIdRef = { current: 'paciente-123' };
    const slowFetch = new Promise(resolve => setTimeout(() => resolve(['doc1', 'doc2']), 10));

    const res = await simulateRaceConditionPolling(activePatientIdRef, 'paciente-123', slowFetch);
    expect(res.isUpdated).toBe(true);
    expect(res.docs).toEqual(['doc1', 'doc2']);
  });

  it('deve descartar os dados se o médico alternar para outro paciente enquanto a requisição estava em andamento', async () => {
    const activePatientIdRef = { current: 'paciente-123' };
    
    // Simulate async request for paciente-123
    const slowFetch = new Promise(resolve => {
      setTimeout(() => {
        // Doctor switches to paciente-456 before request resolves
        activePatientIdRef.current = 'paciente-456';
        resolve(['doc-paciente-123']);
      }, 10);
    });

    const res = await simulateRaceConditionPolling(activePatientIdRef, 'paciente-123', slowFetch);
    expect(res.isUpdated).toBe(false);
    expect(res.docs).toBeNull();
  });
});
