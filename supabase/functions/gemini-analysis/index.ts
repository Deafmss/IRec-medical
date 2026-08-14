import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PREFERRED_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
]
const FALLBACK_MODEL = 'gemini-2.5-flash'

let cachedEdgeModel: string | null = null

// Helper to get active Gemini API keys from Deno environment (GEMINI_API_KEY_1..8, deduplicated)
const getGeminiKeys = (): string[] => {
  const rawKeys = [
    Deno.env.get("GEMINI_API_KEY_1"),
    Deno.env.get("GEMINI_API_KEY_2"),
    Deno.env.get("GEMINI_API_KEY_3"),
    Deno.env.get("GEMINI_API_KEY_4"),
    Deno.env.get("GEMINI_API_KEY_5"),
    Deno.env.get("GEMINI_API_KEY_6"),
    Deno.env.get("GEMINI_API_KEY_7"),
    Deno.env.get("GEMINI_API_KEY_8"),
    Deno.env.get("GEMINI_API_KEY"),
  ].filter((k): k is string => Boolean(k && k.trim() !== ''));
  return Array.from(new Set(rawKeys));
};

let currentKeyIndex = 0;

// Rotation helper for Edge Function calls (handles 429 retries, preserves keys on 404 - IREC-0171)
async function fetchGeminiEdgeWithRotation(urlPath: string, bodyData: any): Promise<Response> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error("Chave do Gemini não configurada no backend do Supabase.");
  }

  const maxRetries = keys.length;
  let attempts = 0;

  while (attempts < maxRetries) {
    if (currentKeyIndex >= keys.length) {
      currentKeyIndex = 0;
    }
    const apiKey = keys[currentKeyIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/${urlPath}?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      // Model not found (404) — do NOT remove key from pool (IREC-0171)
      if (response.status === 404) {
        const errorBody = await response.text();
        throw new Error(`[Gemini API] Modelo não encontrado (404). Resposta: ${errorBody.substring(0, 200)}`);
      }

      // Invalid or unauthorized key (401, 403)
      if (response.status === 401 || response.status === 403) {
        console.error(`[Edge Function] Chave no índice ${currentKeyIndex} é inválida (status ${response.status}). Rotacionando...`);
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        attempts++;
        continue;
      }

      // Rate limit (429)
      if (response.status === 429) {
        console.warn(`[Edge Function] Chave no índice ${currentKeyIndex} atingiu limite de cota (429). Aguardando 2s e rotacionando...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        attempts++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Falha no Gemini API: ${response.statusText} (status ${response.status})`);
      }

      return response;
    } catch (err: any) {
      if (attempts >= maxRetries - 1 || err.message?.includes('404')) {
        throw err;
      }
      currentKeyIndex = (currentKeyIndex + 1) % keys.length;
      attempts++;
    }
  }

  throw new Error("Todas as chaves de API do Gemini no backend excederam o limite ou são inválidas.");
}

