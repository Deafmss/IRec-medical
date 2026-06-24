import React, { useState, useEffect } from 'react';
import { getLocalHealthcareResources } from '../services/supabaseService';
import { generatePersonalizedProtocol, isGeminiConfigured } from '../services/geminiService';

// Client-side rule-based fallback generator in case Gemini fails or is offline
function generateSimulatedPersonalizedProtocol(clinicalProfile, latestWoundEntry) {
  const woundType = latestWoundEntry?.type || (clinicalProfile.hasDiabetes ? 'Pé Diabético' : clinicalProfile.hasVenousInsufficiency ? 'Úlcera Venosa' : 'Lesão Cutânea');
  
  const title = `Guia Clínico Personalizado: ${woundType} com ${
    [
      clinicalProfile.hasDiabetes ? 'Diabetes' : null,
      clinicalProfile.hasHypertension ? 'Hipertensão' : null,
      clinicalProfile.hasVenousInsufficiency ? 'Insuficiência Venosa' : null,
      clinicalProfile.hasPeripheralArterialDisease ? 'Doença Arterial Periférica' : null,
      clinicalProfile.isSmoker ? 'Tabagismo' : null
    ].filter(Boolean).join(' + ') || 'Cuidados Gerais'
  }`;

  const description = `Este guia de curativo e autocuidado foi gerado dinamicamente para ${clinicalProfile.name} cruzando a lesão ativa (${woundType}) com seu histórico de comorbidades. Instruções baseadas nos Manuais de Condutas do Ministério da Saúde e Diretrizes de Enfermagem (COFEN).`;

  const steps = [
    { 
      title: 'Limpeza e Higienização do Leito', 
      desc: 'Irrigar suavemente a lesão com soro fisiológico 0.9% morno em jato leve. Evitar fricção excessiva com gaze para proteger o tecido de granulação recém-formado e reduzir a dor.' 
    }
  ];

  const necrose = latestWoundEntry?.aiTissueAnalysis?.necrose || 0;
  const fibrina = latestWoundEntry?.aiTissueAnalysis?.fibrina || 0;

  if (necrose > 0) {
    steps.push({
      title: 'Desbridamento de Tecido Necrótico (Preto)',
      desc: 'Aplicar Hidrogel Amorfo com Alginato no leito da lesão para promover o desbridamento autolítico seguro da necrose. Proteger as bordas com Creme Barreira.'
    });
  } else if (fibrina > 0) {
    steps.push({
      title: 'Remoção de Esfacelos (Tecido Amarelo)',
      desc: 'Aplicar curativo de Alginato de Cálcio se houver exsudato moderado ou alto. O alginato se transforma em gel ao absorver a secreção, ajudando a limpar o leito.'
    });
  } else {
    steps.push({
      title: 'Proteção e Estímulo da Granulação (Vermelho)',
      desc: 'Aplicar Óleo AGE (Ácidos Graxos Essenciais / Dersani) ou cobertura de Espuma de Poliuretano para manter a umidade ideal e acelerar a epitelização.'
    });
  }

  if (clinicalProfile.hasDiabetes) {
    steps.push({
      title: 'Inspeção Diária Rigorosa (Pé Diabético)',
      desc: 'Inspecionar a sola do pé e espaços interdigitais com o auxílio de um espelho. Secar meticulosamente os dedos após o banho para evitar frieiras.'
    });
    steps.push({
      title: 'Alívio Total de Carga (Offloading)',
      desc: 'Evitar apoiar o peso do corpo sobre o ferimento. Usar calçados de descarga, palmilhas especiais ou muletas conforme orientação médica.'
    });
  }

  if (clinicalProfile.hasVenousInsufficiency) {
    steps.push({
      title: 'Terapia Compressiva e Elevação',
      desc: 'Calçar a meia elástica de compressão pela manhã (sob indicação médica) e realizar repouso com as pernas elevadas acima da linha do coração por 30 minutos, 3x ao dia.'
    });
  }

  if (clinicalProfile.hasHypertension) {
    steps.push({
      title: 'Controle de Pressão e Dieta Saudável',
      desc: 'Registrar a pressão arterial diariamente. Seguir dieta hipossódica restrita em sódio para evitar o inchaço nos membros inferiores.'
    });
  }

  const materials = [];
  if (necrose > 0 || fibrina > 0) {
    materials.push({ name: 'Hidrogel Amorfo com Alginato (85g)', price: 'R$ 42,90', brand: 'Curatec' });
    materials.push({ name: 'Placa de Alginato de Cálcio (10x10cm)', price: 'R$ 28,50', brand: 'Curatec' });
  } else {
    materials.push({ name: 'Curativo Hidrocolóide Extra Fino (10x10cm)', price: 'R$ 18,90', brand: 'DuoDerm' });
  }
  materials.push({ name: 'Solução Antisséptica de PHMB (350ml)', price: 'R$ 62,00', brand: 'Prontosan' });
  materials.push({ name: 'Óleo Dersani AGE (100ml)', price: 'R$ 38,90', brand: 'Dersani' });

  const scientificBacking = 'Resolução COFEN nº 567/2018 (Diretrizes para o tratamento de feridas por enfermeiros) • Manual de Condutas para Tratamento de Feridas do Ministério da Saúde, Brasil, 2016.';
  const specialistRecommendation = 'Necessário acompanhamento multidisciplinar: Cirurgião Vascular para avaliação de pulso/edema e Endocrinologista para controle do alvo glicêmico (HbA1c < 7.0%).';

  return {
    title,
    description,
    steps,
    materials,
    scientificBacking,
    specialistRecommendation
  };
}

