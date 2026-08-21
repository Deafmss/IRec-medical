import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  VERIFICADO_EM,
  VALIDADE_DIAS,
  RECURSOS_DECLARADOS,
  diasDesdeVerificacao,
  estaVencido
} from '../data/recursosLocaisDeclarados';

const script = readFileSync(join(process.cwd(), 'scripts', 'verificar-catalogo.mjs'), 'utf-8');

/**
 * Controle positivo do portão de verificação.
 *
 * A checagem FAB-5 reportou PASSOU durante toda a auditoria enquanto seis
 * estabelecimentos de saúde — nome, endereço e telefone — estavam integralmente
 * no código. Causa: `buscar` varre LINHA A LINHA e o regex exigia nome e
 * telefone na mesma linha; os objetos eram multilinha, então o padrão nunca
 * casava.
 *
 * Um portão que afirma que algo foi corrigido quando não foi é pior que portão
 * nenhum: encerra a investigação. Estes testes provam que a checagem casa com o
 * defeito que ela existe para pegar.
 */
describe('verificar-catalogo — as checagens têm dentes', () => {
  it('existe busca em bloco, além da busca linha a linha', () => {
    expect(script).toContain('const buscarBloco');
    expect(script).toMatch(/nao use para procurar objeto multilinha/i);
  });

  it('o escopo de produção exclui teste e dado declarado', () => {
    expect(script).toContain('const PRODUCAO');
    expect(script).toMatch(/\(\?!test\[/);
    expect(script).toMatch(/\(\?!data\[/);
  });

  it('FAB-5 usa busca em bloco, não linha a linha', () => {
    const trecho = script.slice(script.indexOf("id: 'FAB-5'"), script.indexOf("id: 'FAB-5b'"));
    expect(trecho).toContain('buscarBloco');
    expect(trecho).not.toMatch(/const h = buscar\(/);
  });

  it('o regex do FAB-5 casa com um objeto multilinha — o caso que escapava', () => {
    // Reconstrói o padrão exatamente como está no script.
    const padrao =
      /name:\s*["'][^"']*(?:Hospital|UPA|Cl[ií]nica|Posto|Drogaria|Farm[aá]cia|Santa Casa)[^"']*["'][\s\S]{0,400}?phone:\s*["']\s*\(?\d/i;

    const amostraDefeituosa = [
      '{',
      '  id: "itapuranga_hosp_sf",',
      '  name: "Hospital São Francisco",',
      '  lat: -15.562111,',
      '  lon: -49.949483,',
      '  address: "Rua João do Couto Rosa, 249, Centro",',
      '  phone: "(62) 3312-1154"',
      '}'
    ].join('\n');

    expect(padrao.test(amostraDefeituosa)).toBe(true);
  });

  it('o regex antigo NÃO casava — é a prova do falso PASSOU', () => {
    const regexAntigo = /(hospital|upa|clinica|posto).*(phone|telefone)\s*:\s*['"]\s*\(?\d/i;
    const amostra = [
      '  name: "Hospital São Francisco",',
      '  phone: "(62) 3312-1154"'
    ];
    // Linha a linha, como o `buscar` faz: nenhuma linha casa.
    expect(amostra.some((linha) => regexAntigo.test(linha))).toBe(false);
  });

  it('o regex do FAB-5b casa com lista de coordenadas fixas', () => {
    const padrao = /lat:\s*-?\d+\.\d{4,}[\s\S]{0,120}?lon:\s*-?\d+\.\d{4,}/;
    expect(padrao.test('  lat: -15.562111,\n  lon: -49.949483,')).toBe(true);
    // E não dispara em coordenada de baixa precisão (centro de cidade, por ex.)
    expect(padrao.test('lat: -15.5, lon: -49.9')).toBe(false);
  });

  it('SEC-2 procura em bloco e cobre mais que quatro campos', () => {
    const trecho = script.slice(script.indexOf("id: 'SEC-2'"));
    expect(trecho).toContain('buscarBloco');
    expect(trecho).toContain('clinicianName');
    expect(trecho).toContain('selectedPatient');
  });
});

describe('recursos de saúde declarados', () => {
  it('tem data de verificação em formato ISO', () => {
    expect(VERIFICADO_EM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(VERIFICADO_EM))).toBe(false);
  });

  it('está dentro do prazo de reconferência', () => {
    expect(diasDesdeVerificacao()).toBeLessThanOrEqual(VALIDADE_DIAS);
    expect(estaVencido()).toBe(false);
  });

  it('a checagem de validade dispara quando a data envelhece', () => {
    const futuro = new Date(Date.parse(VERIFICADO_EM) + (VALIDADE_DIAS + 5) * 86400000);
    expect(estaVencido(futuro)).toBe(true);
  });

  it('todo estabelecimento tem nome, endereço, telefone e coordenada', () => {
    RECURSOS_DECLARADOS.forEach((regiao) => {
      [...regiao.hospitais, ...regiao.farmacias].forEach((item) => {
        expect(item.name).toBeTruthy();
        expect(item.address).toBeTruthy();
        expect(item.phone).toBeTruthy();
        expect(typeof item.lat).toBe('number');
        expect(typeof item.lon).toBe('number');
      });
    });
  });

  it('declara a origem da informação e o raio de aplicação', () => {
    RECURSOS_DECLARADOS.forEach((regiao) => {
      expect(regiao.cidade).toBeTruthy();
      expect(regiao.estado).toBeTruthy();
      expect(regiao.raioKm).toBeGreaterThan(0);
      expect(typeof regiao.centro.lat).toBe('number');
    });
  });

  it('o serviço de localização não tem mais a lista embutida', () => {
    const svc = readFileSync(join(process.cwd(), 'src', 'services', 'locationService.js'), 'utf-8');
    expect(svc).not.toContain('itapuranga_hosp_sf');
    expect(svc).not.toContain('predefinedHospitals');
    expect(svc).toContain('RECURSOS_DECLARADOS');
  });
});
