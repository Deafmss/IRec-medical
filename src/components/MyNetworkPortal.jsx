export default function MyNetworkPortal({ currentUser, setActiveTab }) {
  const isClinician = currentUser?.role === 'doctor' || currentUser?.role === 'nurse';

  if (isClinician) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
        <div className="glass-card glass-card-cyan-glow" style={{ padding: '32px 24px', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '48px', margin: 0 }}>🩺</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Área Exclusiva de Pacientes
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.55', margin: 0 }}>
            O portal da rede de apoio ao tratamento é voltado para pacientes. Como profissional de saúde credenciado, gerencie seus atendimentos em <strong>Minhas Parcerias</strong>.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab && setActiveTab('doctor-partners')}
            style={{
              padding: '12px 24px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              marginTop: '8px'
            }}
          >
            Ir para Minhas Parcerias Clínicas
          </button>
        </div>
      </div>
    );
  }
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
      <div className="glass-card-cyan-glow" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '13px', color: '#0284c7', fontWeight: '800', margin: 0 }}>iRec CUIDADOS INTEGRADOS</p>
        <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: '800', margin: '4px 0 0 0' }}>Minha Rede de Apoio</h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: '4px 0 0 0' }}>
          Gerencie contatos, teleconsultas e localize recursos úteis para o seu tratamento com suporte contínuo iRec.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {cards.map((card) => (
          <div 
            key={card.id} 
            className="glass-card glass-card-cyan-glow" 
            onClick={() => setActiveTab(card.target)}
            style={{ 
              margin: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              cursor: 'pointer', 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
              padding: '24px',
              borderRadius: '20px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ 
                  width: '54px', 
                  height: '54px', 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(14, 165, 233, 0.08) 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
                }}>
                  {card.icon}
                </div>
                <span style={{ fontSize: '10.5px', padding: '4px 12px', backgroundColor: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)', color: '#0284c7', fontWeight: '800', borderRadius: '50px' }}>
                  {card.badge}
                </span>
              </div>
              
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                {card.title}
              </h3>
              
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.55', marginBottom: '20px' }}>
                {card.description}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800', color: '#0284c7' }}>
              <span>Acessar Módulo</span>
              <span>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
