import { supabase, isSupabaseConfigured as isSupabaseActive } from '../supabaseClient';
const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5,
  import.meta.env.VITE_GEMINI_API_KEY_6,
  import.meta.env.VITE_GEMINI_API_KEY_7,
  import.meta.env.VITE_GEMINI_API_KEY_8,
  import.meta.env.VITE_GEMINI_API_KEY_9,
  import.meta.env.VITE_GEMINI_API_KEY_10,
  import.meta.env.VITE_GEMINI_API_KEY_11,
  import.meta.env.VITE_GEMINI_API_KEY_12,
  import.meta.env.VITE_GEMINI_API_KEY_13,
  import.meta.env.VITE_GEMINI_API_KEY_14,
  import.meta.env.VITE_GEMINI_API_KEY_15,
  import.meta.env.VITE_GEMINI_API_KEY_16,
  import.meta.env.VITE_GEMINI_API_KEY_17,
  import.meta.env.VITE_GEMINI_API_KEY_18,
  import.meta.env.VITE_GEMINI_API_KEY_19,
  import.meta.env.VITE_GEMINI_API_KEY_20
].filter(Boolean);

let currentKeyIndex = 0;

export const isGeminiConfigured = GEMINI_KEYS.length > 0 && GEMINI_KEYS[0] !== 'sua_chave_do_gemini_aqui';

if (!isGeminiConfigured) {
  console.warn(
    '⚠️ [iRec] Chave VITE_GEMINI_API_KEY não configurada no arquivo .env.\n' +
    'A Inteligência Artificial de triagem e conversação rodará em MODO SIMULADO local.'
  );
}

// Convert image File to grayscale and return a new File object
const convertToGrayscale = (imageFile) => {
  return new Promise((resolve) => {
    if (!imageFile || !imageFile.type.startsWith('image/')) {
      resolve(imageFile);
      return;
    }
    
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    img.src = objectUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        
        // Downscale image if it is too large to speed up processing and API transfer
        const maxDimension = 1024;
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          // Standard grayscale weights: 0.299R + 0.587G + 0.114B
          const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = brightness;     // R
          data[i + 1] = brightness; // G
          data[i + 2] = brightness; // B
        }
        
        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) {
            resolve(new File([blob], imageFile.name, { type: 'image/jpeg' }));
          } else {
            resolve(imageFile);
          }
        }, 'image/jpeg', 0.85);
      } catch (err) {
        console.error("Erro ao converter imagem para escala de cinza:", err);
        URL.revokeObjectURL(objectUrl);
        resolve(imageFile); // Fallback to original image on error
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageFile);
    };
  });
};

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

