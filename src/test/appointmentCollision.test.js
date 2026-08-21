import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(process.cwd(), 'src', 'services', 'supabaseService.js'), 'utf-8');

/** Extrai o corpo de uma função nomeada, para asseverar sobre ela isoladamente. */
const corpoDe = (nome) => {
  const ini = src.indexOf(nome);
  if (ini === -1) throw new Error(`Função não encontrada: ${nome}`);
  const resto = src.slice(ini);
  const fim = resto.indexOf('\n};');
  return resto.slice(0, fim === -1 ? 2000 : fim);
};

describe('checkAppointmentCollision — não pode falhar aberta', () => {
  const corpo = corpoDe('export const checkAppointmentCollision');

  it('não devolve false num catch (a resposta antiga era "não há conflito")', () => {
    expect(corpo).not.toMatch(/catch[\s\S]{0,120}return false/);
  });

  it('propaga o erro quando não consegue consultar a agenda', () => {
    expect(corpo).toContain('throw new Error');
    expect(corpo).toContain('Não foi possível verificar a agenda');
  });

  it('registra a falha no barramento para a interface avisar', () => {
    expect(corpo).toContain('reportDataFailure');
  });

  it('usa a leitura estrita, não a tolerante que devolve o cache local', () => {
    expect(corpo).toContain('fetchDoctorAppointmentsRemote');
    expect(corpo).not.toContain('await getDoctorAppointments(');
  });

  it('em modo de contingência confere a agenda local em vez de bloquear tudo', () => {
    expect(corpo).toContain('!isSupabaseConfigured');
    expect(corpo).toContain('getLocalAppointments');
  });
});

describe('leitura da agenda — vazio não é erro', () => {
  it('não usa mais a condição que juntava erro, vazio e cheio', () => {
    // Era: if (!error && data && data.length > 0) { ...remoto } ... return localApps
    // Uma agenda remota legitimamente vazia caía no localStorage do dispositivo.
    expect(src).not.toMatch(/if \(!error && data && data\.length > 0\) \{/);
  });

  it('a leitura estrita lança quando o PostgREST devolve error', () => {
    const corpo = corpoDe('const fetchDoctorAppointmentsRemote');
    expect(corpo).toContain('if (error) {');
    expect(corpo).toContain('throw error;');
  });

  it('a leitura estrita devolve lista vazia sem cair no cache local', () => {
    const corpo = corpoDe('const fetchDoctorAppointmentsRemote');
    expect(corpo).toContain('return (data || []).map(mapAppointmentRow)');
    expect(corpo).not.toContain('getLocalAppointments');
  });
});

describe('createAppointment — não declara sucesso sem gravar', () => {
  const corpo = corpoDe('export const createAppointment');

  it('propaga erro quando a gravação remota falha, em vez de console.warn', () => {
    expect(corpo).not.toContain("console.warn('[iRec] Aviso ao salvar agendamento");
    expect(corpo).toContain('throw erro');
  });

  it('avisa explicitamente que o profissional não foi notificado', () => {
    expect(corpo).toContain('NÃO foi notificado');
  });

  it('marca no registro se chegou ao servidor', () => {
    expect(corpo).toContain('syncedToServer');
  });

  it('não grava payment_status "paid" por omissão', () => {
    expect(corpo).not.toContain("appointmentData.paymentStatus || 'paid'");
    expect(corpo).toContain("appointmentData.paymentStatus || 'pending'");
  });
});

describe('catches de leitura registram no barramento', () => {
  const operacoesEsperadas = [
    'histórico de feridas do paciente',
    'documentos do paciente',
    'mensagens do chat',
    'pacientes acompanhados',
    'lista de pacientes',
    'trilha de auditoria',
    'perfil clínico'
  ];

  operacoesEsperadas.forEach((op) => {
    it(`reporta falha de "${op}"`, () => {
      expect(src).toContain(`reportDataFailure('${op}'`);
    });
  });

  it('importa o barramento', () => {
    expect(src).toContain("from './dataFailureBus'");
  });
});
