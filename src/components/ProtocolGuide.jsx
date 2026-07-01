import React, { useState, useEffect } from 'react';
import { getLocalHealthcareResources, getRecommendedMaterials, getAssignedDoctors } from '../services/supabaseService';
import { generatePersonalizedProtocol, isGeminiConfigured } from '../services/geminiService';

// Client-side rule-based fallback generator in case Gemini fails or is offline
function generateSimulatedPersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician = false) {
  const woundType = latestWoundEntry?.type || (clinicalProfile.hasDiabetes ? 'Pé Diabético' : clinicalProfile.hasVenousInsufficiency ? 'Úlcera Venosa' : 'Lesão Cutânea');
  
  if (isClinician) {
    const title = `Condutas Clínicas de Apoio à Decisão para: ${clinicalProfile.name}`;
    const description = `Diretrizes clínicas e condutas terapêuticas recomendadas para o manejo técnico de ${clinicalProfile.name} acometido por ${woundType}. Baseado em consensos científicos e manuais de estomaterapia de alto nível.`;
    
    const steps = [
      { 
        title: 'Avaliação Inicial do Leito e Bordas', 
        desc: 'Avaliar integridade das bordas, grau de exsudação e presença de maceração perilesional. Irrigar o leito da ferida abundantemente com solução antisséptica de PHMB ou Soro Fisiológico 0.9% morno sob pressão controlada para redução de carga microbiana sem lesionar granulação.' 
      }
    ];
    
    const necrose = latestWoundEntry?.aiTissueAnalysis?.necrose || 0;
    const fibrina = latestWoundEntry?.aiTissueAnalysis?.fibrina || 0;
    
    if (necrose > 0) {
      steps.push({
        title: 'Condutas de Desbridamento Instrumental e Autolítico',
        desc: 'Avaliar indicação de desbridamento cortante instrumental conservador (slicing ou square) se houver profissional qualificado e ausência de isquemia crítica. Prescrever Hidrogel com Alginato no leito da lesão para promover desbridamento autolítico seguro. Proteger a pele perilesional.'
      });
    } else if (fibrina > 0) {
      steps.push({
        title: 'Manejo de Esfacelos e Exsudato',
        desc: 'Indicar cobertura de Alginato de Cálcio e Sódio ou Fibra de Carboximetilcelulose (CMC) se houver exsudação moderada a alta. Em caso de baixa exsudação, optar por hidrogel amorfo para promover umidade ideal no leito.'
      });
    } else {
      steps.push({
        title: 'Estímulo ao Tecido de Granulação e Epitelização',
        desc: 'Garantir microambiente de cicatrização em meio úmido ideal. Indicar aplicação de Ácidos Graxos Essenciais (AGE) ou placas de hidrocolóide/espuma de poliuretano conforme taxa exsudativa para proteger os queratinócitos em divisão.'
      });
    }
    
    if (clinicalProfile.hasDiabetes) {
      steps.push({
        title: 'Protocolo de Offloading (Descarga) e Controle Metabólico',
        desc: 'Orientar descarga total da área afetada (offloading) através de calçados terapêuticos de descarga ou gesso de contato total. Monitoramento glicêmico rigoroso com meta de HbA1c < 7.0% para otimizar cicatrização.'
      });
    }
    
    if (clinicalProfile.hasVenousInsufficiency) {
      steps.push({
        title: 'Terapia Compressiva Multibandas',
        desc: 'Realizar avaliação arterial prévia (mensurar pulso pedioso e ITB). Se ITB > 0.8, prescrever enfaixamento compressivo de curta elasticidade (ex: Bota de Unna ou bandagens multibandas de 2/4 camadas) para combater a hipertensão venosa.'
      });
    }

    const materials = [
      { name: 'Alginato de Cálcio e Sódio', brand: 'Feridas cavitárias ou planas com exsudação moderada a alta.', price: 'Uso Tópico • Troca 24h a 48h' },
      { name: 'Hidrogel Amorfo com Alginato', brand: 'Desbridamento autolítico e hidratação de tecidos necróticos secos.', price: 'Uso Tópico • Troca a cada 48h' },
      { name: 'Placa de Hidrocolóide Extra Fino', brand: 'Proteção e barreira em feridas limpas com baixo exsudato.', price: 'Uso Tópico • Troca até 7 dias' }
    ];

    const scientificBacking = 'Resolução COFEN nº 567/2018 (Diretrizes para o tratamento de feridas por enfermeiros) • Consenso WUWHS (Manejo de Exsudato em Feridas/2019).';
    const specialistRecommendation = 'Se houver sinais de infecção sistêmica ou isquemia de membro (ITB < 0.5), encaminhar com urgência ao Cirurgião Vascular. Controle glicêmico com endocrinologista.';

    return {
      title,
      description,
      steps,
      materials,
      scientificBacking,
      specialistRecommendation
    };
  }

  // Standard patient simulated protocol
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

const formatMaterialsForView = (materialsList, isClinician) => {
  if (!materialsList) return [];
  if (!isClinician) return materialsList;
  
  return materialsList.map(item => {
    const isPriceAlreadyClinical = item.price && (item.price.includes('Troca') || item.price.includes('Uso') || item.price.includes('Aplicar'));
    const isBrandAlreadyClinical = item.brand && (item.brand.includes('Indicação') || item.brand.includes('Mecanismo') || item.brand.includes('ferida') || item.brand.includes('Ferida'));

    return {
      ...item,
      brand: isBrandAlreadyClinical ? item.brand : `Cobertura recomendada para o manejo da lesão.`,
      price: isPriceAlreadyClinical ? item.price : `Uso Tópico • Conforme evolução`
    };
  });
}

export default function ProtocolGuide({ currentUser, clinicalProfile, entries = [], setActiveTab: setAppActiveTab }) {
  const [activeTab, setActiveTab] = useState('ai-protocol');
  const [loading, setLoading] = useState(false);
  const [aiProtocol, setAiProtocol] = useState(null);
  const [error, setError] = useState('');
  const [dbRecommendedMaterials, setDbRecommendedMaterials] = useState([]);
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const latestWoundEntry = entries && entries.length > 0 ? entries[entries.length - 1] : null;
  const isClinician = currentUser?.role === 'doctor';

  // Static reference protocols (standard fallback/baseline)
  const staticProtocols = {
    venosa: {
      title: 'Úlcera Venosa',
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
        { name: 'Creme Barreira Prototor (100g)', price: 'R$ 54,00', brand: 'Cavilon' },
        { name: 'Atadura de Algodão Ortópedico', price: 'R$ 8,20', brand: 'Cremer' }
      ]
    },
    diabetico: {
      title: 'Pé Diabético',
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
      title: 'Lesão por Pressão (LPP)',
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
    },
    arterial: {
      title: 'Úlcera Arterial',
      description: 'Lesões causadas por fluxo sanguíneo arterial insuficiente (isquemia). O foco é revascularização e proteção contra infecção. Terapia compressiva é estritamente contraindicada.',
      steps: [
        { title: 'Avaliação Vascular', desc: 'Verificar pulsos periféricos (pedioso e tibial posterior) e medir Índice Tornozelo-Braço (ITB). Encaminhar ao cirurgião vascular.' },
        { title: 'Higiene e Proteção', desc: 'Limpar com soro fisiológico morno sem fricção. Manter a lesão limpa e seca para evitar gangrena úmida.' },
        { title: 'Tratamento do Leito', desc: 'Se a lesão for seca, manter seca (não umidificar necrose seca). Se houver exsudato leve, usar curativo de hidrocolóide extra fino ou AGE.' },
        { title: 'Evitar Compressão', desc: 'Nunca aplicar bandagens elásticas ou compressivas. Evitar elevação do membro.' }
      ],
      materials: [
        { name: 'Curativo Hidrocolóide Extra Fino (10x10cm)', price: 'R$ 18,90', brand: 'DuoDerm' },
        { name: 'Óleo Dersani AGE (100ml)', price: 'R$ 38,90', brand: 'Dersani' },
        { name: 'Gaze Estéril de Rayon (7.5x7.5cm)', price: 'R$ 12,90', brand: 'Curatec' }
      ]
    },
    queimadura: {
      title: 'Queimadura de 1º e 2º Grau',
      description: 'Lesões térmicas ou químicas na epiderme e derme. Foco no controle da dor, prevenção de infecção e manutenção de leito úmido.',
      steps: [
        { title: 'Resfriamento', desc: 'Resfriar com água corrente fria (não gelada) por 15-20 minutos imediatamente após o acidente.' },
        { title: 'Preservação de Flictenas', desc: 'Não romper bolhas (flictenas) íntegras, pois servem como barreira biológica contra infecções.' },
        { title: 'Curativo e Proteção', desc: 'Aplicar Sulfadiazina de Prata 1% ou curativo de hidrofibra com prata para prevenir infecção e manter a umidade.' },
        { title: 'Cobertura Secundária', desc: 'Cobrir com gaze estéril e enfaixar sem apertar para proteger contra traumas físicos.' }
      ],
      materials: [
        { name: 'Creme Sulfadiazina de Prata 1% (50g)', price: 'R$ 24,90', brand: 'Prati-Donaduzzi' },
        { name: 'Curativo de Hidrofibra com Prata (10x10cm)', price: 'R$ 78,00', brand: 'Aquacel' },
        { name: 'Atadura de Crepe (10cm x 1.8m)', price: 'R$ 4,50', brand: 'Cremer' }
      ]
    },
    dau: {
      title: 'Dermatite por Umidade (DAU)',
      description: 'Inflamação e erosão da pele causadas por exposição prolongada a urina, fezes ou suor. Comum em pacientes incontinentes.',
      steps: [
        { title: 'Higiene Suave', desc: 'Limpar a área perineal com sabonete de pH neutro ou loção de limpeza sem enxágue. Evitar esfregar a pele.' },
        { title: 'Barreira de Proteção', desc: 'Aplicar generosamente creme barreira protetor de longa duração (como Cavilon ou óxido de zinco) após cada episódio de incontinência.' },
        { title: 'Controle de Umidade', desc: 'Trocar fraldas regularmente e usar dispositivos coletores se necessário para manter a pele seca.' }
      ],
      materials: [
        { name: 'Creme Barreira Cavilon Durável (92g)', price: 'R$ 94,00', brand: '3M' },
        { name: 'Pomada de Óxido de Zinco com Vitamina A/D (120g)', price: 'R$ 18,50', brand: 'Hipoglós' },
        { name: 'Loção de Limpeza sem Enxágue (240ml)', price: 'R$ 48,00', brand: 'Tena' }
      ]
    },
    friccao: {
      title: 'Lesão por Fricção (Skin Tear)',
      description: 'Feridas traumáticas causadas por forças de fricção ou cisalhamento, resultando na separação da epiderme da derme (comum em idosos).',
      steps: [
        { title: 'Reposicionamento do Retalho', desc: 'Limpar com soro fisiológico e reposicionar cuidadosamente o retalho de pele sobre o leito da lesão, se possível.' },
        { title: 'Cobertura Não-Aderente', desc: 'Aplicar curativo não-aderente (como gaze impregnada com petrolato ou silicone) para evitar que o retalho seja removido na troca de curativo.' },
        { title: 'Fixação Segura', desc: 'Fixar as bordas do curativo com fita microporosa hipoalergênica ou malha tubular, nunca aplicar fitas adesivas fortes diretamente na pele frágil.' }
      ],
      materials: [
        { name: 'Curativo de Gaze Impregnada Adaptic (7.6x7.6cm)', price: 'R$ 14,90', brand: 'Systagenix' },
        { name: 'Fita Microporosa Hipoalergênica (25mm x 10m)', price: 'R$ 12,00', brand: 'Micropore' },
        { name: 'Malha Tubular Protetora de Membros', price: 'R$ 32,00', brand: 'Orthometric' }
      ]
    },
    cirurgica: {
      title: 'Deiscência Cirúrgica',
      description: 'Separação espontânea das bordas de uma incisão cirúrgica antes da cicatrização completa. Foco no estímulo de granulação e controle bacteriano.',
      steps: [
        { title: 'Limpeza Asséptica', desc: 'Lavar exaustivamente com soro fisiológico ou solução de PHMB para remover resíduos e secreções.' },
        { title: 'Preenchimento de Cavidade', desc: 'Preencher a cavidade com Alginato de Cálcio (se exsudativa) ou Hidrogel com Alginato (se seca) para estimular a granulação de dentro para fora.' },
        { title: 'Monitoramento de Infecção', desc: 'Avaliar presença de sinais flogísticos (calor, rubor, dor, edema, pus). Encaminhar ao cirurgião se houver suspeita de infecção profunda.' }
      ],
      materials: [
        { name: 'Hidrogel Amorfo com Alginato (85g)', price: 'R$ 42,90', brand: 'Curatec' },
        { name: 'Placa de Alginato de Cálcio (10x10cm)', price: 'R$ 28,50', brand: 'Curatec' },
      ]
    }
  };

  const getMostRelevantStaticProtocol = () => {
    if (!clinicalProfile) return 'venosa';
    
    let bestKey = 'venosa';
    let bestScore = -1;
    
    const scores = {
      diabetico: clinicalProfile.hasDiabetes ? 10 : 0,
      venosa: clinicalProfile.hasVenousInsufficiency ? 10 : 0,
      arterial: clinicalProfile.hasPeripheralArterialDisease ? 10 : 0,
      pressao: (clinicalProfile.isObese || 
                clinicalProfile.otherConditions?.toLowerCase().includes('cadeirante') || 
                clinicalProfile.otherConditions?.toLowerCase().includes('acamado')) ? 10 : 0,
      queimadura: 0,
      dau: (clinicalProfile.otherConditions?.toLowerCase().includes('incontinente') || 
            clinicalProfile.otherConditions?.toLowerCase().includes('fralda')) ? 8 : 0,
      friccao: (clinicalProfile.age && parseInt(clinicalProfile.age) >= 70) ? 8 : 0,
      cirurgica: (clinicalProfile.otherConditions?.toLowerCase().includes('cirurgia') || 
                  clinicalProfile.otherConditions?.toLowerCase().includes('operado')) ? 9 : 0
    };
    
    Object.keys(scores).forEach(key => {
      if (scores[key] > bestScore) {
        bestScore = scores[key];
        bestKey = key;
      }
    });
    
    return bestKey;
  };

  const getSortedProtocolKeys = () => {
    const keys = Object.keys(staticProtocols);
    if (!clinicalProfile) return keys;
    
    const getScore = (key) => {
      if (key === 'diabetico') return clinicalProfile.hasDiabetes ? 10 : 0;
      if (key === 'venosa') return clinicalProfile.hasVenousInsufficiency ? 10 : 0;
      if (key === 'arterial') return clinicalProfile.hasPeripheralArterialDisease ? 10 : 0;
      if (key === 'pressao') return (clinicalProfile.isObese || 
                                     clinicalProfile.otherConditions?.toLowerCase().includes('cadeirante') || 
                                     clinicalProfile.otherConditions?.toLowerCase().includes('acamado')) ? 10 : 0;
      if (key === 'dau') return (clinicalProfile.otherConditions?.toLowerCase().includes('incontinente') || 
                                 clinicalProfile.otherConditions?.toLowerCase().includes('fralda')) ? 8 : 0;
      if (key === 'cirurgica') return (clinicalProfile.otherConditions?.toLowerCase().includes('cirurgia') || 
                                       clinicalProfile.otherConditions?.toLowerCase().includes('operado')) ? 9 : 0;
      if (key === 'friccao') return (clinicalProfile.age && parseInt(clinicalProfile.age) >= 70) ? 8 : 0;
      return 0;
    };
    
    return [...keys].sort((a, b) => getScore(b) - getScore(a));
  };

  const [selectedStaticProtocol, setSelectedStaticProtocol] = useState(() => getMostRelevantStaticProtocol());

  const [bookingModal, setBookingModal] = useState({
    isOpen: false,
    itemName: '',
    itemPrice: '',
    partnerName: '',
    doctorName: '',
    affiliateLink: '',
    isIrecPartner: false,
    countdown: 3
  });

  const handlePartnerRedirectClick = (itemName, partner) => {
    let doctorName = '';
    if (partner.type === 'irec_partner') {
      doctorName = 'iRec Oficial';
    } else {
      doctorName = getDoctorName(partner.doctor_id);
    }

    setBookingModal({
      isOpen: true,
      itemName: itemName,
      itemPrice: partner.price || 'A consultar',
      partnerName: partner.pharmacy_name || partner.brand || partner.name || 'Parceiro Credenciado',
      doctorName: doctorName,
      affiliateLink: partner.affiliate_link || '#',
      isIrecPartner: partner.type === 'irec_partner',
      countdown: 3
    });
  };

  useEffect(() => {
    let timer;
    if (bookingModal.isOpen && bookingModal.countdown > 0) {
      timer = setTimeout(() => {
        setBookingModal(prev => ({
          ...prev,
          countdown: prev.countdown - 1
        }));
      }, 1000);
    } else if (bookingModal.isOpen && bookingModal.countdown === 0) {
      window.open(bookingModal.affiliateLink, '_blank');
      setBookingModal(prev => ({ ...prev, isOpen: false }));
    }
    return () => clearTimeout(timer);
  }, [bookingModal.isOpen, bookingModal.countdown, bookingModal.affiliateLink]);

  // Load dynamic personalized protocol using Gemini API on mount or update
  useEffect(() => {
    async function fetchProtocol() {
      if (activeTab !== 'ai-protocol' || !clinicalProfile) return;

      const profileId = clinicalProfile.id || 'guest';
      const entryId = latestWoundEntry ? (latestWoundEntry.id || latestWoundEntry.createdAt) : 'no-entry';
      const cacheKey = `irec_cached_protocol_${profileId}_${entryId}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Only use cache if the clinical profile characteristics and clinician mode match
          const profileKeys = ['name', 'hasDiabetes', 'hasHypertension', 'hasVenousInsufficiency', 'hasPeripheralArterialDisease', 'isSmoker', 'isObese', 'medications', 'allergies', 'otherConditions'];
          const profileMatch = profileKeys.every(k => parsed.profile?.[k] === clinicalProfile[k]);
          const modeMatch = parsed.isClinician === isClinician;
          
          if (profileMatch && modeMatch && parsed.protocol) {
            console.log("Using cached personalized protocol...");
            setAiProtocol(parsed.protocol);
            return;
          }
        } catch (e) {
          console.error("Erro ao ler protocolo cacheado:", e);
        }
      }

      setLoading(true);
      setError('');
      try {
        console.log("Generating personalized clinical protocol via Gemini...");
        const result = await generatePersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
        
        const finalProtocol = result || generateSimulatedPersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
        setAiProtocol(finalProtocol);
        
        // Cache the result along with the profile properties
        const cacheData = {
          protocol: finalProtocol,
          isClinician: isClinician,
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
      } catch (err) {
        console.error("Failed to generate protocol:", err);
        const simulated = generateSimulatedPersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
        setAiProtocol(simulated);
      } finally {
        setLoading(false);
      }
    }

    fetchProtocol();
  }, [clinicalProfile, latestWoundEntry, activeTab]);

  useEffect(() => {
    async function loadDbMaterials() {
      if (clinicalProfile && clinicalProfile.id) {
        try {
          const data = await getRecommendedMaterials(clinicalProfile.id);
          setDbRecommendedMaterials(data);
          
          const docs = await getAssignedDoctors(clinicalProfile.id);
          setAssignedDoctors(docs || []);
        } catch (e) {
          console.error("Erro ao carregar insumos do banco:", e);
        }
      }
    }
    loadDbMaterials();
  }, [clinicalProfile]);

  const getAvailablePartnersForMaterial = (itemName) => {
    // 1. Doctor's specific partners for this material
    const docSpecific = dbRecommendedMaterials.filter(m => {
      if (m.type !== 'doctor_partner') return false;
      if (!m.name || m.name.toLowerCase() !== itemName.toLowerCase()) return false;
      if (m.patient_id === clinicalProfile?.id) return true;
      const isAssigned = assignedDoctors.some(doc => doc.id === m.doctor_id);
      return m.patient_id === null && isAssigned;
    });

    // 2. Doctor's general pharmacy links
    const docGeneral = dbRecommendedMaterials.filter(m => {
      if (m.type !== 'doctor_general_partner') return false;
      const isAssigned = assignedDoctors.some(doc => doc.id === m.doctor_id);
      return isAssigned;
    });

    // 3. iRec's global partners for this material (registered by Admin)
    const irecSpecific = dbRecommendedMaterials.filter(m => {
      if (m.type !== 'irec_partner') return false;
      return m.name && m.name.toLowerCase() === itemName.toLowerCase();
    });

    return {
      docSpecific,
      docGeneral,
      irecSpecific,
      hasAny: docSpecific.length > 0 || docGeneral.length > 0 || irecSpecific.length > 0
    };
  };

  const getDoctorName = (doctorId) => {
    const doc = assignedDoctors.find(d => d.id === doctorId);
    return doc ? doc.name : 'Médico Credenciado';
  };

  const getDoctorPartners = () => {
    return dbRecommendedMaterials.filter(m => {
      if (m.type !== 'doctor_partner') return false;
      if (m.patient_id === clinicalProfile?.id) return true;
      const isAssigned = assignedDoctors.some(doc => doc.id === m.doctor_id);
      return m.patient_id === null && isAssigned;
    });
  };

  const renderCheckoutButtons = (item) => {
    const { docSpecific, docGeneral } = getAvailablePartnersForMaterial(item.name);
    const hasDoctorPartners = docSpecific.length > 0 || docGeneral.length > 0;

    if (!hasDoctorPartners) {
      return (
        <div style={{ 
          fontSize: '11px', 
          color: 'var(--text-secondary)', 
          fontStyle: 'italic', 
          padding: '6px 10px',
          backgroundColor: 'rgba(var(--primary-rgb), 0.04)',
          border: '1.5px dashed var(--border-color)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '2px'
        }}>
          <span>📍</span>
          <span>Procure a farmácia credenciada mais próxima para aquisição deste produto.</span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        {/* Render Doctor Specific recommendations */}
        {docSpecific.map((part, pIdx) => (
          <button
            key={`doc-spec-${pIdx}`}
            className="btn btn-primary"
            onClick={() => handlePartnerRedirectClick(item.name, part)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '8px 12px', 
              height: '38px', 
              borderRadius: '6px', 
              fontSize: '11.5px', 
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <span>🏪 Comprar Indicação do Dr(a). {getDoctorName(part.doctor_id)} ({part.pharmacy_name || part.brand || 'Parceiro'})</span>
            <span style={{ fontSize: '9px', opacity: 0.85 }}>Comprar ↗</span>
          </button>
        ))}

        {/* Render Doctor General Store recommendations */}
        {docGeneral.map((part, pIdx) => (
          <button
            key={`doc-gen-${pIdx}`}
            className="btn"
            onClick={() => handlePartnerRedirectClick(item.name, part)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '8px 12px', 
              height: '38px', 
              borderRadius: '6px', 
              fontSize: '11.5px', 
              fontWeight: '700',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              color: 'var(--primary)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              cursor: 'pointer'
            }}
          >
            <span>🏪 Comprar no Parceiro do Dr(a). {getDoctorName(part.doctor_id)} ({part.name})</span>
            <span style={{ fontSize: '9px', opacity: 0.85 }}>Ir para o site ↗</span>
          </button>
        ))}
      </div>
    );
  };

  if (isClinician && !clinicalProfile) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        margin: '40px auto',
        maxWidth: '560px',
        fontFamily: 'var(--font-primary)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-glow)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          marginBottom: '20px'
        }}>
          📋
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px', color: 'var(--text-primary)' }}>
          Nenhum Paciente Ativo
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px', maxWidth: '420px' }}>
          Para visualizar os guias e protocolos clínicos personalizados, acesse a **Lista de Pacientes** e selecione um caso ativo para análise.
        </p>
        <button
          onClick={() => setAppActiveTab('doctor-dashboard')}
          className="btn btn-primary"
          style={{ padding: '10px 24px', borderRadius: '10px', fontWeight: '700', fontSize: '13px' }}
        >
          Voltar para Lista de Pacientes
        </button>
      </div>
    );
  }

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
        <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
          Ficha Clínica Ativa {clinicalProfile?.name ? `(${clinicalProfile.name})` : ''}:
        </span>
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
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Gerando Seu Guia de Cuidados Personalizado...</h4>
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
                <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>
                  {isClinician ? 'Condutas e Diretrizes Clínicas de Manejo' : 'Guia Instruções de Autocuidados'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                  {aiProtocol.steps && aiProtocol.steps.map((step, idx) => (
                    <div key={idx} className="glass-card animate-fade-in" style={{ 
                      padding: '16px', 
                      margin: 0, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '16px',
                      border: '1.5px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s ease',
                      height: '100%',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary-glow)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: '800',
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                          <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: 'var(--text-primary)', margin: 0 }}>
                            {step.title}
                          </h4>
                          <span style={{ 
                            fontSize: '9.5px', 
                            color: 'var(--text-muted)', 
                            fontWeight: '700', 
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em'
                          }}>
                            Passo {idx + 1} • {isClinician ? 'Conduta' : 'Instrução'}
                          </span>
                        </div>
                      </div>

                      <p style={{ 
                        fontSize: '12.5px', 
                        color: 'var(--text-secondary)', 
                        lineHeight: '1.5', 
                        margin: 0,
                        flexGrow: 1
                      }}>
                        {step.desc}
                      </p>

                      <div style={{ 
                        borderTop: '1px solid var(--border-color)', 
                        paddingTop: '8px', 
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                      }}>
                        <span>✓ Recomendação Ativa</span>
                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Passo a Passo →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Materials Section */}
              {((aiProtocol.materials && aiProtocol.materials.length > 0) || dbRecommendedMaterials.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* 1. Doctor Partners (Insumos do Médico) */}
                  {!isClinician && getDoctorPartners().length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '750', marginBottom: '8px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>💊 Insumos Recomendados pelo seu Médico</span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {getDoctorPartners().map((item, idx) => (
                          <div key={idx} className="glass-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', margin: 0, borderColor: 'var(--primary-glow)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 style={{ fontSize: '13.5px', fontWeight: '700', margin: 0 }}>{item.name}</h4>
                                <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Marca sugerida: {item.brand}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>🏪 Local indicado: {item.pharmacy_name}</p>
                              </div>
                              <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{item.price}</span>
                            </div>
                            <button 
                              onClick={() => handlePartnerRedirectClick(item.name, item)} 
                              className="btn btn-primary"
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                height: '36px', 
                                fontSize: '11px', 
                                fontWeight: '700',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                width: '100%',
                                border: 'none'
                              }}
                            >
                              🛒 Comprar Indicação do Médico
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. iRec Partners (Parceiros iRec) */}
                  {!isClinician && dbRecommendedMaterials.filter(m => m.type === 'irec_partner').length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '750', marginBottom: '8px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>🤝 Parceiros iRec (Melhores Preços)</span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {dbRecommendedMaterials.filter(m => m.type === 'irec_partner').map((item, idx) => (
                          <div key={idx} className="glass-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', margin: 0, borderColor: 'rgba(var(--accent-rgb), 0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 style={{ fontSize: '13.5px', fontWeight: '700', margin: 0 }}>{item.name}</h4>
                                <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Marca: {item.brand}</p>
                                <p style={{ fontSize: '11px', color: 'var(--accent)', margin: '4px 0 0 0' }}>🏪 Farmácia Credenciada: {item.pharmacy_name}</p>
                              </div>
                              <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>{item.price}</span>
                            </div>
                            <button 
                              onClick={() => handlePartnerRedirectClick(item.name, item)} 
                              className="btn btn-secondary"
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                height: '36px', 
                                fontSize: '11px', 
                                fontWeight: '700',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(var(--primary-rgb), 0.12)',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                width: '100%',
                                border: 'none'
                              }}
                            >
                              🏪 Comprar no Parceiro iRec (Desconto de Convênio)
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Standard AI Protocol Materials */}
                  {aiProtocol.materials && aiProtocol.materials.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '750', marginBottom: '8px' }}>
                        {isClinician ? 'Terapêuticas e Coberturas Sugeridas (Apoio à Prescrição)' : 'Insumos Sugeridos pelo Protocolo de IA'}
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                        {formatMaterialsForView(aiProtocol.materials, isClinician).map((item, idx) => (
                          <div key={idx} className="glass-card animate-fade-in" style={{ 
                            padding: '16px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '12px', 
                            margin: 0,
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '16px',
                            border: '1.5px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                            height: '100%',
                            justifyContent: 'space-between'
                          }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                fontWeight: '800',
                                flexShrink: 0
                              }}>
                                📦
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: 'var(--text-primary)', margin: 0 }}>
                                  {item.name}
                                </h4>
                                <span style={{ 
                                  fontSize: '9.5px', 
                                  color: 'var(--text-muted)', 
                                  fontWeight: '700', 
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.02em'
                                }}>
                                  {isClinician ? 'Terapêutica Sugerida' : 'Insumo Sugerido'}
                                </span>
                              </div>
                            </div>

                            <p style={{ 
                              fontSize: '12.5px', 
                              color: 'var(--text-secondary)', 
                              lineHeight: '1.5', 
                              margin: 0,
                              flexGrow: 1
                            }}>
                              {isClinician ? 'Indicação: ' : 'Marca sugerida: '}{item.brand}
                            </p>

                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                              {!isClinician && renderCheckoutButtons(item)}
                              {isClinician && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  ✓ Indicado no Protocolo Clínico
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
            {getSortedProtocolKeys().map((key) => (
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
            <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>
              {isClinician ? 'Condutas e Diretrizes Clínicas de Manejo' : 'Guia Instruções de Autocuidados'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {activeStatic.steps.map((step, idx) => (
                <div key={idx} className="glass-card animate-fade-in" style={{ 
                  padding: '16px', 
                  margin: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                  height: '100%',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-glow)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '800',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: 'var(--text-primary)', margin: 0 }}>
                        {step.title}
                      </h4>
                      <span style={{ 
                        fontSize: '9.5px', 
                        color: 'var(--text-muted)', 
                        fontWeight: '700', 
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        Passo {idx + 1} • {isClinician ? 'Conduta' : 'Instrução'}
                      </span>
                    </div>
                  </div>

                  <p style={{ 
                    fontSize: '12.5px', 
                    color: 'var(--text-secondary)', 
                    lineHeight: '1.5', 
                    margin: 0,
                    flexGrow: 1
                  }}>
                    {step.desc}
                  </p>

                  <div style={{ 
                    borderTop: '1px solid var(--border-color)', 
                    paddingTop: '8px', 
                    marginTop: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                  }}>
                    <span>✓ Recomendação Ativa</span>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Passo a Passo →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Materials */}
          {activeStatic.materials && activeStatic.materials.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: '750', marginBottom: '10px' }}>
                {isClinician ? 'Terapêuticas e Coberturas Sugeridas (Apoio à Prescrição)' : `Insumos Recomendados para ${activeStatic.title}`}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {formatMaterialsForView(activeStatic.materials, isClinician).map((item, idx) => (
                  <div key={idx} className="glass-card animate-fade-in" style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px', 
                    margin: 0,
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    border: '1.5px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    height: '100%',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: '800',
                        flexShrink: 0
                      }}>
                        📦
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: 'var(--text-primary)', margin: 0 }}>
                          {item.name}
                        </h4>
                        <span style={{ 
                          fontSize: '9.5px', 
                          color: 'var(--text-muted)', 
                          fontWeight: '700', 
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em'
                        }}>
                          {isClinician ? 'Terapêutica Sugerida' : 'Insumo Sugerido'}
                        </span>
                      </div>
                    </div>

                    <p style={{ 
                      fontSize: '12.5px', 
                      color: 'var(--text-secondary)', 
                      lineHeight: '1.5', 
                      margin: 0,
                      flexGrow: 1
                    }}>
                      {isClinician ? 'Indicação: ' : 'Marca: '}{item.brand}
                    </p>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                      {!isClinician && renderCheckoutButtons(item)}
                      {isClinician && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ✓ Indicado no Protocolo Clínico
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Premium Booking Modal */}
      {bookingModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-xl)',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <button
              onClick={() => setBookingModal(prev => ({ ...prev, isOpen: false }))}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '22px',
                cursor: 'pointer',
                fontWeight: 'bold',
                lineHeight: 1
              }}
            >
              &times;
            </button>

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: bookingModal.isIrecPartner ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                color: bookingModal.isIrecPartner ? 'var(--success-light)' : 'var(--primary)',
                animation: 'pulse 2s infinite'
              }}>
                {bookingModal.isIrecPartner ? '🤝' : '🏪'}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                Redirecionando para o Parceiro...
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                Você está sendo redirecionado para o site parceiro para concluir sua compra com segurança.
              </p>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>Insumo Recomendado</span>
                <div style={{ fontSize: '13.5px', fontWeight: '750', color: 'var(--text-primary)', marginTop: '2px' }}>{bookingModal.itemName}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>Farmácia / Canal de Venda</span>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>🏪 {bookingModal.partnerName}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>Indicação & Autoria</span>
                <div style={{ fontSize: '12.5px', fontWeight: '750', color: bookingModal.isIrecPartner ? 'var(--success-light)' : 'var(--primary)', marginTop: '2px' }}>
                  {bookingModal.isIrecPartner ? '🤝 Parceiro Credenciado Oficial iRec' : `👨‍⚕️ Indicação de Dr(a). ${bookingModal.doctorName}`}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>Preço Referência</span>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{bookingModal.itemPrice}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800' }}>Conexão</span>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Segura
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.12)',
              borderRadius: '10px',
              textAlign: 'center',
              fontSize: '11.5px',
              fontWeight: '700',
              color: 'var(--text-secondary)'
            }}>
              <span>🔗 Redirecionando automaticamente em <strong>{bookingModal.countdown}s</strong>...</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setBookingModal(prev => ({ ...prev, isOpen: false }))}
                className="btn btn-secondary"
                style={{ fontSize: '12.5px', height: '38px', padding: 0 }}
              >
                Cancelar
              </button>
              <a
                href={bookingModal.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setBookingModal(prev => ({ ...prev, isOpen: false }))}
                className="btn btn-primary"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  textDecoration: 'none', 
                  fontSize: '12.5px', 
                  height: '38px', 
                  padding: 0 
                }}
              >
                Ir para o Site Agora
              </a>
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
