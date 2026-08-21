import { describe, it, expect } from 'vitest';
import {
  parseClinicalDate,
  getEntryDate,
  compareEntryDates,
  isChronologicallyInverted,
  formatClinicalDate,
  daysBetweenEntries
} from '../utils/clinicalDate';
import { exportPatientToFHIR, exportObservationToFHIR, exportFHIRBundle } from '../services/fhirService';

describe('parseClinicalDate', () => {
  it('interpreta o formato pt-BR que a triagem gravava', () => {
    // `new Date("20/08/2026")` e Invalid Date: o parser espera MM/DD e nao
    // existe mes 20. Era a causa do comparador de evolucao quebrado.
    expect(new Date('20/08/2026').getTime()).toBeNaN();

    const d = parseClinicalDate('20/08/2026');
    expect(d).toBeInstanceOf(Date);
    expect(d.getDate()).toBe(20);
    expect(d.getMonth()).toBe(7); // agosto
    expect(d.getFullYear()).toBe(2026);
  });

  it('interpreta ISO sem deslocar o dia por fuso', () => {
    // `new Date('2026-08-20')` e meia-noite UTC; no Brasil (UTC-3) o dia local
    // volta para 19.
    const d = parseClinicalDate('2026-08-20');
    expect(d.getDate()).toBe(20);
    expect(d.getMonth()).toBe(7);
  });

  it('interpreta ISO com hora', () => {
    expect(parseClinicalDate('2026-08-20T13:45:00Z').getDate()).toBe(20);
  });

  it('aceita separador ponto e hifen no formato pt-BR', () => {
    expect(parseClinicalDate('20.08.2026').getDate()).toBe(20);
    expect(parseClinicalDate('20-08-2026').getDate()).toBe(20);
  });

  it('aceita dia e mes com um digito', () => {
    const d = parseClinicalDate('5/3/2026');
    expect(d.getDate()).toBe(5);
    expect(d.getMonth()).toBe(2);
  });

  it('devolve null em vez de Invalid Date', () => {
    // Invalid Date se propaga por comparacoes que retornam sempre false; null
    // obriga quem chama a tratar.
    expect(parseClinicalDate('')).toBeNull();
    expect(parseClinicalDate(null)).toBeNull();
    expect(parseClinicalDate(undefined)).toBeNull();
    expect(parseClinicalDate('sem data')).toBeNull();
    expect(parseClinicalDate({})).toBeNull();
  });

  it('rejeita data que transbordaria — 31/02 nao vira 03/03', () => {
    expect(parseClinicalDate('31/02/2026')).toBeNull();
    expect(parseClinicalDate('32/01/2026')).toBeNull();
    expect(parseClinicalDate('20/13/2026')).toBeNull();
  });

  it('passa Date adiante e rejeita Date invalido', () => {
    const d = new Date(2026, 7, 20);
    expect(parseClinicalDate(d)).toBe(d);
    expect(parseClinicalDate(new Date('xx'))).toBeNull();
  });
});

describe('getEntryDate', () => {
  it('prefere entryDate (ISO) sobre date (pt-BR)', () => {
    const d = getEntryDate({ entryDate: '2026-08-20', date: '01/01/2020' });
    expect(d.getFullYear()).toBe(2026);
  });

  it('cai para date quando nao ha entryDate', () => {
    expect(getEntryDate({ date: '20/08/2026' }).getDate()).toBe(20);
  });

  it('cai para createdAt em ultimo caso', () => {
    expect(getEntryDate({ createdAt: '2026-08-20T10:00:00Z' }).getDate()).toBe(20);
  });

  it('devolve null sem nenhuma data utilizavel', () => {
    expect(getEntryDate({})).toBeNull();
    expect(getEntryDate(null)).toBeNull();
  });
});

describe('isChronologicallyInverted — o aviso que nunca disparava', () => {
  const antigo = { date: '01/07/2026' };
  const novo = { date: '20/08/2026' };

  it('detecta a ordem invertida', () => {
    // Antes: NaN > NaN === false, sempre. O aviso nunca aparecia.
    expect(isChronologicallyInverted(novo, antigo)).toBe(true);
  });

  it('nao acusa quando a ordem esta certa', () => {
    expect(isChronologicallyInverted(antigo, novo)).toBe(false);
  });

  it('nao acusa quando as datas sao iguais', () => {
    expect(isChronologicallyInverted(antigo, { date: '01/07/2026' })).toBe(false);
  });

  it('devolve null quando alguma data e ilegivel — em vez de false silencioso', () => {
    expect(isChronologicallyInverted({ date: 'xx' }, novo)).toBeNull();
    expect(isChronologicallyInverted(novo, {})).toBeNull();
  });

  it('funciona misturando pt-BR e ISO', () => {
    expect(isChronologicallyInverted({ entryDate: '2026-08-20' }, { date: '01/07/2026' })).toBe(true);
  });
});

