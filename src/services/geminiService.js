const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Convert file to Base64 structure for Gemini Multimodal API
const fileToGenerativePart = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const isGeminiConfigured = !!(GEMINI_API_KEY && GEMINI_API_KEY !== 'sua_chave_do_gemini_aqui');

if (!isGeminiConfigured) {
  console.warn(
    '⚠️ [iRec] Chave VITE_GEMINI_API_KEY não configurada no arquivo .env.\n' +
    'A Inteligência Artificial de triagem e conversação rodará em MODO SIMULADO local.'
  );
}

// 1. Multimodal Wound Analysis
export const analyzeWoundWithAI = async (photoFile, clinicalProfile, symptomsText) => {
  if (!isGeminiConfigured) {
    return null; // Let the caller handle the fallback
  }

  try {
    const parts = [];
    
    // Convert and append the visual image if supplied
    if (photoFile) {
      const imagePart = await fileToGenerativePart(photoFile);
      parts.push(imagePart);
    }

    const systemPrompt = `Você é um motor de triagem e análise médica especialista em feridas cutâneas (wound care) de alta precisão, alinhado com as diretrizes clínicas de anatomia, fisiologia e reparação tecidual.
Analise a imagem da lesão e os sintomas/dados informados.
Considere obrigatoriamente a Ficha Clínica do paciente:
- Nome: ${clinicalProfile.name}
- Data de Nascimento: ${clinicalProfile.birthDate || 'Não informada'}
- Sexo: ${clinicalProfile.gender || 'Não informado'}
- Unidade de Saúde: ${clinicalProfile.healthUnit || 'Não informada'}
- Diabetes: ${clinicalProfile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão Arterial: ${clinicalProfile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${clinicalProfile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${clinicalProfile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}
- Tabagismo: ${clinicalProfile.isSmoker ? 'Sim (Fumante)' : 'Não'}
- Obesidade: ${clinicalProfile.isObese ? 'Sim' : 'Não'}
- Histórico de Amputação: ${clinicalProfile.hasAmputationHistory ? 'Sim' : 'Não'}
- Outras Condições: ${clinicalProfile.otherConditions || 'Nenhuma'}
- Medicamentos Ativos: ${clinicalProfile.medications || 'Nenhum'}
- Alergias Conhecidas: ${clinicalProfile.allergies || 'Nenhuma'}

DIRETRIZES CLÍNICAS DE TRATAMENTO & COBERTURA:
1. Necrose (Tecido Preto Morto): Indicar desbridamento autolítico ou químico (Hidrogel amorfo, Papaína ou Colagenase).
2. Fibrina / Esfacelo (Tecido Amarelo Inviável): Indicar Hidrogel com Alginato (se exsudato leve) ou Alginato de Cálcio puro (se exsudato moderado/alto) para promover desbridamento e gerenciar exsudação.
3. Tecido de Granulação (Vermelho Saudável): Manter umidade ideal e proteger o leito. Indicar Placas de Hidrocolóide, Espumas de Poliuretano, ou curativo com AGE (Ácidos Graxos Essenciais / Dersani).
4. Epitelização (Pele Nova Rosa): Proteger a pele recém-formada com Hidrocolóide Extra Fino ou AGE.
5. Infecção Ativa (Pus, Eritema extensivo, Calor, Odor Fétido): Indicar coberturas com prata nanocristalina (Alginato com Prata, Espuma com Prata) ou Carvão Ativado com Prata para controle de odor bacteriano, alertando para urgência médica se houver febre ou celulite.
6. Úlceras Venosas: Recomendar terapia de compressão elástica ou inelástica (Bota de Unna) associada ao curativo do leito, se não houver contraindicação arterial.

ALERTAS DE DIAGNÓSTICO DIFERENCIAL (Lesões Crônicas Atípicas):
Fique atento a lesões de evolução atípica ou crônicas persistentes (>4 semanas) sem resposta aos tratamentos convencionais. Identifique potenciais suspeitas de:
- Hanseníase (se houver queixa de perda de sensibilidade térmica/dolorosa na pele ao redor ou pé insensível).
- Leishmaniose Cutânea, Cromomicose, Esporotricose, Paracoccidioidomicose, Micobacterioses atípicas ou Pioderma Gangrenoso (se houver bordas violáceas, hipertróficas, úlceras vegetantes ou lesões satélites).
Nesses casos, adicione um alerta claro na recomendação ('aiRecommendation') sugerindo avaliação dermatológica especializada, biópsia e cultura tecidual.

Sua tarefa é analisar os riscos, estimar dimensões e composição tecidual e retornar ESTRITAMENTE um objeto JSON puro, sem formatação markdown envolta (sem blocos de código \`\`\`json ou textos adicionais), correspondente a este formato exato:
{
  "type": "Tipo da Ferida (Ex: Úlcera Venosa, Pé Diabético, Lesão por Pressão, Úlcera Arterial, Ferida Cirúrgica, Ferida Traumática, Outras)",
  "lesionStage": "Estágio/Grau da Lesão (Ex: Estágio I, Estágio II, Estágio III, Estágio IV, Não Classificável)",
  "severity": "Classificação da gravidade (Ex: Risco Moderado, Leve, Alto Risco, Crítico)",
  "isRedirect": false, -- true se houver sinais de perigo clínico (Red Flags) exigindo pronto-socorro immediate: febre >38C, pus abundante, necrose úmida/seca generalizada com odor fétido, sangramento excessivo, ou pé diabético com sinais ativos de celulite/infecção.
  "specialist": "Especialidade a procurar caso isRedirect seja true (Ex: Cirurgião Vascular, Ambulatório de Pé Diabético, Pronto-Socorro), senão string vazia",
  "reason": "Explicação clínica curta do motivo do encaminhamento de urgência se isRedirect for true, senão string vazia",
  "geminiSummary": "Resumo clínico das queixas e sintomas relatados pelo paciente",
  "medPalmDiagnosis": "Diagnóstico e parecer clínico detalhado validando o estado tecidual da ferida e correlacionando-o com o perfil de comorbidades do paciente.",
  "treatmentPlan": [
    "Instrução 1 de cuidado (Ex: Limpar o leito com soro fisiológico morno sob pressão leve por irrigação)",
    "Instrução 2...",
    "Instrução 3..."
  ],
  "aiAreaCm2": 12.5, -- Estimativa numérica aproximada da área da lesão em cm² (número puro)
  "aiLengthCm": 5.0, -- Estimativa numérica do comprimento vertical em cm (número puro)
  "aiWidthCm": 2.5, -- Estimativa numérica da largura horizontal em cm (número puro)
  "aiTissueAnalysis": {
    "necrose": 10, -- Percentual estimado de necrose (0-100)
    "fibrina": 20, -- Percentual estimado de fibrina/esfacelo (0-100)
    "granulacao": 60, -- Percentual estimado de tecido de granulação vermelho saudável (0-100)
    "epitelizacao": 10 -- Percentual estimado de tecido de epitelização/pele nova (0-100)
  },
  "aiRecommendation": "Sugestão detalhada de conduta clínica e indicação de coberturas (Ex: Placa de Hidrocolóide, Alginato de Cálcio para controle de exsudato) baseada na análise tecidual e comorbidades.",
  "clinicalEvolution": "Estável" -- Escolha entre: "Melhorou", "Estável", "Piorou" (Analise comparativa de acordo com os sintomas)
}

Nota de Segurança: Seja extremamente conservador com pacientes diabéticos, obesos ou com doença arterial periférica. Se houver suspeita de infecção plantar ou isquemia de membro, marque isRedirect como true.`;

    parts.push({ text: systemPrompt });
    parts.push({ text: `Dados adicionais digitados pelo paciente/sintomas: "${symptomsText || 'Sem queixas adicionais descritas.'}". Analise e retorne apenas o JSON.` });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error(`Falha de comunicação com o Gemini: ${response.statusText}`);
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error("Erro na triagem via Gemini API:", err);
    return null;
  }
};

