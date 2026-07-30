import React from 'react';
import UserProfileModal from './UserProfileModal';

export default function UserProfilePage({ currentUser, onProfileUpdate, setActiveTab }) {
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
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <UserProfileModal 
          currentUser={currentUser}
          onClose={() => {}}
          onProfileUpdate={onProfileUpdate}
          embeddedMode={true}
        />
      </div>
    </div>
  );
}
