import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import UploadWound from './components/UploadWound';
import WoundHistory from './components/WoundHistory';
import NursesNetwork from './components/NursesNetwork';
import ProtocolGuide from './components/ProtocolGuide';
import AIChatAssistant from './components/AIChatAssistant';
import Login from './components/Login';
import DoctorDashboard from './components/DoctorDashboard';
import PatientDocuments from './components/PatientDocuments';
import UserProfileModal from './components/UserProfileModal';
import Telemedicine from './components/Telemedicine';
import { getClinicalProfile, getWoundEntries, addWoundEntry, signOutUser, getCurrentUser, checkIncomingCalls, checkCallStatus, updateCallStatus } from './services/supabaseService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [telemedicineContactId, setTelemedicineContactId] = useState(null);

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
      if (activeCallSession && activeCallSession.id.toString() === callId.toString()) {
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

    // Polling for cross-device incoming calls
    const interval = setInterval(async () => {
      if (activeCallSession) {
        const statusCheck = await checkCallStatus(activeCallSession.id);
        if (statusCheck) {
          if (statusCheck.status === 'ended' || statusCheck.status === 'rejected') {
            setActiveCallSession(null);
          } else if (statusCheck.status !== activeCallSession.status) {
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

    return () => {
      clearInterval(interval);
      if (chatChannel) chatChannel.close();
    };
  }, [currentUser, activeCallSession]);
  
  // Theme state: light or dark (persisted in localStorage)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('irec-theme');
    if (saved) return saved;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('irec-theme', theme);
  }, [theme]);

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

  // Check auth session on component mount
  useEffect(() => {
    async function checkSession() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.role === 'doctor') {
            setActiveTab('doctor-dashboard');
          } else {
            setActiveTab('dashboard');
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar sessão:', e);
      } finally {
        setLoadingAuth(false);
      }
    }
    checkSession();

    // Supabase Auth listener
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          const profile = await getClinicalProfile(session.user.id);
          if (profile) {
            setCurrentUser(profile);
            if (profile.role === 'doctor') {
              setActiveTab('doctor-dashboard');
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
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

  const handleLoginSuccess = (profile) => {
    setCurrentUser(profile);
    if (profile.role === 'doctor') {
      setActiveTab('doctor-dashboard');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
  };

  const addWoundEntryLocal = (newEntry) => {
    setEntries((prev) => [...prev, newEntry]);
  };

  // Render active screen
  const renderContent = () => {
    switch (activeTab) {
      case 'doctor-dashboard':
        return <DoctorDashboard doctorProfile={currentUser} setActiveTab={setActiveTab} onProfileUpdate={setCurrentUser} onEditProfile={() => setShowProfileModal(true)} onOpenChat={(patientId) => { setTelemedicineContactId(patientId); setActiveTab('telemedicine'); }} />;
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
          <UploadWound 
            setActiveTab={setActiveTab} 
            addWoundEntry={addWoundEntryLocal} 
            clinicalProfile={clinicalProfile} 
          />
        );
      case 'chat':
        return <AIChatAssistant clinicalProfile={clinicalProfile} setClinicalProfile={setClinicalProfile} />;
      case 'telemedicine':
        return null;
      case 'documents':
        return <PatientDocuments clinicalProfile={clinicalProfile} />;
      case 'history':
        return <WoundHistory entries={entries} clinicalProfile={clinicalProfile} />;
      case 'nurses':
        return <NursesNetwork clinicalProfile={clinicalProfile} />;
      case 'protocols':
        return <ProtocolGuide clinicalProfile={clinicalProfile} entries={entries} />;
      default:
        return currentUser?.role === 'doctor' ? (
          <DoctorDashboard doctorProfile={currentUser} setActiveTab={setActiveTab} onProfileUpdate={setCurrentUser} onEditProfile={() => setShowProfileModal(true)} onOpenChat={(patientId) => { setTelemedicineContactId(patientId); setActiveTab('telemedicine'); }} />
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
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '16px',
              fontFamily: 'var(--font-display)',
              flexShrink: 0
            }}>
              R
            </div>
            {!isSidebarCollapsed && (
              <h1 className="sidebar-logo-text" style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                i<span className="gradient-text">Rec</span>
              </h1>
            )}
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
          {currentUser.role === 'doctor' ? (
            <>
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
                title="Telemedicina & Chat"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <span className="sidebar-text">Telemedicina & Chat</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'protocols' ? 'active' : ''}`}
                onClick={() => setActiveTab('protocols')}
                title="Guias de Tratamento"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                </svg>
                <span className="sidebar-text">Guias de Tratamento</span>
              </button>
            </>
          ) : (
            <>
              <button 
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
                title="Início / Dashboard"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                <span className="sidebar-text">Início / Dashboard</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
                title="Nova Foto / Triagem"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span className="sidebar-text">Nova Foto / Triagem</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
                title="Assistente de Cuidados"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028z" />
                </svg>
                <span className="sidebar-text">Assistente de Cuidados</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'telemedicine' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemedicine')}
                title="Telemedicina & Chat"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <span className="sidebar-text">Telemedicina & Chat</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
                title="Histórico Evolutivo"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6v7.5c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75V6m-16.5 0v7.5m16.5-7.5v7.5M3.75 6h16.5M3.75 13.5h16.5M7.5 10.5h9m-9 3H12" />
                </svg>
                <span className="sidebar-text">Histórico Evolutivo</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
                title="Receitas e Atestados"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="sidebar-text">Receitas e Atestados</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'nurses' ? 'active' : ''}`}
                onClick={() => setActiveTab('nurses')}
                title="Rede de Enfermagem"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 20c-3.14 0-6.02-1.268-8.125-3.327a4.125 4.125 0 0 1 6.9-4.127 12.306 12.306 0 0 0 5.122 1.306c.71 0 1.38-.086 2.022-.249M15 19.128V19m-4.5-9.128a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM18.75 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                <span className="sidebar-text">Rede de Enfermagem</span>
              </button>

              <button 
                className={`sidebar-item ${activeTab === 'protocols' ? 'active' : ''}`}
                onClick={() => setActiveTab('protocols')}
                title="Guias de Tratamento"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                </svg>
                <span className="sidebar-text">Guias de Tratamento</span>
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

        <div className="sidebar-profile" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer', transition: 'var(--transition-fast)' }}>
          <div className="profile-avatar" style={{ flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              currentUser.name ? currentUser.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'JS'
            )}
          </div>
          <div className="sidebar-profile-info">
            <p style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.role === 'doctor' ? currentUser.specialty : (clinicalProfile.hasDiabetes ? 'Paciente Diabético' : 'Paciente')}
            </p>
          </div>
        </div>
      </aside>

      <header className="mobile-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            fontFamily: 'var(--font-display)'
          }}>
            R
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
            i<span className="gradient-text">Rec</span>
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Mobile Profile Button */}
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
        {activeTab !== 'telemedicine' && renderContent()}
        <Telemedicine 
          currentUser={currentUser} 
          activeCallSession={activeCallSession} 
          setActiveCallSession={setActiveCallSession} 
          targetContactId={telemedicineContactId}
          isAppActiveTab={activeTab === 'telemedicine'}
          setAppActiveTab={setActiveTab}
        />
      </main>

      {/* 
         4. MOBILE NAVIGATION (Bottom Bar)
         Visible only on mobile widths via CSS
      */}
      <nav className="bottom-nav no-print">
        {currentUser.role === 'doctor' ? (
          <>
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
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Telemedicina
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
              onClick={() => setActiveTab('dashboard')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Início
            </button>

            <button 
              className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              Foto
            </button>

            <button 
              className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028z" />
              </svg>
              Suporte
            </button>

            <button 
              className={`nav-item ${activeTab === 'telemedicine' ? 'active' : ''}`}
              onClick={() => setActiveTab('telemedicine')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Teleconsulta
            </button>

            <button 
              className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6v7.5c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75V6m-16.5 0v7.5m16.5-7.5v7.5M3.75 6h16.5M3.75 13.5h16.5M7.5 10.5h9m-9 3H12" />
              </svg>
              Histórico
            </button>

            <button 
              className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Documentos
            </button>

            <button 
              className={`nav-item ${activeTab === 'nurses' ? 'active' : ''}`}
              onClick={() => setActiveTab('nurses')}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 20c-3.14 0-6.02-1.268-8.125-3.327a4.125 4.125 0 0 1 6.9-4.127 12.306 12.306 0 0 0 5.122 1.306c.71 0 1.38-.086 2.022-.249M15 19.128V19m-4.5-9.128a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM18.75 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              Enfermeiros
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
          `}</style>
        </div>
      )}
    </div>
  );
}
