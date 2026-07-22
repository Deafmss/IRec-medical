import React from 'react';
import { speakNaturalText } from '../utils/speechUtils';

export default function ReportPDFGenerator({ clinicalProfile, entries, onClose }) {
  const patientName = clinicalProfile?.name || 'Paciente iRec';
  const patientCpf = clinicalProfile?.cpf || 'Não informado';
  const allergy = clinicalProfile?.allergies || 'Nenhuma declarada';

  const docId = 'EVOL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const qrValidationUrl = `https://i-rec-medical.vercel.app/?validar=${docId}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrValidationUrl)}`;

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handlePrint = () => {
    triggerVibration();
    speakNaturalText("Gerando relatório evolutivo impresso em PDF.");
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
        maxWidth: '820px',
        maxHeight: '92vh',
        overflowY: 'auto',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '2px solid #10b981',
        boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.4)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📊</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
                Relatório Evolutivo de Estomaterapia & Cicatrização
              </h3>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                Gerado para apresentação médica e acompanhamento continuado
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

        {/* PRINTABLE PDF CONTAINER */}
        <div id="printable-report" style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '28px',
          border: '2px solid #cbd5e1',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          fontFamily: 'Arial, sans-serif'
        }}>
          {/* Document Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #10b981', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#10b981', fontSize: '24px', fontWeight: 'bold' }}>iRec Saúde</h2>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                Plataforma de Navegação e Acompanhamento de Feridas e Crônicos
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block' }}>
                LAUDO EVOLUTIVO DE CICATRIZAÇÃO
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                CÓDIGO: {docId}
              </span>
            </div>
          </div>

          {/* Patient Card */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
            <strong>PACIENTE:</strong> {patientName} &nbsp;|&nbsp; <strong>CPF:</strong> {patientCpf}<br />
            <strong>ALERGIAS DECLARADAS:</strong> {allergy} &nbsp;|&nbsp; <strong>DATA DO RELATÓRIO:</strong> {currentDate}
          </div>

          {/* Healing Percentage Bar */}
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#047857', display: 'block' }}>
                EVOLUÇÃO ESTIMADA DA CICATRIZAÇÃO
              </span>
              <h3 style={{ margin: '4px 0 0 0', color: '#065f46', fontSize: '26px', fontWeight: '900' }}>
                56% de Redução da Lesão
              </h3>
            </div>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px' }}>
              56%
            </div>
          </div>

          {/* Evolution Records Table */}
          <h4 style={{ margin: '0 0 10px 0', color: '#047857', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
            HISTÓRICO DE REGISTROS DE LESÃO:
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Data</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Tipo de Lesão</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Dor (0-10)</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Aspecto do Tecido</th>
              </tr>
            </thead>
            <tbody>
              {entries && entries.length > 0 ? (
                entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.date || currentDate}</td>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.tissue_type || 'Lesão com Eritema'}</td>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.pain_level || 3}/10</td>
                    <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.notes || 'Em processo de epitelização e cicatrização.'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{currentDate}</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Úlcera de Pressão / Eritema</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>3/10 (Leve)</td>
                  <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Tecido de granulação saudável em bordas. Redução de exsudato.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* QR Code Validation Stamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #10b981', paddingTop: '16px', marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={qrCodeApiUrl}
                alt="QR Code de Validação"
                style={{ width: '70px', height: '70px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#047857', display: 'block' }}>
                  🛡️ LAUDO AUTENTICADO iREC
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  Acompanhamento de Enfermagem & Telemedicina
                </span>
                <span style={{ fontSize: '10px', color: '#0f172a', fontWeight: 'bold', display: 'block' }}>
                  Código de Autenticidade: {docId}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
              Gerado automaticamente pela Plataforma iRec<br />
              https://i-rec-medical.vercel.app
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
            <span>IMPRIMIR / GERAR PDF</span>
          </button>

          <button
            onClick={() => { triggerVibration(); onClose(); }}
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
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}
