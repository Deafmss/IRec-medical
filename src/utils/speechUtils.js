// Shared Natural Speech Synthesis Utility for iRec
export const speakNaturalText = (text, rate = 0.95, pitch = 1.0) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    // Vibrate device for tactile feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([60]);
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = rate;
    utterance.pitch = pitch;

    const voices = window.speechSynthesis.getVoices();
    const ptVoices = voices.filter(v => v.lang === 'pt-BR' || v.lang === 'pt_BR' || v.lang.startsWith('pt'));

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
  } catch (err) {
    console.warn('[iRec Speech] Erro ao reproduzir síntese de voz:', err);
  }
};

// Global initializer to load browser voices early
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}
