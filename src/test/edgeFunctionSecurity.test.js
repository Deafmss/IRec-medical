import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const raw = readFileSync(
  join(process.cwd(), 'supabase', 'functions', 'gemini-analysis', 'index.ts'),
  'utf-8'
);
const fn = stripComments(raw);

describe('Edge Function — CORS', () => {
  it('não usa Access-Control-Allow-Origin: *', () => {
    expect(fn).not.toMatch(/'Access-Control-Allow-Origin':\s*'\*'/);
  });

  it('monta os cabeçalhos a partir da origem da requisição', () => {
    expect(fn).toContain('buildCorsHeaders');
    expect(fn).toContain("req.headers.get('origin')");
  });

  it('lê a lista de origens de variável de ambiente', () => {
    expect(fn).toContain('ALLOWED_ORIGINS');
  });

  it('declara Vary: Origin, para o cache não misturar respostas', () => {
    expect(fn).toContain("'Vary': 'Origin'");
  });
});

describe('Edge Function — autenticação', () => {
  it('valida o JWT do chamador', () => {
    expect(fn).toContain('authenticateCaller');
    expect(fn).toContain('auth.getUser()');
  });

  it('recusa quando o token é a própria anon key — ela é pública', () => {
    expect(fn).toContain('token === anonKey');
  });

  it('responde 401 sem usuário identificado', () => {
    expect(fn).toContain('status: 401');
    expect(fn).toMatch(/Autenticação obrigatória/);
  });

  it('autentica antes de gastar cota do Gemini', () => {
    const posAuth = fn.indexOf('await authenticateCaller');
    const posKeys = fn.indexOf('const keys = getGeminiKeys()', posAuth === -1 ? 0 : posAuth);
    expect(posAuth).toBeGreaterThan(-1);
    expect(posKeys).toBeGreaterThan(posAuth);
  });

  it('rejeita método diferente de POST', () => {
    expect(fn).toContain('status: 405');
  });
});

describe('Edge Function — limite por usuário', () => {
  it('existe limite por usuário e por hora', () => {
    expect(fn).toContain('RATE_LIMIT_MAX');
    expect(fn).toContain('RATE_LIMIT_WINDOW_MS');
    expect(fn).toContain('isWithinRateLimit');
  });

  it('responde 429 ao estourar', () => {
    expect(fn).toContain('status: 429');
  });
});

describe('Edge Function — injeção de prompt', () => {
  it('não interpola mais os campos do paciente no system prompt', () => {
    // Antes: `- Alergias Conhecidas: ${profile.allergies}` dentro do systemPrompt.
    expect(fn).not.toMatch(/Alergias Conhecidas: \$\{profile\.allergies\}/);
    expect(fn).not.toMatch(/Medicamentos Ativos: \$\{profile\.medications\}/);
    expect(fn).not.toMatch(/Outras Condições: \$\{profile\.otherConditions\}/);
  });

  it('não interpola a transcrição nem o texto ditado no prompt', () => {
    expect(fn).not.toMatch(/Transcrição: "\$\{transcriptText\}"/);
    expect(fn).not.toMatch(/Texto ditado: "\$\{noteText\}"/);
    expect(fn).not.toMatch(/Relato: "\$\{spokenQuery\}"/);
  });

  it('usa bloco de dados delimitado em todas as ações que recebem texto livre', () => {
    // analyzeWound, chatWithAI, formatSOAPNote, analyzeTelemedicineTranscript,
    // getPatientFirstLineTriage — mais a definição do helper.
    const ocorrencias = fn.split('buildPatientDataPart').length - 1;
    expect(ocorrencias).toBeGreaterThanOrEqual(6);
  });

  it('higieniza tentativas de se passar por instrução', () => {
    expect(fn).toContain('sanitizePatientText');
    expect(fn).toMatch(/system\|assistant\|model\|user/);
    expect(fn).toMatch(/ignore \(as \|todas as \|a \)\?instru/);
  });

  it('limita o tamanho do texto do paciente', () => {
    expect(fn).toContain('maxLength = 2000');
    expect(fn).toContain('.slice(0, maxLength)');
  });

  it('neutraliza tentativa de fechar o delimitador', () => {
    expect(fn).toMatch(/<<<\[\^>\]\*>>>/);
  });
});

describe('config.toml versionado', () => {
  const cfg = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf-8');

  it('declara verify_jwt na função', () => {
    expect(cfg).toContain('[functions.gemini-analysis]');
    expect(cfg).toContain('verify_jwt = true');
  });

  it('não contém segredo', () => {
    expect(cfg).not.toMatch(/AIza[A-Za-z0-9_-]{10}/);
    expect(cfg).not.toMatch(/^GEMINI_API_KEY\s*=/m);
  });
});
