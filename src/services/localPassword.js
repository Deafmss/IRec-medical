// @ts-check
/**
 * Derivação de senha para o modo de contingência local.
 *
 * O QUE HAVIA ANTES
 *
 *     const passwordHash = btoa(`irec_salt_${password}`);
 *
 * `btoa` é codificação Base64, não hash: é reversível com uma linha
 * (`atob(hash).replace('irec_salt_','')`). E o login aceitava
 *
 *     u.passwordHash === inputHash || u.password === password
 *
 * ou seja, ainda casava senha em texto puro. Tudo isso em
 * `localStorage['irec_users']`, num aparelho possivelmente compartilhado.
 *
 * O modo de contingência é justamente o que roda quando o Supabase cai — não é
 * um caminho hipotético.
 *
 * O QUE FAZ AGORA
 *
 * PBKDF2-SHA256 via WebCrypto, com sal aleatório por usuário e 210.000
 * iterações (recomendação da OWASP para PBKDF2-HMAC-SHA256, 2023). Comparação
 * em tempo constante.
 *
 * Isto NÃO substitui o Supabase Auth. É o mínimo aceitável para uma senha que
 * precisa ser verificada offline, no próprio dispositivo.
 */

const ITERATIONS = 210000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const fromHex = (hex) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};

const derive = async (password, saltBytes) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return toHex(bits);
};

/**
 * Deriva a senha para armazenamento.
 * Formato: `pbkdf2$<iterações>$<sal em hex>$<derivação em hex>`
 */
export const hashLocalPassword = async (password) => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${hash}`;
};

/** Comparação em tempo constante, para o tempo de resposta não vazar informação. */
const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/**
 * Confere a senha contra o valor guardado.
 *
 * Aceita apenas o formato PBKDF2. Registro antigo (Base64 ou senha em texto
 * puro) é **recusado** de propósito: aceitá-lo manteria o furo aberto. O usuário
 * precisa refazer o cadastro local — o que é aceitável, porque é cadastro de
 * contingência, não a conta real.
 */
export const verifyLocalPassword = async (password, stored) => {
  if (!stored || typeof stored !== 'string') return false;

  const partes = stored.split('$');
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false;

  const iteracoes = parseInt(partes[1], 10);
  if (!Number.isFinite(iteracoes) || iteracoes < 1000) return false;

  try {
    const salt = fromHex(partes[2]);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: iteracoes, hash: 'SHA-256' },
      key,
      KEY_BITS
    );
    return timingSafeEqual(toHex(bits), partes[3]);
  } catch (err) {
    console.warn('[iRec] Falha ao verificar senha local:', err);
    return false;
  }
};

/** Um registro no formato antigo (Base64 ou texto puro) precisa ser refeito. */
export const isLegacyPasswordRecord = (stored) =>
  Boolean(stored) && !String(stored).startsWith('pbkdf2$');
