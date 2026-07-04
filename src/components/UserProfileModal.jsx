import React, { useState, useRef } from 'react';
import { updateClinicalProfile, uploadAvatar } from '../services/supabaseService';

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

export default function UserProfileModal({ currentUser, onClose, onProfileUpdate }) {
  const [activeTab, setActiveTab] = useState('pessoais');
  const [formData, setFormData] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    role: currentUser.role || 'patient',
    crm: currentUser.crm || '',
    specialty: currentUser.specialty || '',
    rqe: currentUser.rqe || '',
    bio: currentUser.bio || '',
    education: currentUser.education || '',
    consultationFee: currentUser.consultationFee || '',
    birthDate: currentUser.birthDate || '',
    gender: currentUser.gender || '',
    healthUnit: currentUser.healthUnit || '',
    cpf: currentUser.cpf || '',
    rg: currentUser.rg || '',
    cns: currentUser.cns || '',
    phone: currentUser.phone || '',
    emergencyContactName: currentUser.emergencyContactName || '',
    emergencyContactPhone: currentUser.emergencyContactPhone || '',
    cep: currentUser.cep || '',
    street: currentUser.street || '',
    number: currentUser.number || '',
    complement: currentUser.complement || '',
    neighborhood: currentUser.neighborhood || '',
    city: currentUser.city || '',
    state: currentUser.state || '',
    weight: currentUser.weight || '',
    height: currentUser.height || '',
    bloodType: currentUser.bloodType || '',
    mobility: currentUser.mobility || '',
    nutritionalStatus: currentUser.nutritionalStatus || '',
    alcoholism: currentUser.alcoholism || false,
    hasCaregiver: currentUser.hasCaregiver || false,
    caregiverName: currentUser.caregiverName || '',
    hasDiabetes: currentUser.hasDiabetes || false,
    hasHypertension: currentUser.hasHypertension || false,
    hasVenousInsufficiency: currentUser.hasVenousInsufficiency || false,
    hasPeripheralArterialDisease: currentUser.hasPeripheralArterialDisease || false,
    isSmoker: currentUser.isSmoker || false,
    isObese: currentUser.isObese || false,
    hasAmputationHistory: currentUser.hasAmputationHistory || false,
    otherConditions: currentUser.otherConditions || '',
    medications: currentUser.medications || '',
    allergies: currentUser.allergies || '',
    avatarUrl: currentUser.avatarUrl || ''
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [specSearch, setSpecSearch] = useState('');
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Auto CEP lookup
  const handleCepChange = async (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, cep: value }));
    if (value.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          }));
        }
      } catch (err) {
        console.warn("Erro ao buscar CEP:", err);
      }
    }
  };

  // BMI calculations and automatic obesity flag
  const w = parseFloat(formData.weight);
  const h = parseFloat(formData.height);
  const bmi = (w && h) ? (w / (h * h)) : null;

  const getBmiCategory = (value) => {
    if (!value) return null;
    if (value < 18.5) return { text: 'Abaixo do peso (Desnutrição)', color: 'var(--danger)', bg: 'var(--danger-glow)' };
    if (value < 25) return { text: 'Peso Saudável', color: 'var(--success-light)', bg: 'var(--success-glow)' };
    if (value < 30) return { text: 'Sobrepeso', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' };
    return { text: 'Obesidade Clínica', color: 'var(--danger)', bg: 'var(--danger-glow)' };
  };

  const bmiCat = getBmiCategory(bmi);

  // Profile picture upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione uma imagem válida.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 2MB.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const publicUrl = await uploadAvatar(currentUser.id, file);
      if (publicUrl) {
        setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
        // Sincronizar na hora com o estado do App se possível
        const updated = { ...currentUser, avatarUrl: publicUrl };
        onProfileUpdate(updated);
        setSuccessMsg('Foto de perfil atualizada!');
      } else {
        setErrorMsg('Falha ao fazer upload da imagem.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar foto de perfil.');
    } finally {
      setUploading(false);
    }
  };

  // Submit profile edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Map back formatting and values
      const updatedProfile = {
        ...currentUser,
        name: formData.name,
        crm: formData.crm,
        specialty: formData.specialty,
        rqe: formData.rqe,
        bio: formData.bio,
        education: formData.education,
        consultationFee: formData.consultationFee ? parseFloat(formData.consultationFee) : null,
        birthDate: formData.birthDate,
        gender: formData.gender,
        healthUnit: formData.healthUnit,
        cpf: formData.cpf,
        rg: formData.rg,
        cns: formData.cns,
        phone: formData.phone,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        bloodType: formData.bloodType,
        mobility: formData.mobility,
        nutritionalStatus: formData.nutritionalStatus || (bmiCat ? (bmi < 18.5 ? 'Desnutrição' : bmi < 30 ? 'Bem nutrido' : 'Obesidade') : ''),
        alcoholism: formData.alcoholism,
        hasCaregiver: formData.hasCaregiver,
        caregiverName: formData.hasCaregiver ? formData.caregiverName : '',
        hasDiabetes: formData.hasDiabetes,
        hasHypertension: formData.hasHypertension,
        hasVenousInsufficiency: formData.hasVenousInsufficiency,
        hasPeripheralArterialDisease: formData.hasPeripheralArterialDisease,
        isSmoker: formData.isSmoker,
        isObese: (bmi !== null) ? (bmi >= 30) : (formData.isObese || false),
        hasAmputationHistory: formData.hasAmputationHistory,
        otherConditions: formData.otherConditions,
        medications: formData.medications,
        allergies: formData.allergies,
        avatarUrl: formData.avatarUrl
      };

      const result = await updateClinicalProfile(currentUser.id, updatedProfile);
      if (result) {
        onProfileUpdate(result);
        setSuccessMsg('Perfil atualizado com sucesso!');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg('Erro ao atualizar perfil.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Ocorreu um erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const selectedSpecialties = formData.specialty ? formData.specialty.split(',').map(s => s.trim()).filter(Boolean) : [];
  const isNurse = selectedSpecialties.length > 0 && selectedSpecialties.every(s => 
    s.toLowerCase().includes('estomaterapia') || 
    s.toLowerCase().includes('enfermagem') || 
    s.toLowerCase().includes('enfermeir')
  );

  const filteredOptions = ALL_SPECIALTIES.filter(s => 
    s.toLowerCase().includes(specSearch.toLowerCase()) && 
    !selectedSpecialties.includes(s)
  );

  const showCustomOption = specSearch.trim() && 
    !ALL_SPECIALTIES.some(s => s.toLowerCase() === specSearch.trim().toLowerCase()) &&
    !selectedSpecialties.some(s => s.toLowerCase() === specSearch.trim().toLowerCase());

  const addSpecialty = (specName) => {
    if (!selectedSpecialties.includes(specName)) {
      const updated = [...selectedSpecialties, specName].join(', ');
      setFormData(prev => ({ ...prev, specialty: updated }));
    }
    setSpecSearch('');
    setSpecDropdownOpen(false);
  };

  const removeSpecialty = (specName) => {
    const updated = selectedSpecialties.filter(s => s !== specName).join(', ');
    setFormData(prev => ({ ...prev, specialty: updated }));
  };

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="profile-modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, fontFamily: 'var(--font-display)' }}>
            Editar Perfil de Usuário
          </h2>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg style={{ width: '24px', height: '24px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="profile-modal-content">
            
            {/* Status alerts */}
            {errorMsg && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-glow)', color: 'var(--danger)', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--success-glow)', color: 'var(--success-light)', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
                {successMsg}
              </div>
            )}

            {/* Photo Edit */}
            <div className="avatar-edit-container">
              <div className="avatar-circle" onClick={handleAvatarClick}>
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  getInitials(formData.name)
                )}
                <div className="avatar-overlay">
                  {uploading ? 'Enviando...' : 'Alterar Foto'}
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                accept="image/*"
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {currentUser.role === 'doctor' ? 'Perfil Médico' : 'Prontuário do Paciente'}
              </p>
            </div>

            {/* Form Fields (Patient divided in Tabs, Doctor flat list) */}
            {currentUser.role === 'doctor' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.name} 
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>E-mail (Login)</label>
                  <input type="email" className="form-control" value={formData.email} disabled />
                </div>
                <div className="form-group">
                  <label>Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="(00) 00000-0000"
                    value={formData.phone} 
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label>CRM / COREN</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ex: CRM/SP 123456"
                    value={formData.crm} 
                    onChange={e => setFormData(prev => ({ ...prev, crm: e.target.value }))} 
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Especialidade(s) Clínica(s)</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      padding: '8px 10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      minHeight: '42px',
                      alignItems: 'center'
                    }}>
                      {selectedSpecialties.map((spec, idx) => (
                        <span key={idx} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: 'var(--primary-glow)',
                          color: 'var(--primary)',
                          padding: '3px 10px',
                          borderRadius: '16px',
                          fontSize: '11.5px',
                          fontWeight: '600'
                        }}>
                          {spec}
                          <button 
                            type="button" 
                            onClick={() => removeSpecialty(spec)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: 'var(--primary)', 
                              cursor: 'pointer', 
                              fontWeight: 'bold',
                              padding: 0,
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      <input 
                        type="text"
                        placeholder={selectedSpecialties.length === 0 ? "Pesquise ou digite uma especialidade..." : "Adicionar outra..."}
                        value={specSearch}
                        onChange={(e) => {
                          setSpecSearch(e.target.value);
                          setSpecDropdownOpen(true);
                        }}
                        onFocus={() => setSpecDropdownOpen(true)}
                        style={{
                          flex: '1',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          minWidth: '120px'
                        }}
                      />
                    </div>
                    {specDropdownOpen && (specSearch.trim() || filteredOptions.length > 0) && (
                      <>
                        <div 
                          onClick={() => setSpecDropdownOpen(false)} 
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                        />
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 999,
                          boxShadow: 'var(--shadow-md)'
                        }}>
                          {showCustomOption && (
                            <div 
                              onClick={() => addSpecialty(specSearch.trim())}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '12.5px',
                                color: 'var(--primary)',
                                fontWeight: 'bold',
                                borderBottom: filteredOptions.length > 0 ? '1px solid var(--border-color)' : 'none'
                              }}
                              className="autocomplete-option"
                            >
                              ➕ Adicionar especialidade: "{specSearch.trim()}"
                            </div>
                          )}
                          {filteredOptions.map((opt, idx) => (
                            <div 
                              key={idx}
                              onClick={() => addSpecialty(opt)}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '12.5px'
                              }}
                              className="autocomplete-option"
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {!isNurse && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>RQE (Registro de Especialidade)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: RQE 98765"
                      value={formData.rqe} 
                      onChange={e => setFormData(prev => ({ ...prev, rqe: e.target.value }))} 
                    />
                  </div>
                )}
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Biografia de Atendimento</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Descreva sua experiência clínica, especialidades secundárias e abordagem de cuidado..."
                    value={formData.bio} 
                    onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    style={{ minHeight: '80px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
                
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Formação Acadêmica e Certificados</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Ex: Graduação em Enfermagem - USP; Especialização em Estomaterapia - SOBEST..."
                    value={formData.education} 
                    onChange={e => setFormData(prev => ({ ...prev, education: e.target.value }))}
                    style={{ minHeight: '80px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label>Valor da Consulta Particular (R$)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="Ex: 250"
                    value={formData.consultationFee} 
                    onChange={e => setFormData(prev => ({ ...prev, consultationFee: e.target.value }))} 
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    Endereço Comercial / Clínica
                  </h3>
                </div>
                <div className="form-group">
                  <label>CEP</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="00000-000"
                    value={formData.cep} 
                    onChange={handleCepChange} 
                  />
                </div>
                <div className="form-group">
                  <label>Rua / Logradouro</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.street} 
                    onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label>Número</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.number} 
                    onChange={e => setFormData(prev => ({ ...prev, number: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label>Complemento</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.complement} 
                    onChange={e => setFormData(prev => ({ ...prev, complement: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label>Bairro</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.neighborhood} 
                    onChange={e => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label>Cidade</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.city} 
                    onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} 
                  />
                </div>
                <div className="form-group">
                  <label>Estado (UF)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    maxLength="2" 
                    placeholder="SP"
                    value={formData.state} 
                    onChange={e => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))} 
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Patient Tab Navigation */}
                <div className="profile-tabs">
                  <button 
                    type="button"
                    className={`profile-tab-btn ${activeTab === 'pessoais' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pessoais')}
                  >
                    Dados Pessoais
                  </button>
                  <button 
                    type="button"
                    className={`profile-tab-btn ${activeTab === 'endereco' ? 'active' : ''}`}
                    onClick={() => setActiveTab('endereco')}
                  >
                    Endereço
                  </button>
                  <button 
                    type="button"
                    className={`profile-tab-btn ${activeTab === 'saude' ? 'active' : ''}`}
                    onClick={() => setActiveTab('saude')}
                  >
                    Ficha de Saúde
                  </button>
                </div>

                {/* Patient Tabs content */}
                {activeTab === 'pessoais' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nome Completo</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.name} 
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>E-mail (Acesso)</label>
                      <input type="email" className="form-control" value={formData.email} disabled />
                    </div>
                    <div className="form-group">
                      <label>CPF (Necessário para Receitas)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="000.000.000-00"
                        value={formData.cpf} 
                        onChange={e => setFormData(prev => ({ ...prev, cpf: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>RG</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.rg} 
                        onChange={e => setFormData(prev => ({ ...prev, rg: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Cartão SUS (CNS)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="000 0000 0000 0000"
                        value={formData.cns} 
                        onChange={e => setFormData(prev => ({ ...prev, cns: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Telefone / WhatsApp</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="(00) 00000-0000"
                        value={formData.phone} 
                        onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Data de Nascimento</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={formData.birthDate} 
                        onChange={e => setFormData(prev => ({ ...prev, birthDate: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Gênero</label>
                      <select 
                        className="form-control" 
                        value={formData.gender} 
                        onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Contato de Emergência (Nome)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Nome do parente/amigo"
                        value={formData.emergencyContactName} 
                        onChange={e => setFormData(prev => ({ ...prev, emergencyContactName: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Contato de Emergência (Telefone)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="(00) 00000-0000"
                        value={formData.emergencyContactPhone} 
                        onChange={e => setFormData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))} 
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'endereco' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>CEP</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="00000-000"
                        value={formData.cep} 
                        onChange={handleCepChange} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Rua / Logradouro</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.street} 
                        onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Número</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.number} 
                        onChange={e => setFormData(prev => ({ ...prev, number: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Complemento</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.complement} 
                        onChange={e => setFormData(prev => ({ ...prev, complement: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Bairro</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.neighborhood} 
                        onChange={e => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Cidade</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.city} 
                        onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Estado (UF)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        maxLength="2" 
                        placeholder="SP"
                        value={formData.state} 
                        onChange={e => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))} 
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'saude' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Weight, height, BMI row */}
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Peso (kg)</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          className="form-control" 
                          placeholder="Ex: 75.4"
                          value={formData.weight} 
                          onChange={e => setFormData(prev => ({ ...prev, weight: e.target.value }))} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Altura (m)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-control" 
                          placeholder="Ex: 1.75"
                          value={formData.height} 
                          onChange={e => setFormData(prev => ({ ...prev, height: e.target.value }))} 
                        />
                      </div>
                      
                      {/* Calculated BMI */}
                      {bmi && (
                        <div className="form-group" style={{ gridColumn: 'span 2', padding: '14px', borderRadius: 'var(--radius-md)', background: bmiCat?.bg || 'var(--bg-primary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Índice de Massa Corporal (IMC)</p>
                            <h4 style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
                              {bmi.toFixed(1)} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>kg/m²</span>
                            </h4>
                          </div>
                          <span className="badge" style={{ backgroundColor: bmiCat?.bg, color: bmiCat?.color, border: `1px solid ${bmiCat?.color}`, padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: '700' }}>
                            {bmiCat?.text}
                          </span>
                        </div>
                      )}

                      <div className="form-group">
                        <label>Tipo Sanguíneo</label>
                        <select 
                          className="form-control" 
                          value={formData.bloodType} 
                          onChange={e => setFormData(prev => ({ ...prev, bloodType: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Nível de Mobilidade</label>
                        <select 
                          className="form-control" 
                          value={formData.mobility} 
                          onChange={e => setFormData(prev => ({ ...prev, mobility: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          <option value="Ativo">Ativo (Deambula sem assistência)</option>
                          <option value="Cadeirante">Cadeirante (Mobilidade reduzida)</option>
                          <option value="Acamado">Acamado (Restrito ao leito / Braden alto risco)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Status Nutricional</label>
                        <select 
                          className="form-control" 
                          value={formData.nutritionalStatus} 
                          onChange={e => setFormData(prev => ({ ...prev, nutritionalStatus: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          <option value="Bem nutrido">Bem nutrido</option>
                          <option value="Desnutrição">Desnutrição / Déficit proteico</option>
                          <option value="Sobrepeso">Sobrepeso</option>
                          <option value="Obesidade">Obesidade</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Consumo de Álcool (Etilismo)</label>
                        <select 
                          className="form-control" 
                          value={formData.alcoholism ? "sim" : "nao"} 
                          onChange={e => setFormData(prev => ({ ...prev, alcoholism: e.target.value === "sim" }))}
                        >
                          <option value="nao">Não / Ocasional</option>
                          <option value="sim">Sim (Frequente/Crônico - interfere na cicatrização)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Possui Cuidador Principal?</label>
                        <select 
                          className="form-control" 
                          value={formData.hasCaregiver ? "sim" : "nao"} 
                          onChange={e => setFormData(prev => ({ ...prev, hasCaregiver: e.target.value === "sim" }))}
                        >
                          <option value="nao">Não (Realiza auto-curativo)</option>
                          <option value="sim">Sim (Dependente de auxílio)</option>
                        </select>
                      </div>

                      {formData.hasCaregiver && (
                        <div className="form-group animate-fade-in">
                          <label>Nome do Cuidador Principal</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Nome completo do cuidador"
                            value={formData.caregiverName} 
                            onChange={e => setFormData(prev => ({ ...prev, caregiverName: e.target.value }))} 
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Comorbidities checkboxes */}
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        Condições Diagnosticadas (Comorbidades Wound Care)
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                        
                        <label className={`premium-checkbox-label ${formData.hasDiabetes ? 'checked' : ''}`} style={{ padding: '8px 12px' }}>
                          <input 
                            type="checkbox" 
                            className="premium-checkbox-input"
                            checked={formData.hasDiabetes}
                            onChange={e => setFormData(prev => ({ ...prev, hasDiabetes: e.target.checked }))}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>Diabetes Mellitus</span>
                        </label>

                        <label className={`premium-checkbox-label ${formData.hasHypertension ? 'checked' : ''}`} style={{ padding: '8px 12px' }}>
                          <input 
                            type="checkbox" 
                            className="premium-checkbox-input"
                            checked={formData.hasHypertension}
                            onChange={e => setFormData(prev => ({ ...prev, hasHypertension: e.target.checked }))}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>Hipertensão Arterial</span>
                        </label>

                        <label className={`premium-checkbox-label ${formData.hasVenousInsufficiency ? 'checked' : ''}`} style={{ padding: '8px 12px' }}>
                          <input 
                            type="checkbox" 
                            className="premium-checkbox-input"
                            checked={formData.hasVenousInsufficiency}
                            onChange={e => setFormData(prev => ({ ...prev, hasVenousInsufficiency: e.target.checked }))}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>Insuficiência Venosa</span>
                        </label>

                        <label className={`premium-checkbox-label ${formData.hasPeripheralArterialDisease ? 'checked' : ''}`} style={{ padding: '8px 12px' }}>
                          <input 
                            type="checkbox" 
                            className="premium-checkbox-input"
                            checked={formData.hasPeripheralArterialDisease}
                            onChange={e => setFormData(prev => ({ ...prev, hasPeripheralArterialDisease: e.target.checked }))}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>Doença Arterial (DAP)</span>
                        </label>

                        <label className={`premium-checkbox-label ${formData.isSmoker ? 'checked' : ''}`} style={{ padding: '8px 12px' }}>
                          <input 
                            type="checkbox" 
                            className="premium-checkbox-input"
                            checked={formData.isSmoker}
                            onChange={e => setFormData(prev => ({ ...prev, isSmoker: e.target.checked }))}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>Tabagismo Ativo</span>
                        </label>

                        <label className={`premium-checkbox-label ${formData.hasAmputationHistory ? 'checked' : ''}`} style={{ padding: '8px 12px' }}>
                          <input 
                            type="checkbox" 
                            className="premium-checkbox-input"
                            checked={formData.hasAmputationHistory}
                            onChange={e => setFormData(prev => ({ ...prev, hasAmputationHistory: e.target.checked }))}
                          />
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>Histórico de Amputação</span>
                        </label>

                      </div>
                    </div>

                    {/* Textareas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="form-group">
                        <label>Medicamentos em Uso</label>
                        <textarea 
                          rows="2" 
                          className="form-control" 
                          placeholder="Liste os remédios que toma regularmente..."
                          value={formData.medications} 
                          onChange={e => setFormData(prev => ({ ...prev, medications: e.target.value }))}
                          style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Alergias Conhecidas</label>
                        <textarea 
                          rows="2" 
                          className="form-control" 
                          placeholder="Ex: Alergia a Neomicina, Látex, Iodo, etc."
                          value={formData.allergies} 
                          onChange={e => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
                          style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Outras Condições de Saúde relevantes</label>
                        <textarea 
                          rows="2" 
                          className="form-control" 
                          placeholder="Outros diagnósticos importantes..."
                          value={formData.otherConditions} 
                          onChange={e => setFormData(prev => ({ ...prev, otherConditions: e.target.value }))}
                          style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                    </div>

                  </div>
                )}
              </>
            )}

          </div>

          {/* Footer */}
          <div className="profile-modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={saving}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving || uploading}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>

        <style>{`
          .profile-modal-backdrop {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1100;
            animation: backdropFadeIn 0.25s ease-out forwards;
          }
          .profile-modal-container {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            width: 95%;
            max-width: 720px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-lg);
            overflow: hidden;
            animation: modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .profile-modal-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .profile-modal-content {
            padding: 20px 24px;
            overflow-y: auto;
            max-height: 60vh;
          }
          .profile-modal-footer {
            padding: 12px 24px;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: var(--bg-primary);
          }
          .avatar-edit-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
            position: relative;
          }
          .avatar-circle {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            border: 3px solid var(--primary);
            box-shadow: var(--shadow-md);
            transition: var(--transition-smooth);
            background-color: var(--primary);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: 800;
            font-family: var(--font-display);
          }
          .avatar-circle:hover {
            transform: scale(1.03);
            box-shadow: var(--shadow-lg), var(--shadow-glow);
          }
          .avatar-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
            padding: 4px;
          }
          .avatar-circle:hover .avatar-overlay {
            opacity: 1;
          }
          .profile-tabs {
            display: flex;
            gap: 4px;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 16px;
            overflow-x: auto;
            padding-bottom: 4px;
          }
          .profile-tab-btn {
            background: none;
            border: none;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-secondary);
            cursor: pointer;
            border-radius: var(--radius-sm);
            transition: var(--transition-fast);
            white-space: nowrap;
          }
          .profile-tab-btn:hover {
            background: var(--bg-primary);
            color: var(--text-primary);
          }
          .profile-tab-btn.active {
            background: var(--primary-glow);
            color: var(--primary);
          }
          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }
          @media (max-width: 600px) {
            .form-grid {
              grid-template-columns: 1fr;
            }
          }
          .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .form-group label {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .form-control {
            padding: 8px 12px;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-color);
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 13px;
            transition: var(--transition-fast);
          }
          .form-control:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 2px var(--primary-glow);
          }
          .form-control:disabled {
            background: var(--bg-primary);
            color: var(--text-muted);
            cursor: not-allowed;
          }

          @keyframes modalScaleUp {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes backdropFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
