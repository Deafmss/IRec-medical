import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import ClinicalTriage from './components/ClinicalTriage';
import ClinicalHistory from './components/ClinicalHistory';
import NursesNetwork from './components/NursesNetwork';
import ProtocolGuide from './components/ProtocolGuide';
import AIChatAssistant from './components/AIChatAssistant';
import Login from './components/Login';
import DoctorDashboard from './components/DoctorDashboard';
import PatientDocuments from './components/PatientDocuments';
import UserProfileModal from './components/UserProfileModal';
import Telemedicine from './components/Telemedicine';
import SpecialistDirectory from './components/SpecialistDirectory';
import AdminPartners from './components/AdminPartners';
import DoctorPartners from './components/DoctorPartners';
import AdminDashboard from './components/AdminDashboard';
import DoctorDashboardAnalytics from './components/DoctorDashboardAnalytics';
import MyNetworkPortal from './components/MyNetworkPortal';
import AccessibleDashboard from './components/AccessibleDashboard';
import { AccessibleTelemedicineView, AccessibleUploadView } from './components/AccessibleSubViews';
import SOSEmergencyModal from './components/SOSEmergencyModal';
import PermissionsGuideModal from './components/PermissionsGuideModal';
import { getClinicalProfile, getWoundEntries, signOutUser, getCurrentUser, checkIncomingCalls, checkCallStatus, updateCallStatus, updateLastSeen } from './services/supabaseService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showPermissionsGuideModal, setShowPermissionsGuideModal] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [telemedicineContactId, setTelemedicineContactId] = useState(null);
  const [unreadChatMessagesCount, setUnreadChatMessagesCount] = useState(0);
  const [selectedPatientForDoctor, setSelectedPatientForDoctor] = useState(null);
  const [selectedPatientEntriesForDoctor, setSelectedPatientEntriesForDoctor] = useState([]);
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState(0);
  const [showSOSModal, setShowSOSModal] = useState(false);

  // Persistent UI Mode ('standard' or 'accessible')
  const [uiMode, setUiMode] = useState(() => localStorage.getItem('irec_ui_mode') || 'standard');

  const toggleUiMode = () => {
    const nextMode = uiMode === 'standard' ? 'accessible' : 'standard';
    setUiMode(nextMode);
    localStorage.setItem('irec_ui_mode', nextMode);
  };

  // Check URL query params for SOS shortcut trigger
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sos') === 'true') {
        setShowSOSModal(true);
      }
    }
  }, []);

  const isAdmin = currentUser && currentUser.email === 'admin@irec.com';

  const fetchPendingCount = async () => {
    if (currentUser && currentUser.email === 'admin@irec.com') {
      try {
        const { getAllProfiles } = await import('./services/supabaseService');
        const profiles = await getAllProfiles();
        const pending = profiles.filter(p => p.role === 'doctor' && p.verificationStatus === 'pending');
        setPendingVerificationsCount(pending.length);
      } catch (e) {
        console.error("Erro ao carregar contagem de homologações:", e);
      }
    }
  };

  useEffect(() => {
    fetchPendingCount();
  }, [currentUser, activeTab]);

  // Create a ref to store activeCallSession to prevent recreating the BroadcastChannel and interval on every session change
  const activeCallSessionRef = useRef(activeCallSession);
  useEffect(() => {
    activeCallSessionRef.current = activeCallSession;
  }, [activeCallSession]);

  const [showNotificationPromptModal, setShowNotificationPromptModal] = useState(false);
  const [showIOSInstallBanner, setShowIOSInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Capture Android PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallAppClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[iRec PWA] Usuário aceitou a instalação do aplicativo.');
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowPermissionsGuideModal(true);
    }
  };

  // Auto detect iPhone / iPad in Safari browser (not installed as standalone)
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && !isStandalone) {
        setShowIOSInstallBanner(true);
      }
    }
  }, []);

  // Persistent SOS Notification Sync on Mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return;

    // Check if user is on a mobile smartphone device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth <= 768);

    // Auto prompt modal for patients ONLY on mobile devices if notification permission is default
    if (isMobile && currentUser?.role === 'patient' && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        setShowNotificationPromptModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    const syncSOSNotification = async () => {
      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('🚨 SOS iRec - Atendimento & Emergência', {
            body: 'Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima.',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: 'irec-sos-persistent-fixed',
            renotify: true,
            requireInteraction: true,
            priority: 'max',
            urgency: 'high',
            actions: [
              { action: 'call_samu', title: '📞 Ligar 192 (SAMU)' },
              { action: 'open_upa', title: '🏥 Rota UPA (Mapa)' }
            ]
          });
        } catch (e) {
          console.warn("[iRec PWA] Erro ao sincronizar notificação SOS:", e);
        }
      }
    };

    syncSOSNotification();
  }, [currentUser]);

  const handleGrantNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setShowNotificationPromptModal(false);
      if (perm === 'granted' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('🚨 SOS iRec - Atendimento & Emergência', {
          body: 'Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima.',
          icon: '/favicon.png',
          badge: '/favicon.png',
          tag: 'irec-sos-persistent-fixed',
          renotify: true,
          requireInteraction: true,
          priority: 'max',
          urgency: 'high',
          actions: [
            { action: 'call_samu', title: '📞 Ligar 192 (SAMU)' },
            { action: 'open_upa', title: '🏥 Rota UPA (Mapa)' }
          ]
        });
        alert("Notificação fixa de emergência ativada na barra do celular com sucesso!");
      }
    } catch (err) {
      console.error(err);
      setShowNotificationPromptModal(false);
    }
  };

  // Global incoming call listener (polling + BroadcastChannel)
  useEffect(() => {
    if (!currentUser) return;

    const chatChannel = typeof window !== 'undefined' ? new BroadcastChannel('irec_telemedicine_signaling') : null;

    const handleIncomingCall = (call) => {
      if (call.receiverId === currentUser.id) {
        setActiveCallSession(call);
      }
    };

    const handleCallStatusUpdate = (callId, status) => {
      const activeSess = activeCallSessionRef.current;
      if (activeSess && activeSess.id.toString() === callId.toString()) {
        if (status === 'ended' || status === 'rejected') {
          setActiveCallSession(null);
        } else if (status === 'accepted') {
          setActiveCallSession(prev => prev ? { ...prev, status: 'accepted' } : null);
        }
      }
    };

    if (chatChannel) {
      chatChannel.addEventListener('message', (event) => {
        const data = event.data;
        if (data.type === 'INCOMING_CALL') {
          handleIncomingCall(data.call);
        } else if (data.type === 'CALL_STATUS_UPDATE') {
          handleCallStatusUpdate(data.callId, data.status);
        }
      });
    }

    let realtimeChannel = null;

    if (isSupabaseConfigured && supabase) {
      console.log("Inicializando inscricoes em tempo real para telemedicina...");
      realtimeChannel = supabase
        .channel(`incoming-calls-${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'telemedicine_calls'
          },
          (payload) => {
            if (payload.new && payload.new.receiver_id === currentUser.id && payload.new.status === 'ringing') {
              console.log('Nova chamada em tempo real recebida:', payload.new);
              setActiveCallSession({
                id: payload.new.id,
                callerId: payload.new.caller_id,
                receiverId: payload.new.receiver_id,
                status: payload.new.status,
                createdAt: payload.new.created_at
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'telemedicine_calls'
          },
          (payload) => {
            const activeSess = activeCallSessionRef.current;
            if (activeSess && payload.new && payload.new.id === activeSess.id) {
              console.log('Status da chamada atualizado em tempo real:', payload.new.status);
              if (payload.new.status === 'ended' || payload.new.status === 'rejected') {
                setActiveCallSession(null);
              } else {
                setActiveCallSession({
                  id: payload.new.id,
                  callerId: payload.new.caller_id,
                  receiverId: payload.new.receiver_id,
                  status: payload.new.status,
                  createdAt: payload.new.created_at
                });
              }
            }
          }
        )
        .subscribe();
    }

    // Polling for cross-device incoming calls (somente em modo offline local)
    let interval = null;
    if (!isSupabaseConfigured) {
      interval = setInterval(async () => {
        const activeSess = activeCallSessionRef.current;
        if (activeSess) {
          const statusCheck = await checkCallStatus(activeSess.id);
          if (statusCheck) {
            if (statusCheck.status === 'ended' || statusCheck.status === 'rejected') {
              setActiveCallSession(null);
            } else if (statusCheck.status !== activeSess.status) {
              setActiveCallSession(statusCheck);
            }
          }
        } else {
          const incoming = await checkIncomingCalls(currentUser.id);
          if (incoming) {
            setActiveCallSession(incoming);
          }
        }
      }, 2500);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (realtimeChannel) realtimeChannel.unsubscribe();
      if (chatChannel) chatChannel.close();
    };
  }, [currentUser]);
  
  // Theme state: defaults to light theme (initialized lazily from local cache)
  const [theme, setTheme] = useState(() => {
    const cached = localStorage.getItem('irec_active_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) {
          return localStorage.getItem(`irec-theme-${parsed.id}`) || 'light';
        }
      } catch (e) {}
    }
    return localStorage.getItem('irec-theme-guest') || 'light';
  });

  // Load user-specific theme when currentUser changes asynchronously
  useEffect(() => {
    const themeKey = currentUser ? `irec-theme-${currentUser.id}` : 'irec-theme-guest';
    const savedTheme = localStorage.getItem(themeKey) || 'light';
    const t = setTimeout(() => {
      setTheme(prev => prev !== savedTheme ? savedTheme : prev);
    }, 0);
    return () => clearTimeout(t);
  }, [currentUser]);

  // Update browser document title with unread count
  useEffect(() => {
    if (unreadChatMessagesCount > 0) {
      document.title = `(${unreadChatMessagesCount}) iRec - Telemedicina & Chat`;
    } else {
      document.title = 'iRec - Prevenção de Feridas & Telemedicina';
    }
  }, [unreadChatMessagesCount]);

  // Apply theme class and save to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const themeKey = currentUser ? `irec-theme-${currentUser.id}` : 'irec-theme-guest';
    localStorage.setItem(themeKey, theme);
  }, [theme, currentUser]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Sidebar state: collapsed or expanded (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('irec-sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('irec-sidebar-collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Shared patient clinical profile (loaded from Supabase/Local)
  const [clinicalProfile, setClinicalProfile] = useState({
    name: 'Paciente',
    age: '',
    hasDiabetes: false,
    hasHypertension: false,
    isSmoker: false,
    hasPreviousUlcers: false,
    previousUlcersHealingTime: '',
    previousUlcersTreatments: '',
    previousUlcersLocation: 'casa',
    medications: '',
    allergies: '',
    attachedExams: [],
    triageAlerts: []
  });

  // Shared state for wound entries
  const [entries, setEntries] = useState([]);

  // Check auth session on component mount with 1.5s timeout guarantee and local cache restoration
  useEffect(() => {
    let resolved = false;

    // Timeout safety fallback: Force disable loading after 1.8 seconds maximum
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn("⚠️ [iRec] Timeout de inicialização do Supabase atingido. Entrando em modo offline...");
        setLoadingAuth(false);
        resolved = true;
      }
    }, 1800);

    const resolveAuth = (userProfile) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      
      if (userProfile) {
        setCurrentUser(userProfile);
        
        // Restore activeTab from localStorage if it exists
        const savedTab = localStorage.getItem('irec_active_tab');
        if (savedTab) {
          setActiveTab(savedTab);
        } else {
          if (userProfile.email === 'admin@irec.com') {
            setActiveTab('admin-metrics');
          } else if (userProfile.role === 'doctor') {
            setActiveTab('doctor-dashboard');
          } else {
            setActiveTab('dashboard');
          }
        }

        // Restore selected patient if clinician
        if (userProfile.role === 'doctor' || userProfile.role === 'nurse') {
          const savedPatient = localStorage.getItem('irec_selected_patient');
          if (savedPatient) {
            try {
              const parsedPatient = JSON.parse(savedPatient);
              setSelectedPatientForDoctor(parsedPatient);
            } catch (e) {
              console.error("Erro ao restaurar paciente selecionado:", e);
            }
          }
        }
      }
      setLoadingAuth(false);
    };

    async function checkSession() {
      try {
        // 1. Try reading the last active user session from memory (0ms instant load!)
        const cached = localStorage.getItem('irec_active_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id) {
              console.log("Restauração rápida da sessão via cache local...");
              resolveAuth(parsed);
            }
          } catch (e) {
            console.error("Erro ao ler cache de sessão:", e);
          }
        }

        // 2. Fetch fresh session from Supabase
        const user = await getCurrentUser();
        if (user) {
          localStorage.setItem('irec_active_user', JSON.stringify(user));
          resolveAuth(user);
        } else {
          resolveAuth(null);
        }
      } catch (e) {
        console.warn('Erro ao restaurar sessão:', e);
        resolveAuth(null);
      }
    }
    
    checkSession();

    // Supabase Auth listener
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session && session.user) {
          const profile = await getClinicalProfile(session.user.id);
          if (profile) {
            localStorage.setItem('irec_active_user', JSON.stringify(profile));
            resolveAuth(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('irec_active_user');
          resolveAuth(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Fetch patient profile and entries when currentUser changes
  useEffect(() => {
    async function loadPatientData() {
      if (currentUser && currentUser.role === 'patient') {
        const profile = await getClinicalProfile(currentUser.id);
        if (profile) {
          setClinicalProfile(profile);
        }
        const history = await getWoundEntries(currentUser.id);
        setEntries(history);
      }
    }
    loadPatientData();
  }, [currentUser]);

  // Pre-fetch personalized care guide in the background (warm cache)
  useEffect(() => {
    async function prefetchCareGuide() {
      if (!clinicalProfile || !clinicalProfile.id || currentUser?.role !== 'patient') return;
      
      const profileId = clinicalProfile.id;
      const latestWoundEntry = entries && entries.length > 0 ? entries[entries.length - 1] : null;
      const entryId = latestWoundEntry ? (latestWoundEntry.id || latestWoundEntry.createdAt) : 'no-entry';
      const cacheKey = `irec_cached_protocol_${profileId}_${entryId}`;
      
      // Check if already cached and profile characteristics match
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const profileKeys = ['name', 'hasDiabetes', 'hasHypertension', 'hasVenousInsufficiency', 'hasPeripheralArterialDisease', 'isSmoker', 'isObese', 'medications', 'allergies', 'otherConditions'];
          const profileMatch = profileKeys.every(k => parsed.profile?.[k] === clinicalProfile[k]);
          const modeMatch = parsed.isClinician === false;
          if (profileMatch && modeMatch && parsed.protocol) {
            // Already cached and matching, skip background fetch
            return;
          }
        } catch (e) {
          // ignore parsing error and proceed to fetch
        }
      }
      
      try {
        console.log("Pre-fetching personalized care guide in the background...");
        const { generatePersonalizedProtocol } = await import('./services/geminiService');
        const result = await generatePersonalizedProtocol(clinicalProfile, latestWoundEntry);
        
        if (result) {
          const cacheData = {
            protocol: result,
            isClinician: false,
            profile: {
              name: clinicalProfile.name,
              hasDiabetes: clinicalProfile.hasDiabetes,
              hasHypertension: clinicalProfile.hasHypertension,
              hasVenousInsufficiency: clinicalProfile.hasVenousInsufficiency,
              hasPeripheralArterialDisease: clinicalProfile.hasPeripheralArterialDisease,
              isSmoker: clinicalProfile.isSmoker,
              isObese: clinicalProfile.isObese,
              medications: clinicalProfile.medications,
              allergies: clinicalProfile.allergies,
              otherConditions: clinicalProfile.otherConditions
            }
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("Background pre-fetching completed successfully.");
        }
      } catch (err) {
        console.warn("Falha no prefetch do guia de cuidados:", err);
      }
    }
    
    // Run prefetch after 1.5 seconds to prioritize main rendering thread
    const timer = setTimeout(prefetchCareGuide, 1500);
    return () => clearTimeout(timer);
  }, [clinicalProfile, entries, currentUser]);

  // Update last seen presence status periodically
  useEffect(() => {
    if (!currentUser) return;
    
    // Update immediately on mount/login
    updateLastSeen(currentUser.id);
    
    // Polling every 15 seconds
    const interval = setInterval(() => {
      updateLastSeen(currentUser.id);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLoginSuccess = (profile) => {
    setCurrentUser(profile);
    if (profile.email === 'admin@irec.com') {
      setActiveTab('admin-metrics');
    } else if (profile.role === 'doctor') {
      setActiveTab('doctor-dashboard');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {}
    setCurrentUser(null);
    setSelectedPatientForDoctor(null);
    setSelectedPatientEntriesForDoctor([]);
    
    // Clear localStorage navigation keys
    localStorage.removeItem('irec_active_user');
    localStorage.removeItem('irec_active_tab');
    localStorage.removeItem('irec_selected_patient');
    localStorage.removeItem('irec_doctor_active_tab');
    localStorage.removeItem('irec_doctor_sub_tab');
    localStorage.removeItem('irec_doctor_doc_tab');
    localStorage.removeItem('irec_patient_sub_tab');
  };

  // Persist activeTab to localStorage
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('irec_active_tab', activeTab);
    }
  }, [activeTab]);

  // Persist selectedPatientForDoctor to localStorage
  useEffect(() => {
    if (selectedPatientForDoctor) {
      localStorage.setItem('irec_selected_patient', JSON.stringify(selectedPatientForDoctor));
    } else {
      localStorage.removeItem('irec_selected_patient');
    }
  }, [selectedPatientForDoctor]);

  // Periodically fetch clinical data to ensure real-time synchronization
  useEffect(() => {
    if (!currentUser) return;

    const refreshData = async () => {
      // 1. If currentUser is a patient, reload their profile and wound entries
      if (currentUser.role === 'patient') {
        try {
          const profile = await getClinicalProfile(currentUser.id);
          if (profile) {
            setClinicalProfile(profile);
          }
          const history = await getWoundEntries(currentUser.id);
          if (history) {
            setEntries(history);
          }
        } catch (e) {
          console.warn("[iRec] Erro ao sincronizar dados em tempo real do paciente:", e);
        }
      }
      
      // 2. If currentUser is a clinician (doctor/nurse) and has a selected patient active
      const isClinician = currentUser.role === 'doctor' || currentUser.role === 'nurse';
      if (isClinician && selectedPatientForDoctor) {
        try {
          const history = await getWoundEntries(selectedPatientForDoctor.id);
          if (history) {
            setSelectedPatientEntriesForDoctor(history);
          }
        } catch (e) {
          console.warn("[iRec] Erro ao sincronizar prontuario do paciente ativo:", e);
        }
      }
    };

    // Run every 10 seconds
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [currentUser, selectedPatientForDoctor]);

  const addClinicalEntryLocal = (newEntry) => {
    const isClinician = currentUser?.role === 'doctor' || currentUser?.role === 'nurse';
    if (isClinician) {
      setSelectedPatientEntriesForDoctor((prev) => [...prev, newEntry]);
    } else {
      setEntries((prev) => [...prev, newEntry]);
    }
  };

  // Render active screen
  const renderContent = () => {
    const isClinician = currentUser?.role === 'doctor' || currentUser?.role === 'nurse';
    const targetProfile = isClinician ? selectedPatientForDoctor : clinicalProfile;
    const targetEntries = isClinician ? selectedPatientEntriesForDoctor : entries;

    switch (activeTab) {
      case 'doctor-dashboard':
        return (
          <DoctorDashboard 
            doctorProfile={currentUser} 
            setActiveTab={setActiveTab} 
            onProfileUpdate={setCurrentUser} 
            onEditProfile={() => setShowProfileModal(true)} 
            onOpenChat={(patientId) => { setTelemedicineContactId(patientId); setActiveTab('telemedicine'); }}
            selectedPatient={selectedPatientForDoctor}
            setSelectedPatient={setSelectedPatientForDoctor}
            selectedPatientEntries={selectedPatientEntriesForDoctor}
            setSelectedPatientEntries={setSelectedPatientEntriesForDoctor}
          />
        );
      case 'dashboard':
        if (uiMode === 'accessible' && currentUser?.role === 'patient') {
          return (
            <AccessibleDashboard 
              clinicalProfile={clinicalProfile} 
              setActiveTab={setActiveTab} 
              onOpenSOS={() => setShowSOSModal(true)} 
            />
          );
        }
        return (
          <Dashboard 
            setActiveTab={setActiveTab} 
            clinicalProfile={clinicalProfile} 
            setClinicalProfile={setClinicalProfile} 
            entries={entries}
          />
        );
      case 'upload':
        if (uiMode === 'accessible' && currentUser?.role === 'patient') {
          return <AccessibleUploadView setActiveTab={setActiveTab} />;
        }
        return (
          <ClinicalTriage 
            setActiveTab={setActiveTab} 
            addClinicalEntry={addClinicalEntryLocal} 
            clinicalProfile={targetProfile} 
          />
        );
      case 'telemedicine':
        if (uiMode === 'accessible' && currentUser?.role === 'patient') {
          return (
            <AccessibleTelemedicineView 
              currentUser={currentUser} 
              setActiveTab={setActiveTab} 
              onStartVideoCall={() => {
                const targetId = telemedicineContactId || 'doc_assigned';
                if (typeof window !== 'undefined' && window.initiateTelemedicineCall) {
                  window.initiateTelemedicineCall(targetId);
                } else {
                  alert("Iniciando videochamada com o profissional...");
                }
              }} 
            />
          );
        }
        return null;
      case 'chat':
        return <AIChatAssistant clinicalProfile={clinicalProfile} setClinicalProfile={setClinicalProfile} />;
      case 'my_network':
        return <MyNetworkPortal setActiveTab={setActiveTab} />;
      case 'doctors_directory':
        return (
          <SpecialistDirectory 
            currentUser={currentUser} 
            setActiveTab={setActiveTab} 
            setTelemedicineContactId={setTelemedicineContactId} 
          />
        );
      case 'documents':
        return <PatientDocuments clinicalProfile={clinicalProfile} />;
      case 'history':
        return <ClinicalHistory entries={entries} clinicalProfile={clinicalProfile} />;
      case 'nurses':
        return (
          <NursesNetwork 
            currentUser={currentUser} 
            clinicalProfile={clinicalProfile} 
            setActiveTab={setActiveTab} 
            setTelemedicineContactId={setTelemedicineContactId} 
          />
        );
      case 'admin-dashboard':
      case 'admin-metrics':
      case 'admin-reports':
      case 'admin-users':
      case 'admin-partners':
      case 'admin-logs':
      case 'admin-curatoria':
        return (
          <AdminDashboard 
            activeTab={activeTab.replace('admin-', '')} 
            setActiveTab={(tab) => setActiveTab(`admin-${tab}`)} 
            onVerificationProcessed={fetchPendingCount}
          />
        );
      case 'doctor-analytics':
        return <DoctorDashboardAnalytics currentUser={currentUser} />;
      case 'admin-partners':
        return <AdminPartners setActiveTab={setActiveTab} />;
      case 'doctor-partners':
        return <DoctorPartners doctorProfile={currentUser} />;
      case 'protocols':
        return (
          <ProtocolGuide 
            currentUser={currentUser}
            clinicalProfile={targetProfile} 
            entries={targetEntries} 
            setActiveTab={setActiveTab}
          />
        );
      default:
        if (isAdmin) {
          return <AdminDashboard />;
        }
        return currentUser?.role === 'doctor' ? (
          <DoctorDashboard 
            doctorProfile={currentUser} 
            setActiveTab={setActiveTab} 
            onProfileUpdate={setCurrentUser} 
            onEditProfile={() => setShowProfileModal(true)} 
            onOpenChat={(patientId) => { setTelemedicineContactId(patientId); setActiveTab('telemedicine'); }}
            selectedPatient={selectedPatientForDoctor}
            setSelectedPatient={setSelectedPatientForDoctor}
            selectedPatientEntries={selectedPatientEntriesForDoctor}
            setSelectedPatientEntries={setSelectedPatientEntriesForDoctor}
          />
        ) : (
          <Dashboard 
            setActiveTab={setActiveTab} 
            clinicalProfile={clinicalProfile} 
            setClinicalProfile={setClinicalProfile} 
            entries={entries}
          />
        );
    }
  };

  if (loadingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', gap: '16px', fontFamily: 'var(--font-primary)' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '12px', 
          background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '20px',
          fontFamily: 'var(--font-display)',
          animation: 'spin 1.5s linear infinite'
        }}>
          R
        </div>
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-secondary)' }}>Carregando plataforma iRec...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isClinician = currentUser.role === 'doctor' && currentUser.email !== 'admin@irec.com';
  const isVerifiedClinician = true; // Clinicians are always bypass-verified

  if (isClinician && !isVerifiedClinician) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-primary)',
        padding: '24px',
        boxSizing: 'border-box'
      }}>
        <div className="glass-card" style={{
          maxWidth: '480px',
          width: '100%',
          padding: '40px 32px',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px'
        }}>
          {currentUser.verificationStatus === 'rejected' ? (
            <>
              <div style={{ fontSize: '48px', color: 'var(--danger)' }}>❌</div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Cadastro Recusado</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                Olá, Dr(a). <strong>{currentUser.name}</strong>. Infelizmente, os documentos de credenciamento ou os dados profissionais (CRM/COREN) fornecidos não puderam ser verificados de forma satisfatória.
              </p>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                Por favor, entre em contato com nosso suporte técnico pelo e-mail <strong>suporte@irec.com.br</strong> para solicitar a revisão e regularizar suas credenciais.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '48px', color: '#f59e0b' }}>🕒</div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Cadastro em Análise</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                Olá, Dr(a). <strong>{currentUser.name}</strong>. Para garantir a segurança dos pacientes, o acesso à área clínica de médicos e enfermeiros exige a validação do registro profissional (CRM/COREN).
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                Nossa equipe de auditoria regulamentar está analisando os dados enviados. Esse processo geralmente é concluído em até 24 horas. Você receberá um e-mail assim que seu acesso for liberado.
              </p>
              {currentUser.professionalDocumentUrl && (
                <div style={{ fontSize: '12.5px', wordBreak: 'break-all' }}>
                  📄 <a href={currentUser.professionalDocumentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: '600' }}>Ver documento enviado</a>
                </div>
              )}
            </>
          )}

          <button 
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '750', fontSize: '13px', border: '1px solid var(--border-color)', marginTop: '8px' }}
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  const isChatActive = activeTab === 'chat' || activeTab === 'telemedicine';

  return (
    <div className={`app-container ${isChatActive ? 'chat-tab-active' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 
         1. DESKTOP/NOTEBOOK SIDEBAR (Left Panel)
         Visible only on desktop widths via CSS
      */}
      <aside className={`sidebar no-print ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img 
              src="/logo.png" 
              alt="iRec Logo" 
              style={{ 
                height: isSidebarCollapsed ? '28px' : '36px',
                objectFit: 'contain',
                maxWidth: isSidebarCollapsed ? '28px' : '110px',
                transition: 'all 0.2s ease',
                backgroundColor: 'transparent'
              }} 
            />
          </div>
          {!isSidebarCollapsed && (
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={theme === 'light' ? "Mudar para Modo Escuro" : "Mudar para Modo Claro"}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {theme === 'light' ? (
                <svg style={{ width: '18px', height: '18px', strokeWidth: '2.5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg style={{ width: '18px', height: '18px', strokeWidth: '2.5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <div style={{
                padding: isSidebarCollapsed ? '10px 0' : '10px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                gap: '8px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '10px',
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '1.2px'
              }}>
                <span>🛡️</span>
                {!isSidebarCollapsed && <span className="sidebar-text">Administrador</span>}
              </div>

              <button 
                className={`sidebar-item ${activeTab === 'admin-metrics' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-metrics')}
                title="Visão Geral"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="sidebar-text">Visão Geral</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'admin-reports' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-reports')}
                title="Relatórios"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="sidebar-text">Relatórios</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'admin-users' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-users')}
                title="Usuários"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="sidebar-text">Usuários</span>
              </button>


              <button 
                className={`sidebar-item ${activeTab === 'admin-partners' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-partners')}
                title="Parcerias"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="sidebar-text">Parcerias</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'admin-logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-logs')}
                title="Auditoria / Logs"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span className="sidebar-text">Auditoria / Logs</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'admin-curatoria' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-curatoria')}
                title="Curadoria Clínica"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="sidebar-text">Curadoria</span>
              </button>
            </>
          ) : currentUser.role === 'doctor' ? (
            <>
              <button 
                className={`sidebar-item ${activeTab === 'doctor-analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('doctor-analytics')}
                title="Meu Painel"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="sidebar-text">Meu Painel</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'doctor-dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('doctor-dashboard')}
                title="Lista de Pacientes"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <span className="sidebar-text">Lista de Pacientes</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'telemedicine' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemedicine')}
                title="Telemedicina"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <span className="sidebar-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                  Telemedicina
                  {unreadChatMessagesCount > 0 && (
                    <span style={{
                      backgroundColor: 'var(--danger)',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      lineHeight: 1
                    }}>
                      {unreadChatMessagesCount}
                    </span>
                  )}
                </span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'protocols' ? 'active' : ''}`}
                onClick={() => setActiveTab('protocols')}
                title="Protocolos"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                </svg>
                <span className="sidebar-text">Protocolos</span>
              </button>
              <button 
                className={`sidebar-item ${activeTab === 'doctor-partners' ? 'active' : ''}`}
                onClick={() => setActiveTab('doctor-partners')}
                title="Minhas Parcerias"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                </svg>
                <span className="sidebar-text">Minhas Parcerias</span>
              </button>
            </>
          ) : (
            <>
              <button 
                className={`sidebar-item ${(activeTab === 'dashboard' || activeTab === 'history' || activeTab === 'documents') ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
                title="Início"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                <span className="sidebar-text">Início</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
                title="Fotografar Ferida"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span className="sidebar-text">Fotografar Ferida</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
                title="Assistente"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028z" />
                </svg>
                <span className="sidebar-text">Assistente</span>
              </button>

              <button 
                className={`sidebar-item ${(activeTab === 'my_network' || activeTab === 'nurses' || activeTab === 'telemedicine' || activeTab === 'protocols' || activeTab === 'doctors_directory') ? 'active' : ''}`}
                onClick={() => setActiveTab('my_network')}
                title="Minha Rede"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <span className="sidebar-text" style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', width: '100%', gap: '6px' }}>
                  Minha Rede
                  {unreadChatMessagesCount > 0 && (
                    <span style={{
                      backgroundColor: 'var(--danger)',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      lineHeight: 1
                    }}>
                      {unreadChatMessagesCount}
                    </span>
                  )}
                </span>
              </button>
            </>
          )}

          {/* Theme Toggle Button inside Sidebar Nav - Only visible if collapsed */}
          {isSidebarCollapsed && (
            <button 
              className="sidebar-item theme-toggle-item" 
              onClick={toggleTheme}
              title={theme === 'light' ? "Mudar para Modo Escuro" : "Mudar para Modo Claro"}
            >
              {theme === 'light' ? (
                <svg style={{ width: '20px', height: '20px', strokeWidth: '2.2' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg style={{ width: '20px', height: '20px', strokeWidth: '2.2' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>
          )}

          {/* Logout Button */}
          <button 
            className="sidebar-item logout-item" 
            onClick={handleLogout}
            title="Sair do iRec"
            style={{ color: 'var(--danger)', marginTop: 'auto' }}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            <span className="sidebar-text">Sair do iRec</span>
          </button>

          {/* Sidebar Collapse Toggle Button */}
          <button 
            className="sidebar-item collapse-toggle-item" 
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isSidebarCollapsed ? (
              <svg style={{ width: '20px', height: '20px', strokeWidth: '2.5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            ) : (
              <svg style={{ width: '20px', height: '20px', strokeWidth: '2.5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            )}
            <span className="sidebar-text">Recolher Menu</span>
          </button>
        </nav>

        <div className="sidebar-profile" onClick={() => !isAdmin && setShowProfileModal(true)} style={{ cursor: isAdmin ? 'default' : 'pointer', transition: 'var(--transition-fast)' }}>
          <div className="profile-avatar" style={{ flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              currentUser.name ? currentUser.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD'
            )}
          </div>
          <div className="sidebar-profile-info">
            <p style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isAdmin ? 'Administrador iRec' : (currentUser.role === 'doctor' ? currentUser.specialty : (clinicalProfile?.hasDiabetes ? 'Paciente Diabético' : 'Paciente'))}
            </p>
          </div>
        </div>
      </aside>

      <header className="mobile-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src="/logo.png" 
            alt="iRec Logo" 
            style={{ 
              height: '28px',
              objectFit: 'contain',
              maxWidth: '90px',
              backgroundColor: 'transparent'
            }} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* PWA Direct Install Button */}
          <button
            onClick={handleInstallAppClick}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '5px 9px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
            }}
            title="Instalar iRec no Celular ou Computador"
          >
            <span>📲</span>
            <span>Instalar App</span>
          </button>

          {/* Patient UI Mode Toggle Button */}
          {currentUser?.role === 'patient' && (
            <button 
              onClick={toggleUiMode}
              style={{
                backgroundColor: uiMode === 'accessible' ? '#0284c7' : 'var(--bg-secondary)',
                color: uiMode === 'accessible' ? '#ffffff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Alternar entre Modo Padrão e Modo Fácil/Acessível"
            >
              <span>👁️</span>
              <span>{uiMode === 'accessible' ? 'Fácil' : 'Padrão'}</span>
            </button>
          )}

          {/* SOS Button (Oculto no Modo Fácil para evitar botão duplicado) */}
          {currentUser?.role === 'patient' && uiMode !== 'accessible' && (
            <button
              onClick={() => setShowSOSModal(true)}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Emergência SOS"
            >
              <span>🚨</span>
              <span>SOS</span>
            </button>
          )}

          {/* Mobile Profile Button */}
          {!isAdmin && (
            <button 
              className="theme-toggle-btn" 
              onClick={() => setShowProfileModal(true)}
              style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', padding: 0 }}
              title="Editar Perfil"
            >
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  {currentUser.name ? currentUser.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'JS'}
                </span>
              )}
            </button>
          )}

          {/* Mobile Theme Toggle Button */}
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            style={{ width: '32px', height: '32px', borderRadius: '8px' }}
          >
            {theme === 'light' ? (
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* 
         3. MAIN CONTENT WINDOW
         Responsively sized padding and width
      */}
      <main className={`main-content ${isChatActive ? 'chat-tab-active' : ''}`}>
        {!isSupabaseConfigured && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '11px',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-primary)',
            fontWeight: '600',
            width: '100%',
            boxSizing: 'border-box'
          }} className="no-print">
            <span>⚠️</span>
            <span><strong>Modo de Demonstração Offline:</strong> Este sistema está operando localmente no navegador (LocalStorage). Alterações em fichas clínicas e consultas não serão gravadas no servidor de produção.</span>
          </div>
        )}
        {/* Top Sticky Header for Accessible Mode Navigation */}
        {uiMode === 'accessible' && currentUser?.role === 'patient' && activeTab !== 'dashboard' && (
          <div style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '12px 16px',
            textAlign: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 99999,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
            display: 'flex',
            justifyContent: 'center'
          }} className="no-print">
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60]);
                setActiveTab('dashboard');
              }}
              style={{
                backgroundColor: '#ffffff',
                color: '#0284c7',
                border: 'none',
                borderRadius: '14px',
                padding: '14px 24px',
                fontWeight: '900',
                fontSize: '17px',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '450px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '22px' }}>⬅</span>
              <span>VOLTAR AO INÍCIO (MODO FÁCIL)</span>
            </button>
          </div>
        )}

        {(activeTab !== 'telemedicine' || (uiMode === 'accessible' && currentUser?.role === 'patient')) && renderContent()}
        {!(uiMode === 'accessible' && currentUser?.role === 'patient') && (
          <Telemedicine 
            currentUser={currentUser} 
            activeCallSession={activeCallSession} 
            setActiveCallSession={setActiveCallSession} 
            targetContactId={telemedicineContactId}
            isAppActiveTab={activeTab === 'telemedicine'}
            setAppActiveTab={setActiveTab}
            onUnreadCountChange={setUnreadChatMessagesCount}
          />
        )}
      </main>

      {/* Mobile More Menu slide-up drawer */}
      {showMobileMoreMenu && currentUser && currentUser.role === 'patient' && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '12px',
          right: '12px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          backdropFilter: 'blur(20px)',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Serviços iRec</span>
            <button 
              onClick={() => setShowMobileMoreMenu(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer', padding: 0 }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
            
            {/* Assistente IA */}
            <div 
              onClick={() => { setActiveTab('chat'); setShowMobileMoreMenu(false); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', borderRadius: '12px', backgroundColor: activeTab === 'chat' ? 'var(--primary-glow)' : 'var(--bg-primary)', border: activeTab === 'chat' ? '1.5px solid var(--primary-light)' : '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: activeTab === 'chat' ? 'var(--primary)' : 'var(--text-primary)' }}>Suporte IA</span>
            </div>

            {/* Médicos */}
            <div 
              onClick={() => { setActiveTab('doctors_directory'); setShowMobileMoreMenu(false); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', borderRadius: '12px', backgroundColor: activeTab === 'doctors_directory' ? 'var(--primary-glow)' : 'var(--bg-primary)', border: activeTab === 'doctors_directory' ? '1.5px solid var(--primary-light)' : '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>👨‍⚕️</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: activeTab === 'doctors_directory' ? 'var(--primary)' : 'var(--text-primary)' }}>Médicos</span>
            </div>

            {/* Enfermeiros */}
            <div 
              onClick={() => { setActiveTab('nurses'); setShowMobileMoreMenu(false); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', borderRadius: '12px', backgroundColor: activeTab === 'nurses' ? 'var(--primary-glow)' : 'var(--bg-primary)', border: activeTab === 'nurses' ? '1.5px solid var(--primary-light)' : '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>🩺</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: activeTab === 'nurses' ? 'var(--primary)' : 'var(--text-primary)' }}>Enfermagem</span>
            </div>

            {/* Histórico */}
            <div 
              onClick={() => { setActiveTab('history'); setShowMobileMoreMenu(false); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', borderRadius: '12px', backgroundColor: activeTab === 'history' ? 'var(--primary-glow)' : 'var(--bg-primary)', border: activeTab === 'history' ? '1.5px solid var(--primary-light)' : '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>📅</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-primary)' }}>Histórico</span>
            </div>

            {/* Documentos */}
            <div 
              onClick={() => { setActiveTab('documents'); setShowMobileMoreMenu(false); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', borderRadius: '12px', backgroundColor: activeTab === 'documents' ? 'var(--primary-glow)' : 'var(--bg-primary)', border: activeTab === 'documents' ? '1.5px solid var(--primary-light)' : '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>📄</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: activeTab === 'documents' ? 'var(--primary)' : 'var(--text-primary)' }}>Documentos</span>
            </div>

          </div>
        </div>
      )}

      {/* 
         4. MOBILE NAVIGATION (Bottom Bar)
         Visible only on mobile widths via CSS
      {/* Condicional para ocultar barra de navegação no Modo Fácil (Acessível) */}
      {!(uiMode === 'accessible' && currentUser?.role === 'patient') && (
        <nav className="bottom-nav no-print">
        {isAdmin ? (
          <>
            <button 
              className={`nav-item ${activeTab.startsWith('admin-') ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-metrics')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Admin
            </button>
          </>
        ) : currentUser.role === 'doctor' ? (
          <>
            <button 
              className={`nav-item ${activeTab === 'doctor-analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('doctor-analytics')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Meu Painel
            </button>

            <button 
              className={`nav-item ${activeTab === 'doctor-dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('doctor-dashboard')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Pacientes
            </button>

            <button 
              className={`nav-item ${activeTab === 'telemedicine' ? 'active' : ''}`}
              onClick={() => setActiveTab('telemedicine')}
              style={{ position: 'relative' }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Telemedicina
              {unreadChatMessagesCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '24px',
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: '800',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}>
                  {unreadChatMessagesCount}
                </span>
              )}
            </button>

            <button 
              className={`nav-item ${activeTab === 'protocols' ? 'active' : ''}`}
              onClick={() => setActiveTab('protocols')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              </svg>
              Protocolos
            </button>
          </>
        ) : (
          <>
            <button 
              className={`nav-item ${(activeTab === 'dashboard' || activeTab === 'history' || activeTab === 'documents') ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setShowMobileMoreMenu(false); }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Início
            </button>

            <button 
              className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => { setActiveTab('upload'); setShowMobileMoreMenu(false); }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              Fotografar Ferida
            </button>

            <button 
              className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => { setActiveTab('chat'); setShowMobileMoreMenu(false); }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028z" />
              </svg>
              Assistente
            </button>

            <button 
              className={`nav-item ${(activeTab === 'my_network' || activeTab === 'nurses' || activeTab === 'telemedicine' || activeTab === 'protocols' || activeTab === 'doctors_directory') ? 'active' : ''}`}
              onClick={() => { setActiveTab('my_network'); setShowMobileMoreMenu(false); }}
              style={{ position: 'relative' }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              Minha Rede
              {unreadChatMessagesCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '24px',
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: '800',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}>
                  {unreadChatMessagesCount}
                </span>
              )}
            </button>
          </>
        )}
      </nav>
      )}

      {showNotificationPromptModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'var(--font-primary, sans-serif)'
        }}>
          <div style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#1e293b',
            borderRadius: '24px',
            border: '2px solid #0284c7',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            padding: '28px',
            textAlign: 'center',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ fontSize: '48px' }}>🚨</div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
              Ativar Notificação Fixa de Emergência?
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>
              Para sua segurança, o iRec pode fixar um alerta de emergência na barra do seu celular com o botão de Ligar 192 (SAMU) e Rota da UPA com 1 toque.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={handleGrantNotificationPermission}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '16px',
                  fontWeight: '800',
                  fontSize: '16px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                }}
              >
                🔔 SIM, ATIVAR NOTIFICAÇÃO SOS AGORA
              </button>
              <button
                onClick={() => setShowNotificationPromptModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      {showSOSModal && (
        <SOSEmergencyModal 
          onClose={() => setShowSOSModal(false)} 
          clinicalProfile={clinicalProfile} 
        />
      )}

      {showProfileModal && (
        <UserProfileModal 
          currentUser={currentUser} 
          onClose={() => setShowProfileModal(false)} 
          onProfileUpdate={(updatedProfile) => {
            setCurrentUser(updatedProfile);
            if (updatedProfile.role === 'patient') {
              setClinicalProfile(updatedProfile);
            }
          }} 
        />
      )}

      {activeCallSession && activeCallSession.status === 'ringing' && activeTab !== 'telemedicine' && (
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
          <div style={{
            position: 'relative',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '32px'
          }}>
            📞
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '2px solid #10b981',
              animation: 'ripple 2s infinite ease-out'
            }} />
          </div>

          <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
            Teleconsulta Clínico iRec
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px' }}>
            Chamada de vídeo recebida
          </p>

          <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
            <button 
              onClick={async () => {
                await updateCallStatus(activeCallSession.id, 'rejected');
                setActiveCallSession(null);
              }}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50px',
                padding: '12px 28px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(239,68,68,0.3)'
              }}
            >
              Recusar
            </button>
            <button 
              onClick={async () => {
                await updateCallStatus(activeCallSession.id, 'accepted');
                setActiveCallSession(prev => prev ? { ...prev, status: 'accepted' } : null);
                setTelemedicineContactId(activeCallSession.callerId);
                setActiveTab('telemedicine');
              }}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50px',
                padding: '12px 28px',
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
            @keyframes ripple {
              0% { transform: scale(1); opacity: 0.8; }
              100% { transform: scale(1.8); opacity: 0; }
            }
            @keyframes slideUp {
              from { transform: translateY(15px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* iOS Safari Installation Instruction Drawer */}
      {showIOSInstallBanner && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '12px',
          right: '12px',
          backgroundColor: '#0f172a',
          border: '2px solid #0284c7',
          borderRadius: '20px',
          padding: '18px',
          color: '#ffffff',
          zIndex: 999999,
          boxShadow: '0 20px 40px rgba(2, 132, 199, 0.4)',
          fontFamily: 'var(--font-primary, sans-serif)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }} className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#38bdf8' }}>🍏 Instalar o iRec no seu iPhone:</span>
            <button
              onClick={() => setShowIOSInstallBanner(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer', padding: 0 }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.6' }}>
            Para instalar como aplicativo nativo no iOS:
            <br />
            1. Toque no ícone de <strong>Compartilhar 📤</strong> (na barra inferior do Safari).
            <br />
            2. Role para baixo e selecione <strong>"Adicionar à Tela de Início" ➕</strong>.
          </div>
        </div>
      )}
      {/* Interactive System Permissions & Installation Guide Modal */}
      {showPermissionsGuideModal && (
        <PermissionsGuideModal onClose={() => setShowPermissionsGuideModal(false)} />
      )}
    </div>
  );
}
