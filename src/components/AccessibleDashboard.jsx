import React, { useState, useEffect } from 'react';
import { chatWithDoctorCopilot } from '../services/geminiService';
import { speakNaturalText } from '../utils/speechUtils';

// Humanized non-robotic fallback responses
const NOISE_FALLBACK_PHRASES = [
  "Olá! Não consegui te ouvir direito. Por favor, aperte o microfone de novo e fale bem pertinho do celular.",
  "Ops, o som saiu um pouco baixinho. Pode repetir o que você está sentindo com calma?",
  "Acho que um barulho atrapalhou a gravação. Conte para mim: você está com dor, enjoo ou febre?"
];

const getRandomNoisePhrase = () => {
  return NOISE_FALLBACK_PHRASES[Math.floor(Math.random() * NOISE_FALLBACK_PHRASES.length)];
};

// Interactive Triage Database (Triagem Guiada de Risco e Causa)
const INTERACTIVE_TRIAGE_DATA = {
  head: {
    id: 'head',
    title: 'DOR DE CABEÇA OU TONTURA',
    icon: '🤕',
    color: '#f59e0b',
    step1Question: 'Sua dor de cabeça começou aos poucos após um dia cansativo, sol forte ou pouca água?',
    step2Question: 'Você está com febre alta, visão embaçada, boca torta ou vômitos fortes?',
    greenResult: '🟢 TRIAGEM: RISCO BAIXO (CUIDADOS EM CASA)\nA causa provável é tensão ou falta de água. Beba 2 copos de água fresca, repouse em um quarto calmo e escuro e evite telas. Você NÃO precisa ir ao hospital por isso!',
    yellowResult: '🟡 TRIAGEM: RISCO MODERADO (TELECONSULTA NO APP)\nComo a dor persiste e está incomodando, recomendamos fazer uma consulta por vídeo no próprio app iRec com nossos médicos, sem precisar sair de casa.',
    redResult: '🔴 TRIAGEM: ALERTA DE URGÊNCIA (SOS 192)\nATENÇÃO: Dor de cabeça repentina e violenta acompanhada de visão alterada é sinal de emergência. Aperte o botão vermelho SOS para ligar 192 (SAMU).'
  },
  fever: {
    id: 'fever',
    title: 'FEBRE OU CALAFRIO',
    icon: '🤒',
    color: '#ef4444',
    step1Question: 'A febre começou recentemente com corpo pesado ou sintomas leves de resfriado?',
    step2Question: 'A febre passou de 38.5°C mesmo após tomar banho morno ou você sente falta de ar?',
    greenResult: '🟢 TRIAGEM: RISCO BAIXO (CUIDADOS EM CASA)\nVista roupas leves, tome bastante água e repouse. Se a febre for menor que 38,5°C, você pode se cuidar em casa com segurança sem ir ao hospital.',
    yellowResult: '🟡 TRIAGEM: RISCO MODERADO (AVALIAÇÃO MÉDICA)\nComo a febre persiste, recomendamos agendar um atendimento por vídeo no app para orientação de medicamentos.',
    redResult: '🔴 TRIAGEM: ALERTA DE URGÊNCIA (SOS 192)\nFebre muito alta acompanhada de falta de ar exige atendimento de emergência. Aperte o botão vermelho SOS!'
  },
  belly: {
    id: 'belly',
    title: 'ENJOO OU DOR NA BARRIGA',
    icon: '🤢',
    color: '#8b5cf6',
    step1Question: 'O enjoo ou dor de barriga começou após comer algo gorduroso ou fora da rotina?',
    step2Question: 'Você está vomitando continuamente sem conseguir beber água ou sentindo dor muito forte no lado direito da barriga?',
    greenResult: '🟢 TRIAGEM: RISCO BAIXO (CUIDADOS EM CASA)\nTome pequenos goles de água gelada ou chá morno, evite comida pesada e repouse. Não é necessário ir ao hospital por enjoo simples!',
    yellowResult: '🟡 TRIAGEM: RISCO MODERADO (CONSULTA NO APP)\nSe o desconforto na barriga continuar por mais de 24 horas, fale com um médico ou enfermeiro pelo próprio aplicativo.',
    redResult: '🔴 TRIAGEM: ALERTA DE URGÊNCIA (SOS 192)\nVômitos graves contínuos com dor abdominal intensa requerem avaliação de emergência no pronto-socorro.'
  },
  wound: {
    id: 'wound',
    title: 'FERIDA OU CORTE',
    icon: '🩺',
    color: '#0284c7',
    step1Question: 'É um corte pequeno ou ferida de pele sem sangramento jorrando?',
    step2Question: 'A ferida está saindo secreção amarelada com mal cheiro, vermelhidão espalhando ou dor intensa?',
    greenResult: '🟢 TRIAGEM: RISCO BAIXO (CUIDADO DOMICILIAR)\nLave com soro fisiológico ou água limpa corrente e proteja com gaze. Você pode agendar uma avaliação com nossos enfermeiros no app sem sair de casa!',
    yellowResult: '🟡 TRIAGEM: RISCO MODERADO (AVALIAÇÃO DE ENFERMAGEM)\nA ferida precisa de curativo especial. Agende uma visita com um enfermeiro estomaterapeuta na aba de profissionais.',
    redResult: '🔴 TRIAGEM: ALERTA DE URGÊNCIA\nSe houver sangramento intenso não estancado ou corte profundo, procure o pronto-socorro mais próximo.'
  },
  chest: {
    id: 'chest',
    title: 'DOR NO PEITO (URGÊNCIA)',
    icon: '🫀',
    color: '#dc2626',
    step1Question: 'A dor no peito é um aperto forte que queima ou espalha para o braço esquerdo ou pescoço?',
    step2Question: 'Você está com suor frio, falta de ar ou sensação de desmaio?',
    greenResult: '🟢 TRIAGEM: TENSÃO MUSCULAR OU GASTRITE\nSe for uma pontada leve ao respirar após esforço, tente se sentar e relaxar. Se a dor persistir, consulte um médico.',
    yellowResult: '🔴 TRIAGEM: URGÊNCIA MÉDICA\nAperto no peito deve ser avaliado com prioridade. Aperte o botão vermelho SOS para orientação imediata.',
    redResult: '🔴 TRIAGEM: EMERGÊNCIA (SOS 192)\n🚨 ATENÇÃO: Aperto no peito com suor frio é sinal de emergência! Aperte o botão vermelho SOS agora para ligar para o 192 (SAMU).'
  },
  breath: {
    id: 'breath',
    title: 'FALTA DE AR (URGÊNCIA)',
    icon: '🫁',
    color: '#dc2626',
    step1Question: 'A falta de ar surgiu após cansaço físico ou quando você tenta falar frases inteiras?',
    step2Question: 'Os seus lábios estão arroxeados ou você não consegue puxar o ar de jeito nenhum?',
    greenResult: '🟢 TRIAGEM: CANSASO OU ANSIEDADE LEVE\nSente-se ereto em local ventilado, tome água devagar e respire pelo nariz puxando o ar com calma.',
    yellowResult: '🔴 TRIAGEM: AVALIAÇÃO DE URGÊNCIA\nDificuldade para respirar precisa de cuidado rápido. Aperte o botão vermelho SOS para suporte.',
    redResult: '🔴 TRIAGEM: EMERGÊNCIA CRÍTICA (SOS 192)\n🚨 URGÊNCIA: Falta de ar grave exige socorro imediato. Aperte o botão vermelho SOS!'
  }
};

