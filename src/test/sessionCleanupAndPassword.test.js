import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearSensitiveSessionData,
  PREFERENCIAS_PRESERVADAS
} from '../services/sessionCleanup';
import {
  hashLocalPassword,
  verifyLocalPassword,
  isLegacyPasswordRecord
} from '../services/localPassword';

/** localStorage de mentira, com a API que a função usa. */
const criarStorage = (inicial = {}) => {
  const dados = { ...inicial };
  return {
    get length() {
      return Object.keys(dados).length;
    },
    key(i) {
      return Object.keys(dados)[i] ?? null;
    },
    getItem(k) {
      return k in dados ? dados[k] : null;
    },
    setItem(k, v) {
      dados[k] = String(v);
    },
    removeItem(k) {
      delete dados[k];
    },
    _dados: dados
  };
};

describe('clearSensitiveSessionData', () => {
  const chavesSensiveis = [
    'irec_local_wound_entries',
    'irec_chat_messages',
    'irec_chat_threads',
    'irec_chat_read_times',
    'irec_local_calls',
    'irec_assignments',
    'irec_local_assignments',
    'irec_log_acessos_prontuario',
    'irec_users',
    'irec_medical_documents',
    'irec_selected_patient',
    'irec_active_user',
    'irec_appointments',
    'irec_local_recommended_materials',
    'irec_geocode_cache_abc_rua_x',
    'irec_tcle_accepted_uuid-1'
  ];

  it('remove toda chave de dado clínico — inclusive as 9 que ficavam para trás', () => {
    const storage = criarStorage(Object.fromEntries(chavesSensiveis.map((k) => [k, 'x'])));
    const removidas = clearSensitiveSessionData(storage);
    expect(removidas.sort()).toEqual([...chavesSensiveis].sort());
    expect(storage.length).toBe(0);
  });

  it('preserva apenas preferência de interface', () => {
    const storage = criarStorage({
      'irec_ui_mode': 'accessible',
      'irec-sidebar-collapsed': 'true',
      'irec-theme-guest': 'dark',
      'irec_local_wound_entries': '[...]'
    });
    clearSensitiveSessionData(storage);
    expect(Object.keys(storage._dados).sort()).toEqual(
      ['irec-sidebar-collapsed', 'irec-theme-guest', 'irec_ui_mode']
    );
  });

  it('não toca em chave de outra aplicação no mesmo domínio', () => {
    const storage = criarStorage({ 'outro_app_token': 'abc', 'irec_users': 'x' });
    clearSensitiveSessionData(storage);
    expect(storage.getItem('outro_app_token')).toBe('abc');
    expect(storage.getItem('irec_users')).toBeNull();
  });

  it('apaga por padrão: chave nova de paciente não precisa ser cadastrada aqui', () => {
    // Lista de exclusão, não de remoção. Se alguém adicionar uma chave com dado
    // clínico e esquecer deste arquivo, o padrão é apagar — não vazar.
    const storage = criarStorage({ 'irec_alguma_coisa_nova_do_paciente': 'x' });
    clearSensitiveSessionData(storage);
    expect(storage.length).toBe(0);
  });

  it('a lista de preservadas não contém nada identificável', () => {
    [...PREFERENCIAS_PRESERVADAS].forEach((k) => {
      expect(k).not.toMatch(/user|patient|wound|chat|document|log|appointment|cert/i);
    });
  });

  it('não quebra com storage ausente', () => {
    expect(clearSensitiveSessionData(null)).toEqual([]);
  });
});

describe('senha do modo de contingência', () => {
  let hash;

  beforeEach(async () => {
    hash = await hashLocalPassword('SenhaForte#2026');
  });

  it('não é reversível — o btoa antigo era', () => {
    // atob(btoa('irec_salt_x')) devolvia a senha. Aqui a senha não aparece.
    expect(hash).not.toContain('SenhaForte');
    expect(() => atob(hash)).toThrow();
  });

  it('usa PBKDF2 com sal e contagem de iterações no próprio registro', () => {
    const [algo, iter, salt, derivado] = hash.split('$');
    expect(algo).toBe('pbkdf2');
    expect(Number(iter)).toBeGreaterThanOrEqual(210000);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(derivado).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sal diferente por usuário: senhas iguais geram registros diferentes', async () => {
    const outro = await hashLocalPassword('SenhaForte#2026');
    expect(outro).not.toBe(hash);
  });

  it('aceita a senha correta', async () => {
    await expect(verifyLocalPassword('SenhaForte#2026', hash)).resolves.toBe(true);
  });

  it('recusa senha errada', async () => {
    await expect(verifyLocalPassword('SenhaErrada', hash)).resolves.toBe(false);
    await expect(verifyLocalPassword('', hash)).resolves.toBe(false);
  });

  it('recusa registro no formato Base64 antigo', async () => {
    const antigo = btoa('irec_salt_SenhaForte#2026');
    expect(isLegacyPasswordRecord(antigo)).toBe(true);
    await expect(verifyLocalPassword('SenhaForte#2026', antigo)).resolves.toBe(false);
  });

  it('recusa senha guardada em texto puro', async () => {
    expect(isLegacyPasswordRecord('SenhaForte#2026')).toBe(true);
    await expect(verifyLocalPassword('SenhaForte#2026', 'SenhaForte#2026')).resolves.toBe(false);
  });

  it('recusa registro malformado ou com iterações fracas', async () => {
    await expect(verifyLocalPassword('x', null)).resolves.toBe(false);
    await expect(verifyLocalPassword('x', 'pbkdf2$abc$def')).resolves.toBe(false);
    await expect(verifyLocalPassword('x', 'pbkdf2$10$aabb$ccdd')).resolves.toBe(false);
  });

  it('reconhece o formato novo como não-legado', () => {
    expect(isLegacyPasswordRecord(hash)).toBe(false);
  });
});