async function getEdgeModel(): Promise<string> {
  if (cachedEdgeModel) return cachedEdgeModel;
  const keys = getGeminiKeys();
  if (keys.length === 0) return FALLBACK_MODEL;
  const apiKey = keys[currentKeyIndex % keys.length];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const available = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));

      for (const pref of PREFERRED_MODELS) {
        if (available.includes(pref)) {
          cachedEdgeModel = pref;
          return pref;
        }
      }
    }
  } catch (e) {
    console.warn("[Edge Function] Erro na descoberta de modelos:", e);
  }
  cachedEdgeModel = FALLBACK_MODEL;
  return FALLBACK_MODEL;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const keys = getGeminiKeys();
    if (keys.length === 0) {
      return new Response(
        JSON.stringify({ error: "Chave do Gemini não configurada no backend do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const { action } = payload;

    // 1. Embedding request
    if (action === 'getGeminiEmbedding') {
      const text = payload.text || '';
      const res = await fetchGeminiEdgeWithRotation('models/gemini-embedding-001:embedContent', {
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: 768
      });
      const data = await res.json();
      const embedding = data?.embedding?.values || null;
      return new Response(JSON.stringify({ embedding }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const selectedModel = await getEdgeModel();
    let contents: any[] = [];

    // 2. Explicit Wound Analysis / Triage
    if (action === 'analyzeWound' || !action) {
      const { clinicalProfile, symptomsText, filePart } = payload;
      const profile = clinicalProfile || {};
      const systemPrompt = `Você é um motor de triagem e análise clínica médica de alta precisão, responsável por dar suporte de apoio à decisão clínica e triagem geral de sintomas para qualquer especialidade da medicina.
Analise a queixa, os sintomas informados e a imagem/documento anexado (que pode ser uma lesão cutânea, uma mancha, um exame médico, receita ou queixa visível).
Considere obrigatoriamente a Ficha Clínica do paciente:
- Nome: ${profile.name || 'Paciente'}
- Data de Nascimento: ${profile.birthDate || 'Não informada'}
- Sexo: ${profile.gender || 'Não informado'}
- Unidade de Saúde: ${profile.healthUnit || 'Não informada'}
- Diabetes: ${profile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão Arterial: ${profile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${profile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${profile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}
- Tabagismo: ${profile.isSmoker ? 'Sim (Fumante)' : 'Não'}
- Obesidade: ${profile.isObese ? 'Sim' : 'Não'}
- Histórico de Amputação: ${profile.hasAmputationHistory ? 'Sim' : 'Não'}
- Outras Condições: ${profile.otherConditions || 'Nenhuma'}
- Medicamentos Ativos: ${profile.medications || 'Nenhum'}
- Alergias Conhecidas: ${profile.allergies || 'Nenhuma'}

DIRETRIZES GERAIS DE TRIAGEM E RECOMENDAÇÃO:
0. VALIDAÇÃO RIGOROSA DA IMAGEM: Verifique a imagem anexada. Se a imagem NÃO for uma foto real de pele humana, ferida, lesão, queimadura, erupção cutânea ou exame médico (ex: se for print de celular, meme, carro, objeto ou paisagem), defina "isValidWound": false e explicite em "invalidReason" que a foto não é de uma lesão de pele.
1. Caso a queixa ou imagem envolva uma ferida/lesão cutânea ativa, analise a composição de tecidos (necrose, fibrina, granulação e epitelização) e sugira as condutas e coberturas adequadas.
2. Caso a queixa seja de natureza geral, avalie a gravidade clínica do quadro, as comorbidades do paciente e a interação com seus medicamentos ativos e alergias.
3. Classifique o risco geral como Leve, Moderado, Alto Risco ou Crítico.
4. Identifique Sinais de Alerta (Red Flags) que exijam encaminhamento urgente para o pronto-socorro.

Sua tarefa é retornar ESTRITAMENTE um objeto JSON puro, correspondente a este formato exato:
{
  "isValidWound": true,
  "invalidReason": "",
  "type": "Tipo da Queixa ou Especialidade Principal (Ex: Clínico Geral, Dermatologia, Pé Diabético, Úlcera Venosa, Outros)",
  "lesionStage": "Nível de Gravidade/Estágio (Ex: Leve, Moderado, Avançado, Estágio I, Estágio II, Não Classificável)",
  "severity": "Classificação da gravidade (Ex: Leve, Risco Moderado, Alto Risco, Crítico)",
  "isRedirect": false,
  "specialist": "Especialidade recomendada caso isRedirect seja true, senão string vazia",
  "reason": "Explicação clínica curta do motivo do encaminhamento se isRedirect for true, senão string vazia",
  "geminiSummary": "Resumo clínico das queixas e sintomas relatados pelo paciente",
  "medPalmDiagnosis": "Parecer clínico detalhado contextualizando os sintomas relatados com o perfil de comorbidades e histórico do paciente.",
  "treatmentPlan": [
    "Instrução 1 de conduta recomendada",
    "Instrução 2...",
    "Instrução 3..."
  ],
  "aiAreaCm2": null,
  "aiLengthCm": null,
  "aiWidthCm": null,
  "aiTissueAnalysis": {
    "necrose": 0,
    "fibrina": 0,
    "granulacao": 0,
    "epitelizacao": 0
  },
  "aiRecommendation": "Recomendação detalhada e indicação de condutas baseada nos sintomas.",
  "clinicalEvolution": "Estável"
}

Nota de Segurança: Se houver qualquer suspeita de risco de vida iminente ou infecção sistêmica, marque isRedirect como true.`;

      const parts: any[] = [];
      if (filePart) parts.push(filePart);
      parts.push({ text: systemPrompt });
      parts.push({ text: `Dados adicionais/sintomas do paciente: "${symptomsText || 'Sem queixas adicionais.'}". Analise e retorne apenas o JSON.` });
      contents = [{ parts }];
    } 
    // 3. Chat with AI
    else if (action === 'chatWithAI') {
      const { message, chatHistory, clinicalProfile, attachedFilePart } = payload;
      const profile = clinicalProfile || {};
      const historyToUse = Array.isArray(chatHistory) ? chatHistory.slice(-6) : [];
      const formattedHistory = historyToUse.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      let systemPrompt = `Você é o "Assistente Clínico iRec", um copiloto de saúde especializado em triagem clínica geral, suporte a feridas cutâneas e triagem de sintomas de doenças.`;
      systemPrompt += `\nFicha Clínica do Paciente: Nome: ${profile.name || 'Paciente'}, Diabetes: ${profile.hasDiabetes ? 'Sim' : 'Não'}, Hipertensão: ${profile.hasHypertension ? 'Sim' : 'Não'}, Alergias: ${profile.allergies || 'Nenhuma'}, Medicações: ${profile.medications || 'Nenhuma'}.`;
      systemPrompt += `\nResponda ESTRITAMENTE em formato JSON com {"reply": "sua resposta em markdown", "profileUpdates": {}}.`;

      formattedHistory.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
      const userParts: any[] = [{ text: message || "Analise o arquivo." }];
      if (attachedFilePart) userParts.push(attachedFilePart);
      formattedHistory.push({ role: 'user', parts: userParts });
      contents = formattedHistory;
    } 
    // 4. Doctor Copilot
    else if (action === 'chatWithDoctorCopilot') {
      const { message, chatHistory, patientProfile, woundEntries, doctorProfile } = payload;
      const safeHistory = Array.isArray(chatHistory) ? chatHistory.slice(-6) : [];
      const formattedHistory = safeHistory.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const systemPrompt = `Você é o Copiloto Médico de IA da Plataforma iRec para o Dr. ${doctorProfile?.name || 'Médico'}. Analise o caso de ${patientProfile?.name || 'Paciente'} e retorne JSON com {"reply": "laudo em markdown", "suggestedDocument": null}.`;
      formattedHistory.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
      formattedHistory.push({ role: 'user', parts: [{ text: message }] });
      contents = formattedHistory;
    } 
    // 5. Personalized Protocol
    else if (action === 'generatePersonalizedProtocol') {
      const { clinicalProfile, latestWoundEntry, isClinician } = payload;
      const profile = clinicalProfile || {};
      const systemPrompt = `Você é um enfermeiro estomaterapeuta sênior. Gerar protocolo clínico personalizado em JSON com { "title": "...", "description": "...", "steps": [], "materials": [], "scientificBacking": "...", "specialistRecommendation": "..." } para o paciente ${profile.name || 'Paciente'}.`;
      contents = [{ role: 'user', parts: [{ text: systemPrompt }, { text: JSON.stringify({ profile, latestWoundEntry, isClinician }) }] }];
    } 
    // 6. SOAP Note
    else if (action === 'formatSOAPNote') {
      const { noteText, patientProfile, woundEntries } = payload;
      const systemPrompt = `Estruture o texto a seguir no formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) para o paciente ${patientProfile?.name || 'Paciente'}.\nTexto ditado: "${noteText}"\nFeridas: ${JSON.stringify(woundEntries || [])}`;
      contents = [{ role: 'user', parts: [{ text: systemPrompt }] }];
    } 
    // 7. Telemedicine Transcript Analysis
    else if (action === 'analyzeTelemedicineTranscript') {
      const { transcriptText, clinicalProfile } = payload;
      const systemPrompt = `Analise a transcrição de telemedicina do paciente ${clinicalProfile?.name || 'Paciente'} e retorne JSON com { "executiveSummary": "...", "symptoms": [], "suggestedPrescriptions": [], "clinicalEvolution": "...", "riskLevel": "Leve/Risco Moderado/Alto Risco/Crítico" }.\nTranscrição: "${transcriptText}"`;
      contents = [{ role: 'user', parts: [{ text: systemPrompt }] }];
    } 
    // 8. Patient First-Line Voice Triage
    else if (action === 'getPatientFirstLineTriage') {
      const { spokenQuery, patientProfile } = payload;
      const systemPrompt = `Triagem clínica de primeiro atendimento por voz para ${patientProfile?.name || 'Paciente'}. Relato: "${spokenQuery}". Retorne JSON com { "primarySymptom": "...", "riskLevel": "Verde/Amarelo/Vermelho", "advice": "..." }.`;
      contents = [{ role: 'user', parts: [{ text: systemPrompt }] }];
    }

    const response = await fetchGeminiEdgeWithRotation(`models/${selectedModel}:generateContent`, {
      contents,
      generationConfig: { responseMimeType: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Falha no Gemini API: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.candidates || result.candidates.length === 0 || result.promptFeedback?.blockReason) {
      throw new Error(`Resposta do Gemini bloqueada: ${result.promptFeedback?.blockReason || 'CANDIDATOS_AUSENTES'}`);
    }

    const jsonText = result.candidates[0].content.parts[0].text;
    return new Response(jsonText.trim(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
