import React, { useState, useEffect } from 'react';
import { getAllNurses, getAssignedDoctors, followPatient } from '../services/supabaseService';

const getNursePremiumDetails = (doc) => {
  if (!doc) return null;
  const idHash = doc.id ? doc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  
  const specialties = [
    {
      specialty: 'Estomaterapia e Feridas Vasculares',
      bio: 'Enfermeira estomaterapeuta especialista em tratamentos de úlceras de perna crônicas, curativos compressivos e coberturas especiais de alta tecnologia.',
      education: 'Pós-graduação em Enfermagem em Estomaterapia - SOBEST; Especialização em Laserterapia Clínica.',
      price: 130,
      stats: { rating: '4.9', patients: '240+', successRate: '98%' },
      reviews: [
        { patient: 'M. F.', text: 'Excelente atendimento domiciliar! O curativo compressivo que ela realizou aliviou minha dor e ajudou a fechar a ferida.' },
        { patient: 'P. R.', text: 'Super profissional e muito higiênica nas trocas de curativo. Nota 10!' }
      ]
    },
    {
      specialty: 'Pé Diabético e Lesões por Pressão',
      bio: 'Atendimento estomaterápico especializado em offloading, avaliação de neuropatias diabéticas, desbridamento e prevenção de amputações.',
      education: 'Graduação em Enfermagem - UNIFESP; Especialização em Pé Diabético e Cicatrização de Feridas Complexas.',
      price: 145,
      stats: { rating: '4.8', patients: '180+', successRate: '97.2%' },
      reviews: [
        { patient: 'T. O.', text: 'Cuidado exemplar com o pé diabético do meu pai. Evitou uma internação grave.' }
      ]
    },
    {
      specialty: 'Enfermagem Geral & Lesões Cirúrgicas',
      bio: 'Especialista em cuidados pós-operatórios imediatos, retirada de pontos, lavagem estéril e curativos cirúrgicos limpos cotidianos.',
      education: 'Graduação em Enfermagem - USP; Treinamento Avançado em Manejo de Feridas Cirúrgicas e Drenos.',
      price: 110,
      stats: { rating: '4.7', patients: '310+', successRate: '99%' },
      reviews: [
        { patient: 'J. C.', text: 'Pontual, educada e tirou meus pontos com total delicadeza. Recomendo de olhos fechados!' }
      ]
    }
  ];

  const isDemoNurse = doc.email && 
    (doc.email.includes('example.com') || doc.email.includes('demo.com') || doc.email.includes('mock')) && 
    !doc.name?.toLowerCase().includes('teste') && 
    !doc.name?.toLowerCase().includes('test');

  if (!isDemoNurse) {
    return {
      ...doc,
      specialty: doc.specialty || 'Enfermagem Geral',
      bio: doc.bio || 'Enfermeiro(a) cadastrado(a) no iRec.',
      education: doc.education || `Registro Profissional: ${doc.crm || doc.coren || 'Não informado'}`,
      price: doc.consultationFee ? parseFloat(doc.consultationFee) : null,
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
    bio: doc.bio || specProfile.bio,
    education: doc.education || specProfile.education,
    price: doc.consultationFee ? parseFloat(doc.consultationFee) : specProfile.price,
    stats: specProfile.stats,
    reviews: specProfile.reviews
  };
};

export default function NursesNetwork({ currentUser, setActiveTab, setTelemedicineContactId }) {
  const [allNurses, setAllNurses] = useState([]);
  const [assignedNurses, setAssignedNurses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const nursesList = await getAllNurses();
        setAllNurses(nursesList || []);
        
        if (currentUser) {
          const assigned = await getAssignedDoctors(currentUser.id);
          setAssignedNurses(assigned || []);
        }
      } catch (e) {
        console.error('Error loading nurses directory data:', e);
      }
    }
    loadData();
  }, [currentUser, refreshTrigger]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto', position: 'relative', height: '100%', minHeight: 'calc(100vh - 60px)', backgroundColor: 'var(--bg-primary)', fontFamily: 'var(--font-primary)' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      
      <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          🔍 Rede de Enfermagem
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Encontre enfermeiros estomaterapeutas especializados em feridas, agende visitas e inicie tratamentos supervisionados.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por nome do enfermeiro..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '240px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
        />
        <select
          value={filterSpecialty}
          onChange={e => setFilterSpecialty(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">Todas as Especialidades</option>
          <option value="Estomaterapia">Estomaterapia</option>
          <option value="Pé Diabético">Pé Diabético</option>
          <option value="Geral">Enfermagem Geral</option>
        </select>
      </div>

      {/* Grid View of Nurses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {allNurses
          .map(doc => getNursePremiumDetails(doc))
          .filter(doc => {
            const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesSpecialty = filterSpecialty === 'all' || doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase());
            return matchesSearch && matchesSpecialty;
          })
          .map(doc => {
            const isAlreadyAssigned = assignedNurses.some(c => c.id === doc.id);
            const docInitials = doc.name ? doc.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EN';
            
            return (
              <div 
                key={doc.id} 
                onClick={() => setSelectedNurse(doc)}
                className="glass-card" 
                style={{ 
                  padding: '22px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  gap: '14px', 
                  margin: 0,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                {/* Upper Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-glow)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '17px',
                      fontWeight: '700',
                      flexShrink: 0
                    }}>
                      {docInitials}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{doc.name}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🩺 {doc.specialty}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '10px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '20px', fontWeight: '700' }}>
                      ⭐ {doc.stats.rating}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {doc.stats.patients} atendimentos
                    </span>
                  </div>
                </div>

                {/* Brief bio description */}
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {doc.bio}
                </p>

                {/* Price Display */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Visita Domiciliar:</span>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>
                    {doc.price ? `R$ ${doc.price.toFixed(2)}` : 'Sob Consulta'}
                  </span>
                </div>

                {/* Footnotes */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', paddingTop: '4px' }}>
                  <span>COREN: {doc.crm || 'Dispensado'}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Ver Perfil Clínico →
                  </span>
                </div>
              </div>
            );
          })}
        {allNurses.filter(doc => {
          const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesSpecialty = filterSpecialty === 'all' || doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase());
          return matchesSearch && matchesSpecialty;
        }).length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Nenhum enfermeiro disponível para os filtros aplicados.
          </div>
        )}
      </div>

      {/* Clinical Profile Drawer Overlay */}
      {selectedNurse && (() => {
        const doc = selectedNurse;
        const isAlreadyAssigned = assignedNurses.some(c => c.id === doc.id);
        const docInitials = doc.name ? doc.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EN';

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{
              width: '90%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-secondary)',
              maxHeight: '90vh',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden'
            }}>
              {/* Drawer Header */}
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Perfil do Enfermeiro</h3>
                <button
                  type="button"
                  onClick={() => setSelectedNurse(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    lineHeight: 1
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header Profile Section */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-glow)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: '700',
                    position: 'relative'
                  }}>
                    {docInitials}
                    <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid var(--bg-secondary)', boxShadow: '0 0 8px #10b981' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>{doc.name}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700', margin: '2px 0 0 0' }}>
                      🎓 {doc.specialty}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      COREN: {doc.crm || 'Dispensado'}
                    </p>
                  </div>
                </div>

                {/* Quick Performance Indicators */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Pontuação</p>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', margin: '4px 0 0 0' }}>⭐ {doc.stats.rating}</p>
                  </div>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Atendimentos</p>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>{doc.stats.patients}</p>
                  </div>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Taxa de Sucesso</p>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', margin: '4px 0 0 0' }}>{doc.stats.successRate}</p>
                  </div>
                </div>

                {/* Consultation Fee Section */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: 'var(--primary-glow)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(16, 185, 129, 0.1)'
                }}>
                  <span style={{ fontSize: '18px' }}>🏷️</span>
                  <div>
                    <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: '750', letterSpacing: '0.3px' }}>
                      Valor do Procedimento Domiciliar
                    </p>
                    <p style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--primary)', margin: '2px 0 0 0' }}>
                      {doc.price ? `R$ ${doc.price.toFixed(2)}` : 'Sob Consulta'}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <h5 style={{ fontSize: '11px', fontWeight: '750', margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Sobre o Profissional</h5>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    {doc.bio}
                  </p>
                </div>

                {/* Education */}
                <div>
                  <h5 style={{ fontSize: '11px', fontWeight: '750', margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Formação e Especializações</h5>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                    📚 {doc.education}
                  </p>
                </div>

                {/* Testimonials */}
                <div>
                  <h5 style={{ fontSize: '11px', fontWeight: '750', margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Depoimentos de Pacientes</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {doc.reviews.length > 0 ? (
                      doc.reviews.map((rev, index) => (
                        <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <p style={{ fontSize: '11px', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>👤 Paciente {rev.patient}</p>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: '1.4' }}>
                            "{rev.text}"
                          </p>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', border: '1px dashed var(--border-color)', borderRadius: '12px', fontStyle: 'italic' }}>
                        Este profissional ainda não possui depoimentos ou avaliações cadastradas.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                {isAlreadyAssigned ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTelemedicineContactId(doc.id);
                      setActiveTab('telemedicine');
                      setSelectedNurse(null);
                    }}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '13px' }}
                  >
                    💬 Enviar Mensagem no Chat
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await followPatient(doc.id, currentUser.id);
                        setRefreshTrigger(prev => prev + 1);
                        setSelectedNurse(null);
                        setTelemedicineContactId(doc.id);
                        setActiveTab('telemedicine');
                      } catch (err) {
                        console.error('Error establishing connection:', err);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '13px' }}
                  >
                    ➕ Iniciar Acompanhamento Clínico
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
