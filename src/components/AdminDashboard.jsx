import React, { useState, useEffect } from 'react';
import { getAdminStats, getAllProfiles, getAuditLogs, getRecommendedMaterials, addRecommendedMaterial, deleteRecommendedMaterial, getAdminTelemedicineCalls, getAdminAssignments, getAdminWoundEntries, updateVerificationStatus } from '../services/supabaseService';
import AdminReports from './AdminReports';
import DateRangePicker from './DateRangePicker';

export default function AdminDashboard({ activeTab: propActiveTab, setActiveTab, onVerificationProcessed }) {
  const activeTab = propActiveTab === 'dashboard' ? 'metrics' : propActiveTab;
  const [stats, setStats] = useState({ patients: 0, doctors: 0, nurses: 0, triages: 0, partners: 0, calls: 0 });
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [partners, setPartners] = useState([]);
  const [calls, setCalls] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [woundEntries, setWoundEntries] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [timePeriod, setTimePeriod] = useState('30d'); // '24h', '7d', '30d', 'all'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pathologySearch, setPathologySearch] = useState('');
  const [showAllPathologies, setShowAllPathologies] = useState(false);
  const [selectedState, setSelectedState] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [pathologySortOrder, setPathologySortOrder] = useState('desc'); // 'desc', 'asc', 'alpha'

  // Modals / forms state for iRec Partners
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [submittingPartner, setSubmittingPartner] = useState(false);
  const [partName, setPartName] = useState('');
  const [partBrand, setPartBrand] = useState('');
  const [partPrice, setPartPrice] = useState('');
  const [partLink, setPartLink] = useState('');
  const [partPharmacy, setPartPharmacy] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, logsData, partnersData, callsData, assignmentsData, woundEntriesData] = await Promise.all([
        getAdminStats(),
        getAllProfiles(),
        getAuditLogs(),
        getRecommendedMaterials(null, null), // Fetch global platform-wide partners
        getAdminTelemedicineCalls(),
        getAdminAssignments(),
        getAdminWoundEntries()
      ]);
      
      setStats(statsData);
      setUsers(usersData);
      setLogs(logsData);
      setPartners(partnersData.filter(p => p.type === 'irec_partner'));
      setCalls(callsData);
      setAssignments(assignmentsData);
      setWoundEntries(woundEntriesData);
    } catch (e) {
      console.error("Erro ao carregar dados do admin:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPartner = async (e) => {
    e.preventDefault();
    if (!partName || !partLink || !partPharmacy) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmittingPartner(true);
    try {
      const payload = {
        name: partName,
        brand: partBrand || 'Genérico/Outros',
        price: partPrice || 'A consultar',
        affiliate_link: partLink,
        pharmacy_name: partPharmacy,
        type: 'irec_partner',
        doctor_id: null,
        patient_id: null
      };

      await addRecommendedMaterial(payload);
      
      // Reset form
      setPartName('');
      setPartBrand('');
      setPartPrice('');
      setPartLink('');
      setPartPharmacy('');
      setShowPartnerModal(false);

      await loadData();
      alert('Parceiro iRec cadastrado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar parceiro iRec.');
    } finally {
      setSubmittingPartner(false);
    }
  };

  const handleDeletePartner = async (id) => {
    if (!window.confirm('Deseja excluir esta parceria iRec?')) return;
    try {
      await deleteRecommendedMaterial(id);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir parceria.');
    }
  };

  const pendingClinicians = users.filter(u => u.role === 'doctor' && u.verificationStatus === 'pending');

  // Exclude system admin from directories
  const filteredUsers = users.filter(u => {
    if (u.email === 'admin@irec.com') return false;
    
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.crm?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Period filtering logic
  const getFilteredDataByPeriod = () => {
    const now = new Date();
    let thresholdDate = new Date();
    
    if (timePeriod === '24h') {
      thresholdDate.setHours(now.getHours() - 24);
      const callsFiltered = calls.filter(c => new Date(c.created_at || c.createdAt) >= thresholdDate);
      const logsFiltered = logs.filter(l => new Date(l.created_at) >= thresholdDate);
      const woundEntriesFiltered = woundEntries.filter(w => new Date(w.created_at) >= thresholdDate);
      return { callsFiltered, logsFiltered, woundEntriesFiltered };
    } else if (timePeriod === '7d') {
      thresholdDate.setDate(now.getDate() - 7);
      const callsFiltered = calls.filter(c => new Date(c.created_at || c.createdAt) >= thresholdDate);
      const logsFiltered = logs.filter(l => new Date(l.created_at) >= thresholdDate);
      const woundEntriesFiltered = woundEntries.filter(w => new Date(w.created_at) >= thresholdDate);
      return { callsFiltered, logsFiltered, woundEntriesFiltered };
    } else if (timePeriod === '30d') {
      thresholdDate.setDate(now.getDate() - 30);
      const callsFiltered = calls.filter(c => new Date(c.created_at || c.createdAt) >= thresholdDate);
      const logsFiltered = logs.filter(l => new Date(l.created_at) >= thresholdDate);
      const woundEntriesFiltered = woundEntries.filter(w => new Date(w.created_at) >= thresholdDate);
      return { callsFiltered, logsFiltered, woundEntriesFiltered };
    } else if (timePeriod === 'custom') {
      const callsFiltered = calls.filter(c => {
        const callDate = new Date(c.created_at || c.createdAt);
        if (startDate && new Date(startDate) > callDate) return false;
        if (endDate) {
          const endLimit = new Date(endDate);
          endLimit.setHours(23, 59, 59, 999);
          if (callDate > endLimit) return false;
        }
        return true;
      });
      const logsFiltered = logs.filter(l => {
        const logDate = new Date(l.created_at);
        if (startDate && new Date(startDate) > logDate) return false;
        if (endDate) {
          const endLimit = new Date(endDate);
          endLimit.setHours(23, 59, 59, 999);
          if (logDate > endLimit) return false;
        }
        return true;
      });
      const woundEntriesFiltered = woundEntries.filter(w => {
        const entryDate = new Date(w.created_at);
        if (startDate && new Date(startDate) > entryDate) return false;
        if (endDate) {
          const endLimit = new Date(endDate);
          endLimit.setHours(23, 59, 59, 999);
          if (entryDate > endLimit) return false;
        }
        return true;
      });
      return { callsFiltered, logsFiltered, woundEntriesFiltered };
    } else {
      return { callsFiltered: calls, logsFiltered: logs, woundEntriesFiltered: woundEntries };
    }
  };

  const { callsFiltered, logsFiltered, woundEntriesFiltered } = getFilteredDataByPeriod();

  // User counters
  const totalClinicalUsers = users.filter(u => u.email !== 'admin@irec.com');
  const countPatients = totalClinicalUsers.filter(u => u.role === 'patient').length;
  const countDoctors = totalClinicalUsers.filter(u => u.role === 'doctor').length;
  const countNurses = totalClinicalUsers.filter(u => u.role === 'nurse').length;

  // Active / Online Users (last_seen within 15 minutes)
  const getActiveUsersStats = () => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const onlineUsers = totalClinicalUsers.filter(u => {
      if (!u.last_seen && !u.lastSeen) return false;
      const lastSeenDate = new Date(u.last_seen || u.lastSeen);
      return lastSeenDate >= fifteenMinsAgo;
    });

    return {
      onlineCount: onlineUsers.length,
      offlineCount: totalClinicalUsers.length - onlineUsers.length,
      onlinePatients: onlineUsers.filter(u => u.role === 'patient').length,
      onlineDoctors: onlineUsers.filter(u => u.role === 'doctor').length,
      onlineNurses: onlineUsers.filter(u => u.role === 'nurse').length,
    };
  };

  const activeUserStats = getActiveUsersStats();

  // Telemedicine details
  const activeCalls = callsFiltered.filter(c => c.status === 'active' || c.status === 'ringing');
  const completedCalls = callsFiltered.filter(c => c.status === 'completed');
  const totalDuration = completedCalls.reduce((acc, c) => acc + (c.duration_seconds || c.duration || 0), 0);
  const avgDurationMinutes = completedCalls.length > 0 ? ((totalDuration / completedCalls.length) / 60).toFixed(1) : '0';

  // Professional workloads breakdown
  const getProfessionalWorkloads = () => {
    const clinicians = totalClinicalUsers.filter(u => u.role === 'doctor' || u.role === 'nurse');
    
    return clinicians.map(cli => {
      const activeAssignments = assignments.filter(a => a.doctor_id === cli.id).length;
      const totalCalls = callsFiltered.filter(c => c.caller_id === cli.id || c.receiver_id === cli.id).length;
      const isOnline = activeUserStats.onlineCount > 0 && totalClinicalUsers.find(u => u.id === cli.id && (new Date(u.last_seen || u.lastSeen) >= new Date(Date.now() - 15 * 60 * 1000)));
      
      return {
        id: cli.id,
        name: cli.name,
        role: cli.role,
        specialty: cli.specialty || 'Clínico',
        crm: cli.crm || 'N/A',
        assignmentsCount: activeAssignments,
        callsCount: totalCalls,
        status: isOnline ? 'online' : 'offline'
      };
    }).sort((a, b) => b.assignmentsCount - a.assignmentsCount);
  };

  const workloads = getProfessionalWorkloads();

  const getWoundDistribution = () => {
    const totalCount = woundEntriesFiltered.length;
    if (totalCount === 0) {
      return {
        diabetic: { count: 0, pct: 0 },
        venous: { count: 0, pct: 0 },
        pressure: { count: 0, pct: 0 },
        others: { count: 0, pct: 0 },
        total: 0
      };
    }

    const diabeticCount = woundEntriesFiltered.filter(w => w.type === 'Pé Diabético').length;
    const venousCount = woundEntriesFiltered.filter(w => w.type === 'Úlcera Venosa').length;
    const pressureCount = woundEntriesFiltered.filter(w => w.type === 'Lesão por Pressão').length;
    const othersCount = totalCount - (diabeticCount + venousCount + pressureCount);

    return {
      diabetic: { count: diabeticCount, pct: Math.round((diabeticCount / totalCount) * 100) },
      venous: { count: venousCount, pct: Math.round((venousCount / totalCount) * 100) },
      pressure: { count: pressureCount, pct: Math.round((pressureCount / totalCount) * 100) },
      others: { count: othersCount, pct: Math.round((othersCount / totalCount) * 100) },
      total: totalCount
    };
  };

  const woundDist = getWoundDistribution();

  // Extract unique states and cities for filter selectors
  const getUniqueStatesAndCities = () => {
    const patients = users.filter(u => u.role === 'patient');
    const statesSet = new Set();
    const citiesSet = new Set();

    patients.forEach(u => {
      if (u.state) statesSet.add(u.state.trim().toUpperCase());
      if (u.city) {
        citiesSet.add(JSON.stringify({
          name: u.city.trim(),
          state: u.state ? u.state.trim().toUpperCase() : ''
        }));
      }
    });

    const parsedCities = Array.from(citiesSet).map(c => JSON.parse(c));

    return {
      statesList: Array.from(statesSet).sort(),
      citiesList: parsedCities.sort((a, b) => a.name.localeCompare(b.name))
    };
  };

  const { statesList, citiesList } = getUniqueStatesAndCities();

  const getDynamicPathologiesStats = () => {
    let patients = users.filter(u => u.role === 'patient');

    // Filter by selected State
    if (selectedState !== 'all') {
      patients = patients.filter(u => u.state && u.state.trim().toUpperCase() === selectedState);
    }

    // Filter by selected City
    if (selectedCity !== 'all') {
      patients = patients.filter(u => u.city && u.city.trim().toLowerCase() === selectedCity.toLowerCase());
    }

    const pathologyCounts = {};

    patients.forEach(u => {
      // 1. Check structured boolean fields
      if (u.has_diabetes || u.hasDiabetes) {
        pathologyCounts['Diabetes Mellitus'] = (pathologyCounts['Diabetes Mellitus'] || 0) + 1;
      }
      if (u.has_hypertension || u.hasHypertension) {
        pathologyCounts['Hipertensão Arterial'] = (pathologyCounts['Hipertensão Arterial'] || 0) + 1;
      }
      if (u.has_venous_insufficiency || u.hasVenousInsufficiency) {
        pathologyCounts['Insuficiência Venosa'] = (pathologyCounts['Insuficiência Venosa'] || 0) + 1;
      }
      if (u.has_peripheral_arterial_disease || u.hasPeripheralArterialDisease) {
        pathologyCounts['Doença Arterial Periférica'] = (pathologyCounts['Doença Arterial Periférica'] || 0) + 1;
      }
      if (u.is_obese || u.isObese) {
        pathologyCounts['Obesidade'] = (pathologyCounts['Obesidade'] || 0) + 1;
      }
      if (u.is_smoker || u.isSmoker) {
        pathologyCounts['Tabagismo'] = (pathologyCounts['Tabagismo'] || 0) + 1;
      }

      // 2. Parse unstructured text fields
      const otherCond = u.other_conditions || u.otherConditions;
      if (otherCond && typeof otherCond === 'string' && otherCond.trim().length > 0) {
        // Tokenize by commas or semicolons, but only if they are outside parentheses
        const items = [];
        let currentItem = '';
        let parenDepth = 0;
        
        for (let i = 0; i < otherCond.length; i++) {
          const char = otherCond[i];
          if (char === '(') parenDepth++;
          if (char === ')') parenDepth--;
          
          if ((char === ',' || char === ';') && parenDepth === 0) {
            items.push(currentItem);
            currentItem = '';
          } else {
            currentItem += char;
          }
        }
        if (currentItem) {
          items.push(currentItem);
        }

        items.forEach(item => {
          const cleanItem = item.trim().replace(/[.]/g, '');
          if (cleanItem.length > 2) {
            // Capitalize the first letter, leaving the rest intact to preserve internal casing/parentheses
            const formatted = cleanItem.charAt(0).toUpperCase() + cleanItem.slice(1);
            pathologyCounts[formatted] = (pathologyCounts[formatted] || 0) + 1;
          }
        });
      }
    });

    let mappedPathologies = Object.entries(pathologyCounts)
      .map(([name, count]) => {
        const pct = patients.length > 0 ? Math.round((count / patients.length) * 100) : 0;
        return { name, count, pct };
      });

    // Apply sorting
    if (pathologySortOrder === 'desc') {
      mappedPathologies.sort((a, b) => b.count - a.count);
    } else if (pathologySortOrder === 'asc') {
      mappedPathologies.sort((a, b) => a.count - b.count);
    } else if (pathologySortOrder === 'alpha') {
      mappedPathologies.sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      list: mappedPathologies,
      totalPatients: patients.length
    };
  };

  const pathologyStats = getDynamicPathologiesStats();

  // Audit Logs Statistics
  const getAuditActionStats = () => {
    const actionCounts = {};
    logsFiltered.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    return Object.entries(actionCounts).map(([action, val]) => ({ action, count: val })).sort((a, b) => b.count - a.count);
  };
  const auditActionStats = getAuditActionStats();

  const getRoleLabel = (role) => {
    switch (role) {
      case 'doctor': return { text: 'Médico', bg: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' };
      case 'nurse': return { text: 'Enfermeiro', bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-light)' };
      case 'patient': return { text: 'Paciente', bg: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-secondary)' };
      default: return { text: role, bg: 'rgba(0,0,0,0.05)', color: 'black' };
    }
  };

  const formatLogAction = (action) => {
    if (!action) return 'AÇÃO DESCONHECIDA';
    return action.toString().replace(/_/g, ' ');
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-primary)', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛡️ Dashboard Administrativo iRec
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Visão Geral e métricas clínicas detalhadas do iRec para gerenciamento de conformidade e faturamento.
          </p>
        </div>

        {/* Time period filter (DateRangePicker) */}
        <DateRangePicker 
          timePeriod={timePeriod}
          setTimePeriod={setTimePeriod}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      </header>



      {/* Tab Contents */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '14px' }}>Carregando dados...</div>
        </div>
      ) : activeTab === 'metrics' ? (
        /* TAB 1: ADVANCED METRICS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top row summaries with trend badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '24px', margin: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>ATIVIDADE DA REDE (ONLINE)</span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success-light)', boxShadow: '0 0 8px var(--success-light)' }}></span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {activeUserStats.onlineCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'normal' }}> / {totalClinicalUsers.length} usuários</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '8px' }}>
                Médicos: {activeUserStats.onlineDoctors} | Enfermeiros: {activeUserStats.onlineNurses} | Pacientes: {activeUserStats.onlinePatients}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px', margin: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>ATENDIMENTOS ATIVOS</span>
                <span style={{ fontSize: '18px' }}>📞</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {activeCalls.length} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'normal' }}>em andamento</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', marginTop: '8px' }}>
                Total de teleconsultas realizadas: {completedCalls.length}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px', margin: 0, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>TEMPO MÉDIO DE ATENDIMENTO</span>
                <span style={{ fontSize: '18px' }}>⏱️</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                {avgDurationMinutes} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal' }}>minutos</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '8px' }}>
                Cálculo com base em sessões finalizadas
              </div>
            </div>
          </div>

          {/* Advanced Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            
            {/* Visual Chart 1: Dynamic Pathology and Comorbidity Mapping */}
            <div className="glass-card" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🩺 Mapeamento Dinâmico de Patologias & Comorbidades
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>
                  Base: {pathologyStats.totalPatients} pacientes
                </span>
              </div>
              
              {/* Search Bar & Filters for scaling (100+ pathologies) */}
              {pathologyStats.list.length >= 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="🔍 Filtrar patologias/comorbidades..." 
                      value={pathologySearch}
                      onChange={(e) => setPathologySearch(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '6px 12px 6px 30px', 
                        fontSize: '12px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }} 
                    />
                    {pathologySearch && (
                      <button 
                        onClick={() => setPathologySearch('')}
                        style={{ 
                          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', 
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' 
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: '8px' }}>
                    {/* Estado Selector */}
                    <select
                      value={selectedState}
                      onChange={(e) => {
                        setSelectedState(e.target.value);
                        setSelectedCity('all'); // Reset city on state change
                      }}
                      style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      <option value="all">Estado: Todos</option>
                      {statesList.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>

                    {/* Cidade Selector */}
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      <option value="all">Cidade: Todas</option>
                      {citiesList
                        .filter(c => selectedState === 'all' || c.state === selectedState)
                        .map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    {/* Ordenação Selector */}
                    <select
                      value={pathologySortOrder}
                      onChange={(e) => setPathologySortOrder(e.target.value)}
                      style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      <option value="desc">Mais Casos</option>
                      <option value="asc">Menos Casos</option>
                      <option value="alpha">Ordem: A-Z</option>
                    </select>
                  </div>
                </div>
              )}

              {pathologyStats.list.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  Nenhuma patologia identificada nos prontuários dos pacientes cadastrados.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '280px', paddingRight: '4px' }}>
                    {(() => {
                      const filtered = pathologyStats.list.filter(item => 
                        item.name.toLowerCase().includes(pathologySearch.toLowerCase())
                      );
                      const displayLimit = 6;
                      const listToRender = showAllPathologies ? filtered : filtered.slice(0, displayLimit);
                      
                      if (listToRender.length === 0) {
                        return <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>Nenhuma patologia correspondente.</p>;
                      }
                      
                      return listToRender.map((item) => (
                        <div key={item.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontWeight: '800' }}>{item.pct}% ({item.count})</span>
                          </div>
                          <div style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${item.pct}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Expand button for scaling */}
                  {(() => {
                    const filtered = pathologyStats.list.filter(item => 
                      item.name.toLowerCase().includes(pathologySearch.toLowerCase())
                    );
                    if (filtered.length > 6) {
                      return (
                        <button
                          onClick={() => setShowAllPathologies(!showAllPathologies)}
                          style={{
                            border: 'none', backgroundColor: 'transparent', color: 'var(--primary)',
                            fontSize: '11px', fontWeight: '800', cursor: 'pointer', textAlign: 'center',
                            marginTop: '4px', padding: '4px 0', width: '100%', textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          {showAllPathologies ? '▲ Mostrar Menos' : `▼ Mostrar Todas (${filtered.length})`}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </div>

            {/* Visual Chart 2: Wound classification and Donut */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Wound classification */}
              <div className="glass-card" style={{ padding: '20px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', margin: 0 }}>📋 Classificação de Feridas sob Acompanhamento</h4>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>Total: {woundDist.total}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ fontSize: '11.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pé Diabético:</span> <strong>{woundDist.diabetic.count} ({woundDist.diabetic.pct}%)</strong>
                  </div>
                  <div style={{ fontSize: '11.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Úlcera Venosa:</span> <strong>{woundDist.venous.count} ({woundDist.venous.pct}%)</strong>
                  </div>
                  <div style={{ fontSize: '11.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>LPP:</span> <strong>{woundDist.pressure.count} ({woundDist.pressure.pct}%)</strong>
                  </div>
                  <div style={{ fontSize: '11.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Outras:</span> <strong>{woundDist.others.count} ({woundDist.others.pct}%)</strong>
                  </div>
                </div>
              </div>

              {/* User roles distribution donut */}
              <div className="glass-card" style={{ padding: '20px', margin: 0, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  🍩 Distribuição da Rede Clínica
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                  {/* SVG Donut */}
                  <svg width="80" height="80" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-color)" strokeWidth="3" />
                    
                    <circle 
                      cx="18" cy="18" r="15.915" fill="none" 
                      stroke="var(--primary)" strokeWidth="3.2" 
                      strokeDasharray={`${totalClinicalUsers.length > 0 ? (countDoctors / totalClinicalUsers.length) * 100 : 0} ${100 - (totalClinicalUsers.length > 0 ? (countDoctors / totalClinicalUsers.length) * 100 : 0)}`}
                      strokeDashoffset="0" 
                    />
                    
                    <circle 
                      cx="18" cy="18" r="15.915" fill="none" 
                      stroke="var(--success-light)" strokeWidth="3.2" 
                      strokeDasharray={`${totalClinicalUsers.length > 0 ? (countNurses / totalClinicalUsers.length) * 100 : 0} ${100 - (totalClinicalUsers.length > 0 ? (countNurses / totalClinicalUsers.length) * 100 : 0)}`}
                      strokeDashoffset={`-${totalClinicalUsers.length > 0 ? (countDoctors / totalClinicalUsers.length) * 100 : 0}`} 
                    />

                    <circle 
                      cx="18" cy="18" r="15.915" fill="none" 
                      stroke="var(--accent)" strokeWidth="3.2" 
                      strokeDasharray={`${totalClinicalUsers.length > 0 ? (countPatients / totalClinicalUsers.length) * 100 : 0} ${100 - (totalClinicalUsers.length > 0 ? (countPatients / totalClinicalUsers.length) * 100 : 0)}`}
                      strokeDashoffset={`-${totalClinicalUsers.length > 0 ? ((countDoctors + countNurses) / totalClinicalUsers.length) * 100 : 0}`} 
                    />
                  </svg>

                  {/* Legend list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Médicos:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{countDoctors}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success-light)' }}></span>
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Enfermeiros:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{countNurses}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }}></span>
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Pacientes:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{countPatients}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table: Professional Workloads and Consultation Logs */}
          <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              📊 Relatório de Atendimentos por Profissional de Saúde
            </h3>

            {workloads.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>
                Nenhum profissional de saúde cadastrado no sistema para gerar estatísticas.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                      <th style={{ padding: '10px 8px' }}>NOME DO PROFISSIONAL</th>
                      <th style={{ padding: '10px 8px' }}>PAPEL</th>
                      <th style={{ padding: '10px 8px' }}>ESPECIALIDADE / CRM</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>PACIENTES VINCULADOS</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>TELECONSULTAS</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workloads.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', hover: { background: 'var(--bg-primary)' } }}>
                        <td style={{ padding: '12px 8px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.name}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: item.role === 'doctor' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', color: item.role === 'doctor' ? 'var(--primary)' : 'var(--success-light)' }}>
                            {item.role === 'doctor' ? 'MÉDICO' : 'ENFERMEIRO'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          {item.specialty} • {item.crm}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '800' }}>
                          {item.assignmentsCount}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '800' }}>
                          {item.callsCount}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: item.status === 'online' ? 'var(--success-light)' : 'var(--text-muted)'
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'reports' ? (
        <AdminReports 
          users={users}
          callsFiltered={callsFiltered}
          logsFiltered={logsFiltered}
          woundEntriesFiltered={woundEntriesFiltered}
          partners={partners}
          assignments={assignments}
        />
      ) : activeTab === 'users' ? (
        /* TAB 2: USER DIRECTORY */
        <div>
          {/* Counters Banner */}
          <div style={{
            padding: '12px 18px',
            backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
            border: '1.5px solid rgba(var(--primary-rgb), 0.15)',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: '700',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            👥 Totalizando {filteredUsers.length} usuários cadastrados: 
            <span style={{ color: 'var(--text-secondary)' }}>{filteredUsers.filter(u => u.role === 'patient').length} Pacientes</span> | 
            <span style={{ color: 'var(--primary)' }}>{filteredUsers.filter(u => u.role === 'doctor').length} Médicos</span> | 
            <span style={{ color: 'var(--success-light)' }}>{filteredUsers.filter(u => u.role === 'nurse').length} Enfermeiros</span>
          </div>

          {/* Filters and search */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Buscar por nome, e-mail ou CRM..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, height: '38px' }}
            />
            
            <select 
              className="form-control" 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: '180px', height: '38px', cursor: 'pointer' }}
            >
              <option value="all">Todos os Papéis</option>
              <option value="patient">Pacientes</option>
              <option value="doctor">Médicos</option>
              <option value="nurse">Enfermeiros</option>
            </select>
          </div>

          {filteredUsers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Nenhum usuário cadastrado.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredUsers.map((item) => {
                const label = getRoleLabel(item.role);
                return (
                  <div key={item.id} className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', borderColor: 'var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '14.5px', fontWeight: '750', margin: 0, color: 'var(--text-primary)' }}>{item.name}</h4>
                      <span style={{ fontSize: '9px', fontWeight: '800', padding: '3px 6px', borderRadius: '4px', backgroundColor: label.bg, color: label.color }}>
                        {label.text.toUpperCase()}
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>✉️ {item.email}</div>
                      {item.role !== 'patient' && item.crm && (
                        <div>🩺 Registro Profissional: <strong>{item.crm}</strong></div>
                      )}
                      {item.specialty && (
                        <div>🏥 Especialidade: <strong>{item.specialty}</strong></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'partners' ? (
        /* TAB 3: PLATFORM PARTNERS MANAGEMENT */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '750', margin: 0 }}>Parcerias Globais iRec ({partners.length})</h3>
            <button 
              className="btn btn-primary"
              onClick={() => setShowPartnerModal(true)}
              style={{ height: '34px', fontSize: '12px', fontWeight: '700' }}
            >
              ➕ Cadastrar Parceiro iRec
            </button>
          </div>

          {partners.length === 0 ? (
            <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <span>🤝</span>
              <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>Nenhuma Parceria Comercial iRec Cadastrada</h4>
              <p style={{ fontSize: '12px', margin: 0 }}>Cadastre redes e farmácias parceiras para rentabilizar as sugestões de curativos do aplicativo.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {partners.map((item) => (
                <div key={item.id} className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '150px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '14.5px', fontWeight: '750', margin: 0 }}>{item.name}</h4>
                      <span style={{ fontSize: '9px', fontWeight: '800', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(20, 184, 166, 0.1)', color: 'var(--accent)' }}>IREC PARTNER</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      <div>Marca recomendada: <strong>{item.brand}</strong></div>
                      <div>Preço: <strong>{item.price}</strong></div>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '4px' }}>
                        🔗 Link Afiliado: <a href={item.affiliate_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{item.affiliate_link}</a>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '10px' }}>
                    <button 
                      onClick={() => handleDeletePartner(item.id)}
                      className="btn"
                      style={{
                        padding: '4px 10px', height: '28px', fontSize: '11px',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)',
                        border: '1px solid rgba(239, 68, 68, 0.15)'
                      }}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'logs' ? (
        /* TAB 4: COMPLIANCE AUDIT LOGS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Action ranking chart */}
          <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: '850', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              📊 Ranking de Atividades Frequentes no Sistema
            </h3>
            
            {auditActionStats.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhuma ação registrada neste período.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {auditActionStats.map(({ action, count }) => (
                  <div key={action}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '750' }}>{formatLogAction(action)}</span>
                      <span>{count} ocorrências</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }}>
                      <div style={{ width: `${(count / logsFiltered.length) * 100}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: '750', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Logs de Auditoria do Sistema (Últimos 100 Registros)
            </h3>
            
            {logsFiltered.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nenhum log de auditoria registrado no banco de dados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                {logsFiltered.map((log) => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', background: 'var(--bg-primary)' }}>
                    <div>
                      <span style={{ fontWeight: '800', color: 'var(--primary)', marginRight: '8px' }}>
                        [{formatLogAction(log.action)}]
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        ID do Usuário: {log.user_id}
                      </span>
                      <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {log.details ? JSON.stringify(log.details) : 'Nenhum detalhe'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* POPUP MODAL: ADD PARTNER */}
      {showPartnerModal && (
        <div className="partners-modal-overlay">
          <div className="partners-modal-container">
            <div className="partners-modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                🤝 Cadastrar Parceiro iRec (Monetização Global)
              </h3>
              <button 
                onClick={() => setShowPartnerModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPartner}>
              <div className="partners-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label>Nome do Estabelecimento / Insumo *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Drogasil Online ou Curativo de Alginato"
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Marca / Laboratório</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: Curatec"
                      value={partBrand}
                      onChange={(e) => setPartBrand(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Preço Sugerido</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: R$ 52,00"
                      value={partPrice}
                      onChange={(e) => setPartPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Rede de Farmácias Parceira *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Drogasil S/A"
                    value={partPharmacy}
                    onChange={(e) => setPartPharmacy(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Link de Afiliado Global do iRec *</label>
                  <input 
                    type="url" 
                    className="form-control"
                    placeholder="Ex: https://afiliado.farmacia.com/codigo-do-irec"
                    value={partLink}
                    onChange={(e) => setPartLink(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="partners-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPartnerModal(false)}
                  style={{ height: '36px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submittingPartner}
                  style={{ height: '36px', fontWeight: '700' }}
                >
                  {submittingPartner ? 'Cadastrando...' : 'Cadastrar Parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled block matching iRec theme */}
      <style>{`
        .partners-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: backdropFadeIn 0.25s ease-out forwards;
        }
        .partners-modal-container {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          width: 95%;
          max-width: 520px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .partners-modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .partners-modal-content {
          padding: 20px 24px;
          overflow-y: auto;
          max-height: 65vh;
        }
        .partners-modal-footer {
          padding: 12px 24px;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: var(--bg-primary);
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
  );
}
