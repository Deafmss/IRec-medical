import React, { useState } from 'react';
import PrescriptionGeneratorModal from './PrescriptionGeneratorModal';

export default function PrescriptionPage({ currentUser, selectedPatient, clinicalProfile, setActiveTab }) {
  const [prescriptionHistory, setPrescriptionHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('irec_prescription_history') || '[]');
    } catch (e) {
      return [];
    }
  });

  const [activeDoc, setActiveDoc] = useState(null);

  const handlePrescriptionCreated = (docData) => {
    const updated = [docData, ...prescriptionHistory];
    setPrescriptionHistory(updated);
    localStorage.setItem('irec_prescription_history', JSON.stringify(updated));
  };

  const patientTarget = selectedPatient || clinicalProfile || { name: 'Paciente Selecionado' };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'var(--font-primary, sans-serif)',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* Page Title & Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '800',
            margin: 0,
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📜 Prescrições, Atestados & Receituários
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Emissão oficial de receituários de medicamentos, atestados clínicos e encaminhamentos com validação QR Code.
          </p>
        </div>

        {selectedPatient && (
          <div style={{
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            padding: '8px 16px',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: '700',
            color: '#0284c7'
          }}>
            <span>👤 Paciente Ativo:</span>
            <strong>{selectedPatient.name}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: prescriptionHistory.length > 0 ? '1fr 340px' : '1fr', gap: '24px' }}>
        {/* Main Generator Section */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <PrescriptionGeneratorModal 
            currentUser={currentUser}
            patientProfile={patientTarget}
            onClose={() => {}}
            onPrescriptionCreated={handlePrescriptionCreated}
            embeddedMode={true}
          />
        </div>

        {/* Prescription History Sidebar */}
        {prescriptionHistory.length > 0 && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '20px',
            height: 'fit-content',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Histórico Emitido ({prescriptionHistory.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
              {prescriptionHistory.map((doc) => (
                <div 
                  key={doc.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setActiveDoc(doc)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase' }}>
                      {doc.type === 'receita' ? '💊 Receita' : (doc.type === 'atestado' ? '📄 Atestado' : '📋 Encaminhamento')}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{doc.date}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {doc.patientName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Cód: {doc.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
