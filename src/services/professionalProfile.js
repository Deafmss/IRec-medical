/**
 * Monta o perfil público de um profissional a partir de dado real.
 *
 * O que havia antes: cada uma de três telas — SpecialistDirectory,
 * NursesNetwork e Telemedicine — carregava a sua própria cópia de uma função
 * `getDoctorPremiumDetails` que anexava ao perfil, quando o e-mail era de
 * demonstração:
 *
 *   - avaliação e volume inventados: `rating: '4.9'`, `patients: '950+'`,
 *     `successRate: '99%'`;
 *   - depoimentos de paciente inventados, descrevendo resultado de tratamento
 *     de ferida ("cicatrizou completamente em apenas 5 semanas");
 *   - titulação acadêmica inventada: "Doutorado em Enfermagem Clínica - USP",
 *     "Residência em Dermatologia - HC-USP", "Membro Titular da SBD";
 *   - preço de consulta inventado.
 *
 * Isso aparecia no diretório que o paciente usa para escolher com quem se
 * consultar. Atribuir titulação e depoimento falsos ao perfil de uma pessoa
 * real é problema de outra ordem — não é semente de demonstração.
 *
 * Aqui não há dado inventado. O que não existe no cadastro aparece como
 * ausente, e a interface mostra "Novo" em vez de uma nota fabricada.
 */

/**
 * Registro profissional do cadastro.
 *
 * Nota: não existe coluna `coren` — verificado contra a produção, que responde
 * 400 para `select=coren`. O registro de médico e de enfermeiro é gravado em
 * `crm` (o comentário do schema diz "Registro profissional / CRM / COREN").
 * Os `doc.coren` que havia espalhados pelo front eram sempre `undefined`.
 */
export const getProfessionalRegistry = (doc) =>
  String(doc?.crm || doc?.coren || '').trim();

/** Rótulo do conselho, deduzido do papel. */
export const getRegistryLabel = (doc) =>
  doc?.role === 'nurse' ? 'COREN' : 'CRM';

/**
 * Perfil público, só com o que foi realmente cadastrado.
 *
 * Mantém a mesma forma que as telas já consomem (`bio`, `education`, `price`,
 * `stats`, `reviews`), para não exigir mudança na renderização.
 *
 * @param {object} doc perfil vindo do banco
 * @param {object} [opts]
 * @param {string} [opts.defaultSpecialty] especialidade a exibir quando o
 *   cadastro não tem uma — 'Clínico Geral' para médico, 'Enfermagem' para
 *   enfermeiro, conforme a tela.
 */
export const buildPublicProfessionalProfile = (doc, { defaultSpecialty = 'Clínico Geral' } = {}) => {
  if (!doc) return null;

  const registry = getProfessionalRegistry(doc);
  const registryLabel = getRegistryLabel(doc);

  return {
    ...doc,
    specialty: doc.specialty || defaultSpecialty,

    // Só o que o profissional escreveu no próprio perfil.
    bio: doc.bio || 'Este profissional ainda não preencheu a apresentação do perfil.',
    education: doc.education
      || (registry
        ? `${registryLabel}: ${registry}`
        : 'Registro profissional não informado'),

    // Sem preço cadastrado, não se inventa um. A tela trata `null`.
    price: doc.price ?? doc.consultationFee ?? null,

    // A plataforma não coleta avaliação de paciente. Enquanto não coletar, não
    // há nota a exibir — e 'Novo' é a informação honesta.
    stats: { rating: 'Novo', patients: '0', successRate: '-' },
    reviews: []
  };
};
