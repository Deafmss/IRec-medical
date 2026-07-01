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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '480px', width: '100%', padding: '28px', borderRadius: '16px',
            backgroundColor: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', color: 'var(--text-primary)',
            display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>➕ Vincular Farmácia Parceira</h3>
              <button 
                onClick={() => setShowPharmacyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPharmacy} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Nome do Estabelecimento / Farmácia *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Farmácia Santo Antônio ou Drogasil Itapuranga"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  style={{ height: '40px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Seu Link Geral de Afiliado do Estabelecimento *</label>
                <input 
                  type="url" 
                  className="form-control"
                  placeholder="Ex: https://afiliado.rededefarmacias.com/dr-murillo"
                  value={pharmacyLink}
                  onChange={(e) => setPharmacyLink(e.target.value)}
                  style={{ height: '40px' }}
                  required
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Insira o link de afiliado geral da loja. Ao prescrever qualquer curativo, esse parceiro aparecerá como atalho de compra direta.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPharmacyModal(false)}
                  style={{ flex: 1, height: '38px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 1, height: '38px', fontWeight: '700' }}
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '520px', width: '100%', padding: '28px', borderRadius: '16px',
            backgroundColor: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', color: 'var(--text-primary)',
            display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>➕ Adicionar Insumo Recomendado</h3>
              <button 
                onClick={() => setShowProductModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Nome do Insumo / Cobertura *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Alginato de Cálcio Curatec Placa 10x10"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  style={{ height: '38px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Marca / Laboratório</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Curatec"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    style={{ height: '38px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Preço Sugerido</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: R$ 42,00"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    style={{ height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Rede de Farmácias Indicada *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Ultrafarma ou Drogasil Local"
                  value={prodPharmacyName}
                  onChange={(e) => setProdPharmacyName(e.target.value)}
                  style={{ height: '38px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Seu Link de Afiliado Particular do Insumo *</label>
                <input 
                  type="url" 
                  className="form-control"
                  placeholder="Ex: https://afiliado.com/seu-codigo-do-produto"
                  value={prodLink}
                  onChange={(e) => setProdLink(e.target.value)}
                  style={{ height: '38px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowProductModal(false)}
                  style={{ flex: 1, height: '38px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 1, height: '38px', fontWeight: '700' }}
                >
                  {submitting ? 'Cadastrando...' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
