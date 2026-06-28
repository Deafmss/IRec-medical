import React, { useState } from 'react';
import { signInUser, signUpUser } from '../services/supabaseService';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const ALL_SPECIALTIES = [
  'Acupuntura',
  'Alergia e Imunologia',
  'Anestesiologia',
  'Angiologia',
  'Cardiologia',
  'Cirurgia Cardiovascular',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Geral',
  'Cirurgia Oncológica',
  'Cirurgia Pediátrica',
  'Cirurgia Plástica',
  'Cirurgia Torácica',
  'Cirurgia Vascular',
  'Clínico Geral',
  'Coloproctologia',
  'Dermatologia',
  'Endocrinologia e Metabologia',
  'Endoscopia',
  'Gastroenterologia',
  'Genética Médica',
  'Geriatria',
  'Ginecologia e Obstetrícia',
  'Hematologia e Hemoterapia',
  'Homeopatia',
  'Infectologia',
  'Mastologia',
  'Medicina de Emergência',
  'Medicina de Família e Comunidade',
  'Medicina do Trabalho',
  'Medicina de Tráfego',
  'Medicina Esportiva',
  'Medicina Física e Reabilitação',
  'Medicina Intensiva',
  'Medicina Legal e Perícia Médica',
  'Medicina Nuclear',
  'Medicina Preventiva e Social',
  'Nefrologia',
  'Neurocirurgia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Oncologia Clínica',
  'Ortopedia e Traumatologia',
  'Otorrinolaringologia',
  'Patologia',
  'Patologia Clínica/Medicina Laboratorial',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Radiologia e Diagnóstico por Imagem',
  'Radioterapia',
  'Reumatologia',
  'Urologia',
  'Estomaterapia',
  'Enfermagem Geral',
  'Enfermagem em Dermatologia',
  'Enfermagem em Terapia Intensiva',
  'Enfermagem em Saúde da Família',
  'Enfermagem Obstétrica',
  'Enfermagem Pediátrica',
  'Enfermagem Oncológica',
  'Enfermagem de Urgência e Emergência',
  'Enfermagem do Trabalho',
  'Enfermagem em Centro Cirúrgico',
  'Enfermagem Nefrológica',
  'Enfermagem em Saúde Mental e Psiquiatria',
  'Enfermagem Geronto-Geriátrica',
  'Enfermagem em Infectologia'
];

