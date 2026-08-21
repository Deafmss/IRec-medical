import { describe, it, expect } from 'vitest';
import {
  SUBESCALAS,
  subescalasVazias,
  calcularTotal,
  classificar,
  avaliarBraden,
  exigePrevencao,
  NAO_AVALIADO
} from '../services/bradenScale';
import {
  classifyContingency,
  buscarComNegacao,
  NIVEIS
} from '../services/contingencyTriage';

describe('Escala de Braden — limiares de Bergstrom', () => {
  it('classifica <= 9 como risco MUITO ALTO — faixa que o codigo antigo perdia', () => {
    // Antes, tudo <= 12 caía num único "Atenção Elevada", apagando a distinção
    // entre risco alto e muito alto.
    expect(classificar(6).nivel).toBe('muito_alto');
    expect(classificar(9).nivel).toBe('muito_alto');
  });

  it('classifica 10-12 como risco alto', () => {
    expect(classificar(10).nivel).toBe('alto');
    expect(classificar(12).nivel).toBe('alto');
  });

  it('classifica 13-14 como risco moderado', () => {
    expect(classificar(13).nivel).toBe('moderado');
    expect(classificar(14).nivel).toBe('moderado');
  });

  it('classifica 15-18 como risco BAIXO, nao como "Bom / cuidados convencionais"', () => {
    // O rótulo antigo retirava a indicação preventiva de uma faixa que a exige.
    [15, 16, 17, 18].forEach((t) => {
      expect(classificar(t).nivel).toBe('baixo');
      expect(classificar(t).rotulo).toMatch(/risco baixo/i);
      expect(classificar(t).rotulo).not.toMatch(/bom|convencional/i);
      expect(exigePrevencao(classificar(t).nivel)).toBe(true);
    });
  });

  it('classifica 19-23 como sem risco', () => {
    expect(classificar(19).nivel).toBe('sem_risco');
    expect(classificar(23).nivel).toBe('sem_risco');
    expect(exigePrevencao('sem_risco')).toBe(false);
  });

  it('toda faixa de risco exige medida preventiva', () => {
    ['muito_alto', 'alto', 'moderado', 'baixo'].forEach((n) => {
      expect(exigePrevencao(n)).toBe(true);
    });
  });
});

describe('Escala de Braden — instrumento', () => {
  it('tem as seis sub-escalas, com friccao indo so ate 3', () => {
    expect(SUBESCALAS).toHaveLength(6);
    expect(SUBESCALAS.map((s) => s.chave)).toEqual(
      ['sensorial', 'umidade', 'atividade', 'mobilidade', 'nutricao', 'friccao']
    );
    const soma = SUBESCALAS.reduce((acc, s) => acc + s.max, 0);
    expect(soma).toBe(23);
    expect(SUBESCALAS.find((s) => s.chave === 'friccao').max).toBe(3);
  });
});