// 2. Chat Conversation
export const chatWithAI = async (message, chatHistory, clinicalProfile) => {
  if (!isGeminiConfigured) {
    return null; // Fallback to simulated replies
  }

  try {
    // Keep context window tight (last 6 messages)
    const formattedHistory = chatHistory.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const systemPrompt = `Você é o "Assistente Clínico iRec", um copiloto de saúde especializado em triagem clínica geral, suporte a feridas cutâneas e triagem de sintomas de doenças.
Você atua como um triador inteligente para o paciente e para a equipe médica:
- Não se limite a feridas. Trate de queixas gerais como dor de cabeça, febre, sintomas gripais, alergias, mal-estar e outros sintomas.
- Seu objetivo principal é determinar se a situação do paciente exige intervenção médica presencial ou se pode ser tratada com autocuidado seguro em casa (ajudando em casos que não necessitam de atendimento médico imediato).
- Se o caso for leve (ex: cefaleia leve, resfriado simples, azia leve, etc.), dê orientações claras e seguras de autocuidado (ex: repouso, hidratação, uso de analgésicos comuns). Se sugerir medicamentos como Dipirona ou Paracetamol, VERIFIQUE ANTES o histórico de alergias e medicações do paciente para garantir a segurança. Se o paciente relatar ou tiver no prontuário alergia a Dipirona, sugira Paracetamol como alternativa segura!
- Se houver sinais de agravamento ou perigo (Red Flags - ex: dor forte no peito, febre alta persistente >38.5°C por mais de 48h, falta de ar, ferida com pus fétido abundante e febre, etc.), oriente de forma clara e urgente a procurar atendimento médico imediato (Pronto-Socorro ou Unidade de Saúde).
- Ao longo da conversa (que pode ser fragmentada e informal), identifique de forma progressiva e inteligente novas informações clínicas mencionadas pelo paciente para auto-organizar a ficha clínica dele. Se ele mencionar comorbidades (como diabetes ou hipertensão), idade/nascimento (estime a data aproximada se ele der a idade), medicamentos de uso contínuo, fumo, obesidade ou alergias, inclua essas atualizações no objeto 'profileUpdates'. Isso deixará o prontuário organizado para o médico.

Você deve responder ESTRITAMENTE em formato JSON correspondente a este modelo exato:
{
  "reply": "Texto da sua resposta em markdown (explicando cuidados, orientando sobre a queixa, sugerindo autocuidado/medicações seguras se leve, ou instruindo a procurar médico se grave)",
  "profileUpdates": {
    // Inclua apenas os campos que foram informados ou que puderam ser inferidos no diálogo:
    "name": "Nome do paciente",
    "birthDate": "YYYY-MM-DD",
    "gender": "Masculino/Feminino/Outro",
    "healthUnit": "Unidade de Saúde",
    "hasDiabetes": true/false,
    "hasHypertension": true/false,
    "hasVenousInsufficiency": true/false,
    "hasPeripheralArterialDisease": true/false,
    "isSmoker": true/false,
    "isObese": true/false,
    "hasAmputationHistory": true/false,
    "medications": "Texto atualizado de medicamentos contínuos",
    "allergies": "Texto atualizado de alergias",
    "otherConditions": "Texto de outras condições clínicas",
    "triageAlerts": ["alerta 1", "alerta 2"]
  }
}

Antes de sugerir qualquer conduta, cruze com a Ficha Clínica do paciente abaixo.

Ficha clínica atual para referência:
- Nome: ${clinicalProfile.name}
- Data de Nascimento: ${clinicalProfile.birthDate || 'Não informada'}
- Sexo: ${clinicalProfile.gender || 'Não informado'}
- Unidade de Saúde: ${clinicalProfile.healthUnit || 'Não informada'}
- Diabetes: ${clinicalProfile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão Arterial: ${clinicalProfile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${clinicalProfile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${clinicalProfile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}
- Tabagismo: ${clinicalProfile.isSmoker ? 'Sim (Fumante)' : 'Não'}
- Obesidade: ${clinicalProfile.isObese ? 'Sim' : 'Não'}
- Histórico de Amputação: ${clinicalProfile.hasAmputationHistory ? 'Sim' : 'Não'}
- Outras Condições: ${clinicalProfile.otherConditions || 'Nenhuma'}
- Medicações: ${clinicalProfile.medications || 'Nenhuma'}
- Alergias: ${clinicalProfile.allergies || 'Nenhuma'}

Dê respostas concisas, acolhedoras e em parágrafos fáceis de ler no campo 'reply'.`;

    formattedHistory.unshift({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });

    formattedHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: formattedHistory,
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error(`Falha no chat do Gemini: ${response.statusText}`);
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error("Erro na conversação via Gemini API:", err);
    return null;
  }
};

