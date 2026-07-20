import React, { useState, useEffect } from 'react';

export default function SOSEmergencyModal({ onClose, clinicalProfile }) {
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [pendingCall, setPendingCall] = useState(null); // { number: '192', label: 'SAMU' }
  const [notificationActivated, setNotificationActivated] = useState(false);

  const city = clinicalProfile?.city || '';
  const state = clinicalProfile?.state || '';
  const googleMapsUrl = `https://www.google.com/maps/search/hospital+pronto+socorro+upa+${encodeURIComponent(city + ' ' + state)}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationActivated(true);
      }
    }
  }, []);

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([60]);
    }
  };

  const requestNotificationPermission = async () => {
    triggerVibration();
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert("Seu navegador não suporta notificações de celular.");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationActivated(true);
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('🚨 SOS iRec - Atendimento de Emergência', {
            body: 'Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima.',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: 'irec-sos-persistent',
            requireInteraction: true
          });
        }
        alert("Notificação fixa de emergência ativada com sucesso no seu celular!");
      } else {
        alert("Permissão para notificações foi negada. Ative as notificações nas configurações do navegador do seu celular.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Anti-accidental click countdown for emergency call
  const startCallCountdown = (number, label) => {
    triggerVibration();
    setPendingCall({ number, label });
    setCountdown(3);
  };

  useEffect(() => {
    let timer = null;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && pendingCall) {
      // Execute the phone call
      window.location.href = `tel:${pendingCall.number}`;
      setCountdown(null);
      setPendingCall(null);
    }
    return () => clearTimeout(timer);
  }, [countdown, pendingCall]);

  const cancelCallCountdown = () => {
    triggerVibration();
    setCountdown(null);
    setPendingCall(null);
  };

  const firstAidGuides = [
    {
      id: 'chest_pain',
      title: '🫀 Dor Forte no Peito',
      color: '#ef4444',
      steps: [
        'Mantenha a pessoa sentada e em repouso absoluto.',
        'Afrouxe roupas apertadas na gola e cintura.',
        'Disque 192 (SAMU) imediatamente.',
        'Não ofereça comida ou bebidas sem orientação médica.'
      ]
    },
    {
      id: 'choking',
      title: '🫁 Engasgo ou Falta de Ar',
      color: '#f59e0b',
      steps: [
        'Se a pessoa consegue tossir, incentive a tosse.',
        'Se não consegue falar ou respirar: aplique compressões abdominais para cima e para dentro (Manobra de Heimlich).',
        'Peça a alguém para ligar 192 (SAMU) imediatamente.'
      ]
    },
    {
      id: 'faint',
      title: '💫 Tontura Forte ou Desmaio',
      color: '#8b5cf6',
      steps: [
        'Deite a pessoa de costas e eleve as pernas ligeiramente.',
        'Gire a cabeça de lado se houver risco de vômito.',
        'Não coloque sal na boca e não jogue água fria.',
        'Verifique se a respiração está normal.'
      ]
    },
    {
      id: 'bleeding',
      title: '🩸 Sangramento ou Corte Profundo',
      color: '#dc2626',
      steps: [
        'Pressione o local do sangramento com pano limpo ou gaze firmemente.',
        'Mantenha a pressão contínua sem retirar o pano para olhar.',
        'Eleve o membro ferido acima do nível do coração se possível.',
        'Procure a UPA mais próxima ou ligue 192.'
      ]
    }
  ];

  const speakText = (text) => {
    triggerVibration();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      backdropFilter: 'blur(12px)',
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
        maxHeight: '92vh',
        overflowY: 'auto',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '3px solid #ef4444',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.4)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              animation: 'pulseSOS 1.5s infinite'
            }}>
              🚨
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>SOCORRO & EMERGÊNCIA</h2>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Suporte à Vida 24 horas - iRec</span>
            </div>
          </div>
          <button 
            onClick={() => { triggerVibration(); onClose(); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Mobile Persistent Notification Activator Button */}
        {!notificationActivated && (
          <button
            onClick={requestNotificationPermission}
            style={{
              backgroundColor: '#334155',
              color: '#38bdf8',
              border: '1px solid #0284c7',
              borderRadius: '14px',
              padding: '12px 16px',
              fontWeight: '700',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🔔</span>
            <span>Ativar Notificação Fixa de SOS no Celular</span>
          </button>
        )}

        {/* Anti-Accidental Call Countdown Overlay */}
        {countdown !== null && pendingCall && (
          <div style={{
            backgroundColor: '#dc2626',
            borderRadius: '20px',
            padding: '20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            animation: 'pulseSOS 1s infinite'
          }}>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
              LIGANDO PARA O {pendingCall.label} ({pendingCall.number}) EM:
            </span>
            <span style={{ fontSize: '54px', fontWeight: '900', color: '#ffffff' }}>
              {countdown}s
            </span>
            <button
              onClick={cancelCallCountdown}
              style={{
                backgroundColor: '#ffffff',
                color: '#dc2626',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: '800',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ❌ CANCELAR LIGAÇÃO
            </button>
          </div>
        )}

        {/* Emergency Call Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => startCallCountdown('192', 'SAMU')}
            style={{
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '18px 12px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: '800',
              fontSize: '18px',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(220, 38, 38, 0.4)'
            }}
          >
            <span style={{ fontSize: '28px' }}>📞 192</span>
            <span style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9 }}>LIGAR SAMU</span>
          </button>

          <button
            onClick={() => startCallCountdown('193', 'BOMBEIROS')}
            style={{
              border: 'none',
              backgroundColor: '#d97706',
              color: '#ffffff',
              padding: '18px 12px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: '800',
              fontSize: '18px',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(217, 119, 6, 0.4)'
            }}
          >
            <span style={{ fontSize: '28px' }}>🚒 193</span>
            <span style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9 }}>BOMBEIROS</span>
          </button>
        </div>

        {/* Route to nearest Hospital / UPA */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={triggerVibration}
          style={{
            textDecoration: 'none',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '16px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontWeight: '700',
            fontSize: '16px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}
        >
          <span style={{ fontSize: '24px' }}>🏥</span>
          <span>IR PARA HOSPITAL / UPA MAIS PRÓXIMO (MAPA)</span>
        </a>

        {/* Legal Disclaimer */}
        <div style={{ fontSize: '11.5px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.5', padding: '0 8px' }}>
          ⚖️ <strong>Aviso Legal & Regulatório:</strong> O iRec é uma plataforma de suporte e navegação em saúde. Em situações de emergência grave, recorra imediatamente ao 192 (SAMU) ou dirija-se à unidade de saúde mais próxima.
        </div>

        {/* First Aid Quick Guides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ margin: '8px 0 4px 0', fontSize: '15px', color: '#cbd5e1', fontWeight: '700' }}>
            💡 Guia Rápido de Primeiros Socorros:
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {firstAidGuides.map((guide) => (
              <button
                key={guide.id}
                onClick={() => { triggerVibration(); setSelectedEmergency(guide); }}
                style={{
                  backgroundColor: selectedEmergency?.id === guide.id ? guide.color : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '700',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                {guide.title}
              </button>
            ))}
          </div>

          {selectedEmergency && (
            <div style={{
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              padding: '16px',
              borderLeft: `4px solid ${selectedEmergency.color}`,
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: selectedEmergency.color }}>{selectedEmergency.title}</h4>
                <button
                  onClick={() => speakText(`${selectedEmergency.title}. ${selectedEmergency.steps.join('. ')}`)}
                  style={{
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  🔊 Ouvir Passos
                </button>
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6' }}>
                {selectedEmergency.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulseSOS {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}</style>
      </div>
    </div>
  );
}