export default function ProtocolGuide({ clinicalProfile, entries = [] }) {
  const [activeTab, setActiveTab] = useState('ai-protocol');
  const [loading, setLoading] = useState(false);
  const [aiProtocol, setAiProtocol] = useState(null);
  const [error, setError] = useState('');
  const [selectedStaticProtocol, setSelectedStaticProtocol] = useState('venosa');

  const latestWoundEntry = entries && entries.length > 0 ? entries[entries.length - 1] : null;

  // Static reference protocols (standard fallback/baseline)
  const staticProtocols = {
    venosa: {
      title: 'Úlcera Venosa (Padrão)',
      description: 'Lesões causadas por insuficiência venosa crônica. O foco principal é o controle de exsudato e a terapia compressiva após a cicatrização inicial.',
      steps: [
        { title: 'Higienização', desc: 'Lavar a lesão abundantemente com soro fisiológico morno 0.9% ou solução PHMB em jato suave para preservar o tecido novo de granulação.' },
        { title: 'Remoção de Tecido Inviável', desc: 'Se houver esfacelos (camada amarelada), aplicar Hidrogel Amorfo para desbridamento autolítico seguro.' },
        { title: 'Absorção de Secreção', desc: 'Aplicar placa de Alginato de Cálcio e Sódio se houver exsudação moderada a alta. O alginato se transforma em gel ao absorver a secreção.' },
        { title: 'Proteção de Borda', desc: 'Aplicar creme barreira de óxido de zinco na pele ao redor (perilesão) para evitar maceração por umidade.' },
        { title: 'Terapia Compressiva', desc: 'Aplicar enfaixamento compressivo multibandas (como Bota de Unna) para auxiliar no retorno venoso (apenas sob prescrição médica).' }
      ],
      materials: [
        { name: 'Hidrogel Amorfo com Alginato (85g)', price: 'R$ 42,90', brand: 'Curatec' },
        { name: 'Fita de Alginato de Cálcio (10x10cm)', price: 'R$ 28,50', brand: 'Mepilex' },
        { name: 'Creme Barreira Protetor (100g)', price: 'R$ 54,00', brand: 'Cavilon' },
        { name: 'Atadura de Algodão Ortópedico', price: 'R$ 8,20', brand: 'Cremer' }
      ]
    },
    diabetico: {
      title: 'Pé Diabético (Padrão)',
      description: 'Lesões decorrentes de neuropatia e vasculopatia diabética. Exigem alívio total de pressão e monitoramento rigoroso contra infecções silenciadas.',
      steps: [
        { title: 'Inspeção e Limpeza', desc: 'Lavar com soro fisiológico e inspecionar minuciosamente a profundidade e presença de trajetos fistulosos.' },
        { title: 'Desbridamento', desc: 'Manter o leito livre de tecidos mortos. Em lesões secas, utilizar hidrogel. Necroses úmidas exigem avaliação cirúrgica urgente.' },
        { title: 'Controle Microbiano', desc: 'Usar coberturas com Prata Nanocristalina ou PHMB se houver alta carga bacteriana ou sinais de infecção local.' },
        { title: 'Alívio de Pressão (Offloading)', desc: 'Uso obrigatório de palmilhas especiais, gesso de contato total ou calçados de descarga para retirar a pressão da área ferida.' }
      ],
      materials: [
        { name: 'Curativo de Prata com Alginato (10x10cm)', price: 'R$ 89,00', brand: 'Acticoat' },
        { name: 'Solução de Limpeza PHMB (350ml)', price: 'R$ 62,00', brand: 'Prontosan' },
        { name: 'Gaze Estéril de Rayon (7.5x7.5cm)', price: 'R$ 12,90', brand: 'Curatec' }
      ]
    },
    pressao: {
      title: 'Lesão por Pressão (LPP) (Padrão)',
      description: 'Lesões na pele causadas por pressão prolongada em áreas com proeminências ósseas (comum em acamados). Exige mudança de decúbito regular.',
      steps: [
        { title: 'Limpeza Suave', desc: 'Limpar com soro fisiológico sob baixa pressão para evitar danos células nos tecidos recém-formados.' },
        { title: 'Proteção com Placas', desc: 'Em lesões em estágio inicial (pele íntegra porém avermelhada), aplicar placa de Hidrocolóide para proteção mecânica contra fricção.' },
        { title: 'Gerenciamento de Cavidades', desc: 'Se a lesão for profunda (Estágio III ou IV), preencher o espaço cavitário com alginato de cálcio ou hidrogel para manter o leito úmido.' },
        { title: 'Redistribuição de Carga', desc: 'Mudança de posição do paciente a cada 2 horas e uso de colchão pneumático (casca de ovo).' }
      ],
      materials: [
        { name: 'Curativo Hidrocolóide Extra Fino (10x10cm)', price: 'R$ 18,90', brand: 'DuoDerm' },
        { name: 'Placa de Espuma de Poliuretano (10x10cm)', price: 'R$ 48,00', brand: 'Allevyn' },
        { name: 'Óleo Dersani AGE (100ml)', price: 'R$ 38,90', brand: 'Dersani' }
      ]
    }
  };

  // Load dynamic personalized protocol using Gemini API on mount or update
  useEffect(() => {
    async function fetchProtocol() {
      if (activeTab !== 'ai-protocol' || !clinicalProfile) return;

      setLoading(true);
      setError('');
      try {
        console.log("Generating personalized clinical protocol via Gemini...");
        const result = await generatePersonalizedProtocol(clinicalProfile, latestWoundEntry);
        
        if (result) {
          setAiProtocol(result);
        } else {
          // If Gemini fails or key is missing, build simulated personalized protocol locally
          console.warn("Gemini protocol generation returned null. Using simulated rule-based protocol.");
          const simulated = generateSimulatedPersonalizedProtocol(clinicalProfile, latestWoundEntry);
          setAiProtocol(simulated);
        }
      } catch (err) {
        console.error("Failed to generate protocol:", err);
        const simulated = generateSimulatedPersonalizedProtocol(clinicalProfile, latestWoundEntry);
        setAiProtocol(simulated);
      } finally {
        setLoading(false);
      }
    }

    fetchProtocol();
  }, [clinicalProfile, latestWoundEntry, activeTab]);

  const localResources = getLocalHealthcareResources(clinicalProfile?.city, clinicalProfile?.state);
  const localPharmacy = localResources?.pharmacies[0] || { name: 'Farmácia Local', address: 'Próxima a você' };
  const patientState = clinicalProfile?.state ? clinicalProfile.state.toUpperCase() : 'UF';

  const activeStatic = staticProtocols[selectedStaticProtocol];
  const isAiActive = activeTab === 'ai-protocol';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: '700', margin: 0 }}>
            Guias e Protocolos Clínicos
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Instruções seguras para desbridamento, curativo e controle de comorbidades
          </p>
        </div>

        {/* Tab switcher: AI vs Standard */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('ai-protocol')}
            style={{
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isAiActive ? 'var(--primary)' : 'transparent',
              color: isAiActive ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            ✨ Guia Personalizado (IA)
          </button>
          <button 
            onClick={() => setActiveTab('standard-protocols')}
            style={{
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: !isAiActive ? 'var(--primary)' : 'transparent',
              color: !isAiActive ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            📋 Protocolos Padrão
          </button>
        </div>
      </div>

      {/* Comorbidity Badges for Active Patient */}
      <div className="glass-card animate-fade-in" style={{ padding: '12px 16px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Ficha Clínica Ativa:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {clinicalProfile?.hasDiabetes && <span className="badge badge-danger" style={{ fontSize: '10px' }}>Diabetes</span>}
          {clinicalProfile?.hasHypertension && <span className="badge badge-danger" style={{ fontSize: '10px' }}>Hipertensão</span>}
          {clinicalProfile?.hasVenousInsufficiency && <span className="badge badge-success" style={{ fontSize: '10px', backgroundColor: 'rgba(49, 130, 206, 0.1)', color: '#3182ce' }}>Insuf. Venosa</span>}
          {clinicalProfile?.hasPeripheralArterialDisease && <span className="badge badge-danger" style={{ fontSize: '10px' }}>Doença Arterial</span>}
          {clinicalProfile?.isSmoker && <span className="badge badge-danger" style={{ fontSize: '10px' }}>Fumante</span>}
          {clinicalProfile?.isObese && <span className="badge badge-danger" style={{ fontSize: '10px' }}>Obesidade</span>}
          {!clinicalProfile?.hasDiabetes && !clinicalProfile?.hasHypertension && !clinicalProfile?.hasVenousInsufficiency && !clinicalProfile?.hasPeripheralArterialDisease && !clinicalProfile?.isSmoker && !clinicalProfile?.isObese && (
            <span className="badge" style={{ fontSize: '10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Sem comorbidades registradas</span>
          )}
        </div>
      </div>

      {isAiActive ? (
        // AI Dynamic Protocol view
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            // Loading skeleton state
            <div className="glass-card" style={{ padding: '36px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '32px', height: '32px', 
                border: '3px solid var(--border-color)', 
                borderTopColor: 'var(--primary)', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }} />
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Gerando Seu Guia de Cicatrização Personalizado...</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0' }}>
                  Cruzando dados do seu histórico evolutivo, tipo de lesão e suas comorbidades com os Manuais Clínicos oficiais de Curativos.
                </p>
              </div>
            </div>
          ) : aiProtocol ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* AI Protocol Header */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
                    ✨ {aiProtocol.title}
                  </h3>
                  <span className="badge badge-success" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Apoio à Decisão (IA)
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4', margin: '8px 0 0 0' }}>
                  {aiProtocol.description}
                </p>
              </div>

              {/* Steps List */}
              <div>
                <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>Instruções de Curativo e Autocuidado Passo a Passo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aiProtocol.steps && aiProtocol.steps.map((step, idx) => (
                    <div key={idx} className="glass-card animate-fade-in" style={{ padding: '14px 16px', margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          width: '22px', 
                          height: '22px', 
                          borderRadius: '50%', 
                          backgroundColor: 'var(--primary-glow)', 
                          color: 'var(--primary)', 
                          fontSize: '11px', 
                          fontWeight: '800' 
                        }}>
                          {idx + 1}
                        </span>
                        <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>{step.title}</h4>
                      </div>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', paddingLeft: '32px', margin: 0, lineHeight: '1.4' }}>
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Materials */}
              {aiProtocol.materials && aiProtocol.materials.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>Insumos Recomendados para o Seu Curativo</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {aiProtocol.materials.map((item, idx) => (
                      <div key={idx} className="glass-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ fontSize: '13.5px', fontWeight: '700' }}>{item.name}</h4>
                            <p style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Marca sugerida: {item.brand}</p>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{item.price}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => alert(`RETIRADA IMEDIATA CONFIRMADA!\n\nSeu pedido de "${item.name}" foi reservado com sucesso!\n\nLocal de Retirada:\n🏪 ${localPharmacy.name}\n📍 ${localPharmacy.address || 'Disponível na sua cidade'}\n\nApresente seu CPF no balcão para retirar em até 24 horas.`)}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              height: '48px', 
                              padding: '4px 6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              textAlign: 'center'
                            }}
                          >
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--success-light)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              📍 Retirada Rápida
                            </span>
                            <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {localPharmacy.name}
                            </span>
                          </button>

                          <button 
                            className="btn btn-primary" 
                            onClick={() => alert(`COMPRA ONLINE REALIZADA!\n\nO item "${item.name}" foi adquirido via Delivery Express do iRec!\n\nDestino de Entrega:\n📍 Endereço do perfil em ${clinicalProfile?.city || 'sua cidade'}/${patientState}\n\nPrevisão de entrega: em até 24 horas no seu domicílio.`)}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              height: '48px', 
                              padding: '4px 6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              textAlign: 'center'
                            }}
                          >
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              🚚 Envio Expresso
                            </span>
                            <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Receba em 24h em {patientState}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scientific Backing Block */}
              {aiProtocol.scientificBacking && (
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'rgba(49, 130, 206, 0.05)', 
                  border: '1px solid rgba(49, 130, 206, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <strong style={{ fontSize: '12px', color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📖 Respaldo Científico & Citações Clínicas
                  </strong>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: '1.4' }}>
                    {aiProtocol.scientificBacking}
                  </p>
                </div>
              )}

              {/* Specialist Recommendation Alert */}
              {aiProtocol.specialistRecommendation && (
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'rgba(217, 119, 6, 0.05)', 
                  border: '1px solid rgba(217, 119, 6, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <strong style={{ fontSize: '12px', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ Recomendação Médica Multidisciplinar
                  </strong>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    {aiProtocol.specialistRecommendation}
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Não foi possível gerar um guia de protocolo personalizado no momento.
              </p>
              <button onClick={() => setActiveTab('standard-protocols')} className="btn btn-secondary" style={{ marginTop: '10px', fontSize: '11px', padding: '6px 12px', height: 'auto' }}>
                Ver Protocolos Padrão
              </button>
            </div>
          )}
        </div>
      ) : (
        // Standard reference protocols view
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Protocol Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
            {Object.keys(staticProtocols).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedStaticProtocol(key)}
                className={`btn ${selectedStaticProtocol === key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '11.5px', 
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {staticProtocols[key].title}
              </button>
            ))}
          </div>

          {/* Protocol info */}
          <div className="glass-card" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '6px' }}>
              {activeStatic.title}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              {activeStatic.description}
            </p>
          </div>

          {/* Steps List */}
          <div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>Instruções de Curativo Passo a Passo</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeStatic.steps.map((step, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '14px 16px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      width: '22px', 
                      height: '22px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--primary-glow)', 
                      color: 'var(--primary)', 
                      fontSize: '11px', 
                      fontWeight: '800' 
                    }}>
                      {idx + 1}
                    </span>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '700' }}>{step.title}</h4>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', paddingLeft: '32px', margin: 0, lineHeight: '1.4' }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Materials */}
          <div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>Insumos Recomendados para {activeStatic.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeStatic.materials.map((item, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '13.5px', fontWeight: '700' }}>{item.name}</h4>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Marca: {item.brand}</p>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{item.price}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => alert(`RETIRADA IMEDIATA CONFIRMADA!\n\nSeu pedido de "${item.name}" foi reservado com sucesso!\n\nLocal de Retirada:\n🏪 ${localPharmacy.name}\n📍 ${localPharmacy.address || 'Disponível na sua cidade'}\n\nApresente seu CPF no balcão para retirar em até 24 horas.`)}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        height: '48px', 
                        padding: '4px 6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--success-light)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        📍 Retirada Rápida
                      </span>
                      <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {localPharmacy.name}
                      </span>
                    </button>

                    <button 
                      className="btn btn-primary" 
                      onClick={() => alert(`COMPRA ONLINE REALIZADA!\n\nO item "${item.name}" foi adquirido via Delivery Express do iRec!\n\nDestino de Entrega:\n📍 Endereço do perfil em ${clinicalProfile?.city || 'sua cidade'}/${patientState}\n\nPrevisão de entrega: em até 24 horas no seu domicílio.`)}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        height: '48px', 
                        padding: '4px 6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        🚚 Envio Expresso
                      </span>
                      <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Receba em 24h em {patientState}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* CSS Animation injection */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
