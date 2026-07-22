import React, { useState } from 'react';
import { speakNaturalText } from '../utils/speechUtils';

export default function PrescriptionGeneratorModal({ currentUser, patientProfile, onClose, onPrescriptionCreated }) {
  const [documentType, setDocumentType] = useState('receita'); // receita, atestado, encaminhamento
  const [medications, setMedications] = useState([
    { name: '', dosage: '', frequency: '', instructions: '' }
  ]);
  const [certificateDays, setCertificateDays] = useState('1');
  const [certificateReason, setCertificateReason] = useState('Necessidade de repouso para recuperação da lesão/procedimento.');
  const [referralNotes, setReferralNotes] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('Manter curativo limpo e seco. Em caso de dor intensa ou febre, contatar a equipe iRec.');
  const [generatedDocument, setGeneratedDocument] = useState(null);

  const isDoctor = currentUser?.role === 'doctor';
  const professionalRoleTitle = isDoctor ? 'Médico(a) Credenciado(a)' : 'Enfermeiro(a) Estomaterapeuta';
  const registryType = isDoctor ? 'CRM' : 'COREN';
  const registryNumber = currentUser?.crm || currentUser?.coren || '123456-SP';
  const professionalName = currentUser?.name || 'Profissional de Saúde iRec';

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handleAddMedication = () => {
    triggerVibration();
    setMedications([...medications, { name: '', dosage: '', frequency: '', instructions: '' }]);
  };

  const handleMedicationChange = (index, field, value) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const handleRemoveMedication = (index) => {
    triggerVibration();
    if (medications.length === 1) return;
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    triggerVibration();

    const docId = 'IREC-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const qrValidationUrl = `https://i-rec-medical.vercel.app/?validar=${docId}`;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrValidationUrl)}`;

    const docData = {
      id: docId,
      type: documentType,
      date: currentDate,
      patientName: patientProfile?.name || 'Paciente iRec',
      patientCpf: patientProfile?.cpf || 'xxx.xxx.xxx-xx',
      professionalName,
      professionalRoleTitle,
      registryType,
      registryNumber,
      medications: documentType === 'receita' ? medications.filter(m => m.name.trim() !== '') : [],
      certificateDays,
      certificateReason,
      referralNotes,
      additionalNotes,
      qrCodeUrl: qrCodeApiUrl,
      validationCode: docId
    };

    setGeneratedDocument(docData);
    speakNaturalText(`Documento gerado com sucesso para ${docData.patientName}. Você já pode imprimir ou salvar em PDF.`);
    
    if (onPrescriptionCreated) {
      onPrescriptionCreated(docData);
    }
  };

  const handlePrint = () => {
    triggerVibration();
    window.print();
  };

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
      <div style={{
        width: '100%',
        maxWidth: generatedDocument ? '780px' : '620px',
        maxHeight: '92vh',
        overflowY: 'auto',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '2px solid #0284c7',
        boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.4)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📝</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
                {generatedDocument ? 'Documento Oficial Emitido' : 'Emissão de Receita & Atestado Digital'}
              </h3>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                {professionalName} • {registryType}: {registryNumber}
              </span>
            </div>
          </div>
          <button
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {!generatedDocument ? (
          /* FORM VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Document Type Selector */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', display: 'block', marginBottom: '8px' }}>
                TIPO DE DOCUMENTO:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => { triggerVibration(); setDocumentType('receita'); }}
                  style={{
                    backgroundColor: documentType === 'receita' ? '#0284c7' : '#0f172a',
                    border: `2px solid ${documentType === 'receita' ? '#38bdf8' : '#334155'}`,
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '10px',
                    fontWeight: '800',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  💊 Receituário
                </button>

                <button
                  onClick={() => { triggerVibration(); setDocumentType('atestado'); }}
                  style={{
                    backgroundColor: documentType === 'atestado' ? '#0284c7' : '#0f172a',
                    border: `2px solid ${documentType === 'atestado' ? '#38bdf8' : '#334155'}`,
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '10px',
                    fontWeight: '800',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  📄 Atestado
                </button>

                <button
                  onClick={() => { triggerVibration(); setDocumentType('encaminhamento'); }}
                  style={{
                    backgroundColor: documentType === 'encaminhamento' ? '#0284c7' : '#0f172a',
                    border: `2px solid ${documentType === 'encaminhamento' ? '#38bdf8' : '#334155'}`,
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '10px',
                    fontWeight: '800',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  🩺 Encaminhamento
                </button>
              </div>
            </div>

            {/* Patient Info Summary */}
            <div style={{ backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>PACIENTE DESTINATÁRIO:</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                👤 {patientProfile?.name || 'Paciente iRec'}
              </div>
            </div>

            {/* RECEITA FORM */}
            {documentType === 'receita' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#34d399' }}>
                    MEDICAMENTOS & PRESCRIÇÃO:
                  </label>
                  <button
                    onClick={handleAddMedication}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    + Adicionar Item
                  </button>
                </div>

                {medications.map((med, idx) => (
                  <div key={idx} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Nome do Medicamento / Cobertura (ex: Soro Fisiológico 0.9%, Colagenase)"
                        value={med.name}
                        onChange={(e) => handleMedicationChange(idx, 'name', e.target.value)}
                        style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                      {medications.length > 1 && (
                        <button
                          onClick={() => handleRemoveMedication(idx)}
                          style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}
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
                        style={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        placeholder="Posologia / Frequência (ex: 12 em 12h por 7 dias)"
                        value={med.frequency}
                        onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                        style={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
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
                  <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    DIAS DE AFASTAMENTO / REPOUSO:
                  </label>
                  <input
                    type="number"
                    value={certificateDays}
                    onChange={(e) => setCertificateDays(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px 12px', borderRadius: '10px', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    JUSTIFICATIVA / MOTIVO CLÍNICO:
                  </label>
                  <textarea
                    rows={3}
                    value={certificateReason}
                    onChange={(e) => setCertificateReason(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', resize: 'none' }}
                  />
                </div>
              </div>
            )}

            {/* ENCAMINHAMENTO FORM */}
            {documentType === 'encaminhamento' && (
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  PARECER DE ENCAMINHAMENTO & OBSERVAÇÕES:
                </label>
                <textarea
                  rows={4}
                  placeholder="Descreva o motivo do encaminhamento para o especialista ou serviço de urgência..."
                  value={referralNotes}
                  onChange={(e) => setReferralNotes(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', resize: 'none' }}
                />
              </div>
            )}

            {/* Additional Notes */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                ORIENTAÇÕES ADICIONAIS AO PACIENTE:
              </label>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px 12px', borderRadius: '10px', fontSize: '13px' }}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontWeight: '900',
                fontSize: '15px',
                cursor: 'pointer',
                marginTop: '10px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
              }}
            >
              EMITIR DOCUMENTO COM VALIDAÇÃO QR CODE
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
                <strong>PACIENTE:</strong> {generatedDocument.patientName} &nbsp;|&nbsp; <strong>EMISSÃO:</strong> {generatedDocument.date}<br />
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
                        <li key={i} style={{ marginBottom: '8px' }}>
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

              {/* QR Code Validation Stamp */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0284c7', paddingTop: '16px', marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={generatedDocument.qrCodeUrl}
                    alt="QR Code de Validação"
                    style={{ width: '70px', height: '70px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0284c7', display: 'block' }}>
                      🛡️ DOCUMENTO AUTENTICADO iREC
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Validação Digital por QR Code
                    </span>
                    <span style={{ fontSize: '10px', color: '#0f172a', fontWeight: 'bold', display: 'block' }}>
                      Hash: {generatedDocument.validationCode}
                    </span>
                  </div>
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
                onClick={handlePrint}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px',
                  fontWeight: '900',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>🖨️</span>
                <span>IMPRIMIR / SALVAR PDF</span>
              </button>

              <button
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
                EMITIR OUTRO DOCUMENTO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
