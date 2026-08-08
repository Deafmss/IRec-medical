import React, { useState, useEffect } from 'react';

export default function SOSEmergencyModal({ onClose, clinicalProfile }) {
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [pendingCall, setPendingCall] = useState(null); // { number: '192', label: 'SAMU' }
  const [notificationActivated, setNotificationActivated] = useState(false);
  const [userGps, setUserGps] = useState(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("GPS de emergência não capturado:", err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const street = clinicalProfile?.street || '';
  const number = clinicalProfile?.number || '';
  const neighborhood = clinicalProfile?.neighborhood || '';
  const city = clinicalProfile?.city || '';
  const state = clinicalProfile?.state || '';
  const cep = clinicalProfile?.cep || '';

  const fullPhysicalAddress = [street, number, neighborhood, city, state, cep ? `CEP ${cep}` : ''].filter(Boolean).join(', ');

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
      color: '#a855f7',
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
      color: '#f43f5e',
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

  const handleOpenMapsGPS = (e) => {
    e.preventDefault();
    triggerVibration();

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const directMapsUrl = `https://www.google.com/maps/search/hospital+pronto+socorro+upa/@${lat},${lng},15z`;
          window.open(directMapsUrl, '_blank');
        },
        (err) => {
          console.warn("[iRec] Usando fallback de cidade/estado do cadastro:", err);
          const cityQuery = (city || state) ? `${city} ${state}`.trim() : '';
          const fallbackUrl = `https://www.google.com/maps/search/hospital+pronto+socorro+upa+${encodeURIComponent(cityQuery)}`;
          window.open(fallbackUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      const cityQuery = (city || state) ? `${city} ${state}`.trim() : '';
      const fallbackUrl = `https://www.google.com/maps/search/hospital+pronto+socorro+upa+${encodeURIComponent(cityQuery)}`;
      window.open(fallbackUrl, '_blank');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'var(--font-primary, sans-serif)'
    }} onClick={() => { triggerVibration(); onClose(); }}>
      
      {/* Glassmorphism Container com Luz Vazada Vermelha Neon & Alto Contraste */}
      <div 
        className="glass-card glass-card-danger-glow neon-edge-danger" 
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0f172a',
          border: '1.5px solid rgba(239, 68, 68, 0.45)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -10px rgba(239, 68, 68, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
          padding: '24px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          margin: 0,
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 0 18px rgba(239, 68, 68, 0.6)'
            }}>
              🚨
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#ffffff', fontFamily: 'var(--font-display)' }}>
                SOCORRO & EMERGÊNCIA
              </h2>
              <span style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: '600' }}>Suporte à Vida 24 horas - iRec Saúde</span>
            </div>
          </div>
          <button 
            onClick={() => { triggerVibration(); onClose(); }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            ✖ Fechar
          </button>
        </div>

        {/* Mobile Persistent Notification Activator Button */}
        {!notificationActivated && (
          <button
            onClick={requestNotificationPermission}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: '700',
              backgroundColor: 'rgba(2, 132, 199, 0.2)',
              border: '1px solid #0284c7',
              color: '#ffffff',
              borderRadius: '12px',
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
            position: 'relative',
            zIndex: 1,
            backgroundColor: '#dc2626',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            border: '2px solid #ffffff',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.8)'
          }}>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
              LIGANDO PARA O {pendingCall.label} ({pendingCall.number}) EM:
            </span>
            <span style={{ fontSize: '52px', fontWeight: '900', color: '#ffffff', fontFamily: 'var(--font-display)' }}>
              {countdown}s
            </span>
            <button
              onClick={cancelCallCountdown}
              style={{
                backgroundColor: '#ffffff',
                color: '#dc2626',
                padding: '10px 20px',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              ❌ CANCELAR LIGAÇÃO
            </button>
          </div>
        )}

        {/* Emergency Call Buttons */}
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <button
            onClick={() => startCallCountdown('192', 'SAMU')}
            className="btn btn-sos"
            style={{
              padding: '18px 14px',
              borderRadius: '16px',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '26px' }}>📞 192</span>
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#ffffff' }}>LIGAR SAMU</span>
          </button>

          <button
            onClick={() => startCallCountdown('193', 'BOMBEIROS')}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              padding: '18px 14px',
              borderRadius: '16px',
              flexDirection: 'column',
              gap: '4px',
              boxShadow: '0 4px 18px -2px rgba(245, 158, 11, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.3)'
            }}
          >
            <span style={{ fontSize: '26px' }}>🚒 193</span>
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#ffffff' }}>BOMBEIROS</span>
          </button>
        </div>

        {/* Route to nearest Hospital / UPA with Real GPS */}
        <button
          onClick={handleOpenMapsGPS}
          className="btn btn-primary"
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '16px',
            borderRadius: '16px',
            fontSize: '13.5px',
            fontWeight: '800'
          }}
        >
          <span style={{ fontSize: '20px' }}>🏥</span>
          <span>IR PARA HOSPITAL / UPA MAIS PRÓXIMO (GPS REAL)</span>
        </button>

        {/* Legal Disclaimer */}
        <div style={{ position: 'relative', zIndex: 1, fontSize: '11.5px', color: '#cbd5e1', textAlign: 'center', lineHeight: '1.5', padding: '0 8px' }}>
          ⚖️ <strong>Aviso Legal & Regulatório:</strong> O iRec é uma plataforma de suporte e navegação em saúde. Em situações de emergência grave, recorra imediatamente ao 192 (SAMU) ou dirija-se à unidade de saúde mais próxima.
        </div>

        {/* First Aid Quick Guides */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ margin: '4px 0 4px 0', fontSize: '15px', color: '#ffffff', fontWeight: '800' }}>
            💡 Guia Rápido de Primeiros Socorros:
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {firstAidGuides.map((guide) => {
              const isSelected = selectedEmergency?.id === guide.id;
              return (
                <button
                  key={guide.id}
                  onClick={() => { triggerVibration(); setSelectedEmergency(isSelected ? null : guide); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '800',
                    textAlign: 'left',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                    border: isSelected ? `1.5px solid ${guide.color}` : '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 0 14px ${guide.color}` : 'none'
                  }}
                >
                  <span style={{ color: '#ffffff', fontWeight: '800' }}>{guide.title}</span>
                </button>
              );
            })}
          </div>

          {selectedEmergency && (
            <div style={{
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              padding: '16px',
              borderLeft: `4px solid ${selectedEmergency.color}`,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderLeftWidth: '4px',
              marginTop: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: selectedEmergency.color }}>{selectedEmergency.title}</h4>
                <button
                  onClick={() => speakText(`${selectedEmergency.title}. ${selectedEmergency.steps.join('. ')}`)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  🔊 Ouvir Passos
                </button>
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', color: '#f8fafc', fontSize: '13.5px', lineHeight: '1.6', fontWeight: '500' }}>
                {selectedEmergency.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
