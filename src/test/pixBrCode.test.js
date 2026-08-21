import { describe, it, expect } from 'vitest';
import { crc16, buildPixPayload, parseBrCode, isValidBrCode } from '../utils/pixBrCode';

describe('CRC-16/CCITT-FALSE', () => {
  // Valor de verificação canônico do catálogo de CRCs para CRC-16/CCITT-FALSE
  // (também chamado CRC-16/IBM-3740): CRC de "123456789" é 0x29B1.
  it('produz 0x29B1 para "123456789"', () => {
    expect(crc16('123456789')).toBe(0x29b1);
  });

  it('produz 0xFFFF para string vazia (valor inicial preservado)', () => {
    expect(crc16('')).toBe(0xffff);
  });

  it('é sensível a alteração de um caractere', () => {
    expect(crc16('123456789')).not.toBe(crc16('123456780'));
  });
});

describe('buildPixPayload', () => {
  const base = {
    key: 'irec.pix.saude@irec.com.br',
    name: 'iRec Saude',
    city: 'Sao Paulo',
    amount: 250
  };

  it('gera payload com CRC válido', () => {
    const payload = buildPixPayload(base);
    expect(isValidBrCode(payload)).toBe(true);
  });

  it('termina com 6304 + 4 dígitos hexadecimais, não com a literal "6304"', () => {
    const payload = buildPixPayload(base);
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
    expect(payload.endsWith('6304')).toBe(false);
  });

  it('monta o campo 54 com comprimento — o defeito original era "540" + valor', () => {
    const payload = buildPixPayload(base);
    // 250.00 tem 6 caracteres, então o campo tem de ser 5406250.00
    expect(payload).toContain('5406250.00');
    expect(payload).not.toContain('540250.00');
  });

  it('todo o payload é percorrível como TLV até o CRC', () => {
    const campos = parseBrCode(buildPixPayload(base));
    expect(campos['00']).toBe('01');       // Payload Format Indicator
    expect(campos['52']).toBe('0000');     // Merchant Category Code
    expect(campos['53']).toBe('986');      // BRL
    expect(campos['54']).toBe('250.00');   // valor
    expect(campos['58']).toBe('BR');       // país
    expect(campos['59']).toBe('iRec Saude');
    expect(campos['60']).toBe('Sao Paulo');
    expect(campos['63']).toHaveLength(4);  // CRC
  });

  it('inclui a chave PIX dentro do campo 26 com o GUI do BCB', () => {
    const campos = parseBrCode(buildPixPayload(base));
    expect(campos['26']).toContain('BR.GOV.BCB.PIX');
    expect(campos['26']).toContain(base.key);
    const internos = parseBrCode(campos['26']);
    expect(internos['00']).toBe('BR.GOV.BCB.PIX');
    expect(internos['01']).toBe(base.key);
  });

  it('omite o campo 54 quando não há valor definido', () => {
    const campos = parseBrCode(buildPixPayload({ ...base, amount: undefined }));
    expect(campos['54']).toBeUndefined();
    expect(isValidBrCode(buildPixPayload({ ...base, amount: undefined }))).toBe(true);
  });

  it('omite o campo 54 para valor inválido em vez de escrever NaN', () => {
    const payload = buildPixPayload({ ...base, amount: 'abc' });
    expect(payload).not.toContain('NaN');
    expect(isValidBrCode(payload)).toBe(true);
  });

  it('remove acento de nome e cidade — o BR Code trafega em ASCII', () => {
    const campos = parseBrCode(buildPixPayload({
      ...base,
      name: 'Clínica São José',
      city: 'Brasília'
    }));
    expect(campos['59']).toBe('Clinica Sao Jose');
    expect(campos['60']).toBe('Brasilia');
  });

  it('respeita os limites de 25 e 15 caracteres do padrão', () => {
    const campos = parseBrCode(buildPixPayload({
      ...base,
      name: 'Nome de recebedor absurdamente longo que estoura o limite',
      city: 'Cidade com nome muito comprido'
    }));
    expect(campos['59'].length).toBeLessThanOrEqual(25);
    expect(campos['60'].length).toBeLessThanOrEqual(15);
  });

  it('recusa gerar código sem chave PIX', () => {
    expect(() => buildPixPayload({ ...base, key: '' })).toThrow(/Chave PIX/);
    expect(() => buildPixPayload({ ...base, key: null })).toThrow(/Chave PIX/);
  });

  it('valores diferentes produzem CRCs diferentes', () => {
    const a = buildPixPayload({ ...base, amount: 250 });
    const b = buildPixPayload({ ...base, amount: 130 });
    expect(a.slice(-4)).not.toBe(b.slice(-4));
  });
});

describe('isValidBrCode', () => {
  it('rejeita o payload malformado que o app gerava antes', () => {
    const antigo = '00020126580014BR.GOV.BCB.PIX0136irec.pix.saude@irec.com.br520400005303986540250.005802BR5910iRec Saude6009Sao Paulo62070503***6304';
    expect(isValidBrCode(antigo)).toBe(false);
  });

  it('rejeita payload com CRC alterado', () => {
    const payload = buildPixPayload({ key: 'a@b.c', name: 'X', city: 'Y', amount: 10 });
    const corrompido = payload.slice(0, -4) + '0000';
    expect(isValidBrCode(corrompido)).toBe(false);
  });

  it('rejeita entrada não-string ou curta', () => {
    expect(isValidBrCode(null)).toBe(false);
    expect(isValidBrCode('123')).toBe(false);
  });
});
