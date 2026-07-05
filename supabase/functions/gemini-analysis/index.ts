import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chave do Gemini nao configurada no backend do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { clinicalProfile, symptomsText, filePart } = await req.json()

    // Build the system prompt
    const systemPrompt = `Você é um motor de triagem e análise clínica médica de alta precisão, responsável por dar suporte de apoio à decisão clínica e triagem geral de sintomas para qualquer especialidade da medicina.
Analise a queixa, os sintomas informados e a imagem/documento anexado (que pode ser uma lesão cutânea, uma mancha, um exame médico, receita ou queixa visível).
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

DIRETRIZES GERAIS DE TRIAGEM E RECOMENDAÇÃO:
1. Caso a queixa ou imagem envolva uma ferida/lesão cutânea ativa, analise a composição de tecidos (necrose, fibrina, granulação e epitelização) e sugira as condutas e coberturas adequadas (ex: hidrogel, alginato de cálcio, hidrocoloide ou carvão ativado com prata).
2. Caso a queixa seja de natureza geral (ex: febre, dor no peito, falta de ar, manchas, exames laboratoriais, tosse, tontura), avalie a gravidade clínica do quadro, as comorbidades do paciente e a interação com seus medicamentos ativos e alergias.
3. Classifique o risco geral como Leve, Moderado, Alto Risco ou Crítico.
4. Identifique Sinais de Alerta (Red Flags) que exijam encaminhamento urgente para o pronto-socorro.

Sua tarefa é retornar ESTRITAMENTE um objeto JSON puro, correspondente a este formato exato:
{
  "type": "Tipo da Queixa ou Especialidade Principal (Ex: Clínico Geral, Dermatologia, Cardiologia, Pneumologia, Pé Diabético, Úlcera Venosa, Outros)",
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

    const contents = [];
    
    // Add the visual/document part if supplied
    if (filePart) {
      contents.push(filePart);
    }

    contents.push({ text: systemPrompt });
    contents.push({ text: `Dados adicionais/sintomas do paciente: "${symptomsText || 'Sem queixas adicionais.'}". Analise e retorne apenas o JSON.` });

    // Call Gemini Model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: contents }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Falha no Gemini API: ${response.statusText}`);
    }

    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;

    return new Response(
      jsonText.trim(),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
