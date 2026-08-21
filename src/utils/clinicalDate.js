// @ts-check
/**
 * Interpretação de data de registro clínico.
 *
 * O PROBLEMA
 *
 * A triagem gravava `date: new Date().toLocaleDateString('pt-BR')`, ou seja
 * `"20/08/2026"`. O comparador de evolução fazia `new Date(entry.date)` —
 * e `new Date("20/08/2026")` é **Invalid Date** em todos os navegadores, porque
 * o parser espera MM/DD/AAAA e não existe mês 20.
 *
 * Consequência direta: `isChronologicalInverted = dateA > dateB` virava
 * `NaN > NaN`, que é **sempre false**. O aviso de "comparação em ordem
 * invertida" (IREC-0383) nunca aparecia, e o médico podia comparar a foto nova
 * com a antiga na ordem trocada e ler "30% de redução" quando a ferida havia
 * piorado. Sinal clínico invertido.
 *
 * O QUE ESTE MÓDULO FAZ
 *
 * Interpreta os formatos que existem no banco hoje, sem depender do parser
 * permissivo do navegador:
 *
 *   "20/08/2026"            pt-BR, o que a triagem gravava
 *   "2026-08-20"            ISO, o que passa a gravar (`entryDate`)
 *   "2026-08-20T13:45:00Z"  ISO com hora, como `created_at`
 *
 * Devolve `null` quando não dá para interpretar — em vez de um Invalid Date que
 * se propaga silenciosamente por comparações que retornam sempre false.
 */

/**
 * @param {unknown} valor
 * @returns {Date|null}
 */
export const parseClinicalDate = (valor) => {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number' && Number.isFinite(valor)) return new Date(valor);
  if (typeof valor !== 'string') return null;

  const texto = valor.trim();
  if (!texto) return null;

  // ISO com ou sem hora. Construído por componentes para não pegar o
  // deslocamento de fuso que `new Date('2026-08-20')` aplica (meia-noite UTC).
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // pt-BR: DD/MM/AAAA, com barra, ponto ou hífen.
  const ptbr = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (ptbr) {
    const dia = Number(ptbr[1]);
    const mes = Number(ptbr[2]);
    const ano = Number(ptbr[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    const d = new Date(ano, mes - 1, dia);
    // Rejeita data que "transbordou" — 31/02 viraria 03/03.
    if (d.getDate() !== dia || d.getMonth() !== mes - 1) return null;
    return d;
  }

  return null;
};

/**
 * Data do registro, preferindo o campo ISO e caindo para os antigos.
 *
 * @param {{entryDate?: unknown, date?: unknown, createdAt?: unknown}|null|undefined} entry
 * @returns {Date|null}
 */
export const getEntryDate = (entry) =>
  parseClinicalDate(entry?.entryDate)
  || parseClinicalDate(entry?.date)
  || parseClinicalDate(entry?.createdAt);

/**
 * Compara dois registros pela data.
 *
 * @returns {number|null} negativo se A antecede B, positivo se sucede, 0 se
 *   mesma data. **null quando alguma das datas não pôde ser interpretada** —
 *   quem chama tem de tratar esse caso em vez de receber um `false` silencioso.
 */
export const compareEntryDates = (a, b) => {
  const da = getEntryDate(a);
  const db = getEntryDate(b);
  if (!da || !db) return null;
  return da.getTime() - db.getTime();
};

/**
 * A comparação está em ordem invertida (A é mais novo que B)?
 *
 * @returns {boolean|null} null quando não foi possível determinar.
 */
export const isChronologicallyInverted = (a, b) => {
  const cmp = compareEntryDates(a, b);
  if (cmp === null) return null;
  return cmp > 0;
};

/** Formata para exibição em pt-BR. Devolve string vazia se não der. */
export const formatClinicalDate = (valor) => {
  const d = parseClinicalDate(valor);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR');
};

/** Intervalo em dias entre dois registros, ou null. */
export const daysBetweenEntries = (a, b) => {
  const cmp = compareEntryDates(a, b);
  if (cmp === null) return null;
  return Math.round(Math.abs(cmp) / 86400000);
};
