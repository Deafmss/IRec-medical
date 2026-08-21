import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildPublicProfessionalProfile,
  getProfessionalRegistry,
  getRegistryLabel
} from '../services/professionalProfile';

describe('buildPublicProfessionalProfile — só dado real', () => {
  const medico = {
    id: 'abc',
    name: 'Dra. Ana',
    role: 'doctor',
    crm: 'CRM-123456-SP',
    specialty: 'Dermatologia'
  };

  it('nunca inventa nota de avaliação', () => {
    const p = buildPublicProfessionalProfile(medico);
    expect(p.stats.rating).toBe('Novo');
    expect(p.stats.patients).toBe('0');
    expect(p.stats.successRate).toBe('-');
  });

  it('nunca inventa depoimento de paciente', () => {
    expect(buildPublicProfessionalProfile(medico).reviews).toEqual([]);
  });

  it('nunca inventa titulação acadêmica', () => {
    const p = buildPublicProfessionalProfile(medico);
    expect(p.education).toBe('CRM: CRM-123456-SP');
    expect(p.education).not.toMatch(/USP|UNICAMP|Doutorado|Residência|SBD|SOBEST/);
  });

  it('nunca inventa preço', () => {
    expect(buildPublicProfessionalProfile(medico).price).toBeNull();
  });

  it('preserva o preço quando existe no cadastro', () => {
    expect(buildPublicProfessionalProfile({ ...medico, price: 180 }).price).toBe(180);
    expect(buildPublicProfessionalProfile({ ...medico, consultationFee: 90 }).price).toBe(90);
  });

  it('preserva bio e formação escritas pelo próprio profissional', () => {
    const p = buildPublicProfessionalProfile({
      ...medico,
      bio: 'Atendo em Goiânia.',
      education: 'Medicina - UFG'
    });
    expect(p.bio).toBe('Atendo em Goiânia.');
    expect(p.education).toBe('Medicina - UFG');
  });

  it('diz que a apresentação está em branco em vez de escrever uma', () => {
    expect(buildPublicProfessionalProfile(medico).bio).toMatch(/não preencheu/i);
  });

  it('usa COREN no rótulo de enfermeiro', () => {
    const p = buildPublicProfessionalProfile({ role: 'nurse', crm: 'COREN-9999-GO' });
    expect(p.education).toBe('COREN: COREN-9999-GO');
  });

  it('não esconde a ausência de registro profissional', () => {
    expect(buildPublicProfessionalProfile({ role: 'doctor' }).education)
      .toMatch(/não informado/i);
  });

  it('usa a especialidade padrão só quando não há uma cadastrada', () => {
    expect(buildPublicProfessionalProfile({ role: 'doctor' }, { defaultSpecialty: 'Clínico Geral' }).specialty)
      .toBe('Clínico Geral');
    expect(buildPublicProfessionalProfile(medico).specialty).toBe('Dermatologia');
  });

  it('devolve null para entrada vazia', () => {
    expect(buildPublicProfessionalProfile(null)).toBeNull();
  });
});

describe('registro profissional', () => {
  it('lê de crm, que é onde CRM e COREN são gravados', () => {
    expect(getProfessionalRegistry({ crm: ' CRM-1 ' })).toBe('CRM-1');
  });

  it('não quebra sem registro', () => {
    expect(getProfessionalRegistry({})).toBe('');
    expect(getProfessionalRegistry(null)).toBe('');
  });

  it('rotula pelo papel', () => {
    expect(getRegistryLabel({ role: 'nurse' })).toBe('COREN');
    expect(getRegistryLabel({ role: 'doctor' })).toBe('CRM');
  });
});

describe('as três telas não voltam a fabricar dado', () => {
  const telas = [
    'src/components/SpecialistDirectory.jsx',
    'src/components/NursesNetwork.jsx',
    'src/components/Telemedicine.jsx'
  ];

  telas.forEach((rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf-8');

    it(`${rel} não tem nota nem volume inventados`, () => {
      expect(src).not.toMatch(/rating:\s*'4\.\d'/);
      expect(src).not.toMatch(/patients:\s*'\d+\+'/);
      expect(src).not.toMatch(/successRate:\s*'9\d/);
    });

    it(`${rel} não tem depoimento de paciente inventado`, () => {
      expect(src).not.toMatch(/reviews:\s*\[\s*\{/);
      expect(src).not.toContain('cicatrizou completamente');
    });

    it(`${rel} não tem titulação acadêmica inventada`, () => {
      expect(src).not.toMatch(/Doutorado em|Residência em [A-Z]|Membro Titular/);
    });

    it(`${rel} usa o perfil público centralizado`, () => {
      expect(src).toContain('buildPublicProfessionalProfile');
    });
  });
});