export default function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState('patient'); // 'patient' or 'doctor'
  const [clinicianType, setClinicianType] = useState('doctor'); // 'doctor' or 'nurse'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Patient fields
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  
  // Doctor fields
  const [crm, setCrm] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [rqe, setRqe] = useState('');
  const [specSearch, setSpecSearch] = useState('');
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isRegistering) {
        // Validation
        if (!email || !password || !name) {
          throw new Error('Por favor, preencha todos os campos obrigatórios.');
        }

        let additionalData = {};
        if (role === 'patient') {
          if (!birthDate || !gender) {
            throw new Error('Por favor, informe sua data de nascimento e gênero.');
          }
          additionalData = { birthDate, gender };
        } else {
          if (!crm || !specialty) {
            throw new Error('Por favor, informe seu CRM/COREN e especialidade.');
          }
          additionalData = { crm, specialty, rqe };
        }

        try {
          const profile = await signUpUser(email, password, name, role, additionalData);
          setSuccessMsg('Cadastro realizado com sucesso! Redirecionando...');
          setTimeout(() => {
            onLoginSuccess(profile);
          }, 1500);
        } catch (signUpErr) {
          if (signUpErr.message === 'CONFIRM_EMAIL') {
            setSuccessMsg('Cadastro realizado com sucesso! Enviamos um e-mail de confirmação. Por favor, verifique sua caixa de entrada para ativar a conta antes de fazer login.');
            setEmail('');
            setPassword('');
            setName('');
            setCrm('');
            setSpecialty('');
            setRqe('');
            setBirthDate('');
            setGender('');
            setIsRegistering(false);
          } else {
            throw signUpErr;
          }
        }
      } else {
        if (!email || !password) {
          throw new Error('Por favor, preencha e-mail e senha.');
        }
        const profile = await signInUser(email, password);
        onLoginSuccess(profile);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro no processo de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const providerId = provider.toLowerCase(); // 'google' or 'apple'

    if (!isSupabaseConfigured) {
      // Mock/Offline login success
      setTimeout(() => {
        const mockProfile = {
          id: `social_${Date.now()}`,
          role: 'patient', // default to patient for social logins
          name: `Paciente ${provider}`,
          email: `${providerId}_user@example.com`,
          birthDate: '1990-01-01',
          gender: 'Masculino',
          healthUnit: '',
          hasDiabetes: false,
          hasHypertension: false,
          hasVenousInsufficiency: false,
          hasPeripheralArterialDisease: false,
          isSmoker: false,
          isObese: false,
          hasAmputationHistory: false,
          otherConditions: '',
          medications: '',
          allergies: '',
          attachedExams: [],
          triageAlerts: []
        };
        localStorage.setItem('irec_active_user', JSON.stringify(mockProfile));
        // Add to offline users database
        const users = JSON.parse(localStorage.getItem('irec_users') || '[]');
        if (!users.some(u => u.email === mockProfile.email)) {
          users.push({ id: mockProfile.id, email: mockProfile.email, name: mockProfile.name, role: mockProfile.role });
          localStorage.setItem('irec_users', JSON.stringify(users));
        }
        setLoading(false);
        onLoginSuccess(mockProfile);
      }, 1000);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: providerId,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setErrorMsg(`Erro no login com ${provider}: Certifique-se de que o provedor ${provider} está ativo e configurado no painel do seu Supabase.`);
      setLoading(false);
    }
  };

  const selectedSpecialties = specialty ? specialty.split(',').map(s => s.trim()).filter(Boolean) : [];

  const filteredOptions = ALL_SPECIALTIES.filter(s => 
    s.toLowerCase().includes(specSearch.toLowerCase()) && 
    !selectedSpecialties.includes(s)
  );

  const showCustomOption = specSearch.trim() && 
    !ALL_SPECIALTIES.some(s => s.toLowerCase() === specSearch.trim().toLowerCase()) &&
    !selectedSpecialties.some(s => s.toLowerCase() === specSearch.trim().toLowerCase());

  const addSpecialty = (specName) => {
    if (!selectedSpecialties.includes(specName)) {
      const updated = [...selectedSpecialties, specName].join(', ');
      setSpecialty(updated);
    }
    setSpecSearch('');
    setSpecDropdownOpen(false);
  };

  const removeSpecialty = (specName) => {
    const updated = selectedSpecialties.filter(s => s !== specName).join(', ');
    setSpecialty(updated);
  };

  return (
    <div className="login-page-wrapper">
      <style>{`
        .login-page-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 10% 20%, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          padding: 20px;
          font-family: var(--font-primary);
        }
        
        .login-card {
          width: 100%;
          max-width: 440px;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg), var(--shadow-glow);
          padding: 40px 32px;
          animation: loginFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        @keyframes loginFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .login-logo-badge {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 800;
          font-size: 24px;
          font-family: var(--font-display);
          box-shadow: 0 4px 12px var(--primary-glow);
        }

        .login-title {
          font-size: 26px;
          font-weight: 800;
          font-family: var(--font-display);
          color: var(--text-primary);
          margin-top: 8px;
        }

        .login-subtitle {
          font-size: 13.5px;
          color: var(--text-muted);
        }

        .login-tabs {
          display: flex;
          background-color: var(--bg-primary);
          padding: 4px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
        }

        .login-tab-btn {
          flex: 1;
          padding: 10px;
          border: none;
          background: none;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 10px;
          transition: var(--transition-fast);
        }

        .login-tab-btn.active {
          background-color: var(--bg-secondary);
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .login-role-selector {
          display: flex;
          gap: 12px;
        }

        .role-option {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border-radius: var(--radius-md);
          border: 2px solid var(--border-color);
          background-color: var(--bg-secondary);
          cursor: pointer;
          transition: var(--transition-smooth);
          gap: 6px;
          text-align: center;
        }

        .role-option:hover {
          border-color: var(--primary-light);
          background-color: var(--primary-glow);
        }

        .role-option.active {
          border-color: var(--primary);
          background-color: var(--primary-glow);
          color: var(--primary);
        }

        .role-option svg {
          width: 22px;
          height: 22px;
          stroke-width: 2;
        }

        .role-title {
          font-size: 12px;
          font-weight: 700;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .form-input {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 14px;
          transition: var(--transition-fast);
        }

        .form-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }

        .form-select {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .form-select:focus {
          border-color: var(--primary);
        }

        .error-message {
          padding: 10px 14px;
          background-color: var(--danger-glow);
          border: 1px solid var(--danger);
          color: var(--danger);
          border-radius: var(--radius-md);
          font-size: 12.5px;
          line-height: 1.4;
          font-weight: 500;
        }

        .success-message {
          padding: 10px 14px;
          background-color: var(--success-glow);
          border: 1px solid var(--success);
          color: var(--success);
          border-radius: var(--radius-md);
          font-size: 12.5px;
          line-height: 1.4;
          font-weight: 500;
        }

        .social-separator {
          display: flex;
          align-items: center;
          text-align: center;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          margin: 6px 0;
        }

        .social-separator::before,
        .social-separator::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--border-color);
        }

        .social-separator:not(:empty)::before {
          margin-right: .5em;
        }

        .social-separator:not(:empty)::after {
          margin-left: .5em;
        }

        .social-login-grid {
          display: flex;
          gap: 12px;
        }

        .social-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          gap: 8px;
        }

        .social-btn:hover {
          background-color: var(--bg-primary);
          border-color: var(--text-muted);
        }

        .social-btn svg {
          width: 18px;
          height: 18px;
        }
      `}</style>

      <div className="login-card">
        <div className="login-header" style={{ marginBottom: '10px' }}>
          <img 
            src="/logo.png" 
            alt="iRec Logo" 
            style={{ 
              height: '60px', 
              objectFit: 'contain',
              maxWidth: '180px',
              backgroundColor: 'transparent',
              marginBottom: '10px'
            }} 
          />
          <p className="login-subtitle">Plataforma Inteligente de Cuidado de Feridas</p>
        </div>

        {/* Tab Selector */}
        <div className="login-tabs">
          <button 
            type="button" 
            className={`login-tab-btn ${!isRegistering ? 'active' : ''}`}
            onClick={() => {
              setIsRegistering(false);
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Entrar
          </button>
          <button 
            type="button" 
            className={`login-tab-btn ${isRegistering ? 'active' : ''}`}
            onClick={() => {
              setIsRegistering(true);
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && <div className="error-message">{errorMsg}</div>}
          {successMsg && <div className="success-message">{successMsg}</div>}

          {/* Registration Extra: Role & Name */}
          {isRegistering && (
            <>
              <div className="form-group">
                <label className="form-label">Eu sou um:</label>
                <div className="login-role-selector">
                  <div 
                    className={`role-option ${role === 'patient' ? 'active' : ''}`}
                    onClick={() => setRole('patient')}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    <span className="role-title">Paciente</span>
                  </div>
                  <div 
                    className={`role-option ${role === 'doctor' && clinicianType === 'doctor' ? 'active' : ''}`}
                    onClick={() => {
                      setRole('doctor');
                      setClinicianType('doctor');
                      setSpecialty('Clínico Geral');
                    }}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    </svg>
                    <span className="role-title">Médico</span>
                  </div>
                  <div 
                    className={`role-option ${role === 'doctor' && clinicianType === 'nurse' ? 'active' : ''}`}
                    onClick={() => {
                      setRole('doctor');
                      setClinicianType('nurse');
                      setSpecialty('Estomaterapia');
                    }}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128V19m-4.5-9.128a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM18.75 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                    <span className="role-title">Enfermeiro</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Seu nome"
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                />
              </div>
            </>
          )}

          {/* Standard fields */}
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="exemplo@email.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>

          {/* Role-Specific Fields (Registration Only) */}
          {isRegistering && role === 'patient' && (
            <>
              <div className="form-group">
                <label className="form-label">Data de Nascimento</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={birthDate} 
                  onChange={(e) => setBirthDate(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gênero</label>
                <select 
                  className="form-select"
                  value={gender} 
                  onChange={(e) => setGender(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro / Prefiro não dizer</option>
                </select>
              </div>
            </>
          )}

          {isRegistering && role === 'doctor' && (
            <>
              <div className="form-group">
                <label className="form-label">
                  {clinicianType === 'doctor' ? 'CRM (Registro Profissional)' : 'COREN (Registro Profissional)'}
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={clinicianType === 'doctor' ? "Ex: CRM-SP 123456" : "Ex: COREN-RJ 78900"}
                  value={crm} 
                  onChange={(e) => setCrm(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Especialidade(s) Clínica(s)</label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    padding: '8px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    minHeight: '42px',
                    alignItems: 'center'
                  }}>
                    {selectedSpecialties.map((spec, idx) => (
                      <span key={idx} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--primary-glow)',
                        color: 'var(--primary)',
                        padding: '3px 10px',
                        borderRadius: '16px',
                        fontSize: '11.5px',
                        fontWeight: '600'
                      }}>
                        {spec}
                        <button 
                          type="button" 
                          onClick={() => removeSpecialty(spec)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--primary)', 
                            cursor: 'pointer', 
                            fontWeight: 'bold',
                            padding: 0,
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    <input 
                      type="text"
                      placeholder={selectedSpecialties.length === 0 ? "Pesquise ou digite uma especialidade..." : "Adicionar outra..."}
                      value={specSearch}
                      onChange={(e) => {
                        setSpecSearch(e.target.value);
                        setSpecDropdownOpen(true);
                      }}
                      onFocus={() => setSpecDropdownOpen(true)}
                      style={{
                        flex: '1',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        minWidth: '120px'
                      }}
                    />
                  </div>
                  {specDropdownOpen && (specSearch.trim() || filteredOptions.length > 0) && (
                    <>
                      <div 
                        onClick={() => setSpecDropdownOpen(false)} 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                      />
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 999,
                        boxShadow: 'var(--shadow-md)'
                      }}>
                        {showCustomOption && (
                          <div 
                            onClick={() => addSpecialty(specSearch.trim())}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              color: 'var(--primary)',
                              fontWeight: 'bold',
                              borderBottom: filteredOptions.length > 0 ? '1px solid var(--border-color)' : 'none'
                            }}
                            className="autocomplete-option"
                          >
                            ➕ Adicionar especialidade: "{specSearch.trim()}"
                          </div>
                        )}
                        {filteredOptions.map((opt, idx) => (
                          <div 
                            key={idx}
                            onClick={() => addSpecialty(opt)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '12.5px'
                            }}
                            className="autocomplete-option"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {clinicianType === 'doctor' && (
                <div className="form-group">
                  <label className="form-label">RQE (Registro de Especialidade)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: 12345 (Deixe em branco se não possuir)"
                    value={rqe} 
                    onChange={(e) => setRqe(e.target.value)} 
                  />
                </div>
              )}
            </>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Processando...' : isRegistering ? 'Cadastrar e Criar Ficha' : 'Entrar na Plataforma'}
          </button>
        </form>

        {/* Social Authentication */}
        <div className="social-separator">ou entre com</div>

        <div className="social-login-grid">
          <button 
            type="button" 
            className="social-btn" 
            onClick={() => handleSocialLogin('Google')}
            style={{ width: '100%' }}
          >
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-1.14 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.56-5.17 3.56-8.5z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.89-3.02c-1.08.72-2.45 1.16-4.04 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.11C3.18 21.88 7.39 24 12 24z"/>
              <path fill="#FBBC05" d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.62H1.21C.44 8.16 0 9.88 0 12s.44 3.84 1.21 5.38l4.11-3.11z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.39 0 3.18 2.12 1.21 5.62l4.11 3.11c.94-2.85 3.57-4.98 6.68-4.98z"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
