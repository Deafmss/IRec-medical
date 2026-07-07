import { useState, useEffect } from 'react';
import { geocodeAddress, fetchNearbyHealthcareResources } from '../services/locationService';

export default function LocalResourcesPanel({ clinicalProfile, compact = false }) {
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsActive, setGpsActive] = useState(false);
  const [googleEmbedQuery, setGoogleEmbedQuery] = useState('hospital'); // 'hospital', 'pharmacy'
  const [mapZoom, setMapZoom] = useState(15);

  // Address dependencies to check for geocoding updates
  const profileAddressKey = clinicalProfile 
    ? `${clinicalProfile.street || ''}-${clinicalProfile.number || ''}-${clinicalProfile.neighborhood || ''}-${clinicalProfile.city || ''}-${clinicalProfile.state || ''}`
    : '';

  // 1. Initial location setup: Try GPS first, fallback to Profile Address
  useEffect(() => {
    async function initLocation() {
      setLoading(true);
      setError('');

      const tryGps = () => {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude
              });
            },
            (err) => {
              console.log("Auto GPS failed:", err.message);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 4000 }
          );
        });
      };

      try {
        const gpsCoords = await tryGps();
        if (gpsCoords) {
          setCoords({ lat: gpsCoords.lat, lon: gpsCoords.lon });
          setResolvedAddress('Localização precisa via GPS do dispositivo');
          setGpsActive(true);
        } else if (clinicalProfile) {
          // Fallback to geocoding profile address
          const result = await geocodeAddress(clinicalProfile);
          if (result) {
            setCoords({ lat: result.lat, lon: result.lon });
            setResolvedAddress(result.displayName);
          } else {
            setError('Não foi possível obter sua localização precisa do GPS nem encontrar seu endereço de cadastro.');
          }
        }
      } catch (err) {
        console.error("Location init error:", err);
        setError('Ocorreu um erro ao carregar sua localização.');
      } finally {
        setLoading(false);
      }
    }

    initLocation();
  }, [profileAddressKey]);

  // 2. Fetch nearby hospitals and pharmacies when coords change
  useEffect(() => {
    async function loadResources() {
      if (!coords.lat || !coords.lon) return;

      setLoading(true);
      setError('');
      
      try {
        const { hospitals: hospList, pharmacies: pharmList } = await fetchNearbyHealthcareResources(coords.lat, coords.lon);
        setHospitals(hospList);
        setPharmacies(pharmList);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar farmácias e hospitais da rede de dados do mapa.');
      } finally {
        setLoading(false);
      }
    }

    loadResources();
  }, [coords]);

  // Request browser precise GPS location
  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocalização não é suportada por este navegador.");
      return;
    }

    setLoading(true);
    setGpsActive(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setResolvedAddress('Localização precisa via GPS do dispositivo');
        setLoading(false);
      },
      (err) => {
        console.error("GPS Error:", err);
        setGpsActive(false);
        setLoading(false);
        alert(`Não foi possível acessar a localização precisa do dispositivo: ${err.message}. Mantendo busca por endereço cadastrado.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Renders the compact summary card for Dashboard
  if (compact) {
    const closestHospital = hospitals[0];
    return (
      <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', borderLeft: '3px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold', textTransform: 'uppercase' }}>Pronto Socorro Mais Próximo (Real)</span>
        {loading && !closestHospital ? (
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>Detectando hospital mais próximo...</p>
        ) : closestHospital ? (
          <>
            <h4 style={{ fontSize: '13px', fontWeight: '700', margin: '2px 0 0 0' }}>{closestHospital.name}</h4>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0' }}>📍 {closestHospital.address} ({closestHospital.distance} km de você)</p>
            <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--primary)', margin: 0 }}>📞 Tel: {closestHospital.phone}</p>
          </>
        ) : (
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>Nenhum hospital encontrado no raio de busca local.</p>
        )}
      </div>
    );
  }

  // Full map and list panel
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-primary)' }}>
      
      {/* Control panel & Geolocation status */}
      <div className="glass-card" style={{ padding: '16px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', margin: 0 }}>Local Referência</p>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
            {loading ? 'Buscando...' : resolvedAddress || 'Determinando localização...'}
          </p>
        </div>
        <button 
          onClick={handleUseGps} 
          className="btn btn-secondary" 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '14px' }}>📍</span>
          {gpsActive ? 'GPS Ativo' : 'Detectar por GPS'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-glow)', color: 'var(--danger)', fontSize: '12.5px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Map Search & Zoom Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        {coords.lat && coords.lon && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setGoogleEmbedQuery('hospital')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                backgroundColor: googleEmbedQuery === 'hospital' ? 'var(--danger-glow)' : 'var(--bg-secondary)',
                color: googleEmbedQuery === 'hospital' ? 'var(--danger)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🏥 Buscar Hospitais
            </button>
            <button
              type="button"
              onClick={() => setGoogleEmbedQuery('pharmacy')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                backgroundColor: googleEmbedQuery === 'pharmacy' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                color: googleEmbedQuery === 'pharmacy' ? 'var(--primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              💊 Buscar Farmácias
            </button>
          </div>
        )}

        {/* Dynamic Zoom Controls */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setMapZoom(prev => Math.max(prev - 1, 10))}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
            title="Afastar mapa"
          >
            ➖ Afastar
          </button>
          <button
            type="button"
            onClick={() => setMapZoom(prev => Math.min(prev + 1, 20))}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
            title="Aproximar mapa"
          >
            ➕ Aproximar
          </button>
        </div>
      </div>

      {/* Map display area */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', margin: '0 0 16px 0', height: '300px', width: '100%', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1 }}>
        {coords.lat && coords.lon ? (
          <iframe
            title="Google Maps"
            src={
              googleEmbedQuery === 'hospital'
                ? `https://maps.google.com/maps?q=hospitais+pronto+socorro+loc:${coords.lat},${coords.lon}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`
                : `https://maps.google.com/maps?q=farmacias+loc:${coords.lat},${coords.lon}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`
            }
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              zIndex: 1
            }}
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '12px' }}>
            Carregando localização...
          </div>
        )}
      </div>

      {/* CSS Animation injection */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Grid of Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
        {/* Hospitals List */}
        <div>
          <h4 style={{ fontSize: '13.5px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏥 Pronto-Socorro / Hospital Mais Próximo
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hospitals.length > 0 ? (
              hospitals.slice(0, 3).map((hosp) => (
                <div key={hosp.id} className="glass-card" style={{ padding: '14px', margin: 0, borderLeft: '3px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', flex: '1' }}>{hosp.name}</h4>
                    <span className="badge badge-danger" style={{ fontSize: '9px', padding: '3px 8px', flexShrink: 0 }}>{hosp.distance} km</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>📍 {hosp.address}</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: '600', margin: 0 }}>📞 Tel: {hosp.phone}</p>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hosp.address && !hosp.address.includes('disponível') ? `${hosp.name}, ${hosp.address}` : `${hosp.lat},${hosp.lon}`)}&origin=${coords.lat || ''},${coords.lon || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '11px', marginTop: '6px', borderRadius: '6px', alignSelf: 'flex-end', gap: '4px' }}
                  >
                    <span>🧭</span> Como Chegar
                  </a>
                </div>
              ))
            ) : (
              <div className="glass-card" style={{ padding: '16px', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  {loading ? 'Buscando hospitais...' : 'Nenhum hospital encontrado no raio de busca local.'}
                </p>
                {!loading && coords.lat && coords.lon && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=hospital&center=${coords.lat},${coords.lon}&zoom=15`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 'auto', border: '1px solid var(--border-color)' }}
                  >
                    🔍 Buscar Hospitais no Google Maps
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pharmacies List */}
        <div>
          <h4 style={{ fontSize: '13.5px', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            💊 Farmácias Locais Credenciadas
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pharmacies.length > 0 ? (
              pharmacies.slice(0, 4).map((pharm) => (
                <div key={pharm.id} className="glass-card" style={{ padding: '14px', margin: 0, borderLeft: '3px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', flex: '1' }}>{pharm.name}</h4>
                    <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontSize: '9px', padding: '3px 8px', flexShrink: 0 }}>{pharm.distance} km</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>📍 {pharm.address}</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>📞 Tel: {pharm.phone}</p>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pharm.address && !pharm.address.includes('disponível') ? `${pharm.name}, ${pharm.address}` : `${pharm.lat},${pharm.lon}`)}&origin=${coords.lat || ''},${coords.lon || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '11px', marginTop: '6px', borderRadius: '6px', alignSelf: 'flex-end', gap: '4px' }}
                  >
                    <span>🧭</span> Como Chegar
                  </a>
                </div>
              ))
            ) : (
              <div className="glass-card" style={{ padding: '16px', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  {loading ? 'Buscando farmácias...' : 'Nenhuma farmácia encontrada no raio de busca local.'}
                </p>
                {!loading && coords.lat && coords.lon && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=farmacia&center=${coords.lat},${coords.lon}&zoom=15`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 'auto', border: '1px solid var(--border-color)' }}
                  >
                    🔍 Buscar Farmácias no Google Maps
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Search backup in Google Maps */}
      {coords.lat && coords.lon && (
        <div className="glass-card animate-fade-in" style={{ 
          marginTop: '16px', 
          padding: '12px 16px', 
          margin: '16px 0 0 0',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          alignItems: 'center',
          backgroundColor: 'rgba(56, 161, 219, 0.03)',
          border: '1px solid rgba(56, 161, 219, 0.15)'
        }}>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, fontWeight: '600', textAlign: 'center' }}>
            🌐 Deseja buscar mais opções ou validar em tempo real no Google Maps?
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=hospital&center=${coords.lat},${coords.lon}&zoom=15`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 'auto' }}
            >
              🏥 Buscar Hospitais (Google Maps)
            </a>
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=farmacia&center=${coords.lat},${coords.lon}&zoom=15`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 'auto' }}
            >
              💊 Buscar Farmácias (Google Maps)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
