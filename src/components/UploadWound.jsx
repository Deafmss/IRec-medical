import React, { useState, useRef } from 'react';
import { addWoundEntry as addWoundEntryService } from '../services/supabaseService';
import { analyzeWoundWithAI, isGeminiConfigured } from '../services/geminiService';

const GLOSSARY_DB = {
  exsudato: { 
    term: 'Exsudato', 
    def: 'É a secreção ou líquido natural que sai da ferida. É importante para a cicatrização, mas o excesso (exsudação alta) precisa ser controlado para não assar a pele ao redor.' 
  },
  granulacao: { 
    term: 'Tecido de Granulação', 
    def: 'Pele nova, úmida e avermelhada que cresce no fundo da ferida. É um sinal excelente de que a ferida está cicatrizando de forma saudável.' 
  },
  esfacelos: { 
    term: 'Esfacelo', 
    def: 'Uma camada amarelada ou esbranquiçada de tecido morto que se acumula na ferida. Ela funciona como uma barreira que impede a cicatrização e precisa ser limpa.' 
  },
  perilesao: { 
    term: 'Pele Perilesional', 
    def: 'A pele saudável que fica logo em volta da ferida. Precisa ser protegida com cremes barreira para não amolecer e abrir novas feridas devido à umidade.' 
  },
  desbridamento: { 
    term: 'Desbridamento Autolítico', 
    def: 'Processo natural de limpeza da ferida, onde usamos pomadas ou hidrogel para amolecer e remover o tecido amarelado morto sem dor.' 
  },
  necrose: { 
    term: 'Necrose', 
    def: 'Tecido preto, seco ou úmido, que morreu por falta de sangue. Precisa ser removido por um profissional de saúde para a ferida voltar a cicatrizar.' 
  },
  celulite: { 
    term: 'Celulite Infecciosa', 
    def: 'Uma infecção bacteriana na pele que causa vermelhidão, calor local e inchaço. É uma complicação séria que exige tratamento médico imediato com antibióticos.' 
  },
  osteomielite: { 
    term: 'Osteomielite', 
    def: 'Infecção bacteriana grave que atinge o osso sob a ferida. Ocorre principalmente em feridas profundas no pé diabético e exige exames e tratamento complexo.' 
  }
};

