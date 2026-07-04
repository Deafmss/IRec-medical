import React, { useState, useEffect, useRef } from 'react';
import { uploadExamFileAndTriage, updateClinicalProfile, createAuditLog } from '../services/supabaseService';
import { chatWithAI } from '../services/geminiService';

const SUGGESTIONS = [
  { text: 'Como higienizar a lesão?', icon: '💧' },
  { text: 'O que comer para cicatrizar mais rápido?', icon: '🍎' },
  { text: 'Como ler ou traduzir um exame?', icon: '📄' },
  { text: 'O que significa exsudato e esfacelo?', icon: '📖' }
];

const detectTopicFromText = (userText, aiText = '') => {
  const combined = (userText + ' ' + aiText).toLowerCase();
  
  if (combined.includes('pe de atleta') || combined.includes('pé de atleta') || combined.includes('tinea pedis') || combined.includes('frieira') || combined.includes('friera') || combined.includes('coceira no pe') || combined.includes('coceira no pé') || combined.includes('infeccao fungica') || combined.includes('infecção fúngica')) {
    return 'Pé de Atleta';
  }
  if (combined.includes('cefaleia') || combined.includes('dor de cabeca') || combined.includes('dor de cabeça')) {
    return 'Cefaleia';
  }
  if (combined.includes('gripe') || combined.includes('resfriado') || combined.includes('sintomas gripais') || combined.includes('tosse') || combined.includes('coriza')) {
    return 'Sintomas Gripais';
  }
  if (combined.includes('diabetes') || combined.includes('diabetico') || combined.includes('diabético') || combined.includes('glicemia') || combined.includes('glicose')) {
    return 'Diabetes';
  }
  if (combined.includes('pressao alta') || combined.includes('pressão alta') || combined.includes('hipertensao') || combined.includes('hipertensão')) {
    return 'Hipertensão';
  }
  if (combined.includes('curativo') || combined.includes('cobertura') || combined.includes('hidrogel') || combined.includes('alginato')) {
    return 'Cuidados com Feridas';
  }
  if (combined.includes('exame') || combined.includes('laudo') || combined.includes('sangue') || combined.includes('hemograma')) {
    return 'Leitura de Exame';
  }
  return null;
};

