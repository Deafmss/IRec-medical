import React, { useState, useEffect } from 'react';
import { chatWithDoctorCopilot } from '../services/geminiService';

// Humanized non-robotic fallback responses for short/unclear audio noise (General Health Context)
const NOISE_FALLBACK_PHRASES = [
  // Categoria 1: Ouvir de novo / Som baixo
  [
    "Desculpe, não consegui te ouvir direito. Pode repetir bem pertinho do celular?",
    "Ops, o som saiu um pouco baixinho. Consegue falar de novo um pouquinho mais alto?",
    "Hum, não deu para entender muito bem. Pode repetir para mim?",
    "Desculpe, acho que não peguei essa parte. Fale comigo de novo, por favor!"
  ],
  // Categoria 2: Barulho no ambiente
  [
    "Acho que um barulho no ambiente atrapalhou um pouquinho. Pode falar mais perto do microfone?",
    "Teve um ruído na gravação. Consegue me contar de novo o que está sentindo?",
    "Não entendi muito bem por causa do barulho. Pode repetir com calma?",
    "Ops, ficou um chiadinho no áudio. Pode me falar novamente?"
  ],
  // Categoria 3: Pergunta Geral de Saúde (Serve para qualquer sintoma)
  [
    "Não entendi direito. Me conte com calma: o que é que você está sentindo hoje?",
    "Ficou um pouco confuso. Pode me explicar de um jeito simples como posso te ajudar?",
    "Não peguei o que você disse. O que está te incomodando ou como você está se sentindo?",
    "Pode me contar de novo? Estou aqui prontinho para cuidar de você!"
  ],
  // Categoria 4: Frase muito curta
  [
    "Acho que a gravação ficou curtinha demais! Fale um pouquinho mais sobre como você está.",
    "Não consegui entender essa frase curta. Pode me explicar com mais detalhes?",
    "Foi tão rapidinho que não deu para ouvir tudo! Pode me dizer mais?",
    "Ops, cortou um pedacinho da sua fala. Pode repetir para mim?"
  ],
  // Categoria 5: Incentivo amigável
  [
    "Poxa, não entendi. Tente apertar o botão de novo e falar bem devagar.",
    "Não se preocupe! Aperte o microfone de novo e me diga como posso te ajudar.",
    "Ah, não deu para entender. Vamos tentar de novo? Estou te ouvindo!",
    "Tranquilo! Pode falar novamente bem pertinho que eu presto atenção."
  ]
];

