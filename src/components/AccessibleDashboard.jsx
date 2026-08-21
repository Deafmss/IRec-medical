import { useState, useEffect, useRef } from 'react';
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
  const [savedToRecord, setSavedToRecord] = useState(false);

  const recognitionRef = useRef(null);

  // Read permission & cleanup speech & recognition on unmount (fixes IREC-0205)
  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted && typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationStatus(Notification.permission);
      }
    });
    return () => {
      isMounted = false;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
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
      } else {
        alert("Notificações desativadas. Para ativar no futuro, libere as permissões de notificação nas configurações do seu navegador ou celular.");
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
    setSavedToRecord(false);
    setLoadingAi(true);

    try {
      // Call dedicated Patient Voice Triage AI (Gemini 2.5 Flash/Pro) for 100% dynamic medical analysis
      const aiTriageResult = await getPatientFirstLineTriage(cleanText, clinicalProfile);

      let replyText = "";
      let calculatedRisk = "Verde";

      if (aiTriageResult && aiTriageResult.advice) {
        replyText = aiTriageResult.advice;
        calculatedRisk = aiTriageResult.riskLevel || "Verde";
      } else {
        // Dynamic fallback referencing exact patient speech if offline
        const lower = cleanText.toLowerCase();
        const isSevere = /atropelad|acidente|arranc|amputa|quebrad|quebrei|fratura|coraç|corac|peito|infarto|avc|derrame|falta de ar|sufoc|desmai|inconscien|convuls|jorrand|sangramento forte|esmagad|queimadura grave|veneno|intoxica|caiu d/i.test(lower);
        
        if (isSevere) {
          calculatedRisk = 'Vermelho';
          replyText = `Atenção! Pelo seu relato de "${cleanText}", este quadro exige atendimento de emergência urgente. Mantenha a calma e procure o Pronto-Socorro imediatamente ou ligue 192 (SAMU).`;
        } else {
          calculatedRisk = 'Verde';
          replyText = `Compreendi seu relato sobre "${cleanText}". Recomendamos repousar, manter boa hidratação e observar a evolução. Se houver piora ou novos sintomas, consulte nosso serviço de telemedicina no aplicativo.`;
        }
      }

      setTriageRiskLevel(calculatedRisk);
      setAiResponse(replyText);
      speakText(replyText);

      // AUTOMATICALLY REGISTER TRIAGE REPORT IN PATIENT'S CLINICAL PRONTUÁRIO (fixes IREC-0207, IREC-0210)
      if (clinicalProfile && clinicalProfile.id) {
        const timestampId = new Date().toISOString().replace(/\D/g, '');
        const newAlert = {
          id: `triage_${timestampId}`,
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
        
        if (setClinicalProfile) {
          setClinicalProfile(prev => ({
            ...prev,
            triageAlerts: [newAlert, ...(prev?.triageAlerts || [])].slice(0, 20),
            lastTriageRisk: calculatedRisk,
            lastTriageDate: newAlert.date
          }));
        }

        try {
          await updateClinicalProfile(clinicalProfile.id, updatedProfile);
          setSavedToRecord(true);
        } catch (err) {
          console.warn("[iRec] Falha ao gravar triagem no Supabase:", err);
          setSavedToRecord(false);
        }
      }
    } catch (e) {
      console.warn("[iRec Triagem IA] Usando procedimento local de saúde:", e);
      // Fixes IREC-0043: check severity in catch block as well!
      const lower = cleanText.toLowerCase();
      const isSevere = /atropelad|acidente|arranc|amputa|quebrad|quebrei|fratura|coraç|corac|peito|infarto|avc|derrame|falta de ar|sufoc|desmai|inconscien|convuls|jorrand|sangramento forte|esmagad|queimadura grave|veneno|intoxica|caiu d/i.test(lower);
      
      let calculatedRisk = 'Verde';
      let fallback = "Para sintomas leves, o melhor procedimento é descansar em um ambiente calmo, tomar um bom copo de água fresca e repousar. Não há necessidade de correr para o pronto-socorro por sintomas simples.";
      
      if (isSevere) {
        calculatedRisk = 'Vermelho';
        fallback = `Atenção! Pelo seu relato de "${cleanText}", este quadro exige atendimento de emergência urgente. Mantenha a calma e procure o Pronto-Socorro imediatamente ou ligue 192 (SAMU).`;
      }

      setTriageRiskLevel(calculatedRisk);
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
    stopAudioSpeech();
    triggerVibration();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = "Para fazer a triagem por voz, toque em uma das fotos de sintomas abaixo!";
      speakText(msg);
      alert("Seu navegador não suporta microfone automático. Toque nas opções de sintomas abaixo!");
      return;
    }

    // Fixes IREC-0208: stop recognition on toggle
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      setIsRecording(false);
    } else {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
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

      // Faltava esta chamada. O reconhecedor era criado, recebia todos os
      // handlers, e nunca era iniciado: o botão de microfone do Modo Fácil não
      // fazia nada — não gravava, não errava, não falava. `isRecording` nunca
      // virava true porque só o `onstart` o alteraria.
      try {
        recognition.start();
      } catch (err) {
        // `start()` lança InvalidStateError se já houver reconhecimento ativo.
        console.warn('[iRec] Não foi possível iniciar o reconhecimento de voz:', err);
        setIsRecording(false);
        const msg = 'Não consegui ligar o microfone. Toque em uma das fotos de sintomas abaixo.';
        setAiResponse(msg);
        speakText(msg);
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{
      maxWidth: '720px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: 'var(--font-primary, sans-serif)'
    }}>
      {/* Top Welcome & Mode Indicator */}
      <div className="glass-card glass-card-cyan-glow" style={{
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        backgroundColor: 'rgba(255, 255, 255, 0.96)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            fontSize: '32px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            👵
          </div>
          <div>
            <div style={{
              display: 'inline-block',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: '#0284c7',
              fontSize: '11px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '50px',
              marginBottom: '4px'
            }}>
              🧏‍♂️ MODO FÁCIL & ACESSIBILIDADE
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Olá, {clinicalProfile?.name?.split(' ')[0] || 'Amigo(a)'}!
            </h1>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              Atendimento Clínico Guiado por Voz & Fotos
            </span>
          </div>
        </div>

        {/* SOS Trigger */}
        <button
          type="button"
          onClick={() => { stopAudioSpeech(); triggerVibration(); onOpenSOS(); }}
          style={{
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: '50px',
            padding: '12px 22px',
            fontWeight: '800',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 20px rgba(239, 68, 68, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '18px' }}>🚨</span>
          <span>EMERGÊNCIA 192</span>
        </button>
      </div>

      {/* Persistent Notification Activator Bar */}
      {notificationStatus !== 'granted' && (
        <button
          type="button"
          onClick={requestNotificationPermission}
          style={{
            backgroundColor: 'rgba(2, 132, 199, 0.06)',
            color: '#0284c7',
            border: '1.5px dashed rgba(2, 132, 199, 0.35)',
            borderRadius: '16px',
            padding: '14px 18px',
            fontWeight: '800',
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '18px' }}>🔔</span>
          <span>ATIVAR NOTIFICAÇÃO FIXA DE EMERGÊNCIA NO CELULAR</span>
        </button>
      )}

      {/* Big Voice Button for First-Line Care */}
      <button
        type="button"
        role="button"
        tabIndex={0}
        aria-label="Aperte para gravar sintomas por voz"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleVoiceRecord();
          }
        }}
        onClick={handleVoiceRecord}
        style={{
          width: '100%',
          border: isRecording ? '2px solid #ef4444' : '2px solid rgba(2, 132, 199, 0.4)',
          backgroundColor: isRecording ? '#dc2626' : '#0284c7',
          borderRadius: '24px',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          cursor: 'pointer',
          boxShadow: isRecording ? '0 12px 35px rgba(239, 68, 68, 0.45)' : '0 12px 35px rgba(2, 132, 199, 0.35)',
          transition: 'all 0.3s ease'
        }}
      >
        <span style={{ fontSize: '56px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}>
          {isRecording ? '🎙️🔴' : '🎙️'}
        </span>
        <span style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', textAlign: 'center', fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
          {isRecording ? 'OUVINDO... FALE SEUS SINTOMAS!' : 'APERTE AQUI E FALE O QUE ESTÁ SENTINDO'}
        </span>
        <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
          Fale livremente como se estivesse conversando com o médico!
        </span>
      </button>

      {voiceQuery && (
        <div className="glass-card" style={{ padding: '12px 18px', textAlign: 'center' }}>
          <span style={{ fontSize: '14px', color: '#0284c7', fontWeight: '800' }}>
            🗣️ Relato Gravado: "{voiceQuery}"
          </span>
        </div>
      )}

      {loadingAi && (
        <div className="glass-card" style={{
          padding: '24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          border: '1.5px solid rgba(2, 132, 199, 0.3)'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(2, 132, 199, 0.2)', borderTopColor: '#0284c7', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#0284c7', fontSize: '15px', fontWeight: '800' }}>
            O Assistente Clínico iRec está analisando seus sintomas por voz...
          </span>
        </div>
      )}

      {/* MEDICAL AI TRIAGE & ADVICE RESPONSE CARD */}
      {aiResponse && !loadingAi && (
        <div className="glass-card" style={{
          borderRadius: '24px',
          padding: '24px',
          borderLeft: `6px solid ${triageRiskLevel === 'Vermelho' ? '#ef4444' : (triageRiskLevel === 'Amarelo' ? '#f59e0b' : '#10b981')}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.98)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(2, 132, 199, 0.15)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                backgroundColor: triageRiskLevel === 'Vermelho' ? 'rgba(239, 68, 68, 0.15)' : (triageRiskLevel === 'Amarelo' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                color: triageRiskLevel === 'Vermelho' ? '#ef4444' : (triageRiskLevel === 'Amarelo' ? '#d97706' : '#10b981'),
                border: `1px solid ${triageRiskLevel === 'Vermelho' ? 'rgba(239, 68, 68, 0.3)' : (triageRiskLevel === 'Amarelo' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)')}`,
                padding: '4px 12px',
                borderRadius: '50px',
                fontWeight: '800',
                fontSize: '11.5px',
                textTransform: 'uppercase'
              }}>
                {triageRiskLevel === 'Vermelho' ? '🚨 Risco Urgente' : (triageRiskLevel === 'Amarelo' ? '🟡 Recomendada Teleconsulta' : '🟢 Cuidados em Casa')}
              </span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {selectedSymptomTitle || 'Orientação Médica por Voz'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => speakText(aiResponse)}
              style={{
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '50px',
                padding: '8px 16px',
                fontWeight: '800',
                fontSize: '12.5px',
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

          <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.65', color: 'var(--text-primary)', fontWeight: '600' }}>
            "{aiResponse}"
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', borderTop: '1px solid rgba(2, 132, 199, 0.12)', paddingTop: '10px' }}>
            {savedToRecord ? (
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>
                ✓ Registrado automaticamente na ficha médica para acompanhamento dos doutores.
              </span>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                ℹ️ Orientação clínica em tempo real.
              </span>
            )}
          </div>

          {/* Action buttons based on risk level */}
          {triageRiskLevel === 'Amarelo' && (
            <button
              type="button"
              onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('doctors_directory'); }}
              style={{
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '14.5px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 16px rgba(245, 158, 11, 0.3)'
              }}
            >
              <span>👨‍⚕️</span>
              <span>AGENDAR CONSULTA POR VÍDEO NO APP</span>
            </button>
          )}

          {triageRiskLevel === 'Vermelho' && (
            <button
              type="button"
              onClick={() => { stopAudioSpeech(); triggerVibration(); onOpenSOS(); }}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)'
              }}
            >
              <span>🚨</span>
              <span>ACIONAR SOCORRO DE EMERGÊNCIA (SOS 192)</span>
            </button>
          )}
        </div>
      )}

      {/* QUICK SYMPTOM CATEGORIES WITH ACCESSIBLE IMAGES */}
      <div>
        <div style={{
          backgroundColor: 'rgba(2, 132, 199, 0.05)',
          padding: '14px 18px',
          borderRadius: '16px',
          border: '1px solid rgba(2, 132, 199, 0.2)',
          marginBottom: '14px'
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
            👉 Ou toque no sintoma para consultar o Assistente Clínico:
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {symptomCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectSymptom(cat)}
              className="glass-card"
              style={{
                border: `2px solid ${cat.color}`,
                borderRadius: '20px',
                padding: '18px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: 'rgba(255, 255, 255, 0.95)'
              }}
            >
              <span style={{ fontSize: '38px' }}>{cat.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', textAlign: 'center' }}>
                {cat.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Direct Quick Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('upload'); }}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '18px 14px',
            fontSize: '15px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)'
          }}
        >
          <span style={{ fontSize: '32px' }}>📸</span>
          <span>ENVIAR FOTO DA FERIDA</span>
        </button>

        <button
          type="button"
          onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('doctors_directory'); }}
          style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '18px 14px',
            fontSize: '15px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 6px 18px rgba(2, 132, 199, 0.35)'
          }}
        >
          <span style={{ fontSize: '32px' }}>👨‍⚕️</span>
          <span>FALAR COM ENFERMEIRO</span>
        </button>
      </div>
    </div>
  );
}