const EXAM_RESPONSES = {
  'hemograma': `📄 **Leitor de Exames iRec - Interpretação Simplificada**

Analisamos o seu **Hemograma Completo**. Aqui está a tradução dos resultados para uma linguagem simples:

*   **Leucócitos (Glóbulos Brancos): 13.500 /mm³** (Referência: 4.000 a 10.000)
    *   *O que significa:* Seus soldados de defesa estão elevados. Isso indica que seu corpo está ativamente combatendo uma **inflamação ou infecção**. Em pacientes com feridas, isso pode significar que a lesão precisa de uma avaliação mais atenta do enfermeiro para checar sinais locais de infecção.
*   **Hemoglobina (Glóbulos Vermelhos): 11.8 g/dL** (Referência: 12.0 a 15.5)
    *   *O que significa:* Está levemente baixa, sugerindo uma **anemia leve**. A hemoglobina transporta oxigênio para os tecidos; se estiver baixa, chega menos oxigênio na sua ferida, tornando a cicatrização um pouco mais lenta. Consumir alimentos ricos em ferro e vitamina C ajudará.
*   **Plaquetas: 280.000 /mm³** (Referência: 150.000 a 450.000)
    *   *O que significa:* Estão dentro dos limites normais! As plaquetas são responsáveis por estancar sangramentos e iniciar a primeira fase de fechamento de feridas.

**Recomendação clínica:** Mostre este exame ao seu enfermeiro de referência na próxima consulta para que ele avalie se há necessidade de usar alguma cobertura antimicrobiana (como Prata) no curativo.`,

  'doppler': `📄 **Leitor de Exames iRec - Interpretação Simplificada**

Analisamos o resultado do seu **Ultrassom Doppler Vascular dos Membros Inferiores**.

*   **Refluxo de veias safenas e veias profundas presente**
    *   *O que significa:* As veias das suas pernas estão com dificuldade para fazer o sangue voltar ao coração. Em vez de subir, parte do sangue "reflui" e fica acumulado nas pernas, gerando inchaço (edema) e peso.
*   **Ausência de trombose venosa profunda (TVP)**
    *   *O que significa:* Uma ótima notícia! Não há coágulos perigosos entupindo as veias principais das suas pernas.

**Por que isso afeta sua ferida?**
O acúmulo de sangue venoso aumenta a pressão local na pele, impedindo a oxigenação ideal dos tecidos. Essa é a causa clássica da sua **Úlcera Venosa**.

**Recomendação clínica:** Realize o repouso com as pernas elevadas acima do nível do coração (conforme indicado no seu *Diário de Cuidados*) e utilize sempre a meia elástica de compressão recomendada pela equipe médica ou de enfermagem.`,

  'glicose': `📄 **Leitor de Exames iRec - Interpretação Simplificada**

Analisamos o seu exame de **Glicose e Hemoglobina Glicada (HbA1c)**.

*   **Glicose em Jejum: 158 mg/dL** (Referência: menor que 99)
    *   *O que significa:* O açúcar no seu sangue nas primeiras horas da manhã está elevado. O ideal seria mantê-lo mais próximo da faixa normal.
*   **Hemoglobina Glicada (HbA1c): 8.2%** (Referência: menor que 5.7%)
    *   *O que significa:* A glicada mostra a "média" do açúcar no seu sangue nos últimos 3 meses. Uma glicada de 8.2% indica que a sua glicemia tem estado alta de forma persistente.

**Por que isso afeta sua ferida?**
O excesso de açúcar no sangue danifica a parede dos vasos e prejudica o sistema de defesa do corpo. Isso atrasa o fechamento da ferida e aumenta o risco de infecções.

**Recomendação clínica:** Siga as recomendações de controle glicêmico indicadas no seu *Diário de Cuidados*: tome seus medicamentos no horário, realize o monitoramento pontual e evite alimentos de alto índice glicêmico (doces, massas, refrigerantes).`
};

const AI_RESPONSES = {
  'Como higienizar a lesão?': `Para higienizar a sua lesão de forma segura e acelerar a cicatrização, siga estas etapas recomendadas:
1. **Lave as mãos** com água e sabão antes de tocar em qualquer curativo.
2. Use **soro fisiológico morno (0.9%)** em jato suave diretamente sobre o leito da ferida. A temperatura morna evita o choque térmico nas células que estão reconstruindo a pele.
3. Se não tiver soro, utilize **água corrente limpa de chuveiro ou filtro**. Evite esfregar a ferida com gazes para não remover a pele nova (tecido de granulação) que está crescendo.
4. Seque apenas a **pele saudável ao redor** (perilesão) dando batidinhas com uma toalha limpa ou gaze. O leito da ferida deve permanecer úmido para cicatrizar.`,

  'O que comer para cicatrizar mais rápido?': `A alimentação desempenha um papel crucial na velocidade de regeneração da sua pele. Priorize:
- **Proteínas magras** (ovo, frango, peixe, feijão): São os "tijolos" que constroem a nova pele.
- **Vitamina C** (laranja, limão, acerola, brócolis): Essencial para a formação do colágeno.
- **Zinco** (sementes, carnes, castanhas): Ajuda a combater infecções locais.
- **Hidratação abundante**: Beba pelo menos 2 a 3 litros de água por dia. Tecidos desidratados não cicatrizam.

*Atenção especial se tiver Diabetes*: Mantenha o controle estrito da glicemia, pois taxas elevadas de açúcar prejudicam a circulação e dificultam a cicatrização.`,

  'Como ler ou traduzir um exame?': `Com o iRec, você pode entender seus exames clínicos de forma simples!

Você pode anexar um exame clicando no clipe de anexo (📎) ao lado da caixa de mensagens. Selecione um dos exames de teste para ver a demonstração de como traduzimos os termos médicos em recomendações claras para sua ferida.

Eu consigo te ajudar a interpretar:
- **Hemogramas** (sinais de anemia ou infecções)
- **Doppler Vascular** (circulação e varizes)
- **Glicose e Hemoglobina Glicada** (diabetes e cicatrização)`,

  'O que significa exsudato e esfacelo?': `Esses são termos técnicos comuns em relatórios de feridas:
- **Exsudato**: É o líquido/secreção que sai da ferida. Em quantidade moderada, ele é benéfico pois mantém a ferida úmida e rica em fatores de crescimento. Se estiver abundante ou com pus, precisa de curativos especiais (como alginato).
- **Esfacelo**: É aquela camada amarela ou esbranquiçada no fundo da ferida. Trata-se de células mortas e fibrina que impedem o crescimento da pele nova. Precisa ser limpo com hidrogel para que a cicatrização avance.`,

  'default': `Olá! Sou o assistente de cuidados do iRec. Posso tirar dúvidas sobre cicatrização de feridas, alimentação saudável para regeneração da pele, como higienizar lesões e explicar termos médicos de forma simples.

Além disso, também posso te ajudar a **traduzir resultados de exames** (clique no botão de clipe 📎 abaixo para simular o envio de um exame).

Como posso te ajudar hoje?`
};

