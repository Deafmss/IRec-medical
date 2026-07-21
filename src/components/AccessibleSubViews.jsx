import React, { useState, useEffect } from 'react';

export function AccessibleTelemedicineView({ currentUser, setActiveTab, onStartVideoCall }) {
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural'))) || voices.find(v => v.lang.startsWith('pt'));
      if (ptVoice) utterance.voice = ptVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    speakText("Para falar por vídeo com o seu profissional de saúde, aperte no botão verde grande na tela.");
  }, []);

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      fontFamily: 'var(--font-primary, sans-serif)',
      textAlign: 'center'
    }}>
      {/* Top Welcome Card */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '3px solid #0284c7',
        borderRadius: '24px',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(2, 132, 199, 0.2)'
      }}>
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          backgroundColor: '#0284c7',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '44px',
          fontWeight: '900',
          border: '4px solid #38bdf8'
        }}>
          👩‍⚕️
        </div>

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#ffffff' }}>
            Atendimento de Enfermagem & Médico
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', margin: '6px 0 0 0', fontWeight: '600' }}>
            Seu profissional de saúde está disponível para te atender
          </p>
        </div>

        <button
          onClick={() => speakText("Para falar por vídeo com o seu profissional de saúde, aperte no botão verde grande na tela.")}
          style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '14px',
            padding: '10px 20px',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🔊</span>
          <span>OUVIR INSTRUÇÃO EM ÁUDIO</span>
        </button>
      </div>

      {/* GIANT CALL BUTTON */}
      <button
        onClick={() => {
          triggerVibration();
          onStartVideoCall();
        }}
        style={{
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: 'none',
          borderRadius: '28px',
          padding: '28px 20px',
          fontSize: '22px',
          fontWeight: '900',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          boxShadow: '0 12px 30px rgba(16, 185, 129, 0.4)',
          transition: 'transform 0.2s'
        }}
      >
        <span style={{ fontSize: '56px' }}>📞</span>
        <span>LIGAR POR VÍDEO AGORA</span>
        <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '700' }}>(Toque 1 vez para iniciar a chamada)</span>
      </button>

      {/* GIANT RETURN BUTTON */}
      <button
        onClick={() => {
          triggerVibration();
          setActiveTab('dashboard');
        }}
        style={{
          backgroundColor: '#334155',
          color: '#ffffff',
          border: '2px solid #475569',
          borderRadius: '20px',
          padding: '18px',
          fontSize: '18px',
          fontWeight: '800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <span>⬅</span>
        <span>VOLTAR À TELA INICIAL</span>
      </button>
    </div>
  );
}

export function AccessibleUploadView({ setActiveTab, onPhotoTaken }) {
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural'))) || voices.find(v => v.lang.startsWith('pt'));
      if (ptVoice) utterance.voice = ptVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    speakText("Aperte no botão roxo grande para abrir a câmera e tirar a foto da ferida ou da pele.");
  }, []);

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      triggerVibration();
      const reader = new FileReader();
      reader.onloadend = () => {
        alert("Foto capturada com sucesso! Nossa equipe de enfermagem receberá sua imagem.");
        setActiveTab('dashboard');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      fontFamily: 'var(--font-primary, sans-serif)',
      textAlign: 'center'
    }}>
      {/* Instructions Card */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '3px solid #6366f1',
        borderRadius: '24px',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(99, 102, 241, 0.2)'
      }}>
        <span style={{ fontSize: '56px' }}>📷</span>

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#ffffff' }}>
            Fotografar Ferida ou Pele
          </h2>
          <p style={{ fontSize: '16px', color: '#94a3b8', margin: '6px 0 0 0', fontWeight: '600' }}>
            Tire uma foto bem nítida da lesão para a enfermagem avaliar
          </p>
        </div>

        <button
          onClick={() => speakText("Aperte no botão roxo grande para abrir a câmera e tirar a foto da ferida ou da pele.")}
          style={{
            backgroundColor: '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '14px',
            padding: '10px 20px',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🔊</span>
          <span>OUVIR INSTRUÇÃO EM ÁUDIO</span>
        </button>
      </div>

      {/* GIANT CAMERA TRIGGER BUTTON */}
      <label style={{
        backgroundColor: '#6366f1',
        color: '#ffffff',
        borderRadius: '28px',
        padding: '32px 20px',
        fontSize: '22px',
        fontWeight: '900',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        boxShadow: '0 12px 30px rgba(99, 102, 241, 0.4)'
      }}>
        <span style={{ fontSize: '64px' }}>📸</span>
        <span>ABRIR CÂMERA E TIRAR FOTO</span>
        <span style={{ fontSize: '14px', opacity: 0.9, fontWeight: '700' }}>(Toque aqui para usar a câmera do celular)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </label>

      {/* GIANT RETURN BUTTON */}
      <button
        onClick={() => {
          triggerVibration();
          setActiveTab('dashboard');
        }}
        style={{
          backgroundColor: '#334155',
          color: '#ffffff',
          border: '2px solid #475569',
          borderRadius: '20px',
          padding: '18px',
          fontSize: '18px',
          fontWeight: '800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <span>⬅</span>
        <span>VOLTAR À TELA INICIAL</span>
      </button>
    </div>
  );
}
