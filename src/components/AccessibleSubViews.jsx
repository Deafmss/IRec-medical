import { useEffect } from 'react';
import { speakNaturalText } from '../utils/speechUtils';

export function AccessibleTelemedicineView({ setActiveTab, onStartVideoCall }) {
  useEffect(() => {
    speakNaturalText("Para falar por vídeo com o seu profissional de saúde, aperte no botão verde grande na tela.");
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  return (
    <div className="animate-fade-in" style={{
      maxWidth: '640px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: 'var(--font-primary, sans-serif)',
      textAlign: 'center'
    }}>
      {/* Top Welcome Card */}
      <div className="glass-card glass-card-cyan-glow" style={{
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        backgroundColor: 'rgba(255, 255, 255, 0.96)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          color: '#0284c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          fontWeight: '900',
          border: '1px solid rgba(2, 132, 199, 0.3)'
        }}>
          👩‍⚕️
        </div>

        <div>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            color: '#0284c7',
            fontSize: '11px',
            fontWeight: '800',
            padding: '3px 12px',
            borderRadius: '50px',
            marginBottom: '6px'
          }}>
            📹 TELECONSULTA DE ENFERMAGEM & MÉDICA
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Atendimento Clínico por Vídeo
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '6px 0 0 0', fontWeight: '600' }}>
            Seu profissional de saúde está a um toque de distância
          </p>
        </div>

        <button
          type="button"
          onClick={() => speakNaturalText("Para falar por vídeo com o seu profissional de saúde, aperte no botão verde grande na tela.")}
          style={{
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            color: '#0284c7',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: '50px',
            padding: '10px 20px',
            fontWeight: '800',
            fontSize: '13.5px',
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
        type="button"
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
          fontSize: '20px',
          fontWeight: '900',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          boxShadow: '0 12px 30px rgba(16, 185, 129, 0.35)',
          fontFamily: 'var(--font-display)',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ fontSize: '52px' }}>📞</span>
        <span>LIGAR POR VÍDEO AGORA</span>
        <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '700' }}>(Toque 1 vez para iniciar a chamada)</span>
      </button>

      {/* GIANT RETURN BUTTON */}
      <button
        type="button"
        onClick={() => {
          triggerVibration();
          setActiveTab('dashboard');
        }}
        className="glass-card"
        style={{
          borderRadius: '20px',
          padding: '16px',
          fontSize: '16px',
          fontWeight: '800',
          color: 'var(--text-primary)',
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
  useEffect(() => {
    speakNaturalText("Aperte no botão roxo grande para abrir a câmera e tirar a foto da ferida ou da pele.");
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerVibration();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && onPhotoTaken) {
          onPhotoTaken(reader.result);
        }
        alert("Foto capturada com sucesso! Nossa equipe de enfermagem receberá sua imagem.");
        setActiveTab('dashboard');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="animate-fade-in" style={{
      maxWidth: '640px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: 'var(--font-primary, sans-serif)',
      textAlign: 'center'
    }}>
      {/* Instructions Card */}
      <div className="glass-card glass-card-cyan-glow" style={{
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        backgroundColor: 'rgba(255, 255, 255, 0.96)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          color: '#0284c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          fontWeight: '900',
          border: '1px solid rgba(2, 132, 199, 0.3)'
        }}>
          📷
        </div>

        <div>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            color: '#0284c7',
            fontSize: '11px',
            fontWeight: '800',
            padding: '3px 12px',
            borderRadius: '50px',
            marginBottom: '6px'
          }}>
            📸 REGISTRO FOTOGRÁFICO DE FERIDA
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Fotografar Ferida ou Pele
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '6px 0 0 0', fontWeight: '600' }}>
            Tire uma foto bem nítida da lesão para a enfermagem avaliar
          </p>
        </div>

        <button
          type="button"
          onClick={() => speakNaturalText("Aperte no botão roxo grande para abrir a câmera e tirar a foto da ferida ou da pele.")}
          style={{
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            color: '#0284c7',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: '50px',
            padding: '10px 20px',
            fontWeight: '800',
            fontSize: '13.5px',
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
        backgroundColor: '#0284c7',
        color: '#ffffff',
        borderRadius: '28px',
        padding: '32px 20px',
        fontSize: '20px',
        fontWeight: '900',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        boxShadow: '0 12px 30px rgba(2, 132, 199, 0.35)',
        fontFamily: 'var(--font-display)',
        transition: 'all 0.2s ease'
      }}>
        <span style={{ fontSize: '56px' }}>📸</span>
        <span>ABRIR CÂMERA E TIRAR FOTO</span>
        <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '700' }}>(Toque aqui para usar a câmera do celular)</span>
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
        type="button"
        onClick={() => {
          triggerVibration();
          setActiveTab('dashboard');
        }}
        className="glass-card"
        style={{
          borderRadius: '20px',
          padding: '16px',
          fontSize: '16px',
          fontWeight: '800',
          color: 'var(--text-primary)',
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
