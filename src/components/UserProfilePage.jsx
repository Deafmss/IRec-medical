import UserProfileModal from './UserProfileModal';
import { getWoundEntries } from '../services/supabaseService';

export default function UserProfilePage({ currentUser, onProfileUpdate }) {
  return (
    <div style={{
      padding: '24px',
      maxWidth: '1000px',
      margin: '0 auto',
      fontFamily: 'var(--font-primary, sans-serif)',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* Page Header */}
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
            👤 Perfil & Configurações da Conta
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Gerencie suas credenciais profissionais, dados de contato, foto de perfil e preferências de interface.
          </p>
        </div>
      </div>

      {/* Embedded UserProfile Content */}
      <div className="glass-card-cyan-glow" style={{
        padding: '28px',
        borderRadius: '20px',
        marginBottom: '24px'
      }}>
        <UserProfileModal 
          currentUser={currentUser}
          onClose={() => {}}
          onProfileUpdate={onProfileUpdate}
          embeddedMode={true}
        />
      </div>

      {/* LGPD Data Governance & Privacy Rights Section */}
      <div className="glass-card" style={{
        marginTop: '24px',
        padding: '24px',
        borderRadius: '20px',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Privacidade & Direitos do Titular de Dados (LGPD - Lei 13.709/2018)
          </h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0', lineHeight: '1.5' }}>
          Conforme a Lei Geral de Proteção de Dados de Saúde, você tem o direito inalienável de exportar uma cópia completa dos seus dados de saúde ou solicitar a revogação de consentimento.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={async () => {
              let remoteEntries = [];
              if (currentUser?.id) {
                try {
                  remoteEntries = await getWoundEntries(currentUser.id);
                } catch (e) {
                  console.warn("Falha ao ler entradas do Supabase para exportação LGPD:", e);
                }
              }
              const localEntries = JSON.parse(localStorage.getItem(`irec_entries_${currentUser?.id}`) || '[]');
              const allEntries = remoteEntries && remoteEntries.length > 0 ? remoteEntries : localEntries;

              const exportData = {
                user: currentUser,
                exportedAt: new Date().toISOString(),
                lgpdNotice: 'Dados pessoais e clínicos exportados via Plataforma iRec Saúde em conformidade com o Art. 18 da LGPD.',
                clinicalEntries: allEntries
              };
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", `irec_dados_saude_${currentUser?.id || 'paciente'}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
              alert("📥 Exportação LGPD concluída com sucesso! Seu arquivo de dados clínicos foi baixado.");
            }}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: '12px 22px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.35)';
            }}
          >
            <span>📥</span>
            <span>Exportar Meus Dados de Saúde (.JSON)</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (window.confirm("⚠️ Tem certeza de que deseja solicitar a exclusão de sua conta? Seus prontuários serão arquivados conforme prazo legal do CFM e o acesso será suspenso.")) {
                try {
                  const { createAuditLog } = await import('../services/auditLogger');
                  createAuditLog('Solicitação de Exclusão LGPD', currentUser, currentUser, 'Solicitação de revogação de consentimento e exclusão de conta via painel LGPD');
                } catch (e) {
                  console.warn("[iRec AuditLog] Falha ao gravar log de exclusão LGPD:", e);
                }
                alert("📩 Solicitação de exclusão registrada com sucesso em auditoria. Nossa equipe entrará em contato em até 48 horas.");
              }
            }}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '24px',
              padding: '12px 22px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }}
          >
            <span>⚠️</span>
            <span>Solicitar Exclusão de Conta (LGPD)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
