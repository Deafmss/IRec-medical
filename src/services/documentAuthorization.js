// @ts-check
/**
 * Autorização de emissão de documento clínico.
 *
 * Vive fora do componente por dois motivos: é a mesma regra que
 * PrescriptionGeneratorModal e DoctorDashboard precisam aplicar (antes só o
 * primeiro aplicava), e é testável sem montar a árvore do React.
 *
 * Prescrever medicamento é ato privativo do médico — Lei nº 12.842/2013,
 * art. 4º, VII. App.jsx roteia `role: 'nurse'` e `role: 'admin'` para o painel
 * clínico, então a barreira tem de ficar no ato de emitir, não na navegação.
 */

/** Tipos de documento que só médico pode emitir. */
const PRIVATIVO_DO_MEDICO = new Set(['receita']);

/**
 * @param {'receita'|'atestado'|'encaminhamento'} type
 * @param {object} professional perfil de quem está emitindo
 * @param {object} patient perfil do paciente
 * @returns {string|null} motivo da recusa, ou null se pode emitir
 */
export const getDocumentIssueDenial = (type, professional, patient) => {
  const role = professional?.role;
  const isDoctor = role === 'doctor';
  const isNurse = role === 'nurse';

  if (!isDoctor && !isNurse) {
    return 'Apenas médicos e enfermeiros credenciados podem emitir documentos clínicos.';
  }

  if (PRIVATIVO_DO_MEDICO.has(type) && !isDoctor) {
    return 'Prescrição de medicamento é ato privativo do médico (Lei nº 12.842/2013, art. 4º, VII). Enfermeiros não podem emitir receituário.';
  }

  const registry = String(professional?.crm || professional?.coren || '').trim();
  if (!registry) {
    return `Registro profissional (${isDoctor ? 'CRM' : 'COREN'}) ausente no seu perfil. Cadastre-o antes de emitir documentos.`;
  }

  const patientCpf = String(patient?.cpf || '').replace(/\D/g, '');
  if (patientCpf.length !== 11) {
    return 'O cadastro do paciente precisa conter um CPF válido (11 dígitos) para a emissão de documento médico oficial.';
  }

  return null;
};

/** Conveniência para esconder da interface o que não pode ser emitido. */
export const canIssueDocument = (type, professional, patient) =>
  getDocumentIssueDenial(type, professional, patient) === null;

/** Somente médico prescreve. Usado para ocultar a aba de receita. */
export const canPrescribeMedication = (professional) => professional?.role === 'doctor';
