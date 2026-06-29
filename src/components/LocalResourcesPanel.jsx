import React, { useState, useEffect, useRef } from 'react';
import { geocodeAddress, fetchNearbyHealthcareResources, getDistance } from '../services/locationService';
import { updateClinicalProfile } from '../services/supabaseService';

export default function LocalResourcesPanel({ clinicalProfile, compact = false }) {
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsActive, setGpsActive] = useState(false);
  const [pendingAddressUpdate, setPendingAddressUpdate] = useState(null);
  
  // Google Maps state and refs
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [tempKey, setTempKey] = useState(localStorage.getItem('VITE_GOOGLE_MAPS_API_KEY') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
  const activeKey = localStorage.getItem('VITE_GOOGLE_MAPS_API_KEY') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const googleMapInstanceRef = useRef(null);
  const googleMarkersRef = useRef([]);

  // Leaflet loading state
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapProvider, setMapProvider] = useState('google-free');
  const [googleEmbedQuery, setGoogleEmbedQuery] = useState('patient'); // 'patient', 'hospital', 'pharmacy'
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const mapClickCallbackRef = useRef(null);

  // Address dependencies to check for geocoding updates
  const profileAddressKey = clinicalProfile 
    ? `${clinicalProfile.street || ''}-${clinicalProfile.number || ''}-${clinicalProfile.neighborhood || ''}-${clinicalProfile.city || ''}-${clinicalProfile.state || ''}`
    : '';

  // 1. Inject Leaflet CDN dynamically if not already loaded
  useEffect(() => {
    if (compact) return; // Map is only rendered in full view

    const leafletCssId = 'leaflet-cdn-css';
    const leafletJsId = 'leaflet-cdn-js';

    if (!document.getElementById(leafletCssId)) {
      const link = document.createElement('link');
      link.id = leafletCssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById(leafletJsId)) {
      const script = document.createElement('script');
      script.id = leafletJsId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.head.appendChild(script);
    } else {
      // Script is already in DOM, check if window.L is available
      if (window.L) {
        setLeafletLoaded(true);
      } else {
        const checkL = setInterval(() => {
          if (window.L) {
            setLeafletLoaded(true);
            clearInterval(checkL);
          }
        }, 100);
        setTimeout(() => clearInterval(checkL), 5000);
      }
    }
  }, [compact]);

  // 2. Geocode address from profile on mount or when address changes
  useEffect(() => {
    async function initGeocoding() {
      if (gpsActive) return; // Don't overwrite precise GPS coordinates with address search

      setLoading(true);
      setError('');
      try {
        const result = await geocodeAddress(clinicalProfile);
        if (result) {
          setCoords({ lat: result.lat, lon: result.lon });
          setResolvedAddress(result.displayName);
        } else {
          setError('Não foi possível encontrar a localização do endereço cadastrado. Digite um CEP ou endereço válido no seu perfil.');
        }
      } catch (err) {
        console.error(err);
        setError('Ocorreu um erro ao carregar as coordenadas geográficas.');
      } finally {
        setLoading(false);
      }
    }

    if (clinicalProfile) {
      initGeocoding();
    }
  }, [profileAddressKey, gpsActive]);

  // 3. Load script for Google Maps if activeKey is present
  useEffect(() => {
    if (!activeKey) return;

    const googleScriptId = 'google-maps-sdk';
    let script = document.getElementById(googleScriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = googleScriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${activeKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGoogleMapsLoaded(true);
      };
      script.onerror = () => {
        setError('Erro ao carregar o SDK do Google Maps. Verifique se a chave de API está correta.');
      };
      document.head.appendChild(script);
    } else {
      if (window.google && window.google.maps) {
        setGoogleMapsLoaded(true);
      } else {
        const checkGoogle = setInterval(() => {
          if (window.google && window.google.maps) {
            setGoogleMapsLoaded(true);
            clearInterval(checkGoogle);
          }
        }, 100);
        setTimeout(() => clearInterval(checkGoogle), 5000);
      }
    }
  }, [activeKey]);

  // 3.1. Fetch nearby hospitals and pharmacies when coords change
  useEffect(() => {
    async function loadResources() {
      if (!coords.lat || !coords.lon) return;

      setLoading(true);
      setError('');
      
      // If Google Maps is active and loaded, search via Google Places textSearch
      if (activeKey && googleMapsLoaded && window.google && window.google.maps && window.google.maps.places) {
        console.log("Searching places via Google Places API...");
        try {
          const lat = coords.lat;
          const lon = coords.lon;
          const pyrmont = new window.google.maps.LatLng(lat, lon);
          const dummyDiv = document.createElement('div');
          const service = new window.google.maps.places.PlacesService(googleMapInstanceRef.current || dummyDiv);
          
          service.textSearch({
            location: pyrmont,
            radius: 7000,
            query: 'hospital UPA pronto socorro posto de saúde'
          }, (hResults, hStatus) => {
            let formattedHospitals = [];
            if (hStatus === window.google.maps.places.PlacesServiceStatus.OK && hResults) {
              formattedHospitals = hResults.map((place, idx) => {
                const dist = getDistance(lat, lon, place.geometry.location.lat(), place.geometry.location.lng());
                return {
                  id: `g_hosp_${place.place_id || idx}`,
                  name: place.name,
                  lat: place.geometry.location.lat(),
                  lon: place.geometry.location.lng(),
                  address: place.formatted_address || place.vicinity || 'Endereço disponível no mapa',
                  phone: 'Disponível no Google Maps',
                  distance: dist
                };
              });
            }
            
            service.textSearch({
              location: pyrmont,
              radius: 7000,
              query: 'farmácia drogaria'
            }, (pResults, pStatus) => {
              let formattedPharmacies = [];
              if (pStatus === window.google.maps.places.PlacesServiceStatus.OK && pResults) {
                formattedPharmacies = pResults.map((place, idx) => {
                  const dist = getDistance(lat, lon, place.geometry.location.lat(), place.geometry.location.lng());
                  return {
                    id: `g_pharm_${place.place_id || idx}`,
                    name: place.name,
                    lat: place.geometry.location.lat(),
                    lon: place.geometry.location.lng(),
                    address: place.formatted_address || place.vicinity || 'Endereço disponível no mapa',
                    phone: 'Disponível no Google Maps',
                    distance: dist
                  };
                });
              }
              
              formattedHospitals.sort((a, b) => a.distance - b.distance);
              formattedPharmacies.sort((a, b) => a.distance - b.distance);
              
              setHospitals(formattedHospitals);
              setPharmacies(formattedPharmacies);
              setLoading(false);
            });
          });
        } catch (err) {
          console.error("Error querying Google Places:", err);
          setError("Erro ao carregar dados do Google Places. Verifique sua chave de API.");
          setLoading(false);
        }
      } else {
        // Fallback to OSM
        console.log("Searching places via OpenStreetMap...");
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
    }

    loadResources();
  }, [coords, googleMapsLoaded, activeKey]);

  // Handler for manual click or drag marker relocation on the map
  const handleManualLocationUpdate = async (newLat, newLon) => {
    setGpsActive(false);
    setCoords({ lat: newLat, lon: newLon });
    setLoading(true);
    setError('');
    
    try {
      const userAgent = 'iRecMedicalApp/1.0 (contact@irec.example.com)';
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLon}&format=json`, {
        headers: { 'User-Agent': userAgent }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          setResolvedAddress(data.display_name);
          
          const addr = data.address || {};
          setPendingAddressUpdate({
            street: addr.road || addr.street || addr.pedestrian || '',
            number: addr.house_number || '',
            neighborhood: addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '',
            city: addr.city || addr.town || addr.municipality || addr.village || '',
            state: addr.state || '',
            cep: (addr.postcode || '').replace(/\D/g, '')
          });
        }
      }
    } catch (err) {
      console.error('Error reverse geocoding new coordinates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Keep a ref of the callback up to date for Leaflet event listeners
  useEffect(() => {
    mapClickCallbackRef.current = (lat, lon) => {
      handleManualLocationUpdate(lat, lon);
    };
  });

  // 4. Initialize and update Leaflet Map
  useEffect(() => {
    if (compact || !leafletLoaded || !mapRef.current || !coords.lat || !coords.lon || activeKey) return;

    try {
      // Initialize map instance if not already done
      if (!mapInstanceRef.current) {
        const map = window.L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true
        }).setView([coords.lat, coords.lon], 14);

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);

        // Bind map click handler
        map.on('click', (e) => {
          if (mapClickCallbackRef.current) {
            mapClickCallbackRef.current(e.latlng.lat, e.latlng.lng);
          }
        });

        mapInstanceRef.current = map;
        markersGroupRef.current = window.L.layerGroup().addTo(map);
      } else {
        // Center view on new coordinates
        mapInstanceRef.current.setView([coords.lat, coords.lon], 14);
      }

      const markersGroup = markersGroupRef.current;

      // Clear old markers
      markersGroup.clearLayers();

      // Define custom styles for HTML Markers (divIcon) to avoid Vite asset issues
      const patientIcon = window.L.divIcon({
        className: 'custom-leaflet-marker-patient',
        html: `<div style="
          width: 20px; 
          height: 20px; 
          background-color: #2b6cb0; 
          border: 3px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 10px rgba(0,0,0,0.5); 
          position: relative;
        ">
          <div style="
            position: absolute; 
            top: -3px; 
            left: -3px; 
            right: -3px; 
            bottom: -3px; 
            border-radius: 50%; 
            border: 2px solid #2b6cb0; 
            animation: leaflet-pulse 1.8s infinite;
          "></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const hospitalIcon = window.L.divIcon({
        className: 'custom-leaflet-marker-hospital',
        html: `<div style="
          font-size: 26px; 
          margin-top: -12px;
          margin-left: -1px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          cursor: pointer;
        ">🏥</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const pharmacyIcon = window.L.divIcon({
        className: 'custom-leaflet-marker-pharmacy',
        html: `<div style="
          font-size: 26px; 
          margin-top: -12px;
          margin-left: -1px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          cursor: pointer;
        ">💊</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      // Add patient marker (draggable)
      const patientMarker = window.L.marker([coords.lat, coords.lon], { 
        icon: patientIcon,
        draggable: true 
      })
      .bindPopup('<b>Você (Sua Localização)</b><br><span style="font-size: 10px; color: #666;">Dica: Arraste este pin ou clique no mapa para corrigir sua posição</span>')
      .addTo(markersGroup);

      patientMarker.on('dragend', (e) => {
        const markerPosition = e.target.getLatLng();
        if (mapClickCallbackRef.current) {
          mapClickCallbackRef.current(markerPosition.lat, markerPosition.lng);
        }
      });

      // Add hospitals
      hospitals.forEach(h => {
        const destQuery = h.address && !h.address.includes('disponível')
          ? `${h.name}, ${h.address}`
          : `${h.lat},${h.lon}`;
        const popupContent = `
          <div style="font-family: var(--font-primary); font-size: 11.5px; line-height: 1.4;">
            <strong style="font-size: 12.5px; color: var(--danger);">🏥 ${h.name}</strong><br>
            📍 ${h.address}<br>
            📞 Tel: ${h.phone}<br>
            <b>Distância: ${h.distance} km</b><br>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}&origin=${coords.lat},${coords.lon}" target="_blank" rel="noopener noreferrer" style="
              display: inline-block; 
              margin-top: 6px; 
              padding: 4px 8px; 
              background-color: var(--primary); 
              color: white; 
              text-decoration: none; 
              border-radius: 4px; 
              font-weight: bold;
              font-size: 10px;
            ">Ver Rota no Google Maps</a>
          </div>
        `;
        window.L.marker([h.lat, h.lon], { icon: hospitalIcon })
          .bindPopup(popupContent)
          .addTo(markersGroup);
      });

      // Add pharmacies
      pharmacies.forEach(p => {
        const destQuery = p.address && !p.address.includes('disponível')
          ? `${p.name}, ${p.address}`
          : `${p.lat},${p.lon}`;
        const popupContent = `
          <div style="font-family: var(--font-primary); font-size: 11.5px; line-height: 1.4;">
            <strong style="font-size: 12.5px; color: var(--primary);">💊 ${p.name}</strong><br>
            📍 ${p.address}<br>
            📞 Tel: ${p.phone}<br>
            <b>Distância: ${p.distance} km</b><br>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}&origin=${coords.lat},${coords.lon}" target="_blank" rel="noopener noreferrer" style="
              display: inline-block; 
              margin-top: 6px; 
              padding: 4px 8px; 
              background-color: var(--primary); 
              color: white; 
              text-decoration: none; 
              border-radius: 4px; 
              font-weight: bold;
              font-size: 10px;
            ">Ver Rota no Google Maps</a>
          </div>
        `;
        window.L.marker([p.lat, p.lon], { icon: pharmacyIcon })
          .bindPopup(popupContent)
          .addTo(markersGroup);
      });

    } catch (err) {
      console.error('Error updating leaflet markers:', err);
    }
  }, [leafletLoaded, coords, hospitals, pharmacies, compact, activeKey, mapProvider]);

  // 4.1. Initialize and update Google Map
  useEffect(() => {
    if (compact || !googleMapsLoaded || !mapRef.current || !coords.lat || !coords.lon || !activeKey) return;

    try {
      if (!googleMapInstanceRef.current) {
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: coords.lat, lng: coords.lon },
          zoom: 14,
          mapTypeControl: true,
          streetViewControl: true
        });

        map.addListener('click', (e) => {
          if (mapClickCallbackRef.current) {
            mapClickCallbackRef.current(e.latLng.lat(), e.latLng.lng());
          }
        });

        googleMapInstanceRef.current = map;
      } else {
        googleMapInstanceRef.current.setCenter({ lat: coords.lat, lng: coords.lon });
      }

      const map = googleMapInstanceRef.current;

      // Clear existing markers
      googleMarkersRef.current.forEach(m => m.setMap(null));
      googleMarkersRef.current = [];

      // Add patient marker (draggable)
      const patientMarker = new window.google.maps.Marker({
        position: { lat: coords.lat, lng: coords.lon },
        map,
        title: 'Sua Localização',
        draggable: true,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        }
      });

      patientMarker.addListener('dragend', (e) => {
        if (mapClickCallbackRef.current) {
          mapClickCallbackRef.current(e.latLng.lat(), e.latLng.lng());
        }
      });

      googleMarkersRef.current.push(patientMarker);

      // Add Hospitals
      hospitals.forEach(h => {
        const destQuery = h.address && !h.address.includes('disponível')
          ? `${h.name}, ${h.address}`
          : `${h.lat},${h.lon}`;

        const marker = new window.google.maps.Marker({
          position: { lat: h.lat, lng: h.lon },
          map,
          title: h.name,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 11.5px; line-height: 1.4; color: #333; max-width: 220px;">
              <strong style="font-size: 12.5px; color: #c53030; display: block; margin-bottom: 2px;">🏥 ${h.name}</strong>
              <span style="display: block; margin-bottom: 2px;">📍 ${h.address}</span>
              <span style="display: block; margin-bottom: 2px;">📞 Tel: ${h.phone}</span>
              <b style="display: block; margin-top: 4px; margin-bottom: 6px;">Distância: ${h.distance} km</b>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}&origin=${coords.lat},${coords.lon}" target="_blank" rel="noopener noreferrer" style="
                display: inline-block; 
                padding: 4px 8px; 
                background-color: #3182ce; 
                color: white; 
                text-decoration: none; 
                border-radius: 4px; 
                font-weight: bold;
                font-size: 10px;
              ">Ver Rota no Google Maps</a>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        googleMarkersRef.current.push(marker);
      });

      // Add Pharmacies
      pharmacies.forEach(p => {
        const destQuery = p.address && !p.address.includes('disponível')
          ? `${p.name}, ${p.address}`
          : `${p.lat},${p.lon}`;

        const marker = new window.google.maps.Marker({
          position: { lat: p.lat, lng: p.lon },
          map,
          title: p.name,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 11.5px; line-height: 1.4; color: #333; max-width: 220px;">
              <strong style="font-size: 12.5px; color: #2b6cb0; display: block; margin-bottom: 2px;">💊 ${p.name}</strong>
              <span style="display: block; margin-bottom: 2px;">📍 ${p.address}</span>
              <span style="display: block; margin-bottom: 2px;">📞 Tel: ${p.phone}</span>
              <b style="display: block; margin-top: 4px; margin-bottom: 6px;">Distância: ${p.distance} km</b>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}&origin=${coords.lat},${coords.lon}" target="_blank" rel="noopener noreferrer" style="
                display: inline-block; 
                padding: 4px 8px; 
                background-color: #3182ce; 
                color: white; 
                text-decoration: none; 
                border-radius: 4px; 
                font-weight: bold;
                font-size: 10px;
              ">Ver Rota no Google Maps</a>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        googleMarkersRef.current.push(marker);
      });

    } catch (err) {
      console.error('Error updating Google Maps markers:', err);
    }
  }, [googleMapsLoaded, coords, hospitals, pharmacies, compact, activeKey, mapProvider]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (googleMapInstanceRef.current) {
        googleMarkersRef.current.forEach(m => m.setMap(null));
        googleMarkersRef.current = [];
        googleMapInstanceRef.current = null;
      }
    };
  }, []);

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

  // Persists the corrected address into the Supabase database / local state
  const handleSaveAddressToProfile = async () => {
    if (!pendingAddressUpdate || !clinicalProfile) return;

    setLoading(true);
    try {
      const updatedProfile = {
        ...clinicalProfile,
        street: pendingAddressUpdate.street,
        number: pendingAddressUpdate.number,
        neighborhood: pendingAddressUpdate.neighborhood,
        city: pendingAddressUpdate.city,
        state: pendingAddressUpdate.state,
        cep: pendingAddressUpdate.cep
      };

      const result = await updateClinicalProfile(clinicalProfile.id, updatedProfile);
      if (result) {
        alert("Endereço do prontuário atualizado com sucesso no seu perfil!");
        setPendingAddressUpdate(null);
      } else {
        alert("Erro ao atualizar o perfil clínico.");
      }
    } catch (err) {
      console.error("Error updating profile address:", err);
      alert("Erro ao atualizar o endereço no perfil.");
    } finally {
      setLoading(false);
    }
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

  const handleSaveKey = () => {
    if (tempKey.trim()) {
      localStorage.setItem('VITE_GOOGLE_MAPS_API_KEY', tempKey.trim());
      alert("Chave do Google Maps salva com sucesso! O aplicativo será recarregado para ativar o novo mapa.");
      window.location.reload();
    } else {
      localStorage.removeItem('VITE_GOOGLE_MAPS_API_KEY');
      alert("Chave de API removida! O aplicativo voltará a utilizar o OpenStreetMap gratuito.");
      window.location.reload();
    }
  };

  // Full map and list panel
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-primary)' }}>
      
      {/* Google Maps Configuration Toggle */}
      <div className="glass-card" style={{ padding: '12px 16px', margin: 0, border: activeKey ? '1px solid rgba(72, 187, 120, 0.4)' : '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowKeyConfig(!showKeyConfig)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚙️</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: activeKey ? 'var(--success)' : 'var(--text-primary)' }}>
              {activeKey ? '🟢 Google Maps Ativado (Precisão de 100% Ativa)' : '⚙️ Testar com Google Maps Oficial (Garante 100% de Precisão)'}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{showKeyConfig ? '▲ Recolher' : '▼ Expandir'}</span>
        </div>
        
        {showKeyConfig && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
              O OpenStreetMap (gratuito) pode ter falhas de cobertura em cidades pequenas (como Uruana/GO). Colando sua chave do Google Maps abaixo, a tela carregará o mapa e as buscas oficiais do Google Places em tempo real.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Insira sua VITE_GOOGLE_MAPS_API_KEY..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                style={{ 
                  flex: '1', 
                  minWidth: '220px', 
                  padding: '8px 12px', 
                  fontSize: '12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'var(--bg-secondary)', 
                  color: 'var(--text-primary)' 
                }}
              />
              <button 
                onClick={handleSaveKey} 
                className="btn btn-primary" 
                style={{ padding: '8px 16px', fontSize: '12px', height: 'auto', borderRadius: '6px', cursor: 'pointer' }}
              >
                {tempKey ? 'Salvar e Ativar' : 'Usar Gratuito'}
              </button>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              * A chave será armazenada de forma segura no seu navegador para esta sessão de testes.
            </span>
          </div>
        )}
      </div>

      {/* Control panel & Geolocation status */}
      <div className="glass-card" style={{ padding: '16px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', margin: 0 }}>Local Referência</p>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
            {loading ? 'Buscando...' : resolvedAddress || 'Determinando localização...'}
          </p>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', marginTop: '2px' }}>
            💡 Você pode clicar no mapa ou arrastar o pin azul para corrigir sua posição.
          </span>
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

      {/* Address Synchronization Prompter */}
      {pendingAddressUpdate && (
        <div className="glass-card" style={{ 
          padding: '12px 16px', 
          backgroundColor: 'var(--primary-glow)', 
          border: '1px solid var(--primary-light)', 
          margin: 0, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>📍 Posição personalizada no mapa!</p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Deseja atualizar seu endereço no prontuário para: <strong>{pendingAddressUpdate.street}{pendingAddressUpdate.number ? `, ${pendingAddressUpdate.number}` : ''} - {pendingAddressUpdate.city}/{pendingAddressUpdate.state}</strong>?
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setPendingAddressUpdate(null)} 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '11px', height: 'auto', borderRadius: '6px', cursor: 'pointer' }}
            >
              Ignorar
            </button>
            <button 
              onClick={handleSaveAddressToProfile} 
              className="btn btn-primary" 
              style={{ padding: '6px 12px', fontSize: '11px', height: 'auto', borderRadius: '6px', cursor: 'pointer' }}
            >
              Salvar no Perfil
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-glow)', color: 'var(--danger)', fontSize: '12.5px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Map Provider Selector & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button 
            type="button"
            onClick={() => setMapProvider('google-free')}
            style={{
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mapProvider === 'google-free' ? 'var(--primary)' : 'transparent',
              color: mapProvider === 'google-free' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            🗺️ Google Maps
          </button>
          <button 
            type="button"
            onClick={() => setMapProvider('leaflet')}
            style={{
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mapProvider === 'leaflet' ? 'var(--primary)' : 'transparent',
              color: mapProvider === 'leaflet' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            📍 Mapa Alternativo
          </button>
        </div>

        {mapProvider === 'google-free' && coords.lat && coords.lon && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setGoogleEmbedQuery('patient')}
              style={{
                padding: '4px 8px',
                fontSize: '10.5px',
                fontWeight: '700',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                backgroundColor: googleEmbedQuery === 'patient' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                color: googleEmbedQuery === 'patient' ? 'var(--primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              👤 Meu Local
            </button>
            <button
              type="button"
              onClick={() => setGoogleEmbedQuery('hospital')}
              style={{
                padding: '4px 8px',
                fontSize: '10.5px',
                fontWeight: '700',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                backgroundColor: googleEmbedQuery === 'hospital' ? 'var(--danger-glow)' : 'var(--bg-secondary)',
                color: googleEmbedQuery === 'hospital' ? 'var(--danger)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              🏥 Hospitais
            </button>
            <button
              type="button"
              onClick={() => setGoogleEmbedQuery('pharmacy')}
              style={{
                padding: '4px 8px',
                fontSize: '10.5px',
                fontWeight: '700',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                backgroundColor: googleEmbedQuery === 'pharmacy' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                color: googleEmbedQuery === 'pharmacy' ? 'var(--primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              💊 Farmácias
            </button>
          </div>
        )}
      </div>

      {/* Map display area */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', margin: '0 0 16px 0', height: '300px', width: '100%', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1 }}>
        {mapProvider === 'google-free' && coords.lat && coords.lon ? (
          <iframe
            title="Google Maps"
            src={
              googleEmbedQuery === 'hospital'
                ? `https://maps.google.com/maps?q=hospitais+pronto+socorro+near+${coords.lat},${coords.lon}&t=&z=14&ie=UTF8&iwloc=&output=embed`
                : googleEmbedQuery === 'pharmacy'
                ? `https://maps.google.com/maps?q=farmacias+near+${coords.lat},${coords.lon}&t=&z=14&ie=UTF8&iwloc=&output=embed`
                : `https://maps.google.com/maps?q=${coords.lat},${coords.lon}&t=&z=16&ie=UTF8&iwloc=&output=embed`
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
          <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
        )}
        
        {loading && mapProvider === 'leaflet' && (
          <div style={{ 
            position: 'absolute', 
            top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(255, 255, 255, 0.7)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            zIndex: 1000 
          }}>
            <div style={{ 
              width: '28px', height: '28px', 
              border: '3px solid var(--border-color)', 
              borderTopColor: 'var(--primary)', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }} />
            <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginTop: '8px' }}>Carregando dados geográficos...</p>
          </div>
        )}
      </div>

      {/* CSS Animation injection */}
      <style>{`
        @keyframes leaflet-pulse {
          0% { transform: scale(0.9); opacity: 0.9; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0.9); opacity: 0; }
        }
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