const getRandomNoisePhrase = () => {
  const categoryIndex = Math.floor(Math.random() * NOISE_FALLBACK_PHRASES.length);
  const phraseIndex = Math.floor(Math.random() * NOISE_FALLBACK_PHRASES[categoryIndex].length);
  return NOISE_FALLBACK_PHRASES[categoryIndex][phraseIndex];
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
      severity: 'Amarelo',
      guidance: 'Repouse em um local fresco e calmo, beba água e meça sua pressão arterial. Se a tontura vier com formigamento na boca ou perda de força no braço, peça ajuda imediatamente!'
    },
    {
      id: 'fever',
      title: 'FEBRE OU CALAFRIO',
      icon: '🤒',
      color: '#ef4444',
      severity: 'Vermelho',
      guidance: 'Meça sua temperatura com termômetro, tome bastante água e use roupas leves. Se a febre passar de 38,5°C ou persistir, procure o pronto-socorro.'
    },
    {
      id: 'chest',
      title: 'DOR NO PEITO',
      icon: '🫀',
      color: '#dc2626',
      severity: 'Vermelho (Urgência)',
      guidance: '🚨 ATENÇÃO: Dor ou aperto forte no peito é sinal de urgência! Sente-se confortavelmente, mantenha a calma e aperte o botão vermelho de emergência SOS ou ligue 192.'
    },
    {
      id: 'breath',
      title: 'FALTA DE AR',
      icon: '🫁',
      color: '#dc2626',
      severity: 'Vermelho (Urgência)',
      guidance: '🚨 ATENÇÃO: Dificuldade intensa para respirar exige cuidado rápido! Sente-se ereto, afrouxe a gola da roupa e peça ajuda imediatamente no botão vermelho SOS.'
    },
    {
      id: 'wound',
      title: 'FERIDA OU CORTE',
      icon: '🩺',
      color: '#0284c7',
      severity: 'Verde/Amarelo',
      guidance: 'Lave a lesão delicadamente com soro fisiológico ou água limpa corrente. Proteja com pano limpo e você pode agendar uma avaliação com nossos enfermeiros no app.'
    },
    {
      id: 'belly',
      title: 'ENJOO OU DOR NA BARRIGA',
      icon: '🤢',
      color: '#8b5cf6',
      severity: 'Amarelo',
      guidance: 'Descanse, tome pequenos goles de água fresca e evite alimentos pesados. Se a dor for muito forte ou tiver vômitos contínuos, consulte um profissional de saúde.'
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

  const processSymptomQuery = async (queryText) => {
    const cleanText = queryText ? queryText.trim() : '';
    if (!cleanText || cleanText.length < 4 || /^(é|hum|ah|eh|oh|oi)$/i.test(cleanText)) {
      const friendlyPhrase = getRandomNoisePhrase();
      setAiResponse(friendlyPhrase);
      speakText(friendlyPhrase);
      return;
    }

    setLoadingAi(true);
    try {
      const systemPrompt = `Você é o Assistente iRec Fácil. Responda em um único parágrafo muito curto, simples e carinhoso, em português. Não use termos médicos difíceis. Explique o que a pessoa deve fazer de forma clara. Se for algo grave, mande procurar o pronto-socorro.`;
      const result = await chatWithDoctorCopilot(systemPrompt, [{ role: 'user', content: queryText }], clinicalProfile, [], null);
      
      const reply = result?.reply || "Recebemos sua mensagem. Se estiver se sentindo muito mal, aperte o botão vermelho de emergência.";
      setAiResponse(reply);
      speakText(reply);
    } catch (e) {
      console.error(e);
      const fallback = "Se estiver sentindo dor forte ou se sentindo muito mal, peça ajuda ou aperte o botão vermelho de emergência SOS.";
      setAiResponse(fallback);
      speakText(fallback);
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
      alert("Seu celular não suporta gravação direta de voz. Você pode clicar nos desenhos de sintomas abaixo!");
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
              Modo iRec Fácil (Acessível)
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

      {/* Big Voice Button */}
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
          {isRecording ? 'OUVINDO... FALE AGORA!' : 'APERTE AQUI E FALE O QUE ESTÁ SENTINDO'}
        </span>
      </div>

      {/* AI Response Display & Speech */}
      {loadingAi && (
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '20px',
          padding: '20px',
          textAlign: 'center',
          color: '#38bdf8',
          fontSize: '18px',
          fontWeight: '700'
        }}>
          ⏳ O assistente iRec está pensando na resposta...
        </div>
      )}

      {aiResponse && !loadingAi && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          padding: '20px',
          border: '3px solid #38bdf8',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#38bdf8' }}>
              🔊 Orientação por Áudio iRec:
            </span>
            <button
              onClick={() => speakText(aiResponse)}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 16px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🔊 Ouvir De Novo
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.6', color: '#ffffff', fontWeight: '600' }}>
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
            👉 Ou toque na foto do que está sentindo:
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
          onClick={() => { triggerVibration(); setActiveTab('telemedicine'); }}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '18px',
            fontSize: '17px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '28px' }}>💻</span>
          <span>FALAR COM MÉDICO / ENFERMEIRO</span>
        </button>

        <button
          onClick={() => { triggerVibration(); setActiveTab('upload'); }}
          style={{
            backgroundColor: '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '18px',
            fontSize: '17px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '28px' }}>📷</span>
          <span>TIRAR FOTO DA PELE OU MACHUCADO</span>
        </button>
      </div>

      {/* Legal Disclaimer Footer */}
      <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '10px', lineHeight: '1.5' }}>
        ⚖️ <strong>Aviso Legal iRec:</strong> Esta ferramenta fornece triagem informativa e auxílio visual. Não substitui consulta médica presencial. Em caso de urgência, consulte o botão SOS.
      </div>
    </div>
  );
}
