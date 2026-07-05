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
import { getClinicalProfile, getWoundEntries, signOutUser, getCurrentUser, checkIncomingCalls, checkCallStatus, updateCallStatus, updateLastSeen } from './services/supabaseService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [telemedicineContactId, setTelemedicineContactId] = useState(null);
  const [unreadChatMessagesCount, setUnreadChatMessagesCount] = useState(0);
  const [selectedPatientForDoctor, setSelectedPatientForDoctor] = useState(null);
  const [selectedPatientEntriesForDoctor, setSelectedPatientEntriesForDoctor] = useState([]);

  const isAdmin = currentUser && currentUser.email === 'admin@irec.com';

  // Create a ref to store activeCallSession to prevent recreating the BroadcastChannel and interval on every session change
  const activeCallSessionRef = useRef(activeCallSession);
  useEffect(() => {
    activeCallSessionRef.current = activeCallSession;
  }, [activeCallSession]);

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
        if (userProfile.email === 'admin@irec.com') {
          setActiveTab('admin-dashboard');
        } else if (userProfile.role === 'doctor') {
          setActiveTab('doctor-analytics');
        } else {
          setActiveTab('dashboard');
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
      
      // If already cached, do nothing
      if (localStorage.getItem(cacheKey)) return;
      
      try {
        console.log("Pre-fetching personalized care guide in the background...");
        // Import dynamically to optimize initial bundle size
        const { generatePersonalizedProtocol } = await import('./services/geminiService');
        
        const result = await generatePersonalizedProtocol(clinicalProfile, latestWoundEntry);
        
        if (result) {
          const cacheData = {
            protocol: result,
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
      setActiveTab('admin-dashboard');
    } else if (profile.role === 'doctor') {
      setActiveTab('doctor-dashboard');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
  };

  const addClinicalEntryLocal = (newEntry) => {
    setEntries((prev) => [...prev, newEntry]);
  };

  // Render active screen
  const renderContent = () => {
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
        return (
          <Dashboard 
            setActiveTab={setActiveTab} 
            clinicalProfile={clinicalProfile} 
            setClinicalProfile={setClinicalProfile} 
            entries={entries}
          />
        );
      case 'upload':
        return (
          <ClinicalTriage 
            setActiveTab={setActiveTab} 
            addClinicalEntry={addClinicalEntryLocal} 
            clinicalProfile={clinicalProfile} 
          />
        );
      case 'chat':
        return <AIChatAssistant clinicalProfile={clinicalProfile} setClinicalProfile={setClinicalProfile} />;
      case 'doctors_directory':
        return (
          <SpecialistDirectory 
            currentUser={currentUser} 
            setActiveTab={setActiveTab} 
            setTelemedicineContactId={setTelemedicineContactId} 
          />
        );
      case 'telemedicine':
        return null;
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
        return <AdminDashboard />;
      case 'doctor-analytics':
        return <DoctorDashboardAnalytics currentUser={currentUser} />;
      case 'admin-partners':
        return <AdminPartners setActiveTab={setActiveTab} />;
      case 'doctor-partners':
        return <DoctorPartners doctorProfile={currentUser} />;
      case 'protocols':
        const isClinician = currentUser?.role === 'doctor';
        const targetProfile = isClinician ? selectedPatientForDoctor : clinicalProfile;
        const targetEntries = isClinician ? selectedPatientEntriesForDoctor : entries;
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
              <button 
                className={`sidebar-item ${activeTab === 'admin-dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin-dashboard')}
                title="Painel Admin"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="sidebar-text">Painel Admin</span>
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
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
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
                title="Triagem"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span className="sidebar-text">Triagem</span>
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
                className={`sidebar-item ${activeTab === 'doctors_directory' ? 'active' : ''}`}
                onClick={() => setActiveTab('doctors_directory')}
                title="Médicos"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                <span className="sidebar-text">Médicos</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'nurses' ? 'active' : ''}`}
                onClick={() => setActiveTab('nurses')}
                title="Enfermagem"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 20c-3.14 0-6.02-1.268-8.125-3.327a4.125 4.125 0 0 1 6.9-4.127 12.306 12.306 0 0 0 5.122 1.306c.71 0 1.38-.086 2.022-.249M15 19.128V19m-4.5-9.128a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM18.75 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <span className="sidebar-text">Enfermagem</span>
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
                className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
                title="Histórico"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6v7.5c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75V6m-16.5 0v7.5m16.5-7.5v7.5M3.75 6h16.5M3.75 13.5h16.5M7.5 10.5h9m-9 3H12" />
                </svg>
                <span className="sidebar-text">Histórico</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
                title="Documentos"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="sidebar-text">Documentos</span>
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
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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

          {/* Mobile Logout Button */}
          <button 
            className="theme-toggle-btn" 
            onClick={handleLogout}
            style={{ width: '32px', height: '32px', borderRadius: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            title="Sair"
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
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
        {activeTab !== 'telemedicine' && renderContent()}
        <Telemedicine 
          currentUser={currentUser} 
          activeCallSession={activeCallSession} 
          setActiveCallSession={setActiveCallSession} 
          targetContactId={telemedicineContactId}
          isAppActiveTab={activeTab === 'telemedicine'}
          setAppActiveTab={setActiveTab}
          onUnreadCountChange={setUnreadChatMessagesCount}
        />
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
      */}
      <nav className="bottom-nav no-print">
        {isAdmin ? (
          <>
            <button 
              className={`nav-item ${activeTab === 'admin-dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-dashboard')}
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
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
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
              Triagem
            </button>

            <button 
              className={`nav-item ${activeTab === 'telemedicine' ? 'active' : ''}`}
              onClick={() => { setActiveTab('telemedicine'); setShowMobileMoreMenu(false); }}
              style={{ position: 'relative' }}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Teleconsulta
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
              className={`nav-item ${showMobileMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMobileMoreMenu(prev => !prev)}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              Mais
            </button>
          </>
        )}
      </nav>

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
    </div>
  );
}
