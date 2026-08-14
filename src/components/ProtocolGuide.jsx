import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getRecommendedMaterials, getAssignedDoctors } from '../services/supabaseService';
import { generatePersonalizedProtocol } from '../services/geminiService';

// Client-side rule-based fallback generator in case Gemini fails or is offline
function generateDefaultPersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician = false) {
  const profile = clinicalProfile || {};
  const woundType = latestWoundEntry?.type || (profile.hasDiabetes ? 'Pé Diabético' : profile.hasVenousInsufficiency ? 'Úlcera Venosa' : 'Lesão Cutânea');
  const userAllergies = (profile.allergies || '').toLowerCase();
  
  if (isClinician) {
    const title = `Condutas Clínicas de Apoio à Decisão para: ${profile.name || 'Paciente'}`;
    const description = `Diretrizes clínicas e condutas terapêuticas recomendadas para o manejo técnico de ${profile.name || 'Paciente'} acometido por ${woundType}. Baseado em consensos científicos e manuais de estomaterapia de alto nível.`;
    
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
        desc: 'Avaliar indicação de desbridamento cortante instrumental conservador se houver profissional qualificado e ausência de isquemia crítica. Prescrever Hidrogel com Alginato no leito da lesão para promover desbridamento autolítico seguro. Proteger a pele perilesional.'
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
    
    if (profile.hasDiabetes) {
      steps.push({
        title: 'Protocolo de Offloading (Descarga) e Controle Metabólico',
        desc: 'Orientar descarga total da área afetada (offloading) através de calçados terapêuticos de descarga ou gesso de contato total. Monitoramento glicêmico rigoroso com meta de HbA1c < 7.0% para otimizar cicatrização.'
      });
    }
    
    if (profile.hasVenousInsufficiency) {
      if (profile.hasPeripheralArterialDisease) {
        steps.push({
          title: '⚠️ CONTRAINDICAÇÃO DE TERAPIA COMPRESSIVA',
          desc: 'ATENÇÃO CLÍNICA: Terapia compressiva contraindicada devido ao diagnóstico concomitante de Doença Arterial Periférica (DAP). Priorizar desbridamento, otimização perfusional e parecer vascular urgente.'
        });
      } else {
        steps.push({
          title: 'Terapia Compressiva Multibandas',
          desc: 'Realizar avaliação arterial prévia (mensurar pulso pedioso e ITB). Se ITB > 0.8, prescrever enfaixamento compressivo de curta elasticidade (ex: Bota de Unna ou bandagens multibandas de 2/4 camadas) para combater a hipertensão venosa.'
        });
      }
    }

    let materials = [
      { name: 'Alginato de Cálcio e Sódio', brand: 'Feridas cavitárias ou planas com exsudação moderada a alta.', price: 'Uso Tópico • Troca 24h a 48h' },
      { name: 'Hidrogel Amorfo com Alginato', brand: 'Desbridamento autolítico e hidratação de tecidos necróticos secos.', price: 'Uso Tópico • Troca a cada 48h' },
      { name: 'Placa de Hidrocolóide Extra Fino', brand: 'Proteção e barreira em feridas limpas com baixo exsudato.', price: 'Uso Tópico • Troca até 7 dias' }
    ];

    if (userAllergies && userAllergies !== 'nenhuma declarada') {
      materials = materials.filter(m => !userAllergies.includes(m.name.toLowerCase()));
    }

    const scientificBacking = 'Resolução COFEN nº 567/2018 (Diretrizes para o tratamento de feridas por enfermeiros) • Consenso WUWHS (Manejo de Exsudato em Feridas/2019).';
    const specialistRecommendation = 'Se houver sinais de infecção sistêmica ou isquemia de membro (ITB < 0.5), encaminhar com urgência ao Cirurgião Vascular. Controle glicêmico com endocrinologista.';

    return {
      title,
      description,
      steps,
      materials,
      scientificBacking,
      specialistRecommendation,
      isLocalFallback: true
    };
  }

  const title = `Guia Clínico Personalizado: ${woundType} com ${
    [
      profile.hasDiabetes ? 'Diabetes' : null,
      profile.hasHypertension ? 'Hipertensão' : null,
      profile.hasVenousInsufficiency ? 'Insuficiência Venosa' : null,
      profile.hasPeripheralArterialDisease ? 'Doença Arterial Periférica' : null,
      profile.isSmoker ? 'Tabagismo' : null
    ].filter(Boolean).join(' + ') || 'Cuidados Gerais'
  }`;

  const description = `Este guia de cuidados foi preparado para ajudar ${profile.name || 'você'} a cuidar da sua ferida (${woundType}) no dia a dia, levando em conta suas condições de saúde. Siga as instruções com atenção.`;

  const steps = [
    { 
      title: 'Como Limpar o Ferimento', 
      desc: 'Lave a ferida delicadamente usando soro fisiológico 0.9% morno (se puder, aqueça levemente o frasco em banho-maria). Deixe o soro escorrer suavemente sobre a lesão. Nunca esfregue a ferida com gaze ou pano para não machucar a pele nova que está nascendo e não causar dor.' 
    }
  ];

  const necrose = latestWoundEntry?.aiTissueAnalysis?.necrose || 0;
  const fibrina = latestWoundEntry?.aiTissueAnalysis?.fibrina || 0;

  if (necrose > 0) {
    steps.push({
      title: 'Como Cuidar da Parte Preta (Casca Seca)',
      desc: 'Use um curativo em gel (como o Hidrogel). Ele ajuda a amolecer e remover essa casca preta de forma natural e sem dor. Aplique uma camada fina do gel apenas em cima da parte preta e proteja a pele saudável ao redor usando um creme protetor.'
    });
  } else if (fibrina > 0) {
    steps.push({
      title: 'Como Cuidar da Parte Amarela (Secreção Seca)',
      desc: 'Se a ferida estiver soltando líquido e tiver partes amarelas, use uma placa de Alginato de Cálcio. Esse curativo absorve o excesso de líquido e se transforma em uma gelatina macia, facilitando a limpeza e a remoção da sujeira.'
    });
  } else {
    steps.push({
      title: 'Como Ajudar a Pele Nova a Fechar (Parte Vermelha)',
      desc: 'Aplique óleo cicatrizante (óleo AGE, como Dersani) ou use um curativo de espuma. Isso mantém a ferida na umidade ideal para que a pele nova cresça e feche o machucado mais rápido.'
    });
  }

  if (profile.hasDiabetes) {
    steps.push({
      title: 'Exame dos Pés Todos os Dias (Pé Diabético)',
      desc: 'Olhe a sola dos seus pés e entre os dedos todos os dias (use um espelho para ajudar). Lave bem e seque muito bem com uma toalha macia, principalmente entre os dedos, para evitar frieiras ou rachaduras.'
    });
    steps.push({
      title: 'Evite Pisar com o Pé Machucado',
      desc: 'Não apoie o peso do corpo sobre o pé que está com a ferida. Use muletas, cadeiras ou sapatos especiais recomendados pelo seu médico para evitar que a ferida piore.'
    });
  }

  if (profile.hasVenousInsufficiency) {
    if (profile.hasPeripheralArterialDisease) {
      steps.push({
        title: '⚠️ Cuidados Especiais: Não Usar Meias Elásticas',
        desc: 'COMO VOCÊ POSSUI DOENÇA ARTERIAL PERIFÉRICA REGISTRADA, NÃO UTILIZE MEIAS ELÁSTICAS NEM COMPRESSÃO SEM AUTORIZAÇÃO EXPRESSA DO SEU CIRURGIÃO VASCULAR, POIS PODE PREJUDICAR A CIRCULAÇÃO.'
      });
    } else {
      steps.push({
        title: 'Cuidado com o Inchaço e Uso de Meias',
        desc: 'Se o seu médico indicou, use meias elásticas ou enfaixamento de compressão. Quando puder, deite-se e coloque as pernas para cima apoiadas em almofadas (acima da linha do coração) por 30 minutos, 3 vezes ao dia, para ajudar o sangue a circular.'
      });
    }
  }

  if (profile.hasHypertension) {
    steps.push({
      title: 'Controle o Sal e Meça a Pressão',
      desc: 'Meça sua pressão arterial todo dia. Evite comer sal, alimentos industrializados ou salgados. O excesso de sal faz o corpo acumular líquido e inchar as pernas, o que atrasa a cicatrização da ferida.'
    });
  }

  let materials = [];
  if (necrose > 0 || fibrina > 0) {
    materials.push({ name: 'Hidrogel Amorfo com Alginato (85g)', price: 'R$ 42,90', brand: 'Curatec' });
    materials.push({ name: 'Placa de Alginato de Cálcio (10x10cm)', price: 'R$ 28,50', brand: 'Curatec' });
  } else {
    materials.push({ name: 'Curativo Hidrocolóide Extra Fino (10x10cm)', price: 'R$ 18,90', brand: 'DuoDerm' });
  }
  materials.push({ name: 'Solução Antisséptica de PHMB (350ml)', price: 'R$ 62,00', brand: 'Prontosan' });
  materials.push({ name: 'Óleo Dersani AGE (100ml)', price: 'R$ 38,90', brand: 'Dersani' });

  if (userAllergies && userAllergies !== 'nenhuma declarada') {
    materials = materials.filter(m => !userAllergies.includes(m.name.toLowerCase()));
  }

  const scientificBacking = 'Resolução COFEN nº 567/2018 (Diretrizes para o tratamento de feridas por enfermeiros) • Manual de Condutas para Tratamento de Feridas do Ministério da Saúde, Brasil, 2016.';
  const specialistRecommendation = 'Necessário acompanhamento multidisciplinar: Cirurgião Vascular para avaliação de pulso/edema e Endocrinologista para controle do alvo glicêmico (HbA1c < 7.0%).';

  return {
    title,
    description,
    steps,
    materials,
    scientificBacking,
    specialistRecommendation,
    isLocalFallback: true
  };
}

