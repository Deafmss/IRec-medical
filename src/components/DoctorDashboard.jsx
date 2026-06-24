import React, { useState, useEffect, useRef } from 'react';
import { 
  getAllPatients, 
  getAssignedPatients, 
  followPatient, 
  unfollowPatient, 
  getWoundEntries, 
  addDoctorNote,
  issueDocument,
  getPatientDocuments,
  updateClinicalProfile
} from '../services/supabaseService';
import { chatWithDoctorCopilot } from '../services/geminiService';

const ALL_SPECIALTIES = [
  'Acupuntura',
  'Alergia e Imunologia',
  'Anestesiologia',
  'Angiologia',
  'Cardiologia',
  'Cirurgia Cardiovascular',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Geral',
  'Cirurgia Oncológica',
  'Cirurgia Pediátrica',
  'Cirurgia Plástica',
  'Cirurgia Torácica',
  'Cirurgia Vascular',
  'Clínico Geral',
  'Coloproctologia',
  'Dermatologia',
  'Endocrinologia e Metabologia',
  'Endoscopia',
  'Gastroenterologia',
  'Genética Médica',
  'Geriatria',
  'Ginecologia e Obstetrícia',
  'Hematologia e Hemoterapia',
  'Homeopatia',
  'Infectologia',
  'Mastologia',
  'Medicina de Emergência',
  'Medicina de Família e Comunidade',
  'Medicina do Trabalho',
  'Medicina de Tráfego',
  'Medicina Esportiva',
  'Medicina Física e Reabilitação',
  'Medicina Intensiva',
  'Medicina Legal e Perícia Médica',
  'Medicina Nuclear',
  'Medicina Preventiva e Social',
  'Nefrologia',
  'Neurocirurgia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Oncologia Clínica',
  'Ortopedia e Traumatologia',
  'Otorrinolaringologia',
  'Patologia',
  'Patologia Clínica/Medicina Laboratorial',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Radiologia e Diagnóstico por Imagem',
  'Radioterapia',
  'Reumatologia',
  'Urologia',
  'Estomaterapia',
  'Enfermagem Geral',
  'Enfermagem em Dermatologia',
  'Enfermagem em Terapia Intensiva',
  'Enfermagem em Saúde da Família',
  'Enfermagem Obstétrica',
  'Enfermagem Pediátrica',
  'Enfermagem Oncológica',
  'Enfermagem de Urgência e Emergência',
  'Enfermagem do Trabalho',
  'Enfermagem em Centro Cirúrgico',
  'Enfermagem Nefrológica',
  'Enfermagem em Saúde Mental e Psiquiatria',
  'Enfermagem Geronto-Geriátrica',
  'Enfermagem em Infectologia'
];

