import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computeDocumentDigest,
  buildIntegrityRecord,
  verifyDocumentIntegrity,
  LEGAL_NOTICE_NO_ICP
} from '../services/documentIntegrity';

const medico = { name: 'Dra. Ana', crm: 'CRM-123456-SP' };

describe('computeDocumentDigest', () => {
  it('é determinístico para o mesmo conteúdo', async () => {
    const a = await computeDocumentDigest('receita', 'p1', { items: [{ name: 'Dipirona' }] });
    const b = await computeDocumentDigest('receita', 'p1', { items: [{ name: 'Dipirona' }] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9A-F]{32}$/);
  });

  it('muda quando o conteúdo muda — é o que torna o selo útil', async () => {
    const a = await computeDocumentDigest('receita', 'p1', { items: [{ name: 'Dipirona 500mg' }] });
    const b = await computeDocumentDigest('receita', 'p1', { items: [{ name: 'Dipirona 1g' }] });
    expect(a).not.toBe(b);
  });

  it('muda quando o paciente muda', async () => {
    const a = await computeDocumentDigest('receita', 'p1', { x: 1 });
    const b = await computeDocumentDigest('receita', 'p2', { x: 1 });
    expect(a).not.toBe(b);
  });

  it('muda quando o tipo muda', async () => {
    const a = await computeDocumentDigest('receita', 'p1', { x: 1 });
    const b = await computeDocumentDigest('atestado', 'p1', { x: 1 });
    expect(a).not.toBe(b);
  });
});

describe('buildIntegrityRecord — sem campo inventado', () => {
  it('não declara número de série: não existe certificado', async () => {
    const digest = await computeDocumentDigest('receita', 'p1', { x: 1 });
    const rec = buildIntegrityRecord({ digest, professional: medico });
    expect(rec.serial).toBeUndefined();
  });

  it('não declara autoridade certificadora', async () => {
    const digest = await computeDocumentDigest('receita', 'p1', { x: 1 });
    const rec = buildIntegrityRecord({ digest, professional: medico });
    expect(rec.authority).toBeUndefined();
    expect(JSON.stringify(rec)).not.toMatch(/AC ITI|AC Soluti|AC Serpro/);
  });

  it('marca explicitamente que não é assinatura ICP-Brasil', async () => {
    const digest = await computeDocumentDigest('receita', 'p1', { x: 1 });
    const rec = buildIntegrityRecord({ digest, professional: medico });
    expect(rec.isIcpBrasilSigned).toBe(false);
    expect(rec.signatureMethod).toMatch(/integridade/i);
    expect(rec.signatureMethod).not.toMatch(/ICP/);
  });

  it('registra quem emitiu, com o registro profissional real', async () => {
    const digest = await computeDocumentDigest('receita', 'p1', { x: 1 });
    const rec = buildIntegrityRecord({ digest, professional: medico });
    expect(rec.issuedBy).toEqual({ name: 'Dra. Ana', registry: 'CRM-123456-SP' });
  });

  it('devolve null sem resumo, em vez de um registro vazio', () => {
    expect(buildIntegrityRecord({ digest: null, professional: medico })).toBeNull();
  });
});

describe('verifyDocumentIntegrity — o selo tem de ser conferível', () => {
  it('confirma documento intacto', async () => {
    const conteudo = { items: [{ name: 'Dipirona' }] };
    const digest = await computeDocumentDigest('receita', 'p1', conteudo);
    const rec = buildIntegrityRecord({ digest, professional: medico });
    await expect(verifyDocumentIntegrity('receita', 'p1', conteudo, rec.hash)).resolves.toBe(true);
  });

  it('detecta alteração do conteúdo', async () => {
    const digest = await computeDocumentDigest('receita', 'p1', { items: [{ name: 'Dipirona' }] });
    const rec = buildIntegrityRecord({ digest, professional: medico });
    await expect(
      verifyDocumentIntegrity('receita', 'p1', { items: [{ name: 'Morfina' }] }, rec.hash)
    ).resolves.toBe(false);
  });

  it('devolve null quando não há selo a conferir', async () => {
    await expect(verifyDocumentIntegrity('receita', 'p1', {}, null)).resolves.toBeNull();
  });
});

describe('aviso legal', () => {
  it('diz que não vale para controlado, perícia nem INSS', () => {
    expect(LEGAL_NOTICE_NO_ICP).toMatch(/NÃO possui/);
    expect(LEGAL_NOTICE_NO_ICP).toMatch(/controlado/i);
    expect(LEGAL_NOTICE_NO_ICP).toMatch(/perícia/i);
    expect(LEGAL_NOTICE_NO_ICP).toMatch(/INSS/);
  });
});

/**
 * Remove comentários antes de asseverar: os docblocks destes arquivos citam o
 * texto falso que substituíram, e sem isso o teste casaria com a explicação em
 * vez do código.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('as telas não voltam a alegar assinatura ICP-Brasil', () => {
  const arquivos = [
    'src/components/DoctorDashboard.jsx',
    'src/components/PatientDocuments.jsx',
    'src/components/DocumentIntegritySeal.jsx'
  ];

  arquivos.forEach((rel) => {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf-8'));

    it(`${rel} não tem o selo "ASSINATURA DIGITAL VALIDADA"`, () => {
      expect(src).not.toContain('ASSINATURA DIGITAL VALIDADA');
    });

    it(`${rel} não invoca a MP 2.200-2 num documento sem certificado`, () => {
      expect(src).not.toMatch(/2\.200-2/);
      expect(src).not.toMatch(/infraestrutura de chaves p[uú]blicas credenciada/i);
    });

    it(`${rel} não fabrica número de série nem autoridade certificadora`, () => {
      expect(src).not.toMatch(/serial:\s*`BR-/);
      expect(src).not.toMatch(/AC ITI Federal|AC Soluti Multipla|AC Serpro e-CPF/);
    });
  });

  it('DoctorDashboard não pede mais PIN de certificado inexistente', () => {
    const src = stripComments(readFileSync(join(process.cwd(), 'src/components/DoctorDashboard.jsx'), 'utf-8'));
    expect(src).not.toContain('signaturePin');
    expect(src).not.toMatch(/senha PIN do seu Token USB/);
  });
});
