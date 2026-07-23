// Shared Natural Speech Synthesis Utility for iRec

let cachedVoices = [];

const loadVoices = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export const speakNaturalText = (text, rate = 0.95, pitch = 1.0) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    // Vibrate device for tactile feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([60]);
    }

    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = rate;
      utterance.pitch = pitch;

      const voices = window.speechSynthesis.getVoices();
      const availableVoices = voices.length > 0 ? voices : cachedVoices;
      const ptVoices = availableVoices.filter(v => v.lang === 'pt-BR' || v.lang === 'pt_BR' || v.lang.startsWith('pt'));

      // 1. STRICT PRIORITY 1: Official Google Assistant Voice ("Google português do Brasil")
      let targetVoice = ptVoices.find(v => 
        v.name.toLowerCase().includes('google português do brasil') ||
        v.name.toLowerCase().includes('google português') ||
        (v.name.toLowerCase().includes('google') && v.lang.startsWith('pt'))
      );

      // 2. PRIORITY 2: High-Quality Microsoft Natural / Neural Voices
      if (!targetVoice) {
        targetVoice = ptVoices.find(v => 
          v.name.toLowerCase().includes('natural') || 
          v.name.toLowerCase().includes('francisca') ||
          v.name.toLowerCase().includes('neural')
        );
      }

      // 3. PRIORITY 3: Any non-robotic fallback voice
      if (!targetVoice) {
        targetVoice = ptVoices.find(v => !v.name.toLowerCase().includes('desktop')) || ptVoices[0];
      }

      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    // If voices are not yet loaded, wait slightly for onvoiceschanged
    const currentVoices = window.speechSynthesis.getVoices();
    if (currentVoices.length === 0) {
      setTimeout(doSpeak, 150);
    } else {
      doSpeak();
    }
  } catch (err) {
    console.warn('[iRec Speech] Erro ao reproduzir síntese de voz:', err);
  }
};
