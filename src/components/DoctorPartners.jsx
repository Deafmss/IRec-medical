import React, { useState, useEffect } from 'react';
import { getRecommendedMaterials, addRecommendedMaterial, deleteRecommendedMaterial } from '../services/supabaseService';

export default function DoctorPartners({ doctorProfile }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('pharmacies'); // 'pharmacies' or 'products'

  // Modals state
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states - Pharmacy
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyLink, setPharmacyLink] = useState('');

  // Form states - Product
  const [prodName, setProdName] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodLink, setProdLink] = useState('');
  const [prodPharmacyName, setProdPharmacyName] = useState('');

  const loadMaterials = async () => {
    if (!doctorProfile) return;
    setLoading(true);
    try {
      // Load all doctor's recommended materials (both general partners and specific products)
      const data = await getRecommendedMaterials(null, doctorProfile.id);
      setMaterials(data);
    } catch (e) {
      console.error('Erro ao buscar parcerias do médico:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [doctorProfile]);

  // Handlers
  const handleAddPharmacy = async (e) => {
    e.preventDefault();
    if (!pharmacyName || !pharmacyLink) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: pharmacyName,
        brand: 'Parceria de Vendas Geral',
        price: 'A consultar',
        affiliate_link: pharmacyLink,
        pharmacy_name: pharmacyName,
        type: 'doctor_general_partner',
        doctor_id: doctorProfile.id,
        patient_id: null
      };

      await addRecommendedMaterial(payload);
      
      // Reset
      setPharmacyName('');
      setPharmacyLink('');
      setShowPharmacyModal(false);
      
      await loadMaterials();
      alert('Farmácia parceira vinculada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar farmácia parceira.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!prodName || !prodLink || !prodPharmacyName) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: prodName,
        brand: prodBrand || 'Genérico/Outros',
        price: prodPrice || 'A consultar',
        affiliate_link: prodLink,
        pharmacy_name: prodPharmacyName,
        type: 'doctor_partner',
        doctor_id: doctorProfile.id,
        patient_id: null
      };

      await addRecommendedMaterial(payload);
      
      // Reset
      setProdName('');
      setProdBrand('');
      setProdPrice('');
      setProdLink('');
      setProdPharmacyName('');
      setShowProductModal(false);
      
      await loadMaterials();
      alert('Produto parceiro cadastrado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar produto parceiro.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta indicação parceira do seu catálogo?')) return;
    try {
      await deleteRecommendedMaterial(id);
      await loadMaterials();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir item do catálogo.');
    }
  };

  // Lists split
  const registeredPharmacies = materials.filter(m => m.type === 'doctor_general_partner');
  const registeredProducts = materials.filter(m => m.type === 'doctor_partner');

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-primary)', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Upper header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-primary)' }}>
            🏪 Central de Parcerias e Insumos Afiliados
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '780px', lineHeight: 1.5 }}>
            Monetize seu atendimento indicando seus próprios links de afiliados e redes parceiras. Os parceiros gerais aparecem como opção de compra em todos os insumos dos protocolos dos seus pacientes, enquanto os produtos específicos geram atalhos diretos.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', margin: 0, borderColor: 'rgba(var(--primary-rgb), 0.15)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center', fontSize: '22px', justifyContent: 'center' }}>
            🏪
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{registeredPharmacies.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Farmácias / Redes Parceiras Ativas</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', margin: 0, borderColor: 'rgba(var(--accent-rgb), 0.15)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center', fontSize: '22px', justifyContent: 'center' }}>
            📦
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{registeredProducts.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Insumos Específicos Recomendados</div>
          </div>
        </div>
      </div>

      {/* Tab Switcher and Add Button Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border-color)', marginBottom: '24px', paddingBottom: '2px' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          <button
            onClick={() => setActiveSubTab('pharmacies')}
            style={{
              padding: '12px 4px',
              fontSize: '14.5px',
              fontWeight: '700',
              color: activeSubTab === 'pharmacies' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeSubTab === 'pharmacies' ? '3px solid var(--primary)' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            🏪 Farmácias Parceiras Gerais
          </button>
          <button
            onClick={() => setActiveSubTab('products')}
            style={{
              padding: '12px 4px',
              fontSize: '14.5px',
              fontWeight: '700',
              color: activeSubTab === 'products' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeSubTab === 'products' ? '3px solid var(--primary)' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            📦 Insumos & Produtos Específicos
          </button>
        </div>

        {activeSubTab === 'pharmacies' ? (
          <button 
            className="btn btn-primary"
            onClick={() => setShowPharmacyModal(true)}
            style={{ height: '36px', fontSize: '12.5px', fontWeight: '700', gap: '6px' }}
          >
            ➕ Adicionar Farmácia Parceira
          </button>
        ) : (
          <button 
            className="btn btn-primary"
            onClick={() => setShowProductModal(true)}
            style={{ height: '36px', fontSize: '12.5px', fontWeight: '700', gap: '6px' }}
          >
            ➕ Adicionar Insumo Parceiro
          </button>
        )}
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '14px' }}>Carregando catálogo de parcerias...</div>
        </div>
      ) : activeSubTab === 'pharmacies' ? (
        // Tab 1: Pharmacies List
        registeredPharmacies.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>🏪</span>
            <h4 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Nenhuma Farmácia Geral Vinculada</h4>
            <p style={{ fontSize: '12.5px', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
              Vincule suas farmácias ou redes parceiras de preferência. Ao cadastrar apenas a farmácia e seu link geral de afiliado, ela aparecerá como opção de compra para todos os insumos nos cuidados dos seus pacientes.
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowPharmacyModal(true)}
              style={{ marginTop: '12px', fontSize: '12px' }}
            >
              Cadastrar Minha Primeira Farmácia
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {registeredPharmacies.map((item) => (
              <div key={item.id} className="glass-card" style={{ padding: '20px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px', borderColor: 'rgba(var(--primary-rgb), 0.15)', transition: 'transform 0.2s', hover: { transform: 'translateY(-2px)' } }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '15.5px', fontWeight: '750', margin: 0, color: 'var(--text-primary)' }}>{item.name}</h3>
                    <span style={{ fontSize: '9px', fontWeight: '800', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>GERAL</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🔗 Link: <a href={item.affiliate_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{item.affiliate_link}</a>
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="btn"
                    style={{
                      padding: '4px 10px',
                      height: '28px',
                      fontSize: '11px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    🗑️ Remover Parceria
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Tab 2: Products List
        registeredProducts.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>📦</span>
            <h4 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Nenhum Insumo Específico Recomendado</h4>
            <p style={{ fontSize: '12.5px', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
              Deseja indicar uma marca ou produto específico (como curativos tecnológicos de marcas que você possui parceria direta)? Cadastre-os aqui para criar indicações direcionadas.
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowProductModal(true)}
              style={{ marginTop: '12px', fontSize: '12px' }}
            >
              Recomendar Primeiro Produto
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {registeredProducts.map((item) => (
              <div key={item.id} className="glass-card" style={{ padding: '20px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '170px', borderColor: 'rgba(var(--accent-rgb), 0.15)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '15.5px', fontWeight: '750', margin: 0, color: 'var(--text-primary)' }}>{item.name}</h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>Marca: {item.brand} • Preço: {item.price}</span>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '800', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent)' }}>INSUMO</span>
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <div>🏪 Loja: <strong style={{ color: 'var(--text-primary)' }}>{item.pharmacy_name}</strong></div>
                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '4px' }}>
                      🔗 Link: <a href={item.affiliate_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{item.affiliate_link}</a>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="btn"
                    style={{
                      padding: '4px 10px',
                      height: '28px',
                      fontSize: '11px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    🗑️ Remover Recomendação
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* MODAL 1: ADD PHARMACY GENERAL */}
      {showPharmacyModal && (
        <div className="partners-modal-overlay">
          <div className="partners-modal-container">
            <div className="partners-modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                🏪 Vincular Farmácia Parceira
              </h3>
              <button 
                onClick={() => setShowPharmacyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPharmacy}>
              <div className="partners-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>Nome do Estabelecimento / Farmácia *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Farmácia Santo Antônio ou Drogasil Itapuranga"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Seu Link Geral de Afiliado do Estabelecimento *</label>
                  <input 
                    type="url" 
                    className="form-control"
                    placeholder="Ex: https://afiliado.rededefarmacias.com/dr-murillo"
                    value={pharmacyLink}
                    onChange={(e) => setPharmacyLink(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                    Insira o link de afiliado geral da loja. Ao prescrever qualquer curativo, esse parceiro aparecerá como atalho de compra direta.
                  </span>
                </div>
              </div>

              <div className="partners-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPharmacyModal(false)}
                  style={{ height: '36px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ height: '36px', fontWeight: '700' }}
                >
                  {submitting ? 'Vinculando...' : 'Vincular Farmácia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PRODUCT SPECIFIC */}
      {showProductModal && (
        <div className="partners-modal-overlay">
          <div className="partners-modal-container">
            <div className="partners-modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                📦 Adicionar Insumo Recomendado
              </h3>
              <button 
                onClick={() => setShowProductModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProduct}>
              <div className="partners-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label>Nome do Insumo / Cobertura *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Alginato de Cálcio Curatec Placa 10x10"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
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
                      value={prodBrand}
                      onChange={(e) => setProdBrand(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Preço Sugerido</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: R$ 42,00"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Rede de Farmácias Indicada *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Ultrafarma ou Drogasil Local"
                    value={prodPharmacyName}
                    onChange={(e) => setProdPharmacyName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Seu Link de Afiliado Particular do Insumo *</label>
                  <input 
                    type="url" 
                    className="form-control"
                    placeholder="Ex: https://afiliado.com/seu-codigo-do-produto"
                    value={prodLink}
                    onChange={(e) => setProdLink(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="partners-modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowProductModal(false)}
                  style={{ height: '36px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ height: '36px', fontWeight: '700' }}
                >
                  {submitting ? 'Cadastrando...' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled block matching user profile modal */}
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
