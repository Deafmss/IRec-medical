import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

export default function VitalsTelemetry({ patientId, embeddedMode = false, onClose }) {
  const [activeSubTab, setActiveSubTab] = useState('vitals');
  
  // Real-time Bluetooth States
  const [btStatus, setBtStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [btDeviceName, setBtDeviceName] = useState('');
  const [btError, setBtError] = useState(null);
  const [activeDevice, setActiveDevice] = useState(null);

  // Modal de Inserção Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  // Sinais vitais gerais reais (inicia nulo se não houver aferição prévia)
  const [vitals, setVitals] = useState({
    heartRate: null,
    bloodPressure: null,
    spo2: null,
    bodyTemp: null,
    glucose: null,
    lastUpdated: 'Sem registros',
    source: 'Aguardando aferição'
  });

  // Temperaturas plantar do pé diabético
  const [temperatures, setTemperatures] = useState({
    leftToe: 0,
    rightToe: 0,
    leftPlantar: 0,
    rightPlantar: 0, 
    leftHeel: 0,
    rightHeel: 0
  });

  // Formulário Manual
  const [manualForm, setManualForm] = useState({
    heartRate: '75',
    systolic: '120',
    diastolic: '80',
    spo2: '98',
    bodyTemp: '36.5',
    glucose: '95',
    leftToe: '31.2',
    rightToe: '31.4',
    leftPlantar: '32.2',
    rightPlantar: '32.5',
    leftHeel: '30.8',
    rightHeel: '31.0'
  });

  const isBluetoothSupported = typeof window !== 'undefined' && 'bluetooth' in navigator;

  // Carregar último histórico de telemetria do Supabase
  useEffect(() => {
    let isMounted = true;
    const loadTelemetry = async () => {
      try {
        if (!supabase) return;
        const targetId = patientId || (await supabase.auth.getUser())?.data?.user?.id;
        if (!targetId || !isMounted) return;

        const { data, error } = await supabase
          .from('vitals_telemetry')
          .select('*')
          .eq('patient_id', targetId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data && !error && isMounted) {
          setVitals({
            heartRate: data.heart_rate || null,
            bloodPressure: data.blood_pressure || null,
            spo2: data.spo2 || null,
            bodyTemp: data.body_temp || null,
            glucose: data.glucose || null,
            lastUpdated: new Date(data.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            source: data.source || 'Supabase Sync'
          });

          if (data.temperatures) {
            setTemperatures(data.temperatures);
          }
        }
      } catch (err) {
        console.log('Sem registros anteriores de telemetria no Supabase:', err.message);
      }
    };

    loadTelemetry();
    return () => { isMounted = false; };
  }, [patientId]);

  // Salvar medição no Supabase em Tempo Real
  const saveTelemetryToSupabase = async (newVitals, newTemps, sourceName) => {
    try {
      const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setVitals(prev => ({ ...prev, ...newVitals, lastUpdated: timestamp, source: sourceName }));
      if (newTemps) setTemperatures(newTemps);

      if (!supabase) return;
      const targetId = patientId || (await supabase.auth.getUser())?.data?.user?.id;
      if (!targetId) return;

      await supabase.from('vitals_telemetry').insert({
        patient_id: targetId,
        heart_rate: newVitals.heartRate ?? vitals.heartRate,
        blood_pressure: newVitals.bloodPressure ?? vitals.bloodPressure,
        spo2: newVitals.spo2 ?? vitals.spo2,
        body_temp: newVitals.bodyTemp ?? vitals.bodyTemp,
        glucose: newVitals.glucose ?? vitals.glucose,
        temperatures: newTemps || temperatures,
        source: sourceName,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.log('Gravado localmente (Supabase offline):', err.message);
    }
  };

  // -------------------------------------------------------------
  // CONECTOR REAL WEB BLUETOOTH API (BLE / GATT SERVICES)
  // -------------------------------------------------------------
  const handleConnectBluetooth = async () => {
    if (!isBluetoothSupported) {
      setBtError('Seu navegador não possui suporte ao Web Bluetooth. Utilize o Google Chrome ou Microsoft Edge no Windows, Android ou macOS.');
      return;
    }

    try {
      setBtStatus('connecting');
      setBtError(null);

      // Abrir seletor nativo do sistema para pareamento BLE
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'heart_rate',
          'health_thermometer',
          'pulse_oximeter',
          'blood_pressure',
          'glucose',
          0x180d, 0x1809, 0x1822, 0x1810, 0x1808
        ]
      });

      const deviceName = device.name || 'Dispositivo Médico BLE';
      setBtDeviceName(deviceName);
      setActiveDevice(device);

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('disconnected');
        setBtDeviceName('');
        setActiveDevice(null);
      });

      const server = await device.gatt.connect();
      setBtStatus('connected');

      // Tentar assinar serviços GATT padrão de sinais vitais
      try {
        // 1. Heart Rate GATT Service (0x180D)
        const hrService = await server.getPrimaryService('heart_rate');
        const hrChar = await hrService.getCharacteristic('heart_rate_measurement');
        await hrChar.startNotifications();
        hrChar.addEventListener('characteristicvaluechanged', (event) => {
          const value = event.target.value;
          const flags = value.getUint8(0);
          const hr = (flags & 0x01) === 0 ? value.getUint8(1) : value.getUint16(1, true);
          saveTelemetryToSupabase({ heartRate: hr }, null, `Bluetooth: ${deviceName}`);
        });
      } catch {
        console.log('Serviço de Frequência Cardíaca GATT não suportado neste dispositivo.');
      }

      try {
        // 2. Health Thermometer GATT Service (0x1809)
        const tempService = await server.getPrimaryService('health_thermometer');
        const tempChar = await tempService.getCharacteristic('temperature_measurement');
        await tempChar.startNotifications();
        tempChar.addEventListener('characteristicvaluechanged', (event) => {
          const value = event.target.value;
          // Parse IEEE-11073 32-bit Float
          const rawTemp = value.getUint32(1, true);
          const mantissa = rawTemp & 0x00FFFFFF;
          const exponent = (rawTemp >> 24) - 256;
          const tempC = Number((mantissa * Math.pow(10, exponent)).toFixed(1));
          if (tempC > 20 && tempC < 45) {
            saveTelemetryToSupabase({ bodyTemp: tempC }, null, `Bluetooth: ${deviceName}`);
          }
        });
      } catch {
        console.log('Serviço de Termômetro GATT não suportado neste dispositivo.');
      }

    } catch (err) {
      setBtStatus('disconnected');
      if (err.name !== 'NotFoundError') { // Ignorar se usuário apenas cancelou o diálogo nativo
        setBtError(`Falha ao conectar via Bluetooth: ${err.message}`);
      }
    }
  };

  const handleDisconnectBluetooth = () => {
    if (activeDevice && activeDevice.gatt.connected) {
      activeDevice.gatt.disconnect();
    }
    setBtStatus('disconnected');
    setBtDeviceName('');
    setActiveDevice(null);
  };

  // Processar envio de formulário manual
  const handleSaveManualForm = async (e) => {
    e.preventDefault();
    setManualSaving(true);

    const bpStr = `${manualForm.systolic}/${manualForm.diastolic}`;
    const newVitals = {
      heartRate: parseInt(manualForm.heartRate) || vitals.heartRate,
      bloodPressure: bpStr,
      spo2: parseInt(manualForm.spo2) || vitals.spo2,
      bodyTemp: parseFloat(manualForm.bodyTemp) || vitals.bodyTemp,
      glucose: parseInt(manualForm.glucose) || vitals.glucose
    };

    const newTemps = {
      leftToe: parseFloat(manualForm.leftToe) || temperatures.leftToe,
      rightToe: parseFloat(manualForm.rightToe) || temperatures.rightToe,
      leftPlantar: parseFloat(manualForm.leftPlantar) || temperatures.leftPlantar,
      rightPlantar: parseFloat(manualForm.rightPlantar) || temperatures.rightPlantar,
      leftHeel: parseFloat(manualForm.leftHeel) || temperatures.leftHeel,
      rightHeel: parseFloat(manualForm.rightHeel) || temperatures.rightHeel
    };

    await saveTelemetryToSupabase(newVitals, newTemps, 'Entrada Manual');
    setManualSaving(false);
    setShowManualModal(false);
  };

  // Selos Clínicos
  const getHeartRateSeal = (hr) => {
    if (!hr) return { label: 'Aguardando Aferição', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    if (hr < 60) return { label: 'Bradicardia', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
    if (hr > 100) return { label: 'Taquicardia', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
    return { label: 'Normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  };

  const getBPSeal = (bpStr) => {
    if (!bpStr) return { label: 'Aguardando Aferição', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    const parts = bpStr.split('/');
    const sys = parseInt(parts[0]);
    const dia = parseInt(parts[1]);
    if (isNaN(sys) || isNaN(dia)) return { label: 'Aguardando Aferição', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    if (sys >= 140 || dia >= 90) return { label: 'Hipertensão', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
    if (sys >= 120 || dia >= 80) return { label: 'Pré-Hipertensão', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
    return { label: 'Normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  };

  const getSpo2Seal = (spo2) => {
    if (!spo2) return { label: 'Aguardando Aferição', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    if (spo2 < 90) return { label: 'Hipóxia Severa', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
    if (spo2 < 95) return { label: 'Hipóxia Leve', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
    return { label: 'Excelente', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  };

  const getTempSeal = (t) => {
    if (!t) return { label: 'Aguardando Aferição', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    if (t > 38.0) return { label: 'Febre', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
    if (t > 37.5) return { label: 'Subfebril', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
    if (t < 35.5) return { label: 'Hipotermia', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' };
    return { label: 'Normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  };

  const getGlucoseSeal = (g) => {
    if (!g) return { label: 'Aguardando Aferição', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
    if (g < 70) return { label: 'Hipoglicemia', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
    if (g >= 126) return { label: 'Hiperglicemia', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
    if (g >= 100) return { label: 'Glicemia Alterada', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
    return { label: 'Normal (Jejum)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  };

  // Asymmetry Calculation
  const diffToeVal = temperatures.rightToe - temperatures.leftToe;
  const diffPlantarVal = temperatures.rightPlantar - temperatures.leftPlantar;
  const diffHeelVal = temperatures.rightHeel - temperatures.leftHeel;

  const diffToeAbs = Math.abs(diffToeVal).toFixed(1);
  const diffPlantarAbs = Math.abs(diffPlantarVal).toFixed(1);
  const diffHeelAbs = Math.abs(diffHeelVal).toFixed(1);

  const hasCriticalAsymmetry = parseFloat(diffToeAbs) >= 2.0 || parseFloat(diffPlantarAbs) >= 2.0 || parseFloat(diffHeelAbs) >= 2.0;

  const regions = [
    { name: 'na região dos dedos', val: diffToeVal, abs: parseFloat(diffToeAbs) },
    { name: 'na região plantar', val: diffPlantarVal, abs: parseFloat(diffPlantarAbs) },
    { name: 'na região do calcanhar', val: diffHeelVal, abs: parseFloat(diffHeelAbs) }
  ];
  const maxRegion = regions.reduce((max, r) => r.abs > max.abs ? r : max, regions[0]);
  const hotterFootName = maxRegion.val > 0 ? 'pé direito' : 'pé esquerdo';

  const hrSeal = getHeartRateSeal(vitals.heartRate);
  const bpSeal = getBPSeal(vitals.bloodPressure);
  const spo2Seal = getSpo2Seal(vitals.spo2);
  const tempSeal = getTempSeal(vitals.bodyTemp);
  const glucoseSeal = getGlucoseSeal(vitals.glucose);
  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div className="glass-card glass-card-cyan-glow" style={{
        borderRadius: '24px',
        maxWidth: 'min(960px, 94vw)',
        width: '100%',
        maxHeight: 'calc(100vh - 48px)',
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        boxSizing: 'border-box'
      }}>
        <style>{`
          @keyframes heartPulse {
            0% { transform: scale(1); }
            14% { transform: scale(1.15); }
            28% { transform: scale(1); }
            42% { transform: scale(1.15); }
            70% { transform: scale(1); }
          }
          .irec-heart-pulse {
            display: inline-block;
            animation: heartPulse 1.4s infinite ease-in-out;
          }
          @keyframes spinSync {
            100% { transform: rotate(360deg); }
          }
          .irec-spin-sync {
            animation: spinSync 0.8s linear infinite;
          }
          .irec-glass-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .irec-glass-scroll::-webkit-scrollbar-track {
            background: transparent;
            margin: 8px 0;
          }
          .irec-glass-scroll::-webkit-scrollbar-thumb {
            background: rgba(2, 132, 199, 0.4);
            border-radius: 10px;
          }
          .irec-glass-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(2, 132, 199, 0.8);
          }
        `}</style>

        {/* 1. FIXED HEADER LAYER */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(2, 132, 199, 0.15)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'flex-start',
          backgroundColor: 'rgba(2, 132, 199, 0.05)',
          flexShrink: 0,
          gap: '16px'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: '#0284c7',
              fontSize: '11px',
              fontWeight: '800',
              padding: '4px 12px',
              borderRadius: '50px',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              marginBottom: '6px'
            }}>
              🩺 TELEMETRIA CLÍNICA IoT & BLE REAL
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Monitoramento Integrado de Sinais Vitais & Temperatura Plantar
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: '500' }}>
              Última atualização: {vitals.lastUpdated} ({vitals.source})
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Status do Bluetooth Conectado */}
            {btStatus === 'connected' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }} />
                  Conectado: {btDeviceName}
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectBluetooth}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '20px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Desconectar
                </button>
              </div>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Fechar Janela"
                style={{
                  backgroundColor: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  color: '#0284c7',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 2. SCROLLABLE BODY LAYER */}
        <div className="irec-glass-scroll" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

      {/* Alerta de erro do Bluetooth */}
      {btError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '12px',
          color: '#ef4444',
          fontWeight: '700'
        }}>
          ⚠️ <strong>Aviso:</strong> {btError}
        </div>
      )}

      {/* Painel de Aparelhos Bluetooth Reconhecidos pelo iRec */}
      <div style={{
        backgroundColor: 'rgba(2, 132, 199, 0.06)',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📡</span>
            <span>APARELHOS BLUETOOTH BLE RECONHECIDOS & COMPATÍVEIS</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Serviços GATT Nativos 0x180D / 0x1809 / 0x1822 / 0x1810
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '10px'
        }}>
          <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.04)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.18)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🩺</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Medidores de Pressão</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Omron, G-Tech, Accu-Chek BLE</div>
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.04)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.18)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>💓</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Frequência & Cintas</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Polar H10, Garmin, CooSpo</div>
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.04)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.18)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🫁</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Oxímetros de Pulso</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Contec, Nonin, ChoiceMMed</div>
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.04)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.18)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🌡️</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Termômetros Infravermelhos</div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Termômetros Clínicos BLE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Abas Internas da Telemetria com Trilho Arredondado iOS */}
      <div style={{
        display: 'flex',
        gap: '6px',
        backgroundColor: 'rgba(2, 132, 199, 0.08)',
        padding: '4px',
        borderRadius: '30px',
        border: '1px solid rgba(2, 132, 199, 0.2)',
        marginBottom: '20px',
        width: 'fit-content'
      }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('vitals')}
          style={{
            padding: '7px 18px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '800',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'vitals' ? '#0284c7' : 'transparent',
            color: activeSubTab === 'vitals' ? '#ffffff' : '#0284c7',
            transition: 'all 0.2s ease',
            boxShadow: activeSubTab === 'vitals' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none'
          }}
        >
          📱 Dispositivos Bluetooth & Sinais Vitais
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('plantar')}
          style={{
            padding: '7px 18px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '800',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'plantar' ? '#0284c7' : 'transparent',
            color: activeSubTab === 'plantar' ? '#ffffff' : '#0284c7',
            transition: 'all 0.2s ease',
            boxShadow: activeSubTab === 'plantar' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none'
          }}
        >
          👣 Termometria Plantar (Pé Diabético)
        </button>
      </div>

      {/* Conteúdo Aba 1: Sinais Vitais Gerais */}
      {activeSubTab === 'vitals' && (
        <div className="animate-fade-in" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px'
        }}>
          {/* Card 1: Frequência Cardíaca */}
          <div style={{
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(2, 132, 199, 0.18)',
            backgroundColor: 'rgba(2, 132, 199, 0.04)',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span className="irec-heart-pulse" style={{ fontSize: '26px' }}>❤️</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#0284c7', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>
                BATIMENTOS
              </span>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: '6px 0', fontFamily: 'var(--font-display)' }}>
                {vitals.heartRate ? vitals.heartRate : '--'} <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>BPM</span>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: hrSeal.bg,
              color: hrSeal.color,
              border: `1px solid ${hrSeal.border}`,
              fontWeight: '800',
              display: 'inline-block'
            }}>
              {hrSeal.label}
            </span>
          </div>

          {/* Card 2: Pressão Arterial */}
          <div style={{
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(2, 132, 199, 0.18)',
            backgroundColor: 'rgba(2, 132, 199, 0.04)',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '26px' }}>🩺</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#0284c7', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>
                PRESSÃO ARTERIAL
              </span>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: '6px 0', fontFamily: 'var(--font-display)' }}>
                {vitals.bloodPressure ? vitals.bloodPressure : '--/--'} <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>mmHg</span>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: bpSeal.bg,
              color: bpSeal.color,
              border: `1px solid ${bpSeal.border}`,
              fontWeight: '800',
              display: 'inline-block'
            }}>
              {bpSeal.label}
            </span>
          </div>

          {/* Card 3: Saturação O2 */}
          <div style={{
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(2, 132, 199, 0.18)',
            backgroundColor: 'rgba(2, 132, 199, 0.04)',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '26px' }}>💨</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#0284c7', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>
                SATURAÇÃO O₂
              </span>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: '6px 0', fontFamily: 'var(--font-display)' }}>
                {vitals.spo2 ? `${vitals.spo2}%` : '-- %'}
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: spo2Seal.bg,
              color: spo2Seal.color,
              border: `1px solid ${spo2Seal.border}`,
              fontWeight: '800',
              display: 'inline-block'
            }}>
              {spo2Seal.label}
            </span>
          </div>

          {/* Card 4: Temperatura Corporal */}
          <div style={{
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(2, 132, 199, 0.18)',
            backgroundColor: 'rgba(2, 132, 199, 0.04)',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '26px' }}>🌡️</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#0284c7', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>
                TEMP. CORPORAL
              </span>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: '6px 0', fontFamily: 'var(--font-display)' }}>
                {vitals.bodyTemp ? `${vitals.bodyTemp}°C` : '-- °C'}
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: tempSeal.bg,
              color: tempSeal.color,
              border: `1px solid ${tempSeal.border}`,
              fontWeight: '800',
              display: 'inline-block'
            }}>
              {tempSeal.label}
            </span>
          </div>

          {/* Card 5: Glicemia */}
          <div style={{
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(2, 132, 199, 0.18)',
            backgroundColor: 'rgba(2, 132, 199, 0.04)',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '26px' }}>🩸</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: '#0284c7', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>
                GLICEMIA (JEJUM)
              </span>
              <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: '6px 0', fontFamily: 'var(--font-display)' }}>
                {vitals.glucose ? `${vitals.glucose} mg/dL` : '-- mg/dL'}
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: glucoseSeal.bg,
              color: glucoseSeal.color,
              border: `1px solid ${glucoseSeal.border}`,
              fontWeight: '800',
              display: 'inline-block'
            }}>
              {glucoseSeal.label}
            </span>
          </div>
        </div>
      )}

      {/* Conteúdo Aba 2: Temperatura Plantar (Pé Diabético) */}
      {activeSubTab === 'plantar' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {hasCriticalAsymmetry ? (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '16px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#ffffff'
            }}>
              <span style={{ fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '6px' }}>
                🚨 ALERTA CLÍNICO: Assimetria Térmica Detectada
              </span>
              Há uma variação de <strong style={{ color: '#ef4444', fontSize: '13.5px' }}>{maxRegion.abs.toFixed(1)}°C</strong> {maxRegion.name}. Variações maiores ou iguais a 2.0°C indicam risco elevado de ulceração no <strong style={{ color: '#ef4444', fontSize: '13.5px' }}>{hotterFootName}</strong>. Recomenda-se evitar caminhada prolongada e consultar a equipe de estomaterapia.
            </div>
          ) : (
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              padding: '14px 16px',
              fontSize: '12.5px',
              color: '#10b981',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✅</span>
              <span>Distribuição térmica equilibrada. Diferença térmica menor que 1.0°C (Limiar clínico seguro).</span>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            backgroundColor: 'rgba(2, 132, 199, 0.04)',
            padding: '18px',
            borderRadius: '16px',
            border: '1px solid rgba(2, 132, 199, 0.18)',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.05)',
            backdropFilter: 'blur(10px)'
          }}>
            {/* Left Foot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0284c7', marginBottom: '12px', letterSpacing: '0.5px' }}>
                🦶 PÉ ESQUERDO
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12.5px' }}>
                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: parseFloat(diffToeAbs) >= 2.0 && diffToeVal < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.08)',
                  border: parseFloat(diffToeAbs) >= 2.0 && diffToeVal < 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(2, 132, 199, 0.2)'
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Dedos:</span>
                  <strong style={{ color: parseFloat(diffToeAbs) >= 2.0 && diffToeVal < 0 ? '#ef4444' : '#0284c7', fontWeight: '900' }}>
                    {temperatures.leftToe.toFixed(1)}°C
                  </strong>
                </div>

                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: parseFloat(diffPlantarAbs) >= 2.0 && diffPlantarVal < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.08)',
                  border: parseFloat(diffPlantarAbs) >= 2.0 && diffPlantarVal < 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(2, 132, 199, 0.2)'
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Plantar:</span>
                  <strong style={{ color: parseFloat(diffPlantarAbs) >= 2.0 && diffPlantarVal < 0 ? '#ef4444' : '#0284c7', fontWeight: '900' }}>
                    {temperatures.leftPlantar.toFixed(1)}°C
                  </strong>
                </div>

                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: parseFloat(diffHeelAbs) >= 2.0 && diffHeelVal < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.08)',
                  border: parseFloat(diffHeelAbs) >= 2.0 && diffHeelVal < 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(2, 132, 199, 0.2)'
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Calcanhar:</span>
                  <strong style={{ color: parseFloat(diffHeelAbs) >= 2.0 && diffHeelVal < 0 ? '#ef4444' : '#0284c7', fontWeight: '900' }}>
                    {temperatures.leftHeel.toFixed(1)}°C
                  </strong>
                </div>
              </div>
            </div>

            {/* Right Foot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981', marginBottom: '12px', letterSpacing: '0.5px' }}>
                🦶 PÉ DIREITO
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12.5px' }}>
                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: parseFloat(diffToeAbs) >= 2.0 && diffToeVal > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)',
                  border: parseFloat(diffToeAbs) >= 2.0 && diffToeVal > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Dedos:</span>
                  <strong style={{ color: parseFloat(diffToeAbs) >= 2.0 && diffToeVal > 0 ? '#ef4444' : '#10b981', fontWeight: '900' }}>
                    {temperatures.rightToe.toFixed(1)}°C
                  </strong>
                </div>

                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: parseFloat(diffPlantarAbs) >= 2.0 && diffPlantarVal > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)',
                  border: parseFloat(diffPlantarAbs) >= 2.0 && diffPlantarVal > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Plantar:</span>
                  <strong style={{ color: parseFloat(diffPlantarAbs) >= 2.0 && diffPlantarVal > 0 ? '#ef4444' : '#10b981', fontWeight: '900' }}>
                    {temperatures.rightPlantar.toFixed(1)}°C
                  </strong>
                </div>

                <div style={{
                  display: 'flex',
                  justify: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: parseFloat(diffHeelAbs) >= 2.0 && diffHeelVal > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)',
                  border: parseFloat(diffHeelAbs) >= 2.0 && diffHeelVal > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Calcanhar:</span>
                  <strong style={{ color: parseFloat(diffHeelAbs) >= 2.0 && diffHeelVal > 0 ? '#ef4444' : '#10b981', fontWeight: '900' }}>
                    {temperatures.rightHeel.toFixed(1)}°C
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>

        {/* 3. FIXED FOOTER LAYER */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(2, 132, 199, 0.15)',
          backgroundColor: 'rgba(2, 132, 199, 0.03)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {btStatus === 'connecting' ? (
              <span style={{
                fontSize: '11.5px',
                fontWeight: '800',
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span className="irec-spin-sync">🔄</span>
                Procurando Aparelho BLE...
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectBluetooth}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '30px',
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>🔗</span>
                <span>Conectar Aparelho Bluetooth</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              style={{
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                color: '#0284c7',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                borderRadius: '30px',
                padding: '8px 18px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>➕</span>
              <span>Aferição Manual</span>
            </button>
          </div>

          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Transmissão direta via Web Bluetooth API (GATT BLE)
          </span>
        </div>
      </div>
    </div>
  );

  // Modal secundário de inserção manual via Portal no padrão Human UI (Glassmorphism + Cyan Glow)
  const manualModalJSX = showManualModal && (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card glass-card-cyan-glow" style={{
        maxWidth: '560px',
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        color: 'var(--text-primary)',
        borderRadius: '24px',
        padding: '28px',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        boxShadow: '0 20px 50px rgba(2, 132, 199, 0.15), 0 0 30px rgba(2, 132, 199, 0.08)',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(2, 132, 199, 0.15)', paddingBottom: '14px' }}>
          <div>
            <span style={{
              display: 'inline-block',
              backgroundColor: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              fontSize: '11px',
              fontWeight: '900',
              padding: '4px 12px',
              borderRadius: '20px',
              letterSpacing: '0.6px',
              marginBottom: '6px'
            }}>
              🩺 AFERIÇÃO CLÍNICA MANUAL
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Registrar Sinais Vitais do Paciente
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowManualModal(false)}
            style={{
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#0284c7',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSaveManualForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.3px' }}>
                Frequência Cardíaca (BPM)
              </label>
              <input
                type="number"
                placeholder="Ex: 75"
                value={manualForm.heartRate}
                onChange={e => setManualForm({ ...manualForm, heartRate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.3px' }}>
                Saturação O₂ (%)
              </label>
              <input
                type="number"
                placeholder="Ex: 98"
                value={manualForm.spo2}
                onChange={e => setManualForm({ ...manualForm, spo2: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.3px' }}>
                Pressão Sistólica (mmHg)
              </label>
              <input
                type="number"
                placeholder="Ex: 120"
                value={manualForm.systolic}
                onChange={e => setManualForm({ ...manualForm, systolic: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.3px' }}>
                Pressão Diastólica (mmHg)
              </label>
              <input
                type="number"
                placeholder="Ex: 80"
                value={manualForm.diastolic}
                onChange={e => setManualForm({ ...manualForm, diastolic: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.3px' }}>
                Temperatura Corporal (°C)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 36.5"
                value={manualForm.bodyTemp}
                onChange={e => setManualForm({ ...manualForm, bodyTemp: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: '800', color: '#0284c7', display: 'block', marginBottom: '6px', letterSpacing: '0.3px' }}>
                Glicemia em Jejum (mg/dL)
              </label>
              <input
                type="number"
                placeholder="Ex: 95"
                value={manualForm.glucose}
                onChange={e => setManualForm({ ...manualForm, glucose: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => setShowManualModal(false)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
                padding: '10px 20px',
                borderRadius: '30px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={manualSaving}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '10px 24px',
                borderRadius: '30px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>💾</span>
              <span>{manualSaving ? 'Salvando...' : 'Salvar Aferição'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!embeddedMode && typeof document !== 'undefined') {
    return (
      <>
        {createPortal(modalContent, document.body)}
        {showManualModal && createPortal(manualModalJSX, document.body)}
      </>
    );
  }

  return (
    <>
      {modalContent}
      {manualModalJSX}
    </>
  );
}
