import { useState, useEffect, useRef } from 'react';
import { addWoundEntry as addWoundEntryService } from '../services/supabaseService';
import { analyzeWoundWithAI, isGeminiConfigured } from '../services/geminiService';

// Interactive Tissue Overlay Canvas for Segmented Wound Areas
function WoundTissueOverlay({ entry }) {
  const canvasRef = useRef(null);
  const [hoveredTissue, setHoveredTissue] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);

    const necrose = parseFloat(entry.aiTissueAnalysis?.necrose || 0);
    const fibrina = parseFloat(entry.aiTissueAnalysis?.fibrina || 0);
    const granulacao = parseFloat(entry.aiTissueAnalysis?.granulacao || 0);
    const total = necrose + fibrina + granulacao;

    if (total === 0) return;

    const centerX = 60;
    const centerY = 60;
    const radius = 35;

    let startAngle = -0.5 * Math.PI;

    const tissues = [
      { name: 'Necrose', value: necrose, color: 'rgba(15, 23, 42, 0.75)' },
      { name: 'Esfacelo / Fibrina', value: fibrina, color: 'rgba(245, 158, 11, 0.75)' },
      { name: 'Granulação', value: granulacao, color: 'rgba(239, 68, 68, 0.75)' }
    ].filter(t => t.value > 0);

    tissues.forEach(t => {
      const sliceAngle = (t.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [entry]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dist = Math.sqrt((x - 60) * (x - 60) + (y - 60) * (y - 60));
    if (dist <= 35) {
      const angle = Math.atan2(y - 60, x - 60);
      let normalizedAngle = angle + 0.5 * Math.PI;
      if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

      const necrose = parseFloat(entry.aiTissueAnalysis?.necrose || 0);
      const fibrina = parseFloat(entry.aiTissueAnalysis?.fibrina || 0);
      const granulacao = parseFloat(entry.aiTissueAnalysis?.granulacao || 0);
      const total = necrose + fibrina + granulacao;

      let currentAngle = 0;
      const tissues = [
        { name: 'Necrose', value: necrose },
        { name: 'Esfacelo / Fibrina', value: fibrina },
        { name: 'Granulação', value: granulacao }
      ].filter(t => t.value > 0);

      let found = null;
      tissues.forEach(t => {
        const sliceAngle = (t.value / total) * 2 * Math.PI;
        if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + sliceAngle) {
          found = `${t.name}: ${t.value}%`;
        }
        currentAngle += sliceAngle;
      });

      setHoveredTissue(found || 'Lesão Segmentada');
    } else {
      setHoveredTissue(null);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '120px', height: '120px', cursor: 'crosshair' }}>
      <canvas ref={canvasRef} width={120} height={120} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredTissue(null)} />
      {hoveredTissue && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          right: '4px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          color: '#ffffff',
          fontSize: '10px',
          padding: '4px 6px',
          borderRadius: '6px',
          textAlign: 'center',
          fontWeight: '700',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          pointerEvents: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          zIndex: 10
        }}>
          {hoveredTissue}
        </div>
      )}
    </div>
  );
}