export default function AccessibleDashboard({ 
  clinicalProfile, 
  setActiveTab, 
  onOpenSOS 
}) {
  const [voiceQuery, setVoiceQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('default');

  // Interactive Triage State
  const [activeTriage, setActiveTriage] = useState(null); // triage object from INTERACTIVE_TRIAGE_DATA
  const [triageStep, setTriageStep] = useState(null); // 1 = cause, 2 = risk, 3 = result
  const [step1Answer, setStep1Answer] = useState(null); // true = Sim, false = Nao

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

  // START INTERACTIVE TRIAGE FLOW FOR A SYMPTOM
  const startInteractiveTriage = (triageId) => {
    stopAudioSpeech();
    triggerVibration();

    const data = INTERACTIVE_TRIAGE_DATA[triageId] || INTERACTIVE_TRIAGE_DATA['head'];
    setActiveTriage(data);
    setTriageStep(1);
    setStep1Answer(null);

    const questionText = `Triagem de ${data.title}. Pergunta 1: ${data.step1Question}. Responda SIM ou NÃO nos botões abaixo.`;
    setAiResponse(questionText);
    speakText(questionText);
  };

  // HANDLE INTERACTIVE TRIAGE STEP ANSWERS (SIM / NAO)
  const handleTriageAnswer = (answerBool) => {
    stopAudioSpeech();
    triggerVibration();

    if (!activeTriage) return;

    if (triageStep === 1) {
      setStep1Answer(answerBool);
      setTriageStep(2);
      const q2Text = `Entendido. Pergunta 2 de segurança: ${activeTriage.step2Question}. Responda SIM ou NÃO nos botões abaixo.`;
      setAiResponse(q2Text);
      speakText(q2Text);
    } else if (triageStep === 2) {
      setTriageStep(3); // Result
      let resultText = '';
      if (answerBool === true) {
        // High Risk / Emergency
        resultText = activeTriage.redResult;
      } else if (step1Answer === true) {
        // Low Risk / Home Care
        resultText = activeTriage.greenResult;
      } else {
        // Moderate Risk / Telemedicine
        resultText = activeTriage.yellowResult;
      }
      setAiResponse(resultText);
      speakText(resultText);
    }
  };

  // PROCESS SPOKEN VOICE QUERY WITH INTERACTIVE TRIAGE MATCHING
  const processSymptomQuery = async (queryText) => {
    const cleanText = queryText ? queryText.trim() : '';
    if (!cleanText || cleanText.length < 3 || /^(é|hum|ah|eh|oh|oi)$/i.test(cleanText)) {
      const friendlyPhrase = getRandomNoisePhrase();
      setAiResponse(friendlyPhrase);
      speakText(friendlyPhrase);
      return;
    }

    const lower = cleanText.toLowerCase();

    // Map spoken keywords to interactive triage
    if (lower.includes('cabeça') || lower.includes('enxaqueca') || lower.includes('tontura')) {
      startInteractiveTriage('head');
      return;
    }
    if (lower.includes('enjoo') || lower.includes('barriga') || lower.includes('estômago') || lower.includes('vômito')) {
      startInteractiveTriage('belly');
      return;
    }
    if (lower.includes('febre') || lower.includes('calafrio') || lower.includes('gripe')) {
      startInteractiveTriage('fever');
      return;
    }
    if (lower.includes('ferida') || lower.includes('corte') || lower.includes('machucado') || lower.includes('sangue')) {
      startInteractiveTriage('wound');
      return;
    }
    if (lower.includes('peito') || lower.includes('coração')) {
      startInteractiveTriage('chest');
      return;
    }
    if (lower.includes('ar') || lower.includes('respirar') || lower.includes('sufoco')) {
      startInteractiveTriage('breath');
      return;
    }

    // Default Fallback: AI Assistant
    setLoadingAi(true);
    try {
      const systemPrompt = `Você é o Assistente iRec de Triagem de Saúde para idosos e leigos. O usuário disse: "${cleanText}". Dê uma resposta de triagem de primeiro atendimento muito simples e carinhosa. Diga se é algo simples para cuidar em casa (ex: repousar, tomar água) sem ir ao hospital, ou se é emergência. Máximo 3 frases curtas.`;
      const result = await chatWithDoctorCopilot(systemPrompt, [{ role: 'user', content: cleanText }], clinicalProfile, [], null);
      
      const reply = result?.reply || "Recebemos sua dúvida. Se for um sintoma leve, repouse e beba água. Se sentir dor forte, aperte o botão vermelho SOS.";
      setAiResponse(reply);
      speakText(reply);
    } catch (e) {
      console.warn("[iRec Triagem] Erro no Gemini AI:", e);
      const fallback = "Para sintomas leves, o melhor é descansar em ambiente calmo e beber água fresca. Não é preciso ir ao hospital por desconfortos simples.";
      setAiResponse(fallback);
      speakText(fallback);
    } finally {
      setLoadingAi(false);
    }
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
            <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '600' }}>
              Triagem de Saúde iRec (Modo Fácil)
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
          Ao clicar, o áudio do celular pausa na hora para te ouvir sem eco!
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
          ⏳ O assistente iRec está calculando o risco da sua triagem...
        </div>
      )}

      {/* INTERACTIVE TRIAGE CARD & STEP QUESTIONS */}
      {activeTriage && triageStep !== null && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          padding: '24px',
          border: `3px solid ${activeTriage.color}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: '900', color: activeTriage.color, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{activeTriage.icon}</span>
              <span>{activeTriage.title}</span>
            </span>
            <button
              onClick={() => { stopAudioSpeech(); setActiveTriage(null); setTriageStep(null); }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* STEP 1 & 2 INTERACTIVE QUESTION BUTTONS (SIM / NÃO) */}
          {(triageStep === 1 || triageStep === 2) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '19px', lineHeight: '1.6', color: '#ffffff', fontWeight: '700' }}>
                {triageStep === 1 ? activeTriage.step1Question : activeTriage.step2Question}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  onClick={() => handleTriageAnswer(true)}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '18px',
                    fontSize: '22px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <span>👍</span>
                  <span>SIM</span>
                </button>

                <button
                  onClick={() => handleTriageAnswer(false)}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '18px',
                    fontSize: '22px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <span>👎</span>
                  <span>NÃO</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 RESULT DISPLAY */}
          {triageStep === 3 && aiResponse && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '18px', lineHeight: '1.65', color: '#ffffff', fontWeight: '600', whitespace: 'pre-line' }}>
                {aiResponse}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => speakText(aiResponse)}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>🔊</span>
                  <span>Ouvir De Novo</span>
                </button>

                <button
                  onClick={() => { stopAudioSpeech(); startInteractiveTriage(activeTriage.id); }}
                  style={{
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Refazer Triagem
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SYMPTOM SELECTION CARDS (STARTS INTERACTIVE TRIAGE) */}
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
            👉 Toque abaixo para iniciar a Triagem Guiada de Saúde:
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {Object.values(INTERACTIVE_TRIAGE_DATA).map((cat) => (
            <button
              key={cat.id}
              onClick={() => startInteractiveTriage(cat.id)}
              style={{
                backgroundColor: activeTriage?.id === cat.id ? cat.color : '#1e293b',
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
