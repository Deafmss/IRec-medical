import { describe, it, expect } from 'vitest';

export function validatePatientCpfForMedicalDoc(patientProfile) {
  const cleanCpf = (patientProfile?.cpf || '').replace(/\D/g, '');
  if (!cleanCpf || cleanCpf.length !== 11) {
    return {
      valid: false,
      error: 'É obrigatório que o cadastro do paciente contenha um CPF válido (11 dígitos) para a emissão de documentos médicos oficiais.'
    };
  }
  return { valid: true, error: null };
}

describe('PrescriptionGeneratorModal - Validação de CPF do Paciente', () => {
  it('deve rejeitar a emissão se o paciente tiver CPF nulo ou ausente', () => {
    const res = validatePatientCpfForMedicalDoc({ name: 'Maria Silva', cpf: null });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('CPF válido (11 dígitos)');
  });

  it('deve rejeitar a emissão se o CPF tiver menos de 11 dígitos', () => {
    const res = validatePatientCpfForMedicalDoc({ name: 'Maria Silva', cpf: '123.456.789' });
    expect(res.valid).toBe(false);
  });

  it('deve aprovar a emissão se o paciente possuir um CPF válido de 11 dígitos', () => {
    const res = validatePatientCpfForMedicalDoc({ name: 'Maria Silva', cpf: '123.456.789-01' });
    expect(res.valid).toBe(true);
    expect(res.error).toBeNull();
  });
});
