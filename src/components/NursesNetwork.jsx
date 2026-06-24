import React, { useState, useEffect } from 'react';
import { getAllNurses, getLocalHealthcareResources } from '../services/supabaseService';
import LocalResourcesPanel from './LocalResourcesPanel';

export default function NursesNetwork({ clinicalProfile }) {
  const [schedules, setSchedules] = useState([
    {
      id: 1,
      nurseName: 'Enf. Mariana Souza',
      specialty: 'Especialista em Úlceras Vasculares',
      date: 'Hoje',
      time: '16:00',
      status: 'Confirmado',
      avatar: 'MS'
    }
  ]);

  const [selectedNurse, setSelectedNurse] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [serviceMode, setServiceMode] = useState('presencial'); // 'presencial' or 'online'

  // Chat Simulator State
  const [activeChatNurse, setActiveChatNurse] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const [dynamicNurses, setDynamicNurses] = useState([]);
  const [loadingNurses, setLoadingNurses] = useState(false);

  // Fetch real nurses on mount
  useEffect(() => {
    async function loadNurses() {
      setLoadingNurses(true);
      try {
        const fetched = await getAllNurses();
        const mapped = fetched.map(n => ({
          id: n.id,
          name: `Enf. ${n.name}`,
          specialty: n.specialty === 'Estomaterapia' ? 'Especialista em Estomaterapia e Feridas' : n.specialty,
          rating: 5.0,
          reviews: 1,
          distance: n.city ? `Próximo (${n.city}/${n.state})` : 'Próximo a você',
          price: 'R$ 135,00',
          avatar: n.name ? n.name.split(' ').filter(Boolean).map(x => x[0]).join('').substring(0, 2).toUpperCase() : 'EF',
          avatarUrl: n.avatarUrl,
          about: `Profissional de enfermagem cadastrado no iRec. COREN: ${n.crm || 'Não cadastrado'}. Especialidade: ${n.specialty}. Telefone de contato: ${n.phone || 'Não informado'}.`
        }));
        setDynamicNurses(mapped);
      } catch (err) {
        console.warn("Erro ao buscar enfermeiros reais:", err);
      } finally {
        setLoadingNurses(false);
      }
    }
    loadNurses();
  }, []);

  // Mock database of nearby nurses
  const nurses = [
    {
      id: 1,
      name: 'Enf. Mariana Souza',
      specialty: 'Especialista em Estomaterapia e Feridas Vasculares',
      rating: 4.9,
      reviews: 48,
      distance: '2.4 km',
      price: 'R$ 130,00',
      avatar: 'MS',
      about: 'Enfermeira estomaterapeuta com 8 anos de experiência em tratamentos de úlceras de perna crônicas e curativos compressivos.'
    },
    {
      id: 2,
      name: 'Enf. Carlos Henrique Silva',
      specialty: 'Especialista em Pé Diabético e Lesões por Pressão',
      rating: 4.8,
      reviews: 32,
      distance: '4.1 km',
      price: 'R$ 145,00',
      avatar: 'CS',
      about: 'Atendimento domiciliar focado em offloading, avaliação neurológica periférica e curativos especiais para pés diabéticos.'
    },
    {
      id: 3,
      name: 'Enf. Ana Beatriz Costa',
      specialty: 'Enfermagem Geral & Lesões Cirúrgicas',
      rating: 4.7,
      reviews: 19,
      distance: '5.8 km',
      price: 'R$ 110,00',
      avatar: 'AC',
      about: 'Especialista em cuidados pós-operatórios, retiradas de pontos e curativos limpos cotidianos.'
    }
  ];

  // Dynamic resource generator for hospital and pharmacy fallback
  const localResources = getLocalHealthcareResources(clinicalProfile?.city, clinicalProfile?.state);

  // Filter nurses based on serviceMode and location
  const allNursesList = [...dynamicNurses, ...nurses];
  const filteredNurses = allNursesList.filter(nurse => {
    if (serviceMode === 'online') {
      return true; // Teleconsultation is national, show all
    }

    // In-person visit: must match patient's city and state
    const patientCity = (clinicalProfile?.city || '').trim().toLowerCase();
    const patientState = (clinicalProfile?.state || '').trim().toLowerCase();

    if (typeof nurse.id === 'number') {
      // Mock nurses are simulated to be in São Paulo
      return patientCity === 'são paulo' || patientCity === 'sao paulo' || patientState === 'sp';
    }

    // Real nurse
    const nurseCity = (nurse.city || '').trim().toLowerCase();
    const nurseState = (nurse.state || '').trim().toLowerCase();
    return nurseCity === patientCity && nurseState === patientState;
  });

  const handleOpenSchedule = (nurse) => {
    setSelectedNurse(nurse);
    setScheduleDate(new Date().toLocaleDateString('pt-BR'));
    setScheduleTime('14:00');
  };

  const handleConfirmSchedule = () => {
    if (!scheduleDate || !scheduleTime) {
      alert("Por favor, selecione data e horário.");
      return;
    }

    setIsScheduling(true);

    setTimeout(() => {
      setIsScheduling(false);
      
      const newSchedule = {
        id: schedules.length + 1,
        nurseName: selectedNurse.name,
        specialty: selectedNurse.specialty,
        date: scheduleDate,
        time: scheduleTime,
        status: 'Pendente (Aprovação Médica)',
        avatar: selectedNurse.avatar
      };

      setSchedules((prev) => [...prev, newSchedule]);
      setSelectedNurse(null);
      
      alert(`VISITA AGENDADA COM SUCESSO!\n\nProfissional: ${newSchedule.nurseName}\nData: ${newSchedule.date} às ${newSchedule.time}\n\nO pagamento de ${selectedNurse.price} foi processado. A visita domiciliar aguarda liberação do médico regulador.`);
    }, 2000);
  };

  const handleOpenChat = (sch) => {
    const firstName = clinicalProfile?.name ? clinicalProfile.name.split(' ')[0] : 'Paciente';
    setActiveChatNurse(sch);
    setChatMessages([
      {
        id: 1,
        sender: 'nurse',
        text: `Olá ${firstName}! Aqui é a ${sch.nurseName}. Vi que agendou uma visita para ${sch.date} às ${sch.time}. Tem alguma dúvida clínica ou sobre o atendimento?`,
        time: 'Agora'
      }
    ]);
  };

  const handleSendChatMessage = (text) => {
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'patient',
      text: text,
      time: 'Agora'
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulate nurse reply
    setTimeout(() => {
      let nurseReply = '';
      const cleanInput = text.toLowerCase();

      if (cleanInput.includes('material') || cleanInput.includes('insumo') || cleanInput.includes('comprar')) {
        nurseReply = 'Não se preocupe! Eu levo todos os insumos estéreis (como gazes de rayon, hidrogel e coberturas especiais) na minha maleta. Peço apenas que tenha soro fisiológico morno em casa!';
      } else if (cleanInput.includes('ferida') || cleanInput.includes('foto') || cleanInput.includes('estado')) {
        nurseReply = 'Sim, acessei a foto que você enviou na triagem do app. O progresso está ótimo, sem sinais de infecção visíveis. Faremos a limpeza e o curativo recomendado no horário marcado!';
      } else if (cleanInput.includes('estacion') || cleanInput.includes('carro') || cleanInput.includes('parar')) {
        nurseReply = 'Excelente informação! Estacionamento fácil ajuda muito. Chegarei pontualmente.';
      } else {
        nurseReply = 'Certo, entendi! Vou registrar isso na ficha de atendimento. Se precisar de algo mais antes de eu chegar, pode me mandar mensagem por aqui.';
      }

      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'nurse',
        text: nurseReply,
        time: 'Agora'
      }]);
    }, 1200);
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '18px' }}>
        Rede de Enfermagem Domiciliar
      </h2>

      {/* CHAT WINDOW INTERACTIVE SIMULATOR */}
      {activeChatNurse ? (
        <div className="glass-card animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '360px', margin: 0 }}>
          {/* Chat Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justify: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                {activeChatNurse.avatar}
              </div>
              <div>
                <h4 style={{ fontSize: '13.5px', fontWeight: '700' }}>{activeChatNurse.nurseName}</h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{activeChatNurse.specialty}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveChatNurse(null)}
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: '11px', height: 'auto', borderRadius: '6px' }}
            >
              Voltar
            </button>
          </div>

          {/* Chat messages */}
          <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', marginBottom: '12px' }}>
            {chatMessages.map(msg => (
              <div 
                key={msg.id} 
                style={{ 
                  alignSelf: msg.sender === 'patient' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'patient' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{ 
                  backgroundColor: msg.sender === 'patient' ? 'var(--primary)' : 'var(--bg-primary)',
                  color: msg.sender === 'patient' ? '#ffffff' : 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12.5px',
                  lineHeight: '1.4',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {msg.text}
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Quick replies */}
          {chatMessages.length === 1 && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', flexShrink: 0 }}>
              {['Preciso comprar algum material antes?', 'Como está a minha ferida hoje?', 'O local tem fácil estacionamento.'].map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChatMessage(sug)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input text form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage(chatInput);
            }}
            style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}
          >
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Digite sua mensagem para o enfermeiro..."
              style={{ flex: '1', padding: '8px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: 'var(--bg-secondary)' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '20px' }}>
              Enviar
            </button>
          </form>
        </div>
      ) : (
        /* STANDARD VIEW */
        <>
          {/* Service Mode Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setServiceMode('presencial')}
              className={`btn ${serviceMode === 'presencial' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '20px', flex: 1 }}
            >
              📍 Visita Domiciliar (Presencial)
            </button>
            <button
              type="button"
              onClick={() => setServiceMode('online')}
              className={`btn ${serviceMode === 'online' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '20px', flex: 1 }}
            >
              💻 Teleenfermagem (Online 24h)
            </button>
          </div>

          {/* 1. SCHEDULE LIST PANEL */}
          <h3 style={{ fontSize: '14.5px', fontWeight: '700', marginBottom: '10px' }}>Suas Visitas Agendadas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {schedules.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                Nenhuma visita agendada no momento.
              </div>
            ) : (
              schedules.map((sch) => (
                <div key={sch.id} className="glass-card" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center', margin: 0 }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    backgroundColor: sch.status.includes('Confirmado') ? 'var(--primary)' : 'var(--accent)', 
                    color: '#ffffff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}>
                    {sch.avatar}
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4 style={{ fontSize: '13.5px', fontWeight: '700' }}>{sch.nurseName}</h4>
                      <span className="badge" style={{ 
                        backgroundColor: sch.status.includes('Confirmado') ? 'var(--success-glow)' : 'rgba(56, 161, 219, 0.1)', 
                        color: sch.status.includes('Confirmado') ? 'var(--success-light)' : '#38a1db',
                        fontSize: '9px',
                        padding: '2px 8px'
                      }}>
                        {sch.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sch.specialty}</p>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Agenda: {sch.date} às {sch.time}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleOpenChat(sch)}
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '11px', height: 'auto', borderRadius: '8px' }}
                  >
                    Conversar
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 2. FIND NURSES LIST */}
          {!selectedNurse && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: '14.5px', fontWeight: '700', marginBottom: '10px' }}>
                {serviceMode === 'online' ? 'Todos os Enfermeiros Online (Teleconsulta)' : `Profissionais de Visita Domiciliar em ${clinicalProfile?.city || 'sua região'}`} {loadingNurses && '(Carregando...)'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredNurses.length > 0 ? (
                  filteredNurses.map((nurse) => (
                    <div key={nurse.id} className="glass-card" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ 
                          width: '42px', 
                          height: '42px', 
                          borderRadius: '50%', 
                          backgroundColor: 'var(--border-color)', 
                          color: 'var(--primary)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '15px',
                          border: '2px solid var(--primary)',
                          flexShrink: 0,
                          overflow: 'hidden'
                        }}>
                          {nurse.avatarUrl ? (
                            <img src={nurse.avatarUrl} alt={nurse.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            nurse.avatar
                          )}
                        </div>
                        <div style={{ flex: '1' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: '700' }}>{nurse.name}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>{nurse.specialty}</p>
                          
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--warning)', fontWeight: '700' }}>
                              ★ {nurse.rating}
                            </span>
                            <span>({nurse.reviews} avaliações)</span>
                            <span>•</span>
                            <span>{nurse.distance}</span>
                          </div>
                        </div>
                      </div>
                      
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                        {nurse.about}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                        <div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor da Visita / Consulta</span>
                          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{nurse.price}</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => handleOpenSchedule(nurse)} style={{ padding: '8px 14px', fontSize: '11.5px' }}>
                          {serviceMode === 'online' ? 'Iniciar Consulta' : 'Agendar Visita'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback emergency healthcare resources when no nurses in region */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ 
                      padding: '16px', 
                      backgroundColor: 'rgba(239, 68, 68, 0.04)', 
                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)'
                    }}>
                      <h4 style={{ color: 'var(--danger)', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        ⚠️ Aviso de Cobertura Física
                      </h4>
                      <p style={{ fontSize: '13px', margin: 0, lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                        Não encontramos enfermeiros credenciados para visitas domiciliares presenciais na sua cidade (<strong>{clinicalProfile?.city || 'Não informada'}/{clinicalProfile?.state || 'UF'}</strong>) no momento.
                      </p>
                      <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-muted)' }}>
                        Você ainda pode realizar consultas virtuais na aba <strong>Teleenfermagem (Online)</strong> acima. Em caso de necessidade física urgente, use nosso mapa dinâmico abaixo para localizar hospitais e farmácias próximos com rotas integradas:
                      </p>
                    </div>

                    <LocalResourcesPanel clinicalProfile={clinicalProfile} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. INTERACTIVE SCHEDULING FORM */}
          {selectedNurse && (
            <div className="glass-card animate-fade-in" style={{ borderColor: 'var(--primary-light)', margin: 0 }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>
                Agendar com {selectedNurse.name}
              </h3>

              {isScheduling ? (
                <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                  <div style={{
                    display: 'inline-block',
                    width: '32px',
                    height: '32px',
                    border: '3px solid var(--border-color)',
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '12px'
                  }}></div>
                  <h4 style={{ fontWeight: '700', fontSize: '14px' }}>Processando Pagamento...</h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Transação criptografada de forma segura.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Data da Visita
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: 21/06/2026" 
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '8px 12px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: 'var(--bg-primary)',
                          fontWeight: '600',
                          fontSize: '12px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Horário da Visita
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: 14:00" 
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '8px 12px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: 'var(--bg-primary)',
                          fontWeight: '600',
                          fontSize: '12px'
                        }}
                      />
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Valor Total:</span>
                      <strong style={{ fontSize: '14.5px', color: 'var(--primary)' }}>{selectedNurse.price}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setSelectedNurse(null)} style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                      Cancelar
                    </button>
                    <button className="btn btn-primary" onClick={handleConfirmSchedule} style={{ flex: 1.5, padding: '8px', fontSize: '12px' }}>
                      Confirmar e Pagar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