export default function UploadWound({ setActiveTab, addWoundEntry, clinicalProfile }) {
  const [image, setImage] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [pain, setPain] = useState(3);
  const [exudate, setExudate] = useState('moderado');
  const [odor, setOdor] = useState(false);
  const [symptomsText, setSymptomsText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [result, setResult] = useState(null);
  const [demoScenario, setDemoScenario] = useState('venosa');

  // Novos campos estruturados para o Dataset Clínico (BLOCOS 3 e 6)
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
  const [showClinicalDetails, setShowClinicalDetails] = useState(false);
  
  const fileInputRef = useRef(null);

  // Visual Map Interactive State
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  const handlePhotoSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setImage(URL.createObjectURL(file));
    }
  };

  const handleWebcamSimulate = (e) => {
    e.stopPropagation(); // Prevent triggering file upload
    setIsAnalyzing(true);
    setAnalysisStep('Iniciando Câmera...');
    setTimeout(() => {
      setIsAnalyzing(false);
      // Set a mock image path for webcam simulation
      setImage('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&auto=format&fit=crop&q=60');
      setPhotoFile(null); // No local file, will use the fallback URL
      alert("Câmera do Dispositivo Simulada:\n\nImagem capturada com sucesso com foco e iluminação calibrados pelo iRec!");
    }, 1200);
  };

  const handleSimulateAnalysis = async () => {
    if (!image) {
      alert("Por favor, selecione ou simule o envio de uma foto da ferida primeiro.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep('Analisando ferida com Inteligência Artificial...');

    // Compilar todas as respostas do formulário clínico estruturado para enviar ao Gemini
    const fullSymptoms = `Tipo da Ferida: ${woundType}. Local Anatômico: ${anatomicalLocation}. Data de Aparecimento: ${appearanceDate}. Estágio: ${lesionStage}. Temperatura Local: ${localTemperature}. Sinais de Infecção: ${infectionSigns}. Cobertura Utilizada: ${appliedDressing}. Quantidade: ${dressingQuantity}. Frequência de Troca: ${dressingFrequency}. Procedimentos: ${performedProcedures}. Evolução Clínica: ${clinicalEvolution}. Sintomas adicionais: ${symptomsText}`;

    // 1. Try real Gemini API analysis
    const realResult = await analyzeWoundWithAI(photoFile, clinicalProfile, fullSymptoms);
    if (realResult) {
      setIsAnalyzing(false);
      setAnalysisStep('');
      setResult(realResult);
      
      // Auto-fill state values from AI response
      if (realResult.type) setWoundType(realResult.type);
      if (realResult.lesionStage) setLesionStage(realResult.lesionStage);
      if (realResult.clinicalEvolution) setClinicalEvolution(realResult.clinicalEvolution);
      
      setSelectedHotspot(null);
      return;
    }

    // 2. Fallback to mock scenarios if API key is not configured
    setAnalysisStep('Gemini (Simulado)');
    
    setTimeout(() => {
      setAnalysisStep('Med-PaLM (Simulado)');
      
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisStep('');
        
        let mockResult = {};
        const profileDiabetes = clinicalProfile?.hasDiabetes;
        const profileHypertension = clinicalProfile?.hasHypertension;
        const profileSmoker = clinicalProfile?.isSmoker;

        if (demoScenario === 'venosa') {
          mockResult = {
            date: new Date().toLocaleDateString('pt-BR'),
            type: 'Úlcera Venosa Estável',
            lesionStage: 'Estágio II',
            severity: 'Leve (Grau I/II)',
            exudate: exudate.toUpperCase(),
            painLevel: pain,
            hasOdor: odor ? 'SIM' : 'NÃO',
            complicationRisk: 'Baixo',
            isRedirect: false,
            geminiSummary: `Paciente com queixa de dor nível ${pain} e exsudato ${exudate}.`,
            medPalmDiagnosis: `Lesão com 80% de tecido de granulação saudável e 20% de esfacelo na borda superior.`,
            treatmentPlan: [
              'Limpar o leito com soro fisiológico morno sob pressão leve.',
              'Aplicar Hidrogel amorfo nas áreas de esfacelo.',
              'Proteger a perilesão com creme barreira Cavilon.'
            ],
            aiAreaCm2: 12.5,
            aiLengthCm: 5.0,
            aiWidthCm: 2.5,
            aiTissueAnalysis: { necrose: 0, fibrina: 20, granulacao: 80, epitelizacao: 0 },
            aiRecommendation: 'Limpar com soro fisiológico e aplicar Hidrogel com alginato para absorção média.',
            clinicalEvolution: 'Estável'
          };
        } else if (demoScenario === 'queimadura') {
          mockResult = {
            date: new Date().toLocaleDateString('pt-BR'),
            type: 'Suspeita de Queimadura de 3º Grau',
            lesionStage: 'Estágio IV',
            severity: 'GRAVE (CRÍTICO)',
            exudate: 'ALTO',
            painLevel: pain,
            hasOdor: odor ? 'SIM' : 'NÃO',
            complicationRisk: 'Muito Alto',
            isRedirect: true,
            specialist: 'Centro de Tratamento de Queimados (CTQ) / Cirurgião Plástico',
            reason: 'Perda total da espessura da pele com exposição de tecido subcutâneo.',
            geminiSummary: `Queimadura profunda.`,
            medPalmDiagnosis: 'Dano térmico profundo. Exige desbridamento cirúrgico e hidratação sistêmica.',
            treatmentPlan: [
              'Cobrir frouxamente com uma gaze estéril úmida.',
              'Encaminhar-se imediatamente para o pronto-socorro.'
            ],
            aiAreaCm2: 25.0,
            aiLengthCm: 8.0,
            aiWidthCm: 4.5,
            aiTissueAnalysis: { necrose: 40, fibrina: 0, granulacao: 0, epitelizacao: 0 },
            aiRecommendation: 'Encaminhamento urgente. Não aplicar pomadas caseiras.',
            clinicalEvolution: 'Piorou'
          };
        } else if (demoScenario === 'diabetico_infectado') {
          mockResult = {
            date: new Date().toLocaleDateString('pt-BR'),
            type: 'Úlcera de Pé Diabético Infectada',
            lesionStage: 'Estágio III',
            severity: 'ALTO RISCO (WAGNER GRAU III)',
            exudate: 'ALTO (PURULENTO)',
            painLevel: pain,
            hasOdor: 'SIM',
            complicationRisk: 'Altíssimo',
            isRedirect: true,
            specialist: 'Cirurgião Vascular / Ambulatório de Pé Diabético',
            reason: `Pé diabético ativo com dor de nível ${pain} e sinais flogísticos locais (calor, rubor e pus).`,
            geminiSummary: `Pé diabético infectado.`,
            medPalmDiagnosis: 'Úlcera plantar infectada. Celulite associada. Risco crítico de osteomielite.',
            treatmentPlan: [
              'Lavar apenas com soro fisiológico morno, sem esfregar.',
              'Procurar imediatamente o pronto-atendimento.'
            ],
            aiAreaCm2: 8.5,
            aiLengthCm: 3.2,
            aiWidthCm: 2.8,
            aiTissueAnalysis: { necrose: 20, fibrina: 30, granulacao: 40, epitelizacao: 10 },
            aiRecommendation: 'Encaminhamento urgente para desbridamento e antibioticoterapia.',
            clinicalEvolution: 'Piorou'
          };
        } else {
          mockResult = {
            date: new Date().toLocaleDateString('pt-BR'),
            type: 'Laceração Superficial Limpa',
            lesionStage: 'Estágio I',
            severity: 'Leve (Grau I)',
            exudate: 'NULO',
            painLevel: pain,
            hasOdor: 'NÃO',
            complicationRisk: 'Mínimo',
            isRedirect: false,
            geminiSummary: 'Corte linear superficial.',
            medPalmDiagnosis: 'Lesão epidérmica simples com bordas bem coaptadas.',
            treatmentPlan: [
              'Lavar o local com água limpa e sabão neutro.',
              'Aplicar curativo adesivo respirável.'
            ],
            aiAreaCm2: 2.0,
            aiLengthCm: 2.0,
            aiWidthCm: 0.5,
            aiTissueAnalysis: { necrose: 0, fibrina: 0, granulacao: 0, epitelizacao: 100 },
            aiRecommendation: 'Limpeza simples e curativo protetor.',
            clinicalEvolution: 'Melhorou'
          };
        }
        
        setResult(mockResult);
        
        // Auto-fill state values from simulated response
        if (mockResult.type) setWoundType(mockResult.type);
        if (mockResult.lesionStage) setLesionStage(mockResult.lesionStage);
        if (mockResult.clinicalEvolution) setClinicalEvolution(mockResult.clinicalEvolution);
        
        setSelectedHotspot(null);
      }, 2500);
    }, 2000);
  };


  const handleSaveAndFinish = async () => {
    if (result) {
      setIsAnalyzing(true);
      setAnalysisStep('Salvando no Prontuário...');
      
      const newEntryData = {
        date: new Date().toLocaleDateString('pt-BR'),
        type: result.type || woundType,
        appearanceDate: appearanceDate,
        anatomicalLocation: anatomicalLocation,
        lesionStage: lesionStage,
        pain: result.painLevel || pain,
        exudate: (result.exudate || exudate).toUpperCase(),
        odor: odor,
        localTemperature: localTemperature,
        infectionSigns: infectionSigns,
        appliedDressing: appliedDressing,
        dressingQuantity: parseInt(dressingQuantity) || 1,
        dressingFrequency: dressingFrequency,
        performedProcedures: performedProcedures,
        clinicalEvolution: result.clinicalEvolution || clinicalEvolution,
        photo: image.startsWith('blob:') ? '' : image, // will be replaced by storage URL
        
        // IA estimated fields
        aiAreaCm2: result.aiAreaCm2 || null,
        aiLengthCm: result.aiLengthCm || null,
        aiWidthCm: result.aiWidthCm || null,
        aiTissueAnalysis: result.aiTissueAnalysis || {},
        aiRecommendation: result.aiRecommendation || result.treatmentPlan?.join('\n') || '',
        clinicalOutcome: clinicalOutcome
      };

      try {
        const savedEntry = await addWoundEntryService(newEntryData, photoFile);
        addWoundEntry(savedEntry);
      } catch (err) {
        console.error('Falha ao salvar no Supabase:', err);
      }

      setIsAnalyzing(false);
      setAnalysisStep('');
      setImage(null);
      setPhotoFile(null);
      setPain(3);
      setExudate('moderado');
      setOdor(false);
      setSymptomsText('');
      
      // Reset new states
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
      setActiveTab('history');
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '18px' }}>Nova Avaliação de Lesão</h2>
      
      {!isAnalyzing && !result && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Card 1: Captura Fotográfica (No topo agora, principal para o paciente) */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />

          <div 
            onClick={handlePhotoSelect}
            className="glass-card" 
            style={{ 
              border: '2px dashed var(--border-color)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '30px 16px', 
              cursor: 'pointer',
              background: image ? 'rgba(14, 165, 233, 0.02)' : 'var(--glass-bg)',
              borderColor: image ? 'var(--primary)' : 'var(--border-color)',
              textAlign: 'center',
              margin: 0
            }}
          >
            {image ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img 
                  src={image} 
                  alt="Pré-visualização da ferida" 
                  style={{ 
                    width: '120px', 
                    height: '120px', 
                    objectFit: 'cover', 
                    borderRadius: '16px', 
                    border: '3px solid var(--primary)',
                    marginBottom: '10px',
                    boxShadow: 'var(--shadow-md)'
                  }} 
                />
                <h4 style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px' }}>Foto da Ferida Carregada</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Clique para tirar outra foto ou alterar o arquivo.</p>
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(14, 165, 233, 0.08)', color: 'var(--primary)', marginBottom: '8px' }}>
                  <svg style={{ width: '28px', height: '28px', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  </svg>
                </div>
                <h4 style={{ fontWeight: '700', fontSize: '14.5px' }}>Fotografar ou Carregar Foto da Ferida</h4>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Posicione a lesão de perto em local bem iluminado
                </p>
                <button 
                  onClick={handleWebcamSimulate}
                  className="btn btn-secondary" 
                  style={{ display: 'inline-flex', alignSelf: 'center', padding: '6px 12px', fontSize: '11.5px' }}
                >
                  Ativar Câmera do Dispositivo
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Sintomas Básicos (Simples para o Paciente) */}
          <div className="glass-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '2px' }}>
              Como você está se sentindo?
            </h3>
            
            {/* Pain Scale Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Intensidade da Dor</label>
                <span style={{ fontWeight: '700', fontSize: '12.5px', color: pain > 6 ? 'var(--danger)' : pain > 3 ? 'var(--warning)' : 'var(--primary)' }}>
                  {pain}/10 ({pain === 0 ? 'Sem dor' : pain <= 3 ? 'Leve' : pain <= 7 ? 'Moderada' : 'Forte'})
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

            <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={odor}
                  onChange={(e) => setOdor(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <strong>A ferida apresenta cheiro/odor forte?</strong>
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>Outras queixas ou sintomas adicionais</label>
              <textarea
                value={symptomsText}
                onChange={(e) => setSymptomsText(e.target.value)}
                placeholder="Ex: Sinto pontadas na perna à noite, está coçando muito, febre recente..."
                style={{ width: '100%', height: '70px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px', resize: 'none', lineHeight: '1.4' }}
              />
            </div>
          </div>

          {/* Botão de Accordion / Seção Colapsável de Detalhes Clínicos */}
          <button
            type="button"
            onClick={() => setShowClinicalDetails(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '14px 18px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              transition: 'var(--transition-fast)',
              boxShadow: 'var(--shadow-sm)',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Detalhes Clínicos Avançados (Opcional / Preenchido automaticamente pela IA)
            </span>
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{showClinicalDetails ? '▲ OCULTAR' : '▼ EXIBIR'}</span>
          </button>

          {/* Conteúdo Clínico Colapsável */}
          {showClinicalDetails && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
              
              {/* Card 1: Identificação da Ferida (Avançado) */}
              <div className="glass-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Ficha da Ferida (Diagnóstico Técnico)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tipo de Lesão</label>
                    <select 
                      value={woundType} 
                      onChange={(e) => setWoundType(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    >
                      <option value="Pé Diabético">Pé Diabético</option>
                      <option value="Lesão por Pressão">Lesão por Pressão</option>
                      <option value="Úlcera Venosa">Úlcera Venosa</option>
                      <option value="Úlcera Arterial">Úlcera Arterial</option>
                      <option value="Ferida Cirúrgica">Ferida Cirúrgica</option>
                      <option value="Ferida Traumática">Ferida Traumática</option>
                      <option value="Outras">Outras</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Estágio/Grau da Lesão</label>
                    <select 
                      value={lesionStage} 
                      onChange={(e) => setLesionStage(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    >
                      <option value="Estágio I">Estágio I (Apenas eritema íntegro)</option>
                      <option value="Estágio II">Estágio II (Perda parcial de pele)</option>
                      <option value="Estágio III">Estágio III (Perda total de pele)</option>
                      <option value="Estágio IV">Estágio IV (Exposição de tendão/osso)</option>
                      <option value="Não Classificável">Não Classificável / Espessa escara</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Data de Aparecimento</label>
                    <input 
                      type="date" 
                      value={appearanceDate}
                      onChange={(e) => setAppearanceDate(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Local Anatômico da Ferida</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Calcanhar esquerdo, maléolo lateral..."
                      value={anatomicalLocation}
                      onChange={(e) => setAnatomicalLocation(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Fisiologia Adicional */}
              <div className="glass-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Sinais Clínicos Adicionais
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nível de Secreção (Exsudato)</label>
                    <select 
                      value={exudate} 
                      onChange={(e) => setExudate(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    >
                      <option value="nulo">Nulo (Seca)</option>
                      <option value="moderado">Moderado</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Temperatura Local da Pele</label>
                    <select 
                      value={localTemperature} 
                      onChange={(e) => setLocalTemperature(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Aumentada">Aumentada (Calor Local)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Sinais de Infecção Ativos</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Eritema/Vermelhidão, calor local, pus, inchaço..."
                    value={infectionSigns}
                    onChange={(e) => setInfectionSigns(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* Card 3: Tratamento Clínico e Evolução */}
              <div className="glass-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Conduta Clínica & Evolução
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cobertura/Curativo Utilizado</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Alginato de Cálcio, Hidrogel..."
                      value={appliedDressing}
                      onChange={(e) => setAppliedDressing(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Quantidade Consumida</label>
                    <input 
                      type="number" 
                      min="1"
                      value={dressingQuantity}
                      onChange={(e) => setDressingQuantity(parseInt(e.target.value) || 1)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Frequência de Troca</label>
                    <input 
                      type="text" 
                      placeholder="Ex: A cada 24h, a cada 72h..."
                      value={dressingFrequency}
                      onChange={(e) => setDressingFrequency(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Procedimentos Realizados</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Limpeza com soro fisiológico morno..."
                      value={performedProcedures}
                      onChange={(e) => setPerformedProcedures(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evolução Clínica de Hoje</label>
                    <select 
                      value={clinicalEvolution} 
                      onChange={(e) => setClinicalEvolution(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    >
                      <option value="Melhorou">Melhorou (Regressão de área/dor)</option>
                      <option value="Estável">Estável (Sem alterações)</option>
                      <option value="Piorou">Piorou (Sinais flogísticos/dor)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Desfecho / Status do Caso</label>
                    <select 
                      value={clinicalOutcome} 
                      onChange={(e) => setClinicalOutcome(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '12.5px' }}
                    >
                      <option value="Tratamento em andamento">Tratamento em andamento</option>
                      <option value="Cicatrização completa">Cicatrização completa</option>
                      <option value="Internação hospitalar">Internação hospitalar</option>
                      <option value="Reinternação">Reinternação</option>
                      <option value="Amputação de membro">Amputação de membro</option>
                      <option value="Óbito">Óbito</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Test fallback selector if Gemini not configured (minimized style) */}
          {!isGeminiConfigured && (
            <div className="glass-card" style={{ backgroundColor: 'var(--primary-glow)', borderColor: 'var(--primary-light)', margin: 0, padding: '10px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Simulador Offline Ativo (Selecione o caso de teste)
              </label>
              <select 
                value={demoScenario} 
                onChange={(e) => setDemoScenario(e.target.value)}
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontSize: '11.5px', fontWeight: '600' }}
              >
                <option value="venosa">Simular Caso 1: Úlcera Venosa (Baixo Risco)</option>
                <option value="corte">Simular Caso 2: Corte Superficial Limpo (Baixo Risco)</option>
                <option value="queimadura">Simular Caso 3: Queimadura 3º Grau (CRÍTICO)</option>
                <option value="diabetico_infectado">Simular Caso 4: Pé Diabético com Infecção (CRÍTICO)</option>
              </select>
            </div>
          )}

          <button 
            className="btn btn-primary" 
            onClick={handleSimulateAnalysis}
            style={{ width: '100%', height: '50px', fontSize: '14.5px' }}
          >
            Iniciar Análise Clínica com IA
          </button>
        </div>
      )}

      {/* Loading Steps */}
      {isAnalyzing && (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '50px', height: '50px', marginBottom: '20px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid var(--border-color)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{analysisStep === 'Gemini' ? 'Processando Sintomas...' : (analysisStep === 'Med-PaLM' ? 'Gerando Relatório Clínico...' : analysisStep)}</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '320px' }}>
            {analysisStep === 'Gemini' 
              ? 'Avaliando dados contra diretrizes de emergência...'
              : 'Classificando tecidos, exsudato e mapeando a lesão no sistema...'}
          </p>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* REDIRECT ALERT CARD FOR SEVERE CASES */}
          {result.isRedirect ? (
            <div className="glass-card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)', margin: 0 }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '50%', padding: '6px', flexShrink: 0 }}>
                  <svg style={{ width: '22px', height: '22px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '15.5px', color: 'var(--danger)', fontWeight: '700' }}>CASO CRÍTICO - ENCAMINHAMENTO OBRIGATÓRIO</h3>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Triagem Segura Ativa</span>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.12)', paddingTop: '10px', marginBottom: '10px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Especialista Recomendado:</p>
                <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--danger)', marginTop: '2px' }}>{result.specialist}</p>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                  <strong>Motivo:</strong> {result.reason}
                </p>
              </div>

              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <strong>Segurança Clínica:</strong> Os protocolos de tratamento domiciliar automatizados foram desativados para esta lesão. Agende um especialista ou busque pronto-atendimento hospitalar.
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)', margin: 0 }}>
              <h4 style={{ fontSize: '13.5px', color: 'var(--primary)', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Lesão Liberada para Cuidado Domiciliar Monitorado
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Essa ferida possui baixo risco imediato. Você pode seguir as orientações abaixo sob supervisão do seu profissional de saúde assistente.
              </p>
            </div>
          )}

          {/* INTERACTIVE WOUND MAPPING (Only for safe home-care or detailed view cases) */}
          {!result.isRedirect && (
            <div className="glass-card" style={{ margin: 0, padding: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)' }}>
                Mapeamento Visual Analisado (Visão Geral da Lesão)
              </h4>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Clique nos pontos numerados da lesão abaixo para entender as descobertas da triagem:
              </p>

              {/* Graphic Mock of Wound Bed */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Visual Wound Sphere */}
                <div style={{ 
                  position: 'relative', 
                  width: '180px', 
                  height: '140px', 
                  borderRadius: '50% 40% 45% 50%', 
                  background: '#f2dede', // Perilesional skin pinkish
                  border: '4px solid #e1b4b4', // Inflamed margin
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  margin: '0 auto',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)'
                }}>
                  {/* Inside: Slough area (esfacelo) yellow */}
                  <div style={{ 
                    width: '110px', 
                    height: '80px', 
                    borderRadius: '40% 50% 30% 60%', 
                    background: '#f5f5dc', // Slough light yellow
                    border: '2px dashed #d4c295',
                    position: 'absolute',
                    top: '15px',
                    left: '25px'
                  }}></div>

                  {/* Inside: Granulation healthy tissue red */}
                  <div style={{ 
                    width: '80px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    background: '#d9534f', // Red granulation
                    position: 'absolute',
                    bottom: '20px',
                    right: '30px',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)'
                  }}></div>

                  {/* Hotspots */}
                  {/* Hotspot 1: Healthy Granulation */}
                  <div className="map-hotspot" style={{ bottom: '40px', right: '60px' }} onClick={() => setSelectedHotspot('1')}>
                    1
                  </div>

                  {/* Hotspot 2: Slough/Esfacelo */}
                  <div className="map-hotspot" style={{ top: '40px', left: '60px' }} onClick={() => setSelectedHotspot('2')}>
                    2
                  </div>

                  {/* Hotspot 3: Perilesional Skin */}
                  <div className="map-hotspot" style={{ bottom: '15px', left: '15px' }} onClick={() => setSelectedHotspot('3')}>
                    3
                  </div>
                </div>

                {/* Hotspot Explanation Box */}
                <div style={{ flex: '1', minWidth: '200px' }}>
                  {selectedHotspot === '1' && (
                    <div className="animate-fade-in" style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(217, 83, 79, 0.08)', borderLeft: '4px solid #d9534f' }}>
                      <strong style={{ fontSize: '13px', color: '#d9534f' }}>[Ponto 1] Tecido de Granulação (80%)</strong>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Pele nova e rica em vasos sanguíneos que cresce no leito da ferida. Cor vermelha viva indica excelente circulação e progresso de cicatrização ótimo.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === '2' && (
                    <div className="animate-fade-in" style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(212, 194, 149, 0.1)', borderLeft: '4px solid #b5a070' }}>
                      <strong style={{ fontSize: '13px', color: '#8c7847' }}>[Ponto 2] Esfacelo / Tecido Inviável (20%)</strong>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Camada amarela de células mortas e secreção seca. Funciona como uma barreira física contra o crescimento de pele nova e atrai bactérias. O uso de hidrogel ajudará a limpar isso.
                      </p>
                    </div>
                  )}
                  {selectedHotspot === '3' && (
                    <div className="animate-fade-in" style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid var(--primary)' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>[Ponto 3] Pele Perilesional</strong>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        A pele íntegra ao redor da lesão. Está ligeiramente ressecada. Aplique creme barreira Cavilon ou Dersani para evitar que a umidade da ferida cause maceração e abra novas feridas.
                      </p>
                    </div>
                  )}
                  {!selectedHotspot && (
                    <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Clique nos números da imagem para ler a análise de cada tecido da lesão.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Detailed Clinical Assessment */}
          <div className="glass-card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avaliação Sistêmica</span>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>{result.type}</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classificação</span>
                <p style={{ fontSize: '13px', fontWeight: '700', color: result.isRedirect ? 'var(--danger)' : 'var(--primary)' }}>{result.severity}</p>
              </div>
            </div>

            {/* AI Estimation Metrics (BLOCO 7 e 8) */}
            {result.aiAreaCm2 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '10px', 
                backgroundColor: 'var(--bg-primary)', 
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '14px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Estimada</span>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', margin: '2px 0' }}>{result.aiAreaCm2} cm²</p>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Comprimento</span>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', margin: '2px 0' }}>{result.aiLengthCm} cm</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Largura</span>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', margin: '2px 0' }}>{result.aiWidthCm} cm</p>
                </div>
              </div>
            )}

            {/* Tissue Analysis Chart (BLOCO 8) */}
            {result.aiTissueAnalysis && result.aiTissueAnalysis.granulacao !== undefined && (
              <div style={{ 
                backgroundColor: 'var(--bg-primary)', 
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '14px',
                border: '1px solid var(--border-color)'
              }}>
                <h4 style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                  Classificação Tecidual (IA)
                </h4>
                
                {/* Horizontal Progress Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.aiTissueAnalysis.necrose > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                        <span>Necrose (Tecido Preto Morto)</span>
                        <strong>{result.aiTissueAnalysis.necrose}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.aiTissueAnalysis.necrose}%`, height: '100%', backgroundColor: '#000000' }}></div>
                      </div>
                    </div>
                  )}
                  {result.aiTissueAnalysis.fibrina > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                        <span>Fibrina / Esfacelo (Tecido Amarelo Morto)</span>
                        <strong>{result.aiTissueAnalysis.fibrina}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.aiTissueAnalysis.fibrina}%`, height: '100%', backgroundColor: '#f0ad4e' }}></div>
                      </div>
                    </div>
                  )}
                  {result.aiTissueAnalysis.granulacao > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                        <span>Granulação (Tecido Vermelho Saudável)</span>
                        <strong>{result.aiTissueAnalysis.granulacao}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.aiTissueAnalysis.granulacao}%`, height: '100%', backgroundColor: '#d9534f' }}></div>
                      </div>
                    </div>
                  )}
                  {result.aiTissueAnalysis.epitelizacao > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                        <span>Epitelização (Pele Nova Cicatrizando)</span>
                        <strong>{result.aiTissueAnalysis.epitelizacao}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.aiTissueAnalysis.epitelizacao}%`, height: '100%', backgroundColor: '#5cb85c' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gemini Triage Summary */}
            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '11.5px', color: '#38a1db', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Resumo da Triagem e Anamnese
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontStyle: 'italic', backgroundColor: 'rgba(56, 161, 219, 0.03)', padding: '10px', borderRadius: '8px' }}>
                "{result.geminiSummary}"
              </p>
            </div>

            {/* Med-PaLM Diagnosis */}
            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Validação de Protocolo Clínico
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', backgroundColor: 'var(--primary-glow)', padding: '10px', borderRadius: '8px' }}>
                {result.medPalmDiagnosis}
              </p>
            </div>

            {/* Conduct / Treatment Plan */}
            <div>
              <h4 style={{ fontSize: '11.5px', color: result.isRedirect ? 'var(--danger)' : 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {result.isRedirect ? 'Ações de Emergência Recomendadas' : 'Conduta de Curativo Sugerida'}
              </h4>
              <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.treatmentPlan.map((step, idx) => (
                  <li key={idx} style={{ listStyleType: 'decimal', lineHeight: '1.4' }}>{step}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Glossary Box */}
          {result.glossaryKeys && result.glossaryKeys.length > 0 && (
            <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', margin: 0 }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                <svg style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                Informativo: Dicionário do Paciente (Glossário)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.glossaryKeys.map((key) => {
                  const item = GLOSSARY_DB[key];
                  if (!item) return null;
                  return (
                    <div key={key} style={{ fontSize: '11.5px' }}>
                      <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{item.term}</strong>:{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{item.def}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Finish & Save buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveAndFinish}
              style={{ width: '100%', height: '54px', fontSize: '15px' }}
            >
              <svg style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Gravar no Histórico Evolutivo
            </button>
            
            <button 
              className="btn btn-secondary" 
              onClick={() => setResult(null)}
              style={{ width: '100%', height: '48px', fontSize: '13.5px' }}
            >
              Realizar Nova Triagem
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