// 3. Doctor's AI Copilot with structured triage, laudo and document suggestion
export const chatWithDoctorCopilot = async (message, chatHistory, patientProfile, woundEntries, doctorProfile) => {
  if (!isGeminiConfigured) {
    return null; // Fallback to simulated replies
  }

  try {
    const formattedHistory = chatHistory.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const formattedWounds = woundEntries.map(entry => `
- Data: ${entry.date}
  Tipo da Ferida: ${entry.type}
  Estágio: ${entry.lesionStage}
  Área Estimada: ${entry.aiAreaCm2 ? `${entry.aiAreaCm2} cm²` : 'N/A'}
  Composição Tecidual: Necrose ${entry.aiTissueAnalysis?.necrose || 0}%, Fibrina ${entry.aiTissueAnalysis?.fibrina || 0}%, Granulação ${entry.aiTissueAnalysis?.granulacao || 0}%, Epitelização ${entry.aiTissueAnalysis?.epitelizacao || 0}%
  Nível de Dor: ${entry.pain}/10
  Exsudato: ${entry.exudate}
  Conduta Prescrita Anteriormente: ${entry.appliedDressing || 'Não prescrito'} (${entry.dressingFrequency || 'Não informada'})
  Notas Médicas Anteriores: ${entry.doctorNotes || 'Sem notas adicionais'}
`).join('\n');

    const systemPrompt = `Você é o "Copiloto Médico de IA da Plataforma iRec", um assistente de inteligência artificial de alta especialização médica em cicatrização de feridas (Wound Care), dermatologia e cirurgia vascular.
Você auxilia o(a) Dr(a). ${doctorProfile.name} (Especialidade: ${doctorProfile.specialty}, CRM: ${doctorProfile.crm}) a analisar casos clínicos, triar a evolução de lesões cutâneas e chegar a laudos diagnósticos precisos.

DADOS DO PACIENTE ATIVO:
- Nome: ${patientProfile.name}
- Idade/Nascimento: ${patientProfile.birthDate || 'Não informada'}
- Sexo: ${patientProfile.gender || 'Não informado'}
- Diabetes: ${patientProfile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão: ${patientProfile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${patientProfile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${patientProfile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}
- Tabagismo: ${patientProfile.isSmoker ? 'Sim (Fumante)' : 'Não'}
- Obesidade: ${patientProfile.isObese ? 'Sim' : 'Não'}
- Histórico de Amputação: ${patientProfile.hasAmputationHistory ? 'Sim' : 'Não'}
- Outras Condições: ${patientProfile.otherConditions || 'Nenhuma'}
- Alergias Conhecidas: ${patientProfile.allergies || 'Nenhuma'}
- Medicamentos Contínuos: ${patientProfile.medications || 'Nenhum'}

HISTÓRICO EVOLUTIVO DE LESÕES (LOG DE ENVIOS):
${formattedWounds || 'Nenhuma lesão ou triagem enviada ainda.'}

INSTRUÇÕES CLÍNICAS:
1. **Triagem e Evolução:** Compare as lesões ao longo do tempo. Analise se a área (cm²) está reduzindo e se o tecido saudável (granulação/epitelização) está aumentando em relação ao tecido inviável (necrose/fibrina). Forneça um laudo de evolução preciso.
2. **Prescrição Personalizada:** Sugira coberturas e condutas específicas cruzando a composição tecidual da ferida com as comorbidades do paciente (ex: muito exsudato em pé diabético requer coberturas de alta absorção como Alginato de Cálcio ou Espuma de Poliuretano; sinais de infecção ou odor requerem Carvão Ativado com Prata).
3. **Segurança e Alergias:** Nunca recomende coberturas ou medicamentos contendo substâncias a que o paciente seja alérgico (verifique o campo Alergias do paciente).
4. **Respostas Médicas:** Comunique-se em linguagem médica formal, citando termos clínicos e justificativas científicas para apoiar a decisão do médico.
5. **Autopreenchimento de Documentos:** Se o médico solicitar uma receita ou atestado, ou se você recomendar um tratamento que justifique a emissão de um documento, você deve incluir o objeto estruturado "suggestedDocument" no JSON de retorno. Isso permitirá que o médico preencha o documento com apenas 1 clique.

Sua resposta deve ser estritamente em formato JSON correspondente a este modelo exato:
{
  "reply": "Seu parecer clínico detalhado, laudo de evolução da lesão e justificativa em markdown formal.",
  "suggestedDocument": {
    // Opcional. Inclua apenas se for sugerida uma receita ou atestado.
    "type": "receita" ou "atestado",
    "content": {
      // Se for "receita":
      "items": [
        {
          "name": "Nome da Cobertura ou Medicamento",
          "dosage": "Ex: 1 cobertura ou 1 bisnaga",
          "route": "Via Tópica" ou "Via Oral" ou "Via Intramuscular" etc.,
          "instructions": "Instruções claras de aplicação/uso (ex: Aplicar no leito da ferida a cada 48h)"
        }
      ],
      // Se for "atestado":
      "days": "Número de dias de afastamento sugerido (ex: 5)",
      "atestadoType": "Afastamento" ou "Comparecimento" ou "Aptidão",
      "reason": "Justificativa médica formatada para atestado (ex: necessita de repouso devido ao tratamento de úlcera venosa ativa em MID)",
      "cid": "Código CID-10 adequado (ex: L98.4 para úlcera crônica de pele)"
    }
  }
}
`;

    formattedHistory.unshift({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });

    formattedHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: formattedHistory,
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error(`Falha no chat do Copiloto Gemini: ${response.statusText}`);
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error("Erro na conversação via Copiloto Gemini API:", err);
    return null;
  }
};

