import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Remove comentários antes de asseverar. Os comentários deste service worker
 * citam o código defeituoso que substituíram (o `openWindow` com `tel:`, o nome
 * de cache antigo), e sem isso o teste casaria com a explicação em vez do código.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((linha) => !linha.trim().startsWith('//'))
    .join(' ');

const sw = stripComments(readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf-8'));

describe('Service worker — notificação de SOS', () => {
  it('não tem mais o listener de notificationclose que recriava a notificação', () => {
    // O laço era: fechar -> notificationclose -> showNotification -> fechar...
    // Com requireInteraction: true, o usuário ficava sem forma de dispensá-la.
    expect(sw).not.toContain("addEventListener('notificationclose'");
  });

  it('não usa openWindow com tel:, que é inerte em service worker', () => {
    expect(sw).not.toMatch(/openWindow\(\s*['"`]tel:/);
  });

  it('a ação de ligar abre o app com o número a discar', () => {
    expect(sw).toContain('discar=192');
    expect(sw).toContain("action === 'call_samu'");
  });

  it('não usa renotify, que reforçava o alerta insistente', () => {
    expect(sw).not.toContain('renotify: true');
  });

  it('o nome do cache é versionado, não fixo', () => {
    expect(sw).toContain('CACHE_VERSION');
    expect(sw).not.toContain("'irec-v1-cache'");
  });

  it('expõe criação e dispensa explícitas da notificação de SOS', () => {
    expect(sw).toContain('IREC_SOS_SHOW');
    expect(sw).toContain('IREC_SOS_DISMISS');
  });

  it('a notificação criada pelo SW tem os dois botões de ação', () => {
    expect(sw).toContain("action: 'call_samu'");
    expect(sw).toContain("action: 'open_upa'");
  });
});

describe('SOSEmergencyModal — discagem vinda da notificação', () => {
  const modal = stripComments(
    readFileSync(join(process.cwd(), 'src', 'components', 'SOSEmergencyModal.jsx'), 'utf-8')
  );

  it('consome o parâmetro discar e limpa a URL', () => {
    expect(modal).toContain("params.get('discar')");
    expect(modal).toContain("params.delete('discar')");
    expect(modal).toContain('replaceState');
  });

  it('só aceita número curto de emergência, não um telefone arbitrário', () => {
    expect(modal).toMatch(/\/\^\[0-9\]\{3,5\}\$\//);
  });

  it('a discagem passa pela mesma contagem de proteção contra toque acidental', () => {
    expect(modal).toContain('useState(pendingCall ? 3 : null)');
  });

  it('delega a criação da notificação ao service worker', () => {
    expect(modal).toContain("type: 'IREC_SOS_SHOW'");
  });
});
