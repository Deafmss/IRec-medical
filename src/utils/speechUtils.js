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

    // Priority selection for Natural / Neural / High Quality Human Voices
    const naturalVoice = ptVoices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Natural') || 
      v.name.includes('Neural') || 
      v.name.includes('Francisca') || 
      v.name.includes('Luciana') || 
      v.name.includes('Felipe') ||
      v.name.includes('Maria')
    ) || ptVoices[0];

    if (naturalVoice) {
      utterance.voice = naturalVoice;
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