describe('compareEntryDates e daysBetweenEntries', () => {
  it('ordena corretamente registros em pt-BR', () => {
    const entradas = [
      { date: '02/01/2026' },
      { date: '01/12/2025' },
      { date: '15/06/2026' }
    ];
    const ordenado = [...entradas].sort((a, b) => compareEntryDates(a, b) ?? 0);
    expect(ordenado.map((e) => e.date)).toEqual(['01/12/2025', '02/01/2026', '15/06/2026']);
  });

  it('ordenacao por string daria a ordem errada — e o que havia antes', () => {
    const porString = ['02/01/2026', '01/12/2025', '15/06/2026'].sort();
    expect(porString[0]).toBe('01/12/2025');
    // Mas com estas datas a ordenacao por string ja diverge:
    expect(['20/08/2026', '05/09/2025'].sort()[0]).toBe('05/09/2025');
    expect(['20/08/2026', '19/09/2025'].sort()[0]).toBe('19/09/2025');
  });

  it('conta o intervalo em dias', () => {
    expect(daysBetweenEntries({ date: '01/08/2026' }, { date: '20/08/2026' })).toBe(19);
  });

  it('devolve null quando nao da para comparar', () => {
    expect(compareEntryDates({}, { date: '20/08/2026' })).toBeNull();
    expect(daysBetweenEntries({}, {})).toBeNull();
  });
});

describe('formatClinicalDate', () => {
  it('formata em pt-BR', () => {
    expect(formatClinicalDate('2026-08-20')).toBe('20/08/2026');
  });

  it('devolve string vazia em vez de "Invalid Date"', () => {
    expect(formatClinicalDate('xx')).toBe('');
    expect(formatClinicalDate(null)).toBe('');
  });
});

describe('FHIR — nome do paciente', () => {
  it('usa o ULTIMO nome como sobrenome', () => {
    // Antes: family "Maria", given ["Silva","Santos"] — invertido, quebrando
    // exatamente a interoperabilidade que o FHIR existe para prover.
    const p = exportPatientToFHIR({ id: 'x', name: 'Maria Silva Santos' });
    expect(p.name[0].family).toBe('Santos');
    expect(p.name[0].given).toEqual(['Maria', 'Silva']);
  });

  it('nome unico vira family sem given', () => {
    const p = exportPatientToFHIR({ id: 'x', name: 'Maria' });
    expect(p.name[0].family).toBe('Maria');
    expect(p.name[0].given).toBeUndefined();
  });

  it('nao quebra com espacos extras', () => {
    const p = exportPatientToFHIR({ id: 'x', name: '  Ana   Paula  Souza  ' });
    expect(p.name[0].family).toBe('Souza');
    expect(p.name[0].given).toEqual(['Ana', 'Paula']);
  });
});

describe('FHIR — identificador e endereco', () => {
  it('inclui CPF como identifier oficial', () => {
    const p = exportPatientToFHIR({ id: 'x', name: 'A B', cpf: '529.982.247-25' });
    expect(p.identifier[0].value).toBe('52998224725');
    expect(p.identifier[0].system).toMatch(/cpf/);
  });

  it('inclui CNS quando existe', () => {
    const p = exportPatientToFHIR({ id: 'x', name: 'A B', cns: '123456789012345' });
    expect(p.identifier.some((i) => i.system.includes('cns'))).toBe(true);
  });

  it('omite identifier em vez de mandar valor invalido', () => {
    const p = exportPatientToFHIR({ id: 'x', name: 'A B', cpf: '123' });
    expect(p.identifier).toBeUndefined();
  });

  it('usa district, nao neighborhood — que nao existe em FHIR Address', () => {
    const p = exportPatientToFHIR({ id: 'x', name: 'A B', cep: '74000-000', neighborhood: 'Centro' });
    expect(p.address[0].district).toBe('Centro');
    expect(p.address[0].neighborhood).toBeUndefined();
  });
});

describe('FHIR — Observation', () => {
  const perfil = { id: 'p1', name: 'Maria Silva' };

  it('nao lanca com data em pt-BR', () => {
    // `new Date("20/08/2026").toISOString()` lanca RangeError e derrubava a
    // exportacao inteira.
    expect(() => exportObservationToFHIR(perfil, { id: 1, type: 'Ulcera', date: '20/08/2026' }))
      .not.toThrow();
  });

  it('grava a data correta', () => {
    const o = exportObservationToFHIR(perfil, { id: 1, type: 'Ulcera', date: '20/08/2026' });
    expect(o.effectiveDateTime.startsWith('2026-08-20')).toBe(true);
  });

  it('converte dor em string para numero', () => {
    const o = exportObservationToFHIR(perfil, { id: 1, type: 'X', date: '2026-08-20', pain: '7' });
    const dor = o.component.find((c) => c.code.text === 'Intensidade da Dor');
    expect(dor.valueInteger).toBe(7);
    expect(typeof dor.valueInteger).toBe('number');
  });

  it('dor invalida vira 0, nao string', () => {
    const o = exportObservationToFHIR(perfil, { id: 1, type: 'X', date: '2026-08-20', pain: 'muita' });
    const dor = o.component.find((c) => c.code.text === 'Intensidade da Dor');
    expect(dor.valueInteger).toBe(0);
  });

  it('bundle nao inclui recurso nulo', () => {
    const b = exportFHIRBundle(perfil, [{ id: 1, type: 'X', date: '2026-08-20' }]);
    expect(b.entry.every((e) => e.resource !== null)).toBe(true);
  });
});
