import React, { useState, useEffect } from 'react';
import { chatWithDoctorCopilot } from '../services/geminiService';
import { speakNaturalText } from '../utils/speechUtils';
import { updateClinicalProfile } from '../services/supabaseService';

// Humanized non-robotic fallback responses
const NOISE_FALLBACK_PHRASES = [
  "Olá! Não consegui te ouvir direito. Por favor, aperte o microfone de novo e fale bem pertinho do celular.",
  "Ops, o som saiu um pouco baixinho. Pode repetir o que você está sentindo com calma?",
  "Acho que um barulho atrapalhou a gravação. Conte para mim: você está com dor, enjoo ou febre?"
];

const getRandomNoisePhrase = () => {
  return NOISE_FALLBACK_PHRASES[Math.floor(Math.random() * NOISE_FALLBACK_PHRASES.length)];
};

export default function AccessibleDashboard({ 
  clinicalProfile, 
  setClinicalProfile,
  setActiveTab, 
  onOpenSOS 
}) {
  const [voiceQuery, setVoiceQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('default');
  const [selectedSymptomTitle, setSelectedSymptomTitle] = useState('');

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

  // IMMEDIATELY stop audio playback before performing any user action or recording
  const stopAudioSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = (text) => {
    speakNaturalText(text);
  };

  const requestNotificationPermission = async () => {
    stopAudioSpeech();
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
      title: 'DOR DE CABEÇA OU TONTURA',
      icon: '🤕',
      color: '#f59e0b',
      prompt: 'Estou com dor de cabeça e tontura leve.'
    },
    {
      id: 'fever',
      title: 'FEBRE OU CALAFRIO',
      icon: '🤒',
      color: '#ef4444',
      prompt: 'Estou com febre e calafrio no corpo.'
    },
    {
      id: 'chest',
      title: 'DOR NO PEITO (URGÊNCIA)',
      icon: '🫀',
      color: '#dc2626',
      prompt: 'Estou sentindo dor forte e aperto no peito.'
    },
    {
      id: 'breath',
      title: 'FALTA DE AR (URGÊNCIA)',
      icon: '🫁',
      color: '#dc2626',
      prompt: 'Estou com falta de ar e dificuldade para respirar.'
    },
    {
      id: 'wound',
      title: 'FERIDA OU CORTE NA PELE',
      icon: '🩺',
      color: '#0284c7',
      prompt: 'Tenho uma ferida ou corte na pele precisando de curativo.'
    },
    {
      id: 'belly',
      title: 'ENJOO OU DOR NA BARRIGA',
      icon: '🤢',
      color: '#8b5cf6',
      prompt: 'Estou com enjoo e dor de barriga.'
    }
  ];

  // PROCESS SPOKEN VOICE QUERY WITH MEDICAL AI & PRONTUÁRIO INTEGRATION
  const processSymptomQuery = async (queryText, categoryTitle = '') => {
    stopAudioSpeech();
    const cleanText = queryText ? queryText.trim() : '';

    if (!cleanText || cleanText.length < 3 || /^(é|hum|ah|eh|oh|oi)$/i.test(cleanText)) {
      const friendlyPhrase = getRandomNoisePhrase();
      setAiResponse(friendlyPhrase);
      speakText(friendlyPhrase);
      return;
    }

    setSelectedSymptomTitle(categoryTitle || 'Sintoma Relatado por Voz');
    setLoadingAi(true);

    try {
      const systemPrompt = `Você é a Médica de Inteligência Artificial do iRec (Especialista em Primeiro Atendimento Domiciliar para idosos, leigos e analfabetos funcionais).

Sua função é realizar a triagem completa do sintoma relatado: "${cleanText}".

Regras Obrigatórias de Atendimento por Voz:
1. Fale em português de forma extremamente carinhosa, humana, simples e acolhedora (sem jargões médicos).
2. Avalie a causa provável e o NÍVEL DE RISCO (Risco Baixo = Cuidados Simples em Casa; Risco Moderado = Teleconsulta no App; Risco Alto = Urgência SOS 192).
3. Para sintomas simples (ex: dor de cabeça leve, enjoo, dor muscular, febre baixa), dê orientações práticas de cuidados em casa (ex: beber 2 copos de água, repousar em quarto escuro, compressa morna) e diga EXPLICITAMENTE: "Você não precisa correr para o hospital por este sintoma simples. Fique calmo, repouse e beba água."
4. Se for algo grave (ex: dor forte no peito, falta de ar intensa, perda de força/fala), oriente a apertar o botão vermelho de emergência SOS para ligar 192.
5. Responda em no máximo 3 a 4 frases curtas e diretas.`;

      const result = await chatWithDoctorCopilot(systemPrompt, [{ role: 'user', content: cleanText }], clinicalProfile, [], null);
      
      const reply = result?.reply || "Entendi seu relato. Para sintomas simples, o melhor é descansar em local fresco e beber água. Se a dor for muito forte ou tiver falta de ar, aperte o botão vermelho SOS.";
      setAiResponse(reply);
      speakText(reply);

      // SAVE TRIAGE ALERT AUTOMATICALLY TO PATIENT'S CLINICAL PRONTUÁRIO
      if (clinicalProfile && clinicalProfile.id) {
        const lower = (cleanText + ' ' + reply).toLowerCase();
        let riskLevel = 'Verde';
        if (lower.includes('urgência') || lower.includes('sos') || lower.includes('192') || lower.includes('emergência')) {
          riskLevel = 'Vermelho';
        } else if (lower.includes('teleconsulta') || lower.includes('médico') || lower.includes('enfermeiro')) {
          riskLevel = 'Amarelo';
        }

        const newAlert = {
          id: `triage_${Date.now()}`,
          date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          symptom: cleanText,
          aiTriageReply: reply,
          riskLevel: riskLevel
        };

        const updatedAlerts = [newAlert, ...(clinicalProfile.triageAlerts || [])].slice(0, 15);
        const updatedProfile = { ...clinicalProfile, triageAlerts: updatedAlerts };
        
        if (setClinicalProfile) setClinicalProfile(updatedProfile);
        updateClinicalProfile(clinicalProfile.id, updatedProfile);
      }
    } catch (e) {
      console.warn("[iRec Triagem IA] Erro no Gemini AI:", e);
      const fallback = "Para sintomas leves, o melhor é descansar em ambiente calmo e beber água fresca. Não é preciso ir ao hospital por desconfortos simples.";
      setAiResponse(fallback);
      speakText(fallback);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSelectSymptom = (cat) => {
    stopAudioSpeech();
    triggerVibration();
    setVoiceQuery(cat.title);
    processSymptomQuery(cat.prompt, cat.title);
  };

  const handleVoiceRecord = () => {
    // CRITICAL BUG FIX: Immediately CANCEL any active audio speech narration before recording!
    stopAudioSpeech();
    triggerVibration();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = "Para fazer a triagem por áudio, toque nas fotos dos sintomas abaixo!";
      speakText(msg);
      alert("Seu navegador não suporta microfone automático. Toque nos sintomas abaixo!");
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
        const fallbackMsg = "Ops, não consegui te ouvir bem! Toque no botão de microfone e fale de novo pertinho do celular.";
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
            <span style={{ fontSize: '15px', color: '#38bdf8', fontWeight: '700' }}>
              Atendimento Médico por Voz iRec
            </span>
          </div>
        </div>

        {/* SOS Trigger */}
        <button
          onClick={() => { stopAudioSpeech(); triggerVibration(); onOpenSOS(); }}
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

      {/* Big Voice Button for First-Line Care (Interrupts Speech Instantly) */}
      <div style={{
        backgroundColor: isRecording ? '#dc2626' : '#0284c7',
        borderRadius: '24px',
        padding: '26px',
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
        <span style={{ fontSize: '52px' }}>{isRecording ? '🎙️🔴' : '🎙️'}</span>
        <span style={{ fontSize: '21px', fontWeight: '900', color: '#ffffff', textAlign: 'center' }}>
          {isRecording ? 'OUVINDO... FALE O SEU SINTOMA!' : 'APERTE AQUI E FALE O QUE ESTÁ SENTINDO'}
        </span>
        <span style={{ fontSize: '13.5px', color: '#e0f2fe', fontWeight: '600' }}>
          O áudio do celular pausa na hora para te ouvir e a IA médica avalia o risco!
        </span>
      </div>

      {voiceQuery && (
        <div style={{ fontSize: '15px', color: '#38bdf8', fontStyle: 'italic', textAlign: 'center', fontWeight: '700' }}>
          🗣️ Relato por Voz: "{voiceQuery}"
        </div>
      )}

      {loadingAi && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1e293b',
          borderRadius: '20px',
          border: '2px solid #0284c7',
          textAlign: 'center',
          color: '#38bdf8',
          fontSize: '18px',
          fontWeight: '700',
          boxShadow: '0 8px 24px rgba(2, 132, 199, 0.2)'
        }}>
          ⏳ A Médica IA do iRec está avaliando seus sintomas e atualizando seu prontuário...
        </div>
      )}

      {/* MEDICAL AI TRIAGE & ADVICE RESPONSE CARD */}
      {aiResponse && !loadingAi && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          padding: '24px',
          border: '3px solid #38bdf8',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 10px 30px rgba(56, 189, 248, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
            <span style={{ fontSize: '17px', fontWeight: '900', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🩺</span>
              <span>Orientação Médica IA e Registro em Prontuário</span>
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
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🔊</span>
              <span>Ouvir De Novo</span>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '19px', lineHeight: '1.65', color: '#ffffff', fontWeight: '600' }}>
            "{aiResponse}"
          </p>
          <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '700', marginTop: '4px' }}>
            ✓ Relato registrado com sucesso na sua ficha médica para consulta dos doutores.
          </div>
        </div>
      )}

      {/* SYMPTOM SELECTION CARDS (INSTANT VOICE TRIGGER) */}
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
            👉 Ou toque na imagem do sintoma para consultar a IA Médica:
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {symptomCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelectSymptom(cat)}
              style={{
                backgroundColor: '#1e293b',
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
          onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('upload'); }}
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
          onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('nurses'); }}
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
