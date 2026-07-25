import React, { useState, useEffect } from 'react';
import { chatWithDoctorCopilot } from '../services/geminiService';
import { speakNaturalText } from '../utils/speechUtils';

// Humanized non-robotic fallback responses for short/unclear audio noise
const NOISE_FALLBACK_PHRASES = [
  "Olá! Não consegui entender direitinho. Pode me contar com calma: o que você está sentindo hoje?",
  "Acho que o som saiu um pouco baixinho. Aperte o botão azul e me diga se está com dor de cabeça, enjoo ou febre.",
  "Ops, não deu para te ouvir bem. Pode falar bem pertinho do celular para eu te orientar?",
  "Não entendi a gravação. Me diga: o que está te incomodando no seu corpo hoje?"
];

const getRandomNoisePhrase = () => {
  return NOISE_FALLBACK_PHRASES[Math.floor(Math.random() * NOISE_FALLBACK_PHRASES.length)];
};

// First-Line Virtual Health Assistant Engine (Cuidados Primários e Triagem Carinhosa)
const getSmartLocalAdvice = (queryText) => {
  const text = (queryText || '').toLowerCase();

  // 1. DOR DE CABEÇA / ENXAQUECA / TONTURA
  if (text.includes('cabeça') || text.includes('enxaqueca') || text.includes('tontura') || text.includes('labirintite')) {
    return {
      title: '🤕 ORIENTAÇÃO PARA DOR DE CABEÇA E TONTURA LEVE',
      isEmergency: false,
      text: 'Olá! Entendo seu desconforto. Para dor de cabeça ou tontura leve, o melhor a fazer é ficar em um quarto silencioso e com pouca luz, tomar um bom copo de água e repousar. Você não precisa ir ao hospital por uma dor de cabeça simples! Fique calmo e descanse. Só procure a emergência se a dor surgir de repente de forma insuportável ou se tiver visão borrada e perda de força no braço.'
    };
  }

  // 2. ENJOO / MÁ DIGESTÃO / VÔMITO / DOR DE BARRIGA
  if (text.includes('enjoo') || text.includes('estômago') || text.includes('barriga') || text.includes('vômito') || text.includes('vomito') || text.includes('náusea') || text.includes('digestão')) {
    return {
      title: '🤢 ORIENTAÇÃO PARA ENJOO OU MAL-ESTAR ABDOMINAL',
      isEmergency: false,
      text: 'Sinto muito pelo enjoo! Para aliviar o desconforto na barriga, sente-se confortavelmente, tome pequenos goles de água fresca ou chá morno e evite alimentos gordurosos. Não há necessidade de ir ao pronto-socorro por um enjoo comum. Descanse e aguarde o organismo se recuperar com calma.'
    };
  }

  // 3. FEBRE LEVE / CALAFRIO / GRIPE
  if (text.includes('febre') || text.includes('calafrio') || text.includes('gripe') || text.includes('resfriado') || text.includes('coriza')) {
    return {
      title: '🤒 ORIENTAÇÃO PARA FEBRE OU GRIPE LEVE',
      isEmergency: false,
      text: 'Se estiver com febre baixa ou corpo pesado, coloque roupas leves, beba bastante água e repouse. Meça sua temperatura com o termômetro. Se estiver abaixo de 38,5°C, você pode se cuidar em casa com toda segurança sem precisar ir ao hospital.'
    };
  }

  // 4. DOR NAS COSTAS / MUSCULAR / CORPO MOÍDO
  if (text.includes('costas') || text.includes('pescoço') || text.includes('muscular') || text.includes('corpo') || text.includes('coluna') || text.includes('perna')) {
    return {
      title: '💪 ORIENTAÇÃO PARA DOR MUSCULAR OU NAS COSTAS',
      isEmergency: false,
      text: 'Dor nas costas ou tensão muscular melhora muito descansando em uma posição confortável e colocando uma compressa morna por 15 minutos. Evite carregar peso. É uma dor comum do dia a dia e você não precisa ir ao hospital por isso.'
    };
  }

  // 5. FERIDA / CORTE / MACHUCADO
  if (text.includes('ferida') || text.includes('corte') || text.includes('sangue') || text.includes('machucado') || text.includes('úlcera') || text.includes('curativo')) {
    return {
      title: '🩺 CUIDADO COM FERIDAS E CORTES',
      isEmergency: false,
      text: 'Para um corte ou ferida leve, lave delicadamente com soro fisiológico ou água corrente limpa e proteja com uma gaze. Não precisa ir ao hospital: você pode agendar uma avaliação com nossos enfermeiros especialistas no próprio aplicativo sem sair de casa!'
    };
  }

  // 6. EMERGÊNCIAS REAIS (DOR NO PEITO / FALTA DE AR INTENSA / AVC)
  if (text.includes('peito') || text.includes('coração') || text.includes('ar') || text.includes('sufocamento') || text.includes('desmaio') || text.includes('derrame') || text.includes('avc')) {
    return {
      title: '🚨 ATENÇÃO: SINAL DE URGÊNCIA',
      isEmergency: true,
      text: 'ATENÇÃO: Dor forte ou aperto no peito, falta de ar intensa ou perda repentina de força no corpo são sinais de urgência! Mantenha a calma, sente-se e aperte o botão vermelho de emergência SOS para ligar para o 192 (SAMU).'
    };
  }

  // Default Empathetic First-Line Response
  return {
    title: '💙 PRIMEIRO ATENDIMENTO IREC',
    isEmergency: false,
    text: `Olá! Entendi que você está sentindo: "${queryText}". Para sintomas leves e desconfortos comuns, o melhor remedinho é manter a calma, tomar um copo de água fresca e descansar em um lugar bem confortável. Você não precisa ir ao hospital por sintomas simples. Fique tranquilo e se os sintomas continuarem, fale com nossos profissionais no aplicativo!`
  };
};

