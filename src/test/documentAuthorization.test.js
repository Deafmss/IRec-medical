import { describe, it, expect } from 'vitest';
import {
  getDocumentIssueDenial,
  canIssueDocument,
  canPrescribeMedication
} from '../services/documentAuthorization';

const medico = { role: 'doctor', crm: 'CRM-123456-SP', name: 'Dra. Ana' };
const enfermeiro = { role: 'nurse', coren: 'COREN-99999-SP', name: 'Enf. Bruno' };
const paciente = { name: 'Maria Silva', cpf: '529.982.247-25' };

describe('Autorização de emissão de documento clínico', () => {
  describe('receita — ato privativo do médico', () => {
    it('libera para médico com registro e paciente com CPF', () => {
      expect(getDocumentIssueDenial('receita', medico, paciente)).toBeNull();
      expect(canIssueDocument('receita', medico, paciente)).toBe(true);
    });

    it('bloqueia enfermeiro, citando a Lei 12.842/2013', () => {
      const motivo = getDocumentIssueDenial('receita', enfermeiro, paciente);
      expect(motivo).toContain('privativo do médico');
      expect(motivo).toContain('12.842');
    });

    it('bloqueia paciente que tenta emitir para si', () => {
      const motivo = getDocumentIssueDenial('receita', { role: 'patient' }, paciente);
      expect(motivo).toContain('médicos e enfermeiros credenciados');
    });

    it('bloqueia admin — papel administrativo não é habilitação clínica', () => {
      expect(getDocumentIssueDenial('receita', { role: 'admin' }, paciente)).not.toBeNull();
    });

    it('bloqueia perfil sem papel definido', () => {
      expect(getDocumentIssueDenial('receita', undefined, paciente)).not.toBeNull();
      expect(getDocumentIssueDenial('receita', {}, paciente)).not.toBeNull();
    });
  });

  describe('atestado — médico e enfermeiro', () => {
    it('libera para enfermeiro com COREN', () => {
      expect(getDocumentIssueDenial('atestado', enfermeiro, paciente)).toBeNull();
    });

    it('libera para médico', () => {
      expect(getDocumentIssueDenial('atestado', medico, paciente)).toBeNull();
    });
  });

  describe('registro profissional', () => {
    it('bloqueia médico sem CRM', () => {
      const motivo = getDocumentIssueDenial('receita', { role: 'doctor' }, paciente);
      expect(motivo).toContain('CRM');
    });

    it('bloqueia enfermeiro sem COREN', () => {
      const motivo = getDocumentIssueDenial('atestado', { role: 'nurse' }, paciente);
      expect(motivo).toContain('COREN');
    });

    it('não aceita registro só com espaços', () => {
      expect(getDocumentIssueDenial('receita', { role: 'doctor', crm: '   ' }, paciente)).not.toBeNull();
    });
  });

  describe('identificação do paciente', () => {
    it('bloqueia paciente sem CPF', () => {
      const motivo = getDocumentIssueDenial('receita', medico, { name: 'Maria' });
      expect(motivo).toContain('CPF');
    });

    it('bloqueia CPF incompleto', () => {
      expect(getDocumentIssueDenial('receita', medico, { cpf: '123.456.789' })).not.toBeNull();
    });

    it('aceita CPF com ou sem máscara', () => {
      expect(getDocumentIssueDenial('receita', medico, { cpf: '52998224725' })).toBeNull();
    });
  });

  describe('canPrescribeMedication', () => {
    it('só médico', () => {
      expect(canPrescribeMedication(medico)).toBe(true);
      expect(canPrescribeMedication(enfermeiro)).toBe(false);
      expect(canPrescribeMedication({ role: 'admin' })).toBe(false);
      expect(canPrescribeMedication({ role: 'patient' })).toBe(false);
      expect(canPrescribeMedication(null)).toBe(false);
    });
  });
});