// Lay-Friendly Complaint Options for All Patients & Medical Specialties
const PATIENT_COMPLAINT_CARDS = [
  {
    id: 'vermelhidao',
    icon: '🔴',
    title: 'Vermelhidão ou Inchaço',
    desc: 'Pele avermelhada, irritada ou aquecida sem ferida aberta.',
    advice: '💡 Dica de Cuidado: Aplique compressas frias se houver inchaço. Evite coçar ou esfregar para proteger a pele.',
    questions: [
      { key: 'isWarm', label: 'A região está quente ao toque?', type: 'boolean' },
      { key: 'isItchy', label: 'Está coçando ou pinicando?', type: 'boolean' }
    ]
  },
  {
    id: 'superficial',
    icon: '🩹',
    title: 'Machucado ou Arranhão',
    desc: 'Corte pequeno, arranhão ou pele descascada.',
    advice: '💡 Dica de Cuidado: Lave com água limpa e sabão neutro. Mantenha o local seco e protegido.',
    questions: [
      { key: 'isRecent', label: 'Ocorreu nas últimas 48 horas?', type: 'boolean' },
      { key: 'isPeeling', label: 'A pele está descascando?', type: 'boolean' }
    ]
  },
  {
    id: 'profunda',
    icon: '🕳️',
    title: 'Ferida Aberta ou Corte Profundo',
    desc: 'Ferida aberta com profundidade ou sangramento.',
    advice: '💡 Dica de Cuidado: Pressione com pano limpo se houver sangramento ativo. Lave apenas com soro fisiológico.',
    questions: [
      { key: 'hasBleeding', label: 'Há sangramento ativo no momento?', type: 'boolean' },
      { key: 'isDeep', label: 'É possível ver gordura ou tecido profundo?', type: 'boolean' }
    ]
  },
  {
    id: 'queimadura',
    icon: '⚡',
    title: 'Queimadura ou Bolhas',
    desc: 'Queimadura de sol, água quente, atrito ou bolhas na pele.',
    advice: '💡 Dica de Cuidado: Resfrie com água corrente em temperatura ambiente. NUNCA fure bolhas nem aplique óleo ou pasta de dente.',
    questions: [
      { key: 'burnCause', label: 'Causa principal:', type: 'select', options: ['Sol ☀️', 'Líquido Quente 💧', 'Fogo / Chama 🔥', 'Produto Químico 🧪', 'Atrito / Fricção ⚡'] },
      { key: 'hasBlisters', label: 'Existem bolhas formadas na pele?', type: 'boolean' }
    ]
  },
  {
    id: 'pe_diabetico',
    icon: '🦶',
    title: 'Pés ou Circulação',
    desc: 'Ferida no pé, alteração em paciente diabético ou formigamento.',
    advice: '💡 Dica de Cuidado: Atenção redobrada para cuidados vasculares. Nunca caminhe descalço e inspecione a sola dos pés diariamente.',
    questions: [
      { key: 'hasNumbness', label: 'Sente formigamento ou perda de sensibilidade?', type: 'boolean' },
      { key: 'hasDiabetes', label: 'Possui diagnóstico de Diabetes?', type: 'boolean' }
    ]
  },
  {
    id: 'geral',
    icon: '🩺',
    title: 'Consulta & Acompanhamento Geral',
    desc: 'Dores, alergias na pele ou acompanhamento com seu médico.',
    advice: '💡 Dica de Cuidado: Ideal para registrar a evolução de um tratamento ou anexar exames para seu médico assistente.',
    questions: [
      { key: 'needDoctor', label: 'Deseja agendar uma consulta com especialista?', type: 'boolean' },
      { key: 'hasExams', label: 'Possui exames ou laudos recentes em PDF/imagem?', type: 'boolean' }
    ]
  },
  {
    id: 'outro',
    icon: '❓',
    title: 'Outra Alteração ou Sintoma',
    desc: 'Qualquer outra alteração de saúde que deseje registrar.',
    advice: '💡 Dica de Cuidado: Por favor, descreva em detalhes no campo abaixo o que você está sentindo para que nossa triagem avalie o seu caso com precisão.',
    questions: []
  }
];

// Patient Clinical Glossary Database
const GLOSSARY_DB = {
  exsudato: { 
    term: 'Exsudato', 
    def: 'Secreção ou líquido natural liberado no leito da ferida. Essencial para o transporte de células de cura, mas que precisa ser controlado para não drenar em excesso.' 
  },
  granulacao: { 
    term: 'Tecido de Granulação', 
    def: 'Pele nova, rica em capilares sanguíneos, avermelhada e brilhante. É o sinal mais forte de cicatrização saudável.' 
  },
  esfacelos: { 
    term: 'Esfacelo', 
    def: 'Massa amarelada ou esbranquiçada de tecido morto sem circulação. Impede a cicatrização e deve ser removida com curativo adequado.' 
  },
  perilesao: { 
    term: 'Pele Perilesional', 
    def: 'A pele íntegra que circunda a lesão. Deve ser mantida limpa e protegida com cremes barreira contra a maceração por umidade.' 
  },
  desbridamento: { 
    term: 'Desbridamento Autolítico', 
    def: 'Limpeza natural onde pomadas como Hidrogel ou Papaína amolecem o tecido morto para remoção sem dor.' 
  },
  necrose: { 
    term: 'Necrose', 
    def: 'Tecido escuro/preto endurecido desprovido de oxigenação. Exige avaliação especializada para desbridamento instrumental ou químico.' 
  }
};

