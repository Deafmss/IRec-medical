import { describe, it, expect } from 'vitest';

export async function simulateTriageAnalysis(mockResultProvider) {
  let errorAlertShown = false;

  const finalResult = await mockResultProvider();
  
  if (finalResult && finalResult.isValidWound === false) {
    const isAnalyzing = false;
    errorAlertShown = true;
    return { isAnalyzing, errorAlertShown, result: null };
  }

  const isAnalyzing = false;
  return { isAnalyzing, errorAlertShown, result: finalResult };
}

describe('ClinicalTriage - Gestão de Estado em Triagem de Imagem', () => {
  it('deve desativar o estado de carregamento quando a imagem for identificada como não-ferida', async () => {
    const res = await simulateTriageAnalysis(async () => ({
      isValidWound: false,
      invalidReason: 'Foto de objeto ou paisagem'
    }));

    expect(res.isAnalyzing).toBe(false);
    expect(res.errorAlertShown).toBe(true);
    expect(res.result).toBeNull();
  });

  it('deve desativar o estado de carregamento e retornar o diagnóstico quando a imagem for válida', async () => {
    const res = await simulateTriageAnalysis(async () => ({
      isValidWound: true,
      type: 'Úlcera Venosa'
    }));

    expect(res.isAnalyzing).toBe(false);
    expect(res.result).toBeDefined();
    expect(res.result.type).toBe('Úlcera Venosa');
  });
});
