import { useState, useEffect, useRef } from 'react';
import { uploadExamFileAndTriage, updateClinicalProfile, createAuditLog } from '../services/supabaseService';
import { chatWithAI } from '../services/geminiService';

const createUniqueId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

const SUGGESTIONS = [
  { text: 'Como higienizar a lesão em casa?', icon: '💧' },
  { text: 'O que comer para cicatrizar mais rápido?', icon: '🍎' },
  { text: 'Como entender ou enviar um exame?', icon: '📄' },
  { text: 'O que fazer se o curativo molhar ou vazar?', icon: '🩹' }
];

const detectTopicFromText = (userText, aiText = '') => {
  const userClean = (userText || '').trim();
  const combined = (userClean + ' ' + aiText).toLowerCase();
  
  if (combined.includes('vitamina') || combined.includes('suplemento') || combined.includes('d3') || combined.includes('k2') || combined.includes('calcio')) {
    return 'Vitaminas & Suplementação';
  }
  if (combined.includes('pe de atleta') || combined.includes('pé de atleta') || combined.includes('frieira') || combined.includes('friera')) {
    return 'Pé de Atleta';
  }
  if (combined.includes('cefaleia') || combined.includes('dor de cabeca') || combined.includes('dor de cabeça')) {
    return 'Cefaleia / Dor de Cabeça';
  }
  if (combined.includes('gripe') || combined.includes('resfriado') || combined.includes('coriza')) {
    return 'Sintomas Gripais';
  }
  if (combined.includes('diabetes') || combined.includes('diabetico') || combined.includes('glicemia') || combined.includes('glicose')) {
    return 'Diabetes & Glicemia';
  }
  if (combined.includes('pressao alta') || combined.includes('pressão alta') || combined.includes('hipertensao')) {
    return 'Hipertensão Arterial';
  }
  if (combined.includes('curativo') || combined.includes('cobertura') || combined.includes('hidrogel') || combined.includes('alginato')) {
    return 'Cuidados com Curativos';
  }
  if (combined.includes('exame') || combined.includes('laudo') || combined.includes('hemograma') || combined.includes('doppler')) {
    return 'Leitura de Exame';
  }

  // If user typed a prompt, generate a clean 3-5 word title from the user's question
  if (userClean.length > 3) {
    const words = userClean.split(/\s+/).slice(0, 4).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return null;
};

const AI_RESPONSES = {
  'Como higienizar a lesão em casa?': `Para higienizar a sua lesão de forma segura e acelerar a cicatrização, siga estas etapas recomendadas:
1. **Lave as mãos** com água e sabão antes de tocar em qualquer curativo.
2. Use **soro fisiológico morno (0.9%)** em jato suave diretamente sobre a região afetada. A temperatura morna evita o choque térmico nas células que estão reconstruindo a pele.
3. Se não tiver soro, utilize **água corrente limpa de chuveiro ou filtro**. Evite esfregar com força para não remover a pele nova que está crescendo.
4. Seque apenas a **pele saudável ao redor** dando batidinhas suaves com uma toalha limpa ou gaze.`,

  'O que comer para cicatrizar mais rápido?': `A alimentação desempenha um papel fundamental na regeneração da sua pele. Priorize:
- **Proteínas magras** (ovo, frango, peixe, feijão): São os tijolos que constroem a nova pele.
- **Vitamina C** (laranja, limão, acerola, brócolis): Essencial para a formação do colágeno.
- **Zinco** (sementes, carnes, castanhas): Ajuda a fortalecer a imunidade da pele.
- **Hidratação abundante**: Beba pelo menos 2 a 3 litros de água por dia. Tecidos desidratados demoram mais para cicatrizar.

*Atenção especial se tiver Diabetes*: Mantenha o controle estrito da glicemia, pois taxas elevadas de açúcar prejudicam a circulação e a cicatrização.`,

  'Como entender ou enviar um exame?': `Com o iRec, você pode entender seus exames clínicos de forma simples!

Você pode anexar um exame clicando no clipe de anexo (📎) ao lado da caixa de mensagens. Selecione o arquivo do seu exame para receber uma explicação clara dos termos médicos e orientações clínicas.

Eu consigo te ajudar a entender:
- **Hemogramas** (sinais de anemia ou inflamação)
- **Doppler Vascular** (circulação das pernas)
- **Glicose e Hemoglobina Glicada** (açúcar no sangue)`,

  'O que fazer se o curativo molhar ou vazar?': `Se o seu curativo molhar acidentalmente ou começar a vazar secreção:
1. **Troque a cobertura externa**: Um curativo úmido por fora pode atrair bactérias do ambiente para a ferida.
2. **Higienize com soro fisiológico morno** e seque delicadamente a pele ao redor.
3. **Aplique uma nova cobertura limpa**: Siga a orientação do seu enfermeiro assistente. Se o vazamento for muito frequente, avise a equipe para que eles indiquem um curativo de maior absorção (como alginato ou espuma).`,

  'default': `Olá! Sou o assistente de cuidados do iRec. Posso tirar dúvidas sobre cuidados com a pele, alimentação saudável para cicatrização e explicar os resultados de seus exames em palavras bem simples.

Além disso, você pode anexar um exame clicando no clipe (📎) abaixo.

Como posso te ajudar hoje?`
};

export default function AIChatAssistant({ clinicalProfile, setClinicalProfile }) {
  const DEFAULT_WELCOME = () => {
    let welcomeText = `Olá! Sou o assistente de cuidados do iRec. Posso tirar dúvidas sobre cicatrização de feridas, alimentação saudável para regeneração da pele, como higienizar lesões e explicar termos médicos de forma simples.

Além disso, também posso te ajudar a **traduzir resultados de exames** (clique no botão de clipe 📎 abaixo para enviar um exame).

Como posso te ajudar hoje?`;
    if (clinicalProfile?.attachedExams && clinicalProfile.attachedExams.length > 0) {
      const examNames = clinicalProfile.attachedExams.map(e => e.name).join(', ');
      welcomeText += `\n\n🔎 *Nota do iRec:* Identifiquei ${clinicalProfile.attachedExams.length} exame(s) anexado(s) ao seu prontuário (${examNames}). Suas triagens e resumos simplificados já estão disponíveis no seu painel para consulta da equipe médica!`;
    }
    return welcomeText;
  };

  const userId = clinicalProfile?.id || 'guest';

  const [threads, setThreads] = useState(() => {
    const saved = localStorage.getItem(`irec_chat_threads_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar conversas salvas:", e);
      }
    }
    return [
      {
        id: 'thread-default',
        title: 'Nova Conversa',
        messages: [
          {
            id: 1,
            sender: 'ai',
            text: DEFAULT_WELCOME(),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }
        ],
        updatedAt: Date.now()
      }
    ];
  });

  const [activeThreadId, setActiveThreadId] = useState(() => {
    const saved = localStorage.getItem(`irec_chat_active_thread_id_${userId}`);
    return saved || 'thread-default';
  });

  // Load threads when userId changes
  useEffect(() => {
    const threadKey = `irec_chat_threads_${userId}`;
    const activeKey = `irec_chat_active_thread_id_${userId}`;
    
    let savedThreads = localStorage.getItem(threadKey);
    let savedActiveId = localStorage.getItem(activeKey);
    
    // Auto-migration: only migrate legacy threads if they belong to this specific user (IREC-0225)
    if (!savedThreads && userId !== 'guest') {
      const legacyThreads = localStorage.getItem('irec_chat_threads');
      const legacyActiveId = localStorage.getItem('irec_chat_active_thread_id');
      const legacyOwner = localStorage.getItem('irec_chat_threads_owner');
      
      if (legacyThreads && (!legacyOwner || legacyOwner === userId)) {
        localStorage.setItem(threadKey, legacyThreads);
        if (legacyActiveId) {
          localStorage.setItem(activeKey, legacyActiveId);
        }
        savedThreads = legacyThreads;
        savedActiveId = legacyActiveId;
      }
    }
    
    let activeTimer = true;

    const applyThreads = (threadsList, activeId) => {
      if (activeTimer) {
        setThreads(threadsList);
        setActiveThreadId(activeId);
      }
    };

    if (savedThreads) {
      try {
        const parsed = JSON.parse(savedThreads);
        if (parsed && parsed.length > 0) {
          // Auto-repair and deduplication of local storage threads
          const seenIds = new Set();
          const cleanThreads = parsed.map((t, idx) => {
            let id = t.id;
            if (!id || seenIds.has(id)) {
              id = `thread-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`;
            }
            seenIds.add(id);
            
            const seenMsgIds = new Set();
            const cleanMessages = (t.messages || []).map((m, mIdx) => {
              let mId = m.id;
              if (!mId || seenMsgIds.has(mId)) {
                mId = `msg-${Date.now()}-${mIdx}-${Math.random().toString(36).substr(2, 6)}`;
              }
              seenMsgIds.add(mId);
              return { ...m, id: mId };
            });

            return { 
              ...t, 
              id, 
              messages: cleanMessages 
            };
          });

          const activeExists = cleanThreads.some(t => t.id === savedActiveId);
          const finalActiveId = activeExists ? savedActiveId : cleanThreads[0].id;
          
          const timeoutId = setTimeout(() => {
            applyThreads(cleanThreads, finalActiveId);
            localStorage.setItem(threadKey, JSON.stringify(cleanThreads));
            localStorage.setItem(activeKey, finalActiveId);
            if (userId !== 'guest') {
              localStorage.setItem('irec_chat_threads_owner', userId);
            }
          }, 0);

          return () => {
            activeTimer = false;
            clearTimeout(timeoutId);
          };
        }
      } catch (e) {
        console.error("Erro ao carregar e reparar conversas salvas:", e);
      }
    }
    
    const defaultThread = {
      id: 'thread-default',
      title: 'Nova Conversa',
      messages: [
        {
          id: 1,
          sender: 'ai',
          text: DEFAULT_WELCOME(),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ],
      updatedAt: Date.now()
    };

    const timeoutId = setTimeout(() => {
      applyThreads([defaultThread], 'thread-default');
    }, 0);

    return () => {
      activeTimer = false;
      clearTimeout(timeoutId);
    };
  }, [userId]);

  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const activeAudioRef = useRef(null);
  const ttsStoppedRef = useRef(false);
  const ttsTokenRef = useRef(0);
  const streamIntervalRef = useRef(null);

  // Renaming chat thread states
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleSaveTitle = (id) => {
    if (editingTitle.trim()) {
      const updated = threads.map(t => 
        t.id === id ? { ...t, title: editingTitle.trim(), manuallyRenamed: true } : t
      );
      saveThreads(updated);
    }
    setEditingThreadId(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ttsStoppedRef.current = true;
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    };
  }, []);

  // Split text into chunks safe for Google Translate TTS (max ~200 chars each)
  const splitTextForTTS = (text) => {
    const maxLen = 190;
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks = [];

    sentences.forEach(sentence => {
      let s = sentence.trim();
      if (!s) return;
      if (s.length <= maxLen) {
        chunks.push(s);
      } else {
        while (s.length > maxLen) {
          let breakIdx = s.lastIndexOf(',', maxLen);
          if (breakIdx < 40) breakIdx = s.lastIndexOf(' ', maxLen);
          if (breakIdx < 20) breakIdx = maxLen;
          chunks.push(s.substring(0, breakIdx + 1).trim());
          s = s.substring(breakIdx + 1).trim();
        }
        if (s.length > 0) chunks.push(s);
      }
    });

    return chunks.filter(c => c.length > 0);
  };

  const buildGoogleTTSUrl = (textChunk) => {
    return `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(textChunk)}`;
  };

  const playTTSQueue = (chunks, sessionToken) => {
    if (ttsStoppedRef.current || ttsTokenRef.current !== sessionToken || chunks.length === 0) {
      setSpeakingMessageId(null);
      activeAudioRef.current = null;
      return;
    }

    const currentChunk = chunks[0];
    const remainingChunks = chunks.slice(1);
    const url = buildGoogleTTSUrl(currentChunk);
    const audio = new Audio(url);
    activeAudioRef.current = audio;

    audio.onended = () => {
      if (ttsTokenRef.current === sessionToken) {
        playTTSQueue(remainingChunks, sessionToken);
      }
    };

    audio.onerror = (err) => {
      console.warn('[iRec TTS] Erro no chunk, pulando para o próximo:', err);
      if (ttsTokenRef.current === sessionToken) {
        playTTSQueue(remainingChunks, sessionToken);
      }
    };

    audio.play().catch((err) => {
      console.warn('[iRec TTS] Erro ao reproduzir:', err);
      if (ttsTokenRef.current === sessionToken) {
        playTTSQueue(remainingChunks, sessionToken);
      }
    });
  };

  const speakMessage = (msgId, text) => {
    if (speakingMessageId === msgId) {
      ttsStoppedRef.current = true;
      ttsTokenRef.current += 1;
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      setSpeakingMessageId(null);
      return;
    }

    ttsStoppedRef.current = true;
    const sessionToken = ++ttsTokenRef.current;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    const cleanText = text
      .replace(/[*#_~`>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    setSpeakingMessageId(msgId);
    ttsStoppedRef.current = false;

    const chunks = splitTextForTTS(cleanText);
    playTTSQueue(chunks, sessionToken);
  };

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0] || { id: 'thread-default', title: 'Conversa', messages: [] };
  const messages = activeThread.messages;

  const saveThreads = (updatedThreads) => {
    setThreads(updatedThreads);
    localStorage.setItem(`irec_chat_threads_${userId}`, JSON.stringify(updatedThreads));
    if (userId !== 'guest') {
      localStorage.setItem('irec_chat_threads_owner', userId);
    }
  };

  const selectThread = (id) => {
    setActiveThreadId(id);
    localStorage.setItem(`irec_chat_active_thread_id_${userId}`, id);
  };

  const handleNewThread = () => {
    const newId = createUniqueId('thread');
    const newThread = {
      id: newId,
      title: `Nova Conversa #${threads.length + 1}`,
      messages: [
        {
          id: createUniqueId('msg'),
          sender: 'ai',
          text: DEFAULT_WELCOME(clinicalProfile?.name || 'Paciente'),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ],
      updatedAt: createUniqueId('t')
    };
    const updated = [newThread, ...threads];
    saveThreads(updated);
    selectThread(newId);
  };

  const handleDeleteThread = (e, id) => {
    e.stopPropagation();
    const targetThread = threads.find(t => t.id === id);
    createAuditLog('AI_CHAT_DELETE_VIEW', id, { threadTitle: targetThread?.title });
    const updated = threads.filter(t => t.id !== id);
    if (updated.length === 0) {
      const newId = createUniqueId('thread');
      const newThread = {
        id: newId,
        title: 'Nova Conversa #1',
        messages: [
          {
            id: createUniqueId('msg'),
            sender: 'ai',
            text: DEFAULT_WELCOME(clinicalProfile?.name || 'Paciente'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }
        ],
        updatedAt: createUniqueId('t')
      };
      saveThreads([newThread]);
      selectThread(newId);
    } else {
      saveThreads(updated);
      if (activeThreadId === id) {
        selectThread(updated[0].id);
      }
    }
  };

  // Auto scroll optimization (IREC-0227)
  const messagesCount = messages ? messages.length : 0;
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 180;
        if (isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [messagesCount, isTyping]);

  // Stream responses word-by-word into the target thread safely (IREC-0059, IREC-0228, IREC-0229)
  const streamResponse = (responseText, existingMessages, threadId) => {
    setIsTyping(true);
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    const safeText = typeof responseText === 'string' ? responseText : (responseText ? String(responseText) : 'Não foi possível obter resposta.');
    let index = 0;
    let currentText = '';
    
    const newMessageId = createUniqueId('msg-stream');
    const msgsBase = existingMessages || (threads.find(t => t.id === threadId) || threads[0]).messages;
    const initialThreadMsg = [...msgsBase, {
      id: newMessageId,
      sender: 'ai',
      text: '',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }];

    setThreads(prevThreads => prevThreads.map(t => 
      t.id === threadId ? { ...t, messages: initialThreadMsg } : t
    ));

    const interval = setInterval(() => {
      if (index < safeText.length) {
        currentText += safeText[index];
        setThreads(prevThreads => prevThreads.map(t => {
          if (t.id === threadId) {
            const updatedMsgs = t.messages.map(msg => 
              msg.id === newMessageId ? { ...msg, text: currentText } : msg
            );
            return { ...t, messages: updatedMsgs };
          }
          return t;
        }));
        index++;
      } else {
        clearInterval(interval);
        streamIntervalRef.current = null;
        setIsTyping(false);
        setThreads(prevThreads => {
          const currentActiveThread = prevThreads.find(t => t.id === threadId) || prevThreads[0];
          
          createAuditLog('AI_CHAT_AI_RESPONSE', threadId, {
            message: safeText,
            threadTitle: currentActiveThread?.title
          });

          let finalThreads = prevThreads;
          if (!currentActiveThread?.manuallyRenamed) {
            const userMsg = [...msgsBase].find(m => m.sender === 'user') || [...msgsBase].reverse().find(m => m.sender === 'user');
            const userText = userMsg ? userMsg.text : '';
            const detected = detectTopicFromText(userText, safeText);
            if (detected) {
              finalThreads = prevThreads.map(t => 
                t.id === threadId ? { ...t, title: detected } : t
              );
            }
          }
          
          localStorage.setItem(`irec_chat_threads_${userId}`, JSON.stringify(finalThreads));
          return finalThreads;
        });
      }
    }, 8);
    streamIntervalRef.current = interval;
  };

  // Helper to merge, update and sync profile changes (IREC-0060)
  const applyProfileUpdates = async (updates) => {
    if (!updates || Object.keys(updates).length === 0) return null;
    
    const updatedProfile = { ...clinicalProfile };
    const changedFields = [];

    const keyMap = {
      name: 'Nome',
      birthDate: 'Nascimento',
      gender: 'Sexo',
      healthUnit: 'Unidade de Saúde',
      hasDiabetes: 'Diabetes',
      hasHypertension: 'Hipertensão',
      hasVenousInsufficiency: 'Insuf. Venosa',
      hasPeripheralArterialDisease: 'Doença Arterial',
      isSmoker: 'Fumante',
      isObese: 'Obesidade',
      hasAmputationHistory: 'Histórico de Amputação',
      medications: 'Medicamentos',
      allergies: 'Alergias',
      otherConditions: 'Outras Condições'
    };

    Object.keys(updates).forEach(key => {
      const val = updates[key];
      
      if (key === 'triageAlerts') {
        if (Array.isArray(val)) {
          const currentAlerts = clinicalProfile.triageAlerts || [];
          const mergedAlerts = [...currentAlerts];
          val.forEach(alert => {
            if (alert && !mergedAlerts.includes(alert)) {
              mergedAlerts.push(alert);
              changedFields.push(`Alerta de Risco: ${alert}`);
            }
          });
          updatedProfile.triageAlerts = mergedAlerts;
        }
      } else if (val !== undefined && val !== null && val !== '') {
        if (updatedProfile[key] !== val) {
          updatedProfile[key] = val;
          const displayVal = typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val);
          changedFields.push(`${keyMap[key] || key}: ${displayVal}`);
        }
      }
    });

    if (changedFields.length > 0) {
      try {
        const savedProfile = await updateClinicalProfile(updatedProfile);
        if (savedProfile && setClinicalProfile) {
          setClinicalProfile(savedProfile);
        }
        return changedFields;
      } catch (err) {
        console.error("Erro ao salvar perfil atualizado:", err);
      }
    }
    return null;
  };

  const handleSendMessageFromEditedHistory = async (textToSend, updatedMessages) => {
    const targetThreadId = activeThreadId;
    // 1. Try real Gemini API response first
    const realResponse = await chatWithAI(textToSend, updatedMessages, clinicalProfile);
    if (realResponse && typeof realResponse === 'object') {
      setIsTyping(false);
      streamResponse(realResponse.reply, updatedMessages, targetThreadId);
      return;
    }

    // 2. Fallback to local static QA rules if Gemini is not set up
    setTimeout(async () => {
      let response;
      const cleanInput = textToSend.toLowerCase().trim();
      const mockUpdates = {};
      
      if (cleanInput.includes('diabet') || cleanInput.includes('açúcar') || cleanInput.includes('glicem')) {
        if (!clinicalProfile.hasDiabetes) mockUpdates.hasDiabetes = true;
      }
      if (cleanInput.includes('pressão alta') || cleanInput.includes('hiperten')) {
        if (!clinicalProfile.hasHypertension) mockUpdates.hasHypertension = true;
      }

      const updatesList = await applyProfileUpdates(mockUpdates);
      const matchedKey = Object.keys(AI_RESPONSES).find(key => 
        cleanInput.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanInput)
      );
      if (matchedKey && matchedKey !== 'default') {
        response = AI_RESPONSES[matchedKey];
      } else {
        response = `Entendi a sua dúvida corrigida sobre "${textToSend}". Como seu assistente de cuidados gerais:
1. Para sintomas leves (resfriados, dores leves), repouse e hidrate-se.
2. Em caso de feridas, higienize com soro fisiológico morno.
3. Em caso de gravidade, procure pronto-socorro imediatamente.`;
      }

      response = `ℹ️ **[Orientações iRec]** Resposta de assistência clínica:\n\n${response}`;
      setIsTyping(false);
      
      let finalMessages = updatedMessages;
      if (updatesList && updatesList.length > 0) {
        const syncMsg = {
          id: createUniqueId('msg-sync'),
          sender: 'ai',
          text: `📋 **[iRec Prontuário - Atualização]** Ficha clínica atualizada no banco de dados:\n${updatesList.map(item => `• ${item}`).join('\n')}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        finalMessages = [...updatedMessages, syncMsg];
        saveThreads(threads.map(t => t.id === targetThreadId ? { ...t, messages: finalMessages } : t));
      }

      streamResponse(response, finalMessages, targetThreadId);
      isSubmittingRef.current = false;
    }, 1000);
  };

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  const handleStartEditMessage = (msgId, text) => {
    setEditingMessageId(msgId);
    setEditingMessageText(text);
  };

  const handleSaveEditMessage = async (msgId) => {
    if (!editingMessageText.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const currentActiveThread = threads.find(t => t.id === activeThreadId) || threads[0];
    const msgIndex = currentActiveThread.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) {
      isSubmittingRef.current = false;
      return;
    }

    const editedMsg = {
      ...currentActiveThread.messages[msgIndex],
      text: editingMessageText
    };

    const updatedMessages = [...currentActiveThread.messages.slice(0, msgIndex), editedMsg];
    
    const updatedThreads = threads.map(t => 
      t.id === activeThreadId ? { ...t, messages: updatedMessages, updatedAt: Date.now() } : t
    );
    saveThreads(updatedThreads);
    setEditingMessageId(null);

    setIsTyping(true);
    await handleSendMessageFromEditedHistory(editingMessageText, updatedMessages);
  };

  const handleReprocessMessage = async (msgId) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const currentActiveThread = threads.find(t => t.id === activeThreadId) || threads[0];
    const msgIndex = currentActiveThread.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) {
      isSubmittingRef.current = false;
      return;
    }

    const updatedMessages = currentActiveThread.messages.slice(0, msgIndex + 1);
    const targetMsgText = currentActiveThread.messages[msgIndex].text;

    const updatedThreads = threads.map(t => 
      t.id === activeThreadId ? { ...t, messages: updatedMessages, updatedAt: Date.now() } : t
    );
    saveThreads(updatedThreads);

    setIsTyping(true);
    await handleSendMessageFromEditedHistory(targetMsgText, updatedMessages);
  };

  const handleAutocorrectText = () => {
    if (!inputText.trim()) return;
    
    const typoCorrections = {
      'pascente': 'paciente',
      'pascentes': 'pacientes',
      'spary': 'spray',
      'sensoro': 'sensor',
      'whatasapp': 'WhatsApp',
      'whats': 'WhatsApp',
      'renomer': 'renomear',
      'inciada': 'iniciada',
      'hisotorico': 'histórico',
      'pe': 'pé',
      'pomadas': 'pomada'
    };

    const words = inputText.split(/(\s+)/);
    let correctedCount = 0;
    
    const correctedWords = words.map(w => {
      const cleanWord = w.toLowerCase().replace(/[.,/#!$%^&*:{}=\-_`~()?]/g, "");
      const correction = typoCorrections[cleanWord];
      if (correction) {
        correctedCount++;
        const isCapitalized = w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase();
        return isCapitalized 
          ? correction[0].toUpperCase() + correction.slice(1)
          : correction;
      }
      return w;
    });

    if (correctedCount > 0) {
      setInputText(correctedWords.join(''));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("O arquivo excede o limite máximo de 15MB.");
      return;
    }

    setSelectedFile(file);
    e.target.value = "";
  };

  const handleSendMessage = async (textToSend) => {
    const hasText = !!textToSend.trim();
    const hasFile = !!selectedFile;
    if ((!hasText && !hasFile) || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    const targetThreadId = activeThreadId;

    let msgText = textToSend;
    let localPreview = null;
    let fileObj = null;
    
    if (selectedFile) {
      fileObj = selectedFile;
      const icon = selectedFile.type.startsWith('image/') ? '🖼️' : '📄';
      const fileLabel = `${icon} ${selectedFile.name}`;
      msgText = textToSend.trim() ? `${textToSend}\n\n${fileLabel}` : fileLabel;
      if (selectedFile.type.startsWith('image/')) {
        try {
          localPreview = URL.createObjectURL(selectedFile);
        } catch (e) {
          console.error(e);
        }
      }
      setSelectedFile(null);
    }

    const userMsg = {
      id: createUniqueId('msg-user'),
      sender: 'user',
      text: msgText,
      filePreview: localPreview,
      fileName: fileObj ? fileObj.name : null,
      fileType: fileObj ? fileObj.type : null,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    
    const currentActiveThread = threads.find(t => t.id === targetThreadId) || threads[0];
    const updatedMessages = [...currentActiveThread.messages, userMsg];
    let newTitle = currentActiveThread.title;
    
    if (currentActiveThread.messages.length === 1 || currentActiveThread.title.startsWith('Nova Conversa')) {
      const titleSource = textToSend.trim() ? textToSend : (fileObj ? fileObj.name : 'Arquivo Anexado');
      newTitle = titleSource.substring(0, 24) + (titleSource.length > 24 ? '...' : '');
    }

    const updatedThreads = threads.map(t => 
      t.id === targetThreadId 
        ? { ...t, title: newTitle, messages: updatedMessages, updatedAt: Date.now() } 
        : t
    );
    saveThreads(updatedThreads);
    setInputText('');
    setIsTyping(true);

    createAuditLog('AI_CHAT_USER_MESSAGE', targetThreadId, {
      message: msgText,
      threadTitle: newTitle
    });

    // 1. Try real Gemini API response first
    const realResponse = await chatWithAI(textToSend, updatedMessages, clinicalProfile, fileObj);
    if (realResponse && typeof realResponse === 'object') {
      setIsTyping(false);
      
      const updatesList = await applyProfileUpdates(realResponse.profileUpdates);
      let finalMessages = updatedMessages;
      if (updatesList && updatesList.length > 0) {
        const syncMsg = {
          id: createUniqueId('msg-sync'),
          sender: 'ai',
          text: `📋 **[iRec Prontuário]** Ficha clínica atualizada no banco de dados para consulta médica:\n${updatesList.map(item => `• ${item}`).join('\n')}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        finalMessages = [...updatedMessages, syncMsg];
        const latestThread = threads.find(t => t.id === targetThreadId) || threads[0];
        const withSyncMsg = [...latestThread.messages, userMsg, syncMsg];
        saveThreads(threads.map(t => t.id === targetThreadId ? { ...t, messages: withSyncMsg } : t));
      }

      streamResponse(realResponse.reply, finalMessages, targetThreadId);
      isSubmittingRef.current = false;
      return;
    }

    // 2. Fallback to local static QA rules if Gemini is not set up (IREC-0223)
    setTimeout(async () => {
      let response;
      const cleanInput = textToSend.toLowerCase().trim();
      const mockUpdates = {};
      
      if (fileObj) {
        try {
          const examData = await uploadExamFileAndTriage(fileObj);
          if (examData && examData.summary) {
            response = `📄 **[Leitor de Exames iRec]** Análise do arquivo "${fileObj.name}":\n\n${examData.summary}`;
          } else {
            response = `Recebi seu arquivo "${fileObj.name}". O exame foi anexado ao seu prontuário para consulta da equipe médica.`;
          }
        } catch (e) {
          console.warn("Erro ao processar exame no leitor:", e);
          response = `Recebi seu arquivo "${fileObj.name}". O exame foi anexado ao seu prontuário para consulta da equipe médica.`;
        }
      } else {
        if (cleanInput.includes('diabet') || cleanInput.includes('açúcar') || cleanInput.includes('glicem')) {
          if (!clinicalProfile.hasDiabetes) {
            mockUpdates.hasDiabetes = true;
          }
        }
        if (cleanInput.includes('pressão alta') || cleanInput.includes('hiperten') || cleanInput.includes('losartana') || cleanInput.includes('captopril')) {
          if (!clinicalProfile.hasHypertension) {
            mockUpdates.hasHypertension = true;
          }
        }
        if (cleanInput.includes('fumo') || cleanInput.includes('cigarro') || cleanInput.includes('fumante')) {
          if (!clinicalProfile.isSmoker) {
            mockUpdates.isSmoker = true;
          }
        }
        if (cleanInput.includes('obeso') || cleanInput.includes('obesidade') || cleanInput.includes('acima do peso')) {
          if (!clinicalProfile.isObese) {
            mockUpdates.isObese = true;
          }
        }

        if (cleanInput.includes('tomo') || cleanInput.includes('uso') || cleanInput.includes('remedio') || cleanInput.includes('medicamento')) {
          const words = cleanInput.split(' ');
          const tomoIndex = words.findIndex(w => w === 'tomo' || w === 'uso');
          if (tomoIndex !== -1 && tomoIndex + 1 < words.length) {
            const medCandidate = words.slice(tomoIndex + 1, tomoIndex + 3).join(' ');
            if (medCandidate.length > 3) {
              mockUpdates.medications = medCandidate;
            }
          }
        }

        if (cleanInput.includes('alergia') || cleanInput.includes('alergico') || cleanInput.includes('alérgica')) {
          if (cleanInput.includes('dipirona')) {
            mockUpdates.allergies = 'Dipirona';
          } else if (cleanInput.includes('paracetamol')) {
            mockUpdates.allergies = 'Paracetamol';
          } else {
            mockUpdates.allergies = 'Alergias relatadas no chat';
          }
        }

        const updatesList = await applyProfileUpdates(mockUpdates);

        const matchedKey = Object.keys(AI_RESPONSES).find(key => 
          cleanInput.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanInput)
        );

        if (matchedKey && matchedKey !== 'default') {
          response = AI_RESPONSES[matchedKey];
        } else if (cleanInput.includes('exame') || cleanInput.includes('laudo') || cleanInput.includes('resultado')) {
          response = `Para me enviar um exame ou arquivo, clique no botão de clipe 📎 abaixo e selecione o documento ou imagem do seu dispositivo.`;
        } else if (cleanInput.includes('diabet') || cleanInput.includes('açúcar') || cleanInput.includes('glicem')) {
          response = `Olá! Percebi que você perguntou sobre diabetes ou glicemia. No seu perfil clínico consta que você é **${(mockUpdates.hasDiabetes || clinicalProfile.hasDiabetes) ? 'Diabético(a)' : 'não cadastrado como Diabético(a)'}**. 

Pacientes diabéticos exigem atenção redobrada no autocuidado. Gostaria de ver o guia de aplicação de curativos na aba correspondente?`;
        } else if (cleanInput.includes('curativo') || cleanInput.includes('hidrogel') || cleanInput.includes('alginato')) {
          response = `Sobre insumos e coberturas:
- O **Hidrogel** promove desbridamento autolítico e hidratação.
- O **Alginato de Cálcio** absorve alto volume de exsudato.`;
        } else if (cleanInput.includes('dor de cabeca') || cleanInput.includes('dor de cabeça') || cleanInput.includes('cefaleia')) {
          const hasDipyroneAllergy = clinicalProfile.allergies?.toLowerCase().includes('dipirona') || mockUpdates.allergies === 'Dipirona';
          if (hasDipyroneAllergy) {
            response = `Como você tem **alergia a Dipirona** no prontuário, utilize **Paracetamol** como alternativa segura de autocuidado.`;
          } else {
            response = `Opções comuns de autocuidado para cefaleia leve incluem **Dipirona** ou **Paracetamol**.`;
          }
        } else {
          response = `Entendi a sua dúvida sobre "${textToSend}". Como seu assistente de cuidados gerais:
1. Para sintomas leves (resfriados, dores leves), repouse, hidrate-se e evite esforços físicos.
2. Em caso de feridas, faça a higienização com soro fisiológico morno sob jato leve.
3. Se surgirem sinais de alerta (febre alta, dor intensa, secreção abundante), procure um médico.`;
        }

        if (updatesList && updatesList.length > 0) {
          const syncMsg = {
            id: Date.now() + 1,
            sender: 'ai',
            text: `📋 **[iRec Prontuário - Atualização]** Ficha clínica atualizada no banco de dados:\n${updatesList.map(item => `• ${item}`).join('\n')}`,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };
          const withSyncMsg = [...updatedMessages, syncMsg];
          saveThreads(threads.map(t => t.id === targetThreadId ? { ...t, messages: withSyncMsg } : t));
        }
      }

      response = `ℹ️ **[Orientações iRec]** Resposta de assistência clínica:\n\n${response}`;
      streamResponse(response, updatedMessages, targetThreadId);
      isSubmittingRef.current = false;
    }, 1000);
  };



  return (
    <div className="chat-layout-container">
      
      {/* Backdrop para mobile quando o sidebar de histórico estiver visível */}
      {showHistoryMobile && (
        <div 
          onClick={() => setShowHistoryMobile(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 1100,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Chat Window Principal */}
      <div className="chat-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, maxHeight: '100%', overflow: 'hidden', position: 'relative', height: '100%' }}>
        {/* Chat Header */}
        <div className="chat-header glass-panel" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '12px', 
          padding: '14px 18px', 
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          marginBottom: '16px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          minWidth: 0,
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '18px',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}>
              🤖
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Assistente Clínico iRec</h3>
              <p style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', margin: '2px 0 0 0', minWidth: 0 }}>
                <span style={{ display: 'inline-block', width: '7px', height: '7px', backgroundColor: '#10b981', borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 6px #10b981' }}></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, fontWeight: '600' }}>Online · Orientação de Cuidados & Tradução de Exames</span>
              </p>
            </div>
          </div>

          {/* Toggle Histórico Mobile */}
          <button
            type="button"
            className="mobile-history-toggle"
            onClick={() => setShowHistoryMobile(prev => !prev)}
            style={{
              background: 'none',
              cursor: 'pointer',
              padding: '6px',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              marginLeft: '4px'
            }}
            title="Ver Histórico de Conversas"
          >
            <svg style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="chat-messages-area" style={{ 
          flex: '1', 
          overflowY: 'auto', 
          overflowX: 'hidden',
          paddingRight: '6px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          marginBottom: '16px',
          width: '100%',
          minWidth: 0,
          minHeight: 0
        }}>
          {messages.map((msg) => {
            const isExamReport = msg.text.startsWith('📄 **Leitor de Exames');
            const isUserFile = msg.text.startsWith('📄 Documento Anexado');
            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{ 
                  backgroundColor: msg.sender === 'user' 
                    ? (isUserFile ? 'rgba(2, 132, 199, 0.12)' : '#0284c7') 
                    : 'var(--glass-bg)', 
                  color: msg.sender === 'user' 
                    ? (isUserFile ? 'var(--text-primary)' : '#ffffff') 
                    : 'var(--text-primary)',
                  padding: '12px 16px', 
                  borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  border: isExamReport 
                    ? '2.5px solid #0284c7' 
                    : isUserFile
                      ? '1.5px dashed #0284c7'
                      : msg.sender === 'user' 
                        ? 'none' 
                        : '1px solid var(--glass-border)',
                  backdropFilter: msg.sender === 'user' ? 'none' : 'blur(12px)',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  boxShadow: msg.sender === 'user' ? '0 4px 14px rgba(2, 132, 199, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                  whiteSpace: 'pre-line'
                }}>
                  {editingMessageId === msg.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                      <textarea
                        value={editingMessageText}
                        onChange={(e) => setEditingMessageText(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          fontSize: '13.5px',
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid #0284c7',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          resize: 'vertical',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setEditingMessageId(null)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditMessage(msg.id)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          Salvar e Enviar
                        </button>
                      </div>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', padding: '0 4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {msg.time}
                  </span>
                  {msg.sender === 'user' && editingMessageId !== msg.id && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEditMessage(msg.id, msg.text)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          padding: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#0284c7'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Editar mensagem"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReprocessMessage(msg.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          padding: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#0284c7'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Reprocessar pergunta"
                      >
                        🔄 Reprocessar
                      </button>
                    </div>
                  )}
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => speakMessage(msg.id, msg.text)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: speakingMessageId === msg.id ? '#0284c7' : 'var(--text-muted)',
                        padding: '2px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.8,
                        transition: 'opacity 0.2s'
                      }}
                      title={speakingMessageId === msg.id ? "Parar leitura por voz" : "Ouvir mensagem (Acessibilidade)"}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                    >
                      {speakingMessageId === msg.id ? '⏹️' : '🔊'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          {isTyping && (
            <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div className="dot-typing" style={{ display: 'flex', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#0284c7', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#0284c7', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></span>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#0284c7', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested chips */}
        {messages.length <= 2 && !isTyping && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', flexShrink: 0, width: '100%', minWidth: 0 }}>
            {SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(sug.text)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: 'var(--glass-bg)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.color = '#0284c7';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <span>{sug.icon}</span>
                {sug.text}
              </button>
            ))}
          </div>
        )}

        {/* Real File Attachment Preview popover above the input bar */}
        {selectedFile && (
          <div style={{
            position: 'absolute',
            bottom: '76px',
            left: '20px',
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid #0284c7',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.2)',
            padding: '10px 16px',
            zIndex: '1100',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>
                {selectedFile.type.startsWith('image/') ? '🖼️' : '📄'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--text-primary)' }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setSelectedFile(null)}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: 'none',
                color: '#ef4444',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
            >
              ✕ Remover
            </button>
          </div>
        )}

        {/* Input area */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="glass-panel"
          style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '10px', 
            padding: '14px 18px', 
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            flexShrink: 0,
            width: '100%',
            minWidth: 0
          }}
        >
          {/* Hidden native file input element */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />

          {/* Attachment paperclip button */}
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: selectedFile ? 'rgba(2, 132, 199, 0.15)' : 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderColor: selectedFile ? '#0284c7' : 'var(--glass-border)',
              color: selectedFile ? '#0284c7' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
            title="Anexar arquivo de exame, imagem ou documento"
          >
            <svg style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32a1.5 1.5 0 01-2.12-2.121L16.208 6" />
            </svg>
          </button>

          {/* Autocorrect button */}
          <button 
            type="button"
            onClick={handleAutocorrectText}
            disabled={isTyping || !inputText.trim()}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: '#0284c7',
              cursor: isTyping || !inputText.trim() ? 'not-allowed' : 'pointer',
              opacity: isTyping || !inputText.trim() ? 0.5 : 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
            title="✨ Corrigir ortografia automaticamente"
          >
            ✨
          </button>

          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tire dúvidas ou escreva os termos do seu exame..."
            disabled={isTyping}
            style={{ 
              flex: '1', 
              minWidth: 0,
              padding: '11px 18px', 
              borderRadius: '30px', 
              border: '1px solid var(--glass-border)', 
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
          
          <button 
            type="submit" 
            disabled={isTyping || !inputText.trim()}
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: isTyping || !inputText.trim() ? 'not-allowed' : 'pointer',
              opacity: isTyping || !inputText.trim() ? 0.6 : 1,
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0
            }}
            className="btn-send-message"
          >
            <span>Enviar</span>
            <svg style={{ width: '15px', height: '15px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>

      {/* Sidebar de Histórico de Conversas (renderizada do lado direito) */}
      <div 
        className={`chat-history-sidebar ${showHistoryMobile ? 'mobile-visible' : ''}`} 
      >
        <button
          onClick={handleNewThread}
          className="btn btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '13px',
            padding: '10px',
            borderRadius: '10px',
          }}
        >
          <svg style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conversa
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Histórico de Conversas
          </p>
          {threads.map(t => (
            <div
              key={t.id}
              onClick={() => {
                selectThread(t.id);
                setShowHistoryMobile(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: t.id === activeThreadId ? 'var(--primary-glow)' : 'transparent',
                border: '1px solid',
                borderColor: t.id === activeThreadId ? 'var(--primary)' : 'transparent',
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                if (t.id !== activeThreadId) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (t.id !== activeThreadId) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                <svg style={{ width: '16px', height: '16px', stroke: t.id === activeThreadId ? 'var(--primary)' : 'var(--text-secondary)', strokeWidth: '2', fill: 'none', flexShrink: 0 }} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {editingThreadId === t.id ? (
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleSaveTitle(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(t.id);
                      if (e.key === 'Escape') setEditingThreadId(null);
                    }}
                    autoFocus
                    style={{
                      fontSize: '12px',
                      padding: '2px 4px',
                      border: '1px solid var(--primary)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      width: '100%',
                      outline: 'none'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingThreadId(t.id);
                      setEditingTitle(t.title);
                    }}
                    title="Clique duas vezes para renomear"
                    style={{ 
                      fontSize: '12.5px', 
                      color: t.id === activeThreadId ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: t.id === activeThreadId ? '600' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'text',
                      flex: 1
                    }}
                  >
                    {t.title}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                {editingThreadId !== t.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingThreadId(t.id);
                      setEditingTitle(t.title);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      borderRadius: '4px',
                      transition: 'var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-glow)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Renomear conversa"
                  >
                    <svg style={{ width: '13px', height: '13px', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={(e) => handleDeleteThread(e, t.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    borderRadius: '4px',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--danger)';
                    e.currentTarget.style.backgroundColor = 'var(--danger-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Excluir conversa"
                >
                  <svg style={{ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