export default function AccessibleDashboard({ 
  clinicalProfile, 
  setActiveTab, 
  onOpenSOS 
}) {
  const [selectedSymptom, setSelectedSymptom] = useState(null);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
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
      setNotificationStatus(perm);
      if (perm === 'granted') {
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
        alert("Notificação fixa de emergência ativada na barra do celular!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const symptomCategories = [
    {
      id: 'head',
      title: 'DOR DE CABEÇA / TONTURA',
      icon: '🤕',
      color: '#f59e0b',
      guidance: 'Para dor de cabeça ou tontura leve, descanse em um quarto calmo e escuro, tome bastante água e repouse. Não é necessário ir ao hospital por dor de cabeça comum. Fique calmo!'
    },
    {
      id: 'fever',
      title: 'FEBRE LEVE OU CALAFRIO',
      icon: '🤒',
      color: '#ef4444',
      guidance: 'Se estiver com febre baixa, vista roupas leves, tome água fresca e descanse. Se a febre for menor que 38,5°C, você pode se cuidar em casa com toda segurança.'
    },
    {
      id: 'chest',
      title: 'DOR NO PEITO (URGÊNCIA)',
      icon: '🫀',
      color: '#dc2626',
      guidance: '🚨 ATENÇÃO: Dor forte ou aperto no peito é sinal de urgência! Mantenha a calma, sente-se e aperte o botão vermelho de emergência SOS para ligar 192.'
    },
    {
      id: 'breath',
      title: 'FALTA DE AR (URGÊNCIA)',
      icon: '🫁',
      color: '#dc2626',
      guidance: '🚨 ATENÇÃO: Dificuldade intensa para respirar exige socorro rápido! Sente-se ereto e aperte o botão vermelho de emergência SOS.'
    },
    {
      id: 'wound',
      title: 'FERIDA OU CORTE',
      icon: '🩺',
      color: '#0284c7',
      guidance: 'Lave o corte com soro ou água limpa e proteja com pano limpo. Não precisa ir ao hospital: você pode agendar um atendimento de enfermagem no próprio aplicativo!'
    },
    {
      id: 'belly',
      title: 'ENJOO OU DOR NA BARRIGA',
      icon: '🤢',
      color: '#8b5cf6',
      guidance: 'Para enjoo ou dor de barriga simples, tome pequenos goles de água fresca e descanse. Não há necessidade de ir ao hospital por um enjoo comum. Aguarde passar!'
    }
  ];

  const speakText = (text) => {
    speakNaturalText(text);
  };

  const processSymptomQuery = async (queryText) => {
    const cleanText = queryText ? queryText.trim() : '';
    if (!cleanText || cleanText.length < 3 || /^(é|hum|ah|eh|oh|oi)$/i.test(cleanText)) {
      const friendlyPhrase = getRandomNoisePhrase();
      setAiResponse(friendlyPhrase);
      speakText(friendlyPhrase);
      return;
    }

    // 1. INSTANT FIRST-LINE HEALTH ADVICE (Immediate Audio Feedback)
    const localAdvice = getSmartLocalAdvice(cleanText);
    setAiResponse(localAdvice.text);
    speakText(localAdvice.text);

    // 2. ENHANCE WITH GEMINI AI IF AVAILABLE
    setLoadingAi(true);
    try {
      const systemPrompt = `Você é o Assistente iRec de Primeiro Atendimento em Saúde para idosos e leigos. O usuário disse: "${cleanText}". Dê uma orientação de primeiro atendimento extremamente simples, carinhosa e prática para cuidar em casa (ex: repousar, beber água, compressa morna). Acalme o paciente e deixe bem claro se é um sintoma simples que NÃO precisa ir ao hospital, ou se é urgência real. Máximo 3 frases curtas.`;
      const result = await chatWithDoctorCopilot(systemPrompt, [{ role: 'user', content: cleanText }], clinicalProfile, [], null);
      
      if (result?.reply && result.reply.length > 15) {
        setAiResponse(result.reply);
        speakText(result.reply);
      }
    } catch (e) {
      console.warn("[iRec Primeiro Atendimento] Usando conselho local inteligente de saúde:", e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSelectSymptom = (cat) => {
    triggerVibration();
    setSelectedSymptom(cat);
    const recommendation = cat.guidance;
    setAiResponse(recommendation);
    speakText(recommendation);
  };

  const handleVoiceRecord = () => {
    triggerVibration();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = "Olá! Para ouvir uma orientação de primeiro atendimento, toque em uma das opções com desenho abaixo!";
      speakText(msg);
      alert("Seu navegador não suporta microfone automático. Toque nas fotos dos sintomas abaixo!");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceQuery(transcript);
        setIsRecording(false);
        processSymptomQuery(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        const fallbackMsg = "Ops, não consegui te ouvir bem! Toque no botão de microfone e fale de novo perto do celular.";
        setAiResponse(fallbackMsg);
        speakText(fallbackMsg);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    }
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: 'var(--font-primary, sans-serif)'
    }}>
      {/* Top Welcome & Mode Indicator */}
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '20px',
        padding: '20px',
        border: '2px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            fontSize: '36px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            👵
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff' }}>
              Olá, {clinicalProfile?.name?.split(' ')[0] || 'Amigo(a)'}!
            </h1>
            <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '600' }}>
              Primeiro Atendimento iRec (Modo Fácil)
            </span>
          </div>
        </div>

        {/* SOS Trigger */}
        <button
          onClick={() => { triggerVibration(); onOpenSOS(); }}
          style={{
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: '16px',
            padding: '14px 20px',
            fontWeight: '800',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)'
          }}
        >
          <span style={{ fontSize: '22px' }}>🚨</span>
          <span>SOCORRO / EMERGÊNCIA</span>
        </button>
      </div>

      {/* Persistent Notification Activator Bar */}
      {notificationStatus !== 'granted' && (
        <button
          onClick={requestNotificationPermission}
          style={{
            backgroundColor: '#1e293b',
            color: '#38bdf8',
            border: '2px dashed #0284c7',
            borderRadius: '16px',
            padding: '14px 18px',
            fontWeight: '800',
            fontSize: '14.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '20px' }}>🔔</span>
          <span>ATIVAR ALERTA FIXO DE EMERGÊNCIA NA BARRA DO CELULAR</span>
        </button>
      )}

      {/* Big Voice Button for First-Line Care */}
      <div style={{
        backgroundColor: isRecording ? '#dc2626' : '#0284c7',
        borderRadius: '24px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        cursor: 'pointer',
        boxShadow: '0 10px 25px rgba(2, 132, 199, 0.3)',
        transition: 'all 0.3s'
      }}
      onClick={handleVoiceRecord}
      >
        <span style={{ fontSize: '48px' }}>{isRecording ? '🎙️🔴' : '🎙️'}</span>
        <span style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', textAlign: 'center' }}>
          {isRecording ? 'OUVINDO... FALE O SEU SINTOMA!' : 'APERTE AQUI E FALE O QUE ESTÁ SENTINDO'}
        </span>
        <span style={{ fontSize: '13.5px', color: '#e0f2fe', fontWeight: '600' }}>
          Exemplo: "Estou com dor de cabeça", "Estou com enjoo"
        </span>
      </div>

      {voiceQuery && (
        <div style={{ fontSize: '15px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
          Você falou: "{voiceQuery}"
        </div>
      )}

      {loadingAi && (
        <div style={{
          padding: '16px',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #0284c7',
          textAlign: 'center',
          color: '#38bdf8',
          fontSize: '18px',
          fontWeight: '700'
        }}>
          ⏳ O assistente iRec está preparando sua orientação de saúde...
        </div>
      )}

      {aiResponse && !loadingAi && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          padding: '22px',
          border: '3px solid #38bdf8',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(56, 189, 248, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#38bdf8' }}>
              🔊 Orientação de Primeiro Atendimento iRec:
            </span>
            <button
              onClick={() => speakText(aiResponse)}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 16px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              🔊 Ouvir De Novo
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '19px', lineHeight: '1.65', color: '#ffffff', fontWeight: '600' }}>
            "{aiResponse}"
          </p>
        </div>
      )}

      {/* Symptom Selection Cards */}
      <div>
        <div style={{
          backgroundColor: 'var(--bg-secondary, #1e293b)',
          padding: '14px 20px',
          borderRadius: '16px',
          border: '2px solid #0284c7',
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary, #ffffff)', margin: 0 }}>
            👉 Ou toque na imagem do que está sentindo:
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {symptomCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelectSymptom(cat)}
              style={{
                backgroundColor: selectedSymptom?.id === cat.id ? cat.color : '#1e293b',
                border: `3px solid ${cat.color}`,
                borderRadius: '20px',
                padding: '20px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              <span style={{ fontSize: '42px' }}>{cat.icon}</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', textAlign: 'center' }}>
                {cat.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Direct Quick Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
        <button
          onClick={() => { triggerVibration(); setActiveTab('upload'); }}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '18px',
            fontSize: '16px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)'
          }}
        >
          <span style={{ fontSize: '32px' }}>📸</span>
          <span>ENVIAR FOTO DA FERIDA</span>
        </button>

        <button
          onClick={() => { triggerVibration(); setActiveTab('nurses'); }}
          style={{
            backgroundColor: '#8b5cf6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '18px',
            fontSize: '16px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 6px 16px rgba(139, 92, 246, 0.3)'
          }}
        >
          <span style={{ fontSize: '32px' }}>👨‍⚕️</span>
          <span>FALAR COM ENFERMEIRO</span>
        </button>
      </div>
    </div>
  );
}
