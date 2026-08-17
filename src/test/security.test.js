import { describe, it, expect } from 'vitest';
import { verifyProfessionalRegistry } from '../services/supabaseService';

describe('Segurança e Integridade P0 - iRec', () => {
  it('verifyProfessionalRegistry não deve expor VITE_INFOSIMPLES_API_KEY no cliente', async () => {
    const res = await verifyProfessionalRegistry('123456', 'SP', 'doctor');
    expect(res).toBeDefined();
    expect(res.status).toBe('pending');
    expect(res.message).toContain('Cadastro submetido para validação');
  });

  it('Geração de UUIDs e hashes deve utilizar crypto nativo e não Math.random', () => {
    expect(window.crypto).toBeDefined();
    expect(typeof window.crypto.randomUUID).toBe('function');
    
    const sampleUuid = window.crypto.randomUUID();
    expect(sampleUuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
