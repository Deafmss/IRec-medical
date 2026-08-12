import { 
  Video, Camera, MapPin, ChevronRight, 
  PhoneCall, ShieldCheck
} from 'lucide-react';

/**
 * iREC PACIENTE - DESIGN INTUITIVO, LIMPO E ACOLHEDOR
 * Diretriz: Zero confusão para o paciente. Visual bonito, elegante e ultra-simples.
 */

export function IRecConceptDesign() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B132B',
      color: '#F8FAFC',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      padding: '16px 16px 80px 16px',
      maxWidth: '600px', // Otimizado para celular / leitura focada
      margin: '0 auto'
    }}>
      
      {/* 1. TOPO DA TELA - BOAS VINDAS SIMPLES E ACOLHEDOR */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0 20px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: '#1E40AF',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.1rem'
          }}>
            MS
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Bem-vinda de volta,</div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>
              Maria Silva
            </h1>
          </div>
        </div>

        <span style={{
          fontSize: '0.75rem',
          color: '#34D399',
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
          padding: '6px 12px',
          borderRadius: '999px',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          fontWeight: 600
        }}>
          ● Tratamento Ativo
        </span>
      </header>

      {/* 2. CARD PRINCIPAL - PRÓXIMO PASSO DO PACIENTE (Zero Dúvida) */}
      <section style={{ margin: '20px 0' }}>
        <div style={{
          backgroundColor: '#1C2541',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#60A5FA',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px'
          }}>
            Sua Próxima Consulta
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
            Hoje às 14:30
          </h2>
          
          <p style={{ fontSize: '0.9rem', color: '#CBD5E1', marginBottom: '20px', lineHeight: '1.5' }}>
            Consulta de retorno por vídeo com <strong>Dr. Carlos Eduardo</strong> (Dermatologia).
          </p>

          <button style={{
            width: '100%',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '14px',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)'
          }}>
            <Video style={{ width: 20, height: 20 }} />
            <span>Entrar na Consulta por Vídeo</span>
          </button>
        </div>
      </section>

      {/* 3. ATALHOS RÁPIDOS E INTUITIVOS (Apenas 3 Opções Claras) */}
      <section style={{ margin: '24px 0' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94A3B8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          O que você precisa fazer agora?
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Opção 1: Enviar Foto da Ferida */}
          <div style={{
            backgroundColor: '#151D33',
            borderRadius: '16px',
            padding: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Camera style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Enviar Foto da Ferida
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Para o médico avaliar a evolução
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: 20, height: 20, color: '#64748B' }} />
          </div>

          {/* Opção 2: Como Fazer o Curativo */}
          <div style={{
            backgroundColor: '#151D33',
            borderRadius: '16px',
            padding: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#60A5FA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Passo a Passo do Curativo
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Ver instruções simples de troca
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: 20, height: 20, color: '#64748B' }} />
          </div>

          {/* Opção 3: Farmácia Próxima */}
          <div style={{
            backgroundColor: '#151D33',
            borderRadius: '16px',
            padding: '18px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#FBBF24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MapPin style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Retirar Remédios / Curativos
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Farmácia credenciada a 450m
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: 20, height: 20, color: '#64748B' }} />
          </div>

        </div>
      </section>

      {/* 4. BOTÃO DE EMERGÊNCIA FÁCIL */}
      <div style={{
        marginTop: '28px',
        padding: '16px',
        borderRadius: '16px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FCA5A5' }}>Precisa de ajuda urgente?</div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Fale com a enfermagem 24 horas</div>
        </div>
        <button style={{
          backgroundColor: '#EF4444',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <PhoneCall style={{ width: 14, height: 14 }} />
          <span>Ligar Agora</span>
        </button>
      </div>

    </div>
  );
}
