import { describe, it, expect } from 'vitest';
import { safeExtension, buildMediaPath, toStoragePath } from '../services/mediaStorage';

describe('safeExtension', () => {
  it('extrai a extensão normal', () => {
    expect(safeExtension({ name: 'ferida.webp', type: 'image/webp' })).toBe('webp');
    expect(safeExtension({ name: 'exame.PDF', type: 'application/pdf' })).toBe('pdf');
  });

  it('usa o mime quando o arquivo não tem extensão — foto de câmera costuma não ter', () => {
    // Antes, `name.split('.').pop()` devolvia o nome inteiro como extensão.
    expect(safeExtension({ name: 'image', type: 'image/jpeg' })).toBe('jpeg');
    expect(safeExtension({ name: '', type: 'video/mp4' })).toBe('mp4');
    expect(safeExtension({ name: 'documento', type: 'application/pdf' })).toBe('pdf');
  });

  it('não deixa passar caminho relativo nem caractere de path', () => {
    const ext = safeExtension({ name: 'foto.jpg/../../etc/passwd', type: 'image/jpeg' });
    expect(ext).not.toContain('/');
    expect(ext).not.toContain('.');
  });

  it('não deixa a extensão crescer sem limite', () => {
    expect(safeExtension({ name: `a.${'x'.repeat(50)}`, type: '' }).length).toBeLessThanOrEqual(5);
  });

  it('tem fallback para tipo desconhecido', () => {
    expect(safeExtension({ name: 'arquivo', type: '' })).toBe('bin');
    expect(safeExtension(null)).toBe('bin');
  });
});

describe('buildMediaPath', () => {
  const paciente = '3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071';

  it('põe o arquivo na pasta do paciente — pré-requisito para RLS por caminho', () => {
    const path = buildMediaPath(paciente, { name: 'f.webp', type: 'image/webp' }, 'ferida');
    expect(path.startsWith(`${paciente}/`)).toBe(true);
  });

  it('não grava mais na raiz do bucket', () => {
    const path = buildMediaPath(paciente, { name: 'f.webp', type: 'image/webp' });
    expect(path).toContain('/');
    expect(path).not.toMatch(/^\d+_wound/);
  });

  it('gera caminhos distintos para o mesmo arquivo', () => {
    const f = { name: 'f.webp', type: 'image/webp' };
    const a = buildMediaPath(paciente, f);
    const b = buildMediaPath(paciente, f);
    expect(a).not.toBe(b);
  });

  it('sanitiza id de paciente com caractere de caminho', () => {
    const path = buildMediaPath('../../admin', { name: 'f.webp', type: 'image/webp' });
    expect(path).not.toContain('..');
    expect(path.split('/')).toHaveLength(2);
  });

  it('mantém a extensão correta', () => {
    expect(buildMediaPath(paciente, { name: 'x.png', type: 'image/png' })).toMatch(/\.png$/);
  });
});

describe('toStoragePath — aceita os formatos que já existem no banco', () => {
  it('extrai o caminho de URL pública legada (a que responde 400 hoje)', () => {
    const legada =
      'https://uiaeuzpojqhtjvbqwblb.supabase.co/storage/v1/object/public/wounds/1783302147394_wound.webp';
    expect(toStoragePath(legada, 'wounds')).toBe('1783302147394_wound.webp');
  });

  it('extrai o caminho de URL pública legada com pasta', () => {
    const legada =
      'https://x.supabase.co/storage/v1/object/public/wounds/abc-123/ferida-1.webp';
    expect(toStoragePath(legada, 'wounds')).toBe('abc-123/ferida-1.webp');
  });

  it('extrai o caminho de URL assinada, descartando o token', () => {
    const assinada =
      'https://x.supabase.co/storage/v1/object/sign/wounds/abc/f.webp?token=eyJhbGciOi';
    expect(toStoragePath(assinada, 'wounds')).toBe('abc/f.webp');
  });

  it('devolve o caminho quando já é caminho', () => {
    expect(toStoragePath('abc-123/ferida-1.webp', 'wounds')).toBe('abc-123/ferida-1.webp');
  });

  it('decodifica caractere escapado na URL', () => {
    const legada = 'https://x.supabase.co/storage/v1/object/public/wounds/pasta%20a/f%20b.webp';
    expect(toStoragePath(legada, 'wounds')).toBe('pasta a/f b.webp');
  });

  it('não trata data URL como caminho — é o modo de contingência offline', () => {
    expect(toStoragePath('data:image/webp;base64,AAAA', 'wounds')).toBeNull();
  });

  it('não trata blob URL como caminho', () => {
    expect(toStoragePath('blob:http://localhost/abc', 'wounds')).toBeNull();
  });

  it('não inventa caminho para URL de outro domínio', () => {
    expect(toStoragePath('https://exemplo.com/foto.jpg', 'wounds')).toBeNull();
  });

  it('não confunde bucket diferente', () => {
    const legada = 'https://x.supabase.co/storage/v1/object/public/exams/f.pdf';
    expect(toStoragePath(legada, 'wounds')).toBeNull();
  });

  it('lida com vazio e não-string', () => {
    expect(toStoragePath('', 'wounds')).toBeNull();
    expect(toStoragePath(null, 'wounds')).toBeNull();
    expect(toStoragePath(undefined, 'wounds')).toBeNull();
    expect(toStoragePath(42, 'wounds')).toBeNull();
  });
});