// Helper to fetch from Gemini API with automatic key rotation on 429 Too Many Requests
const fetchGeminiWithRotation = async (modelAndAction, bodyData) => {
  const maxRetries = GEMINI_KEYS.length;
  let attempts = 0;

  while (attempts < maxRetries) {
    if (GEMINI_KEYS.length === 0) {
      throw new Error("Nenhuma chave de API do Gemini válida disponível.");
    }
    
    // Safety check for index out of bounds
    if (currentKeyIndex >= GEMINI_KEYS.length) {
      currentKeyIndex = 0;
    }
    
    const apiKey = GEMINI_KEYS[currentKeyIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelAndAction}?key=${apiKey}`;
    
    try {
      console.log(`[Gemini API] Requesting with key index ${currentKeyIndex} (Total active keys: ${GEMINI_KEYS.length})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData)
      });

      // Permanent failures (invalid/unauthorized keys)
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        console.error(`[Gemini API] Key index ${currentKeyIndex} is invalid/unauthorized (status ${response.status}). Removing permanently from active list.`);
        GEMINI_KEYS.splice(currentKeyIndex, 1);
        if (currentKeyIndex >= GEMINI_KEYS.length) {
          currentKeyIndex = 0;
        }
        continue; // Retry immediately with the next key
      }

      if (response.status === 429) {
        console.warn(`[Gemini API] Key index ${currentKeyIndex} hit rate limit (429). Waiting 2 seconds and rotating key...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
        attempts++;
        continue; // Retry with next key
      }

      if (!response.ok) {
        throw new Error(`Falha no Gemini API: ${response.statusText} (status ${response.status})`);
      }

      return response;
    } catch (err) {
      if (attempts === maxRetries - 1) {
        throw err;
      }
      console.error(`[Gemini API] Request failed with key index ${currentKeyIndex}. Rotating...`, err);
      currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
      attempts++;
    }
  }
  throw new Error("Todas as chaves de API do Gemini excederam o limite ou são inválidas.");
};

export const analyzeWoundWithAI = async (photoFile, clinicalProfile, symptomsText) => {
  const profile = clinicalProfile || {};
  let grayscaleFile = photoFile;
  
  if (photoFile && photoFile.type.startsWith('image/')) {
    try {
      console.log("[iRec AI] Convertendo imagem para tons de cinza...");
      grayscaleFile = await convertToGrayscale(photoFile);
    } catch (e) {
      console.warn("[iRec AI] Falha ao converter para tons de cinza, usando original:", e);
    }
  }

  if (isSupabaseActive && supabase) {
    try {
      console.log("Chamando triagem via Supabase Edge Function...");
      let filePart = null;
      if (grayscaleFile) {
        filePart = await fileToGenerativePart(grayscaleFile);
      }
      const { data, error } = await supabase.functions.invoke('gemini-analysis', {
        body: { clinicalProfile: profile, symptomsText, filePart }
      });
      if (error) throw error;
      if (data) return data;
    } catch (e) {
      console.warn("Falha ao invocar Edge Function, caindo para chamada cliente direta:", e);
    }
  }

  if (!isGeminiConfigured) {
    return null; // Let the caller handle the fallback
  }

  try {
    const parts = [];
    
    // Convert and append the visual image if supplied
    if (grayscaleFile) {
      const imagePart = await fileToGenerativePart(grayscaleFile);
      parts.push(imagePart);
    }

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
1. Caso a queixa ou imagem envolva uma ferida/lesão cutânea ativa, analise a composição de tecidos (necrose, fibrina, granulação e epitelização) e sugira as condutas e coberturas adequadas (ex: hidrogel, alginato de cálcio, hidrocoloide ou carvão ativado com prata).
2. Caso a queixa seja de natureza geral (ex: febre, dor no peito, falta de ar, manchas, exames laboratoriais, tosse, tontura), avalie a gravidade clínica do quadro, as comorbidades do paciente e a interação com seus medicamentos ativos e alergias.
3. Classifique o risco geral como Leve, Moderado, Alto Risco ou Crítico.
4. Identifique Sinais de Alerta (Red Flags) que exijam encaminhamento urgente para o pronto-socorro.
5. Importante (Linguagem e Tom): O paciente é LEIGO e pode ter baixa familiaridade com tecnologia e medicina. Todas as explicações (geminiSummary, medPalmDiagnosis, treatmentPlan e aiRecommendation) devem ser simples, diretas e precisas.
   - O tom das respostas deve ser confortável, empático, calmo e acolhedor. NUNCA use um tom agressivo, frio ou confrontante.
   - EXCEÇÃO DE URGÊNCIA: Se a situação envolver sinais de perigo iminente ou gravidade alta (isRedirect = true), o tom deve mudar para DIRETO e FIRME para indicar a importância da ajuda médica urgente, mas mantendo a segurança e sem ser confrontante ou alarmista.
   - Evite jargões técnicos. Se precisar citar termos como 'necrose', 'fibrina' ou 'exsudato', explique de forma muito simples: 'necrose (pele preta ou casca seca)', 'esfacelo/fibrina (aquela secreção amarelada ou morta)', 'exsudato (líquido que sai do ferimento)'.

Sua tarefa é analisar os sintomas, estimar dados clínicos pertinentes ao tipo de queixa e retornar ESTRITAMENTE um objeto JSON puro, sem formatação markdown envolta (sem blocos de código \`\`\`json ou textos adicionais), correspondente a este formato exato:
{
  "type": "Tipo da Queixa ou Especialidade Principal (Ex: Clínico Geral, Dermatologia, Cardiologia, Pneumologia, Pé Diabético, Úlcera Venosa, Outros)",
  "lesionStage": "Nível de Gravidade/Estágio (Ex: Leve, Moderado, Avançado, Estágio I, Estágio II, Não Classificável)",
  "severity": "Classificação da gravidade (Ex: Leve, Risco Moderado, Alto Risco, Crítico)",
  "isRedirect": false, -- true se houver sinais de perigo clínico (Red Flags) que exijam atendimento médico imediato (ex: dor torácica opressiva, febre alta persistente, dispneia intensa, infecção sistêmica ativa ou pé insensível infeccionado).
  "specialist": "Especialidade recomendada caso isRedirect seja true (Ex: Pronto-Socorro, Cardiologista, Cirurgião Vascular, Dermatologista), senão string vazia",
  "reason": "Explicação curta e simples do motivo do encaminhamento se isRedirect for true, senão string vazia",
  "geminiSummary": "Resumo em linguagem muito simples da queixa e sintomas relatados pelo paciente",
  "medPalmDiagnosis": "Explicação acolhedora e simples de como os sintomas se relacionam com o histórico e as comorbidades do paciente.",
  "treatmentPlan": [
    "Instrução 1 de cuidado recomendada em linguagem simples (ex: 'Lave o local delicadamente com soro morno' em vez de 'Irrigar com solução salina isotônica')",
    "Instrução 2...",
    "Instrução 3..."
  ],
  "aiAreaCm2": null, -- Estimativa numérica aproximada da área em cm² (somente se for lesão cutânea, senão null)
  "aiLengthCm": null, -- Comprimento em cm (somente se for lesão cutânea, senão null)
  "aiWidthCm": null, -- Largura em cm (somente se for lesão cutânea, senão null)
  "aiTissueAnalysis": {
    "necrose": 0, -- % de necrose se houver lesão (0-100, senão 0)
    "fibrina": 0, -- % de fibrina se houver lesão (0-100, senão 0)
    "granulacao": 0, -- % de granulação se houver lesão (0-100, senão 0)
    "epitelizacao": 0 -- % de epitelização se houver lesão (0-100, senão 0)
  },
  "aiRecommendation": "Recomendação clínica detalhada e indicação de condutas de enfermagem ou suporte médico baseado nos sintomas informados.",
  "clinicalEvolution": "Estável" -- Comparativo do estado geral ("Melhorou", "Estável" ou "Piorou")
}

Nota de Segurança: Se houver qualquer suspeita de risco de vida iminente ou infecção sistêmica, marque isRedirect como true. Seja sempre conservador com pacientes diabéticos, obesos ou com doença arterial periférica. Se houver suspeita de infecção plantar ou isquemia de membro, marque isRedirect como true.`;

    parts.push({ text: systemPrompt });
    parts.push({ text: `Dados adicionais digitados pelo paciente/sintomas: "${symptomsText || 'Sem queixas adicionais descritas.'}". Analise e retorne apenas o JSON.` });

    const response = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const result = await response.json();
    if (!result.candidates || result.candidates.length === 0 || result.promptFeedback?.blockReason) {
      console.error("[iRec AI] Resposta do Gemini bloqueada ou sem candidatos:", result);
      throw new Error(`Chamada do Gemini bloqueada ou sem candidatos: ${result.promptFeedback?.blockReason || 'OUTROS'}`);
    }
    const jsonText = result.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error("Erro na triagem via Gemini API:", err);
    return null;
  }
};

