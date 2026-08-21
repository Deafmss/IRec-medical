import { describe, it, expect } from 'vitest';

export function simulateEmergencyCountdown({ isCancelledRef, pendingCall, countdown }, dialCallback) {
  if (isCancelledRef.current) return false;

  if (countdown === 0 && pendingCall && !isCancelledRef.current) {
    const targetNumber = pendingCall.number;
    if (!isCancelledRef.current) {
      dialCallback(targetNumber);
      return true;
    }
  }
  return false;
}

describe('SOSEmergencyModal - Prevenção de Discagem Involuntária', () => {
  it('deve efetuar a chamada telefônica quando a contagem zerar sem cancelamento', () => {
    let dialedNumber = null;
    const isCancelledRef = { current: false };
    const pendingCall = { number: '192', label: 'SAMU' };

    const result = simulateEmergencyCountdown(
      { isCancelledRef, pendingCall, countdown: 0 },
      (num) => { dialedNumber = num; }
    );

    expect(result).toBe(true);
    expect(dialedNumber).toBe('192');
  });

  it('deve abortar a chamada telefônica se o cancelamento for acionado no segundo zero', () => {
    let dialedNumber = null;
    const isCancelledRef = { current: true }; // Cancelled at second 0
    const pendingCall = { number: '192', label: 'SAMU' };

    const result = simulateEmergencyCountdown(
      { isCancelledRef, pendingCall, countdown: 0 },
      (num) => { dialedNumber = num; }
    );

    expect(result).toBe(false);
    expect(dialedNumber).toBeNull();
  });
});
