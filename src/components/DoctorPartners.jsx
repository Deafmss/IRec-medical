import React, { useState, useEffect } from 'react';
import { getRecommendedMaterials, addRecommendedMaterial, deleteRecommendedMaterial } from '../services/supabaseService';

export default function DoctorPartners({ doctorProfile }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');

  const loadMaterials = async () => {
    if (!doctorProfile) return;
    setLoading(true);
    try {
      // Load materials where doctor_id = doctorProfile.id and patient_id is null
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !affiliateLink || !pharmacyName) {
      alert('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    setAdding(true);
    try {
      const payload = {
        name,
        brand: brand || 'Genérico/Outros',
        price: price || 'A consultar',
        affiliate_link: affiliateLink,
        pharmacy_name: pharmacyName,
        type: 'doctor_partner',
        doctor_id: doctorProfile.id,
        patient_id: null
      };

      await addRecommendedMaterial(payload);
      
      // Clear form
      setName('');
      setBrand('');
      setPrice('');
      setAffiliateLink('');
      setPharmacyName('');

      // Reload
      await loadMaterials();
      alert('Parceria particular vinculada com sucesso! Seus pacientes agora verão esta recomendação nos respectivos protocolos de cuidados.');
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar parceiro particular.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta marca parceira do seu catálogo global?')) return;
    try {
      await deleteRecommendedMaterial(id);
      await loadMaterials();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir parceria.');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      
      <header style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          🏪 Minhas Parcerias e Insumos Afiliados
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Gerencie marcas e farmácias das quais você é parceiro comercial. Os insumos listados aqui serão recomendados automaticamente no portal de <strong>todos</strong> os seus pacientes acompanhados.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Form */}
        <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
          <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Vincular Nova Parceria
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700' }}>Insumo ou Cobertura *</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Ex: Alginato de Cálcio 10x10cm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700' }}>Marca / Laboratório</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Curatec"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700' }}>Preço de Venda Sugerido</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: R$ 38,00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700' }}>Farmácia Online / Vendedor Parceiro *</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Ex: Ultrafarma ou Drogaria do Murillo"
                value={pharmacyName}
                onChange={(e) => setPharmacyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700' }}>Seu Link de Afiliado Particular *</label>
              <input 
                type="url" 
                className="form-control"
                placeholder="Ex: https://afiliado.farmacia.com/dr-murillo"
                value={affiliateLink}
                onChange={(e) => setAffiliateLink(e.target.value)}
                required 
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Seu paciente será redirecionado para este link ao clicar em comprar.
              </span>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={adding}
              style={{ height: '40px', fontWeight: '700', marginTop: '10px' }}
            >
              {adding ? 'Vinculando...' : '➕ Vincular Parceria Comercial'}
            </button>
          </form>
        </div>

        {/* Right Column: List */}
        <div className="glass-card" style={{ padding: '24px', margin: 0 }}>
          <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Seu Catálogo de Parcerias Ativas ({materials.length})
          </h3>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Carregando catálogo...</p>
          ) : materials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>Nenhuma parceria comercial cadastrada.</p>
              <p style={{ fontSize: '11.5px', margin: 0 }}>Cadastre insumos ao lado para receber comissões e indicar seus parceiros favoritos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
              {materials.map((item) => (
                <div key={item.id} className="glass-card" style={{ padding: '14px 18px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(var(--primary-rgb), 0.15)' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>{item.name}</h4>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>Marca: <strong>{item.brand}</strong></span>
                      <span>•</span>
                      <span>Preço: <strong>{item.price}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>🏪 {item.pharmacy_name}</span>
                      <a 
                        href={item.affiliate_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ fontSize: '10.5px', color: 'var(--text-muted)', textDecoration: 'underline' }}
                      >
                        Ver link
                      </a>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '6px 10px', 
                      height: 'auto', 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                      color: 'var(--danger)', 
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
