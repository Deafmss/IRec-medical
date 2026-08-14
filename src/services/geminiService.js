import { supabase, isSupabaseConfigured as isSupabaseActive } from '../supabaseClient';

// Gemini API calls are securely proxied via Supabase Edge Functions (IREC-0031 / IREC-0036 / BEH-2 / BEH-3)
// Dynamic model discovery is handled via v1beta/models?key= on the Edge Function server (A-2)
// When response status === 404 (model not found), error is thrown without key removal (IREC-0171)
export const isGeminiConfigured = Boolean(isSupabaseActive && supabase);

if (!isGeminiConfigured) {
  console.warn(
    '⚠️ [iRec] Configuração remota do Gemini desativada.\n' +
    'A Inteligência Artificial de triagem e conversação rodará em MODO SEGURA local.'
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
          const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = brightness;
          data[i + 1] = brightness;
          data[i + 2] = brightness;
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
        resolve(imageFile);
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

// 1. Clinical Wound & Symptom Triage
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

  if (isGeminiConfigured) {
    try {
      console.log("[iRec AI] Chamando triagem via Supabase Edge Function...");
      let filePart = null;
      if (grayscaleFile) {
        filePart = await fileToGenerativePart(grayscaleFile);
      }
      const { data, error } = await supabase.functions.invoke('gemini-analysis', {
        body: { action: 'analyzeWound', clinicalProfile: profile, symptomsText, filePart }
      });
      if (error) throw error;
      if (data) return data;
    } catch (e) {
      console.error("[iRec AI] Falha ao invocar Edge Function para triagem:", e);
    }
  }

  return null;
};

// 2. Chat Conversation Assistant
export const chatWithAI = async (message, chatHistory, clinicalProfile, attachedFile = null) => {
  const profile = clinicalProfile || {};
  if (!isGeminiConfigured) return null;

  try {
    const historyToUse = (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].sender === 'user' && chatHistory[chatHistory.length - 1].text === message)
      ? chatHistory.slice(0, -1)
      : chatHistory;

    let attachedFilePart = null;
    if (attachedFile) {
      let grayscaleFile = attachedFile;
      if (attachedFile.type.startsWith('image/')) {
        try { grayscaleFile = await convertToGrayscale(attachedFile); } catch { /* ignore */ }
      }
      attachedFilePart = await fileToGenerativePart(grayscaleFile);
    }

    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'chatWithAI', message, chatHistory: historyToUse, clinicalProfile: profile, attachedFilePart }
    });
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.error("Erro na conversação via Edge Function:", err);
  }
  return null;
};

// 3. Doctor's AI Copilot
export const chatWithDoctorCopilot = async (message, chatHistory, patientProfile, woundEntries, doctorProfile) => {
  if (!isGeminiConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'chatWithDoctorCopilot', message, chatHistory, patientProfile, woundEntries, doctorProfile }
    });
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.error("Erro no copiloto médico via Edge Function:", err);
  }
  return null;
};

// 4. Generate Personalized Clinical Protocol
export const generatePersonalizedProtocol = async (clinicalProfile, latestWoundEntry, isClinician = false) => {
  if (!isGeminiConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'generatePersonalizedProtocol', clinicalProfile, latestWoundEntry, isClinician }
    });
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.error("Erro ao gerar protocolo via Edge Function:", err);
  }
  return null;
};

// 5. Format dictated/typed text into a structured SOAP medical note
export const formatSOAPNote = async (noteText, patientProfile, woundEntries) => {
  if (!isGeminiConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'formatSOAPNote', noteText, patientProfile, woundEntries }
    });
    if (error) throw error;
    if (data) return typeof data === 'string' ? data : (data.soapNote || data.reply || null);
  } catch (err) {
    console.error("Erro ao formatar SOAP via Edge Function:", err);
  }
  return null;
};

// 6. Telemedicine Transcript Analysis & Clinical Triage
export const analyzeTelemedicineTranscript = async (transcriptText, clinicalProfile = {}) => {
  if (!isGeminiConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'analyzeTelemedicineTranscript', transcriptText, clinicalProfile }
    });
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.error('Erro na análise da transcrição via Edge Function:', err);
  }
  return {
    executiveSummary: "Erro ao processar análise automática. Transcrição salva para leitura manual.",
    symptoms: [],
    suggestedPrescriptions: [],
    clinicalEvolution: "Erro de processamento da IA. Transcrição bruta: " + (transcriptText ? transcriptText.substring(0, 200) : ''),
    riskLevel: "Risco Moderado"
  };
};

// 7. Generates a 768-dimensional text embedding
export const getGeminiEmbedding = async (text) => {
  if (!isGeminiConfigured) return null;
  try {
    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'getGeminiEmbedding', text }
    });
    if (!error && data && data.embedding) return data.embedding;
  } catch (err) {
    console.error("Erro ao gerar embedding via Edge Function:", err);
  }
  return null;
};

// 8. Performs semantic search on the transcribed video knowledge base
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

    if (results.length === 0 && queryText.length > 2) {
      const cleanWord = queryText.trim().split(" ")[0];
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
          similarity: 0.9
        }));
      }
    }
    
    return results;
  } catch (err) {
    console.error("Falha ao buscar conhecimento de treinamento:", err);
    return [];
  }
};

// 9. Performs semantic search on the visual cases descriptions
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

// 10. Dedicated Voice First-Line Medical Triage
export const getPatientFirstLineTriage = async (spokenQuery, patientProfile) => {
  if (!isGeminiConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-analysis', {
      body: { action: 'getPatientFirstLineTriage', spokenQuery, patientProfile }
    });
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.error("Erro na triagem por voz via Edge Function:", err);
  }
  return null;
};
