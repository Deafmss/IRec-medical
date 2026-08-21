import { useState, useEffect } from 'react';
import { speakNaturalText } from '../utils/speechUtils';

export default function PrescriptionGeneratorModal({ currentUser, patientProfile, onClose, onPrescriptionCreated, embeddedMode = false }) {
  const [documentType, setDocumentType] = useState('receita'); // receita, atestado, encaminhamento
  const [medications, setMedications] = useState([
    { id: 1, name: '', dosage: '', frequency: '', instructions: '' }
  ]);
  const [certificateDays, setCertificateDays] = useState('1');
  const [certificateReason, setCertificateReason] = useState('Necessidade de repouso para recuperação da lesão/procedimento.');
  const [referralNotes, setReferralNotes] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('Manter curativo limpo e seco. Em caso de dor intensa ou febre, contatar a equipe iRec.');
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isDoctor = currentUser?.role === 'doctor';
  const isNurse = currentUser?.role === 'nurse';
  const isClinician = isDoctor || isNurse;
  const professionalRoleTitle = isDoctor ? 'Médico(a) Credenciado(a)' : (isNurse ? 'Enfermeiro(a) Estomaterapeuta' : 'Profissional de Saúde');
  const registryType = isDoctor ? 'CRM' : (isNurse ? 'COREN' : 'REGISTRO');
  const registryNumber = currentUser?.crm || currentUser?.coren || '';
  const professionalName = currentUser?.name || 'Profissional de Saúde iRec';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !embeddedMode && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embeddedMode, onClose]);

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handleAddMedication = () => {
    triggerVibration();
    setMedications(prev => [...prev, { id: Date.now() + Math.random(), name: '', dosage: '', frequency: '', instructions: '' }]);
  };

  const handleMedicationChange = (index, field, value) => {
    setMedications(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleRemoveMedication = (index) => {
    triggerVibration();
    if (medications.length === 1) return;
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    triggerVibration();
    setErrorMessage('');

    if (!isClinician) {
      setErrorMessage('Apenas profissionais de saúde credenciados (Médicos e Enfermeiros) podem emitir documentos.');
      return;
    }

    if (!registryNumber) {
      setErrorMessage('Registro profissional (CRM/COREN) não encontrado. Cadastre seu registro no perfil antes de emitir documentos.');
      return;
    }

    const patientCpfDigits = (patientProfile?.cpf || '').replace(/\D/g, '');
    if (!patientCpfDigits || patientCpfDigits.length !== 11) {
      setErrorMessage('É obrigatório que o cadastro do paciente contenha um CPF válido (11 dígitos) para a emissão de documentos médicos oficiais.');
      return;
    }

    if (documentType === 'receita') {
      if (!isDoctor) {
        setErrorMessage('Apenas médicos credenciados (CRM) podem emitir receituários de medicamentos.');
        return;
      }
      const validMeds = medications.filter(m => m.name.trim() !== '');
      if (validMeds.length === 0) {
        setErrorMessage('Por favor, informe ao menos um medicamento ou cobertura para a receita.');
        return;
      }
    } else if (documentType === 'atestado') {
      const days = parseInt(certificateDays, 10);
      if (isNaN(days) || days < 1 || days > 90) {
        setErrorMessage('Informe um número válido de dias de afastamento (entre 1 e 90 dias).');
        return;
      }
    } else if (documentType === 'encaminhamento') {
      if (!referralNotes.trim()) {
        setErrorMessage('Descreva o parecer de encaminhamento antes de emitir o documento.');
        return;
      }
    }

    const docId = 'IREC-' + Date.now().toString().slice(-6);
    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const docData = {
      id: docId,
      type: documentType,
      date: currentDate,
      patientName: patientProfile?.name || 'Paciente iRec',
      patientCpf: patientProfile?.cpf || 'Não informado',
      professionalName,
      professionalRoleTitle,
      registryType,
      registryNumber,
      medications: documentType === 'receita' ? medications.filter(m => m.name.trim() !== '') : [],
      certificateDays,
      certificateReason,
      referralNotes,
      additionalNotes,
      validationCode: docId
    };

    setGeneratedDocument(docData);
    speakNaturalText("Documento gerado com sucesso. Você já pode imprimir ou salvar em PDF.");
    
    if (onPrescriptionCreated) {
      onPrescriptionCreated(docData);
    }
  };

  const handlePrint = () => {
    triggerVibration();
    window.print();
  };

  const innerContent = (
    <div 
      role={embeddedMode ? undefined : "dialog"} 
      aria-modal={embeddedMode ? undefined : "true"}
      aria-label="Emissão de Receita & Atestado Digital"
      style={{
        width: '100%',
        maxWidth: embeddedMode ? '100%' : (generatedDocument ? '780px' : '620px'),
        maxHeight: embeddedMode ? 'none' : '92vh',
        overflowY: embeddedMode ? 'visible' : 'auto',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '2px solid #0284c7',
        boxShadow: embeddedMode ? 'none' : '0 25px 50px -12px rgba(2, 132, 199, 0.4)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-document, #printable-document * {
            visibility: visible !important;
          }
          #printable-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>📝</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
              {generatedDocument ? 'Documento Oficial Emitido' : 'Emissão de Receita & Atestado Digital'}
            </h3>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {professionalName} • {registryType}: {registryNumber || 'Não cadastrado'}
            </span>
          </div>
        </div>
        {!embeddedMode && onClose && (
          <button
            type="button"
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
            aria-label="Fechar"
            title="Fechar Modal (Esc)"
          >
            ×
          </button>
        )}
      </div>

      {errorMessage && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: '700'
        }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {!generatedDocument ? (
        /* FORM VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Document Type Selector (Segmented Control Track) */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
              TIPO DE DOCUMENTO:
            </label>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              width: '100%',
              gap: '6px',
              padding: '6px',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '30px',
              backdropFilter: 'blur(10px)',
              boxSizing: 'border-box'
            }}>
              <button
                type="button"
                onClick={() => { triggerVibration(); setDocumentType('receita'); setErrorMessage(''); }}
                style={{
                  flex: 1,
                  background: documentType === 'receita' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  border: documentType === 'receita' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                  color: documentType === 'receita' ? '#ffffff' : '#94a3b8',
                  borderRadius: '24px',
                  padding: '9px 12px',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: documentType === 'receita' ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                💊 Receituário
              </button>

              <button
                type="button"
                onClick={() => { triggerVibration(); setDocumentType('atestado'); setErrorMessage(''); }}
                style={{
                  flex: 1,
                  background: documentType === 'atestado' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  border: documentType === 'atestado' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                  color: documentType === 'atestado' ? '#ffffff' : '#94a3b8',
                  borderRadius: '24px',
                  padding: '9px 12px',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: documentType === 'atestado' ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                📄 Atestado
              </button>

              <button
                type="button"
                onClick={() => { triggerVibration(); setDocumentType('encaminhamento'); setErrorMessage(''); }}
                style={{
                  flex: 1,
                  background: documentType === 'encaminhamento' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  border: documentType === 'encaminhamento' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
                  color: documentType === 'encaminhamento' ? '#ffffff' : '#94a3b8',
                  borderRadius: '24px',
                  padding: '9px 12px',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: documentType === 'encaminhamento' ? '0 4px 14px rgba(2, 132, 199, 0.4)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                🩺 Encaminhamento
              </button>
            </div>
          </div>

          {/* Patient Info Summary */}
          <div style={{ backgroundColor: 'var(--glass-bg)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '800' }}>PACIENTE DESTINATÁRIO:</span>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'var(--font-display)' }}>
              👤 {patientProfile?.name || 'Paciente iRec'} {patientProfile?.cpf ? `(CPF: ${patientProfile.cpf})` : ''}
            </div>
          </div>

          {/* RECEITA FORM */}
          {documentType === 'receita' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#10b981', letterSpacing: '0.5px' }}>
                  MEDICAMENTOS & PRESCRIÇÃO:
                </label>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  + Adicionar Item
                </button>
              </div>

              {medications.map((med, idx) => (
                <div key={med.id || idx} style={{ backgroundColor: 'var(--glass-bg)', padding: '14px', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Nome do Medicamento / Cobertura (ex: Soro Fisiológico 0.9%, Colagenase)"
                      value={med.name}
                      onChange={(e) => handleMedicationChange(idx, 'name', e.target.value)}
                      style={{ flex: 1, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px' }}
                    />
                    {medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(idx)}
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '800' }}
                        aria-label="Remover item"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Dosagem (ex: 500mg, 1 ampola, 1 tubo)"
                      value={med.dosage}
                      onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Posologia / Frequência (ex: 12 em 12h por 7 dias)"
                      value={med.frequency}
                      onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ATESTADO FORM */}
          {documentType === 'atestado' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#38bdf8', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                  DIAS DE AFASTAMENTO / REPOUSO:
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={certificateDays}
                  onChange={(e) => setCertificateDays(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#38bdf8', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                  JUSTIFICATIVA / MOTIVO CLÍNICO:
                </label>
                <textarea
                  rows={3}
                  value={certificateReason}
                  onChange={(e) => setCertificateReason(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* ENCAMINHAMENTO FORM */}
          {documentType === 'encaminhamento' && (
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#38bdf8', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                PARECER DE ENCAMINHAMENTO & OBSERVAÇÕES:
              </label>
              <textarea
                rows={4}
                placeholder="Descreva o motivo do encaminhamento para o especialista ou serviço de urgência..."
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {/* Additional Notes */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#38bdf8', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
              ORIENTAÇÕES ADICIONAIS AO PACIENTE:
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '12px 24px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              marginTop: '12px',
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <span>📜</span>
            <span>EMITIR DOCUMENTO OFICIAL iREC</span>
          </button>
        </div>
      ) : (
        /* GENERATED DOCUMENT PRINT VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Printable Document Box */}
          <div id="printable-document" style={{
            backgroundColor: '#ffffff',
            color: '#0f172a',
            borderRadius: '16px',
            padding: '28px',
            border: '2px solid #cbd5e1',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontFamily: 'Arial, sans-serif'
          }}>
            {/* Header Document */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0284c7', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0284c7', fontSize: '24px', fontWeight: 'bold' }}>iRec Saúde</h2>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  Plataforma de Navegação e Acompanhamento Clínico
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block' }}>
                  {generatedDocument.type.toUpperCase()} OFICIAL
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  CÓDIGO: {generatedDocument.id}
                </span>
              </div>
            </div>

            {/* Patient and Professional Line */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
              <strong>PACIENTE:</strong> {generatedDocument.patientName} {generatedDocument.patientCpf ? `(CPF: ${generatedDocument.patientCpf})` : ''} &nbsp;|&nbsp; <strong>EMISSÃO:</strong> {generatedDocument.date}<br />
              <strong>EMISSOR:</strong> {generatedDocument.professionalName} ({generatedDocument.professionalRoleTitle}) &nbsp;|&nbsp; <strong>{generatedDocument.registryType}:</strong> {generatedDocument.registryNumber}
            </div>

            {/* Document Body Content */}
            <div style={{ minHeight: '140px', marginBottom: '20px' }}>
              {generatedDocument.type === 'receita' && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0284c7', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                    PRESCRIÇÃO E MEDICAMENTOS:
                  </h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8', fontSize: '14px' }}>
                    {generatedDocument.medications.map((m, i) => (
                      <li key={m.id || i} style={{ marginBottom: '8px' }}>
                        <strong>{m.name}</strong> {m.dosage && `- ${m.dosage}`}
                        {m.frequency && <div style={{ fontSize: '13px', color: '#475569' }}>Uso: {m.frequency}</div>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {generatedDocument.type === 'atestado' && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0284c7', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                    ATESTADO MÉDICO / CLÍNICO:
                  </h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.8' }}>
                    Atesto para os devidos fins que o(a) paciente <strong>{generatedDocument.patientName}</strong> necessita de <strong>{generatedDocument.certificateDays} dia(s)</strong> de afastamento de suas atividades por motivo de: <em>{generatedDocument.certificateReason}</em>.
                  </p>
                </div>
              )}

              {generatedDocument.type === 'encaminhamento' && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0284c7', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                    PARECER E ENCAMINHAMENTO:
                  </h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                    {generatedDocument.referralNotes}
                  </p>
                </div>
              )}

              {generatedDocument.additionalNotes && (
                <div style={{ marginTop: '16px', fontSize: '12.5px', color: '#475569', fontStyle: 'italic', borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                  <strong>Observações gerais:</strong> {generatedDocument.additionalNotes}
                </div>
              )}
            </div>

            {/* Validation Stamp */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0284c7', paddingTop: '16px', marginTop: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0284c7', display: 'block' }}>
                  🛡️ DOCUMENTO REGISTRADO iREC SAÚDE
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  Identificador Único de Autenticidade
                </span>
                <span style={{ fontSize: '10px', color: '#0f172a', fontWeight: 'bold', display: 'block' }}>
                  Código: {generatedDocument.validationCode}
                </span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #0f172a', width: '200px', marginBottom: '4px' }}></div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block' }}>{generatedDocument.professionalName}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{generatedDocument.registryType}: {generatedDocument.registryNumber}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontWeight: '900',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🖨️</span>
              <span>IMPRIMIR / PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setGeneratedDocument(null)}
              style={{
                backgroundColor: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              NOVO DOCUMENTO
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (embeddedMode) {
    return innerContent;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'var(--font-primary, sans-serif)'
    }}>
      {innerContent}
    </div>
  );
}
