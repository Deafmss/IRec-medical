import React, { useState } from 'react';
import { createAuditLog } from '../services/supabaseService';

export default function TCLETelemedicineModal({ currentUser, onAccept, onDecline }) {
  const [acceptedCheckbox, setAcceptedCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!acceptedCheckbox) return;
    setLoading(true);
    try {
      if (currentUser?.id) {
        localStorage.setItem(`irec_tcle_accepted_${currentUser.id}`, new Date().toISOString());
        await createAuditLog('TCLE_ACCEPTED', currentUser.id, {
          resolution: 'CFM 2.314/2022',
          lgpdConsent: true,
          timestamp: new Date().toISOString()
        });
      }
      onAccept();
    } catch (err) {
      console.warn('[iRec] Aviso ao registrar log do TCLE:', err);
      onAccept();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '20px',
        maxWidth: '650px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            color: 'var(--primary)',
            fontSize: '11px',
            fontWeight: '800',
            padding: '4px 10px',
            borderRadius: '20px',
            marginBottom: '8px'
          }}>
            🛡️ CONFORMIDADE CFM RES. Nº 2.314/2022 & LGPD SAÚDE
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
            Termo de Consentimento Livre e Esclarecido (TCLE)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Leia atentamente as condições antes de ingressar na consulta médica por vídeo.
          </p>
        </div>

        {/* Scrollable Terms Content */}
        <div style={{
          flexGrow: 1,
          overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          fontSize: '13px',
          lineHeight: '1.6',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          maxHeight: '300px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: 0 }}>
            1. Natureza do Atendimento por Telemedicina
          </h4>
          <p>
            O atendimento médico por tecnologia de vídeo e áudio em tempo real (Telemedicina) segue rigorosamente a <strong>Resolução CFM nº 2.314/2022</strong> e a <strong>Lei nº 14.510/2022</strong>. O objetivo é prestar assistência médica, orientação e acompanhamento de lesões e estomaterapia à distância.
          </p>

          <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            2. Privacidade e Proteção de Dados (LGPD)
          </h4>
          <p>
            Todos os seus dados de saúde, prontuários, imagens de evolução e registros de chamada são criptografados de ponta a ponta e armazenados em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>. Nenhuma gravação de áudio ou vídeo é armazenada sem autorização prévia expressa.
          </p>

          <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            3. Limitações e Autonomia do Paciente
          </h4>
          <p>
            O profissional de saúde avaliará a viabilidade do atendimento remoto. Caso seja identificada a necessidade de exame físico presencial ou situação de urgência/emergência, você será imediatamente orientado a procurar uma unidade presencial de atendimento.
          </p>

          <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            4. Direitos e Revogação
          </h4>
          <p>
            O paciente possui total liberdade de recusar o atendimento por telemedicina a qualquer momento sem prejuízo ao seu direito de assistência presencial à saúde.
          </p>
        </div>

        {/* Acceptance Checkbox */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          cursor: 'pointer',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          <input
            type="checkbox"
            checked={acceptedCheckbox}
            onChange={e => setAcceptedCheckbox(e.target.checked)}
            style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <span>
            Declaro que li, compreendi e concordo integralmente com os termos do atendimento por Telemedicina e o tratamento dos meus dados de saúde.
          </span>
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onDecline}
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Recusar / Voltar
          </button>

          <button
            onClick={handleConfirm}
            disabled={!acceptedCheckbox || loading}
            style={{
              backgroundColor: acceptedCheckbox ? 'var(--primary)' : 'var(--border-color)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 22px',
              fontSize: '13.5px',
              fontWeight: '800',
              cursor: acceptedCheckbox ? 'pointer' : 'not-allowed',
              opacity: acceptedCheckbox ? 1 : 0.6,
              boxShadow: acceptedCheckbox ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? 'Registrando...' : 'Concordar e Acessar Vídeo 🎥'}
          </button>
        </div>
      </div>
    </div>
  );
}