describe('Escala de Braden — nao afirmar sem avaliar', () => {
  it('comeca com todas as sub-escalas nulas', () => {
    const vazio = subescalasVazias();
    expect(Object.values(vazio).every((v) => v === null)).toBe(true);
  });

  it('avaliacao vazia devolve "Nao avaliado", nao "sem risco"', () => {
    // O padrão antigo era 4,4,4,4,4,3 = 23, então não preencher produzia
    // "Excelente — Pele Protegida": uma afirmação clínica sem avaliação.
    const r = avaliarBraden(subescalasVazias());
    expect(r.nivel).toBe('nao_avaliado');
    expect(r.total).toBeNull();
    expect(r.faltando).toHaveLength(6);
  });

  it('avaliacao parcial nao produz total', () => {
    const r = avaliarBraden({ sensorial: 2, umidade: 2, atividade: 2 });
    expect(r.total).toBeNull();
    expect(r.nivel).toBe('nao_avaliado');
    expect(r.faltando).toHaveLength(3);
  });

  it('soma quando as seis estao preenchidas', () => {
    const r = avaliarBraden({
      sensorial: 1, umidade: 1, atividade: 1, mobilidade: 1, nutricao: 1, friccao: 1
    });
    expect(r.total).toBe(6);
    expect(r.nivel).toBe('muito_alto');
  });

  it('respeita o maximo de cada sub-escala: friccao vai so ate 3', () => {
    const r = calcularTotal({
      sensorial: 4, umidade: 4, atividade: 4, mobilidade: 4, nutricao: 4, friccao: 4
    });
    expect(r.total).toBeNull();
    expect(r.faltando).toContain('Fricção e cisalhamento');
  });

  it('total maximo valido e 23', () => {
    const r = calcularTotal({
      sensorial: 4, umidade: 4, atividade: 4, mobilidade: 4, nutricao: 4, friccao: 3
    });
    expect(r.total).toBe(23);
  });

  it('recusa valor fora da faixa e string vazia', () => {
    expect(calcularTotal({ ...subescalasVazias(), sensorial: 0 }).total).toBeNull();
    expect(calcularTotal({ ...subescalasVazias(), sensorial: '' }).total).toBeNull();
  });

  it('aceita numero em string, como vem de <select>', () => {
    const r = calcularTotal({
      sensorial: '3', umidade: '3', atividade: '3', mobilidade: '3', nutricao: '3', friccao: '2'
    });
    expect(r.total).toBe(17);
  });

  it('total fora da faixa do instrumento nao classifica', () => {
    expect(classificar(5)).toEqual(NAO_AVALIADO);
    expect(classificar(24)).toEqual(NAO_AVALIADO);
    expect(classificar(null)).toEqual(NAO_AVALIADO);
  });
});

describe('buscarComNegacao', () => {
  it('detecta o termo afirmado', () => {
    expect(buscarComNegacao('tem sangramento na ferida', ['sangr']))
      .toEqual({ presente: true, negado: false });
  });

  it('detecta negacao com "nao"', () => {
    expect(buscarComNegacao('nao tem sangramento', ['sangr']))
      .toEqual({ presente: true, negado: true });
  });

  it('detecta negacao com "sem"', () => {
    expect(buscarComNegacao('ferida limpa sem secrecao', ['secre']).negado).toBe(true);
  });

  it('detecta negacao a varias palavras de distancia', () => {
    expect(buscarComNegacao('nao tem nenhum sinal de sangramento', ['sangr']).negado).toBe(true);
  });

  it('uma afirmacao vence uma negacao no mesmo texto', () => {
    // "não tem odor, mas tem sangramento" — o sangramento está afirmado.
    const r = buscarComNegacao('nao tem odor mas tem sangramento ativo', ['sangr']);
    expect(r).toEqual({ presente: true, negado: false });
  });

  it('nao acha o que nao esta la', () => {
    expect(buscarComNegacao('ferida cicatrizando bem', ['sangr']))
      .toEqual({ presente: false, negado: false });
  });

  it('casa por prefixo: "sangra", "sangrando", "sangramento"', () => {
    ['a ferida sangra muito', 'esta sangrando', 'com sangramento'].forEach((t) => {
      expect(buscarComNegacao(t, ['sangr']).presente).toBe(true);
    });
  });
});

describe('Classificacao de contingencia — o defeito que gerava falso Critico', () => {
  it('"nao tem sangramento" NAO e mais Critico', () => {
    // Este era o defeito: /\b(sangramento|profundo|gordura)\b/ casava dentro de
    // "não tem sangramento" e a gravidade virava "Crítico".
    const r = classifyContingency({ freeText: 'nao tem sangramento nenhum', pain: 2 });
    expect(r.severity).toBe('Leve');
    expect(r.isRedirect).toBe(false);
  });

  it('"sem lesao profunda" NAO e mais Critico', () => {
    const r = classifyContingency({ freeText: 'ferida superficial, sem lesao profunda', pain: 1 });
    expect(r.severity).toBe('Leve');
  });

  it('"sangra muito" agora E detectado — antes escapava do regex', () => {
    // O regex antigo exigia a palavra exata "sangramento": "sangra muito"
    // passava como leve.
    const r = classifyContingency({ freeText: 'a ferida sangra muito', pain: 3 });
    expect(r.severity).toBe('Alto Risco');
  });

  it('campo estruturado de sangramento e Critico', () => {
    const r = classifyContingency({ structuredAnswers: { hasBleeding: true } });
    expect(r.severity).toBe('Crítico');
    expect(r.isRedirect).toBe(true);
    expect(r.specialist).toMatch(/pronto-socorro/i);
  });

  it('campo estruturado de profundidade e Critico', () => {
    expect(classifyContingency({ structuredAnswers: { isDeep: true } }).severity).toBe('Crítico');
  });

  it('sintoma sistemico relatado e Critico', () => {
    expect(classifyContingency({ freeText: 'estou com febre e tontura' }).severity).toBe('Crítico');
  });

  it('relato de necrose e Critico, e a negacao e respeitada', () => {
    expect(classifyContingency({ freeText: 'tem area escurecida' }).severity).toBe('Crítico');
    expect(classifyContingency({ freeText: 'nao tem area escurecida', pain: 1 }).severity).toBe('Leve');
  });
});

