import React from 'react';

export default function MyNetworkPortal({ setActiveTab }) {
  const cards = [
    {
      id: 'telemedicine',
      title: 'Mensagens e Teleconsulta',
      description: 'Converse via chat de texto ou faça uma chamada de vídeo ao vivo com seu profissional de saúde vinculado.',
      icon: (
        <svg style={{ width: '28px', height: '28px', color: 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      ),
      badge: 'Online 24h',
      target: 'telemedicine'
    },
    {
      id: 'nurses',
      title: 'Encontrar Enfermeiros',
      description: 'Localize enfermeiros estomaterapeutas para visitas domiciliares, realização de curativos e suporte prático.',
      icon: (
        <svg style={{ width: '28px', height: '28px', color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 20c-3.14 0-6.02-1.268-8.125-3.327a4.125 4.125 0 0 1 6.9-4.127 12.306 12.306 0 0 0 5.122 1.306c.71 0 1.38-.086 2.022-.249M15 19.128V19m-4.5-9.128a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM18.75 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
      badge: 'Rede de Enfermagem',
      target: 'nurses'
    },
    {
      id: 'doctors',
      title: 'Médicos Especialistas',
      description: 'Busque cirurgiões vasculares, angiologistas e outros médicos especialistas credenciados para seu caso.',
      icon: (
        <svg style={{ width: '28px', height: '28px', color: 'var(--danger)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0zM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      ),
      badge: 'Corpo Clínico',
      target: 'doctors_directory'
    },
    {
      id: 'guides',
      title: 'Guia de Tratamentos',
      description: 'Consulte informações ilustradas sobre materiais de curativo, cuidados preventivos e cicatrização de lesões.',
      icon: (
        <svg style={{ width: '28px', height: '28px', color: 'var(--success-light)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
      ),
      badge: 'Biblioteca',
      target: 'protocols'
    }
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '4px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>iRec Cuidados Integrados</p>
        <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: '700' }}>Minha Rede de Apoio</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Gerencie contatos, teleconsultas e localize recursos úteis para o seu tratamento.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {cards.map((card) => (
          <div 
            key={card.id} 
            className="glass-card" 
            onClick={() => setActiveTab(card.target)}
            style={{ 
              margin: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              cursor: 'pointer', 
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
              padding: '24px',
              border: '1px solid var(--border-color)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--primary-light)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ 
                  width: '52px', 
                  height: '52px', 
                  borderRadius: '12px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)'
                }}>
                  {card.icon}
                </div>
                <span className="badge badge-success" style={{ fontSize: '10px', padding: '4px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  {card.badge}
                </span>
              </div>
              
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {card.title}
              </h3>
              
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                {card.description}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
              Acessar Área
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
