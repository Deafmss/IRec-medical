// @ts-check
/**
 * Limpeza de dado sensível ao encerrar a sessão.
 *
 * `handleLogout` limpava 12 chaves de `localStorage`. Continuavam no disco,
 * depois do logout:
 *
 *   irec_local_wound_entries          fotos e notas de ferida
 *   irec_chat_messages                mensagens de chat
 *   irec_chat_threads                 conversas com o assistente
 *   irec_chat_read_times              leitura de mensagens
 *   irec_chat_threads_owner
 *   irec_chat_active_thread_id
 *   irec_local_calls                  histórico de teleconsulta
 *   irec_assignments                  vínculos profissional-paciente
 *   irec_local_assignments
 *   irec_local_recommended_materials
 *   irec_log_acessos_prontuario       log de acesso a prontuário
 *   irec_users                        cadastro local, com a "senha"
 *   irec_geocode_cache_*              endereço do paciente, sem expiração
 *   irec_tcle_accepted_*              consentimento de telemedicina
 *
 * Em tablet compartilhado de UBS — o cenário de uso da plataforma — o próximo
 * usuário lia o prontuário do anterior.
 *
 * A lista aqui é por prefixo, não por nome fixo: chaves novas de dado clínico
 * entram automaticamente se seguirem a convenção. O que sobrevive ao logout é
 * apenas preferência de interface, declarada explicitamente.
 */

/**
 * Preferências que PODEM sobreviver ao logout — nada aqui identifica pessoa
 * nem contém informação clínica.
 */
export const PREFERENCIAS_PRESERVADAS = new Set([
  'irec-sidebar-collapsed',
  'irec-theme-guest',
  'irec_ui_mode'
]);

/**
 * Toda chave do iRec que não esteja na lista de preferências é removida.
 *
 * Optar por lista de exclusão em vez de lista de remoção é deliberado: se
 * alguém adicionar uma chave nova com dado de paciente e esquecer de atualizar
 * este arquivo, o padrão é apagar — não vazar.
 */
export const clearSensitiveSessionData = (storage = globalThis.localStorage) => {
  if (!storage) return [];

  const removidas = [];
  const chaves = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k) chaves.push(k);
  }

  chaves.forEach((chave) => {
    const nossa = chave.startsWith('irec_') || chave.startsWith('irec-');
    if (!nossa) return;
    if (PREFERENCIAS_PRESERVADAS.has(chave)) return;
    storage.removeItem(chave);
    removidas.push(chave);
  });

  return removidas;
};

/**
 * Também limpa o `sessionStorage`, e as caches do navegador que possam guardar
 * resposta com dado clínico.
 */
export const clearSensitiveSessionDataDeep = async () => {
  const removidas = clearSensitiveSessionData();

  try {
    if (globalThis.sessionStorage) {
      clearSensitiveSessionData(globalThis.sessionStorage);
    }
  } catch (err) {
    console.warn('[iRec] Não foi possível limpar o sessionStorage:', err);
  }

  return removidas;
};