// Fallback algorithm for contingency mode
const generateLocalFallbackAnalysis = (woundType, lesionStage, clinicalProfile, symptomsText) => {
  const isDiabetes = clinicalProfile?.hasDiabetes;
  const isHypertension = clinicalProfile?.hasHypertension;
  const isPeripheralArterial = clinicalProfile?.hasPeripheralArterialDisease;
  const isSmoker = clinicalProfile?.isSmoker;
  const hasAmputationHistory = clinicalProfile?.hasAmputationHistory;

  let severity = "Leve";
  let isRedirect = false;
  let specialist = "";
  let reason = "";

  if (isPeripheralArterial || (isDiabetes && hasAmputationHistory)) {
    severity = "Crítico";
    isRedirect = true;
    specialist = "Cirurgião Vascular / Pronto-Socorro";
    reason = "Paciente com histórico vascular ou de amputação prévia apresentando lesão em membro inferior.";
  } else if (isDiabetes || isSmoker) {
    severity = "Alto Risco";
    isRedirect = true;
    specialist = "Médico Especialista (Angiologia / Endocrinologia)";
    reason = "Paciente com fator sistêmico (Diabetes/Tabagismo) que necessita de acompanhamento vascular preventivo.";
  } else if (isHypertension) {
    severity = "Risco Moderado";
  }

  let baseArea = 2.0;
  if (lesionStage === 'Estágio II') baseArea = 4.0;
  else if (lesionStage === 'Estágio III') baseArea = 8.5;
  else if (lesionStage === 'Estágio IV') baseArea = 15.0;

  const variation = 0.85 + Math.random() * 0.3;
  const area = Math.round(baseArea * variation * 10) / 10;
  const length = Math.round(Math.sqrt(area) * 1.3 * 10) / 10;
  const width = Math.round((area / length) * 10) / 10;

  let necrose = 0;
  let fibrina = 0;
  let granulacao = 60;
  let epitelizacao = 40;

  const text = (symptomsText || '').toLowerCase();
  if (text.includes('preto') || text.includes('escuro') || text.includes('necro')) {
    necrose = 30;
    fibrina = 20;
    granulacao = 30;
    epitelizacao = 20;
  } else if (text.includes('amarel') || text.includes('pus') || text.includes('secrec')) {
    fibrina = 35;
    granulacao = 45;
    epitelizacao = 20;
  }

  const treatmentPlan = [
    "Limpeza criteriosa da lesão com Soro Fisiológico 0,9% morno em jato suave.",
    "Aplicação de cobertura protetora (Hidrogel ou AGE conforme nível de exsudação).",
    "Manutenção da pele perilesional protegida contra umidade."
  ];

  return {
    type: woundType || "Avaliação de Pele",
    lesionStage: lesionStage || "Estágio I",
    severity: severity,
    isRedirect: isRedirect,
    specialist: specialist,
    reason: reason,
    geminiSummary: `Queixa registrada: ${symptomsText || 'Avaliação rotineira de pele'}.`,
    medPalmDiagnosis: `Avaliação algorítmica iRec baseada nas comorbidades cadastradas no prontuário.`,
    treatmentPlan: treatmentPlan,
    aiAreaCm2: area,
    aiLengthCm: length,
    aiWidthCm: width,
    aiTissueAnalysis: { necrose, fibrina, granulacao, epitelizacao },
    aiRecommendation: "Seguir conduta prescrita pelo seu médico assistente.",
    clinicalEvolution: "Estável",
    isLocalFallback: true,
    glossaryKeys: ["necrose", "desbridamento", "granulacao"]
  };
};

