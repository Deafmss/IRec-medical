// @ts-check
/**
 * Classificação de contingência — usada quando o motor de análise remoto não
 * responde.
 *
 * O QUE HAVIA ANTES, E POR QUE ERA PERIGOSO
 *
 *     const hasBleedingOrDeep = /\b(sangramento|profundo|gordura)\b/.test(text);
 *     if (... || hasBleedingOrDeep) { severity = "Crítico"; }
 *
 * Quem escrevia **"não tem sangramento"** era classificado como **Crítico**. A
 * negação só era tratada para necrose e pus, não aqui. Na direção oposta, quem
 * escrevia *"sangra muito"* não casava com `sangramento` e passava como leve.
 * Falso positivo e falso negativo, ambos determinísticos, num classificador de
 * gravidade clínica.
 *
 * O mesmo código ainda **inventava a composição tecidual** — `granulacao: 60,
 * epitelizacao: 40` por padrão — e entregava ao médico como avaliação, enquanto
 * o comentário logo acima dizia "IREC-0007: Do not generate fake random
 * measurements" e zerava as medidas. Contradição dentro da mesma função.
 *
 * O QUE MUDA
 *
 * 1. Casar palavra em texto livre não classifica gravidade clínica. O que
 *    decide agora são os **campos estruturados** que o formulário já coleta:
 *    comorbidades, sinais de infecção, dor, odor, e as respostas de sim/não do
 *    cartão de queixa. Texto livre entra apenas como sinal de alerta
 *    ADICIONAL — nunca reduz a gravidade, e passa por detecção de negação.
 *
 * 2. Nada de composição tecidual inventada: sem imagem analisada, o campo
 *    volta vazio. `analysisSource: 'contingency'` marca a proveniência para o
 *    prontuário poder distinguir isto de uma análise de IA.
 */

/** Níveis, do mais leve ao mais grave. Igual ao CHECK da coluna `severity`. */
export const NIVEIS = ['Leve', 'Risco Moderado', 'Alto Risco', 'Crítico'];

const maisGrave = (a, b) => (NIVEIS.indexOf(b) > NIVEIS.indexOf(a) ? b : a);

/**
 * Normaliza para comparação: sem acento, minúsculo, espaço único.
 * @param {string} s
 */
const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Palavras que negam o que vem depois. A lista cobre as formas que aparecem em
 * relato de paciente, incluindo as que o código anterior não tratava.
 */
const NEGACOES = [
  'nao', 'nunca', 'nenhum', 'nenhuma', 'sem', 'ausencia de', 'ausente',
  'nao tem', 'nao ha', 'nao apresenta', 'nao possui', 'nao sinto', 'nao senti',
  'negativo para', 'nega'
];

/**
 * Procura um termo levando a negação em conta.
 *
 * Regra: se houver uma palavra de negação nas 4 palavras anteriores ao termo,
 * a ocorrência é considerada negada. Quatro é o suficiente para "não tem
 * nenhum sinal de sangramento" e curto o bastante para não atravessar oração.
 *
 * @param {string} texto já normalizado
 * @param {string[]} termos
 * @returns {{presente: boolean, negado: boolean}}
 */
export const buscarComNegacao = (texto, termos) => {
  const palavras = texto.split(' ');
  let presente = false;
  let algumAfirmado = false;

  palavras.forEach((palavra, i) => {
    const casa = termos.some((t) => palavra.startsWith(t));
    if (!casa) return;
    presente = true;

    const janela = palavras.slice(Math.max(0, i - 4), i).join(' ');
    const negado = NEGACOES.some((n) => janela.includes(n));
    if (!negado) algumAfirmado = true;
  });

  return { presente, negado: presente && !algumAfirmado };
};

/** Termos de alerta em texto livre. Só ELEVAM a gravidade, nunca reduzem. */
const ALERTAS_TEXTO = {
  sangramento: ['sangr', 'hemorrag'],
  profundidade: ['profund', 'gordura', 'osso', 'tendao'],
  infeccao: ['pus', 'purulen', 'secre', 'abscesso'],
  necrose: ['necro', 'preto', 'escurecid', 'gangren'],
  sistemico: ['febre', 'calafrio', 'tontura', 'desmai', 'confus']
};

/**
 * Classificação de contingência.
 *
 * @param {object} params
 * @param {object} [params.clinicalProfile]
 * @param {number} [params.pain] 0-10
 * @param {boolean} [params.odor]
 * @param {string} [params.infectionSigns]
 * @param {string} [params.freeText] queixa em texto livre
 * @param {Record<string, unknown>} [params.structuredAnswers] respostas sim/não do cartão
 */