export default function AIChatAssistant({ clinicalProfile, setClinicalProfile }) {
  const DEFAULT_WELCOME = (name) => {
    let welcomeText = `Olá! Sou o assistente de cuidados do iRec. Posso tirar dúvidas sobre cicatrização de feridas, alimentação saudável para regeneração da pele, como higienizar lesões e explicar termos médicos de forma simples.

Além disso, também posso te ajudar a **traduzir resultados de exames** (clique no botão de clipe 📎 abaixo para simular o envio de um exame).

Como posso te ajudar hoje?`;
    if (clinicalProfile.attachedExams && clinicalProfile.attachedExams.length > 0) {
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
            text: DEFAULT_WELCOME(clinicalProfile?.name || 'Paciente'),
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
    
    // Auto-migration: if no user-specific history exists but legacy global history exists, migrate it
    if (!savedThreads && userId !== 'guest') {
      const legacyThreads = localStorage.getItem('irec_chat_threads');
      const legacyActiveId = localStorage.getItem('irec_chat_active_thread_id');
      if (legacyThreads) {
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
            // Ensure every thread has a unique ID to prevent react rendering conflicts
            if (!id || seenIds.has(id)) {
              id = `thread-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`;
            }
            seenIds.add(id);
            
            // Ensure messages inside the thread have unique IDs
            const seenMsgIds = new Set();
            const cleanMessages = (t.messages || []).map((m, mIdx) => {
              let mId = m.id;
              if (!mId || seenMsgIds.has(mId)) {
                mId = Date.now() + mIdx + Math.floor(Math.random() * 1000);
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
            // Save the repaired clean structure back to localStorage
            localStorage.setItem(threadKey, JSON.stringify(cleanThreads));
            localStorage.setItem(activeKey, finalActiveId);
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
    
    // Default thread fallback if none saved for this user
    const defaultThread = {
      id: 'thread-default',
      title: 'Nova Conversa',
      messages: [
        {
          id: 1,
          sender: 'ai',
          text: DEFAULT_WELCOME(clinicalProfile?.name || 'Paciente'),
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
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const [speakingMessageId, setSpeakingMessageId] = useState(null);

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

  const speakMessage = (msgId, text) => {
    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_~]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'pt-BR';
      utterance.onend = () => {
        setSpeakingMessageId(null);
      };
      utterance.onerror = () => {
        setSpeakingMessageId(null);
      };
      setSpeakingMessageId(msgId);
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);


  // Compute active thread and its messages list
  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0] || { id: 'thread-default', title: 'Conversa', messages: [] };
  const messages = activeThread.messages;

  // Helper to persist threads state
  const saveThreads = (updatedThreads) => {
    setThreads(updatedThreads);
    localStorage.setItem(`irec_chat_threads_${userId}`, JSON.stringify(updatedThreads));
  };

  // Helper to change active thread
  const selectThread = (id) => {
    setActiveThreadId(id);
    localStorage.setItem(`irec_chat_active_thread_id_${userId}`, id);
  };

  // Create new chat thread
  const handleNewThread = () => {
    const newId = `thread-${Date.now()}`;
    const newThread = {
      id: newId,
      title: `Nova Conversa #${threads.length + 1}`,
      messages: [
        {
          id: Date.now(),
          sender: 'ai',
          text: DEFAULT_WELCOME(clinicalProfile?.name || 'Paciente'),
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ],
      updatedAt: Date.now()
    };
    const updated = [newThread, ...threads];
    saveThreads(updated);
    selectThread(newId);
  };

  // Delete chat thread
  const handleDeleteThread = (e, id) => {
    e.stopPropagation();
    const targetThread = threads.find(t => t.id === id);
    createAuditLog('AI_CHAT_DELETE_VIEW', id, { threadTitle: targetThread?.title });
    const updated = threads.filter(t => t.id !== id);
    if (updated.length === 0) {
      // If no threads left, automatically create a fresh clean one
      const newId = `thread-${Date.now()}`;
      const newThread = {
        id: newId,
        title: 'Nova Conversa #1',
        messages: [
          {
            id: Date.now(),
            sender: 'ai',
            text: DEFAULT_WELCOME(clinicalProfile?.name || 'Paciente'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }
        ],
        updatedAt: Date.now()
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

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Stream responses word-by-word into the target thread
  const streamResponse = (responseText, existingMessages, threadId) => {
    setIsTyping(true);
    let index = 0;
    let currentText = '';
    
    // Create placeholder message for streaming in target thread
    const newMessageId = Date.now();
    const msgsBase = existingMessages || (threads.find(t => t.id === threadId) || threads[0]).messages;
    const initialThreadMsg = [...msgsBase, {
      id: newMessageId,
      sender: 'ai',
      text: '',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }];

    const threadsWithPlaceholder = threads.map(t => 
      t.id === threadId ? { ...t, messages: initialThreadMsg } : t
    );
    saveThreads(threadsWithPlaceholder);

    const interval = setInterval(() => {
      if (index < responseText.length) {
        currentText += responseText[index];
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
        setIsTyping(false);
        setThreads(prevThreads => {
          const currentActiveThread = prevThreads.find(t => t.id === threadId) || prevThreads[0];
          
          // Log AI response
          createAuditLog('AI_CHAT_AI_RESPONSE', threadId, {
            message: responseText,
            threadTitle: currentActiveThread?.title
          });

          let finalThreads = prevThreads;
          // Auto-rename based on clinical topic detection if not manually renamed
          if (!currentActiveThread?.manuallyRenamed) {
            const lastUserMsg = [...msgsBase].reverse().find(m => m.sender === 'user');
            const userText = lastUserMsg ? lastUserMsg.text : '';
            const detected = detectTopicFromText(userText, responseText);
            if (detected && currentActiveThread.title !== detected) {
              finalThreads = prevThreads.map(t => 
                t.id === threadId ? { ...t, title: detected } : t
              );
            }
          }
          
          localStorage.setItem(`irec_chat_threads_${userId}`, JSON.stringify(finalThreads));
          return finalThreads;
        });
      }
    }, 8); // faster typing for medical reports
  };

  // Helper to merge, update and sync profile changes
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
        if (setClinicalProfile) {
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
      let response = '';
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

      setIsTyping(false);
      
      let finalMessages = updatedMessages;
      if (updatesList && updatesList.length > 0) {
        const syncMsg = {
          id: Date.now() + 1,
          sender: 'ai',
          text: `📋 **[iRec Prontuário - Simulado]** Ficha clínica atualizada no banco de dados:\n${updatesList.map(item => `• ${item}`).join('\n')}`,
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
    if (!editingMessageText.trim()) return;

    const currentActiveThread = threads.find(t => t.id === activeThreadId) || threads[0];
    const msgIndex = currentActiveThread.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

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
    const currentActiveThread = threads.find(t => t.id === activeThreadId) || threads[0];
    const msgIndex = currentActiveThread.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

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
      'decente': 'decente',
      'inciada': 'iniciada',
      'hisotorico': 'histórico',
      'pe': 'pé',
      'pomadas': 'pomada',
      'copiloto': 'copiloto',
      'com': 'Como',
      'trato': 'trato'
    };

    const words = inputText.split(/(\s+)/);
    let correctedCount = 0;
    
    const correctedWords = words.map(w => {
      const cleanWord = w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
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
      id: Date.now(),
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
          id: Date.now() + 1,
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

    // 2. Fallback to local static QA rules if Gemini is not set up
    setTimeout(async () => {
      let response = '';
      const cleanInput = textToSend.toLowerCase().trim();
      const mockUpdates = {};
      
      if (fileObj) {
        response = `Recebi seu arquivo "${fileObj.name}". Sou um assistente de IA em cicatrização e saúde geral. Para laudos complexos de exames, por favor aguarde a análise do seu médico no prontuário.`;
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
            text: `📋 **[iRec Prontuário - Simulado]** Ficha clínica atualizada no banco de dados:\n${updatesList.map(item => `• ${item}`).join('\n')}`,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };
          const withSyncMsg = [...updatedMessages, syncMsg];
          saveThreads(threads.map(t => t.id === targetThreadId ? { ...t, messages: withSyncMsg } : t));
        }
      }

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
        <div className="chat-header" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '12px', 
          paddingBottom: '16px', 
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '16px',
          minWidth: 0,
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '18px',
              flexShrink: 0
            }}>
              iR
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Assistente Clínico iRec</h3>
              <p style={{ fontSize: '11px', color: 'var(--success-light)', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--success-light)', borderRadius: '50%', flexShrink: 0 }}></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Online · Orientação de Cuidados & Tradução de Exames</span>
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
                    ? (isUserFile ? 'rgba(14, 165, 233, 0.08)' : 'var(--primary)') 
                    : (isExamReport ? 'var(--bg-secondary)' : 'var(--bg-secondary)'), 
                  color: msg.sender === 'user' 
                    ? (isUserFile ? 'var(--text-primary)' : '#ffffff') 
                    : 'var(--text-primary)',
                  padding: '12px 16px', 
                  borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  border: isExamReport 
                    ? '2.5px solid var(--accent)' 
                    : isUserFile
                      ? '1.5px dashed var(--accent)'
                      : msg.sender === 'user' 
                        ? 'none' 
                        : '1px solid var(--border-color)',
                  fontSize: '13.5px',
                  lineHeight: '1.45',
                  boxShadow: isExamReport ? '0 6px 20px rgba(14, 165, 233, 0.08)' : 'var(--shadow-sm)',
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
                          border: '1px solid var(--primary)',
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
                            backgroundColor: 'var(--primary)',
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
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
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
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
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
                        color: speakingMessageId === msg.id ? 'var(--primary)' : 'var(--text-muted)',
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
            <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div className="dot-typing" style={{ display: 'flex', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both' }}></span>
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></span>
                <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--primary)', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></span>
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
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = 'var(--primary)';
                  e.target.style.backgroundColor = 'var(--primary-glow)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.backgroundColor = 'var(--bg-secondary)';
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
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--primary)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-md)',
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
                <span style={{ fontSize: '12.5px', fontWeight: '750', color: '#ffffff' }}>
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
          style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '10px', 
            paddingTop: '8px', 
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
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
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: selectedFile ? 'var(--primary-glow)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderColor: selectedFile ? 'var(--primary)' : 'var(--border-color)',
              color: selectedFile ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'var(--transition-fast)'
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
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--primary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'var(--transition-fast)'
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
              padding: '12px 18px', 
              borderRadius: '24px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '13.5px',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
          
          <button 
            type="submit" 
            disabled={isTyping || !inputText.trim()}
            className="btn btn-primary"
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '50%', 
              padding: '0', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <svg style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5', transform: 'rotate(45deg)' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
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
