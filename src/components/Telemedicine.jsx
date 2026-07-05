import React, { useState, useEffect, useRef } from 'react';
import { 
  getChatMessages, 
  sendChatMessage, 
  placeTelemedicineCall, 
  updateCallStatus, 
  checkIncomingCalls, 
  checkCallStatus, 
  subscribeToSignalingEvents,
  getAssignedPatients,
  getAssignedDoctor,
  getAssignedDoctors,
  followPatient,
  getAllPatients,
  getAllNurses,
  getAllDoctors,
  getAllClinicians,
  getAllReceivedMessages,
  sendWebRTCSignalingEvent,
  subscribeToWebRTCSignaling,
  sendTranscriptChunk,
  updateClinicalProfile
} from '../services/supabaseService';
import { analyzeTelemedicineTranscript } from '../services/geminiService';

const getDoctorPremiumDetails = (doc) => {
  if (!doc) return null;
  const idHash = doc.id ? doc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  
  const specialties = [
    {
      specialty: 'Estomaterapia',
      bio: 'Especialista em prevenção e tratamento avançado de feridas complexas, ostomias e incontinências. Pesquisadora em cicatrização acelerada por laserterapia.',
      education: 'Doutorado em Enfermagem Clínica - USP; Especialização em Estomaterapia - SOBEST.',
      stats: { rating: '4.9', patients: '420+', successRate: '98.5%' },
      reviews: [
        { patient: 'M. S.', text: 'Excelente profissional! Minha lesão venosa crônica de 2 anos cicatrizou completamente em apenas 5 semanas seguindo seu protocolo.' },
        { patient: 'R. A.', text: 'Muito atenciosa e precisa nas orientações sobre os curativos de alginato. Sempre disponível no chat.' }
      ]
    },
    {
      specialty: 'Dermatologia',
      bio: 'Especialista em patologias da pele, diagnóstico precoce de lesões teciduais e regeneração cutânea avançada.',
      education: 'Graduação em Medicina - UNICAMP; Residência em Dermatologia - HC-USP; Membro Titular da SBD.',
      stats: { rating: '4.8', patients: '680+', successRate: '97%' },
      reviews: [
        { patient: 'J. L.', text: 'Tratamento preciso e muito eficaz para minha dermatite e lesões na perna. Recomendo muito.' },
        { patient: 'A. C.', text: 'Ótima consulta por telemedicina. Conseguiu avaliar a lesão perfeitamente por foto e ajustar o creme cicatrizante.' }
      ]
    },
    {
      specialty: 'Endocrinologia',
      bio: 'Especialista em controle metabólico, prevenção e manejo clínico do Pé Diabético e neuropatias diabéticas periféricas.',
      education: 'Graduação em Medicina - UFMG; Título de Especialista pela SBEM; Fellow em Pé Diabético na Harvard Medical School.',
      stats: { rating: '4.9', patients: '950+', successRate: '99%' },
      reviews: [
        { patient: 'F. H.', text: 'O controle do meu diabetes melhorou 100% e evitamos uma complicação grave no meu pé. Profissional fantástico!' },
        { patient: 'G. M.', text: 'Explica tudo com muita clareza e empatia. A melhor escolha para quem tem diabetes e quer evitar feridas.' }
      ]
    },
    {
      specialty: 'Angiologia',
      bio: 'Especialista em sistema circulatório, tratamento clínico de varizes e úlceras venosas e arteriais crônicas.',
      education: 'Graduação em Medicina - UFRJ; Membro da Sociedade Brasileira de Angiologia e Cirurgia Vascular (SBACV).',
      stats: { rating: '4.7', patients: '510+', successRate: '96.8%' },
      reviews: [
        { patient: 'V. P.', text: 'Minha circulação melhorou muito e a úlcera varicosa finalmente fechou com a terapia de compressão recomendada.' }
      ]
    }
  ];

  const isDemoDoctor = doc.email && 
    (doc.email.includes('example.com') || doc.email.includes('demo.com') || doc.email.includes('mock')) && 
    !doc.name?.toLowerCase().includes('teste') && 
    !doc.name?.toLowerCase().includes('test');

  if (!isDemoDoctor) {
    return {
      ...doc,
      specialty: doc.specialty || 'Clínico Geral',
      bio: doc.bio || 'Profissional de saúde cadastrado no iRec.',
      education: doc.education || `Registro Profissional: ${doc.crm || doc.coren || 'Não informado'}`,
      price: doc.price || null,
      stats: { rating: 'Novo', patients: '0', successRate: '-' },
      reviews: []
    };
  }

  let specProfile = specialties.find(s => doc.specialty && doc.specialty.toLowerCase().includes(s.specialty.toLowerCase()));
  if (!specProfile) {
    specProfile = specialties[idHash % specialties.length];
  }

  return {
    ...doc,
    specialty: doc.specialty || specProfile.specialty,
    bio: specProfile.bio,
    education: specProfile.education,
    price: specProfile.price || null,
    stats: specProfile.stats,
    reviews: specProfile.reviews
  };
};

