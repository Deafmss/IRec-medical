import React, { useState, useEffect } from 'react';
import { getRecommendedMaterials, addRecommendedMaterial, deleteRecommendedMaterial } from '../services/supabaseService';

export default function AdminPartners({ setActiveTab }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadPartners = async () => {
    setLoading(true);
    try {
      const data = await getRecommendedMaterials(null); // Fetch only global partners
      setPartners(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !affiliateLink || !pharmacyName) {
      setErrorMsg('Por favor, preencha os campos obrigatórios (*).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        name,
        brand: brand || 'Genérico/Outros',
        price: price || 'A consultar',
        affiliate_link: affiliateLink,
        pharmacy_name: pharmacyName,
        type: 'irec_partner',
        patient_id: null, // Global recommendation
        doctor_id: null   // Platform admin recommendation
      };

      await addRecommendedMaterial(payload);
      setSuccessMsg('Parceiro iRec cadastrado com sucesso!');
      setName('');
      setBrand('');
      setPrice('');
      setAffiliateLink('');
      setPharmacyName('');
      loadPartners();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao cadastrar parceiro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta parceria?')) return;

    try {
      await deleteRecommendedMaterial(id);
      loadPartners();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir parceria.');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🏢 Gestão de Parceiros iRec (Painel Adm)
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Configure as farmácias e insumos parceiros da plataforma iRec para geração de comissões.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Partners List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-card" style={{ padding: '16px 20px', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 12px' }}>Parcerias Ativas</h3>
            
            {loading ? (
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Carregando...</p>
            ) : partners.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '12.5px', margin: 0 }}>Nenhum parceiro global cadastrado.</p>
                <p style={{ fontSize: '11px', margin: '4px 0 0' }}>Preencha o formulário ao lado para adicionar a primeira farmácia parceira.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                {partners.map((partner) => (
                  <div 
                    key={partner.id} 
                    className="glass-card" 
                    style={{ 
                      padding: '12px 14px', 
                      margin: 0, 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      borderColor: 'rgba(var(--primary-rgb), 0.15)'
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>{partner.name}</h4>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Marca: {partner.brand} • Preço: {partner.price}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--primary)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🏪 {partner.pharmacy_name}
                      </p>
                      <a 
                        href={partner.affiliate_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ fontSize: '9.5px', color: 'var(--text-secondary)', textDecoration: 'underline', marginTop: '4px', display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        🔗 Link: {partner.affiliate_link}
                      </a>
                    </div>
                    <button 
                      onClick={() => handleDelete(partner.id)}
                      className="btn" 
                      style={{ 
                        padding: '6px', 
                        height: 'auto', 
                        fontSize: '11px', 
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                        color: 'var(--danger)',
                        border: '1px solid rgba(239, 68, 68, 0.2)' 
                      }}
                      title="Excluir Parceria"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Register Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-card" style={{ padding: '20px', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '750', margin: '0 0 14px' }}>Cadastrar Novo Parceiro</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div className="form-group">
                <label style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                  Insumo / Medicamento *
                </label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Alginato de Cálcio Placa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                    Marca / Laboratório
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: Curatec"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                    Preço (faixa ou valor)
                  </label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Ex: R$ 42,90"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                  Nome da Farmácia Parceira *
                </label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Drogasil - Itapuranga/GO"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                  Link de Redirecionamento (Afiliado iRec) *
                </label>
                <input 
                  type="url" 
                  className="form-control"
                  placeholder="Ex: https://www.drogasil.com.br/afiliado-irec-id-99"
                  value={affiliateLink}
                  onChange={(e) => setAffiliateLink(e.target.value)}
                  required
                />
              </div>

              {errorMsg && (
                <div style={{ fontSize: '11.5px', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '8px 10px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{ fontSize: '11.5px', color: 'var(--success-light)', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '8px 10px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                  ✅ {successMsg}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', marginTop: '4px' }}
              >
                {submitting ? 'Cadastrando...' : '➕ Cadastrar Parceiro iRec'}
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
