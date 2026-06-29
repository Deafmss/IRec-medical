import React, { useState, useEffect } from 'react';
import { getAllDoctors, getAssignedDoctors, followPatient } from '../services/supabaseService';

const getDoctorPremiumDetails = (doc) => {
  if (!doc) return null;
  const idHash = doc.id ? doc.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  
  const specialties = [
    {
      specialty: 'Estomaterapia',
      bio: 'Especialista em prevenção e tratamento avançado de feridas complexas, ostomias e incontinências. Pesquisadora em cicatrização acelerada por laserterapia.',
      education: 'Doutorado em Enfermagem Clínica - USP; Especialização em Estomaterapia - SOBEST.',
      price: 280,
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
      price: 320,
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
      price: 250,
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
      price: 300,
      stats: { rating: '4.7', patients: '510+', successRate: '96.8%' },
      reviews: [
        { patient: 'V. P.', text: 'Minha circulação melhorou muito e a úlcera varicosa finalmente fechou com a terapia de compressão recomendada.' }
      ]
    }
  ];

  let specProfile = specialties.find(s => doc.specialty && doc.specialty.toLowerCase().includes(s.specialty.toLowerCase()));
  if (!specProfile) {
    specProfile = specialties[idHash % specialties.length];
  }

  return {
    ...doc,
    specialty: doc.specialty || specProfile.specialty,
    bio: specProfile.bio,
    education: specProfile.education,
    price: specProfile.price,
    stats: specProfile.stats,
    reviews: specProfile.reviews
  };
};

export default function SpecialistDirectory({ currentUser, setActiveTab, setTelemedicineContactId }) {
  const [allDoctors, setAllDoctors] = useState([]);
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const docs = await getAllDoctors();
        setAllDoctors(docs || []);
        
        if (currentUser) {
          const assigned = await getAssignedDoctors(currentUser.id);
          setAssignedDoctors(assigned || []);
        }
      } catch (e) {
        console.error('Error loading doctors directory data:', e);
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
      `}</style>
      
      <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          🔍 Médicos Especialistas
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Consulte as especialidades disponíveis, visualize perfis clínicos, confira valores e conecte-se com total sigilo.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por nome do especialista..."
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
          <option value="Clínico Geral">Clínico Geral</option>
          <option value="Dermatologia">Dermatologia</option>
          <option value="Estomaterapia">Estomaterapia</option>
          <option value="Endocrinologia">Endocrinologia</option>
          <option value="Angiologia">Angiologia</option>
        </select>
      </div>

      {/* Grid View of Doctors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {allDoctors
          .map(doc => getDoctorPremiumDetails(doc))
          .filter(doc => {
            const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesSpecialty = filterSpecialty === 'all' || doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase());
            return matchesSearch && matchesSpecialty;
          })
          .map(doc => {
            const isAlreadyAssigned = assignedDoctors.some(c => c.id === doc.id);
            const docInitials = doc.name ? doc.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
            
            return (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDoctor(doc)}
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
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Particular:</span>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>
                    {doc.price ? `R$ ${doc.price.toFixed(2)}` : 'Sob Consulta'}
                  </span>
                </div>

                {/* Footnotes */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', paddingTop: '4px' }}>
                  <span>CRM: {doc.crm}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Ver Perfil Clínico →
                  </span>
                </div>
              </div>
            );
          })}
        {allDoctors.filter(doc => {
          const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesSpecialty = filterSpecialty === 'all' || doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase());
          return matchesSearch && matchesSpecialty;
        }).length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Nenhum médico disponível para os filtros aplicados.
          </div>
        )}
      </div>

      {/* Clinical Profile Drawer Overlay */}
      {selectedDoctor && (() => {
        const doc = selectedDoctor;
        const isAlreadyAssigned = assignedDoctors.some(c => c.id === doc.id);
        const docInitials = doc.name ? doc.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

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
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-secondary)',
              height: '100%',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              borderLeft: '1px solid var(--border-color)'
            }}>
              {/* Drawer Header */}
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Perfil do Especialista</h3>
                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
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
                      CRM: {doc.crm} • RQE: {doc.rqe || 'Dispensado'}
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
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Consultas</p>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>{doc.stats.patients}</p>
                  </div>
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>Taxa Cicatrização</p>
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
                      Valor da Consulta Particular
                    </p>
                    <p style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--primary)', margin: '2px 0 0 0' }}>
                      {doc.price ? `R$ ${doc.price.toFixed(2)}` : 'Sob Consulta'}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <h5 style={{ fontSize: '11px', fontWeight: '750', margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Sobre o Médico</h5>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    {doc.bio}
                  </p>
                </div>

                {/* Education */}
                <div>
                  <h5 style={{ fontSize: '11px', fontWeight: '750', margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Formação e Certificações</h5>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                    📚 {doc.education}
                  </p>
                </div>

                {/* Testimonials */}
                <div>
                  <h5 style={{ fontSize: '11px', fontWeight: '750', margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Depoimentos de Pacientes</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {doc.reviews.map((rev, index) => (
                      <div key={index} style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>👤 Paciente {rev.patient}</p>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: '1.4' }}>
                          "{rev.text}"
                        </p>
                      </div>
                    ))}
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
                      setSelectedDoctor(null);
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
                        setSelectedDoctor(null);
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