// 2. Chat Conversation
export const chatWithAI = async (message, chatHistory, clinicalProfile, attachedFile = null) => {
  const profile = clinicalProfile || {};
  if (!isGeminiConfigured) {
    return null; // Fallback to simulated replies
  }

  try {
    const formattedHistory = chatHistory.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Perform semantic search on our training knowledge base
    let trainingContextText = "";
    let visualCasesContextText = "";
    try {
      const textMatches = await searchTrainingKnowledge(message);
      if (textMatches && textMatches.length > 0) {
        trainingContextText = textMatches.map((m) => 
          `[Aula/Vídeo de Treinamento: ${m.video_title} - Categoria: ${m.category}] ${m.content}`
        ).join("\n\n");
      }

      const visualMatches = await searchTrainingVisualCases(message);
      if (visualMatches && visualMatches.length > 0) {
        visualCasesContextText = visualMatches.map((m) => 
          `[Caso Clínico Ilustrado do Vídeo: ${m.video_title} - Tempo no Vídeo: ${m.timestamp_str} - Link Imagem: ${m.image_url}] Descrição clínica do caso: ${m.clinical_description}`
        ).join("\n\n");
      }
    } catch (err) {
      console.warn("Erro ao buscar base de treinamento RAG:", err);
    }

    // Keep context window tight (last 6 messages)
    let systemPrompt = `Você é o "Assistente Clínico iRec", um copiloto de saúde especializado em triagem clínica geral, suporte a feridas cutâneas e triagem de sintomas de doenças.
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
- Medicações: ${profile.medications || 'Nenhuma'}
- Alergias: ${profile.allergies || 'Nenhuma'}

DIRETRIZES DE TOM E LINGUAGEM:
1. O paciente é LEIGO. Use respostas no campo 'reply' com linguagem extremamente simples, direta e livre de jargões técnicos complicados.
2. Use tópicos (bullet points) para listar os cuidados ("O que fazer" e "O que evitar").
3. Evite termos médicos difíceis; se precisar usá-los, explique de forma simples (ex: 'vermelhidão na pele' em vez de 'eritema', 'secreção/líquido' em vez de 'exsudado').
4. O tom deve ser confortável, acolhedor, prático, encorajador e empático. NUNCA seja confrontante, frio ou agressivo.
5. Em caso de gravidade ou sinais de alerta (Red Flags), mude para um tom DIRETO, SEGURO e FIRME para instruir o paciente a buscar atendimento imediato, mas mantendo a calma e a acolhida, sem causar desespero ou usar tom de confronto.`;

    if (trainingContextText) {
      systemPrompt += `\n\nCONHECIMENTO EXTRAÍDO DOS VÍDEOS DE TREINAMENTO (Siga essas orientações internas da empresa para responder): \n${trainingContextText}`;
    }

    if (visualCasesContextText) {
      systemPrompt += `\n\nEXEMPLOS DE CASOS CLÍNICOS E IMAGENS REAIS DOS VÍDEOS (Mencione para o usuário que existe esse exemplo visual e mostre o Link Imagem correspondente para ele): \n${visualCasesContextText}`;
    }

    formattedHistory.unshift({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });

    const latestUserPart = { text: message || "Analise o arquivo anexo." };
    const userParts = [latestUserPart];
    
    if (attachedFile) {
      let grayscaleFile = attachedFile;
      if (attachedFile.type.startsWith('image/')) {
        try {
          console.log("[iRec AI] Convertendo anexo do chat para tons de cinza...");
          grayscaleFile = await convertToGrayscale(attachedFile);
        } catch (e) {
          console.warn("[iRec AI] Falha ao converter anexo para tons de cinza:", e);
        }
      }
      const filePart = await fileToGenerativePart(grayscaleFile);
      userParts.push(filePart);
    }

    formattedHistory.push({
      role: 'user',
      parts: userParts
    });

    const response = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
      contents: formattedHistory,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    const resultObj = JSON.parse(jsonText.trim());
    
    // GUARDRAIL CLÍNICO DE VALIDAÇÃO DE SEGURANÇA (DUAS VIAS)
    try {
      const draftReply = resultObj.reply;
      
      const verificationPrompt = `Você é um Médico Revisor Clínico de Segurança.
Sua única tarefa é analisar a orientação (resposta) sugerida para o paciente e a Ficha Clínica dele, e determinar se a orientação recomendada viola qualquer contraindicação clínica conhecida ou apresenta algum risco ao paciente.

Ficha Clínica do Paciente:
- Nome: ${profile.name || 'Paciente'}
- Diabetes: ${profile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão: ${profile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${profile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${profile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}
- Alergias: ${profile.allergies || 'Nenhuma'}

Resposta clínica sugerida:
"${draftReply}"

REGRAS DE SEGURANÇA E LEGISLAÇÃO:
1. Terapia compressiva (ex: Bota de Unna, faixas elásticas) é contraindicada para Doença Arterial Obstrutiva Periférica (isquemia) grave.
2. Curativos hidrocoloides e filmes transparentes são contraindicados para feridas infectadas ou com exsudato abundante.
3. Se o paciente relatar alergia a algum composto recomendado na resposta, isso é um risco grave.
4. Qualquer recomendação de medicamento injetável ou tarjado que o enfermeiro/IA não possa prescrever sem receita médica.

Sua resposta deve ser ESTRITAMENTE um objeto JSON pura correspondente a este formato exato:
{
  "isSafe": true ou false,
  "justification": "Explicação clínica concisa se não for seguro, ou em branco se for seguro",
  "safeAlternative": "Nova resposta totalmente corrigida e segura (escrita em linguagem simples para o paciente) caso a original seja insegura"
}`;

      const validationRes = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
        contents: [{
          role: 'user',
          parts: [{ text: verificationPrompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      const validationData = await validationRes.json();
      const validationText = validationData.candidates[0].content.parts[0].text;
      const validationResult = JSON.parse(validationText.trim());
      
      if (validationResult && validationResult.isSafe === false) {
        console.warn("⚠️ [Safety Guardrail] Bloqueada resposta potencialmente insegura. Justificativa:", validationResult.justification);
        resultObj.reply = validationResult.safeAlternative;
        if (!resultObj.profileUpdates) resultObj.profileUpdates = {};
        if (!resultObj.profileUpdates.triageAlerts) resultObj.profileUpdates.triageAlerts = [];
        resultObj.profileUpdates.triageAlerts.push("Risco clínico mitigado pelo validador: " + validationResult.justification);
      }
    } catch (vErr) {
      console.error("Erro no guardrail de validação silenciosa:", vErr);
    }

    return resultObj;
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

    const responseData = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
      contents: formattedHistory,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    if (!responseData || !responseData.candidates || !responseData.candidates[0]) {
      throw new Error(`Falha no chat do Copiloto Gemini`);
    }
    const jsonText = responseData.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText.trim());
  } catch (err) {
    console.error("Erro na conversação via Copiloto Gemini API:", err);
    return null;
  }
};

// 4. Generate Personalized Clinical Protocol backed by official medical documentation
export const generatePersonalizedProtocol = async (clinicalProfile, latestWoundEntry, isClinician = false) => {
  const profile = clinicalProfile || {};
  if (!isGeminiConfigured) {
    return null; // Fallback to simulated/static protocols
  }

  try {
    const comorbidadesText = [
      profile.hasDiabetes ? 'Diabetes Mellitus' : null,
      profile.hasHypertension ? 'Hipertensão Arterial' : null,
      profile.hasVenousInsufficiency ? 'Insuficiência Venosa' : null,
      profile.hasPeripheralArterialDisease ? 'Doença Arterial Periférica' : null,
      profile.isSmoker ? 'Tabagismo' : null,
      profile.isObese ? 'Obesidade' : null,
      profile.hasAmputationHistory ? 'Histórico de Amputação' : null,
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
- Nome: ${profile.name || 'Paciente'}
- Comorbidades: ${comorbidadesText}
- Outras Condições: ${profile.otherConditions || 'Nenhuma'}
- Alergias Conhecidas: ${profile.allergies || 'Nenhuma'}
- Medicamentos Ativos: ${profile.medications || 'Nenhum'}

DADOS DA LESÃO (ÚLTIMA TRIAGEM):
${triageText}

DIRETRIZES DE TRATAMENTO E RESPALDO MÉDICO:
- Toda recomendação deve se basear em fontes científicas oficiais vigentes, tais como: a Resolução COFEN 567/2018 (Tratamento de Feridas por Enfermeiros), o Manual de Condutas para Tratamento de Feridas do Ministério da Saúde do Brasil, diretrizes da SOBEST, SOBENFeE, WUWHS (World Union of Wound Healing Societies) ou NPIAP (National Pressure Injury Advisory Panel).
- **Adequação às Alergias**: Não prescreva nenhuma cobertura ou componente que contenha alérgenos do paciente.
- **Diabetes/Pé Diabético**: Alerte rigorosamente para o controle glicêmico, alívio de pressão (offloading), e inspecionar diariamente o pé inteiro.
- **Insuficiência Venosa / Úlcera Venosa**: Se não houver doença arterial associada, recomende terapia compressiva (Bota de Unna ou bandagens).
- **Lesão por Pressão (LPP)**: Recomende controle de umidade, mudança de decúbito de 2h/2h e colchão pneumático.
- Dor: Adicione cuidados gentis na limpeza se a dor for moderada/alta.
${isClinician ? '- **Foco Clínico**: Como este guia é direcionado a PROFISSIONAIS (médicos e enfermeiros), evite termos amadores de autocuidado doméstico básico. Redija as etapas em formato de condutas de enfermagem/médica (ex: monitoramento de bordas, exsudação, critérios de desbridamento instrumental, etc.).' : '- **Foco Paciente Leigo**: Como este guia é direcionado a um PACIENTE LEIGO, você DEVE usar uma linguagem extremamente simples, amigável, clara e livre de jargões técnicos. Não use palavras difíceis como "desbridamento", "leito da lesão", "exsudato", "fricção", "epitelização", "isquemia", etc. Substitua-as por termos do dia a dia (ex: "como limpar o ferimento", "secreção", "pele nova", "casca preta", "não esfregue com gaze", "mantenha a ferida úmida para cicatrizar").'}

Sua resposta deve ser ESTRITAMENTE um objeto JSON puro, sem blocos de código markdown ou texto extra, no seguinte formato exato:
{
  "title": "${isClinician ? 'Condutas Clínicas de Apoio à Decisão para: ' + (profile.name || 'Paciente') : 'Nome do Protocolo Customizado (Ex: Protocolo de Úlcera Venosa e Hipertensão)'}",
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

    const response = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

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

    const response = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: `Texto ditado pelo profissional: "${noteText}"` }] }
      ]
    });

    const result = await response.json();
    return result.candidates[0].content.parts[0].text.trim();
  } catch (err) {
    console.error("Erro ao formatar nota SOAP via Gemini API:", err);
    return null;
  }
};

