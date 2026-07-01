import React, { useState, useEffect } from 'react';
import { getAdminStats, getAllProfiles, getAuditLogs, getRecommendedMaterials, addRecommendedMaterial, deleteRecommendedMaterial } from '../services/supabaseService';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics', 'users', 'partners', 'logs'
  const [stats, setStats] = useState({ patients: 0, doctors: 0, nurses: 0, triages: 0, partners: 0, calls: 0 });
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [partners, setPartners] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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
      const [statsData, usersData, logsData, partnersData] = await Promise.all([
        getAdminStats(),
        getAllProfiles(),
        getAuditLogs(),
        getRecommendedMaterials(null, null) // Fetch global platform-wide partners
      ]);
      
      setStats(statsData);
      setUsers(usersData);
      setLogs(logsData);
      setPartners(partnersData.filter(p => p.type === 'irec_partner'));
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

  // User list filter
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.crm?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleLabel = (role) => {
    switch (role) {
      case 'doctor': return { text: 'Médico', bg: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' };
      case 'nurse': return { text: 'Enfermeiro', bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-light)' };
      case 'patient': return { text: 'Paciente', bg: 'rgba(107, 114, 128, 0.1)', color: 'var(--text-secondary)' };
      default: return { text: role, bg: 'rgba(0,0,0,0.05)', color: 'black' };
    }
  };

  const formatLogAction = (action) => {
    return action.replace(/_/g, ' ');
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-primary)', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header */}
      <header style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🛡️ Dashboard Administrativo iRec
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Painel central de gestão da plataforma. Monitore usuários, audite ações clínicas e gerencie parcerias de capturas de lucros.
        </p>
      </header>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
          <span style={{ fontSize: '20px' }}>👥</span>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.patients}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PACIENTES CADASTRADOS</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'rgba(16, 185, 129, 0.15)' }}>
          <span style={{ fontSize: '20px' }}>🩺</span>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.doctors}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>MÉDICOS ATIVOS</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'rgba(245, 158, 11, 0.15)' }}>
          <span style={{ fontSize: '20px' }}>🏥</span>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.nurses}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ENFERMEIROS ATIVOS</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'rgba(139, 92, 246, 0.15)' }}>
          <span style={{ fontSize: '20px' }}>📸</span>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.triages}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TRIAGENS REALIZADAS</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'rgba(236, 72, 153, 0.15)' }}>
          <span style={{ fontSize: '20px' }}>📞</span>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.calls}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CHAMADAS DE VÍDEO</div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px', borderColor: 'rgba(20, 184, 166, 0.15)' }}>
          <span style={{ fontSize: '20px' }}>🤝</span>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.partners}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PARCEIROS IREC</div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1.5px solid var(--border-color)', marginBottom: '24px', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('metrics')}
          style={{
            padding: '12px 4px', fontSize: '14.5px', fontWeight: '700',
            color: activeTab === 'metrics' ? 'var(--primary)' : 'var(--text-muted)',
            border: 'none', backgroundColor: 'transparent',
            borderBottom: activeTab === 'metrics' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: '-2px'
          }}
        >
          📊 Visão Geral & Métricas
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 4px', fontSize: '14.5px', fontWeight: '700',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
            border: 'none', backgroundColor: 'transparent',
            borderBottom: activeTab === 'users' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: '-2px'
          }}
        >
          👥 Usuários Cadastrados
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          style={{
            padding: '12px 4px', fontSize: '14.5px', fontWeight: '700',
            color: activeTab === 'partners' ? 'var(--primary)' : 'var(--text-muted)',
            border: 'none', backgroundColor: 'transparent',
            borderBottom: activeTab === 'partners' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: '-2px'
          }}
        >
          🤝 Parceiros iRec
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '12px 4px', fontSize: '14.5px', fontWeight: '700',
            color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text-muted)',
            border: 'none', backgroundColor: 'transparent',
            borderBottom: activeTab === 'logs' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: '-2px'
          }}
        >
          📋 Auditoria / Logs
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '14px' }}>Carregando dados...</div>
        </div>
      ) : activeTab === 'metrics' ? (
        /* TAB 1: METRICS */
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Relatório de Engajamento da Ferramenta
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Média de Triagens por Paciente</span>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  {stats.patients > 0 ? (stats.triages / stats.patients).toFixed(1) : 0}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Proporção Médico / Paciente</span>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  1 médico para {stats.doctors > 0 ? (stats.patients / stats.doctors).toFixed(1) : 0} pacientes
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total de Chamadas de Telemedicina</span>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{stats.calls} chamadas</strong>
              </div>
            </div>

            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--primary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                💡 Insight Administrativo
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                O engajamento de triagens demonstra alta aderência do paciente ao autocuidado. É recomendável expandir parcerias comerciais iRec na aba "Parceiros iRec" para aproveitar o fluxo e converter compras de coberturas em margens de faturamento para a plataforma.
              </p>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Distribuição de Profissionais
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                  <span>Médicos Clínicos/Especialistas</span>
                  <span>{stats.doctors}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(stats.doctors / (stats.doctors + stats.nurses || 1)) * 100}%`, height: '100%', backgroundColor: 'var(--primary)' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                  <span>Enfermeiros / Estomaterapeutas</span>
                  <span>{stats.nurses}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(stats.nurses / (stats.doctors + stats.nurses || 1)) * 100}%`, height: '100%', backgroundColor: 'var(--success-light)' }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : activeTab === 'users' ? (
        /* TAB 2: USER DIRECTORY */
        <div>
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
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Nenhum usuário encontrado com os filtros atuais.</p>
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
                    
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      <div>✉️ {item.email}</div>
                      {item.role !== 'patient' && item.crm && (
                        <div style={{ marginTop: '4px' }}>🩺 Registro Profissional: <strong>{item.crm}</strong></div>
                      )}
                      {item.specialty && (
                        <div style={{ marginTop: '2px' }}>🏥 Especialidade: <strong>{item.specialty}</strong></div>
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
      ) : (
        /* TAB 4: COMPLIANCE AUDIT LOGS */
        <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
          <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Logs de Auditoria do Sistema (Últimos 100 Registros)
          </h3>
          
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Nenhum log de auditoria registrado no banco de dados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
              {logs.map((log) => (
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
      )}

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
