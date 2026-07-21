import React, { useState } from 'react';
import { speakNaturalText } from '../utils/speechUtils';

export default function PermissionsGuideModal({ onClose }) {
  const isIOSDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [activeTab, setActiveTab] = useState(isIOSDevice ? 'ios' : 'android');

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handleSpeakInstructions = () => {
    triggerVibration();
    if (activeTab === 'ios') {
      speakNaturalText("No iPhone, para instalar o app, toque no botão de compartilhar com uma seta no Safari e escolha Adicionar à Tela de Início. Quando o app pedir para usar câmera ou microfone, toque em permitir.");
    } else {
      speakNaturalText("No celular Android, toque no botão verde de Instalar App no topo. Depois vá nas configurações do celular em Aplicativos e libere câmera, microfone e notificações.");
    }
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
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '2px solid #0284c7',
        boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.3)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📋</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#ffffff' }}>
                Guia de Instalação e Permissões
              </h3>
              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                Como liberar Câmera, Microfone, GPS e Notificações
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

        {/* Device Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={() => { triggerVibration(); setActiveTab('ios'); }}
            style={{
              backgroundColor: activeTab === 'ios' ? '#0284c7' : '#0f172a',
              border: `2px solid ${activeTab === 'ios' ? '#38bdf8' : '#334155'}`,
              color: '#ffffff',
              borderRadius: '14px',
              padding: '12px',
              fontWeight: '800',
              fontSize: '14.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🍏</span>
            <span>iPhone (iOS)</span>
          </button>

          <button
            onClick={() => { triggerVibration(); setActiveTab('android'); }}
            style={{
              backgroundColor: activeTab === 'android' ? '#10b981' : '#0f172a',
              border: `2px solid ${activeTab === 'android' ? '#34d399' : '#334155'}`,
              color: '#ffffff',
              borderRadius: '14px',
              padding: '12px',
              fontWeight: '800',
              fontSize: '14.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🤖</span>
            <span>Android</span>
          </button>
        </div>

        {/* Voice Audio Help Button */}
        <button
          onClick={handleSpeakInstructions}
          style={{
            backgroundColor: '#0369a1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '12px',
            fontWeight: '800',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>🔊</span>
          <span>OUVIR EXPLICAÇÃO POR VOZ</span>
        </button>

        {/* iOS Tab Content */}
        {activeTab === 'ios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#38bdf8', fontWeight: '800' }}>
                1. Como Baixar o App no iPhone:
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.7' }}>
                <li>Abra o <strong>Safari</strong> do seu iPhone e acesse o iRec.</li>
                <li>Toque no ícone de <strong>Compartilhar 📤</strong> (na barra inferior do Safari).</li>
                <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início" ➕</strong>.</li>
                <li>Toque em <strong>Adicionar</strong> (o app fica salvo na sua tela principal!).</li>
              </ol>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#34d399', fontWeight: '800' }}>
                2. Como Liberar Câmera, Microfone e Notificações no iPhone:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.7' }}>
                <li>No primeiro uso, toque sempre em <strong>PERMITIR</strong> nas mensagens da tela.</li>
                <li>Caso tenha negado sem querer, vá nos <strong>Ajustes ⚙️ ➔ Safari ➔ Câmera/Microfone</strong> e mude para <strong>Permitir</strong>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Android Tab Content */}
        {activeTab === 'android' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#34d399', fontWeight: '800' }}>
                1. Como Baixar o App no Android:
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.7' }}>
                <li>Toque no botão verde <strong>"📲 Instalar App"</strong> no topo da tela do iRec.</li>
                <li>Confirme em <strong>Instalar</strong>.</li>
              </ol>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#38bdf8', fontWeight: '800' }}>
                2. Como Liberar Câmera, Microfone e GPS no Android:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.7' }}>
                <li>Vá nas <strong>Configurações ⚙️ ➔ Aplicativos ➔ Chrome / iRec</strong>.</li>
                <li>Toque em <strong>Permissões</strong> e marque Câmera, Microfone, Notificações e Localização como <strong>Permitir durante o uso</strong>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={() => { triggerVibration(); onClose(); }}
          style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '14px',
            padding: '14px',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            width: '100%',
            marginTop: '6px'
          }}
        >
          ENTENDI E CONCLUÍ
        </button>
      </div>
    </div>
  );
}