export default function Telemedicine({ currentUser, activeCallSession, setActiveCallSession, targetContactId = null, isAppActiveTab, setAppActiveTab, onUnreadCountChange }) {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedFileType, setAttachedFileType] = useState(null); // 'photo' or 'document'
  
  // Specialist Directory states
  const [showDirectory, setShowDirectory] = useState(false);
  const [allDoctorsList, setAllDoctorsList] = useState([]);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directoryFilterSpecialty, setDirectoryFilterSpecialty] = useState('all');
  const [selectedDirectoryDoctor, setSelectedDirectoryDoctor] = useState(null);

  useEffect(() => {
    if (currentUser?.role === 'patient') {
      async function loadAllDoctors() {
        try {
          const docs = await getAllDoctors();
          setAllDoctorsList(docs || []);
        } catch (e) {
          console.error('Error loading all doctors for directory:', e);
        }
      }
      loadAllDoctors();
    }
  }, [currentUser]);
  
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

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

  
  // Responsive / Mobile view states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState('contacts'); // 'contacts' or 'chat'

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Call States: 'idle', 'outgoing', 'incoming', 'active'
  const [callState, setCallState] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [muteAudio, setMuteAudio] = useState(false);
  const [hideVideo, setHideVideo] = useState(false);

  // Simulated Vitals
  const [heartRate, setHeartRate] = useState(72);
  const [spo2, setSpo2] = useState(98);
  const [respRate, setRespRate] = useState(16);

  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  const messagesEndRef = useRef(null);
  const ecgCanvasRef = useRef(null);
  const ecgAnimationRef = useRef(null);

  // Chat Expresso States
  const [showExpressChat, setShowExpressChat] = useState(false);
  const [expressMessageText, setExpressMessageText] = useState('');
  const [expressAttachedFile, setExpressAttachedFile] = useState(null);
  const [expressAttachedFileType, setExpressAttachedFileType] = useState(null);

  // Transcription & AI Triage States
  const [transcripts, setTranscripts] = useState([]);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [activeTabReports, setActiveTabReports] = useState('summary'); // 'summary', 'symptoms', 'prescription'
  const recognitionRef = useRef(null);
  const expressMessagesEndRef = useRef(null);

  // Audio elements for ringtones
  const audioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);

  const [contactsTrigger, setContactsTrigger] = useState(0);

  // Initial load & Polling: Fetch Contacts for real-time presence/last_seen_at sync
  useEffect(() => {
    async function loadContacts() {
      try {
        const list = [];
        if (currentUser.role === 'doctor' || currentUser.role === 'nurse') {
          const assigned = await getAssignedPatients(currentUser.id);
          assigned.forEach(p => {
            list.push({ ...p, role: 'patient', chatType: 'assigned_patient' });
          });
        } else if (currentUser.role === 'patient') {
          const doctors = await getAssignedDoctors(currentUser.id);
          doctors.forEach(d => {
            list.push({ ...d, role: 'doctor', chatType: 'assigned_doctor' });
          });
        }
        setContacts(list);
      } catch (err) {
        console.error('Erro ao buscar contatos de telemedicina:', err);
      }
    }
    loadContacts();

    // Poll contacts presence every 10 seconds
    const interval = setInterval(loadContacts, 10000);
    return () => clearInterval(interval);
  }, [currentUser, contactsTrigger]);

  // Filter and search contacts
  const filteredContacts = contacts.filter(c => {
    // 1. Search Query
    const nameMatch = c.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const specialtyMatch = c.specialty?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || specialtyMatch;
    
    if (!matchesSearch) return false;

    // 2. Filter tabs
    if (selectedFilter === 'all') return true;

    if (currentUser.role === 'doctor') {
      if (selectedFilter === 'assigned') return c.chatType === 'assigned_patient';
      if (selectedFilter === 'other_patients') return c.chatType === 'other_patient';
      if (selectedFilter === 'clinicians') return c.chatType === 'clinician';
    } else {
      if (selectedFilter === 'assigned_doctor') return c.chatType === 'assigned_doctor';
      if (selectedFilter === 'doctors') return c.chatType === 'doctor' || c.chatType === 'assigned_doctor';
      if (selectedFilter === 'nurses') return c.chatType === 'nurse';
    }

    return true;
  });

  // Handle Target Contact selection if redirected
  useEffect(() => {
    if (targetContactId && contacts.length > 0) {
      const match = contacts.find(c => c.id.toString() === targetContactId.toString());
      if (match) {
        setSelectedContact(match);
        if (isMobile) {
          setMobileView('chat');
        }
      }
    } else if (filteredContacts.length > 0 && !selectedContact) {
      setSelectedContact(filteredContacts[0]);
    }
  }, [contacts, filteredContacts, targetContactId, isMobile]);

  // Synchronize internal Telemedicine state with global activeCallSession from App.jsx
  useEffect(() => {
    if (!activeCallSession) {
      if (callState !== 'idle') {
        endMediaStream();
        setCallState('idle');
        setActiveCall(null);
        setCallDuration(0);
      }
    } else {
      setActiveCall(activeCallSession);
      if (activeCallSession.status === 'accepted') {
        if (callState !== 'active') {
          setCallState('active');
        }
      } else if (activeCallSession.status === 'ringing') {
        if (activeCallSession.receiverId === currentUser.id) {
          if (callState !== 'incoming') {
            setCallState('incoming');
            playRingtone();
          }
        } else {
          if (callState !== 'outgoing') {
            setCallState('outgoing');
          }
        }
      } else if (activeCallSession.status === 'ended' || activeCallSession.status === 'rejected') {
        if (callState !== 'idle') {
          endMediaStream();
          setCallState('idle');
          setActiveCall(null);
          setCallDuration(0);
        }
      }
    }
  }, [activeCallSession]);

  // Load chat messages when selected contact changes
  useEffect(() => {
    if (!selectedContact) return;
    
    async function loadMessages() {
      const chatHistory = await getChatMessages(currentUser.id, selectedContact.id);
      setMessages(chatHistory);
      scrollToBottom();
    }
    loadMessages();

    // Set up polling (2 seconds interval) for real-time chat sync across devices
    const interval = setInterval(async () => {
      const chatHistory = await getChatMessages(currentUser.id, selectedContact.id);
      setMessages(prev => {
        if (chatHistory.length !== prev.length || (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].id !== prev[prev.length - 1]?.id)) {
          setTimeout(scrollToBottom, 100);
          if (chatHistory.length > prev.length) {
            const lastMsg = chatHistory[chatHistory.length - 1];
            if (lastMsg && lastMsg.sender_id !== currentUser.id) {
              playNotificationSound();
            }
          }
          return chatHistory;
        }
        return prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedContact, currentUser]);

  // Poll received messages to compute unread counts for all contacts in real-time
  useEffect(() => {
    if (!currentUser) return;

    async function checkUnreadMessages() {
      try {
        const received = await getAllReceivedMessages(currentUser.id);
        const readTimes = JSON.parse(localStorage.getItem('irec_chat_read_times') || '{}');
        
        const counts = {};
        let newTotal = 0;
        
        received.forEach(msg => {
          // If the message is not from the active chat
          if (!selectedContact || msg.senderId !== selectedContact.id) {
            const lastRead = readTimes[msg.senderId] || '';
            if (msg.createdAt > lastRead) {
              counts[msg.senderId] = (counts[msg.senderId] || 0) + 1;
              newTotal++;
            }
          }
        });

        setUnreadCounts(prev => {
          const prevTotal = Object.values(prev).reduce((acc, curr) => acc + curr, 0);
          if (newTotal > prevTotal) {
            // Play notification chime for new message in background chats
            playNotificationSound();
          }
          return counts;
        });

        if (onUnreadCountChange) {
          onUnreadCountChange(newTotal);
        }
      } catch (err) {
        console.error('Erro ao verificar mensagens não lidas:', err);
      }
    }

    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUser, selectedContact, onUnreadCountChange]);

  // Mark all messages from the selected contact as read
  useEffect(() => {
    if (!selectedContact || !currentUser) return;

    const readTimes = JSON.parse(localStorage.getItem('irec_chat_read_times') || '{}');
    readTimes[selectedContact.id] = new Date().toISOString();
    localStorage.setItem('irec_chat_read_times', JSON.stringify(readTimes));

    // Clear unread counts locally immediately
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[selectedContact.id];
      const newTotal = Object.values(next).reduce((acc, curr) => acc + curr, 0);
      if (onUnreadCountChange) {
        onUnreadCountChange(newTotal);
      }
      return next;
    });
  }, [selectedContact, currentUser, messages, onUnreadCountChange]);

  // Subscribe to real-time local signaling channel events (same-machine inter-tab sync)
  useEffect(() => {
    const unsubscribe = subscribeToSignalingEvents(
      (newMsg) => {
        if (selectedContact && (newMsg.senderId === selectedContact.id || newMsg.recipientId === selectedContact.id)) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            setTimeout(scrollToBottom, 100);
            if (newMsg.senderId !== currentUser.id) {
              playNotificationSound();
            }
            return [...prev, newMsg];
          });
        }
      },
      (incomingCall) => {
        if (incomingCall.receiverId === currentUser.id && callState === 'idle') {
          setActiveCall(incomingCall);
          setCallState('incoming');
          playRingtone();
          if (setActiveCallSession) {
            setActiveCallSession(incomingCall);
          }
        }
      },
      (callId, status, duration) => {
        if (activeCall && activeCall.id.toString() === callId.toString()) {
          if (status === 'accepted') {
            setCallState('active');
            stopRingtone();
            if (setActiveCallSession) {
              setActiveCallSession(prev => prev ? { ...prev, status: 'accepted' } : null);
            }
          } else if (status === 'rejected') {
            stopRingtone();
            setCallState('idle');
            setActiveCall(null);
            if (setActiveCallSession) {
              setActiveCallSession(null);
            }
            alert('A chamada foi recusada.');
          } else if (status === 'ended') {
            stopRingtone();
            endMediaStream();
            setCallState('idle');
            setActiveCall(null);
            setCallDuration(0);
            if (setActiveCallSession) {
              setActiveCallSession(null);
            }
          }
        }
      },
      (senderRole, text) => {
        if (callState === 'active') {
          const newChunk = {
            role: senderRole,
            text,
            timestamp: new Date()
          };
          setTranscripts(prev => [...prev, newChunk]);

          if (currentUser.role === 'doctor' && senderRole === 'patient') {
            const lowerText = text.toLowerCase();
            const redFlags = [
              { term: 'febre', alertText: 'Paciente mencionou febre. Monitore temperatura e sinais de infecção.' },
              { term: 'preto', alertText: 'Mencionou ferida "preta". Risco de necrose ou isquemia.' },
              { term: 'escuro', alertText: 'Mencionou ferida "escura". Risco de necrose ou isquemia.' },
              { term: 'escura', alertText: 'Mencionou ferida "escura". Risco de necrose ou isquemia.' },
              { term: 'pus', alertText: 'Mencionou presença de pus ou secreção purulenta.' },
              { term: 'secreção amarela', alertText: 'Mencionou secreção amarelada/verde. Possível sinal de infecção.' },
              { term: 'dor insuportável', alertText: 'Paciente queixa-se de dor extrema ou insuportável.' },
              { term: 'dor forte', alertText: 'Paciente relatou dor forte na região.' },
              { term: 'dor no peito', alertText: 'Mencionou dor no peito. Risco cardíaco associado.' },
              { term: 'infecção', alertText: 'Paciente mencionou o termo "infecção". Verifique sinais flogísticos.' }
            ];

            redFlags.forEach(flag => {
              if (lowerText.includes(flag.term)) {
                setSafetyAlerts(prev => {
                  if (prev.some(a => a.text === flag.alertText)) return prev;
                  return [...prev, {
                    id: Date.now() + Math.random(),
                    text: flag.alertText,
                    type: 'warning'
                  }];
                });
              }
            });
          }
        }
      }
    );

    return () => unsubscribe();
  }, [selectedContact, callState, activeCall, currentUser, setActiveCallSession]);

  // Poll for incoming calls (for cross-device synchronization)
  useEffect(() => {
    if (callState !== 'idle') return;

    const interval = setInterval(async () => {
      const incoming = await checkIncomingCalls(currentUser.id);
      if (incoming && callState === 'idle') {
        setActiveCall(incoming);
        setCallState('incoming');
        playRingtone();
        if (setActiveCallSession) {
          setActiveCallSession(incoming);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [callState, currentUser, setActiveCallSession]);

  // Poll call status when call is outgoing (wait for receiver to accept/reject)
  useEffect(() => {
    if (callState !== 'outgoing' || !activeCall) return;

    const interval = setInterval(async () => {
      const statusCheck = await checkCallStatus(activeCall.id);
      if (statusCheck) {
        if (statusCheck.status === 'accepted') {
          setCallState('active');
          if (setActiveCallSession) {
            setActiveCallSession(statusCheck);
          }
          clearInterval(interval);
        } else if (statusCheck.status === 'rejected') {
          setCallState('idle');
          setActiveCall(null);
          if (setActiveCallSession) {
            setActiveCallSession(null);
          }
          clearInterval(interval);
          alert('O contato recusou a teleconsulta.');
        } else if (statusCheck.status === 'ended') {
          setCallState('idle');
          setActiveCall(null);
          if (setActiveCallSession) {
            setActiveCallSession(null);
          }
          clearInterval(interval);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [callState, activeCall, setActiveCallSession]);

  // Active call duration counter
  useEffect(() => {
    if (callState !== 'active') return;

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [callState]);

  // Hook WebRTC P2P
  useEffect(() => {
    if (callState === 'active' && activeCall) {
      const isCaller = activeCall.callerId === currentUser.id;
      console.log(`Inicializando WebRTC P2P. Sou iniciador? ${isCaller}`);
      initializeWebRTC(activeCall.id, isCaller);
    }
  }, [callState, activeCall]);

  // Request camera and microphone when video call starts
  useEffect(() => {
    if (callState === 'active') {
      startMediaStream();
      startECGAnimation();
      startVitalsSimulation();
    } else {
      endMediaStream();
      stopECGAnimation();
    }
  }, [callState]);

  // Manage SpeechRecognition lifecycle based on callState
  useEffect(() => {
    if (callState !== 'active') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    setTranscripts([]);
    setSafetyAlerts([]);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API não suportada neste navegador.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'pt-BR';

    rec.onresult = (event) => {
      const resultIndex = event.resultIndex;
      const transcriptText = event.results[resultIndex][0].transcript.trim();
      
      if (!transcriptText) return;

      const senderRole = currentUser.role === 'doctor' ? 'doctor' : 'patient';
      
      // Add local chunk to local state
      const newChunk = {
        role: senderRole,
        text: transcriptText,
        timestamp: new Date()
      };
      setTranscripts(prev => [...prev, newChunk]);

      // Broadcast chunk to peer
      sendTranscriptChunk(senderRole, transcriptText);
    };

    rec.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
    };

    rec.onend = () => {
      // Auto-restart if call is still active
      if (callState === 'active' && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Prevent spamming logs on manual stops
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.warn('Error starting speech recognition:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, [callState, currentUser]);

  // Scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollExpressToBottom = () => {
    expressMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll express chat when new messages arrive or when it is opened
  useEffect(() => {
    if (showExpressChat) {
      setTimeout(scrollExpressToBottom, 100);
    }
  }, [showExpressChat, messages]);

  // Ringtone synthesizer (Web Audio API)
  const playRingtone = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      
      const triggerTone = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      };

      triggerTone();
      ringIntervalRef.current = setInterval(triggerTone, 1500);
    } catch (e) {
      console.warn('Erro ao reproduzir bipe sonoro de toque:', e);
    }
  };

  const stopRingtone = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  };

  const playNotificationSound = () => {
    try {
      if (muteAudio) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = audioCtxRef.current || new AudioContextClass();
      if (!audioCtxRef.current) {
        audioCtxRef.current = ctx;
      }
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Erro ao reproduzir som de notificação:', e);
    }
  };


  // Pulse oximeter heart rate beep sound
  const playHeartBeatBeep = () => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  // Simulated Vitals loops
  const startVitalsSimulation = () => {
    const vitalsInterval = setInterval(() => {
      setHeartRate(prev => {
        const delta = Math.floor(Math.random() * 3) - 1;
        const next = Math.max(60, Math.min(100, prev + delta));
        playHeartBeatBeep();
        return next;
      });
      setSpo2(prev => {
        if (Math.random() > 0.8) {
          const delta = Math.floor(Math.random() * 3) - 1;
          return Math.max(95, Math.min(100, prev + delta));
        }
        return prev;
      });
      setRespRate(prev => {
        if (Math.random() > 0.9) {
          const delta = Math.floor(Math.random() * 3) - 1;
          return Math.max(12, Math.min(22, prev + delta));
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(vitalsInterval);
  };

  // WebRTC P2P Connection and Signaling
  const initializeWebRTC = async (callId, isCaller) => {
    try {
      console.log("Iniciando conexao WebRTC P2P para chamada:", callId);
      
      // Get local stream
      let stream = localStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }

      // STUN configuration
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19002' },
          { urls: 'stun:stun1.l.google.com:19002' }
        ]
      };
      
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Add tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote track
      pc.ontrack = (event) => {
        console.log("Track remota recebida com sucesso!");
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRTCSignalingEvent(callId, currentUser.id, 'candidate', event.candidate.toJSON());
        }
      };

      // Subscribe to WebRTC events
      const unsubscribeSignaling = subscribeToWebRTCSignaling(callId, async (signal) => {
        if (signal.sender_id === currentUser.id) return;
        
        try {
          if (signal.type === 'offer') {
            console.log("Recebida oferta SDP remota...");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendWebRTCSignalingEvent(callId, currentUser.id, 'answer', answer);
          } else if (signal.type === 'answer') {
            console.log("Recebida resposta SDP remota...");
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          } else if (signal.type === 'candidate') {
            console.log("Recebido candidato ICE remoto...");
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
          }
        } catch (err) {
          console.warn("Erro ao processar sinal WebRTC:", err);
        }
      });

      pc.unsubscribeSignaling = unsubscribeSignaling;

      // Send offer if caller
      if (isCaller) {
        console.log("Criando oferta WebRTC como Iniciador...");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendWebRTCSignalingEvent(callId, currentUser.id, 'offer', offer);
      }
    } catch (e) {
      console.error("Erro ao inicializar WebRTC:", e);
    }
  };

  // Webcam streamer
  const startMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Câmera ou Microfone não disponíveis:', err);
    }
  };

  const endMediaStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Clean up WebRTC peer connection
    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current;
      if (pc.unsubscribeSignaling) {
        pc.unsubscribeSignaling();
      }
      pc.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  // ECG Canvas Animation
  const startECGAnimation = () => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    let points = [];
    for (let i = 0; i < width; i++) {
      points.push(height / 2);
    }

    let cycleCount = 0;
    const animate = () => {
      if (!ecgCanvasRef.current) return;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      cycleCount++;
      let currentVal = height / 2;
      const period = Math.floor(3600 / heartRate); 
      const step = cycleCount % period;

      if (step === 0) {
        currentVal = height / 2;
      } else if (step === 5) {
        currentVal = height / 2 - 4;
      } else if (step === 10) {
        currentVal = height / 2;
      } else if (step === 13) {
        currentVal = height / 2 + 8;
      } else if (step === 15) {
        currentVal = height / 2 - 35;
      } else if (step === 17) {
        currentVal = height / 2 + 15;
      } else if (step === 20) {
        currentVal = height / 2;
      } else if (step === 25) {
        currentVal = height / 2 - 8;
      } else if (step === 32) {
        currentVal = height / 2;
      }

      points.push(currentVal);
      points.shift();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, points[0]);
      for (let i = 1; i < width; i++) {
        ctx.lineTo(i, points[i]);
      }
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(width - 1, points[width - 1], 4, 0, Math.PI * 2);
      ctx.fill();

      ecgAnimationRef.current = requestAnimationFrame(animate);
    };

    ecgAnimationRef.current = requestAnimationFrame(animate);
  };

  const stopECGAnimation = () => {
    if (ecgAnimationRef.current) {
      cancelAnimationFrame(ecgAnimationRef.current);
      ecgAnimationRef.current = null;
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedContact || (!newMessageText.trim() && !attachedFile)) return;

    try {
      const txt = newMessageText;
      const file = attachedFile;
      const fileType = attachedFileType;

      setNewMessageText('');
      setAttachedFile(null);
      setAttachedFileType(null);

      const sent = await sendChatMessage(currentUser.id, selectedContact.id, txt, file, fileType);
      if (sent) {
        setMessages(prev => {
          if (prev.some(m => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      alert('Não foi possível enviar a mensagem no momento.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo excede o limite máximo de 10MB.');
      return;
    }

    setAttachedFile(file);
    if (file.type.startsWith('image/')) {
      setAttachedFileType('photo');
    } else {
      setAttachedFileType('document');
    }
  };

  const handleSendExpressMessage = async (e) => {
    e.preventDefault();
    if (!selectedContact || (!expressMessageText.trim() && !expressAttachedFile)) return;

    try {
      const txt = expressMessageText;
      const file = expressAttachedFile;
      const fileType = expressAttachedFileType;

      setExpressMessageText('');
      setExpressAttachedFile(null);
      setExpressAttachedFileType(null);

      const sent = await sendChatMessage(currentUser.id, selectedContact.id, txt, file, fileType);
      if (sent) {
        setMessages(prev => {
          if (prev.some(m => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
        setTimeout(scrollExpressToBottom, 100);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem expressa:', err);
      alert('Não foi possível enviar a mensagem no momento.');
    }
  };

  const handleExpressFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo excede o limite máximo de 10MB.');
      return;
    }

    setExpressAttachedFile(file);
    if (file.type.startsWith('image/')) {
      setExpressAttachedFileType('photo');
    } else {
      setExpressAttachedFileType('document');
    }
  };

  const startCall = async () => {
    if (!selectedContact) return;
    setCallState('outgoing');
    const call = await placeTelemedicineCall(currentUser.id, selectedContact.id);
    setActiveCall(call);
    if (setActiveCallSession) {
      setActiveCallSession(call);
    }
  };

  const acceptCall = async () => {
    if (!activeCall) return;
    stopRingtone();
    await updateCallStatus(activeCall.id, 'accepted');
    setCallState('active');
    if (setActiveCallSession) {
      setActiveCallSession(prev => prev ? { ...prev, status: 'accepted' } : null);
    }
  };

  const rejectCall = async () => {
    if (!activeCall) return;
    stopRingtone();
    await updateCallStatus(activeCall.id, 'rejected');
    setCallState('idle');
    setActiveCall(null);
    if (setActiveCallSession) {
      setActiveCallSession(null);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    
    // Stop local media streams immediately
    endMediaStream();
    
    // Update call status in database
    await updateCallStatus(activeCall.id, 'ended', callDuration);

    if (currentUser.role === 'doctor' && transcripts.length > 0) {
      setShowSummaryModal(true);
      setIsGeneratingSummary(true);
      
      try {
        const patientProfile = selectedContact;
        const transcriptText = transcripts.map(t => `${t.role === 'doctor' ? 'Médico' : 'Paciente'}: ${t.text}`).join('\n');
        
        const report = await analyzeTelemedicineTranscript(transcriptText, patientProfile || {});
        setAiReport(report);
      } catch (err) {
        console.error("Erro ao analisar transcrição ao encerrar chamada:", err);
      } finally {
        setIsGeneratingSummary(false);
      }
    } else {
      // Direct transition to idle for patients or if no speech was captured
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
      if (setActiveCallSession) {
        setActiveCallSession(null);
      }
    }
  };

  const discardClinicalSummary = () => {
    setShowSummaryModal(false);
    setAiReport(null);
    setCallState('idle');
    setActiveCall(null);
    setCallDuration(0);
    if (setActiveCallSession) {
      setActiveCallSession(null);
    }
  };

  const saveClinicalSummary = async () => {
    try {
      if (!selectedContact || !aiReport) return;

      let updatedMedications = selectedContact.medications || '';
      let updatedConditions = selectedContact.otherConditions || '';
      
      // 1. Accumulate selected prescriptions
      const selectedPrescriptions = aiReport.suggestedPrescriptions
        ?.filter((_, idx) => document.getElementById(`presc-${idx}`)?.checked)
        .map(p => `${p.name} (${p.dosage})`) || [];
        
      if (selectedPrescriptions.length > 0) {
        const newPrescriptionStr = selectedPrescriptions.join(', ');
        updatedMedications = updatedMedications 
          ? `${updatedMedications}, ${newPrescriptionStr}` 
          : newPrescriptionStr;
      }

      // 2. Accumulate selected symptoms
      const selectedSymptoms = aiReport.symptoms
        ?.filter((_, idx) => document.getElementById(`symp-${idx}`)?.checked)
        .map(s => `${s.name} (${s.intensity})`) || [];

      if (selectedSymptoms.length > 0) {
        const newSymptomsStr = `Sintomas em ${new Date().toLocaleDateString('pt-BR')}: ${selectedSymptoms.join(', ')}`;
        updatedConditions = updatedConditions 
          ? `${updatedConditions}\n${newSymptomsStr}` 
          : newSymptomsStr;
      }

      // 3. Update clinical profile in database
      const updatedProfile = {
        ...selectedContact,
        medications: updatedMedications,
        otherConditions: updatedConditions
      };
      
      await updateClinicalProfile(selectedContact.id, updatedProfile);

      // 4. Send official evolution note to chat messages
      const evolutionText = document.getElementById('ai-evolution-text')?.value || aiReport.clinicalEvolution;
      const formattedChatMsg = `📋 **Evolução de Telemedicina (Resumo IA)**\n\n**Resumo**: ${aiReport.executiveSummary}\n\n**Evolução Clínica**: ${evolutionText}\n\n**Risco Estimado**: ${aiReport.riskLevel}`;
      
      const sent = await sendChatMessage(currentUser.id, selectedContact.id, formattedChatMsg, null, null);
      if (sent) {
        setMessages(prev => {
          if (prev.some(m => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
      }
      
      alert('Resumo gravado com sucesso no prontuário e enviado ao histórico!');
    } catch (e) {
      console.error('Erro ao salvar resumo da consulta:', e);
      alert('Erro ao gravar prontuário. A consulta foi encerrada.');
    } finally {
      setShowSummaryModal(false);
      setAiReport(null);
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
      if (setActiveCallSession) {
        setActiveCallSession(null);
      }
    }
  };

  const formatTimer = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const initials = selectedContact && selectedContact.name ? selectedContact.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  if (!isAppActiveTab) {
    if (callState === 'active') {
      return (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: isMobile ? '280px' : '340px',
          height: isMobile ? '210px' : '260px',
          backgroundColor: '#090d16',
          borderRadius: '16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          border: '2px solid #1e293b',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
          overflow: 'hidden'
        }}>
          {/* PiP Header */}
          <div style={{
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            borderBottom: '1px solid #1e293b',
            color: '#ffffff',
            fontSize: '11px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'blink 1.5s infinite' }} />
              <span style={{ fontWeight: '800' }}>TELECONSULTA</span>
            </div>
            <strong style={{ fontFamily: 'monospace' }}>{formatTimer(callDuration)}</strong>
          </div>

          {/* PiP Video Area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hideVideo ? (
              <div style={{ fontSize: '11px', color: '#64748b' }}>Vídeo pausado</div>
            ) : (
              <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    margin: '0 auto 4px auto'
                  }}>
                    {initials}
                  </div>
                  <p style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '11px', margin: 0 }}>
                    {selectedContact ? selectedContact.name : 'Clínico'}
                  </p>
                </div>
                
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, rgba(9,13,22,0.9) 80%)'
                }} />
              </div>
            )}

            {/* PiP Local Video (mini) */}
            <div style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              width: '70px',
              height: '52px',
              borderRadius: '6px',
              backgroundColor: '#1e293b',
              overflow: 'hidden',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              border: '1px solid #334155',
              zIndex: 10
            }}>
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)'
                }}
              />
            </div>

            {/* No simulated vitals overlay */}
          </div>


          {/* PiP Toolbar */}
          <div style={{
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #1e293b'
          }}>
            <button 
              type="button"
              onClick={() => setMuteAudio(prev => !prev)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: muteAudio ? '#ef4444' : '#1e293b',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={muteAudio ? "Desmutar Áudio" : "Mutar Áudio"}
            >
              {muteAudio ? (
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              ) : (
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              )}
            </button>

            <button 
              type="button"
              onClick={() => setHideVideo(prev => !prev)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: hideVideo ? '#ef4444' : '#1e293b',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={hideVideo ? "Ligar Câmera" : "Desligar Câmera"}
            >
              {hideVideo ? (
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841-4.833L11.33 7.88M9.75 21.25H4.5a2.25 2.25 0 0 1-2.25-2.25V15m17.43-11.43 1.42 1.42M3 3l18 18" />
                </svg>
              ) : (
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              )}
            </button>

            <button 
              type="button"
              onClick={() => setAppActiveTab('telemedicine')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Maximizar Chamada"
            >
              <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
              </svg>
            </button>

            <button 
              type="button"
              onClick={endCall}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Encerrar Consulta"
            >
              <svg style={{ width: '14px', height: '14px', transform: 'rotate(135deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12m0 0 2.25 2.25M16.5 12l2.25-2.25M16.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            </button>
          </div>
          <style>{`
            @keyframes blink {
              0% { opacity: 0.2; }
              50% { opacity: 1; }
              100% { opacity: 0.2; }
            }
          `}</style>
        </div>
      );
    }
    const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    return (
      <div style={{
        position: 'fixed',
        bottom: isMobile ? '88px' : '24px',
        right: isMobile ? '16px' : '24px',
        zIndex: 99999,
        fontFamily: 'var(--font-primary)'
      }}>
        {/* Floating Chat Trigger Button */}
        <button
          type="button"
          onClick={() => setShowExpressChat(prev => !prev)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(14, 165, 233, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'transform 0.2s ease, background-color 0.2s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title={showExpressChat ? "Fechar Chat de Telemedicina" : "Abrir Chat de Telemedicina"}
        >
          {showExpressChat ? (
            <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg style={{ width: '26px', height: '26px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 18.97a5.969 5.969 0 0 1-.749-2.555C3.388 15.11 3.25 13.621 3.25 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          )}
          
          {totalUnread > 0 && !showExpressChat && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: 'bold',
              border: '2px solid var(--bg-primary)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            }}>
              {totalUnread}
            </span>
          )}
        </button>

        {/* Floating Express Chat Window */}
        {showExpressChat && (
          <div style={{
            position: 'absolute',
            bottom: '76px',
            right: 0,
            width: isMobile ? 'calc(100vw - 48px)' : '360px',
            maxWidth: 'calc(100vw - 48px)',
            height: '450px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {selectedContact ? (
              // Active Conversation Mode
              <>
                {/* Header */}
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {/* Back button */}
                  <button 
                    type="button"
                    onClick={() => setSelectedContact(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.8
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.8; }}
                    title="Voltar para contatos"
                  >
                    <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedContact.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: selectedContact.online ? '#10b981' : '#64748b' }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {selectedContact.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={() => setShowExpressChat(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    &times;
                  </button>
                </div>

                {/* Messages list */}
                <div style={{
                  flex: 1,
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  backgroundColor: 'var(--bg-primary)'
                }}>
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: '0 20px' }}>
                      Nenhuma mensagem ainda. Envie uma mensagem abaixo.
                    </div>
                  ) : (
                    messages.map(m => {
                      const isOwn = m.senderId === currentUser.id;
                      return (
                        <div 
                          key={m.id}
                          style={{
                            alignSelf: isOwn ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isOwn ? 'flex-end' : 'flex-start',
                            gap: '2px'
                          }}
                        >
                          <div style={{
                            padding: '8px 12px',
                            borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            backgroundColor: isOwn ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: isOwn ? '#ffffff' : 'var(--text-primary)',
                            fontSize: '12px',
                            border: isOwn ? 'none' : '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                            wordBreak: 'break-word'
                          }}>
                            {m.fileUrl && (
                              <div style={{ marginBottom: m.message ? '6px' : 0 }}>
                                {m.fileType === 'photo' ? (
                                  <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <img 
                                      src={m.fileUrl} 
                                      alt="Imagem" 
                                      style={{
                                        maxWidth: '100%',
                                        maxHeight: '120px',
                                        borderRadius: '6px',
                                        display: 'block'
                                      }} 
                                    />
                                  </a>
                                ) : (
                                  <a 
                                    href={m.fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '6px 10px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(255,255,255,0.15)',
                                      color: '#ffffff',
                                      textDecoration: 'none',
                                      fontSize: '11px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    📄 {m.fileName || 'Doc'}
                                  </a>
                                )}
                              </div>
                            )}
                            {m.message && <span>{m.message}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                              {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {m.message && (
                              <button
                                type="button"
                                onClick={() => speakMessage(m.id, m.message)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '10px',
                                  color: speakingMessageId === m.id ? 'var(--primary)' : 'var(--text-secondary)',
                                  padding: '2px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: 0.8
                                }}
                                title={speakingMessageId === m.id ? "Parar leitura por voz" : "Ouvir mensagem (Acessibilidade)"}
                              >
                                {speakingMessageId === m.id ? '⏹️' : '🔊'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={expressMessagesEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendExpressMessage} style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="file" 
                      id="express-chat-file" 
                      onChange={handleExpressFileChange}
                      style={{ display: 'none' }}
                      accept="image/*,application/pdf"
                    />
                    <label 
                      htmlFor="express-chat-file" 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: expressAttachedFile ? 'var(--primary)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s ease'
                      }}
                      title="Anexar foto ou PDF"
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                      </svg>
                    </label>
                  </div>
                  <input 
                    type="text"
                    value={expressMessageText}
                    onChange={(e) => setExpressMessageText(e.target.value)}
                    placeholder={expressAttachedFile ? "Adicione uma legenda..." : "Digite uma mensagem rápida..."}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '18px',
                      padding: '8px 14px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                  />
                  <button 
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s ease'
                    }}
                    title="Enviar mensagem"
                  >
                    <svg style={{ width: '14px', height: '14px', transform: 'rotate(45deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </button>
                </form>
              </>
            ) : (
              // Contacts List Mode
              <>
                {/* Header */}
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    💬 Mensagens de Telemedicina
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowExpressChat(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    &times;
                  </button>
                </div>
                
                {/* Contacts list */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {contacts.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Nenhum contato ativo encontrado.
                    </div>
                  ) : (
                    contacts.map(c => {
                      const isOnline = c.online;
                      const roleLabel = c.chatType === 'assigned_patient' || c.chatType === 'other_patient' ? 'Paciente' : (c.chatType === 'assigned_doctor' ? 'Médico Assistente' : 'Profissional');
                      const initials = c.name ? c.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
                      
                      return (
                        <div 
                          key={c.id}
                          onClick={() => {
                            setSelectedContact(c);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div style={{ position: 'relative', display: 'flex' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary-glow)',
                              border: '1.5px solid var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '800',
                              color: '#ffffff',
                              fontSize: '14px'
                            }}>
                              {initials}
                            </div>
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: isOnline ? '#10b981' : '#64748b',
                              border: '2px solid var(--bg-secondary)'
                            }} />
                          </div>
                          
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.name}
                              </span>
                              <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                                {roleLabel}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.lastMessageText || 'Clique para conversar.'}
                            </div>
                          </div>
                          
                          {c.unreadCount > 0 && (
                            <div style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              borderRadius: '10px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              minWidth: '18px',
                              textAlign: 'center'
                            }}>
                              {c.unreadCount}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-layout-container" style={{
      fontFamily: 'var(--font-primary)',
      color: 'var(--text-primary)',
      padding: 0,
      gap: 0,
      height: '100%',
      border: 'none',
      borderRadius: 0
    }}>
      
      {/* 1. Chat Interface Area (Left/Center on Desktop) */}
      {(!isMobile || mobileView === 'chat') && (
        <div className="telemedicine-chat-pane" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-primary)',
          height: '100%'
        }}>
          {selectedContact ? (
            <>
              {/* Header info */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
                  {isMobile && (
                    <button 
                      onClick={() => setMobileView('contacts')}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px 8px 8px 0',
                        marginRight: '8px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Voltar para contatos"
                    >
                      <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedContact.name}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedContact.role === 'doctor' || selectedContact.crm ? (selectedContact.specialty || 'Profissional de Saúde') : 'Paciente vinculado'}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <button 
                  onClick={startCall}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '30px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                  className="btn-video-call"
                >
                  <svg style={{ width: '15px', height: '15px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Iniciar Chamada
                </button>
              </div>

              {/* Chat message history list */}
              <div style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'var(--bg-primary)'
              }}>
                {messages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', maxWidth: '300px' }}>
                    💬 Nenhuma mensagem ainda. Inicie a conversa enviando uma mensagem ou compartilhando arquivos.
                  </div>
                ) : (
                  messages.map(m => {
                    const isOwn = m.senderId === currentUser.id;
                    return (
                      <div 
                        key={m.id}
                        style={{
                          alignSelf: isOwn ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwn ? 'flex-end' : 'flex-start',
                          gap: '4px'
                        }}
                      >
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isOwn ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          backgroundColor: isOwn ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: isOwn ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '13px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          wordBreak: 'break-word'
                        }}>
                          {m.fileUrl && (
                            <div style={{ marginBottom: m.message ? '8px' : 0 }}>
                              {m.fileType === 'photo' ? (
                                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={m.fileUrl} 
                                    alt="Imagem anexada" 
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '200px',
                                      borderRadius: '8px',
                                      display: 'block',
                                      border: '1px solid rgba(0,0,0,0.1)'
                                    }} 
                                  />
                                </a>
                              ) : (
                                <a 
                                  href={m.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--border-color)',
                                    color: isOwn ? '#ffffff' : 'var(--text-primary)',
                                    textDecoration: 'none',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}
                                >
                                  📄 {m.fileName || 'Documento clínico'}
                                </a>
                              )}
                            </div>
                          )}
                          {m.message && <span>{m.message}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {m.message && (
                            <button
                              type="button"
                              onClick={() => speakMessage(m.id, m.message)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: speakingMessageId === m.id ? 'var(--primary)' : 'var(--text-muted)',
                                padding: '2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.8,
                                transition: 'opacity 0.2s'
                              }}
                              title={speakingMessageId === m.id ? "Parar leitura por voz" : "Ouvir mensagem (Acessibilidade)"}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                            >
                              {speakingMessageId === m.id ? '⏹️' : '🔊'}
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar Form */}
              <form onSubmit={handleSendMessage} style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    id="chat-file-input" 
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept="image/*,application/pdf"
                  />
                  <label 
                    htmlFor="chat-file-input" 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: attachedFile ? 'var(--primary-glow)' : 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      color: attachedFile ? 'var(--primary)' : 'var(--text-secondary)',
                      transition: 'all 0.2s ease'
                    }}
                    title="Anexar foto ou PDF"
                  >
                    <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                  </label>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <input 
                    type="text" 
                    value={newMessageText}
                    onChange={e => setNewMessageText(e.target.value)}
                    placeholder={attachedFile ? `Arquivo selecionado: ${attachedFile.name}` : "Digite uma mensagem..."}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: '30px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  {attachedFile && (
                    <button 
                      type="button" 
                      onClick={() => { setAttachedFile(null); setAttachedFileType(null); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--danger)',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>

                <button 
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <svg style={{ width: '16px', height: '16px', transform: 'rotate(45deg)', marginLeft: '-2px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Z" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px auto', display: 'block', opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-3.658A9.224 9.224 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              Selecione um contato para conversar.
            </div>
          )}
        </div>
      )}

      {/* 2. Sidebar Contacts panel (Right on Desktop) */}
      {(!isMobile || mobileView === 'contacts') && (
        <div className="telemedicine-sidebar" style={{
          width: isMobile ? '100%' : '300px',
          borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0,
          height: '100%'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)' }}>
              💬 Telemedicina & Chat
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {currentUser.role === 'doctor' ? 'Selecione um paciente' : 'Converse com seus clínicos'}
            </p>
          </div>

          {/* Search bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar contatos..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>





          <div className="contacts-list" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
            {filteredContacts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                Nenhum contato encontrado.
              </div>
            ) : (
              filteredContacts.map(c => {
                const active = selectedContact && selectedContact.id === c.id;
                const contactInitials = c.name ? c.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0,2).toUpperCase() : '?';
                
                const isOnline = (() => {
                  if (!c.lastSeenAt) return false;
                  try {
                    const lastSeen = new Date(c.lastSeenAt).getTime();
                    const now = new Date().getTime();
                    // Consider online if active in the last 35 seconds
                    return (now - lastSeen) < 35000;
                  } catch (e) {
                    return false;
                  }
                })();

                return (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      setSelectedContact(c);
                      if (isMobile) {
                        setMobileView('chat');
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 20px',
                      cursor: 'pointer',
                      backgroundColor: active ? 'var(--primary-glow)' : 'transparent',
                      borderLeft: active ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                    className="contact-item"
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : contactInitials}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: '700', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.name}
                          <span 
                            style={{ 
                              display: 'inline-block', 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              backgroundColor: isOnline ? '#10b981' : '#94a3b8',
                              boxShadow: isOnline ? '0 0 8px #10b981' : 'none',
                              flexShrink: 0
                            }} 
                            title={isOnline ? "Online" : "Offline"}
                          />
                        </p>
                        <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.role === 'doctor' || c.crm ? (c.specialty || 'Clínico iRec') : 'Paciente'}
                        </p>
                      </div>

                      {/* Unread message badge */}
                      {unreadCounts[c.id] > 0 && (
                        <div style={{
                          backgroundColor: 'var(--danger)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          minWidth: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {unreadCounts[c.id]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. Ringing Overlay (Outgoing call) */}
      {callState === 'outgoing' && activeCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'var(--font-primary)'
        }}>
          <div className="pulsing-call-avatar" style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            fontWeight: 'bold',
            marginBottom: '40px'
          }}>
            {initials}
            <div className="pulse-ring-effect" />
          </div>

          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
            Chamando {selectedContact ? selectedContact.name : 'Clínico'}
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>
            Aguardando atendimento...
          </p>

          <button 
            onClick={endCall}
            style={{
              marginTop: '50px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50px',
              padding: '12px 36px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(239,68,68,0.4)'
            }}
          >
            Cancelar
          </button>

          <style>{`
            .pulse-ring-effect {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              border: 2px solid var(--primary);
              animation: ripple 2s infinite ease-out;
            }
            @keyframes ripple {
              0% { transform: scale(1); opacity: 0.8; }
              100% { transform: scale(1.8); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* 4. Ringing Overlay (Incoming call) */}
      {callState === 'incoming' && activeCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'var(--font-primary)'
        }}>
          <div className="pulsing-call-avatar" style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            fontWeight: 'bold',
            marginBottom: '40px'
          }}>
            📞
            <div className="pulse-ring-effect-green" />
          </div>

          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
            Teleconsulta Clínico iRec
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>
            Chamada de vídeo recebida
          </p>

          <div style={{ display: 'flex', gap: '20px', marginTop: '50px' }}>
            <button 
              onClick={rejectCall}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50px',
                padding: '12px 30px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(239,68,68,0.3)'
              }}
            >
              Recusar
            </button>
            <button 
              onClick={() => setShowConsentModal(true)}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50px',
                padding: '12px 30px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(16,185,129,0.3)'
              }}
            >
              Atender
            </button>
          </div>

          <style>{`
            .pulse-ring-effect-green {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              border: 2px solid #10b981;
              animation: ripple 2s infinite ease-out;
            }
          `}</style>
        </div>
      )}

      {/* 5. Active Call Screen Area */}
      {callState === 'active' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#090d16',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)'
        }}>
          {/* Header toolbar */}
          <div style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            borderBottom: '1px solid #1e293b',
            color: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'blink 1.5s infinite' }} />
              <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px' }}>TELECONSULTA AO VIVO</span>
            </div>
            
            <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Duração:</span>
              <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{formatTimer(callDuration)}</strong>
            </div>
          </div>

          {/* Video grid panels */}
          <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              flex: 1,
              position: 'relative',
              backgroundColor: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {hideVideo ? (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  Vídeo pausado pelo usuário
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {remoteStream ? (
                    <video 
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      zIndex: 1
                    }}>
                      <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '2px solid rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                        margin: '0 auto 16px auto'
                      }}>
                        {initials}
                      </div>
                      <p style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '15px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        Conexão Remota Segura com {selectedContact ? selectedContact.name : 'Clínico'}
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                        Aguardando transmissão de vídeo...
                      </p>
                    </div>
                  )}
                  
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, rgba(9,13,22,0.9) 80%)',
                    zIndex: remoteStream ? 1 : 0,
                    pointerEvents: 'none'
                  }} />
                </div>
              )}

              {/* Local Webcam Pip */}
              <div style={{
                position: 'absolute',
                bottom: '24px',
                right: '24px',
                width: '160px',
                height: '120px',
                borderRadius: '12px',
                backgroundColor: '#1e293b',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: '2px solid #334155',
                zIndex: 10
              }}>
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '8px',
                  fontSize: '9px',
                  color: '#ffffff',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '600'
                }}>
                  Você (Local)
                </span>
              </div>

              {/* Floating Express Chat Window */}
              {showExpressChat && (
                <div style={{
                  position: 'absolute',
                  bottom: '24px',
                  left: '24px',
                  width: isMobile ? 'calc(100% - 48px)' : '340px',
                  height: isMobile ? '300px' : '400px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 20,
                  overflow: 'hidden'
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>
                      💬 Chat Expresso
                    </span>
                    <button 
                      onClick={() => setShowExpressChat(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      &times;
                    </button>
                  </div>

                  {/* Messages Area */}
                  <div style={{
                    flex: 1,
                    padding: '14px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {messages.length === 0 ? (
                      <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '0 20px' }}>
                        Nenhuma mensagem ainda. Envie uma mensagem abaixo.
                      </div>
                    ) : (
                      messages.map(m => {
                        const isOwn = m.senderId === currentUser.id;
                        return (
                          <div 
                            key={m.id}
                            style={{
                              alignSelf: isOwn ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isOwn ? 'flex-end' : 'flex-start',
                              gap: '2px'
                            }}
                          >
                            <div style={{
                              padding: '8px 12px',
                              borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              backgroundColor: isOwn ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                              color: '#ffffff',
                              fontSize: '12px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              wordBreak: 'break-word'
                            }}>
                              {m.fileUrl && (
                                <div style={{ marginBottom: m.message ? '6px' : 0 }}>
                                  {m.fileType === 'photo' ? (
                                    <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                                      <img 
                                        src={m.fileUrl} 
                                        alt="Imagem" 
                                        style={{
                                          maxWidth: '100%',
                                          maxHeight: '120px',
                                          borderRadius: '6px',
                                          display: 'block'
                                        }} 
                                      />
                                    </a>
                                  ) : (
                                    <a 
                                      href={m.fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 10px',
                                        borderRadius: '4px',
                                        backgroundColor: 'rgba(255,255,255,0.15)',
                                        color: '#ffffff',
                                        textDecoration: 'none',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      📄 {m.fileName || 'Doc'}
                                    </a>
                                  )}
                                </div>
                              )}
                              {m.message && <span>{m.message}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                                {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {m.message && (
                                <button
                                  type="button"
                                  onClick={() => speakMessage(m.id, m.message)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    color: speakingMessageId === m.id ? 'var(--primary)' : '#94a3b8',
                                    padding: '2px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0.8
                                  }}
                                  title={speakingMessageId === m.id ? "Parar leitura por voz" : "Ouvir mensagem (Acessibilidade)"}
                                >
                                  {speakingMessageId === m.id ? '⏹️' : '🔊'}
                                </button>
                              )}
                            </div>

                          </div>
                        );
                      })
                    )}
                    <div ref={expressMessagesEndRef} />
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendExpressMessage} style={{
                    padding: '10px 14px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        id="express-chat-file" 
                        onChange={handleExpressFileChange}
                        style={{ display: 'none' }}
                        accept="image/*,application/pdf"
                      />
                      <label 
                        htmlFor="express-chat-file" 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: expressAttachedFile ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                          color: '#ffffff',
                          transition: 'all 0.2s ease'
                        }}
                        title="Anexar foto ou PDF"
                      >
                        <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                        </svg>
                      </label>
                    </div>

                    <div style={{ flex: 1, position: 'relative' }}>
                      <input 
                        type="text" 
                        value={expressMessageText}
                        onChange={e => setExpressMessageText(e.target.value)}
                        placeholder={expressAttachedFile ? `Anexado: ${expressAttachedFile.name.substring(0, 12)}...` : "Mensagem..."}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '20px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: '#ffffff',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                      {expressAttachedFile && (
                        <button 
                          type="button" 
                          onClick={() => { setExpressAttachedFile(null); setExpressAttachedFileType(null); }}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    <button 
                      type="submit"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <svg style={{ width: '14px', height: '14px', transform: 'rotate(45deg)', marginLeft: '-1px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Z" />
                      </svg>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Doctor's Transcription & Alerts Side Panel */}
            {currentUser.role === 'doctor' && (
              <div style={{
                width: isMobile ? '100%' : '320px',
                height: isMobile ? '30%' : '100%',
                borderLeft: isMobile ? 'none' : '1px solid #1e293b',
                borderTop: isMobile ? '1px solid #1e293b' : 'none',
                backgroundColor: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                color: '#ffffff',
                zIndex: 15
              }}>
                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📝</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Copiloto IA & Transcrição</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                    Ativo
                  </span>
                </div>

                {/* Discrete Safety Alerts */}
                {safetyAlerts.length > 0 && (
                  <div style={{ padding: '12px', borderBottom: '1px solid #1e293b', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#f59e0b', fontSize: '11px', fontWeight: '700' }}>
                      <span>⚠️</span>
                      <span>ALERTAS CLÍNICOS DISCRETOS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {safetyAlerts.map(alert => (
                        <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 8px', backgroundColor: '#1e293b', borderLeft: '3px solid #f59e0b', borderRadius: '4px' }}>
                          <span style={{ fontSize: '10px', lineHeight: '1.4', color: '#e2e8f0' }}>{alert.text}</span>
                          <button 
                            onClick={() => setSafetyAlerts(prev => prev.filter(a => a.id !== alert.id))}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '10px', cursor: 'pointer', padding: '0 0 0 6px', fontWeight: 'bold' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcripts scroll container */}
                <div style={{ flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {transcripts.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b', fontSize: '11px', padding: '20px' }}>
                      Reconhecimento de fala iniciado. Transcrevendo diálogo em tempo real...
                    </div>
                  ) : (
                    transcripts.map((t, idx) => {
                      const isDoctor = t.role === 'doctor';
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignSelf: isDoctor ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: isDoctor ? 'var(--primary)' : '#10b981', marginBottom: '2px', textAlign: isDoctor ? 'right' : 'left' }}>
                            {isDoctor ? 'Médico (Você)' : 'Paciente'}
                          </span>
                          <div style={{ 
                            padding: '8px 12px', 
                            borderRadius: isDoctor ? '12px 12px 2px 12px' : '12px 12px 12px 2px', 
                            backgroundColor: isDoctor ? 'rgba(14, 165, 233, 0.12)' : 'rgba(16, 185, 129, 0.1)', 
                            border: isDoctor ? '1px solid rgba(14, 165, 233, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)', 
                            color: '#f8fafc', 
                            fontSize: '11px', 
                            lineHeight: '1.4',
                            wordBreak: 'break-word'
                          }}>
                            {t.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* No clinical monitor - keeping only secure video stream */}
          </div>


          {/* Bottom control toolbar */}
          <div style={{
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #1e293b'
          }}>
            <button 
              onClick={() => setMuteAudio(prev => !prev)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: muteAudio ? '#ef4444' : '#1e293b',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={muteAudio ? "Desmutar Áudio" : "Mutar Áudio"}
            >
              {muteAudio ? (
                <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              ) : (
                <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              )}
            </button>

            <button 
              onClick={() => setHideVideo(prev => !prev)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: hideVideo ? '#ef4444' : '#1e293b',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={hideVideo ? "Ligar Câmera" : "Desligar Câmera"}
            >
              {hideVideo ? (
                <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841-4.833L11.33 7.88M9.75 21.25H4.5a2.25 2.25 0 0 1-2.25-2.25V15m17.43-11.43 1.42 1.42M3 3l18 18" />
                </svg>
              ) : (
                <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              )}
            </button>

            <button 
              onClick={() => setShowExpressChat(prev => !prev)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: showExpressChat ? 'var(--primary)' : '#1e293b',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease'
              }}
              title={showExpressChat ? "Fechar Chat Expresso" : "Abrir Chat Expresso"}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028z" />
              </svg>
            </button>

            <button 
              onClick={() => setAppActiveTab(currentUser.role === 'doctor' ? 'doctor-dashboard' : 'dashboard')}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s ease'
              }}
              title="Minimizar Chamada (PiP)"
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 6v9a2.25 2.25 0 0 0 2.25 2.25h1.5m10.5-9.75h6A2.25 2.25 0 0 1 24 12v9a2.25 2.25 0 0 1-2.25 2.25h-6A2.25 2.25 0 0 1 13.5 21v-9a2.25 2.25 0 0 1 2.25-2.25Z" />
              </svg>
            </button>


            <button 
              onClick={endCall}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(239,68,68,0.4)'
              }}
              title="Encerrar Consulta"
            >
              <svg style={{ width: '20px', height: '20px', transform: 'rotate(135deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12m0 0 2.25 2.25M16.5 12l2.25-2.25M16.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            </button>
          </div>

          <style>{`
            @keyframes blink {
              0% { opacity: 0.2; }
              50% { opacity: 1; }
              100% { opacity: 0.2; }
            }
          `}</style>
        </div>
      )}

      {/* Post-Call AI Summary & Triage Modal for Doctors */}
      {showSummaryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(9, 13, 22, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'var(--font-primary)'
        }}>
          <div style={{
            maxWidth: '620px',
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            {isGeneratingSummary ? (
              <div style={{ padding: '50px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  border: '3px solid rgba(14, 165, 233, 0.1)',
                  borderTopColor: 'var(--primary)',
                  animation: 'spin 1s linear infinite'
                }} />
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                    Processando Áudio da Consulta
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', maxWidth: '400px' }}>
                    A Inteligência Artificial do iRec está analisando a transcrição estruturada para triar sintomas e elaborar sugestões clínicas...
                  </p>
                </div>
              </div>
            ) : aiReport ? (
              <>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Co-piloto Clínico iRec
                    </span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '800', 
                      padding: '3px 8px', 
                      borderRadius: '50px', 
                      backgroundColor: aiReport.riskLevel === 'Leve' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: aiReport.riskLevel === 'Leve' ? '#10b981' : '#f59e0b',
                      border: aiReport.riskLevel === 'Leve' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      {aiReport.riskLevel}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                    Evolução Clínica & Triagem: {selectedContact ? selectedContact.name : 'Paciente'}
                  </h3>
                </div>

                {/* Navigation Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', padding: '0 16px' }}>
                  <button 
                    onClick={() => setActiveTabReports('summary')}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTabReports === 'summary' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                      color: activeTabReports === 'summary' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Resumo e Evolução
                  </button>
                  <button 
                    onClick={() => setActiveTabReports('symptoms')}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTabReports === 'symptoms' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                      color: activeTabReports === 'symptoms' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Sintomas ({aiReport.symptoms?.length || 0})
                  </button>
                  <button 
                    onClick={() => setActiveTabReports('prescription')}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTabReports === 'prescription' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                      color: activeTabReports === 'prescription' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Prescrição ({aiReport.suggestedPrescriptions?.length || 0})
                  </button>
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeTabReports === 'summary' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Resumo Sintético da Consulta
                        </span>
                        <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
                          {aiReport.executiveSummary}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Evolução Médica Formal (SOAP / Editável)
                        </span>
                        <textarea 
                          id="ai-evolution-text"
                          defaultValue={aiReport.clinicalEvolution}
                          style={{
                            width: '100%',
                            height: '140px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            color: '#ffffff',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            resize: 'none',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </>
                  )}

                  {activeTabReports === 'symptoms' && (
                    <>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '-8px' }}>
                        Selecione os sintomas para adicionar à ficha do paciente:
                      </span>
                      {(!aiReport.symptoms || aiReport.symptoms.length === 0) ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          Nenhum sintoma específico detectado na consulta.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {aiReport.symptoms.map((symp, idx) => (
                            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                              <input 
                                type="checkbox" 
                                id={`symp-${idx}`} 
                                defaultChecked={true} 
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} 
                              />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff' }}>{symp.name}</span>
                                <span style={{ fontSize: '10px', color: symp.isWorsening ? '#ef4444' : 'var(--text-muted)', marginTop: '2px' }}>
                                  Gravidade: {symp.intensity} {symp.isWorsening && '• (Relato de Piora)'}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {activeTabReports === 'prescription' && (
                    <>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '-8px' }}>
                        Selecione os insumos e condutas para sugerir ao paciente:
                      </span>
                      {(!aiReport.suggestedPrescriptions || aiReport.suggestedPrescriptions.length === 0) ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          Nenhuma indicação de insumo ou medicamento detectada.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {aiReport.suggestedPrescriptions.map((presc, idx) => (
                            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                id={`presc-${idx}`} 
                                defaultChecked={true} 
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} 
                              />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff' }}>{presc.name}</span>
                                  <span style={{ fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: presc.category === 'Medicamento' ? 'rgba(147,51,234,0.15)' : 'rgba(14,165,233,0.15)', color: presc.category === 'Medicamento' ? '#c084fc' : '#38bdf8' }}>
                                    {presc.category}
                                  </span>
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                  Instruções: {presc.dosage}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'var(--bg-primary)' }}>
                  <button 
                    onClick={discardClinicalSummary}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '50px',
                      backgroundColor: 'transparent',
                      border: '1.5px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Descartar Resumo
                  </button>
                  <button 
                    onClick={saveClinicalSummary}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '50px',
                      backgroundColor: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Confirmar e Gravar Prontuário
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
                Erro de processamento da IA. A gravação do diálogo está indisponível.
                <div style={{ marginTop: '20px' }}>
                  <button onClick={discardClinicalSummary} style={{ padding: '8px 16px', borderRadius: '50px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', cursor: 'pointer' }}>
                    Voltar ao Início
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teleconsultation Legal Consent Modal */}
      {showConsentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-primary)',
          color: '#ffffff',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--box-shadow-premium)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--primary)' }}>
              Termo de Consentimento de Teleconsulta
            </h3>
            
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              fontSize: '11px', 
              lineHeight: '1.5', 
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-primary)',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              textAlign: 'left'
            }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>1. Natureza do Atendimento:</strong> A teleconsulta é uma modalidade de atendimento a distância realizada por meio de tecnologias seguras de áudio e vídeo, adequada para triagem, acompanhamento e orientação clínica.</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>2. Privacidade e LGPD:</strong> Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), suas informações clínicas, imagens de sintomas e transcrições geradas são confidenciais e armazenadas com segurança no prontuário do iRec.</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>3. Gravação e Transcrição:</strong> A consulta de vídeo/áudio pode gerar uma transcrição textual em tempo real via IA para o preenchimento automático do histórico e suporte de decisão diagnóstica do clínico. Esses registros farão parte do seu prontuário clínico.</p>
              <p style={{ margin: '0 0 0 0' }}><strong>4. Autonomia do Paciente:</strong> Você tem o direito de negar ou retirar o consentimento a qualquer momento, interrompendo a transmissão, sem prejuízo ao seu direito de atendimento presencial.</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '11.5px', cursor: 'pointer', marginBottom: '20px', textAlign: 'left', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={consentGiven} 
                onChange={(e) => setConsentGiven(e.target.checked)} 
                style={{ marginTop: '2px', cursor: 'pointer' }}
              />
              <span>Declaro que li, compreendi e concordo com os termos de privacidade, consentimento clínico e processamento de dados do iRec.</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => {
                  setShowConsentModal(false);
                  setConsentGiven(false);
                  rejectCall();
                }}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}
              >
                Recusar
              </button>
              <button 
                onClick={() => {
                  setShowConsentModal(false);
                  acceptCall();
                }}
                disabled={!consentGiven}
                className="btn btn-primary"
                style={{ 
                  fontSize: '12px', 
                  padding: '8px 16px', 
                  borderRadius: '8px',
                  backgroundColor: consentGiven ? 'var(--primary)' : 'var(--border-color)',
                  color: '#ffffff',
                  cursor: consentGiven ? 'pointer' : 'not-allowed',
                  border: 'none'
                }}
              >
                Concordar e Atender
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