describe('Classificacao de contingencia — campos estruturados', () => {
  it('doenca arterial periferica e Critico', () => {
    expect(classifyContingency({ clinicalProfile: { hasPeripheralArterialDisease: true } }).severity)
      .toBe('Crítico');
  });

  it('diabetes com amputacao previa e Critico', () => {
    expect(classifyContingency({
      clinicalProfile: { hasDiabetes: true, hasAmputationHistory: true }
    }).severity).toBe('Crítico');
  });

  it('infeccao com dor intensa e Critico', () => {
    expect(classifyContingency({ infectionSigns: 'Purulento', pain: 9 }).severity).toBe('Crítico');
  });

  it('diabetes sozinho e Alto Risco', () => {
    expect(classifyContingency({ clinicalProfile: { hasDiabetes: true } }).severity).toBe('Alto Risco');
  });

  it('dor moderada e Risco Moderado', () => {
    expect(classifyContingency({ pain: 6 }).severity).toBe('Risco Moderado');
  });

  it('hipertensao sozinha nao eleva o risco de lesao', () => {
    // A versão anterior fazia `isHypertension || pain > 4` -> "Risco Moderado".
    // Hipertensão isolada não é fator de risco para lesão de pele.
    expect(classifyContingency({ clinicalProfile: { hasHypertension: true }, pain: 1 }).severity)
      .toBe('Leve');
  });

  it('sem nada preenchido e Leve, e explica por que', () => {
    const r = classifyContingency({});
    expect(r.severity).toBe('Leve');
    expect(r.reason).toMatch(/nenhum fator de risco/i);
  });

  it('a gravidade nunca desce: o maior fator vence', () => {
    const r = classifyContingency({
      clinicalProfile: { hasDiabetes: true, hasPeripheralArterialDisease: true },
      pain: 1
    });
    expect(r.severity).toBe('Crítico');
  });

  it('todo nivel devolvido esta na lista aceita pela coluna severity', () => {
    const casos = [
      {},
      { pain: 6 },
      { clinicalProfile: { hasDiabetes: true } },
      { structuredAnswers: { hasBleeding: true } }
    ];
    casos.forEach((c) => expect(NIVEIS).toContain(classifyContingency(c).severity));
  });
});

describe('Classificacao de contingencia — nao inventa medida', () => {
  it('nao devolve composicao tecidual fabricada', () => {
    // A versão anterior devolvia `granulacao: 60, epitelizacao: 40` por padrão e
    // o médico recebia isso como avaliação de tecido.
    const r = classifyContingency({ freeText: 'ferida com secrecao' });
    expect(r.aiTissueAnalysis).toBeNull();
  });

  it('nao devolve area, comprimento nem largura', () => {
    const r = classifyContingency({});
    expect(r.aiAreaCm2).toBeNull();
    expect(r.aiLengthCm).toBeNull();
    expect(r.aiWidthCm).toBeNull();
  });

  it('marca a proveniencia como contingencia', () => {
    expect(classifyContingency({}).analysisSource).toBe('contingency');
  });

  it('avisa que nao houve analise de imagem', () => {
    expect(classifyContingency({}).disclaimer).toMatch(/sem an[aá]lise da imagem/i);
  });

  it('explica quais fatores levaram a classificacao', () => {
    const r = classifyContingency({ clinicalProfile: { hasDiabetes: true }, pain: 9 });
    expect(r.reason).toMatch(/diabetes/i);
    expect(r.reason).toMatch(/dor intensa/i);
  });
});