// 4. Generate Personalized Clinical Protocol backed by official medical documentation
export const generatePersonalizedProtocol = async (clinicalProfile, latestWoundEntry, isClinician = false) => {
  if (!isGeminiConfigured) {
    return null; // Fallback to simulated/static protocols
  }

  try {
    const comorbidadesText = [
      clinicalProfile.hasDiabetes ? 'Diabetes Mellitus' : null,
      clinicalProfile.hasHypertension ? 'Hipertensão Arterial' : null,
      clinicalProfile.hasVenousInsufficiency ? 'Insuficiência Venosa' : null,
      clinicalProfile.hasPeripheralArterialDisease ? 'Doença Arterial Periférica' : null,
      clinicalProfile.isSmoker ? 'Tabagismo' : null,
      clinicalProfile.isObese ? 'Obesidade' : null,
      clinicalProfile.hasAmputationHistory ? 'Histórico de Amputação' : null,
    ].filter(Boolean).join(', ') || 'Nenhuma comorbidade grave';

    const triageText = latestWoundEntry ? `
- Tipo da lesão: ${latestWoundEntry.type}
- Estágio da lesão: ${latestWoundEntry.lesionStage}
- Nível de dor: ${latestWoundEntry.pain}/10
- Tipo de secreção (exsudato): ${latestWoundEntry.exudate}
- Tecidos: Necrose ${latestWoundEntry.aiTissueAnalysis?.necrose || 0}%, Fibrina ${latestWoundEntry.aiTissueAnalysis?.fibrina || 0}%, Granulação ${latestWoundEntry.aiTissueAnalysis?.granulacao || 0}%, Epitelização ${latestWoundEntry.aiTissueAnalysis?.epitelizacao || 0}%
` : 'Sem lesão ativa cadastrada.';

    const systemPrompt = `Você é um enfermeiro estomaterapeuta e consultor clínico sênior de feridas cutâneas de alta especialização, credenciado pela SOBEST (Associação Brasileira de Estomaterapia) e amparado pelas resoluções do COFEN (Conselho Federal de Enfermagem).
Sua missão é gerar um **Guia de Protocolos Clínicos Personalizado** ${isClinician ? 'para ser consumido por um profissional de saúde (Médico ou Enfermeiro) sob a forma de apoio à decisão clínica' : 'para um paciente sob a forma de guia de autocuidado doméstico'} baseado na ficha clínica de comorbidades, alergias, idade e no estado atual de suas lesões cutâneas.

PERFIL DO PACIENTE:
- Nome: ${clinicalProfile.name}
- Comorbidades: ${comorbidadesText}
- Outras Condições: ${clinicalProfile.otherConditions || 'Nenhuma'}
- Alergias Conhecidas: ${clinicalProfile.allergies || 'Nenhuma'}
- Medicamentos Ativos: ${clinicalProfile.medications || 'Nenhum'}

DADOS DA LESÃO (ÚLTIMA TRIAGEM):
${triageText}

DIRETRIZES DE TRATAMENTO E RESPALDO MÉDICO:
- Toda recomendação deve se basear em fontes científicas oficiais vigentes, tais como: a Resolução COFEN 567/2018 (Tratamento de Feridas por Enfermeiros), o Manual de Condutas para Tratamento de Feridas do Ministério da Saúde do Brasil, diretrizes da SOBEST, SOBENFeE, WUWHS (World Union of Wound Healing Societies) ou NPIAP (National Pressure Injury Advisory Panel).
- **Adequação às Alergias**: Não prescreva nenhuma cobertura ou componente que contenha alérgenos do paciente.
- **Diabetes/Pé Diabético**: Alerte rigorosamente para o controle glicêmico, alívio de pressão (offloading), e inspecionar diariamente o pé inteiro.
- **Insuficiência Venosa / Úlcera Venosa**: Se não houver doença arterial associada, recomende terapia compressiva (Bota de Unna ou bandagens).
- **Lesão por Pressão (LPP)**: Recomende controle de umidade, mudança de decúbito de 2h/2h e colchão pneumático.
- **Dor**: Adicione cuidados gentis na limpeza se a dor for moderada/alta.
${isClinician ? '- **Foco Clínico**: Como este guia é direcionado a PROFISSIONAIS (médicos e enfermeiros), evite termos amadores de autocuidado doméstico básico. Redija as etapas em formato de condutas de enfermagem/médica (ex: monitoramento de bordas, exsudação, critérios de desbridamento instrumental, etc.).' : ''}

Sua resposta deve ser ESTRITAMENTE um objeto JSON puro, sem blocos de código markdown ou texto extra, no seguinte formato exato:
{
  "title": "${isClinician ? 'Condutas Clínicas de Apoio à Decisão para: ' + clinicalProfile.name : 'Nome do Protocolo Customizado (Ex: Protocolo de Úlcera Venosa e Hipertensão)'}",
  "description": "Explicação clínica personalizada relacionando a lesão às comorbidades do paciente e os cuidados sistêmicos (ex: controle da glicose, repouso com pernas elevadas, etc.)",
  "steps": [
    {
      "title": "Título do Passo 1 (Ex: ${isClinician ? 'Avaliação Exsudativa e Limpeza do Leito' : 'Higienização da Lesão'})",
      "desc": "Instruções detalhadas em português de como executar esse passo (ex: ${isClinician ? 'Avaliar volume e aspecto do exsudato. Irrigar leito com PHMB sob pressão controlada...' : 'Lavar o Leito com soro fisiológico morno por irrigação...'})"
    },
    {
      "title": "Título do Passo 2...",
      "desc": "..."
    }
  ],
  "materials": [
    {
      "name": "Nome exato da cobertura/produto recomendado (Ex: Hidrogel com Alginato 85g)",
      "price": "${isClinician ? 'Instrução de Troca (Ex: Aplicar a cada 48h-72h)' : 'Preço aproximado em R$ (Ex: R$ 42,90)'}",
      "brand": "${isClinician ? 'Mecanismo de Ação Sugerido (Ex: Promove desbridamento autolítico e mantém umidade)' : 'Exemplo de marca de referência confiável (Ex: Curatec)'}"
    }
  ],
  "scientificBacking": "Citações e referências oficiais de diretrizes clínicas que respaldam estas condutas (Ex: Resolução COFEN 567/2018 e Manual de Feridas do Ministério da Saúde/2016)",
  "specialistRecommendation": "Orientações sobre quando buscar avaliação com especialista (Ex: Cirurgião Vascular, Estomaterapeuta, Endocrinologista para controle glicêmico)"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error(`Falha no protocolo do Gemini: ${response.statusText}`);
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error("Erro na geração de protocolo via Gemini API:", err);
    return null;
  }
};

// 5. Format dictated/typed text into a structured SOAP medical note
export const formatSOAPNote = async (noteText, patientProfile, woundEntries) => {
  if (!isGeminiConfigured) {
    return null;
  }

  try {
    const formattedWounds = woundEntries.map(entry => `
- Data: ${entry.date}
  Tipo da Ferida: ${entry.type}
  Estágio: ${entry.lesionStage}
  Área Estimada: ${entry.aiAreaCm2 ? `${entry.aiAreaCm2} cm²` : 'N/A'}
  Composição Tecidual: Necrose ${entry.aiTissueAnalysis?.necrose || 0}%, Fibrina ${entry.aiTissueAnalysis?.fibrina || 0}%, Granulação ${entry.aiTissueAnalysis?.granulacao || 0}%, Epitelização ${entry.aiTissueAnalysis?.epitelizacao || 0}%
  Nível de Dor: ${entry.pain}/10
  Exsudato: ${entry.exudate}
  Conduta Prescrita Anteriormente: ${entry.appliedDressing || 'Não prescrito'} (${entry.dressingFrequency || 'Não informada'})
  Notas Médicas Anteriores: ${entry.doctorNotes || 'Sem notas adicionais'}
`).join('\n');

    const systemPrompt = `Você é um assistente de inteligência artificial de alta especialização médica em cicatrização de feridas (Wound Care) e clínica geral.
Sua tarefa é receber um texto ditado ou digitado pelo médico/enfermeiro e estruturá-lo no formato de prontuário eletrônico padrão SOAP (Subjetivo, Objetivo, Avaliação, Plano), adaptado para a realidade do paciente e lesões ativas.

DADOS DO PACIENTE:
- Nome: ${patientProfile.name}
- Idade/Nascimento: ${patientProfile.birthDate || 'Não informada'}
- Sexo: ${patientProfile.gender || 'Não informado'}
- Diabetes: ${patientProfile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão: ${patientProfile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${patientProfile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${patientProfile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}
- Tabagismo: ${patientProfile.isSmoker ? 'Sim (Fumante)' : 'Não'}
- Obesidade: ${patientProfile.isObese ? 'Sim' : 'Não'}
- Histórico de Amputação: ${patientProfile.hasAmputationHistory ? 'Sim' : 'Não'}
- Alergias Conhecidas: ${patientProfile.allergies || 'Nenhuma'}
- Medicamentos Contínuos: ${patientProfile.medications || 'Nenhum'}

HISTÓRICO RECENTE DA LESÃO:
${formattedWounds || 'Sem registros de lesões anteriores.'}

INSTRUÇÕES DE FORMATAÇÃO DO SOAP:
1. **S - Subjetivo**: Sintomas relatados pelo paciente, queixas de dor, histórico de sintomas relatado.
2. **O - Objetivo**: Achados físicos do exame clínico, mensurações da ferida, aspecto do tecido (necrose, fibrina, granulação), tipo e quantidade de exsudato, odor, temperatura local.
3. **A - Avaliação**: Diagnóstico de enfermagem/médico, classificação da lesão (Ex: Úlcera Venosa Estágio III) e análise da evolução (melhorou, estável, piorou).
4. **P - Plano**: Conduta terapêutica, cobertura prescrita, frequência de troca, procedimentos e orientações de autocuidado (ex: repouso, elevação de membros, controle de comorbidades).

Retorne o texto formatado estritamente como um documento SOAP em português (PT-BR), legível, organizado e profissional. Use cabeçalhos claros com negrito (ex: **S - Subjetivo:**, **O - Objetivo:**, etc.) e bullets. Seja preciso e evite inventar dados que não estejam implícitos no texto ditado ou no histórico do paciente.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: `Texto ditado pelo profissional: "${noteText}"` }] }
        ]
      })
    });

    if (!response.ok) throw new Error(`Falha no SOAP do Gemini: ${response.statusText}`);
    const result = await response.json();
    return result.candidates[0].content.parts[0].text.trim();
  } catch (err) {
    console.error("Erro ao formatar nota SOAP via Gemini API:", err);
    return null;
  }
};

