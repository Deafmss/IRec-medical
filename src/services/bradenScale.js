// @ts-check
/**
 * Escala de Braden — risco de lesão por pressão.
 *
 * DOIS PROBLEMAS CORRIGIDOS AQUI
 *
 * 1. **Limiares errados.** A classificação de Bergstrom, usada nas diretrizes
 *    brasileiras (SOBEST/SOBENDE), é:
 *
 *        <= 9    risco muito alto
 *        10-12   risco alto
 *        13-14   risco moderado
 *        15-18   risco baixo
 *        19-23   sem risco
 *
 *    O código anterior fazia:
 *
 *        <= 12   "Atenção Elevada"                  <- juntava muito alto e alto,
 *                                                      perdendo a faixa crítica
 *        <= 14   "Atenção Moderada"                 <- ok
 *        <= 18   "Bom (Cuidados Convencionais)"     <- 15-18 é RISCO BAIXO, e
 *                                                      chamar de "Bom / cuidados
 *                                                      convencionais" retira a
 *                                                      indicação preventiva
 *        >= 19   "Excelente (Pele Protegida)"       <- ok
 *
 * 2. **Padrão que afirma sem avaliar.** Os valores iniciais eram
 *    `4,4,4,4,4,3` = 23 = risco mínimo. Não preencher produzia uma afirmação
 *    clínica positiva ("Excelente — Pele Protegida") em vez de "não avaliado".
 *    Aqui as sub-escalas começam nulas e o resultado só existe quando as seis
 *    forem preenchidas.
 */

/**
 * Sub-escalas, na ordem do instrumento. `fricção` vai de 1 a 3; as outras, de
 * 1 a 4. Total possível: 6 a 23.
 */
export const SUBESCALAS = [
  { chave: 'sensorial', rotulo: 'Percepção sensorial', max: 4 },
  { chave: 'umidade', rotulo: 'Umidade da pele', max: 4 },
  { chave: 'atividade', rotulo: 'Atividade', max: 4 },
  { chave: 'mobilidade', rotulo: 'Mobilidade', max: 4 },
  { chave: 'nutricao', rotulo: 'Nutrição', max: 4 },
  { chave: 'friccao', rotulo: 'Fricção e cisalhamento', max: 3 }
];

export const TOTAL_MINIMO = 6;
export const TOTAL_MAXIMO = 23;

/** Estado inicial: nada avaliado. */
export const subescalasVazias = () =>
  Object.fromEntries(SUBESCALAS.map((s) => [s.chave, null]));

/**
 * Soma as sub-escalas.
 *
 * @param {Record<string, number|null|undefined|string>} sub
 * @returns {{total: number|null, faltando: string[]}} `total` é null enquanto
 *   houver sub-escala não preenchida — não se completa avaliação com padrão.
 */
export const calcularTotal = (sub) => {
  const faltando = [];
  let total = 0;

  SUBESCALAS.forEach(({ chave, rotulo, max }) => {
    const bruto = sub?.[chave];
    const valor = typeof bruto === 'number' ? bruto : Number(bruto);
    if (bruto === null || bruto === undefined || bruto === '' || !Number.isFinite(valor)) {
      faltando.push(rotulo);
      return;
    }
    // Fora da faixa do instrumento não conta: contaria como avaliação válida um
    // valor que o instrumento não define.
    if (valor < 1 || valor > max) {
      faltando.push(rotulo);
      return;
    }
    total += valor;
  });

  return { total: faltando.length === 0 ? total : null, faltando };
};

/**
 * Faixas de Bergstrom. A ordem importa: a primeira que casa vence.
 */
const FAIXAS = [
  {
    ate: 9,
    nivel: 'muito_alto',
    rotulo: 'Risco muito alto de lesão por pressão',
    conduta: 'Superfície de redistribuição de pressão, reposicionamento a cada 2h e avaliação nutricional.',
    cor: '#b91c1c'
  },
  {
    ate: 12,
    nivel: 'alto',
    rotulo: 'Risco alto de lesão por pressão',
    conduta: 'Reposicionamento a cada 2h, proteção de proeminências ósseas e controle de umidade.',
    cor: '#ef4444'
  },
  {
    ate: 14,
    nivel: 'moderado',
    rotulo: 'Risco moderado de lesão por pressão',
    conduta: 'Reposicionamento programado, hidratação da pele e atenção à umidade.',
    cor: '#f59e0b'
  },
  {
    ate: 18,
    nivel: 'baixo',
    // "Risco baixo" NÃO é "sem risco": mantém indicação preventiva. Era aqui que
    // a versão anterior escrevia "Bom (Cuidados Convencionais)".
    rotulo: 'Risco baixo de lesão por pressão',
    conduta: 'Manter medidas preventivas básicas e reavaliar a cada mudança de quadro.',
    cor: '#0284c7'
  },
  {
    ate: TOTAL_MAXIMO,
    nivel: 'sem_risco',
    rotulo: 'Sem risco identificado',
    conduta: 'Reavaliar se houver mudança de mobilidade, nutrição ou continência.',
    cor: '#10b981'
  }
];

/** Resultado exibido quando a avaliação está incompleta. */
export const NAO_AVALIADO = {
  nivel: 'nao_avaliado',
  rotulo: 'Não avaliado',
  conduta: 'Preencha as seis sub-escalas para obter a classificação de risco.',
  cor: '#64748b',
  total: null
};

/**
 * Classifica o total.
 *
 * @param {number|null} total
 */
export const classificar = (total) => {
  if (total === null || total === undefined || !Number.isFinite(total)) return NAO_AVALIADO;
  if (total < TOTAL_MINIMO || total > TOTAL_MAXIMO) return NAO_AVALIADO;
  const faixa = FAIXAS.find((f) => total <= f.ate);
  return { ...(faixa || FAIXAS[FAIXAS.length - 1]), total };
};

/**
 * Avalia as sub-escalas de uma vez.
 *
 * @param {Record<string, number|null|undefined|string>} sub
 */
export const avaliarBraden = (sub) => {
  const { total, faltando } = calcularTotal(sub);
  return { ...classificar(total), faltando };
};

/** Verdadeiro quando a faixa exige medida preventiva ativa. */
export const exigePrevencao = (nivel) =>
  ['muito_alto', 'alto', 'moderado', 'baixo'].includes(nivel);
