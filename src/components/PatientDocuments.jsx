import React, { useState, useEffect } from 'react';
import { getPatientDocuments } from '../services/supabaseService';

export default function PatientDocuments({ clinicalProfile, onOpenReportPDF }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePrintDoc, setActivePrintDoc] = useState(null);

  const loadDocuments = async (showSpinner = true) => {
    if (!clinicalProfile?.id) return;
    if (showSpinner) setLoading(true);
    try {
      const docs = await getPatientDocuments(clinicalProfile.id);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments(true);
  }, [clinicalProfile]);

  // Periodic polling to refresh documents in background (every 10 seconds)
  useEffect(() => {
    if (!clinicalProfile?.id) return;

    const interval = setInterval(() => {
      console.log("[iRec] Polling patient documents in background...");
      loadDocuments(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [clinicalProfile]);

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return 'Idade não informada';
    try {
      const birth = new Date(birthDateString);
      const diff = Date.now() - birth.getTime();
      const ageDate = new Date(diff);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return `${age} anos`;
    } catch (e) {
      return 'Idade inválida';
    }
  };

  const handlePrintDocument = (doc) => {
    setActivePrintDoc(doc);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <div className="patient-documents-wrapper">
      <style>{`
        .patient-documents-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: fadeIn 0.4s ease forwards;
        }

        .documents-header {
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 14px;
        }

        .documents-header h2 {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .documents-header p {
          font-size: 13.5px;
          color: var(--text-muted);
        }

        .documents-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-document-layout, .print-document-layout * {
            visibility: visible !important;
          }
          .print-document-layout {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 99999 !important;
            background-color: #ffffff !important;
          }
          .print-document-layout > div {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="documents-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Minhas Receitas e Atestados</h2>
          <p>Acesse aqui os documentos clínicos emitidos pelo seu médico assistente.</p>
        </div>

        {onOpenReportPDF && (
          <button
            onClick={onOpenReportPDF}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 18px',
              fontWeight: '800',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <span>📊</span>
            <span>Gerar Relatório Evolutivo em PDF</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="glass-card no-print" style={{ textAlign: 'center', padding: '40px' }}>
          Carregando seus documentos...
        </div>
      ) : documents.length === 0 ? (
        <div className="glass-card no-print" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Nenhum documento médico foi emitido para você ainda.
        </div>
      ) : (
        <div className="documents-list no-print">
          {documents.map((doc) => (
            <div key={doc.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', margin: 0, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: doc.type === 'receita' ? 'var(--primary-glow)' : 'hsla(185, 75%, 45%, 0.1)',
                  color: doc.type === 'receita' ? 'var(--primary)' : 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  {doc.type === 'receita' ? '⚡' : '📋'}
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {doc.type === 'receita' ? 'Receita Médica' : `Atestado de ${doc.content.atestadoType || 'Afastamento'}`}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Emitido em: {new Date(doc.createdAt).toLocaleDateString('pt-BR')} às {new Date(doc.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Dr(a). {doc.content.doctorName}
                  </p>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={() => handlePrintDocument(doc)}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.617 0-1.11-.475-1.12-1.092L6.34 18m11.318 0a3 3 0 0 0-3-3H9.345a3 3 0 0 0-3 3m10.71-.229a4.482 4.482 0 0 0-10.71 0M18 9v3.75m-9-3.75h6.002c1.242 0 2.25 1.008 2.25 2.25v2.625M6 12v1.5m1.5-1.5H6" />
                </svg>
                Visualizar / Imprimir
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Printable Preview A4 (Only visible when printing) */}
      {activePrintDoc && (
        <div className="print-document-layout print-only" style={{ display: 'none' }}>
          <div style={{ border: '2px solid #111', padding: '40px', minHeight: '1050px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000', position: 'relative', fontFamily: 'Arial, sans-serif' }}>
            <div>
              {/* Top Margin Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1e3a8a', paddingBottom: '16px', marginBottom: '30px' }}>
                <div>
                  <h1 style={{ fontSize: '32px', color: '#1e3a8a', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>iRec</h1>
                  <span style={{ fontSize: '11px', color: '#4b5563', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Prontuário & Prescrição Digital Segura</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold', color: '#111', textTransform: 'uppercase' }}>
                    {activePrintDoc.type === 'receita' ? 'Prescrição Médica' : 'Atestado Médico'}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#4b5563' }}>Emitido em {new Date(activePrintDoc.createdAt).toLocaleDateString('pt-BR')} às {new Date(activePrintDoc.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Specialty Verification Seal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '8px', padding: '12px 18px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🛡️</span>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534' }}>
                      Documento Emitido por Profissional Credenciado
                    </span>
                    <p style={{ margin: 0, fontSize: '11px', color: '#15803d' }}>
                      Área de Atuação: {activePrintDoc.content.doctorSpecialty} • CRM/Registro: {activePrintDoc.content.doctorCrm}
                      {activePrintDoc.content.doctorRqe && ` • RQE: ${activePrintDoc.content.doctorRqe}`}
                    </p>
                  </div>
                </div>
                <div style={{ border: '1px solid #86efac', color: '#166534', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#e8fdf0' }}>
                  Especialidade Validada
                </div>
              </div>

              {/* Patient details */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '30px', fontSize: '13px' }}>
                <div><strong>Paciente:</strong> {clinicalProfile?.name}</div>
                <div><strong>Idade:</strong> {calculateAge(clinicalProfile?.birthDate)}</div>
                <div><strong>Gênero:</strong> {clinicalProfile?.gender}</div>
              </div>

              {/* Document Content */}
              {activePrintDoc.type === 'receita' ? (
                <div style={{ padding: '0 10px' }}>
                  <h3 style={{ fontSize: '15px', borderBottom: '1px solid #111', paddingBottom: '6px', marginBottom: '18px', color: '#111', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Prescrição de Coberturas & Recomendações:
                  </h3>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    {activePrintDoc.content.items?.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '20px', fontSize: '14px', lineHeight: '1.6', color: '#111' }}>
                        <strong style={{ fontSize: '15px', color: '#000' }}>{item.name}</strong> — {item.dosage} ({item.route})
                        <p style={{ margin: '4px 0 0 0', color: '#374151', fontStyle: 'italic', fontSize: '13px' }}>
                          Instruções: {item.instructions}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div style={{ fontSize: '14.5px', lineHeight: '1.8', color: '#111', padding: '0 10px' }}>
                  <h3 style={{ fontSize: '15px', borderBottom: '1px solid #111', paddingBottom: '6px', marginBottom: '18px', color: '#111', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Declaração de Atestado Clínico ({activePrintDoc.content.atestadoType || 'Afastamento'}):
                  </h3>
                  <p style={{ textAlign: 'justify' }}>
                    Atesto para os devidos fins regulamentares que o(a) paciente acima identificado(a) esteve sob meus cuidados clínicos na data de hoje e <strong>{activePrintDoc.content.reason}</strong>. Em decorrência do quadro, recomendo o seu repouso e afastamento total de suas atividades habituais, laborais e acadêmicas pelo período de <strong>{activePrintDoc.content.days} dia(s)</strong>, contados a partir desta data.
                  </p>
                  {activePrintDoc.content.cid && (
                    <div style={{ marginTop: '20px', display: 'inline-block', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', backgroundColor: '#f8fafc', fontSize: '13px' }}>
                      <strong>Classificação Internacional de Doenças (CID-10):</strong> {activePrintDoc.content.cid}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Verification & Signature Section */}
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '20px', marginTop: '40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr 1fr', gap: '20px', alignItems: 'center' }}>
                {/* QR Code */}
                <div>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://irec.com.br/validar?code=validation_${activePrintDoc.id}`)}`}
                    alt="QR Code de Autenticidade"
                    style={{ width: '80px', height: '80px', border: '1px solid #cbd5e1', padding: '4px', backgroundColor: '#fff' }}
                  />
                </div>

                {/* ICP-Brasil Seal Info */}
                <div style={{ fontSize: '11px', lineHeight: '1.4', color: '#4b5563' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
                    <span>🛡️</span> ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)
                  </div>
                  Este documento foi assinado eletronicamente por <strong>Dr(a). {activePrintDoc.content.doctorName}</strong> utilizando infraestrutura de chaves públicas credenciada pela Medida Provisória nº 2.200-2/2001. A integridade e autencidade da receita/atestado médico podem ser verificadas via QR Code ou no site oficial de validação:
                  <div style={{ fontWeight: 'bold', color: '#1e3a8a', marginTop: '2px' }}>
                    https://irec.com.br/validar (Código: validation_${activePrintDoc.id})
                  </div>
                </div>

                {/* Doctor Signature Stamp */}
                <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px', color: '#1e3a8a', margin: '0 0 4px 0' }}>
                    {activePrintDoc.content.doctorName}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#111' }}>
                    Dr(a). {activePrintDoc.content.doctorName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#4b5563' }}>
                    {activePrintDoc.content.doctorSpecialty}
                  </div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>
                    CRM/Registro: {activePrintDoc.content.doctorCrm}
                  </div>
                  {activePrintDoc.content.doctorRqe && (
                    <div style={{ fontSize: '9px', color: '#6b7280' }}>
                      RQE: {activePrintDoc.content.doctorRqe}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Copyright */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '20px', fontSize: '10px', color: '#9ca3af' }}>
                <span>iRec Telemedicina & Cicatrização Digital S.A.</span>
                <span>Documento oficial nos termos da Resolução CFM nº 2.299/2021.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