// 6. Telemedicine Transcript Analysis & Clinical Triage
export const analyzeTelemedicineTranscript = async (transcriptText, clinicalProfile = {}) => {
  if (!isGeminiConfigured) {
    return {
      executiveSummary: "Consulta por telemedicina realizada com sucesso. Paciente relata dor controlada e melhora gradual, mas com secreção leve. Orientado a manter limpeza diária.",
      symptoms: [
        { name: "Dor", intensity: "Leve", isWorsening: false },
        { name: "Secreção", intensity: "Leve", isWorsening: false }
      ],
      suggestedPrescriptions: [
        { name: "Soro Fisiológico 0.9%", dosage: "Limpeza diária", category: "Insumo" },
        { name: "Hidrogel Amorfo", dosage: "Aplicar fina camada no leito da ferida", category: "Medicamento" }
      ],
      clinicalEvolution: "Evolução clínica favorável com tecido de granulação ativo. Presença de esfacelo moderado, sem febre ou sinais inflamatórios extensos.",
      riskLevel: "Risco Moderado"
    };
  }

  try {
    const systemPrompt = `Você é um assistente médico de alto nível especializado em wound care (tratamento de feridas cutâneas) e telemedicina.
Sua tarefa é analisar a transcrição de áudio de uma consulta realizada entre um Médico e um Paciente e correlacionar com a ficha clínica do paciente para gerar um prontuário clínico estruturado.

Ficha Clínica do Paciente:
- Nome: ${clinicalProfile.name || 'Paciente'}
- Diabetes: ${clinicalProfile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão: ${clinicalProfile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${clinicalProfile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${clinicalProfile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}

Transcrição da Consulta:
"""
${transcriptText}
"""

Instruções Clínicas:
1. Resuma a queixa do paciente e o parecer do médico em um Resumo Executivo conciso.
2. Identifique os sintomas discutidos (ex: dor, secreção, prurido, febre) e informe a intensidade/gravidade (Leve/Moderada/Severa).
3. Extraia sugestões de medicamentos ou insumos/curativos recomendados pelo médico ao longo do diálogo.
4. Redija um texto de Evolução Clínica formal para ser anexado ao prontuário médico.
5. Classifique o nível de risco da lesão (Leve, Risco Moderado, Alto Risco, Crítico).

Sua resposta deve ser estritamente um objeto JSON puro, sem blocos de código \`\`\`json ou textos adicionais, correspondente a este formato exato:
{
  "executiveSummary": "Resumo conciso de 2 ou 3 frases sobre a consulta.",
  "symptoms": [
    { "name": "Nome do Sintoma", "intensity": "Leve/Moderada/Severa", "isWorsening": true }
  ],
  "suggestedPrescriptions": [
    { "name": "Nome da Cobertura, Pomada ou Remédio", "dosage": "Instrução de uso/Frequência", "category": "Insumo/Medicamento" }
  ],
  "clinicalEvolution": "Texto formal e descritivo de evolução clínica detalhado.",
  "riskLevel": "Leve/Risco Moderado/Alto Risco/Crítico"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error(`Falha de comunicação com o Gemini: ${response.statusText}`);
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } catch (err) {
    console.error('Erro na análise da transcrição pelo Gemini:', err);
    return {
      executiveSummary: "Erro ao processar análise automática. Transcrição salva para leitura manual.",
      symptoms: [],
      suggestedPrescriptions: [],
      clinicalEvolution: "Erro de processamento da IA. Transcrição bruta: " + transcriptText.substring(0, 200),
      riskLevel: "Risco Moderado"
    };
  }
};