// 6. Telemedicine Transcript Analysis & Clinical Triage
export const analyzeTelemedicineTranscript = async (transcriptText, clinicalProfile = {}) => {
  const profile = clinicalProfile || {};
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
- Nome: ${profile.name || 'Paciente'}
- Diabetes: ${profile.hasDiabetes ? 'Sim' : 'Não'}
- Hipertensão: ${profile.hasHypertension ? 'Sim' : 'Não'}
- Insuficiência Venosa: ${profile.hasVenousInsufficiency ? 'Sim' : 'Não'}
- Doença Arterial Periférica: ${profile.hasPeripheralArterialDisease ? 'Sim' : 'Não'}

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

    const response = await fetchGeminiWithRotation('gemini-2.5-flash:generateContent', {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

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

// Generates a 768-dimensional text embedding using gemini-embedding-001
export const getGeminiEmbedding = async (text) => {
  if (!isGeminiConfigured) return null;
  try {
    const response = await fetchGeminiWithRotation('gemini-embedding-001:embedContent', {
      model: "models/gemini-embedding-001",
      content: {
        parts: [{ text: text }]
      },
      outputDimensionality: 768
    });
    const data = await response.json();
    if (data && data.embedding && data.embedding.values) {
      return data.embedding.values;
    }
  } catch (err) {
    console.error("Erro ao gerar embedding de busca no Gemini:", err);
  }
  return null;
};

// Performs semantic search on the transcribed video knowledge base
export const searchTrainingKnowledge = async (queryText) => {
  if (!supabase || !isSupabaseActive) return [];
  try {
    const embedding = await getGeminiEmbedding(queryText);
    let results = [];
    
    if (embedding) {
      const { data, error } = await supabase.rpc('match_training_knowledge', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 3
      });
      
      if (!error && data) {
        results = data;
      } else if (error) {
        console.error("Erro na busca semântica de textos de treinamento:", error);
      }
    }

    // Fallback: se a busca vetorial falhar ou vier vazia, faz uma busca por texto direto (ILIKE)
    if (results.length === 0 && queryText.length > 2) {
      console.log("[RAG] Ativando busca híbrida por texto (ILIKE) para:", queryText);
      const cleanWord = queryText.trim().split(" ")[0]; // Pega a primeira palavra para simplificar
      const { data: textData, error: textError } = await supabase
        .from('training_knowledge')
        .select('video_title, category, content')
        .or(`category.ilike.%${cleanWord}%,content.ilike.%${cleanWord}%`)
        .limit(2);
        
      if (!textError && textData) {
        results = textData.map(item => ({
          video_title: item.video_title,
          category: item.category,
          content: item.content,
          similarity: 0.9 // Simulado
        }));
      }
    }
    
    return results;
  } catch (err) {
    console.error("Falha ao buscar conhecimento de treinamento:", err);
    return [];
  }
};

// Performs semantic search on the visual cases descriptions
export const searchTrainingVisualCases = async (queryText) => {
  if (!supabase || !isSupabaseActive) return [];
  try {
    const embedding = await getGeminiEmbedding(queryText);
    if (!embedding) return [];

    const { data, error } = await supabase.rpc('match_training_visual_cases', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 2
    });

    if (error) {
      console.error("Erro na busca semântica de casos visuais:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Falha ao buscar casos visuais de treinamento:", err);
    return [];
  }
};


