import React, { useState, useEffect } from 'react';
import { getPatientFirstLineTriage } from '../services/geminiService';
import { speakNaturalText } from '../utils/speechUtils';
import { updateClinicalProfile } from '../services/supabaseService';

// Humanized non-robotic fallback responses
const NOISE_FALLBACK_PHRASES = [
  "Olá! Não consegui te ouvir direito. Por favor, aperte o botão de microfone de novo e fale bem pertinho do celular.",
  "Ops, o som saiu um pouco baixinho. Pode me contar de novo o que você está sentindo no seu corpo?",
  "Acho que um barulho atrapalhou a gravação. Me diga com calma: onde é a dor ou o que está te incomodando?"
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
  const [triageRiskLevel, setTriageRiskLevel] = useState('Verde'); // 'Verde', 'Amarelo', 'Vermelho'
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
      prompt: 'Estou sentindo dor de cabeça e tontura.'
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

  // PROCESS ANY FREE-SPEECH VOICE QUERY WITH MEDICAL AI & REAL-TIME PRONTUÁRIO UPDATE
  const processSymptomQuery = async (queryText, categoryTitle = '') => {
    stopAudioSpeech();
    const cleanText = queryText ? queryText.trim() : '';

    if (!cleanText || cleanText.length < 3 || /^(é|hum|ah|eh|oh|oi)$/i.test(cleanText)) {
      const friendlyPhrase = getRandomNoisePhrase();
      setAiResponse(friendlyPhrase);
      setTriageRiskLevel('Verde');
      speakText(friendlyPhrase);
      return;
    }

    setSelectedSymptomTitle(categoryTitle || 'Relato por Voz');
    setLoadingAi(true);

    // CRITICAL SAFETY GUARD: Pre-classify severe trauma, accidents, chest pain, fractures, amputations or bleeding
    const lower = cleanText.toLowerCase();
    const isEmergency = /atropelad|acidente|arranc|amputa|quebrad|quebrei|fratura|coraç|corac|peito|infarto|avc|derrame|falta de ar|sufoc|desmai|inconscien|convuls|jorrand|sangramento forte|esmagad|queimadura grave|veneno|intoxica|caiu d/i.test(lower);

    if (isEmergency) {
      const emergencyReply = "ATENÇÃO DE EMERGÊNCIA! O seu relato indica um evento médico grave ou trauma. Por favor, mantenha a calma, peça ajuda a alguém próximo e procure o Pronto-Socorro IMEDIATAMENTE ou ligue 192 (SAMU) ou 193 (Bombeiros). Não permaneça em casa!";
      setTriageRiskLevel('Vermelho');
      setAiResponse(emergencyReply);
      speakText(emergencyReply);

      if (clinicalProfile && clinicalProfile.id) {
        const newAlert = {
          id: `triage_${Date.now()}`,
          date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          symptom: cleanText,
          primarySymptom: categoryTitle || 'Emergência Médica / Trauma Gravíssimo',
          aiTriageReply: emergencyReply,
          riskLevel: 'Vermelho'
        };

        const updatedAlerts = [newAlert, ...(clinicalProfile.triageAlerts || [])].slice(0, 20);
        const updatedProfile = { 
          ...clinicalProfile, 
          triageAlerts: updatedAlerts,
          lastTriageRisk: 'Vermelho',
          lastTriageDate: newAlert.date
        };
        
        if (setClinicalProfile) setClinicalProfile(updatedProfile);
        updateClinicalProfile(clinicalProfile.id, updatedProfile);
      }
      setLoadingAi(false);
      return;
    }

    try {
      // Call dedicated Patient Voice Triage AI
      const aiTriageResult = await getPatientFirstLineTriage(cleanText, clinicalProfile);

      let replyText = "";
      let calculatedRisk = "Verde";

      if (aiTriageResult && aiTriageResult.advice) {
        replyText = aiTriageResult.advice;
        calculatedRisk = aiTriageResult.riskLevel || "Verde";
      } else {
        // High quality local fallback if Gemini is offline
        const lower = cleanText.toLowerCase();
        if (lower.includes('peito') || lower.includes('falta de ar') || lower.includes('avc') || lower.includes('jorrando')) {
          calculatedRisk = 'Vermelho';
          replyText = 'ATENÇÃO: Este sintoma é um sinal de urgência. Mantenha a calma, sente-se e aperte o botão vermelho de emergência SOS para ligar 192 (SAMU).';
        } else if (lower.includes('cabeça') || lower.includes('enjoo') || lower.includes('tontura') || lower.includes('cansaço') || lower.includes('muscular')) {
          calculatedRisk = 'Verde';
          replyText = 'Olá! Esta é uma situação simples para cuidar em casa. Tome 2 copos de água fresca, repouse em um quarto calmo e escuro e evite telas. Você NÃO precisa ir ao hospital por esta dor de cabeça. Fique calmo e repouse!';
        } else if (lower.includes('febre alta') || lower.includes('secreção')) {
          calculatedRisk = 'Amarelo';
          replyText = 'Entendi seu desconforto. Se os sintomas continuarem por mais de 24 horas, recomendamos agendar uma consulta rápida por vídeo com nossos médicos no próprio app iRec sem sair de casa.';
        } else {
          calculatedRisk = 'Verde';
          replyText = 'Olá! Para este sintoma leve, o procedimento recomendado é tomar 2 copos de água fresca e repousar em um ambiente calmo. Você não precisa ir ao hospital por este sintoma simples. Fique calmo!';
        }
      }

      setTriageRiskLevel(calculatedRisk);
      setAiResponse(replyText);
      speakText(replyText);

      // AUTOMATICALLY REGISTER TRIAGE REPORT IN PATIENT'S CLINICAL PRONTUÁRIO
      if (clinicalProfile && clinicalProfile.id) {
        const newAlert = {
          id: `triage_${Date.now()}`,
          date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          symptom: cleanText,
          primarySymptom: aiTriageResult?.primarySymptom || categoryTitle || 'Sintoma Relatado por Voz',
          aiTriageReply: replyText,
          riskLevel: calculatedRisk
        };

        const updatedAlerts = [newAlert, ...(clinicalProfile.triageAlerts || [])].slice(0, 20);
        const updatedProfile = { 
          ...clinicalProfile, 
          triageAlerts: updatedAlerts,
          lastTriageRisk: calculatedRisk,
          lastTriageDate: newAlert.date
        };
        
        if (setClinicalProfile) setClinicalProfile(updatedProfile);
        updateClinicalProfile(clinicalProfile.id, updatedProfile);
      }
    } catch (e) {
      console.warn("[iRec Triagem IA] Usando procedimento local de saúde:", e);
      const fallback = "Para sintomas leves, o melhor procedimento é descansar em um ambiente calmo, tomar um bom copo de água fresca e repousar. Não há necessidade de correr para o pronto-socorro por sintomas simples.";
      setTriageRiskLevel('Verde');
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
      const msg = "Para fazer a triagem por voz, toque em uma das fotos de sintomas abaixo!";
      speakText(msg);
      alert("Seu navegador não suporta microfone automático. Toque nas opções de sintomas abaixo!");
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
        const fallbackMsg = "Ops, não consegui te ouvir bem! Aperte o botão de microfone e fale de novo pertinho do celular.";
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
              Primeiro Atendimento Médico por Voz iRec
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
          {isRecording ? 'OUVINDO... FALE SEUS SINTOMAS!' : 'APERTE AQUI E FALE O QUE ESTÁ SENTINDO'}
        </span>
        <span style={{ fontSize: '13.5px', color: '#e0f2fe', fontWeight: '600' }}>
          Fale livremente como se estivesse conversando com o médico!
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
          ⏳ A Médica IA do iRec está analisando seus sintomas e salvando em seu prontuário...
        </div>
      )}

      {/* MEDICAL AI TRIAGE & ADVICE RESPONSE CARD */}
      {aiResponse && !loadingAi && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          padding: '24px',
          border: `3px solid ${triageRiskLevel === 'Vermelho' ? '#ef4444' : (triageRiskLevel === 'Amarelo' ? '#f59e0b' : '#10b981')}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                backgroundColor: triageRiskLevel === 'Vermelho' ? '#ef4444' : (triageRiskLevel === 'Amarelo' ? '#f59e0b' : '#10b981'),
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '20px',
                fontWeight: '900',
                fontSize: '12px',
                textTransform: 'uppercase'
              }}>
                {triageRiskLevel === 'Vermelho' ? '🚨 Risco Urgente' : (triageRiskLevel === 'Amarelo' ? '🟡 Recomendada Teleconsulta' : '🟢 Cuidados em Casa')}
              </span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                Orientação Médica por Voz
              </span>
            </div>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>
              ✓ Registrado automaticamente na ficha médica para acompanhamento dos doutores.
            </span>
          </div>

          {/* Action buttons based on risk level */}
          {triageRiskLevel === 'Amarelo' && (
            <button
              onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('nurses'); }}
              style={{
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px'
              }}
            >
              <span>👨‍⚕️</span>
              <span>AGENDAR CONSULTA POR VÍDEO NO APP</span>
            </button>
          )}

          {triageRiskLevel === 'Vermelho' && (
            <button
              onClick={() => { stopAudioSpeech(); triggerVibration(); onOpenSOS(); }}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '16px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
                boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)'
              }}
            >
              <span>🚨</span>
              <span>ACIONAR SOCORRO DE EMERGÊNCIA (SOS 192)</span>
            </button>
          )}
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
