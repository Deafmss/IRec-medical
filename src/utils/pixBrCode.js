/**
 * Geração de BR Code (PIX estático) conforme o Manual de Padrões para Iniciação
 * do PIX do Banco Central — payload EMV®QRCPS-MPM.
 *
 * O código anterior era uma string concatenada à mão, com dois defeitos que
 * impediam qualquer app bancário de ler o QR:
 *
 *   1. o campo 54 (valor) saía como `540` + `250.00`, sem o comprimento — o
 *      parser TLV quebrava a partir daí;
 *   2. o campo 63 (CRC) era a literal `6304`, sem os 4 dígitos hexadecimais
 *      de checksum.
 *
 * Aqui cada campo é montado como ID + comprimento (2 dígitos) + valor, e o CRC
 * é calculado sobre o payload inteiro, incluindo o prefixo `6304`.
 */

/** ID + comprimento em 2 dígitos + valor. */
const tlv = (id, value) => {
  const v = String(value);
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
};

/**
 * CRC-16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF, sem reflexão e sem XOR
 * final) — é o que o padrão do BR Code exige no campo 63.
 *
 * @param {string} str
 * @returns {number} inteiro de 16 bits
 */
export const crc16 = (str) => {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc;
};

/**
 * O BR Code trafega em ASCII. Acento em nome de recebedor ou cidade faz
 * leitor de banco recusar o payload, então normalizamos antes.
 */
const toAscii = (str, maxLength) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^ -~]/g, '')
    .trim()
    .slice(0, maxLength)
    .trim();

/**
 * Monta o payload completo do PIX estático.
 *
 * @param {object} params
 * @param {string} params.key chave PIX do recebedor
 * @param {string} params.name nome do recebedor (truncado em 25, como o padrão exige)
 * @param {string} params.city cidade do recebedor (truncada em 15)
 * @param {number} [params.amount] valor em reais; omitido deixa o pagador definir
 * @param {string} [params.txid] identificador da transação; `***` quando não há
 * @returns {string} payload pronto para virar QR ou código copia-e-cola
 */
export const buildPixPayload = ({ key, name, city, amount, txid = '***' }) => {
  const pixKey = toAscii(key, 77);
  if (!pixKey) {
    throw new Error('Chave PIX ausente: não é possível gerar o código de pagamento.');
  }

  const merchantAccount =
    tlv('00', 'BR.GOV.BCB.PIX') +
    tlv('01', pixKey);

  let payload =
    tlv('00', '01') +                              // Payload Format Indicator
    tlv('26', merchantAccount) +                   // Merchant Account Information
    tlv('52', '0000') +                            // Merchant Category Code
    tlv('53', '986');                              // Moeda: BRL

  // Valor é opcional no padrão. Só entra se for um número positivo — mandar
  // "NaN" ou "0.00" faz o app do banco recusar.
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  if (Number.isFinite(numericAmount) && numericAmount > 0) {
    payload += tlv('54', numericAmount.toFixed(2));
  }

  payload +=
    tlv('58', 'BR') +                              // País
    tlv('59', toAscii(name, 25) || 'RECEBEDOR') +  // Nome do recebedor
    tlv('60', toAscii(city, 15) || 'BRASIL') +     // Cidade
    tlv('62', tlv('05', toAscii(txid, 25) || '***'));

  // O CRC é calculado sobre o payload já com o prefixo "6304" no fim.
  const withCrcPrefix = `${payload}6304`;
  const checksum = crc16(withCrcPrefix).toString(16).toUpperCase().padStart(4, '0');

  return `${withCrcPrefix}${checksum}`;
};

/**
 * Percorre o payload como TLV. Usado nos testes e útil para depurar um código
 * recusado pelo banco.
 *
 * @param {string} payload
 * @returns {Record<string,string>} mapa id -> valor (nível raiz)
 */
export const parseBrCode = (payload) => {
  const out = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len)) break;
    out[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
};

/** Confere se o CRC declarado no fim do payload bate com o calculado. */
export const isValidBrCode = (payload) => {
  if (typeof payload !== 'string' || payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const declared = payload.slice(-4).toUpperCase();
  if (!body.endsWith('6304')) return false;
  return crc16(body).toString(16).toUpperCase().padStart(4, '0') === declared;
};
