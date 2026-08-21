import { describe, it, expect } from 'vitest';

export function sanitizeTextForSpeech(text) {
  if (!text) return '';
  return text.replace(/[*#_~`]/g, '').trim();
}

export function handleSpeechStateToggle(currentSpeakingId, targetMsgId, mockCancel, mockSpeak) {
  if (currentSpeakingId === targetMsgId) {
    mockCancel();
    return null; // stopped
  } else {
    mockCancel();
    mockSpeak();
    return targetMsgId; // speaking
  }
}

describe('AIChatAssistant - Síntese de Voz Nativa Web Speech API', () => {
  it('deve sanitizar caracteres de formatação markdown antes de sintetizar voz', () => {
    const markdown = '**Atenção**: Limpar a ferida com *Soro Fisiológico* #1.';
    const clean = sanitizeTextForSpeech(markdown);
    expect(clean).toBe('Atenção: Limpar a ferida com Soro Fisiológico 1.');
  });

  it('deve cancelar o áudio anterior ao iniciar a leitura de uma nova mensagem', () => {
    let canceled = false;
    let spoken = false;

    const mockCancel = () => { canceled = true; };
    const mockSpeak = () => { spoken = true; };

    const newSpeakingId = handleSpeechStateToggle(null, 101, mockCancel, mockSpeak);
    expect(canceled).toBe(true);
    expect(spoken).toBe(true);
    expect(newSpeakingId).toBe(101);
  });

  it('deve pausar o áudio se clicar na mesma mensagem que está sendo lida', () => {
    let canceled = false;
    let spoken = false;

    const mockCancel = () => { canceled = true; };
    const mockSpeak = () => { spoken = true; };

    const newSpeakingId = handleSpeechStateToggle(101, 101, mockCancel, mockSpeak);
    expect(canceled).toBe(true);
    expect(spoken).toBe(false);
    expect(newSpeakingId).toBeNull();
  });
});
