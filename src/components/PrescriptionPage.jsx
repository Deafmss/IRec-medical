import { useState } from 'react';
import PrescriptionGeneratorModal from './PrescriptionGeneratorModal';

export default function PrescriptionPage({ currentUser, selectedPatient, clinicalProfile, setActiveTab }) {
  const isClinician = currentUser?.role === 'doctor' || currentUser?.role === 'nurse';
  const storageKey = `irec_prescription_history_${currentUser?.id || 'guest'}`;

  const [prescriptionHistory, setPrescriptionHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  });

  const [activeDoc, setActiveDoc] = useState(null);

  if (!isClinician) {
    return (
      <div style={{
        padding: '60px 24px',
        textAlign: 'center',
        color: 'var(--text-primary)',
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px 0' }}>Acesso Restrito</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
          Apenas médicos e enfermeiros credenciados possuem autorização para acessar o módulo de emissão de prescrições e atestados.
        </p>
        <button 
          type="button" 
          onClick={() => setActiveTab && setActiveTab('dashboard')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '800',
            fontSize: '14px'
          }}
        >
          Voltar ao Painel Principal
        </button>
      </div>
    );
  }

  const handlePrescriptionCreated = (docData) => {
    const updated = [docData, ...prescriptionHistory];
    setPrescriptionHistory(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
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
      {/* Modal for Viewing/Reprinting Selected History Document */}
      {activeDoc && (
        <PrescriptionGeneratorModal
          currentUser={currentUser}
          patientProfile={{ name: activeDoc.patientName, cpf: activeDoc.patientCpf }}
          onClose={() => setActiveDoc(null)}
          onPrescriptionCreated={null}
          embeddedMode={false}
        />
      )}

      {/* Page Title & Header */}
      <div className="glass-card-cyan-glow" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '24px',
        borderRadius: '20px'
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
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Emissão oficial de receituários de medicamentos, atestados clínicos e encaminhamentos com validação iRec.
          </p>
        </div>

        {selectedPatient && (
          <div style={{
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            padding: '8px 18px',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: '700',
            color: '#0284c7',
            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.15)'
          }}>
            <span>👤 Paciente Ativo:</span>
            <strong>{selectedPatient.name}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: prescriptionHistory.length > 0 ? '1fr 340px' : '1fr', gap: '24px' }}>
        {/* Main Generator Section */}
        <div className="glass-card glass-card-cyan-glow" style={{
          borderRadius: '20px',
          padding: '24px',
          margin: 0
        }}>
          <PrescriptionGeneratorModal 
            currentUser={currentUser}
            patientProfile={patientTarget}
            onClose={() => setActiveTab && setActiveTab('dashboard')}
            onPrescriptionCreated={handlePrescriptionCreated}
            embeddedMode={true}
          />
        </div>

        {/* Prescription History Sidebar */}
        {prescriptionHistory.length > 0 && (
          <div className="glass-card" style={{
            borderRadius: '20px',
            padding: '20px',
            height: 'fit-content',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            margin: 0
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Histórico Emitido ({prescriptionHistory.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
              {prescriptionHistory.map((doc) => (
                <div 
                  key={doc.id}
                  role="button"
                  tabIndex={0}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveDoc(doc);
                    }
                  }}
                  title="Clique para visualizar ou reimprimir este documento"
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
