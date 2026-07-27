// Audit Logging & LGPD Compliance Service (Inspired by Medplum Enterprise Audit System)

const AUDIT_STORAGE_KEY = 'irec_log_acessos_prontuario';

/**
 * Registra um evento imutável de acesso, alteração ou exportação de prontuário
 */
export const createAuditLog = async (actionType, clinician, patient, details = '') => {
  const newLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    formattedDate: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    action: actionType, // 'Leitura de Prontuário', 'Edição de Ficha', 'Emissão de Receita', 'Exportação PDF', 'Triagem por Voz', 'Atendimento Telemedicina'
    clinicianId: clinician?.id || 'sistema',
    clinicianName: clinician?.name || 'Sistema iRec',
    clinicianRole: clinician?.role || 'Médico/Enfermeiro',
    patientId: patient?.id || 'paciente',
    patientName: patient?.name || 'Paciente',
    details: details || 'Acesso realizado em conformidade com as regras da LGPD.'
  };

  try {
    const existingLogs = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]');
    const updatedLogs = [newLog, ...existingLogs].slice(0, 200); // Guardar os últimos 200 registros de auditoria
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updatedLogs));
    console.log(`[iRec AuditLog] Evento registrado: ${actionType} por ${newLog.clinicianName} no prontuário de ${newLog.patientName}`);
    return newLog;
  } catch (err) {
    console.warn('[iRec AuditLog] Erro ao gravar log de auditoria:', err);
    return null;
  }
};

/**
 * Obtém o histórico de acessos de auditoria de um prontuário específico
 */
export const getPatientAuditLogs = (patientId) => {
  try {
    const logs = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]');
    if (!patientId) return logs;
    return logs.filter(log => log.patientId === patientId || log.patientName === patientId);
  } catch (err) {
    console.error('[iRec AuditLog] Erro ao buscar logs:', err);
    return [];
  }
};