export default function DoctorDashboard({ doctorProfile, setActiveTab: setAppActiveTab, onProfileUpdate, onEditProfile, onOpenChat }) {
  const [activeTab, setActiveTab] = useState('my-patients'); // 'my-patients' or 'all-patients'
  const [patients, setPatients] = useState([]);
  const [myPatients, setMyPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPatientEntries, setSelectedPatientEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlert, setFilterAlert] = useState('all'); // 'all', 'diabetes', 'hypertension', 'infection'

  // Notes & Chat
  const [doctorNote, setDoctorNote] = useState('');
  const [prescribedDressing, setPrescribedDressing] = useState('');
  const [prescribedFrequency, setPrescribedFrequency] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Medical documents and clinical tabs
  const [patientDocuments, setPatientDocuments] = useState([]);
  const [selectedSubTab, setSelectedSubTab] = useState('wounds'); // 'wounds' or 'documents'
  const [selectedDocTab, setSelectedDocTab] = useState('receita'); // 'receita' or 'atestado'
  const [prescriptionItems, setPrescriptionItems] = useState([{ name: '', dosage: '', route: 'Via Oral', instructions: '' }]);
  const [atestadoDays, setAtestadoDays] = useState('3');
  const [atestadoReason, setAtestadoReason] = useState('necessita de afastamento das atividades laborais por motivos de tratamento de lesão de pele');
  const [atestadoCid, setAtestadoCid] = useState('');
  const [atestadoType, setAtestadoType] = useState('Afastamento');
  const [activePrintDoc, setActivePrintDoc] = useState(null);
  const [savingDoc, setSavingDoc] = useState(false);

  const chatEndRef = useRef(null);

  // STT Dictation, AI Note Suggestion, and Gallery Compare
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [generatingAISummary, setGeneratingAISummary] = useState(false);
  const [compareEntries, setCompareEntries] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const recognitionRef = useRef(null);


  // Load lists
  const loadLists = async () => {
    setLoading(true);
    try {
      const all = await getAllPatients();
      setPatients(all);
      const mine = await getAssignedPatients(doctorProfile.id);
      setMyPatients(mine);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  // Reload patient entries when a patient is selected
  useEffect(() => {
    if (selectedPatient) {
      const fetchEntries = async () => {
        const history = await getWoundEntries(selectedPatient.id);
        setSelectedPatientEntries(history);
        
        // Fetch patient documents
        const docs = await getPatientDocuments(selectedPatient.id);
        setPatientDocuments(docs);
        setSelectedSubTab('wounds');
        
        if (history.length > 0) {
          const latest = history[history.length - 1];
          // Select the latest entry by default
          setSelectedEntry(latest);
          setDoctorNote(latest.doctorNotes || '');
          setPrescribedDressing(latest.appliedDressing || '');
          setPrescribedFrequency(latest.dressingFrequency || '');
        } else {
          setSelectedEntry(null);
          setDoctorNote('');
          setPrescribedDressing('');
          setPrescribedFrequency('');
        }
      };
      fetchEntries();
      // Reset AI chat history for this patient
      setChatHistory([
        { 
          sender: 'ai', 
          text: `Olá, Dr(a). ${doctorProfile.name.split(' ')[0]}! Estou carregado com os dados clínicos e histórico do(a) paciente **${selectedPatient.name}**. \n\nComo posso auxiliá-lo na conduta de cuidados e escolha de coberturas hoje?` 
        }
      ]);
    }
  }, [selectedPatient]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const isFollowing = (patientId) => {
    return myPatients.some(p => p.id === patientId);
  };

  const handleToggleFollow = async (e, patient) => {
    e.stopPropagation();
    if (isFollowing(patient.id)) {
      await unfollowPatient(doctorProfile.id, patient.id);
    } else {
      await followPatient(doctorProfile.id, patient.id);
    }
    loadLists();
  };

  const handleSaveNote = async () => {
    if (!selectedEntry) return;
    setSavingNote(true);
    try {
      await addDoctorNote(selectedEntry.id, doctorNote, prescribedDressing, prescribedFrequency);
      alert('Evolução médica e prescrição salvas com sucesso!');
      // Update local state
      setSelectedPatientEntries(prev => prev.map(e => e.id === selectedEntry.id ? { 
        ...e, 
        doctorNotes: doctorNote,
        appliedDressing: prescribedDressing,
        dressingFrequency: prescribedFrequency
      } : e));
      setSelectedEntry(prev => ({
        ...prev,
        doctorNotes: doctorNote,
        appliedDressing: prescribedDressing,
        dressingFrequency: prescribedFrequency
      }));
    } catch (e) {
      alert('Falha ao salvar a evolução e prescrição.');
    } finally {
      setSavingNote(false);
    }
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("A API de Reconhecimento de Fala não é suportada neste navegador. Por favor, use o Chrome ou Edge.");
      return;
    }

    if (isRecordingNote) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecordingNote(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecordingNote(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setDoctorNote(prev => prev ? `${prev} ${transcript}` : transcript);
      };

      recognition.onerror = (err) => {
        console.error("Erro no reconhecimento de voz:", err);
        setIsRecordingNote(false);
      };

      recognition.onend = () => {
        setIsRecordingNote(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleSuggestAISummary = async () => {
    if (!selectedPatient || !selectedEntry) return;
    setGeneratingAISummary(true);
    try {
      const systemMessage = "Gere apenas um parágrafo curto, profissional e formal, em português (PT-BR), contendo o parecer de evolução clínica da ferida selecionada para ser gravado no prontuário oficial. Baseie-se nas comorbidades do paciente e no histórico das triagens. O texto deve ser direto, sem cumprimentos, cabeçalhos, títulos ou explicações extras.";
      const response = await chatWithDoctorCopilot(systemMessage, [], selectedPatient, selectedPatientEntries, doctorProfile);
      if (response && response.reply) {
        const cleanReply = response.reply.replace(/[\n#*]/g, ' ').trim();
        setDoctorNote(prev => prev ? `${prev}\n\n${cleanReply}` : cleanReply);
      } else {
        alert("Não foi possível gerar a sugestão no momento. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao sugerir evolução com IA:", err);
      alert("Erro de comunicação com o Copiloto de IA.");
    } finally {
      setGeneratingAISummary(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);


  const handleIssueDocument = async (type) => {
    if (!selectedPatient) return;
    setSavingDoc(true);
    try {
      let content = {};
      if (type === 'receita') {
        const filledItems = prescriptionItems.filter(item => item.name.trim() !== '');
        if (filledItems.length === 0) {
          alert('Por favor, adicione pelo menos um medicamento com nome.');
          setSavingDoc(false);
          return;
        }
        content = {
          items: filledItems,
          doctorName: doctorProfile.name,
          doctorCrm: doctorProfile.crm,
          doctorSpecialty: doctorProfile.specialty,
          doctorRqe: doctorProfile.rqe || ''
        };
      } else if (type === 'atestado') {
        if (!atestadoDays || isNaN(Number(atestadoDays))) {
          alert('Por favor, informe um número de dias válido.');
          setSavingDoc(false);
          return;
        }
        content = {
          days: atestadoDays,
          reason: atestadoReason,
          cid: atestadoCid,
          atestadoType,
          doctorName: doctorProfile.name,
          doctorCrm: doctorProfile.crm,
          doctorSpecialty: doctorProfile.specialty,
          doctorRqe: doctorProfile.rqe || ''
        };
      }

      const doc = await issueDocument(selectedPatient.id, doctorProfile.id, type, content);
      if (doc) {
        alert(`${type === 'receita' ? 'Receita' : 'Atestado'} emitido com sucesso!`);
        // Refresh local documents list
        const updatedDocs = await getPatientDocuments(selectedPatient.id);
        setPatientDocuments(updatedDocs);
        
        // Reset inputs
        if (type === 'receita') {
          setPrescriptionItems([{ name: '', dosage: '', route: 'Via Oral', instructions: '' }]);
        } else {
          setAtestadoDays('3');
          setAtestadoCid('');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Falha ao emitir documento.');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleAddPrescriptionItem = () => {
    setPrescriptionItems(prev => [...prev, { name: '', dosage: '', route: 'Via Oral', instructions: '' }]);
  };

  const handleRemovePrescriptionItem = (index) => {
    if (prescriptionItems.length === 1) return;
    setPrescriptionItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdatePrescriptionItem = (index, field, value) => {
    setPrescriptionItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  const handlePrintDocument = (doc) => {
    setActivePrintDoc(doc);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleApplyAISuggestion = (type, dataOrText) => {
    setSelectedSubTab('documents');
    setSelectedDocTab(type);
    
    if (dataOrText && typeof dataOrText === 'object') {
      // Structured suggestion from the new Doctor Copilot
      if (type === 'receita') {
        if (dataOrText.items && dataOrText.items.length > 0) {
          setPrescriptionItems(dataOrText.items);
        }
      } else if (type === 'atestado') {
        if (dataOrText.days) setAtestadoDays(dataOrText.days);
        if (dataOrText.cid) setAtestadoCid(dataOrText.cid);
        if (dataOrText.reason) setAtestadoReason(dataOrText.reason);
        if (dataOrText.atestadoType) setAtestadoType(dataOrText.atestadoType);
      }
      alert(`Formulário de ${type === 'receita' ? 'receita' : 'atestado'} preenchido com a conduta clínica gerada pela IA!`);
      return;
    }

    const text = dataOrText || '';
    if (type === 'receita') {
      const items = [];
      const lines = text.split('\n');
      lines.forEach(line => {
        const cleaned = line.replace(/^[\d.-]\s*/, '').trim();
        const lower = cleaned.toLowerCase();
        if (
          lower.includes('alginato') || 
          lower.includes('carvão') || 
          lower.includes('hidrogel') || 
          lower.includes('colágeno') || 
          lower.includes('rayon') || 
          lower.includes('sulfadiazina') || 
          lower.includes('espuma') || 
          lower.includes('hidrocol') ||
          lower.includes('sf') ||
          lower.includes('soro') ||
          lower.includes('mg') ||
          lower.includes('comprimido')
        ) {
          const parts = cleaned.split(/[-–,;]/);
          const name = parts[0]?.trim() || cleaned;
          const dosage = parts[1]?.trim() || '1 unidade';
          const instructions = parts[2]?.trim() || 'Uso conforme indicação.';
          items.push({
            name: name.substring(0, 50),
            dosage: dosage.substring(0, 30),
            route: lower.includes('oral') || lower.includes('comprimido') ? 'Via Oral' : 'Via Tópica',
            instructions: instructions.substring(0, 100)
          });
        }
      });
      
      if (items.length > 0) {
        setPrescriptionItems(items);
      } else {
        setPrescriptionItems([{
          name: selectedEntry?.type?.toLowerCase().includes('diab') ? 'Carvão Ativado com Prata' : 'Alginato de Cálcio',
          dosage: '1 cobertura',
          route: 'Via Tópica',
          instructions: 'Aplicar no leito da lesão após higienização.'
        }]);
      }
      alert('Formulário de receita preenchido com as sugestões da IA!');
    } else if (type === 'atestado') {
      const dayMatch = text.match(/(\d+)\s*dias/i);
      const days = dayMatch ? dayMatch[1] : '3';
      const cidMatch = text.match(/CID\s*[-:]?\s*([A-Z]\d{2}(?:\.\d)?)/i);
      const cid = cidMatch ? cidMatch[1] : 'L98.4';
      
      setAtestadoDays(days);
      setAtestadoCid(cid);
      setAtestadoReason('necessita de afastamento das atividades laborais devido a cuidados intensivos e cicatrização de lesão de pele');
      alert('Formulário de atestado preenchido com as sugestões da IA!');
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading || !selectedPatient) return;

    const userText = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setChatLoading(true);

    try {
      const response = await chatWithDoctorCopilot(userText, chatHistory, selectedPatient, selectedPatientEntries, doctorProfile);
      if (response && response.reply) {
        setChatHistory(prev => [...prev, { 
          sender: 'ai', 
          text: response.reply,
          suggestedDocument: response.suggestedDocument
        }]);
      } else {
        // Fallback simulated reply
        setChatHistory(prev => [...prev, { 
          sender: 'ai', 
          text: `Desculpe, doutor. Não consegui contactar o copiloto de IA. Mas analisando o histórico desse paciente, notei que ele possui ${selectedPatient.hasDiabetes ? 'Diabetes' : 'nenhuma comorbidade declarada'} e a lesão atual é do tipo ${selectedEntry?.type || 'não especificada'}. Recomenda-se manter o desbridamento e acompanhamento regular.` 
        }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'Houve um erro ao processar a resposta do copiloto médico.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return 'Idade não informada';
    try {
      const birth = new Date(birthDateString);
      const diff = Date.now() - birth.getTime();
      const ageDate = new Date(diff);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return `${age} anos`;
    } catch (e) {
      return 'Idade inválida';
    }
  };

  // Filter logic
  const listToRender = activeTab === 'my-patients' ? myPatients : patients;
  const filteredPatients = listToRender.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterAlert === 'all') return matchesSearch;
    if (filterAlert === 'diabetes') return matchesSearch && p.hasDiabetes;
    if (filterAlert === 'hypertension') return matchesSearch && p.hasHypertension;
    if (filterAlert === 'infection') {
      return matchesSearch && p.triageAlerts && p.triageAlerts.some(alert => alert.includes('Infecção') || alert.includes('Crítica'));
    }
    return matchesSearch;
  });

  return (
    <div className="doctor-dashboard-wrapper">
      <style>{`
        .doctor-dashboard-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: fadeIn 0.4s ease forwards;
        }

        .clinician-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 14px;
        }

        .clinician-welcome h2 {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .clinician-welcome p {
          font-size: 13.5px;
          color: var(--text-muted);
        }

        .doctor-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 50px;
          background-color: var(--primary-glow);
          color: var(--primary);
          font-size: 12.5px;
          font-weight: 700;
          gap: 6px;
        }

        .stats-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .stat-box {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: var(--transition-smooth);
        }

        .stat-box.interactive {
          cursor: pointer;
        }

        .stat-box.interactive:hover {
          transform: translateY(-2px);
          border-color: var(--primary-light);
          box-shadow: var(--shadow-md), var(--shadow-glow);
        }

        .stat-box.interactive.active {
          border-color: var(--primary);
          background-color: var(--primary-glow);
        }

        .stat-box .label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .stat-box .value {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
        }

        /* Tabs styling */
        .login-tabs {
          display: flex;
          background-color: var(--bg-primary);
          padding: 4px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          width: fit-content;
          gap: 4px;
        }

        .login-tab-btn {
          padding: 10px 20px;
          border: none;
          background: none;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 10px;
          transition: var(--transition-fast);
        }

        .login-tab-btn:hover {
          color: var(--primary);
          background-color: var(--primary-glow);
        }

        .login-tab-btn.active {
          background-color: var(--bg-secondary);
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .filter-search-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 8px;
        }

        .search-input-wrapper {
          flex: 1;
          min-width: 250px;
          position: relative;
        }

        .search-input-wrapper input {
          width: 100%;
          padding: 11px 16px 11px 38px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          font-size: 13.5px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: var(--text-muted);
        }

        .filter-select {
          padding: 11px 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: 13.5px;
          cursor: pointer;
        }

        .patients-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .patient-card {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 22px;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: var(--shadow-sm);
        }

        .patient-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg), var(--shadow-glow);
          border-color: var(--primary-light);
        }

        .patient-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .patient-avatar-name {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .patient-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background-color: var(--primary);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 15px;
        }

        .patient-name {
          font-size: 15.5px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .patient-meta-text {
          font-size: 12px;
          color: var(--text-muted);
        }

        .follow-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          transition: var(--transition-fast);
          padding: 4px;
          border-radius: 50%;
        }

        .follow-icon-btn:hover {
          color: var(--primary);
          background-color: var(--primary-glow);
        }

        .follow-icon-btn.following {
          color: var(--primary);
        }

        .follow-icon-btn svg {
          width: 20px;
          height: 20px;
        }

        .clinical-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .clinical-badge {
          font-size: 10.5px;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .badge-diabetes {
          background-color: hsla(28, 92%, 50%, 0.1);
          color: hsl(28, 92%, 50%);
        }

        .badge-hypertension {
          background-color: hsla(210, 100%, 40%, 0.1);
          color: var(--primary);
        }

        .badge-alert {
          background-color: var(--danger-glow);
          color: var(--danger);
        }

        .patient-card-footer {
          border-top: 1px solid var(--border-color);
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .detail-view-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          animation: loginFadeIn 0.4s ease forwards;
        }

        @media (min-width: 1100px) {
          .detail-view-container {
            grid-template-columns: 1.8fr 1fr;
          }
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--primary);
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          margin-bottom: 8px;
          width: fit-content;
        }

        .back-btn svg {
          width: 18px;
          height: 18px;
          stroke-width: 2.5;
        }

        .patient-detail-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .detail-header-strip {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 18px;
        }

        .detail-avatar-name {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .detail-info-block {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 18px;
        }

        .info-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-cell label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .info-cell p {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .wound-selector-strip {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
        }

        .wound-tab {
          padding: 8px 14px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: var(--transition-fast);
        }

        .wound-tab.active {
          background-color: var(--primary-glow);
          border-color: var(--primary);
          color: var(--primary);
        }

        .evolution-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        @media (min-width: 768px) {
          .evolution-grid {
            grid-template-columns: 1fr 1.2fr;
          }
        }

        .wound-photo-frame {
          width: 100%;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid var(--border-color);
          aspect-ratio: 4/3;
          background-color: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .wound-photo-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .tissue-chart-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }

        .tissue-bar-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .tissue-label-percent {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 700;
        }

        .tissue-track {
          height: 8px;
          background-color: var(--bg-primary);
          border-radius: 4px;
          overflow: hidden;
        }

        .tissue-fill {
          height: 100%;
          border-radius: 4px;
        }

        .notes-compose-box {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background-color: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: 18px;
          border: 1px solid var(--border-color);
        }

        .notes-textarea {
          width: 100%;
          min-height: 100px;
          padding: 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 13px;
          line-height: 1.5;
          resize: vertical;
        }

        .clinical-chat-panel {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          height: 600px;
          overflow: hidden;
        }

        .chat-panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--primary-glow);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .chat-panel-header svg {
          width: 20px;
          height: 20px;
          color: var(--primary);
        }

        .chat-body-doctor {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .chat-message-bubble {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          line-height: 1.5;
        }

        .chat-message-bubble.ai {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border-color);
        }

        .chat-message-bubble.user {
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          color: #ffffff;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }

        .chat-input-form-doctor {
          display: flex;
          padding: 14px;
          border-top: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          gap: 10px;
        }

        .chat-input-form-doctor input {
          flex: 1;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 13px;
        }

        .chat-input-form-doctor button {
          padding: 10px 18px;
          border-radius: var(--radius-md);
          background-color: var(--primary);
          color: #ffffff;
          border: none;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .chat-input-form-doctor button:hover {
          background-color: var(--primary-light);
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-document-layout, .print-document-layout * {
            visibility: visible !important;
          }
          .print-document-layout {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 99999 !important;
            background-color: #ffffff !important;
          }
          .print-document-layout > div {
            page-break-inside: avoid;
          }
        }

        @keyframes pulse-record {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      {/* Header */}
      <div className="clinician-header no-print">
        <div className="clinician-welcome">
          <h2>Painel Clínico iRec</h2>
          <p>
            Profissional logado: Dr(a). {doctorProfile.name} • {doctorProfile.specialty}
            {doctorProfile.rqe ? ` • RQE: ${doctorProfile.rqe}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onEditProfile}
            style={{ padding: '6px 12px', fontSize: '12.5px', height: 'auto', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ⚙️ Editar Perfil
          </button>
          <div className="doctor-badge">
            <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375M9 18h3.375m1.875-12h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 0a9.06 9.06 0 0 1-1.5-.124M12 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            </svg>
            CRM/Registro: {doctorProfile.crm || 'N/A'}
          </div>
        </div>
      </div>

      {!selectedPatient ? (
        <>
          {/* Summary KPIs */}
          <div className="stats-strip no-print">
            <div 
              className={`stat-box interactive ${activeTab === 'all-patients' && filterAlert !== 'infection' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('all-patients');
                setFilterAlert('all');
                setSearchQuery('');
              }}
              title="Filtrar por todos os pacientes cadastrados"
            >
              <span className="label">Total de Pacientes</span>
              <span className="value">{patients.length}</span>
            </div>
            <div 
              className={`stat-box interactive ${activeTab === 'my-patients' && filterAlert !== 'infection' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('my-patients');
                setFilterAlert('all');
                setSearchQuery('');
              }}
              title="Filtrar por pacientes vinculados ao meu acompanhamento"
            >
              <span className="label">Acompanhados por Mim</span>
              <span className="value">{myPatients.length}</span>
            </div>
            <div 
              className={`stat-box interactive ${filterAlert === 'infection' ? 'active' : ''}`}
              onClick={() => {
                setFilterAlert('infection');
              }}
              title="Filtrar apenas por casos críticos ou com sinais de infecção"
            >
              <span className="label">Casos com Alerta de Risco</span>
              <span className="value">
                {patients.filter(p => p.triageAlerts && p.triageAlerts.length > 0).length}
              </span>
            </div>
          </div>

          {/* Tab Selector & Filters */}
          <div className="filter-search-bar no-print">
            <div className="login-tabs" style={{ margin: 0 }}>
              <button 
                type="button" 
                className={`login-tab-btn ${activeTab === 'my-patients' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-patients')}
                style={{ minWidth: '150px' }}
              >
                Meus Pacientes ({myPatients.length})
              </button>
              <button 
                type="button" 
                className={`login-tab-btn ${activeTab === 'all-patients' ? 'active' : ''}`}
                onClick={() => setActiveTab('all-patients')}
                style={{ minWidth: '150px' }}
              >
                Todos os Pacientes ({patients.length})
              </button>
            </div>

            <div className="search-input-wrapper">
              <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
              </svg>
              <input 
                type="text" 
                placeholder="Buscar paciente por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select 
              className="filter-select"
              value={filterAlert}
              onChange={(e) => setFilterAlert(e.target.value)}
            >
              <option value="all">Todas as Condições</option>
              <option value="diabetes">Apenas Diabéticos</option>
              <option value="hypertension">Apenas Hipertensos</option>
              <option value="infection">Apenas com Alertas de Infecção</option>
            </select>
          </div>

          {/* Patients Cards List */}
          {loading ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>Carregando dados dos prontuários...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum paciente encontrado com os filtros aplicados.
            </div>
          ) : (
            <div className="patients-grid">
              {filteredPatients.map(patient => (
                <div 
                  key={patient.id} 
                  className="patient-card"
                  onClick={() => setSelectedPatient(patient)}
                >
                  <div className="patient-card-header">
                    <div className="patient-avatar-name">
                      <div className="patient-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {patient.avatarUrl ? (
                          <img src={patient.avatarUrl} alt={patient.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          patient.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="patient-name">{patient.name}</h3>
                        <span className="patient-meta-text">{calculateAge(patient.birthDate)} • {patient.gender}</span>
                      </div>
                    </div>

                    <button 
                      className={`follow-icon-btn ${isFollowing(patient.id) ? 'following' : ''}`}
                      onClick={(e) => handleToggleFollow(e, patient)}
                      title={isFollowing(patient.id) ? "Deixar de acompanhar" : "Acompanhar este paciente"}
                    >
                      {isFollowing(patient.id) ? (
                        <svg fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c.15-.357.502-.6.886-.6s.737.243.886.6l2.133 5.127 5.467.44c.4.03.738.297.874.673.136.376.015.8-.311 1.09l-4.185 3.585 1.278 5.334c.094.392-.047.8-.368 1.045-.32.246-.757.262-1.096.04L12.5 18.243l-4.908 3.01c-.34.221-.775.206-1.096-.04a1.002 1.002 0 0 1-.368-1.045l1.278-5.334L3.223 11.23a1.002 1.002 0 0 1-.31-1.09c.136-.376.475-.643.874-.672l5.467-.44 2.133-5.127Z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="clinical-badges">
                    {patient.hasDiabetes && <span className="clinical-badge badge-diabetes">Diabetes</span>}
                    {patient.hasHypertension && <span className="clinical-badge badge-hypertension">Hipertensão</span>}
                    {patient.triageAlerts && patient.triageAlerts.length > 0 && (
                      <span className="clinical-badge badge-alert">⚠️ Alerta Clinico</span>
                    )}
                  </div>

                  <div className="patient-card-footer">
                    <span>Alergias: {patient.allergies || 'Nenhuma declarada'}</span>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Ver Prontuário →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Patient Detail View */
        <div className="detail-view-container">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button className="back-btn no-print" onClick={() => setSelectedPatient(null)}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12l7.5-7.5M21 12H3" />
              </svg>
              Voltar para a Lista de Pacientes
            </button>

            <div className="patient-detail-card">
              {/* Detail Header */}
              <div className="detail-header-strip">
                <div className="detail-avatar-name">
                  <div className="patient-avatar" style={{ width: '56px', height: '56px', fontSize: '20px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedPatient.avatarUrl ? (
                      <img src={selectedPatient.avatarUrl} alt={selectedPatient.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      selectedPatient.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '800' }}>{selectedPatient.name}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      E-mail: {selectedPatient.email} • {calculateAge(selectedPatient.birthDate)} ({selectedPatient.birthDate})
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }} className="no-print">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => onOpenChat && onOpenChat(selectedPatient.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    💬 Chat / Telemedicina
                  </button>
                  <button 
                    className={`btn ${isFollowing(selectedPatient.id) ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={(e) => handleToggleFollow(e, selectedPatient)}
                  >
                    {isFollowing(selectedPatient.id) ? 'Deixar de Acompanhar' : 'Acompanhar este Paciente'}
                  </button>
                </div>
              </div>

              {/* Clinical Profiling */}
              <div className="detail-info-block" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div className="info-cell">
                  <label>Gênero</label>
                  <p>{selectedPatient.gender || 'Não informado'}</p>
                </div>
                <div className="info-cell">
                  <label>CPF</label>
                  <p>{selectedPatient.cpf || 'Não cadastrado'}</p>
                </div>
                <div className="info-cell">
                  <label>RG</label>
                  <p>{selectedPatient.rg || 'Não cadastrado'}</p>
                </div>
                <div className="info-cell">
                  <label>Cartão SUS (CNS)</label>
                  <p>{selectedPatient.cns || 'Não cadastrado'}</p>
                </div>
                <div className="info-cell">
                  <label>Telefone / WhatsApp</label>
                  <p>{selectedPatient.phone || 'Não informado'}</p>
                </div>
                <div className="info-cell">
                  <label>Contato de Emergência</label>
                  <p style={{ fontSize: '13px' }}>
                    {selectedPatient.emergencyContactName ? (
                      <>
                        <strong>{selectedPatient.emergencyContactName}</strong>
                        {selectedPatient.emergencyContactPhone && <><br />{selectedPatient.emergencyContactPhone}</>}
                      </>
                    ) : 'Não informado'}
                  </p>
                </div>
              </div>

              <div className="detail-info-block" style={{ gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                <div className="info-cell">
                  <label>Endereço Cadastrado</label>
                  <p style={{ fontSize: '13px' }}>
                    {selectedPatient.cep ? (
                      <>
                        {selectedPatient.street}, {selectedPatient.number} {selectedPatient.complement && `(${selectedPatient.complement})`}
                        <br />
                        {selectedPatient.neighborhood} • {selectedPatient.city}/{selectedPatient.state}
                        <br />
                        CEP: {selectedPatient.cep}
                      </>
                    ) : 'Nenhum endereço cadastrado'}
                  </p>
                </div>
                <div className="info-cell">
                  <label>Unidade de Referência</label>
                  <p>{selectedPatient.healthUnit || 'Não cadastrada'}</p>
                </div>
              </div>

              {/* Wound Care Metrics & Comorbidities */}
              <div className="detail-info-block" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div className="info-cell">
                  <label>Peso / Altura / IMC</label>
                  {selectedPatient.weight && selectedPatient.height ? (
                    (() => {
                      const wVal = parseFloat(selectedPatient.weight);
                      const hVal = parseFloat(selectedPatient.height);
                      const bmiVal = wVal / (hVal * hVal);
                      let color = 'var(--success-light)';
                      if (bmiVal < 18.5 || bmiVal >= 30) color = 'var(--danger)';
                      else if (bmiVal >= 25) color = 'var(--warning)';
                      return (
                        <p style={{ fontSize: '13px' }}>
                          {wVal} kg • {hVal} m
                          <br />
                          <strong>IMC: {bmiVal.toFixed(1)}</strong> <span style={{ color, fontSize: '11px', fontWeight: 'bold' }}>
                            ({bmiVal < 18.5 ? 'Desnutrição' : bmiVal < 25 ? 'Saudável' : bmiVal < 30 ? 'Sobrepeso' : 'Obesidade'})
                          </span>
                        </p>
                      );
                    })()
                  ) : (
                    <p>Não informado</p>
                  )}
                </div>
                <div className="info-cell">
                  <label>Tipo Sanguíneo</label>
                  <p><strong>{selectedPatient.bloodType || 'Não informado'}</strong></p>
                </div>
                <div className="info-cell">
                  <label>Nível de Mobilidade</label>
                  <p>{selectedPatient.mobility || 'Não informado'}</p>
                </div>
                <div className="info-cell">
                  <label>Status Nutricional</label>
                  <p>{selectedPatient.nutritionalStatus || 'Não informado'}</p>
                </div>
                <div className="info-cell">
                  <label>Etilismo (Álcool)</label>
                  <p>{selectedPatient.alcoholism ? '⚠️ Sim (Frequente)' : 'Não / Social'}</p>
                </div>
                <div className="info-cell">
                  <label>Cuidador Principal</label>
                  <p style={{ fontSize: '13px' }}>
                    {selectedPatient.hasCaregiver ? (
                      <>
                        ⚠️ Sim
                        {selectedPatient.caregiverName && <><br /><strong>{selectedPatient.caregiverName}</strong></>}
                      </>
                    ) : 'Autocuidado (Não possui)'}
                  </p>
                </div>
              </div>

              <div className="detail-info-block" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="info-cell">
                  <label>Alergias</label>
                  <p style={{ color: selectedPatient.allergies ? 'var(--danger)' : 'var(--text-primary)', fontWeight: selectedPatient.allergies ? 'bold' : 'normal' }}>
                    {selectedPatient.allergies || 'Nenhuma declarada'}
                  </p>
                </div>
                <div className="info-cell">
                  <label>Medicamentos de Uso Contínuo</label>
                  <p>{selectedPatient.medications || 'Nenhum'}</p>
                </div>
              </div>

              <div className="detail-info-block">
                <div className="info-cell">
                  <label>Doenças Crônicas</label>
                  <div className="clinical-badges" style={{ marginTop: '4px' }}>
                    {selectedPatient.hasDiabetes && <span className="clinical-badge badge-diabetes">Diabetes</span>}
                    {selectedPatient.hasHypertension && <span className="clinical-badge badge-hypertension">Hipertensão</span>}
                    {selectedPatient.hasVenousInsufficiency && <span className="clinical-badge badge-hypertension" style={{ backgroundColor: 'hsla(185, 75%, 45%, 0.1)', color: 'var(--accent)' }}>Insuficiência Venosa</span>}
                    {selectedPatient.hasPeripheralArterialDisease && <span className="clinical-badge badge-alert">Doença Arterial Periférica</span>}
                    {selectedPatient.isSmoker && <span className="clinical-badge badge-alert">Tabagista</span>}
                    {selectedPatient.isObese && <span className="clinical-badge badge-alert">Obeso</span>}
                    {selectedPatient.hasAmputationHistory && <span className="clinical-badge badge-alert">Histórico de Amputação</span>}
                    {!selectedPatient.hasDiabetes && !selectedPatient.hasHypertension && !selectedPatient.hasVenousInsufficiency && !selectedPatient.hasPeripheralArterialDisease && !selectedPatient.isSmoker && !selectedPatient.isObese && !selectedPatient.hasAmputationHistory && (
                      <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>Nenhuma declarada</span>
                    )}
                  </div>
                </div>
                <div className="info-cell">
                  <label>Alertas Clínicos Ativos</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {selectedPatient.triageAlerts && selectedPatient.triageAlerts.length > 0 ? (
                      selectedPatient.triageAlerts.map((alert, idx) => (
                        <span key={idx} style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600' }}>{alert}</span>
                      ))
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--success-light)', fontWeight: '600' }}>Nenhum alerta de gravidade</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Exames Anexados ao Prontuário */}
              <div className="detail-info-block" style={{ gridTemplateColumns: '1fr', gap: '16px', marginTop: '16px' }}>
                <div className="info-cell">
                  <label>Exames Anexados ao Prontuário</label>
                  {selectedPatient.attachedExams && selectedPatient.attachedExams.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {selectedPatient.attachedExams.map((exam, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '8px 14px', 
                          backgroundColor: 'var(--bg-primary)', 
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          gap: '16px'
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            📄 {exam.name}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {exam.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                      Nenhum exame clínico anexado ao prontuário deste paciente.
                    </p>
                  )}
                </div>
              </div>

              {/* Patient Dossier Tabs */}
              <div className="login-tabs no-print" style={{ margin: '10px 0 20px 0', width: 'fit-content' }}>
                <button 
                  type="button" 
                  className={`login-tab-btn ${selectedSubTab === 'wounds' ? 'active' : ''}`}
                  onClick={() => setSelectedSubTab('wounds')}
                  style={{ minWidth: '150px' }}
                >
                  Lesões & Evoluções
                </button>
                <button 
                  type="button" 
                  className={`login-tab-btn ${selectedSubTab === 'gallery' ? 'active' : ''}`}
                  onClick={() => setSelectedSubTab('gallery')}
                  style={{ minWidth: '150px' }}
                >
                  Galeria Evolutiva
                </button>
                <button 
                  type="button" 
                  className={`login-tab-btn ${selectedSubTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setSelectedSubTab('documents')}
                  style={{ minWidth: '150px' }}
                >
                  Documentos Clínicos ({patientDocuments.length})
                </button>
              </div>


              {/* Wound History Log */}
              {selectedSubTab === 'wounds' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>Histórico de Lesões do Paciente</h3>
                {selectedPatientEntries.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '24px', margin: 0, color: 'var(--text-muted)' }}>
                    O paciente ainda não efetuou nenhuma triagem de ferida por imagem.
                  </div>
                ) : (
                  <>
                    <div className="wound-selector-strip">
                      {selectedPatientEntries.map((entry, idx) => (
                        <button 
                          key={entry.id}
                          className={`wound-tab ${selectedEntry?.id === entry.id ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedEntry(entry);
                            setDoctorNote(entry.doctorNotes || '');
                            setPrescribedDressing(entry.appliedDressing || '');
                            setPrescribedFrequency(entry.dressingFrequency || '');
                          }}
                        >
                          {entry.date} - {entry.type}
                        </button>
                      ))}
                    </div>

                    {selectedEntry && (
                      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="evolution-grid">
                          <div>
                            <div className="wound-photo-frame">
                              {selectedEntry.photo ? (
                                <img src={selectedEntry.photo} alt="Foto da Lesão" />
                              ) : (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sem foto anexada</div>
                              )}
                            </div>

                            {/* Tissue Breakdown */}
                            {selectedEntry.aiTissueAnalysis && Object.keys(selectedEntry.aiTissueAnalysis).length > 0 && (
                              <div className="tissue-chart-box">
                                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Composição Tecidual (IA)</h4>
                                <div className="tissue-bar-row">
                                  <div className="tissue-label-percent">
                                    <span>Granulação (Vermelho)</span>
                                    <span>{selectedEntry.aiTissueAnalysis.granulacao || 0}%</span>
                                  </div>
                                  <div className="tissue-track">
                                    <div className="tissue-fill" style={{ width: `${selectedEntry.aiTissueAnalysis.granulacao || 0}%`, backgroundColor: 'var(--danger)' }}></div>
                                  </div>
                                </div>
                                <div className="tissue-bar-row">
                                  <div className="tissue-label-percent">
                                    <span>Fibrina / Esfacelo (Amarelo)</span>
                                    <span>{selectedEntry.aiTissueAnalysis.fibrina || 0}%</span>
                                  </div>
                                  <div className="tissue-track">
                                    <div className="tissue-fill" style={{ width: `${selectedEntry.aiTissueAnalysis.fibrina || 0}%`, backgroundColor: 'gold' }}></div>
                                  </div>
                                </div>
                                <div className="tissue-bar-row">
                                  <div className="tissue-label-percent">
                                    <span>Necrose (Preto)</span>
                                    <span>{selectedEntry.aiTissueAnalysis.necrose || 0}%</span>
                                  </div>
                                  <div className="tissue-track">
                                    <div className="tissue-fill" style={{ width: `${selectedEntry.aiTissueAnalysis.necrose || 0}%`, backgroundColor: '#111' }}></div>
                                  </div>
                                </div>
                                <div className="tissue-bar-row">
                                  <div className="tissue-label-percent">
                                    <span>Epitelização (Rosa)</span>
                                    <span>{selectedEntry.aiTissueAnalysis.epitelizacao || 0}%</span>
                                  </div>
                                  <div className="tissue-track">
                                    <div className="tissue-fill" style={{ width: `${selectedEntry.aiTissueAnalysis.epitelizacao || 0}%`, backgroundColor: 'pink' }}></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                             <div className="glass-card" style={{ padding: '18px', margin: 0, border: '1px solid var(--border-color)' }}>
                              <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px' }}>Métricas da Ferida</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
                                <div><strong>Localização:</strong> {selectedEntry.anatomicalLocation || 'Não informada'}</div>
                                <div><strong>Estágio:</strong> {selectedEntry.lesionStage || 'Não informado'}</div>
                                <div><strong>Área:</strong> {selectedEntry.aiAreaCm2 ? `${selectedEntry.aiAreaCm2} cm²` : 'N/A'}</div>
                                <div><strong>Evolução:</strong> {selectedEntry.clinicalEvolution}</div>
                                <div><strong>Dor (0-10):</strong> {selectedEntry.pain}</div>
                                <div><strong>Exsudato:</strong> {selectedEntry.exudate}</div>
                                <div><strong>Cobertura Prescrita:</strong> {selectedEntry.appliedDressing || 'Aguardando indicação'}</div>
                                <div><strong>Frequência de Troca:</strong> {selectedEntry.dressingFrequency || 'Aguardando indicação'}</div>
                              </div>
                            </div>

                            <div className="glass-card" style={{ padding: '18px', margin: 0, border: '1px solid var(--border-color)' }}>
                              <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--primary)', marginBottom: '6px' }}>Sugestão de Conduta (IA)</h4>
                              <p style={{ fontSize: '12.5px', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                                {selectedEntry.aiRecommendation || 'Sem recomendação clínica gerada pela IA.'}
                              </p>
                            </div>

                            {/* Medical Evolution Form */}
                            <div className="notes-compose-box no-print">
                              <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>Evolução Clínica & Prescrição Oficial</h4>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', margin: '8px 0 12px 0' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cobertura Recomendada</label>
                                  <select 
                                    value={prescribedDressing}
                                    onChange={(e) => setPrescribedDressing(e.target.value)}
                                    style={{
                                      padding: '10px',
                                      borderRadius: '8px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-secondary)',
                                      fontSize: '13px',
                                      color: 'var(--text-primary)'
                                    }}
                                  >
                                    <option value="">Selecione uma cobertura...</option>
                                    <option value="Alginato de Cálcio">Alginato de Cálcio (Absorção/Hemostasia)</option>
                                    <option value="Carvão Ativado com Prata">Carvão Ativado com Prata (Controle de Odor/Bactérias)</option>
                                    <option value="Hidrogel com Alginato">Hidrogel com Alginato (Desbridamento Autolítico/Umidade)</option>
                                    <option value="Hidrocolóide Extra Fino">Hidrocolóide Extra Fino (Proteção/Fase Final)</option>
                                    <option value="Espuma de Poliuretano">Espuma de Poliuretano (Exsudato Moderado a Alto)</option>
                                    <option value="Colágeno com Alginato">Colágeno com Alginato (Estimulação de Tecido)</option>
                                    <option value="Sulfadiazina de Prata 1%">Sulfadiazina de Prata 1% (Antimicrobiano)</option>
                                    <option value="Gasinha de Rayon com AGE">Gasinha de Rayon com AGE (Proteção/Hidratação)</option>
                                  </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Frequência de Troca</label>
                                  <select 
                                    value={prescribedFrequency}
                                    onChange={(e) => setPrescribedFrequency(e.target.value)}
                                    style={{
                                      padding: '10px',
                                      borderRadius: '8px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-secondary)',
                                      fontSize: '13px',
                                      color: 'var(--text-primary)'
                                    }}
                                  >
                                    <option value="">Selecione a frequência...</option>
                                    <option value="Diário">A cada 24 horas (Diário)</option>
                                    <option value="A cada 12 horas">A cada 12 horas (2x ao dia)</option>
                                    <option value="A cada 48 horas">A cada 48 horas (Dias Alternados)</option>
                                    <option value="A cada 72 horas">A cada 72 horas (A cada 3 dias)</option>
                                    <option value="Semanal">A cada 7 dias (Semanal)</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={toggleSpeechRecognition}
                                  className={`btn ${isRecordingNote ? 'btn-danger pulsing-record' : 'btn-secondary'}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '11.5px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    border: '1px solid var(--border-color)',
                                    color: isRecordingNote ? '#ffffff' : 'var(--text-primary)',
                                    backgroundColor: isRecordingNote ? '#ef4444' : 'var(--bg-secondary)',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {isRecordingNote ? '🛑 Gravando (Fale)...' : '🎙️ Ditado Clínico (Voz)'}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleSuggestAISummary}
                                  className="btn btn-secondary"
                                  disabled={generatingAISummary}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '11.5px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {generatingAISummary ? '⏳ Sugerindo...' : '💡 Sugerir Nota por IA'}
                                </button>
                              </div>

                              <textarea 
                                className="notes-textarea" 
                                placeholder="Digite aqui a sua nota de evolução do paciente, indicação de medicamentos ou encaminhamentos cirúrgicos..."
                                value={doctorNote}
                                onChange={(e) => setDoctorNote(e.target.value)}
                              />
                              <button 
                                className="btn btn-primary" 
                                onClick={handleSaveNote}
                                style={{ alignSelf: 'flex-end', padding: '8px 16px', fontSize: '12.5px' }}
                                disabled={savingNote}
                              >
                                {savingNote ? 'Salvando...' : 'Gravar Nota no Prontuário'}
                              </button>
                            </div>

                            {/* Print preview of saved doctor notes & prescription */}
                            {(selectedEntry.doctorNotes || selectedEntry.appliedDressing) && (
                              <div className="print-only" style={{ borderTop: '2px solid #000', paddingTop: '10px', marginTop: '10px' }}>
                                <h4 style={{ fontWeight: 'bold' }}>Parecer Clínico e Conduta Médica:</h4>
                                {selectedEntry.appliedDressing && (
                                  <p style={{ margin: '4px 0' }}>
                                    <strong>Cobertura Prescrita:</strong> {selectedEntry.appliedDressing} 
                                    {selectedEntry.dressingFrequency ? ` (${selectedEntry.dressingFrequency})` : ''}
                                  </p>
                                )}
                                {selectedEntry.doctorNotes && (
                                  <p style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', marginTop: '6px' }}>{selectedEntry.doctorNotes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

              {/* Galeria Evolutiva Section */}
              {selectedSubTab === 'gallery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                  {!showComparison ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Galeria Comparativa de Lesões</h3>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                            Selecione exatamente duas fotos de triagem abaixo para comparar as imagens e os dados teciduais calculados pela IA lado a lado.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowComparison(true)}
                          className="btn btn-primary"
                          disabled={compareEntries.length !== 2}
                          style={{
                            padding: '8px 16px',
                            fontSize: '12.5px',
                            borderRadius: '30px',
                            boxShadow: 'var(--shadow-sm)',
                            alignSelf: 'flex-start'
                          }}
                        >
                          Comparar Lado a Lado ({compareEntries.length}/2)
                        </button>
                      </div>

                      {selectedPatientEntries.filter(e => e.photo).length === 0 ? (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          Nenhuma foto de ferida registrada no histórico deste paciente.
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '16px',
                          marginTop: '8px'
                        }}>
                          {selectedPatientEntries.filter(e => e.photo).map(entry => {
                            const isChecked = compareEntries.some(e => e.id === entry.id);
                            return (
                              <div
                                key={entry.id}
                                onClick={() => {
                                  setCompareEntries(prev => {
                                    if (prev.some(e => e.id === entry.id)) {
                                      return prev.filter(e => e.id !== entry.id);
                                    }
                                    if (prev.length >= 2) {
                                      return [prev[1], entry];
                                    }
                                    return [...prev, entry];
                                  });
                                }}
                                style={{
                                  backgroundColor: 'var(--bg-secondary)',
                                  border: isChecked ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                  borderRadius: '12px',
                                  padding: '12px',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '10px'
                                }}
                              >
                                <div style={{
                                  position: 'absolute',
                                  top: '10px',
                                  right: '10px',
                                  zIndex: 5,
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '4px',
                                  border: '2px solid var(--primary)',
                                  backgroundColor: isChecked ? 'var(--primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}>
                                  {isChecked && '✓'}
                                </div>

                                <div style={{
                                  width: '100%',
                                  aspectRatio: '4/3',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  backgroundColor: 'var(--bg-primary)'
                                }}>
                                  <img
                                    src={entry.photo}
                                    alt={`Foto de ${entry.date}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>

                                <div style={{ fontSize: '12.5px' }}>
                                  <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{entry.date}</div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>{entry.type}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Área:</span>
                                    <strong>{entry.aiAreaCm2 ? `${entry.aiAreaCm2} cm²` : 'N/A'}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Comparison side by side view */}
                      <div>
                        <button
                          onClick={() => setShowComparison(false)}
                          className="back-btn"
                          style={{ margin: '0 0 16px 0', padding: 0 }}
                        >
                          ← Voltar para Galeria
                        </button>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                          gap: '24px'
                        }}>
                          {compareEntries.map((entry, idx) => {
                            const otherEntry = compareEntries[1 - idx];
                            let areaChangeText = '';
                            let areaChangeColor = 'var(--text-muted)';
                            if (entry.aiAreaCm2 && otherEntry?.aiAreaCm2) {
                              const isOlder = new Date(entry.createdAt) < new Date(otherEntry.createdAt);
                              if (isOlder) {
                                const diff = ((otherEntry.aiAreaCm2 - entry.aiAreaCm2) / entry.aiAreaCm2) * 100;
                                if (diff < 0) {
                                  areaChangeText = `Redução de ${Math.abs(diff).toFixed(1)}% na ferida posterior`;
                                  areaChangeColor = 'var(--success-light)';
                                } else if (diff > 0) {
                                  areaChangeText = `Aumento de ${diff.toFixed(1)}% na ferida posterior`;
                                  areaChangeColor = 'var(--danger)';
                                } else {
                                  areaChangeText = `Sem alteração de tamanho`;
                                }
                              }
                            }

                            return (
                              <div
                                key={entry.id}
                                style={{
                                  backgroundColor: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '16px',
                                  padding: '20px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '16px'
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  borderBottom: '1px solid var(--border-color)',
                                  paddingBottom: '10px'
                                }}>
                                  <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>
                                    Registro: {entry.date}
                                  </h4>
                                  {areaChangeText && (
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: 'var(--bg-primary)',
                                      color: areaChangeColor,
                                      border: `1px solid ${areaChangeColor}`
                                    }}>
                                      {areaChangeText}
                                    </span>
                                  )}
                                </div>

                                <div style={{
                                  width: '100%',
                                  aspectRatio: '4/3',
                                  borderRadius: '10px',
                                  overflow: 'hidden',
                                  border: '1px solid var(--border-color)'
                                }}>
                                  <img
                                    src={entry.photo}
                                    alt={`Foto de ${entry.date}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>

                                {/* Metrics table */}
                                <div style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  padding: '12px 16px',
                                  borderRadius: '8px',
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '8px',
                                  fontSize: '12.5px'
                                }}>
                                  <div><strong>Área:</strong> {entry.aiAreaCm2 ? `${entry.aiAreaCm2} cm²` : 'N/A'}</div>
                                  <div><strong>Estágio:</strong> {entry.lesionStage || 'Não informado'}</div>
                                  <div><strong>Dor:</strong> {entry.pain || 0}/10</div>
                                  <div><strong>Exsudato:</strong> {entry.exudate || 'N/A'}</div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <strong>Local:</strong> {entry.anatomicalLocation || 'Não informada'}
                                  </div>
                                </div>

                                {/* Tissue breakdown */}
                                {entry.aiTissueAnalysis && (
                                  <div>
                                    <h5 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>Métricas Teciduais (IA)</h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {[['Granulação', entry.aiTissueAnalysis.granulacao || 0, 'var(--danger)'],
                                        ['Fibrina/Esfacelo', entry.aiTissueAnalysis.fibrina || 0, 'gold'],
                                        ['Necrose', entry.aiTissueAnalysis.necrose || 0, '#111'],
                                        ['Epitelização', entry.aiTissueAnalysis.epitelizacao || 0, 'pink']].map(([label, val, color]) => (
                                          <div key={label} style={{ fontSize: '11.5px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                                              <span>{label}</span>
                                              <span>{val}%</span>
                                            </div>
                                            <div style={{ height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                                              <div style={{ width: `${val}%`, height: '100%', backgroundColor: color }} />
                                            </div>
                                          </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Notes and suggestions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                    <strong>Evolução Clínica:</strong>
                                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                      {entry.doctorNotes || 'Sem evolução cadastrada por profissional ainda.'}
                                    </p>
                                  </div>
                                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                    <strong>Recomendação IA:</strong>
                                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                      {entry.aiRecommendation || 'Nenhuma recomendação registrada.'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Documentos Clínicos Section */}
              {selectedSubTab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Emissão de Documentos Clínicos</h3>
                  
                  {/* Document Type Selector Tabs */}
                  <div className="login-tabs no-print" style={{ margin: '0 0 10px 0', width: 'fit-content', backgroundColor: 'var(--bg-secondary)' }}>
                    <button 
                      type="button" 
                      className={`login-tab-btn ${selectedDocTab === 'receita' ? 'active' : ''}`}
                      onClick={() => setSelectedDocTab('receita')}
                      style={{ minWidth: '130px', padding: '8px' }}
                    >
                      Receita Médica
                    </button>
                    <button 
                      type="button" 
                      className={`login-tab-btn ${selectedDocTab === 'atestado' ? 'active' : ''}`}
                      onClick={() => setSelectedDocTab('atestado')}
                      style={{ minWidth: '130px', padding: '8px' }}
                    >
                      Atestado Médico
                    </button>
                  </div>

                  {/* Receita Form */}
                  {selectedDocTab === 'receita' && (
                    <div className="notes-compose-box no-print" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Nova Receita Médica</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {prescriptionItems.map((item, index) => (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr auto', gap: '10px', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Nome do Medicamento / Cobertura</label>
                              <input 
                                type="text"
                                placeholder="Ex: Alginato de Cálcio"
                                value={item.name}
                                onChange={(e) => handleUpdatePrescriptionItem(index, 'name', e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12.5px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Posologia / Quantidade</label>
                              <input 
                                type="text"
                                placeholder="Ex: 1 cobertura ou 1 comp."
                                value={item.dosage}
                                onChange={(e) => handleUpdatePrescriptionItem(index, 'dosage', e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12.5px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Via de Administração</label>
                              <select
                                value={item.route}
                                onChange={(e) => handleUpdatePrescriptionItem(index, 'route', e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12.5px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              >
                                <option value="Via Tópica">Via Tópica</option>
                                <option value="Via Oral">Via Oral</option>
                                <option value="Via Intramuscular">Via Intramuscular</option>
                                <option value="Via Subcutânea">Via Subcutânea</option>
                                <option value="Via Endovenosa">Via Endovenosa</option>
                                <option value="Outra">Outra</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>Instruções de Uso</label>
                              <input 
                                type="text"
                                placeholder="Ex: Aplicar a cada 48h no leito"
                                value={item.instructions}
                                onChange={(e) => handleUpdatePrescriptionItem(index, 'instructions', e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12.5px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <button 
                              type="button"
                              onClick={() => handleRemovePrescriptionItem(index)}
                              disabled={prescriptionItems.length === 1}
                              style={{ padding: '8px', border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', marginTop: '14px' }}
                              title="Remover medicamento"
                            >
                              <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', alignItems: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          type="button" 
                          onClick={handleAddPrescriptionItem}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          + Adicionar Medicamento / Cobertura
                        </button>
                        <button 
                          className="btn btn-primary" 
                          type="button" 
                          onClick={() => handleIssueDocument('receita')}
                          style={{ padding: '8px 16px', fontSize: '13px' }}
                          disabled={savingDoc}
                        >
                          {savingDoc ? 'Emitindo...' : 'Emitir e Salvar Receita'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Atestado Form */}
                  {selectedDocTab === 'atestado' && (
                    <div className="notes-compose-box no-print" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Novo Atestado Médico</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '14px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Tipo de Atestado</label>
                          <select 
                            value={atestadoType}
                            onChange={(e) => setAtestadoType(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                          >
                            <option value="Afastamento">Afastamento Temporário</option>
                            <option value="Comparecimento">Declaração de Comparecimento</option>
                            <option value="Aptidão">Aptidão Física</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Dias de Afastamento / Repouso</label>
                          <input 
                            type="number"
                            min="1"
                            max="90"
                            value={atestadoDays}
                            onChange={(e) => setAtestadoDays(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>CID-10 (Opcional)</label>
                          <input 
                            type="text"
                            placeholder="Ex: L98.4"
                            value={atestadoCid}
                            onChange={(e) => setAtestadoCid(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Justificativa Clínica / Conteúdo do Atestado</label>
                        <textarea 
                          className="notes-textarea"
                          value={atestadoReason}
                          onChange={(e) => setAtestadoReason(e.target.value)}
                          placeholder="Descreva a recomendação e repouso de forma detalhada..."
                          style={{ minHeight: '80px' }}
                        />
                      </div>

                      <button 
                        className="btn btn-primary" 
                        type="button" 
                        onClick={() => handleIssueDocument('atestado')}
                        style={{ alignSelf: 'flex-end', padding: '8px 16px', fontSize: '13px' }}
                        disabled={savingDoc}
                      >
                        {savingDoc ? 'Emitindo...' : 'Emitir e Salvar Atestado'}
                      </button>
                    </div>
                  )}

                  {/* Issued Documents List */}
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px' }}>Histórico de Documentos do Paciente</h4>
                    {patientDocuments.length === 0 ? (
                      <div className="glass-card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', margin: 0 }}>
                        Nenhum documento (receita ou atestado) foi emitido para este paciente ainda.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {patientDocuments.map((doc) => (
                          <div key={doc.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', margin: 0, border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: doc.type === 'receita' ? 'var(--primary-glow)' : 'hsla(185, 75%, 45%, 0.1)',
                                color: doc.type === 'receita' ? 'var(--primary)' : 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px'
                              }}>
                                {doc.type === 'receita' ? '⚡' : '📋'}
                              </div>
                              <div>
                                <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                                  {doc.type === 'receita' ? 'Receita Médica' : `Atestado de ${doc.content.atestadoType || 'Afastamento'}`}
                                </strong>
                                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                  Emitido em: {new Date(doc.createdAt).toLocaleDateString('pt-BR')} às {new Date(doc.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Dr(a). {doc.content.doctorName}
                                </p>
                              </div>
                            </div>

                            <button 
                              className="btn btn-secondary no-print" 
                              onClick={() => handlePrintDocument(doc)}
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.617 0-1.11-.475-1.12-1.092L6.34 18m11.318 0a3 3 0 0 0-3-3H9.345a3 3 0 0 0-3 3m10.71-.229a4.482 4.482 0 0 0-10.71 0M18 9v3.75m-9-3.75h6.002c1.242 0 2.25 1.008 2.25 2.25v2.625M6 12v1.5m1.5-1.5H6" />
                              </svg>
                              Imprimir / PDF
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Copiloto Sidebar Panel */}
          <div className="clinical-chat-panel no-print">
            <div className="chat-panel-header">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l2.754-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.028c0 1.602 1.123 2.995 2.707 3.228 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501z" />
              </svg>
              <h3 style={{ fontSize: '14.5px', fontWeight: '700' }}>Copiloto Médico de IA</h3>
            </div>

            <div className="chat-body-doctor">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message-bubble ${msg.sender}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                  
                  {msg.sender === 'ai' && (msg.suggestedDocument?.type === 'receita' || (!msg.suggestedDocument && (msg.text.toLowerCase().includes('receita') || msg.text.toLowerCase().includes('prescr') || msg.text.toLowerCase().includes('cobertura')))) && (
                    <button 
                      onClick={() => handleApplyAISuggestion('receita', msg.suggestedDocument?.content || msg.text)}
                      style={{
                        marginTop: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                      type="button"
                    >
                      ⚡ Preencher Receita Sugerida
                    </button>
                  )}

                  {msg.sender === 'ai' && (msg.suggestedDocument?.type === 'atestado' || (!msg.suggestedDocument && (msg.text.toLowerCase().includes('atestado') || msg.text.toLowerCase().includes('afastamento') || msg.text.toLowerCase().includes('dias')))) && (
                    <button 
                      onClick={() => handleApplyAISuggestion('atestado', msg.suggestedDocument?.content || msg.text)}
                      style={{
                        marginTop: '4px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                      type="button"
                    >
                      📋 Preencher Atestado Sugerido
                    </button>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="chat-message-bubble ai" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Analisando prontuário e respondendo...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-form-doctor" onSubmit={handleSendChatMessage}>
              <input 
                type="text" 
                placeholder="Perguntar sobre condutas, curativos ou histórico do paciente..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading}>Enviar</button>
            </form>
          </div>
      {/* Printable Preview A4 (Only visible when printing) */}
      {activePrintDoc && (
        <div className="print-document-layout print-only" style={{ display: 'none' }}>
          <div style={{ border: '2px solid #111', padding: '40px', minHeight: '1050px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000', position: 'relative', fontFamily: 'Arial, sans-serif' }}>
            <div>
              {/* Top Margin Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1e3a8a', paddingBottom: '16px', marginBottom: '30px' }}>
                <div>
                  <h1 style={{ fontSize: '32px', color: '#1e3a8a', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>iRec</h1>
                  <span style={{ fontSize: '11px', color: '#4b5563', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Prontuário & Prescrição Digital Segura</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold', color: '#111', textTransform: 'uppercase' }}>
                    {activePrintDoc.type === 'receita' ? 'Prescrição Médica' : 'Atestado Médico'}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#4b5563' }}>Emitido em {new Date(activePrintDoc.createdAt).toLocaleDateString('pt-BR')} às {new Date(activePrintDoc.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Specialty Verification Seal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '8px', padding: '12px 18px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🛡️</span>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534' }}>
                      Documento Emitido por Profissional Credenciado
                    </span>
                    <p style={{ margin: 0, fontSize: '11px', color: '#15803d' }}>
                      Área de Atuação: {activePrintDoc.content.doctorSpecialty} • CRM/Registro: {activePrintDoc.content.doctorCrm}
                      {activePrintDoc.content.doctorRqe ? ` • RQE: ${activePrintDoc.content.doctorRqe}` : (activePrintDoc.content.doctorSpecialty !== 'Estomaterapia' && activePrintDoc.content.doctorSpecialty !== 'Enfermagem Geral' && doctorProfile.rqe ? ` • RQE: ${doctorProfile.rqe}` : '')}
                    </p>
                  </div>
                </div>
                <div style={{ border: '1px solid #86efac', color: '#166534', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#e8fdf0' }}>
                  Especialidade Validada
                </div>
              </div>

              {/* Patient details */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '30px', fontSize: '13px' }}>
                <div><strong>Paciente:</strong> {selectedPatient?.name}</div>
                <div><strong>Idade:</strong> {calculateAge(selectedPatient?.birthDate)}</div>
                <div><strong>Gênero:</strong> {selectedPatient?.gender}</div>
              </div>

              {/* Document Content */}
              {activePrintDoc.type === 'receita' ? (
                <div style={{ padding: '0 10px' }}>
                  <h3 style={{ fontSize: '15px', borderBottom: '1px solid #111', paddingBottom: '6px', marginBottom: '18px', color: '#111', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Prescrição de Coberturas & Recomendações:
                  </h3>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    {activePrintDoc.content.items?.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '20px', fontSize: '14px', lineHeight: '1.6', color: '#111' }}>
                        <strong style={{ fontSize: '15px', color: '#000' }}>{item.name}</strong> — {item.dosage} ({item.route})
                        <p style={{ margin: '4px 0 0 0', color: '#374151', fontStyle: 'italic', fontSize: '13px' }}>
                          Instruções: {item.instructions}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div style={{ fontSize: '14.5px', lineHeight: '1.8', color: '#111', padding: '0 10px' }}>
                  <h3 style={{ fontSize: '15px', borderBottom: '1px solid #111', paddingBottom: '6px', marginBottom: '18px', color: '#111', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Declaração de Atestado Clínico ({activePrintDoc.content.atestadoType || 'Afastamento'}):
                  </h3>
                  <p style={{ textAlign: 'justify' }}>
                    Atesto para os devidos fins regulamentares que o(a) paciente acima identificado(a) esteve sob meus cuidados clínicos na data de hoje e <strong>{activePrintDoc.content.reason}</strong>. Em decorrência do quadro, recomendo o seu repouso e afastamento total de suas atividades habituais, laborais e acadêmicas pelo período de <strong>{activePrintDoc.content.days} dia(s)</strong>, contados a partir desta data.
                  </p>
                  {activePrintDoc.content.cid && (
                    <div style={{ marginTop: '20px', display: 'inline-block', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', backgroundColor: '#f8fafc', fontSize: '13px' }}>
                      <strong>Classificação Internacional de Doenças (CID-10):</strong> {activePrintDoc.content.cid}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Verification & Signature Section */}
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '20px', marginTop: '40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr 1fr', gap: '20px', alignItems: 'center' }}>
                {/* QR Code */}
                <div>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://irec.com.br/validar?code=validation_${activePrintDoc.id}`)}`}
                    alt="QR Code de Autenticidade"
                    style={{ width: '80px', height: '80px', border: '1px solid #cbd5e1', padding: '4px', backgroundColor: '#fff' }}
                  />
                </div>

                {/* ICP-Brasil Seal Info */}
                <div style={{ fontSize: '11px', lineHeight: '1.4', color: '#4b5563' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
                    <span>🛡️</span> ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)
                  </div>
                  Este documento foi assinado eletronicamente por <strong>Dr(a). {activePrintDoc.content.doctorName}</strong> utilizando infraestrutura de chaves públicas credenciada pela Medida Provisória nº 2.200-2/2001. A integridade e autencidade da receita/atestado médico podem ser verificadas via QR Code ou no site oficial de validação:
                  <div style={{ fontWeight: 'bold', color: '#1e3a8a', marginTop: '2px' }}>
                    https://irec.com.br/validar (Código: validation_${activePrintDoc.id})
                  </div>
                </div>

                {/* Doctor Signature Stamp */}
                <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px', color: '#1e3a8a', margin: '0 0 4px 0' }}>
                    {activePrintDoc.content.doctorName}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#111' }}>
                    Dr(a). {activePrintDoc.content.doctorName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#4b5563' }}>
                    {activePrintDoc.content.doctorSpecialty}
                  </div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>
                    CRM/Registro: {activePrintDoc.content.doctorCrm}
                  </div>
                  {(activePrintDoc.content.doctorRqe || (activePrintDoc.content.doctorSpecialty !== 'Estomaterapia' && activePrintDoc.content.doctorSpecialty !== 'Enfermagem Geral' && doctorProfile.rqe)) && (
                    <div style={{ fontSize: '9px', color: '#6b7280' }}>
                      RQE: {activePrintDoc.content.doctorRqe || doctorProfile.rqe}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Copyright */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '20px', fontSize: '10px', color: '#9ca3af' }}>
                <span>iRec Telemedicina & Cicatrização Digital S.A.</span>
                <span>Documento oficial nos termos da Resolução CFM nº 2.299/2021.</span>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
