import { useState, useEffect, useRef } from 'react';
import { addWoundEntry as addWoundEntryService } from '../services/supabaseService';
import { analyzeWoundWithAI } from '../services/geminiService';

// Interactive Tissue Overlay Canvas for Segmented Wound Areas
function WoundTissueOverlay({ entry }) {
  const canvasRef = useRef(null);
  const [hoveredTissue, setHoveredTissue] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 140, 140);

    const necrose = parseFloat(entry?.aiTissueAnalysis?.necrose || 0);
    const fibrina = parseFloat(entry?.aiTissueAnalysis?.fibrina || 0);
    const granulacao = parseFloat(entry?.aiTissueAnalysis?.granulacao || 0);
    const epitelizacao = parseFloat(entry?.aiTissueAnalysis?.epitelizacao || 0);
    const total = necrose + fibrina + granulacao + epitelizacao;

    if (total === 0) return;

    const centerX = 70;
    const centerY = 70;
    const radius = 45;

    let startAngle = -0.5 * Math.PI;

    const tissues = [
      { name: 'Necrose', value: necrose, color: 'rgba(15, 23, 42, 0.85)' },
      { name: 'Esfacelo / Fibrina', value: fibrina, color: 'rgba(245, 158, 11, 0.85)' },
      { name: 'Granulação', value: granulacao, color: 'rgba(239, 68, 68, 0.85)' },
      { name: 'Epitelização', value: epitelizacao, color: 'rgba(16, 185, 129, 0.85)' }
    ].filter(t => t.value > 0);

    tissues.forEach(t => {
      const sliceAngle = (t.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
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

    const dist = Math.sqrt((x - 70) * (x - 70) + (y - 70) * (y - 70));
    if (dist <= 45) {
      const angle = Math.atan2(y - 70, x - 70);
      let normalizedAngle = angle + 0.5 * Math.PI;
      if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

      const necrose = parseFloat(entry?.aiTissueAnalysis?.necrose || 0);
      const fibrina = parseFloat(entry?.aiTissueAnalysis?.fibrina || 0);
      const granulacao = parseFloat(entry?.aiTissueAnalysis?.granulacao || 0);
      const epitelizacao = parseFloat(entry?.aiTissueAnalysis?.epitelizacao || 0);
      const total = necrose + fibrina + granulacao + epitelizacao;

      let currentAngle = 0;
      const tissues = [
        { name: 'Necrose', value: necrose },
        { name: 'Esfacelo / Fibrina', value: fibrina },
        { name: 'Granulação', value: granulacao },
        { name: 'Epitelização', value: epitelizacao }
      ].filter(t => t.value > 0);

      let found = null;
      tissues.forEach(t => {
        const sliceAngle = (t.value / total) * 2 * Math.PI;
        if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + sliceAngle) {
          found = `${t.name}: ${t.value}%`;
        }
        currentAngle += sliceAngle;
      });

      setHoveredTissue(found || 'Segmentação de Tecidos');
    } else {
      setHoveredTissue(null);
    }
  };

  return (
    <div style={{ position: 'relative', width: '140px', height: '140px', cursor: 'crosshair', margin: '0 auto' }}>
      <canvas ref={canvasRef} width={140} height={140} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredTissue(null)} />
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

// Fallback algorithm for contingency mode (IREC-0007, IREC-0072, IREC-0252)
const generateLocalFallbackAnalysis = (woundType, lesionStage, clinicalProfile, symptomsText, pain, odor, infectionSigns, fullSymptoms) => {
  const isDiabetes = clinicalProfile?.hasDiabetes;
  const isHypertension = clinicalProfile?.hasHypertension;
  const isPeripheralArterial = clinicalProfile?.hasPeripheralArterialDisease;
  const isSmoker = clinicalProfile?.isSmoker;
  const hasAmputationHistory = clinicalProfile?.hasAmputationHistory;

  let severity = "Leve";
  let isRedirect = false;
  let specialist = "";
  let reason = "";

  const text = ((symptomsText || '') + ' ' + (fullSymptoms || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Escalate severity based on clinical signs (IREC-0072)
  const isHighPain = pain >= 8;
  const hasSevereOdor = !!odor;
  const hasInfection = infectionSigns && infectionSigns !== 'Nenhum';
  const hasBleedingOrDeep = /\b(sangramento|profundo|gordura)\b/.test(text);

  if (isPeripheralArterial || (isDiabetes && hasAmputationHistory) || (hasInfection && isHighPain) || hasBleedingOrDeep) {
    severity = "Crítico";
    isRedirect = true;
    specialist = "Cirurgião Vascular / Pronto-Socorro";
    reason = "Paciente apresentando sinais clínicos críticos (possível infecção avançada, lesão profunda ou comprometimento vascular).";
  } else if (isDiabetes || isSmoker || hasInfection || hasSevereOdor || isHighPain) {
    severity = "Alto Risco";
    isRedirect = true;
    specialist = "Médico Especialista (Angiologia / Estomaterapia)";
    reason = "Paciente com fatores de risco sistêmicos ou sinais de alerta local (odor/dor intensa/infecção) que necessitam de avaliação especializada.";
  } else if (isHypertension || pain > 4) {
    severity = "Risco Moderado";
  }

  // Tissue breakdown (IREC-0252)
  let necrose = 0;
  let fibrina = 0;
  let granulacao = 60;
  let epitelizacao = 40;

  if (/\b(preto|escuro|necro)\b/.test(text) && !/\b(nao|sem)\s+(preto|escuro|necro)\b/.test(text)) {
    necrose = 30;
    fibrina = 20;
    granulacao = 30;
    epitelizacao = 20;
  } else if (/\b(amarel|secrec|pus)\b/.test(text) || (hasInfection && !/\b(nao|sem)\s+(pus|secrec)\b/.test(text))) {
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
    specialist: specialist || "Clínico Geral / Estomaterapeuta",
    reason: reason || "Acompanhamento clínico de rotina recomendado.",
    geminiSummary: `Queixa registrada: ${symptomsText || 'Avaliação rotineira de pele'}.`,
    medPalmDiagnosis: `Avaliação algorítmica iRec baseada no protocolo de contingência e sintomas reportados.`,
    treatmentPlan: treatmentPlan,
    aiAreaCm2: null, // IREC-0007: Do not generate fake random measurements
    aiLengthCm: null,
    aiWidthCm: null,
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
  const [saveError, setSaveError] = useState('');

  // Form states (IREC-0074: unasked fields default to empty/null if not evaluated)
  const [woundType, setWoundType] = useState('Vermelhidão / Inflamação de Pele');
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

  // Escala de Braden States (IREC-0253)
  const [bradenSensory, setBradenSensory] = useState(4);
  const [bradenMoisture, setBradenMoisture] = useState(4);
  const [bradenActivity, setBradenActivity] = useState(4);
  const [bradenMobility, setBradenMobility] = useState(4);
  const [bradenNutrition, setBradenNutrition] = useState(4);
  const [bradenFriction, setBradenFriction] = useState(3);

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

  // Revoke Blob URLs on unmount (IREC-0255)
  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.url && att.url.startsWith('blob:')) {
          URL.revokeObjectURL(att.url);
        }
      });
    };
  }, [attachments]);

  // Sync complaint type & handle card selection without synchronous effect state setters
  const handleSelectComplaintCard = (cardId) => {
    setPatientComplaintType(cardId);
    setDynamicAnswers({});
    switch (cardId) {
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
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 50);
        break;
      default:
        setWoundType('Vermelhidão / Inflamação de Pele');
        setLesionStage('Estágio I');
    }
  };

  const activeComplaintCard = PATIENT_COMPLAINT_CARDS.find(c => c.id === patientComplaintType);
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  // Clean pure state updates without side-effects in setters (IREC-0460)
  const handleAttachmentsChange = (e) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    const updated = [...attachments, ...newAttachments];
    setAttachments(updated);
    
    const lastImage = [...updated].reverse().find(att => att.file?.type?.startsWith('image/'));
    if (lastImage) {
      setImage(lastImage.url);
      setPhotoFile(lastImage.file);
    } else {
      setImage(null);
      setPhotoFile(null);
    }
    e.target.value = "";
  };

  const handleRemoveAttachment = (indexToRemove) => {
    const target = attachments[indexToRemove];
    if (target && target.url && target.url.startsWith('blob:')) {
      URL.revokeObjectURL(target.url);
    }
    const updated = attachments.filter((_, idx) => idx !== indexToRemove);
    setAttachments(updated);
    const lastImage = [...updated].reverse().find(att => att.file?.type?.startsWith('image/'));
    if (lastImage) {
      setImage(lastImage.url);
      setPhotoFile(lastImage.file);
    } else {
      setImage(null);
      setPhotoFile(null);
    }
  };

  const isClinicianWithoutPatient = (clinicalProfile?.role === 'doctor' || clinicalProfile?.role === 'nurse') && !clinicalProfile?.id;

  const handleStartAnalysis = async () => {
    // IREC-0008: Block triage if doctor/nurse has no patient selected
    if (isClinicianWithoutPatient || !clinicalProfile?.id) {
      alert("Por favor, selecione um paciente no prontuário/diretório antes de realizar a triagem clínica.");
      return;
    }

    if (attachments.length === 0) {
      alert("Por favor, selecione ou tire pelo menos uma foto ou anexo da região afetada primeiro.");
      return;
    }

    // IREC-0256: Require image attachment for computer vision analysis
    const hasImage = attachments.some(a => a.file?.type?.startsWith('image/'));
    if (!hasImage) {
      alert("Para a triagem de imagem, é necessário selecionar ou fotografar pelo menos uma imagem da lesão.");
      return;
    }

    setIsAnalyzing(true);
    setSaveError('');
    setAnalysisStep('Analisando imagem e sintomas com o Sistema iRec...');

    try {
      const dynamicAnswersText = Object.entries(dynamicAnswers).map(([k, v]) => `${k}: ${v}`).join(', ');
      const bradenSummary = `Escala Braden (${bradenTotalScore}/23) - Sensorial: ${bradenSensory}, Umidade: ${bradenMoisture}, Atividade: ${bradenActivity}, Mobilidade: ${bradenMobility}, Nutrição: ${bradenNutrition}, Fricção: ${bradenFriction}`;
      const fullSymptoms = `Tipo/Queixa: ${woundType}. Respostas Específicas: ${dynamicAnswersText}. ${bradenSummary}. Local Anatômico: ${anatomicalLocation || 'Não especificado'}. Data de Aparecimento: ${appearanceDate || 'Não informada'}. Estágio: ${lesionStage}. Odor: ${odor ? 'Sim' : 'Não'}. Temperatura Local: ${localTemperature}. Infecção: ${infectionSigns}. Cobertura: ${appliedDressing || 'Nenhuma'}. Quantidade: ${dressingQuantity}. Frequência: ${dressingFrequency || 'Conforme necessidade'}. Procedimentos: ${performedProcedures || 'Nenhum'}. Evolução: ${clinicalEvolution}. Sintomas: ${symptomsText}`;

      let finalResult = await analyzeWoundWithAI(photoFile, clinicalProfile, fullSymptoms);
      
      if (finalResult && finalResult.isValidWound === false) {
        setIsAnalyzing(false);
        setAnalysisStep('');
        alert(finalResult.invalidReason || "A imagem enviada não é uma foto de ferida ou lesão de pele. Por favor, envie uma foto nítida da região afetada.");
        return;
      }

      if (!finalResult) {
        finalResult = generateLocalFallbackAnalysis(woundType, lesionStage, clinicalProfile, symptomsText, pain, odor, infectionSigns, fullSymptoms);
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
        appearanceDate: appearanceDate || null,
        anatomicalLocation: anatomicalLocation || null,
        lesionStage: finalResult.lesionStage || lesionStage, // IREC-0073
        pain: pain, // IREC-0462
        exudate: (finalResult.exudate || exudate).toUpperCase(),
        odor: odor,
        localTemperature: localTemperature,
        infectionSigns: infectionSigns,
        appliedDressing: appliedDressing || null,
        dressingQuantity: parseInt(dressingQuantity) || 1,
        dressingFrequency: dressingFrequency || null,
        performedProcedures: performedProcedures || null,
        clinicalEvolution: finalResult.clinicalEvolution || clinicalEvolution,
        bradenScore: bradenTotalScore, // IREC-0254
        photo: image && image.startsWith('blob:') ? '' : (image || ''),
        aiAreaCm2: finalResult.aiAreaCm2 || null,
        aiLengthCm: finalResult.aiLengthCm || null,
        aiWidthCm: finalResult.aiWidthCm || null,
        aiTissueAnalysis: finalResult.aiTissueAnalysis || {},
        aiRecommendation: finalResult.aiRecommendation || (finalResult.treatmentPlan ? finalResult.treatmentPlan.join('\n') : ''),
        clinicalOutcome: clinicalOutcome
      };

      try {
        const savedEntry = await addWoundEntryService(newEntryData, photoFile, clinicalProfile?.id, attachments);
        if (savedEntry) { // IREC-0075
          addClinicalEntry(savedEntry);
        } else {
          setSaveError("Atenção: Não foi possível salvar o registro no banco de dados.");
          alert("Aviso: A triagem foi concluída mas ocorreu uma falha ao salvar no prontuário.");
        }
      } catch (err) { // IREC-0076
        console.error('Falha ao salvar no prontuário:', err);
        setSaveError("Erro de conexão ao gravar registro no prontuário.");
        alert("Erro ao gravar registro no prontuário. Por favor tente novamente.");
      }
    } catch (err) { // IREC-0257
      console.error('Erro na análise da triagem:', err);
      alert("Ocorreu um erro inesperado ao processar a triagem clínica.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  const resetTriageForm = () => {
    if (attachmentsInputRef.current) {
      attachmentsInputRef.current.value = "";
    }
    attachments.forEach(att => {
      if (att.url && att.url.startsWith('blob:')) {
        URL.revokeObjectURL(att.url);
      }
    });
    setImage(null);
    setPhotoFile(null);
    setPain(3);
    setExudate('moderado');
    setOdor(false);
    setSymptomsText('');
    setAttachments([]);
    setPatientComplaintType('vermelhidao');
    setDynamicAnswers({});
    setWoundType('Vermelhidão / Inflamação de Pele'); // IREC-0077
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
    setBradenSensory(4); // IREC-0258
    setBradenMoisture(4);
    setBradenActivity(4);
    setBradenMobility(4);
    setBradenNutrition(4);
    setBradenFriction(3);
    setSaveError('');
    setResult(null);
    setSelectedHotspot(null);
  };

  const isHighSeverity = result && (result.isRedirect || ['Alto Risco', 'Crítico'].includes(result.severity)); // IREC-0078

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

      {/* Clinician missing patient alert banner (IREC-0008) */}
      {isClinicianWithoutPatient && (
        <div className="glass-card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <h3 style={{ fontSize: '14.5px', color: '#ef4444', fontWeight: '800', margin: '0 0 2px 0' }}>Seleção de Paciente Necessária</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Você está conectado como profissional de saúde. Por favor, selecione um paciente no diretório para que os dados sejam gravados no prontuário correto.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isAnalyzing && !result && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Card 1: Fotos, Vídeos e Exames do Caso */}
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
                {/* Interactive Add Photo Button (IREC-0259: button type="button") */}
                <button 
                  type="button"
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
                  aria-label="Anexar fotos ou documentos"
                >
                  <span style={{ fontSize: '26px' }}>📷</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', marginTop: '4px' }}>+ Anexar</span>
                </button>

                {/* Render Selected Attachments (IREC-0463, IREC-0464) */}
                {attachments.map((fileObj, idx) => {
                  const isImage = fileObj.file?.type?.startsWith('image/');
                  const isVideo = fileObj.file?.type?.startsWith('video/');
                  const fileKey = `${fileObj.file?.name || 'att'}-${fileObj.file?.lastModified || idx}`;
                  return (
                    <div key={fileKey} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '16px', overflow: 'hidden', border: '1.5px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {isImage ? (
                        <img src={fileObj.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={fileObj.file?.name || "anexo"} />
                      ) : isVideo ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#10b981' }}>
                          <span style={{ fontSize: '22px' }}>🎥</span>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '85px', textAlign: 'center' }}>Vídeo</span>
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#0ea5e9' }}>
                          <span style={{ fontSize: '22px' }}>📄</span>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '85px', textAlign: 'center' }}>{fileObj.file?.name}</span>
                        </div>
                      )}
                      
                      {/* Remove button (IREC-0464) */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        aria-label={`Remover anexo ${fileObj.file?.name || idx + 1}`}
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

          {/* Card 2: Sintomas Básicos (IREC-0259: button type="button") */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                🩺 O que você deseja avaliar hoje?
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                Selecione a opção que melhor descreve como está a sua pele ou o seu sintoma de saúde:
              </p>

              {/* Complaint Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {PATIENT_COMPLAINT_CARDS.map((card) => {
                  const isSelected = patientComplaintType === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectComplaintCard(card.id)}
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
                        gap: '4px',
                        textAlign: 'left'
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
                    </button>
                  );
                })}
              </div>

              {/* Complaint Advice & Dynamic Questions */}
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

                  {/* Questions */}
                  {activeComplaintCard.questions && activeComplaintCard.questions.length > 0 && (
                    <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(2, 132, 199, 0.15)' }}>
                      <legend style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whitespace: 'nowrap', border: 0 }}>Perguntas complementares</legend>
                      {activeComplaintCard.questions.map((q, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {q.label}
                          </span>

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
                                  border: dynamicAnswers[q.key] === 'Não' ? '1px solid var(--text-secondary)' : '1px solid var(--border-color)',
                                  backgroundColor: dynamicAnswers[q.key] === 'Não' ? 'var(--text-secondary)' : 'var(--bg-secondary)', // IREC-0260 Contrast fix
                                  color: dynamicAnswers[q.key] === 'Não' ? '#ffffff' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                Não
                              </button>
                            </div>
                          ) : q.type === 'select' ? (
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
                    </fieldset>
                  )}
                </div>
              )}

              {/* Pain Scale Selector (IREC-0465, IREC-0466) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="pain-scale-input" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                    Intensidade da Dor
                  </label>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: pain > 7 ? '#ef4444' : pain > 3 ? '#f59e0b' : '#10b981' }}>
                    {pain}/10 ({pain === 0 ? 'Sem dor' : pain <= 3 ? 'Leve' : pain <= 7 ? 'Moderada' : 'Intensa'})
                  </span>
                </div>
                <input 
                  id="pain-scale-input"
                  type="range" 
                  min="0" 
                  max="10" 
                  value={pain} 
                  onChange={(e) => setPain(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Escala de Braden Completa (6 domínios: 6 a 23) (IREC-0253) */}
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'block' }}>
                    🚶‍♂️ Mobilidade & Escala de Braden
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Nível de Proteção da Pele ({bradenTotalScore}/23): <strong style={{ color: skinProtectionColor }}>{skinProtectionText}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Question 1: Sensory */}
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Sensibilidade à dor e desconforto:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Sinto dor normalmente' },
                        { val: 3, label: 'Pouca dificuldade de sentir' },
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
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Umidade da pele no dia a dia:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Pele quase sempre seca' },
                        { val: 3, label: 'Molhada de vez em quando' },
                        { val: 2, label: 'Molhada com frequência' },
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
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Atividade física e caminhada:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Caminho frequentemente' },
                        { val: 3, label: 'Caminho curtas distâncias' },
                        { val: 2, label: 'Confinado à cadeira' },
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
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Capacidade de mudar de posição:
                    </span>
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

                  {/* Question 5: Nutrition (IREC-0253) */}
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Padrão de Nutrição e Alimentação:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 4, label: 'Alimentação excelente/normal' },
                        { val: 3, label: 'Alimentação adequada' },
                        { val: 2, label: 'Provavelmente inadequada' },
                        { val: 1, label: 'Muito pobre / Jejum estendido' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setBradenNutrition(opt.val)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textAlign: 'left',
                            border: bradenNutrition === opt.val ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: bradenNutrition === opt.val ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                            color: bradenNutrition === opt.val ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question 6: Friction & Shear (IREC-0253) */}
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Fricção e Cisalhamento na Cama/Cadeira:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                      {[
                        { val: 3, label: 'Sem problema aparente' },
                        { val: 2, label: 'Problema potencial (escorrega)' },
                        { val: 1, label: 'Problema significativo (fricção frequente)' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setBradenFriction(opt.val)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textAlign: 'left',
                            border: bradenFriction === opt.val ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: bradenFriction === opt.val ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                            color: bradenFriction === opt.val ? 'var(--primary)' : 'var(--text-primary)',
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

              {/* Symptoms Description Textarea (IREC-0466) */}
              <div>
                <label htmlFor="symptoms-text-input" style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '6px' }}>
                  Descrição adicional da queixa ou sintomas
                </label>
                <textarea
                  id="symptoms-text-input"
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

          {/* Action Button: Iniciar Análise */}
          <button 
            type="button"
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

      {/* Results Section (IREC-0461: result && !isAnalyzing) */}
      {result && !isAnalyzing && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Contingency Banner */}
          {result.isLocalFallback && (
            <div className="glass-card" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)', margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <h3 style={{ fontSize: '14.5px', color: '#d97706', fontWeight: '800', margin: '0 0 2px 0' }}>Triagem Clínica em Modo Local (Contingência)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    Relatório gerado com base no protocolo de contingência e sintomas informados.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save Error Alert (IREC-0076) */}
          {saveError && (
            <div className="glass-card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)', margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '24px' }}>🚨</span>
                <div>
                  <h3 style={{ fontSize: '14.5px', color: '#ef4444', fontWeight: '800', margin: '0 0 2px 0' }}>Aviso de Gravação</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    {saveError}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Severe Redirect Alert (IREC-0078, IREC-0261) */}
          {isHighSeverity ? (
            <div className="glass-card glass-card-danger-glow neon-edge-danger" style={{ margin: 0 }}>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '26px' }}>🚨</span>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#ef4444', fontWeight: '900', margin: 0 }}>
                    ENCAMINHAMENTO RECOMENDADO — {result.severity || 'CASO CRÍTICO'}
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Triagem Médica Ativa</span>
                </div>
              </div>
              
              <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '12px', marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Especialista Recomendado:</p>
                <p style={{ fontSize: '16px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>{result.specialist || "Cirurgião Vascular / Estomaterapeuta"}</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                  <strong>Motivo:</strong> {result.reason || "Avaliação especializada recomendada com base nos fatores de risco e sintomas localizados."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('doctors_directory')}
                className="btn btn-sos"
                style={{ width: '100%', padding: '12px', fontSize: '13px' }}
              >
                👨‍⚕️ Agendar Especialista Agora
              </button>
            </div>
          ) : (
            <div className="glass-card glass-card-emerald-glow neon-edge-emerald" style={{ margin: 0 }}>
              <h3 style={{ fontSize: '14.5px', color: '#10b981', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✅</span>
                <span>Lesão Liberada para Cuidado Domiciliar Monitorado ({result.severity || 'Baixo Risco'})</span>
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                Baixo risco imediato. Siga as orientações prescritas pelo seu médico assistente.
              </p>
            </div>
          )}

          {/* Interactive Visual Wound Mapping (IREC-0251, IREC-0079) */}
          <div className="glass-card glass-card-cyan-glow" style={{ margin: 0 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
                🗺️ Mapeamento de Tecidos da Foto
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Segmentação visual e proporção calculada de tecidos da lesão:
              </p>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Uploaded Image Box or Canvas Segment Overlay */}
                <div style={{ 
                  position: 'relative', 
                  width: '240px', 
                  minHeight: '180px', 
                  borderRadius: '16px', 
                  border: '2px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  margin: '0 auto',
                  padding: '10px',
                  boxShadow: 'var(--shadow-md)',
                  backgroundColor: 'var(--bg-primary)'
                }}>
                  {image ? (
                    <img 
                      src={image} 
                      alt="Ferida analisada" 
                      style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px' }} 
                    />
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem Imagem</div>
                  )}

                  {/* Render Canvas Overlay if Tissue Analysis Present */}
                  {result.aiTissueAnalysis && Object.keys(result.aiTissueAnalysis).length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <WoundTissueOverlay entry={result} />
                    </div>
                  )}
                </div>

                {/* Tissue Breakdown Buttons and Explanation Box (IREC-0079: 4 tissues including Necrose) */}
                <div style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedHotspot('granulacao')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textAlign: 'left',
                        border: selectedHotspot === 'granulacao' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                    >
                      🔴 Granulação: {result.aiTissueAnalysis?.granulacao !== undefined ? result.aiTissueAnalysis.granulacao : 0}%
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedHotspot('fibrina')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textAlign: 'left',
                        border: selectedHotspot === 'fibrina' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                        cursor: 'pointer'
                      }}
                    >
                      🟡 Esfacelo / Fibrina: {result.aiTissueAnalysis?.fibrina !== undefined ? result.aiTissueAnalysis.fibrina : 0}%
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedHotspot('epitelizacao')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textAlign: 'left',
                        border: selectedHotspot === 'epitelizacao' ? '2px solid #10b981' : '1px solid var(--border-color)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        cursor: 'pointer'
                      }}
                    >
                      🟢 Epitelização: {result.aiTissueAnalysis?.epitelizacao !== undefined ? result.aiTissueAnalysis.epitelizacao : 0}%
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedHotspot('necrose')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        textAlign: 'left',
                        border: selectedHotspot === 'necrose' ? '2px solid #0f172a' : '1px solid var(--border-color)',
                        backgroundColor: 'rgba(15, 23, 42, 0.1)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      ⬛ Necrose: {result.aiTissueAnalysis?.necrose !== undefined ? result.aiTissueAnalysis.necrose : 0}%
                    </button>
                  </div>

                  {/* Selected Tissue Details */}
                  {selectedHotspot === 'granulacao' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #ef4444' }}>
                      <strong style={{ fontSize: '13.5px', color: '#ef4444', display: 'block' }}>
                        Tecido de Granulação ({result.aiTissueAnalysis?.granulacao || 0}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Pele nova rica em circulação de sangue. A cor vermelha indica bom progresso de cicatrização.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === 'fibrina' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderLeft: '4px solid #f59e0b' }}>
                      <strong style={{ fontSize: '13.5px', color: '#f59e0b', display: 'block' }}>
                        Esfacelo / Tecido Inviável ({result.aiTissueAnalysis?.fibrina || 0}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Camada amarelada de tecido morto. Deve ser limpa com hidrogel para liberar a pele nova.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === 'epitelizacao' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid #10b981' }}>
                      <strong style={{ fontSize: '13.5px', color: '#10b981', display: 'block' }}>
                        Epitelização ({result.aiTissueAnalysis?.epitelizacao || 0}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Regeneração da camada externa da pele. Proteja contra umidade e atrito.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === 'necrose' && (
                    <div className="animate-fade-in" style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.08)', borderLeft: '4px solid #0f172a' }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)', display: 'block' }}>
                        Tecido Necrótico ({result.aiTissueAnalysis?.necrose || 0}%)
                      </strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Tecido escuro/preto endurecido desprovido de oxigenação. Requer avaliação especializada para desbridamento.
                      </p>
                    </div>
                  )}
                  {!selectedHotspot && (
                    <div style={{ padding: '14px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                      Clique nos botões de tecidos acima para ver detalhes de cada tecido mapeado.
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* AI Metrics (Área, Comprimento, Largura) (IREC-0007) */}
          <div className="glass-card" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '15.5px', fontWeight: '800', marginBottom: '14px', color: 'var(--text-primary)' }}>
              📊 Dimensões Estimadas & Tecidos
            </h3>

            {result.aiAreaCm2 !== null && result.aiAreaCm2 !== undefined ? (
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
            ) : (
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--border-color)', fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Medidas de área não mensuradas no modo de contingência local (requer avaliação por régua de calibração ou foto nítida).
              </div>
            )}

            {/* Conduct / Treatment Plan (IREC-0080) */}
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '10px' }}>
                📌 Plano de Conduta & Curativo Sugerido
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', margin: 0 }}>
                {(result.treatmentPlan && result.treatmentPlan.length > 0) ? (
                  result.treatmentPlan.map((step, idx) => (
                    <li key={idx} style={{ listStyleType: 'decimal', lineHeight: '1.5' }}>{step}</li>
                  ))
                ) : (
                  <li style={{ listStyleType: 'none' }}>Manter a higienização com soro fisiológico e seguir as orientações do profissional de saúde.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={resetTriageForm}
              style={{ padding: '16px', fontSize: '14px' }}
            >
              <span>📷</span>
              <span>Nova Triagem</span>
            </button>

            <button 
              type="button"
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