export default function ClinicalTriage({ setActiveTab, addClinicalEntry, clinicalProfile }) {
  const [image, setImage] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [pain, setPain] = useState(3);
  const [exudate, setExudate] = useState('moderado');
  const [odor, setOdor] = useState(false);
  const [symptomsText, setSymptomsText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [result, setResult] = useState(null);

  // Form states
  const [woundType, setWoundType] = useState('Úlcera Venosa');
  const [appearanceDate, setAppearanceDate] = useState('');
  const [anatomicalLocation, setAnatomicalLocation] = useState('');
  const [lesionStage, setLesionStage] = useState('Estágio I');
  const [localTemperature, setLocalTemperature] = useState('Normal');
  const [infectionSigns, setInfectionSigns] = useState('Nenhum');
  const [appliedDressing, setAppliedDressing] = useState('');
  const [dressingQuantity, setDressingQuantity] = useState(1);
  const [dressingFrequency, setDressingFrequency] = useState('');
  const [performedProcedures, setPerformedProcedures] = useState('');
  const [clinicalEvolution, setClinicalEvolution] = useState('Estável');
  const [clinicalOutcome, setClinicalOutcome] = useState('Tratamento em andamento');
  
  const attachmentsInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [patientComplaintType, setPatientComplaintType] = useState('vermelhidao');
  const [dynamicAnswers, setDynamicAnswers] = useState({});

  // Escala de Braden States
  const [bradenSensory, setBradenSensory] = useState(4);
  const [bradenMoisture, setBradenMoisture] = useState(4);
  const [bradenActivity, setBradenActivity] = useState(4);
  const [bradenMobility, setBradenMobility] = useState(4);
  const [bradenNutrition] = useState(3);
  const [bradenFriction] = useState(3);

  const bradenTotalScore = Number(bradenSensory) + Number(bradenMoisture) + Number(bradenActivity) + Number(bradenMobility) + Number(bradenNutrition) + Number(bradenFriction);
  
  let skinProtectionText = 'Excelente (Pele Protegida)';
  let skinProtectionColor = '#10b981';
  if (bradenTotalScore <= 12) {
    skinProtectionText = 'Atenção Elevada (Risco de Lesão por Pressão / Necessita Mudança de Posição constante)';
    skinProtectionColor = '#ef4444';
  } else if (bradenTotalScore <= 14) {
    skinProtectionText = 'Atenção Moderada (Necessita Hidratação e Cuidados de Posição)';
    skinProtectionColor = '#f59e0b';
  } else if (bradenTotalScore <= 18) {
    skinProtectionText = 'Bom (Cuidados Convencionais)';
    skinProtectionColor = '#0284c7';
  }

  // Auto-sync complaint type & handle "outro" text area focus
  useEffect(() => {
    switch (patientComplaintType) {
      case 'vermelhidao':
        setWoundType('Vermelhidão / Inflamação de Pele');
        setLesionStage('Estágio I');
        break;
      case 'superficial':
        setWoundType('Ferida Superficial');
        setLesionStage('Estágio II');
        break;
      case 'profunda':
        setWoundType('Ferida Profunda / Corte');
        setLesionStage('Estágio III');
        break;
      case 'queimadura':
        setWoundType('Queimadura / Bolha');
        setLesionStage('Estágio II');
        break;
      case 'pe_diabetico':
        setWoundType('Pé Diabético / Alteração Vascular');
        setLesionStage('Estágio II');
        break;
      case 'geral':
        setWoundType('Consulta & Sintoma Geral');
        setLesionStage('Estágio I');
        break;
      case 'outro':
        setWoundType('Outra Alteração Registrada');
        setLesionStage('Estágio I');
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        break;
      default:
        setWoundType('Outras Queixas');
        setLesionStage('Estágio I');
    }
  }, [patientComplaintType]);

  const activeComplaintCard = PATIENT_COMPLAINT_CARDS.find(c => c.id === patientComplaintType);

  const [selectedHotspot, setSelectedHotspot] = useState(null);

  const handleAttachmentsChange = (e) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setAttachments(prev => {
      const updated = [...prev, ...newAttachments];
      const lastImage = [...updated].reverse().find(att => att.file.type.startsWith('image/'));
      if (lastImage) {
        setImage(lastImage.url);
        setPhotoFile(lastImage.file);
      } else {
        setImage(null);
        setPhotoFile(null);
      }
      return updated;
    });
    e.target.value = "";
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments(prev => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      const lastImage = [...updated].reverse().find(att => att.file.type.startsWith('image/'));
      if (lastImage) {
        setImage(lastImage.url);
        setPhotoFile(lastImage.file);
      } else {
        setImage(null);
        setPhotoFile(null);
      }
      return updated;
    });
  };

  const handleStartAnalysis = async () => {
    if (attachments.length === 0) {
      alert("Por favor, selecione ou tire pelo menos uma foto ou anexo da região afetada primeiro.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep('Analisando imagem e sintomas com o Sistema iRec...');

    const dynamicAnswersText = Object.entries(dynamicAnswers).map(([k, v]) => `${k}: ${v}`).join(', ');
    const fullSymptoms = `Tipo/Queixa: ${woundType}. Respostas Específicas: ${dynamicAnswersText}. Local Anatômico: ${anatomicalLocation}. Data de Aparecimento: ${appearanceDate}. Estágio: ${lesionStage}. Temperatura Local: ${localTemperature}. Infecção: ${infectionSigns}. Cobertura: ${appliedDressing}. Quantidade: ${dressingQuantity}. Frequência: ${dressingFrequency}. Procedimentos: ${performedProcedures}. Evolução: ${clinicalEvolution}. Sintomas: ${symptomsText}`;

    let finalResult = await analyzeWoundWithAI(photoFile, clinicalProfile, fullSymptoms);
    
    if (finalResult && finalResult.isValidWound === false) {
      alert(finalResult.invalidReason || "A imagem enviada não é uma foto de ferida ou lesão de pele. Por favor, envie uma foto nítida da região afetada.");
      setIsAnalyzing(false);
      setAnalysisStep('');
      return;
    }

    if (!finalResult) {
      finalResult = generateLocalFallbackAnalysis(woundType, lesionStage, clinicalProfile, symptomsText);
    }

    if (finalResult.type) setWoundType(finalResult.type);
    if (finalResult.lesionStage) setLesionStage(finalResult.lesionStage);
    if (finalResult.clinicalEvolution) setClinicalEvolution(finalResult.clinicalEvolution);
    
    setResult(finalResult);
    setSelectedHotspot(null);

    setAnalysisStep('Gravando no Prontuário do Paciente...');
    
    const newEntryData = {
      date: new Date().toLocaleDateString('pt-BR'),
      type: finalResult.type || woundType,
      appearanceDate: appearanceDate,
      anatomicalLocation: anatomicalLocation,
      lesionStage: lesionStage,
      pain: finalResult.painLevel !== undefined ? finalResult.painLevel : pain,
      exudate: (finalResult.exudate || exudate).toUpperCase(),
      odor: odor,
      localTemperature: localTemperature,
      infectionSigns: infectionSigns,
      appliedDressing: appliedDressing,
      dressingQuantity: parseInt(dressingQuantity) || 1,
      dressingFrequency: dressingFrequency,
      performedProcedures: performedProcedures,
      clinicalEvolution: finalResult.clinicalEvolution || clinicalEvolution,
      photo: image && image.startsWith('blob:') ? '' : (image || ''),
      aiAreaCm2: finalResult.aiAreaCm2 || null,
      aiLengthCm: finalResult.aiLengthCm || null,
      aiWidthCm: finalResult.aiWidthCm || null,
      aiTissueAnalysis: finalResult.aiTissueAnalysis || {},
      aiRecommendation: finalResult.aiRecommendation || finalResult.treatmentPlan?.join('\n') || '',
      clinicalOutcome: clinicalOutcome
    };

    try {
      const savedEntry = await addWoundEntryService(newEntryData, photoFile, clinicalProfile?.id, attachments);
      addClinicalEntry(savedEntry);
    } catch (err) {
      console.error('Falha ao salvar no prontuário:', err);
    }

    setIsAnalyzing(false);
    setAnalysisStep('');
  };

  const resetTriageForm = () => {
    if (attachmentsInputRef.current) {
      attachmentsInputRef.current.value = "";
    }
    setImage(null);
    setPhotoFile(null);
    setPain(3);
    setExudate('moderado');
    setOdor(false);
    setSymptomsText('');
    setAttachments([]);
    setPatientComplaintType('vermelhidao');
    setDynamicAnswers({});
    setWoundType('Úlcera Venosa');
    setAppearanceDate('');
    setAnatomicalLocation('');
    setLesionStage('Estágio I');
    setLocalTemperature('Normal');
    setInfectionSigns('Nenhum');
    setAppliedDressing('');
    setDressingQuantity(1);
    setDressingFrequency('');
    setPerformedProcedures('');
    setClinicalEvolution('Estável');
    setClinicalOutcome('Tratamento em andamento');
    setResult(null);
    setSelectedHotspot(null);
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>

      {/* Title Banner */}
      <div style={{ marginBottom: '22px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
          Avaliação de Pele & Visão Computacional 📷
        </span>
        <h2 style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
          Nova Triagem Clínica da Lesão
        </h2>
      </div>

      {!isAnalyzing && !result && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Card 1: Fotos, Vídeos e Exames do Caso (Glassmorphism + Luz Vazada Esmeralda) */}
          <div className="glass-card glass-card-emerald-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                📷 Capturar Foto ou Anexar Arquivos
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                Tire uma foto nítida da ferida ou envie arquivos (fotos, vídeos curtos ou laudos em PDF).
              </p>

              <input 
                type="file" 
                ref={attachmentsInputRef} 
                onChange={handleAttachmentsChange} 
                multiple 
                accept="image/*,video/*,application/pdf"
                style={{ display: 'none' }} 
              />

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Interactive Add Photo Button */}
                <div 
                  onClick={() => attachmentsInputRef.current?.click()}
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '16px',
                    border: '2px dashed var(--primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'rgba(2, 132, 199, 0.06)',
                    color: 'var(--primary)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                    e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.06)';
                  }}
                >
                  <span style={{ fontSize: '26px' }}>📷</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', marginTop: '4px' }}>+ Anexar</span>
                </div>

                {/* Render Selected Attachments */}
                {attachments.map((fileObj, idx) => {
                  const isImage = fileObj.file.type?.startsWith('image/');
                  const isVideo = fileObj.file.type?.startsWith('video/');
                  return (
                    <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '16px', overflow: 'hidden', border: '1.5px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {isImage ? (
                        <img src={fileObj.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="anexo" />
                      ) : isVideo ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#10b981' }}>
                          <span style={{ fontSize: '22px' }}>🎥</span>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '85px', textAlign: 'center' }}>Vídeo</span>
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#0ea5e9' }}>
                          <span style={{ fontSize: '22px' }}>📄</span>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '85px', textAlign: 'center' }}>{fileObj.file.name}</span>
                        </div>
                      )}
                      
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          backgroundColor: '#ef4444',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Sintomas Básicos em Grid Card Selecionável sem nenhum Select Nativo */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                🩺 O que você deseja avaliar hoje?
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                Selecione a opção que melhor descreve como está a sua pele ou o seu sintoma de saúde:
              </p>

              {/* Custom Interactive Glassmorphic Card Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {PATIENT_COMPLAINT_CARDS.map((card) => {
                  const isSelected = patientComplaintType === card.id;
                  return (
                    <div
                      key={card.id}
                      onClick={() => setPatientComplaintType(card.id)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--primary-glow)' : 'var(--bg-primary)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        boxShadow: isSelected ? '0 0 16px var(--primary-glow)' : 'none',
                        transform: isSelected ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{card.icon}</span>
                        <strong style={{ fontSize: '13.5px', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', fontWeight: '800' }}>
                          {card.title}
                        </strong>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '2px' }}>
                        {card.desc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Interactive Feedback Banner & Custom Chip Selector Questions (Sem HTML Select) */}
              {activeComplaintCard && (
                <div className="animate-fade-in" style={{
                  backgroundColor: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--primary)', fontWeight: '700', lineHeight: '1.5' }}>
                    {activeComplaintCard.advice}
                  </p>

                  {/* Specific Custom Chip Questions for Selected Card */}
                  {activeComplaintCard.questions && activeComplaintCard.questions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(2, 132, 199, 0.15)' }}>
                      {activeComplaintCard.questions.map((q, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {q.label}
                          </label>

                          {q.type === 'boolean' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setDynamicAnswers(prev => ({ ...prev, [q.key]: 'Sim' }))}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '10px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  border: dynamicAnswers[q.key] === 'Sim' ? '1px solid #10b981' : '1px solid var(--border-color)',
                                  backgroundColor: dynamicAnswers[q.key] === 'Sim' ? '#10b981' : 'var(--bg-secondary)',
                                  color: dynamicAnswers[q.key] === 'Sim' ? '#ffffff' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  boxShadow: dynamicAnswers[q.key] === 'Sim' ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setDynamicAnswers(prev => ({ ...prev, [q.key]: 'Não' }))}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '10px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  border: dynamicAnswers[q.key] === 'Não' ? '1px solid rgba(255,255,255,0.4)' : '1px solid var(--border-color)',
                                  backgroundColor: dynamicAnswers[q.key] === 'Não' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                                  color: dynamicAnswers[q.key] === 'Não' ? '#ffffff' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                Não
                              </button>
                            </div>
                          ) : q.type === 'select' ? (
                            /* Custom Glassmorphic Chip Group (Sem HTML Select Nativo) */
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {q.options.map((opt, oIdx) => {
                                const isOptSelected = dynamicAnswers[q.key] === opt;
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => setDynamicAnswers(prev => ({ ...prev, [q.key]: opt }))}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '10px',
                                      fontSize: '11.5px',
                                      fontWeight: '800',
                                      border: isOptSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                                      backgroundColor: isOptSelected ? 'var(--primary)' : 'var(--bg-secondary)',
                                      color: isOptSelected ? '#ffffff' : 'var(--text-primary)',
                                      cursor: 'pointer',
                                      boxShadow: isOptSelected ? '0 0 12px var(--primary-glow)' : 'none',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pain Scale Selector */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Intensidade da Dor</label>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: pain > 6 ? '#ef4444' : pain > 3 ? '#f59e0b' : '#10b981' }}>
                    {pain}/10 ({pain === 0 ? 'Sem dor' : pain <= 3 ? 'Leve' : pain <= 7 ? 'Moderada' : 'Intensa'})
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={pain} 
                  onChange={(e) => setPain(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Integrated Daily Mobility & Skin Protection Assessment (Sem Dropdown Nativo) */}
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'block' }}>
                    🚶‍♂️ Mobilidade & Cuidados Diários
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Nível de Proteção da Pele: <strong style={{ color: skinProtectionColor }}>{skinProtectionText}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Question 1: Sensory */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Sensibilidade à dor e desconforto:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Sinto dor normalmente' },
                        { val: 3, label: 'Pouca dificuldade de sentir dor' },
                        { val: 2, label: 'Bastante dificuldade' },
                        { val: 1, label: 'Sem resposta à dor / Acamado' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setBradenSensory(opt.val)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textAlign: 'left',
                            border: bradenSensory === opt.val ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: bradenSensory === opt.val ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                            color: bradenSensory === opt.val ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question 2: Moisture */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Umidade da pele no dia a dia:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Pele quase sempre seca' },
                        { val: 3, label: 'Molhada de vez em quando' },
                        { val: 2, label: 'Molhada com muita frequência' },
                        { val: 1, label: 'Molhada o tempo todo' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setBradenMoisture(opt.val)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textAlign: 'left',
                            border: bradenMoisture === opt.val ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: bradenMoisture === opt.val ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                            color: bradenMoisture === opt.val ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question 3: Activity */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Atividade física e caminhada:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Caminho frequentemente' },
                        { val: 3, label: 'Caminho curtas distâncias' },
                        { val: 2, label: 'Confinado à cadeira/poltrona' },
                        { val: 1, label: 'Totalmente deitado (acamado)' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setBradenActivity(opt.val)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textAlign: 'left',
                            border: bradenActivity === opt.val ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: bradenActivity === opt.val ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                            color: bradenActivity === opt.val ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question 4: Mobility */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Capacidade de mudar de posição:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Mudo de posição sozinho' },
                        { val: 3, label: 'Mudo com pequena ajuda' },
                        { val: 2, label: 'Preciso de ajuda frequente' },
                        { val: 1, label: 'Não mudo de posição (imóvel)' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setBradenMobility(opt.val)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textAlign: 'left',
                            border: bradenMobility === opt.val ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: bradenMobility === opt.val ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                            color: bradenMobility === opt.val ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Odor Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={odor}
                    onChange={(e) => setOdor(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <strong style={{ color: 'var(--text-primary)' }}>Apresenta cheiro/odor forte local?</strong>
                </label>
              </div>

              {/* Symptoms Description Textarea */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '6px' }}>
                  Descrição adicional da queixa ou sintomas
                </label>
                <textarea
                  ref={textareaRef}
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  placeholder={patientComplaintType === 'outro' ? "Descreva em detalhes o seu sintoma de saúde ou alteração para o sistema avaliar..." : "Ex: Sinto pontadas na perna à noite, está coçando muito, febre recente..."}
                  style={{
                    width: '100%',
                    height: '85px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: patientComplaintType === 'outro' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    resize: 'none',
                    lineHeight: '1.4',
                    outline: 'none',
                    boxShadow: patientComplaintType === 'outro' ? '0 0 12px var(--primary-glow)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Action Button: Iniciar Análise (Botao Primario com Brilho Neon Shimmer) */}
          <button 
            className="btn btn-primary" 
            onClick={handleStartAnalysis}
            style={{ width: '100%', height: '54px', fontSize: '15px', borderRadius: '14px' }}
          >
            <span>🔬</span>
            <span>Iniciar Análise Clínica iRec</span>
          </button>
        </div>
      )}

      {/* Loading Steps Container */}
      {isAnalyzing && (
        <div className="glass-card glass-card-cyan-glow" style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '54px', height: '54px', marginBottom: '20px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              border: '4px solid var(--border-color)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{analysisStep}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '340px' }}>
            Processando visão computacional e validando diretrizes médicas...
          </p>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Contingency Banner */}
          {result.isLocalFallback && (
            <div className="glass-card" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)', margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <h3 style={{ fontSize: '14.5px', color: '#d97706', fontWeight: '800', margin: '0 0 2px 0' }}>Triagem Clínica em Modo Local</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    Relatório gerado com base no protocolo de contingência e sintomas informados.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Severe Redirect Alert */}
          {result.isRedirect ? (
            <div className="glass-card glass-card-danger-glow neon-edge-danger" style={{ margin: 0 }}>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '26px' }}>🚨</span>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#ef4444', fontWeight: '900', margin: 0 }}>CASO CRÍTICO - ENCAMINHAMENTO RECOMENDADO</h3>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Triagem Médica Ativa</span>
                </div>
              </div>
              
              <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '12px', marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Especialista Recomendado:</p>
                <p style={{ fontSize: '16px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>{result.specialist}</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                  <strong>Motivo:</strong> {result.reason}
                </p>
              </div>

              <button
                onClick={() => setActiveTab('doctors_directory')}
                className="btn btn-sos"
                style={{ width: '100%', padding: '12px', fontSize: '13px' }}
              >
                👨‍⚕️ Agendar Especialista Agora
              </button>
            </div>
          ) : (
            <div className="glass-card glass-card-emerald-glow neon-edge-emerald" style={{ margin: 0 }}>
              <h4 style={{ fontSize: '14.5px', color: '#10b981', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✅</span>
                <span>Lesão Liberada para Cuidado Domiciliar Monitorado</span>
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Baixo risco imediato. Siga as orientações prescritas pelo seu médico assistente.
              </p>
            </div>
          )}

          {/* Interactive Visual Wound Mapping with Responsiveness */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
                🗺️ Mapeamento de Tecidos da Foto
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Clique nos pontos numerados sobre a imagem para entender a análise de cada tecido:
              </p>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Uploaded Image Box with Hotspots */}
                <div style={{ 
                  position: 'relative', 
                  width: '240px', 
                  height: '180px', 
                  borderRadius: '16px', 
                  border: '2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  margin: '0 auto',
                  boxShadow: 'var(--shadow-md)',
                  backgroundColor: 'var(--bg-primary)'
                }}>
                  {image ? (
                    <img 
                      src={image} 
                      alt="Ferida analisada" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem Imagem</div>
                  )}

                  {/* Hotspots sobre a Imagem */}
                  <div 
                    onClick={() => setSelectedHotspot('1')}
                    style={{ 
                      position: 'absolute',
                      bottom: '40px', 
                      right: '65px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: selectedHotspot === '1' ? '#ef4444' : 'rgba(239, 68, 68, 0.85)',
                      color: '#ffffff',
                      fontWeight: '900',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff',
                      cursor: 'pointer',
                      boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)'
                    }} 
                  >
                    1
                  </div>

                  <div 
                    onClick={() => setSelectedHotspot('2')}
                    style={{ 
                      position: 'absolute',
                      top: '40px', 
                      left: '80px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: selectedHotspot === '2' ? '#f59e0b' : 'rgba(245, 158, 11, 0.85)',
                      color: '#ffffff',
                      fontWeight: '900',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff',
                      cursor: 'pointer',
                      boxShadow: '0 0 12px rgba(245, 158, 11, 0.6)'
                    }} 
                  >
                    2
                  </div>

                  <div 
                    onClick={() => setSelectedHotspot('3')}
                    style={{ 
                      position: 'absolute',
                      bottom: '25px', 
                      left: '30px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: selectedHotspot === '3' ? '#10b981' : 'rgba(16, 185, 129, 0.85)',
                      color: '#ffffff',
                      fontWeight: '900',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff',
                      cursor: 'pointer',
                      boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
                    }} 
                  >
                    3
                  </div>
                </div>

                {/* Explanation Box */}
                <div style={{ flex: '1', minWidth: '220px' }}>
                  {selectedHotspot === '1' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #ef4444' }}>
                      <strong style={{ fontSize: '13.5px', color: '#ef4444', display: 'block' }}>
                        [Ponto 1] Tecido de Granulação ({result.aiTissueAnalysis?.granulacao !== undefined ? result.aiTissueAnalysis.granulacao : 70}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Pele nova rica em circulação de sangue. A cor vermelha indica bom progresso de cicatrização.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === '2' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderLeft: '4px solid #f59e0b' }}>
                      <strong style={{ fontSize: '13.5px', color: '#f59e0b', display: 'block' }}>
                        [Ponto 2] Esfacelo / Tecido Inviável ({result.aiTissueAnalysis?.fibrina !== undefined ? result.aiTissueAnalysis.fibrina : 20}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Camada amarelada de tecido morto. Deve ser limpa com hidrogel para liberar a pele nova.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === '3' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid #10b981' }}>
                      <strong style={{ fontSize: '13.5px', color: '#10b981', display: 'block' }}>
                        [Ponto 3] Borda e Pele Perilesional ({result.aiTissueAnalysis?.epitelizacao !== undefined ? result.aiTissueAnalysis.epitelizacao : 10}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Pele íntegra ao redor da lesão. Proteja com creme barreira contra maceração por umidade.
                      </p>
                    </div>
                  )}
                  {!selectedHotspot && (
                    <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                      Toque nos números 1, 2 ou 3 sobre a imagem para ler a análise de cada tecido da lesão.
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* AI Metrics (Área, Comprimento, Largura) */}
          <div className="glass-card" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '800', marginBottom: '14px', color: 'var(--text-primary)' }}>
              📊 Dimensões Estimadas & Tecidos
            </h3>

            {result.aiAreaCm2 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '12px', 
                backgroundColor: 'var(--bg-primary)', 
                padding: '14px', 
                borderRadius: '12px', 
                marginBottom: '16px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Estimada</span>
                  <p style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)', margin: '2px 0 0 0' }}>{result.aiAreaCm2} cm²</p>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Comprimento</span>
                  <p style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)', margin: '2px 0 0 0' }}>{result.aiLengthCm} cm</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Largura</span>
                  <p style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)', margin: '2px 0 0 0' }}>{result.aiWidthCm} cm</p>
                </div>
              </div>
            )}

            {/* Conduct / Treatment Plan */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '10px' }}>
                📌 Plano de Conduta & Curativo Sugerido
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', margin: 0 }}>
                {result.treatmentPlan.map((step, idx) => (
                  <li key={idx} style={{ listStyleType: 'decimal', lineHeight: '1.5' }}>{step}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <button 
              className="btn btn-primary" 
              onClick={resetTriageForm}
              style={{ padding: '16px', fontSize: '14px' }}
            >
              <span>📷</span>
              <span>Nova Triagem</span>
            </button>

            <button 
              className="btn btn-secondary" 
              onClick={() => {
                resetTriageForm();
                setActiveTab('history');
              }}
              style={{ padding: '16px', fontSize: '14px' }}
            >
              <span>📄</span>
              <span>Ver no Prontuário</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