const formatMaterialsForView = (materialsList, isClinician) => {
  if (!materialsList) return [];
  
  return materialsList.map(item => {
    const strPrice = String(item.price ?? '');
    const strBrand = String(item.brand ?? '');
    
    return {
      ...item,
      brand: strBrand || (isClinician ? 'Cobertura recomendada para o manejo da lesão.' : 'Marca recomendada'),
      price: strPrice || (isClinician ? 'Uso Tópico • Conforme evolução' : 'A consultar')
    };
  });
}

export default function ProtocolGuide({ currentUser, clinicalProfile, entries = [], setActiveTab: setAppActiveTab, onClose, embeddedMode = false }) {
  const [activeTab] = useState('ai-protocol');
  const [loading, setLoading] = useState(false);
  const [aiProtocol, setAiProtocol] = useState(null);
  const [dbRecommendedMaterials, setDbRecommendedMaterials] = useState([]);
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const latestWoundEntry = entries && entries.length > 0 ? entries[entries.length - 1] : null;
  const isClinician = currentUser?.role === 'doctor' || currentUser?.role === 'nurse';

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

  const handlePartnerRedirectClick = (itemName, partner) => {
    const doctorName = partner.type === 'irec_partner'
      ? 'iRec Oficial'
      : getDoctorName(partner.doctor_id);

    let link = partner.affiliate_link || '#';
    if (link !== '#' && !link.startsWith('http://') && !link.startsWith('https://')) {
      link = 'https://' + link;
    }

    setBookingModal({
      isOpen: true,
      itemName: String(itemName || ''),
      itemPrice: partner.price || 'A consultar',
      partnerName: partner.pharmacy_name || partner.brand || partner.name || 'Parceiro Credenciado',
      doctorName: doctorName,
      affiliateLink: link,
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
    }
    return () => clearTimeout(timer);
  }, [bookingModal.isOpen, bookingModal.countdown]);

  useEffect(() => {
    let cancelled = false;

    async function fetchProtocol() {
      if (activeTab !== 'ai-protocol' || !clinicalProfile) return;

      const userId = currentUser?.id || 'guest';
      const profileId = clinicalProfile.id || 'guest';
      const entryId = latestWoundEntry ? (latestWoundEntry.id || latestWoundEntry.createdAt) : 'no-entry';
      const cacheKey = `irec_cached_protocol_${userId}_${profileId}_${entryId}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const profileKeys = ['name', 'hasDiabetes', 'hasHypertension', 'hasVenousInsufficiency', 'hasPeripheralArterialDisease', 'isSmoker', 'isObese', 'medications', 'allergies', 'otherConditions'];
          const profileMatch = profileKeys.every(k => parsed.profile?.[k] === clinicalProfile[k]);
          const modeMatch = parsed.isClinician === isClinician || (parsed.isClinician === undefined && isClinician === false);
          
          if (profileMatch && modeMatch && parsed.protocol) {
            if (!cancelled) {
              setAiProtocol(parsed.protocol);
              setLoading(false);
            }
            return;
          }
        } catch (e) {
          console.error("Erro ao ler protocolo cacheado:", e);
        }
      }

      const fallbackProtocol = generateDefaultPersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
      if (!cancelled) {
        setAiProtocol(fallbackProtocol);
        setLoading(false);
      }

      try {
        const result = await generatePersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
        
        if (result && !cancelled) {
          setAiProtocol(result);
          
          const cacheData = {
            protocol: result,
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
        }
      } catch (err) {
        console.error("Failed to generate protocol in background:", err);
      }
    }

    fetchProtocol();

    return () => {
      cancelled = true;
    };
  }, [clinicalProfile, latestWoundEntry, activeTab, isClinician, currentUser?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadDbMaterials() {
      if (clinicalProfile && clinicalProfile.id) {
        try {
          const data = await getRecommendedMaterials(clinicalProfile.id);
          if (!cancelled) setDbRecommendedMaterials(data || []);
          
          const docs = await getAssignedDoctors(clinicalProfile.id);
          if (!cancelled) setAssignedDoctors(docs || []);
        } catch (e) {
          console.error("Erro ao carregar insumos do banco:", e);
        }
      }
    }

    loadDbMaterials();

    return () => {
      cancelled = true;
    };
  }, [clinicalProfile]);

  const getAvailablePartnersForMaterial = (itemName) => {
    const safeName = String(itemName ?? '').toLowerCase();

    const docSpecific = dbRecommendedMaterials.filter(m => {
      if (m.type !== 'doctor_partner') return false;
      if (!m.name || m.name.toLowerCase() !== safeName) return false;
      if (m.patient_id === clinicalProfile?.id) return true;
      const isAssigned = assignedDoctors.some(doc => doc.id === m.doctor_id);
      return m.patient_id === null && isAssigned;
    });

    const docGeneral = dbRecommendedMaterials.filter(m => {
      if (m.type !== 'doctor_general_partner') return false;
      const isAssigned = assignedDoctors.some(doc => doc.id === m.doctor_id);
      return isAssigned;
    });

    const irecSpecific = dbRecommendedMaterials.filter(m => {
      if (m.type !== 'irec_partner') return false;
      return m.name && m.name.toLowerCase() === safeName;
    });

    return {
      docSpecific,
      docGeneral,
      irecSpecific,
      hasAny: docSpecific.length > 0 || docGeneral.length > 0 || irecSpecific.length > 0
    };
  };

  const getStripeInfo = (name = '') => {
    const lowerName = String(name ?? '').toLowerCase();

    if (
      lowerName.includes('sabonete') || 
      lowerName.includes('syndet') || 
      lowerName.includes('gaze') || 
      lowerName.includes('atadura') || 
      lowerName.includes('fita') || 
      lowerName.includes('hidratante') || 
      lowerName.includes('protetor') || 
      lowerName.includes('óleo') ||
      lowerName.includes('vaselina') ||
      lowerName.includes('solução fisiológica') ||
      lowerName.includes('soro')
    ) {
      return {
        stripeColor: 'green',
        stripeLabel: 'Venda Livre / MIP',
        requiresPrescription: false,
        alertText: 'Medicamento Isento de Prescrição (MIP).'
      };
    }

    // Check for oral medications (requires prescription retention)
    if (lowerName.includes('comprimido') || lowerName.includes('cápsula') || lowerName.includes('oral') || lowerName.includes('comprimidos')) {
      return {
        stripeColor: 'red-retention',
        stripeLabel: 'Tarja Vermelha (Retenção)',
        requiresPrescription: true,
        alertText: 'Necessita de receita médica com retenção obrigatória.'
      };
    }

    // Default to Tarja Vermelha for dermatological treatments
    return {
      stripeColor: 'red',
      stripeLabel: 'Tarja Vermelha',
      requiresPrescription: true,
      alertText: 'Vendido somente sob prescrição médica.'
    };
  };

  const renderMedicineStripe = (stripeInfo) => {
    if (stripeInfo.stripeColor === 'green') {
      return (
        <div style={{
          height: '16px',
          width: '100%',
          backgroundColor: '#16a34a',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8.5px',
          fontWeight: '900',
          color: '#ffffff',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.15)',
          marginTop: '4px'
        }}>
          🌿 {stripeInfo.stripeLabel}
        </div>
      );
    }

    if (stripeInfo.stripeColor === 'red-retention') {
      return (
        <div style={{
          height: '16px',
          width: '100%',
          backgroundColor: '#dc2626',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8.5px',
          fontWeight: '900',
          color: '#ffffff',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)',
          position: 'relative',
          overflow: 'hidden',
          marginTop: '4px'
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: '#000000' }} />
          🔴 {stripeInfo.stripeLabel}
        </div>
      );
    }

    return (
      <div style={{
        height: '16px',
        width: '100%',
        backgroundColor: '#dc2626',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8.5px',
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.2)',
        marginTop: '4px'
      }}>
        🔴 {stripeInfo.stripeLabel}
      </div>
    );
  };

  const renderPrescriptionAlert = (stripeInfo) => {
    if (!stripeInfo.requiresPrescription) return null;

    return (
      <div style={{ 
        fontSize: '10px', 
        color: '#b45309', 
        backgroundColor: '#fffbeb', 
        border: '1px solid #fef3c7',
        padding: '6px 10px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '600',
        marginTop: '6px'
      }}>
        <span style={{ fontSize: '12px' }}>📄</span>
        <span>{stripeInfo.alertText}</span>
      </div>
    );
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

  const modalContent = (
    <div className="protocol-guide-modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div className="glass-card glass-card-cyan-glow protocol-guide-modal-card" style={{
        borderRadius: '24px',
        maxWidth: 'min(960px, 94vw)',
        width: '100%',
        maxHeight: 'calc(100vh - 48px)',
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        boxShadow: '0 20px 50px rgba(2, 132, 199, 0.15), 0 0 30px rgba(2, 132, 199, 0.08)',
        boxSizing: 'border-box'
      }}>
        {/* 1. FIXED HEADER LAYER */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(2, 132, 199, 0.15)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'flex-start',
          backgroundColor: 'rgba(2, 132, 199, 0.05)',
          flexShrink: 0,
          gap: '16px'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: '#0284c7',
              fontSize: '11px',
              fontWeight: '800',
              padding: '4px 12px',
              borderRadius: '50px',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              marginBottom: '6px'
            }}>
              📋 ORIENTAÇÃO & CONDUTAS CLÍNICAS
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Guia de Protocolos Terapêuticos Personalizados
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: '500' }}>
              {clinicalProfile?.name ? `Paciente: ${clinicalProfile.name}` : 'Instruções seguras para desbridamento, curativo e controle de comorbidades'}
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Fechar Janela"
              className="no-print"
              style={{
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                color: '#0284c7',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. SCROLLABLE BODY LAYER */}
        <div className="irec-glass-scroll protocol-guide-scroll-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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

      {/* AI Dynamic Protocol view */}
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
                  Apoio à Decisão Clínica
                </span>
              </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4', margin: '8px 0 0 0' }}>
                  {aiProtocol.description}
                </p>
                
                {/* Transparency Disclaimer Box */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: aiProtocol.isLocalFallback ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                  border: aiProtocol.isLocalFallback ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '11px',
                  color: aiProtocol.isLocalFallback ? '#f59e0b' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '600'
                }}>
                  {aiProtocol.isLocalFallback ? (
                    <>
                      <span>ℹ️</span>
                      <span><strong>Diretriz Clínica Integrada:</strong> Gerado com base nas diretrizes oficiais do Ministério da Saúde e COFEN.</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span><strong>Guia Clínico Estruturado iRec:</strong> Elaborado e otimizado dinamicamente com base nas melhores evidências clínicas.</span>
                    </>
                  )}
                </div>
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
                        {isClinician ? 'Terapêuticas e Coberturas Sugeridas (Apoio à Prescrição)' : 'Insumos Sugeridos pelo Protocolo Clínico'}
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                        {formatMaterialsForView(aiProtocol.materials, isClinician).map((item, idx) => {
                          const stripeInfo = getStripeInfo(item.name);
                          return (
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
                                  {renderMedicineStripe(stripeInfo)}
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

                              {renderPrescriptionAlert(stripeInfo)}

                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                                {!isClinician && renderCheckoutButtons(item)}
                                {isClinician && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    ✓ Indicado no Protocolo Clínico
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
            </div>
          )}
        </div>
      </div>
    </div>

        {/* 3. FIXED FOOTER LAYER */}
        <div className="no-print" style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(2, 132, 199, 0.15)',
          backgroundColor: 'rgba(2, 132, 199, 0.03)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '30px',
                padding: '8px 18px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🖨️</span>
              <span>Imprimir Protocolo</span>
            </button>
          </div>

          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Baseado em Diretrizes COFEN & Consenso WUWHS
          </span>
        </div>
      </div>

      <style>{`
        @media print {
          .protocol-guide-modal-backdrop {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            display: block !important;
            z-index: 999999 !important;
          }
          .protocol-guide-modal-card {
            max-width: 100% !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            display: block !important;
          }
          .protocol-guide-scroll-body {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            color: #0f172a !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );

  if (!embeddedMode && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
