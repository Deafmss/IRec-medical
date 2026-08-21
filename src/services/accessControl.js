// @ts-check
/**
 * Uma única definição de "quem é administrador".
 *
 * Havia três, incompatíveis:
 *
 *   App.jsx:106            email === 'admin@irec.com'
 *   App.jsx:448            email === 'admin@irec.com' || role === 'admin'
 *   AdminDashboard.jsx:102 role !== 'admin'  ->  bloqueia
 *
 * Consequência: quem tinha o e-mail mas `role: 'patient'` navegava até a aba
 * (App.jsx liberava) e levava "⛔ Acesso Restrito" (AdminDashboard bloqueava);
 * quem tinha `role: 'admin'` com outro e-mail via o painel mas não recebia o
 * contador de verificações pendentes. Pelo menos uma das duas combinações estava
 * sempre quebrada.
 *
 * Pior: o portão do painel era `if (currentUser && currentUser.role !== 'admin')`.
 * Com `currentUser` nulo ou indefinido a condição é falsa e **o painel
 * administrativo renderizava**. Fail-open num painel de administração.
 *
 * A regra aqui é fail-closed: sem perfil, não é admin.
 *
 * NOTA IMPORTANTE: isto continua sendo verificação no cliente, e serve apenas
 * para a navegação. A barreira que vale é a RLS no banco
 * (supabase/migrations/20260821000300), que decide o que cada `auth.uid()`
 * consegue ler e escrever. Autorização no navegador é conveniência, não
 * segurança.
 */

/** Conta de administração herdada, mantida por compatibilidade. */
const LEGACY_ADMIN_EMAIL = 'admin@irec.com';

/**
 * @param {{email?: string, role?: string} | null | undefined} profile
 * @returns {boolean}
 */
export const isAdminUser = (profile) => {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return String(profile.email || '').toLowerCase() === LEGACY_ADMIN_EMAIL;
};

/**
 * Clínico é médico ou enfermeiro — e a conta de administração não é clínico,
 * mesmo que o papel diga o contrário.
 *
 * @param {{email?: string, role?: string} | null | undefined} profile
 */
export const isClinicianUser = (profile) => {
  if (!profile) return false;
  if (isAdminUser(profile)) return false;
  return profile.role === 'doctor' || profile.role === 'nurse';
};

/**
 * Clínico com credenciamento aprovado. `unverified` é o padrão que
 * getClinicalProfile usa quando o campo vem vazio, e conta como não liberado.
 *
 * @param {{email?: string, role?: string, verificationStatus?: string} | null | undefined} profile
 */
export const isVerifiedClinicianUser = (profile) =>
  isClinicianUser(profile) && profile?.verificationStatus === 'verified';

export { LEGACY_ADMIN_EMAIL };
