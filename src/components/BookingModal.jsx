import React, { useState } from 'react';
import { createAppointment } from '../services/supabaseService';

export default function BookingModal({ professional, currentUser, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [modality, setModality] = useState('online'); // 'online' or 'presential'
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [patientAddress, setPatientAddress] = useState(currentUser?.street ? `${currentUser.street}, ${currentUser.number || 'S/N'} - ${currentUser.neighborhood || ''}, ${currentUser.city || ''}` : '');
  const [paymentMethod, setPaymentMethod] = useState('pix'); // 'pix' or 'card'
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [loading, setLoading] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!professional) return null;

  const isNurse = (professional.specialty || '').toLowerCase().includes('enferm') || (professional.specialty || '').toLowerCase().includes('estomaterapia');
  const price = professional.price || professional.consultationFee || (isNurse ? 130 : 250);

  const pixCode = `00020126580014BR.GOV.BCB.PIX0136irec-${professional.id.substring(0, 8)}-${Date.now()}520400005303986540${price.toFixed(2).replace('.', '')}5802BR5912iRec Saude6009Sao Paulo62070503***6304E8A2`;

  const availableTimes = ['08:00', '09:00', '10:30', '14:00', '15:30', '17:00', '19:00'];

  const triggerVibration = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([60]);
    }
  };

  const handleCopyPix = () => {
    triggerVibration();
    navigator.clipboard.writeText(pixCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleConfirmPayment = async () => {
    triggerVibration();
    setLoading(true);
    setErrorMsg('');

    try {
      if (paymentMethod === 'card') {
        if (!cardNumber || !cardHolder || !cardExpiry || !cardCvc) {
          throw new Error('Por favor, preencha todos os dados do cartão de crédito.');
        }
      }

      const appointmentData = {
        patientId: currentUser.id,
        patientName: currentUser.name || 'Paciente',
        patientEmail: currentUser.email || '',
        doctorId: professional.id,
        doctorName: professional.name || 'Profissional de Saúde',
        doctorSpecialty: professional.specialty || (isNurse ? 'Enfermagem Estomaterapia' : 'Médico Especialista'),
        modality: modality, // 'online' or 'presential'
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        notes: notes,
        address: modality === 'presential' ? patientAddress : 'Atendimento Online via Vídeo (Telemedicina)',
        price: price,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
        status: 'confirmed'
      };

      const result = await createAppointment(appointmentData);
      setLoading(false);
      if (result) {
        setStep(5); // Success step
      } else {
        throw new Error('Erro ao registrar agendamento. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao processar contratação.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'var(--font-primary, sans-serif)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '540px',
        maxHeight: '92vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-secondary, #1e293b)',
        borderRadius: '24px',
        border: '2px solid #0284c7',
        boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.3)',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: isNurse ? '#10b981' : '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              {isNurse ? '🩺' : '👨‍⚕️'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                {isNurse ? 'Contratar Enfermeiro(a)' : 'Agendar Consulta Médica'}
              </h3>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                {professional.name} • R$ {price.toFixed(2)}
              </span>
            </div>
          </div>
          <button
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '12px', fontSize: '13.5px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* STEP 1: Modalidade do Atendimento */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#cbd5e1' }}>
              1. Escolha a Modalidade de Atendimento:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => { triggerVibration(); setModality('online'); }}
                style={{
                  backgroundColor: modality === 'online' ? '#0284c7' : '#0f172a',
                  border: `2px solid ${modality === 'online' ? '#38bdf8' : '#334155'}`,
                  color: '#ffffff',
                  borderRadius: '16px',
                  padding: '18px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '32px' }}>💻</span>
                <span style={{ fontSize: '15px', fontWeight: '800' }}>Telemedicina Online</span>
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Atendimento por Vídeo no app</span>
              </button>

              <button
                onClick={() => { triggerVibration(); setModality('presential'); }}
                style={{
                  backgroundColor: modality === 'presential' ? '#10b981' : '#0f172a',
                  border: `2px solid ${modality === 'presential' ? '#34d399' : '#334155'}`,
                  color: '#ffffff',
                  borderRadius: '16px',
                  padding: '18px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '32px' }}>🏠</span>
                <span style={{ fontSize: '15px', fontWeight: '800' }}>Visita Domiciliar</span>
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Curativo / Consulta na sua casa</span>
              </button>
            </div>

            <button
              onClick={() => { triggerVibration(); setStep(2); }}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontWeight: '800',
                fontSize: '16px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              PRÓXIMO: ESCOLHER HORÁRIO ➔
            </button>
          </div>
        )}

        {/* STEP 2: Data & Horário */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#cbd5e1' }}>
              2. Escolha a Data e Horário Desejados:
            </h4>

            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Data da Consulta/Visita:</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Horários Disponíveis:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {availableTimes.map((t) => (
                  <button
                    key={t}
                    onClick={() => { triggerVibration(); setSelectedTime(t); }}
                    style={{
                      backgroundColor: selectedTime === t ? '#0284c7' : '#0f172a',
                      border: `1px solid ${selectedTime === t ? '#38bdf8' : '#334155'}`,
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setStep(1)}
                style={{ flex: 1, backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                ⬅ VOLTAR
              </button>
              <button
                onClick={() => setStep(3)}
                style={{ flex: 2, backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '800', cursor: 'pointer' }}
              >
                PRÓXIMO: DETALHES ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Detalhes & Endereço */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#cbd5e1' }}>
              3. Detalhes do Atendimento:
            </h4>

            {modality === 'presential' && (
              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Endereço Completo para Visita Domiciliar:</label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Descreva brevemente o sintoma ou necessidade:</label>
              <textarea
                rows={3}
                placeholder="Ex: Curativo em úlcera venosa na perna direita, avaliação de pé diabético, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setStep(2)}
                style={{ flex: 1, backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                ⬅ VOLTAR
              </button>
              <button
                onClick={() => setStep(4)}
                style={{ flex: 2, backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '800', cursor: 'pointer' }}
              >
                IR PARA PAGAMENTO ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Checkout & Meios de Pagamento */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#cbd5e1' }}>
              4. Checkout & Pagamento Seguro:
            </h4>

            {/* Total Summary Badge */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Total a Pagar:</span>
                <span style={{ fontSize: '22px', fontWeight: '900', color: '#38bdf8' }}>R$ {price.toFixed(2)}</span>
              </div>
              <span style={{ fontSize: '12px', backgroundColor: '#0284c7', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontWeight: '700' }}>
                {modality === 'online' ? '💻 Online por Vídeo' : '🏠 Visita Domiciliar'}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => { triggerVibration(); setPaymentMethod('pix'); }}
                style={{
                  backgroundColor: paymentMethod === 'pix' ? '#059669' : '#0f172a',
                  border: `2px solid ${paymentMethod === 'pix' ? '#34d399' : '#334155'}`,
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '12px',
                  fontWeight: '800',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>⚡ PIX (Instantâneo)</span>
              </button>

              <button
                onClick={() => { triggerVibration(); setPaymentMethod('card'); }}
                style={{
                  backgroundColor: paymentMethod === 'card' ? '#0284c7' : '#0f172a',
                  border: `2px solid ${paymentMethod === 'card' ? '#38bdf8' : '#334155'}`,
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '12px',
                  fontWeight: '800',
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>💳 Cartão de Crédito</span>
              </button>
            </div>

            {/* PIX Payment view */}
            {paymentMethod === 'pix' && (
              <div style={{ backgroundColor: '#0f172a', border: '1px solid #059669', borderRadius: '16px', padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#a7f3d0', fontWeight: '700' }}>
                  Escaneie o QR Code ou copie a chave PIX abaixo:
                </span>
                
                {/* Simulated QR Code representation */}
                <div style={{ width: '150px', height: '150px', backgroundColor: '#ffffff', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(pixCode)}`}
                    alt="QR Code PIX"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                <button
                  onClick={handleCopyPix}
                  style={{
                    backgroundColor: pixCopied ? '#10b981' : '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 18px',
                    fontWeight: '800',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  {pixCopied ? '✅ CÓDIGO PIX COPIADO!' : '📋 COPIAR CÓDIGO PIX COPIA E COLA'}
                </button>
              </div>
            )}

            {/* Credit Card Payment view */}
            {paymentMethod === 'card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#0f172a', padding: '14px', borderRadius: '14px', border: '1px solid #334155' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>Nome impresso no cartão:</label>
                  <input
                    type="text"
                    placeholder="Nome Completo"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>Número do Cartão:</label>
                  <input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13.5px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>Validade (MM/AA):</label>
                    <input
                      type="text"
                      placeholder="MM/AA"
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8' }}>CVV:</label>
                    <input
                      type="text"
                      placeholder="123"
                      maxLength={4}
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13.5px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setStep(3)}
                style={{ flex: 1, backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                ⬅ VOLTAR
              </button>
              <button
                disabled={loading}
                onClick={handleConfirmPayment}
                style={{
                  flex: 2,
                  backgroundColor: loading ? '#64748b' : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontWeight: '900',
                  fontSize: '16px',
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                {loading ? '⏳ CONFIRMANDO...' : '✅ CONFIRMAR E AGENDAR'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Sucesso & Confirmação */}
        {step === 5 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
            <div style={{ fontSize: '64px' }}>🎉</div>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#34d399' }}>
              Agendamento Confirmado com Sucesso!
            </h3>
            <p style={{ fontSize: '14.5px', color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
              Sua contratação para o dia <strong>{selectedDate.split('-').reverse().join('/')} às {selectedTime}h</strong> com <strong>{professional.name}</strong> foi registrada.
            </p>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '16px', width: '100%', textAlign: 'left', fontSize: '13.5px', color: '#94a3b8' }}>
              <div>📍 <strong>Modalidade:</strong> {modality === 'online' ? '💻 Telemedicina por Vídeo' : '🏠 Visita Domiciliar'}</div>
              <div>📅 <strong>Data/Hora:</strong> {selectedDate.split('-').reverse().join('/')} às {selectedTime}h</div>
              <div>💳 <strong>Valor Pago:</strong> R$ {price.toFixed(2)} ({paymentMethod.toUpperCase()})</div>
            </div>

            <button
              onClick={() => {
                triggerVibration();
                onSuccess?.();
                onClose();
              }}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px 28px',
                fontWeight: '800',
                fontSize: '16px',
                cursor: 'pointer',
                width: '100%',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
              }}
            >
              CONCLUÍDO (VER MINHAS CONSULTAS)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