export const classifyContingency = ({
  clinicalProfile = {},
  pain,
  odor = false,
  infectionSigns = 'Nenhum',
  freeText = '',
  structuredAnswers = {}
} = {}) => {
  const perfil = clinicalProfile || {};
  const texto = normalizar(freeText);

  const dorNumerica = Number(pain);
  const dor = Number.isFinite(dorNumerica) ? dorNumerica : null;

  const temInfeccao = Boolean(infectionSigns) && infectionSigns !== 'Nenhum';
  const dorIntensa = dor !== null && dor >= 8;
  const dorModerada = dor !== null && dor >= 5;

  // --- campos estruturados: é o que decide ---
  const sangramentoDeclarado = structuredAnswers.hasBleeding === true;
  const profundidadeDeclarada = structuredAnswers.isDeep === true;

  // --- texto livre: sinal adicional, com negação tratada ---
  /** @type {string[]} */
  const alertasTexto = [];
  Object.entries(ALERTAS_TEXTO).forEach(([nome, termos]) => {
    const { presente, negado } = buscarComNegacao(texto, termos);
    if (presente && !negado) alertasTexto.push(nome);
  });

  let severity = 'Leve';
  /** @type {string[]} */
  const motivos = [];

  const elevar = (nivel, motivo) => {
    severity = maisGrave(severity, nivel);
    motivos.push(motivo);
  };

  // Crítico — encaminhamento imediato
  if (sangramentoDeclarado) elevar('Crítico', 'sangramento ativo informado no formulário');
  if (profundidadeDeclarada) elevar('Crítico', 'lesão com exposição de tecido profundo informada no formulário');
  if (perfil.hasPeripheralArterialDisease) elevar('Crítico', 'doença arterial periférica em ficha');
  if (perfil.hasDiabetes && perfil.hasAmputationHistory) elevar('Crítico', 'diabetes com histórico de amputação');
  if (temInfeccao && dorIntensa) elevar('Crítico', 'sinais de infecção com dor intensa');
  if (alertasTexto.includes('sistemico')) elevar('Crítico', 'relato de sintoma sistêmico (febre, tontura ou confusão)');
  if (alertasTexto.includes('necrose')) elevar('Crítico', 'relato de tecido necrótico');

  // Alto risco
  if (temInfeccao) elevar('Alto Risco', 'sinais de infecção registrados');
  if (dorIntensa) elevar('Alto Risco', 'dor intensa (>= 8)');
  if (odor) elevar('Alto Risco', 'odor na lesão');
  if (perfil.hasDiabetes) elevar('Alto Risco', 'diabetes em ficha');
  if (perfil.isSmoker) elevar('Alto Risco', 'tabagismo em ficha');
  if (alertasTexto.includes('sangramento')) elevar('Alto Risco', 'relato de sangramento');
  if (alertasTexto.includes('profundidade')) elevar('Alto Risco', 'relato de lesão profunda');
  if (alertasTexto.includes('infeccao')) elevar('Alto Risco', 'relato de secreção purulenta');

  // Moderado
  if (dorModerada) elevar('Risco Moderado', 'dor moderada (>= 5)');
  if (perfil.hasVenousInsufficiency) elevar('Risco Moderado', 'insuficiência venosa em ficha');
  if (perfil.isObese) elevar('Risco Moderado', 'obesidade em ficha');

  const isRedirect = severity === 'Crítico' || severity === 'Alto Risco';

  const specialist = severity === 'Crítico'
    ? 'Pronto-socorro / Cirurgia vascular'
    : (isRedirect ? 'Angiologia ou estomaterapia' : '');

  return {
    severity,
    isRedirect,
    specialist,
    reason: motivos.length
      ? `Classificação de contingência baseada em: ${motivos.join('; ')}.`
      : 'Nenhum fator de risco identificado nos campos preenchidos.',

    // Proveniência. Sem isto, o prontuário não distingue esta classificação de
    // uma análise de IA.
    analysisSource: 'contingency',

    // Sem imagem analisada não há medida nem composição tecidual. A versão
    // anterior devolvia `granulacao: 60, epitelizacao: 40` por padrão e o
    // médico recebia isso como avaliação de tecido.
    aiAreaCm2: null,
    aiLengthCm: null,
    aiWidthCm: null,
    aiTissueAnalysis: null,

    // Aviso obrigatório: o profissional precisa saber que isto não é análise
    // de imagem.
    disclaimer:
      'Classificação automática de contingência, feita apenas com os campos preenchidos no '
      + 'formulário — sem análise da imagem. Não substitui avaliação clínica.'
  };
};
