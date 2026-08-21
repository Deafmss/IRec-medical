/**
 * Service to handle geocoding, nearby health resources lookup via OpenStreetMap APIs,
 * and geographical calculations.
 */
import {
  RECURSOS_DECLARADOS,
  VERIFICADO_EM,
  FONTE,
  estaVencido
} from '../data/recursosLocaisDeclarados';

// Haversine formula to calculate distance in km between two lat/lon coordinates
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(2));
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Geocodes an address string or object using OpenStreetMap Nominatim.
 * Falls back to city/state if detailed address search fails.
 */
export async function geocodeAddress(profile) {
  if (!profile) return null;

  const { street, number, neighborhood, city, state } = profile;
  
  // Try precise address first
  let query;
  if (street && city && state) {
    query = `${street} ${number || ''}, ${neighborhood || ''}, ${city} - ${state}, Brasil`;
  } else if (city && state) {
    query = `${city} - ${state}, Brasil`;
  } else {
    return null;
  }

  const cacheKey = `irec_geocode_cache_${profile.id || 'guest'}_${query.replace(/\s+/g, '_')}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log(`[iRec Geocode Cache] Returning cached coordinates for address: ${query}`);
      return JSON.parse(cached);
    }
  } catch (err) {
    console.debug('Failed to load geocode cache:', err);
  }

  const userAgent = 'iRecMedicalApp/1.0 (contact@irec.example.com)';

  try {
    console.log(`Geocoding: ${query}`);
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    let res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    let data = await res.json();

    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (err) {
        console.debug('Failed to save geocode cache:', err);
      }
      return result;
    }

    // Fallback: If street geocoding failed, try just city and state
    if (street && city) {
      const fallbackQuery = `${city} - ${state}, Brasil`;
      console.log(`Precise geocode failed. Trying fallback: ${fallbackQuery}`);
      url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`;
      res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      data = await res.json();
      if (data && data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (err) {
          console.debug('Failed to save fallback geocode cache:', err);
        }
        return result;
      }
    }
  } catch (err) {
    console.error('Error geocoding address:', err);
  }

  return null;
}

/**
 * Fetches hospitals and pharmacies near a specific coordinate using OSM Overpass API.
 * Injects actual, real local establishments in case of mapping omissions in OSM (like in Itapuranga, GO).
 * Falls back to Nominatim search queries if Overpass times out or fails.
 */
export async function fetchNearbyHealthcareResources(lat, lon, radiusMeters = 7000) {
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  
  if (isNaN(numLat) || isNaN(numLon)) {
    return { hospitals: [], pharmacies: [] };
  }

  const cacheKey = `irec_resources_cache_${numLat.toFixed(4)}_${numLon.toFixed(4)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Cache valid for 3 hours
      if (Date.now() - parsed.timestamp < 3 * 60 * 60 * 1000) {
        console.log(`[iRec Resource Cache] Returning cached local resources for coordinates: ${numLat}, ${numLon}`);
        return parsed.data;
      }
    }
  } catch (err) {
    console.debug('Failed to read resources cache:', err);
  }

  const hospitals = [];
  const pharmacies = [];

  // Recursos declarados manualmente, para regiao com cobertura incompleta no
  // OpenStreetMap. A lista saiu daqui para src/data/recursosLocaisDeclarados.js,
  // onde tem data de verificacao e origem — antes eram nome, endereco e telefone
  // fixos no meio desta funcao, injetados como resultado real sem nenhuma
  // indicacao de quando foram conferidos.
  RECURSOS_DECLARADOS.forEach((regiao) => {
    const dentroDoRaio = getDistance(numLat, numLon, regiao.centro.lat, regiao.centro.lon) <= regiao.raioKm;
    if (!dentroDoRaio) return;

    const marcar = (item) => ({
      ...item,
      distance: getDistance(numLat, numLon, item.lat, item.lon),
      // A interface usa estes campos para avisar de onde vem a informacao.
      fonte: FONTE,
      verificadoEm: VERIFICADO_EM,
      informacaoVencida: estaVencido()
    });

    regiao.hospitais.forEach((h) => hospitals.push(marcar(h)));
    regiao.farmacias.forEach((f) => pharmacies.push(marcar(f)));
  });

  // Define optimized Overpass QL query using 'nwr' and expanded tags
  const query = `[out:json][timeout:8];(
    nwr["amenity"~"hospital|clinic|doctors|health_post|health_centre"](around:${radiusMeters},${numLat},${numLon});
    nwr["healthcare"~"hospital|clinic|centre|doctor"](around:${radiusMeters},${numLat},${numLon});
    nwr["amenity"="pharmacy"](around:${radiusMeters},${numLat},${numLon});
    nwr["healthcare"="pharmacy"](around:${radiusMeters},${numLat},${numLon});
    nwr["shop"~"pharmacy|chemist"](around:${radiusMeters},${numLat},${numLon});
    nwr["building"~"hospital|clinic"](around:${radiusMeters},${numLat},${numLon});
  );out center;`;

  // List of public Overpass mirrors to try in parallel
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
  ];

  let rawElements = [];
  let querySuccess = false;
  const userAgent = 'iRecMedicalApp/1.0 (contact@irec.example.com)';

  const fetchFromMirror = async (mirror) => {
    const url = `${mirror}?data=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const res = await fetch(url, { 
        headers: { 'User-Agent': userAgent },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return data.elements || [];
      }
      throw new Error(`Mirror returned status ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const anySuccessful = async (promises) => {
    if (Promise.any) {
      return Promise.any(promises);
    }
    return new Promise((resolve, reject) => {
      let errors = [];
      let rejected = 0;
      promises.forEach(p => {
        Promise.resolve(p).then(resolve).catch(err => {
          errors.push(err);
          rejected++;
          if (rejected === promises.length) {
            reject(new Error("All promises failed"));
          }
        });
      });
    });
  };

  try {
    rawElements = await anySuccessful(mirrors.map(mirror => fetchFromMirror(mirror)));
    querySuccess = true;
    console.log(`Overpass parallel query succeeded. Found ${rawElements.length} elements.`);
  } catch (err) {
    console.warn('All Overpass parallel interpreter queries failed or timed out:', err);
  }

  // Parse Overpass elements if query succeeded
  if (querySuccess && rawElements.length > 0) {
    rawElements.forEach(el => {
      const itemLat = el.lat || (el.center && el.center.lat);
      const itemLon = el.lon || (el.center && el.center.lon);
      
      if (!itemLat || !itemLon) return;

      // Skip duplicates if it's already in our list (within 50 meters)
      const isDupHosp = hospitals.some(h => getDistance(h.lat, h.lon, itemLat, itemLon) < 0.05);
      const isDupPharm = pharmacies.some(p => getDistance(p.lat, p.lon, itemLat, itemLon) < 0.05);
      if (isDupHosp || isDupPharm) return;

      const amenity = el.tags.amenity || '';
      const healthcare = el.tags.healthcare || '';
      const shop = el.tags.shop || '';

      const isPharmacy = amenity === 'pharmacy' || healthcare === 'pharmacy' || shop === 'pharmacy' || shop === 'chemist';
      const defaultName = isPharmacy ? 'Farmácia' : 'Hospital / Centro de Saúde';
      const name = el.tags.name || defaultName;

      const address = el.tags['addr:street']
        ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ', ' + el.tags['addr:housenumber'] : ''}${el.tags['addr:suburb'] ? ' - ' + el.tags['addr:suburb'] : ''}`
        : 'Endereço disponível no mapa';
      const phone = el.tags.phone || el.tags['contact:phone'] || '192 / Não informado';
      const distance = getDistance(numLat, numLon, itemLat, itemLon);

      const resource = {
        id: el.id,
        name,
        lat: itemLat,
        lon: itemLon,
        address,
        phone,
        distance
      };

      if (isPharmacy) {
        pharmacies.push(resource);
      } else {
        hospitals.push(resource);
      }
    });
  }

  // Fallback: If Overpass failed or returned 0 results, query Nominatim Search using City Name
  const totalHospFound = hospitals.length;
  const totalPharmFound = pharmacies.length;

  if (totalHospFound === 0 || totalPharmFound === 0) {
    console.log("No resources found or Overpass query failed. Activating Nominatim search fallback...");
    
    // 1. Get city and state names via reverse geocoding (3s timeout)
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${numLat}&lon=${numLon}&format=json`;
    const revController = new AbortController();
    const revTimeoutId = setTimeout(() => revController.abort(), 3000);
    
    let city = '';
    let state = '';
    
    try {
      const revRes = await fetch(reverseUrl, { 
        headers: { 'User-Agent': userAgent },
        signal: revController.signal
      });
      clearTimeout(revTimeoutId);
      if (revRes.ok) {
        const revData = await revRes.json();
        const addr = revData.address || {};
        city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';
        state = addr.state || '';
      }
    } catch (err) {
      clearTimeout(revTimeoutId);
      console.warn("Nominatim reverse geocode failed:", err.message);
    }

    if (city) {
      console.log(`Nominatim fallback: Searching near city: ${city}, ${state}`);
      
      // Helper to query and parse Nominatim search results
      const searchFallback = async (queryTerm, isPharmType) => {
        const qStr = `${queryTerm}, ${city}${state ? ', ' + state : ''}`;
        const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qStr)}&format=json&limit=12&addressdetails=1`;
        
        const searchController = new AbortController();
        const searchTimeoutId = setTimeout(() => searchController.abort(), 4000);

        try {
          const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': userAgent },
            signal: searchController.signal
          });
          clearTimeout(searchTimeoutId);

          if (searchRes.ok) {
            const searchData = await searchRes.json();
            searchData.forEach(el => {
              const itemLat = parseFloat(el.lat);
              const itemLon = parseFloat(el.lon);
              if (isNaN(itemLat) || isNaN(itemLon)) return;

              const distance = getDistance(numLat, numLon, itemLat, itemLon);
              // Max distance threshold of 25km to keep it local and correct
              if (distance > 25) return;

              // Duplicate check
              const isDupHosp = hospitals.some(h => getDistance(h.lat, h.lon, itemLat, itemLon) < 0.05);
              const isDupPharm = pharmacies.some(p => getDistance(p.lat, p.lon, itemLat, itemLon) < 0.05);
              if (isDupHosp || isDupPharm) return;

              const addr = el.address || {};
              const addressStr = addr.road
                ? `${addr.road}${addr.house_number ? ', ' + addr.house_number : ''}${addr.suburb ? ' - ' + addr.suburb : ''}`
                : el.display_name.split(',').slice(0, 3).join(',');

              const resource = {
                id: `nom_${el.place_id}`,
                name: el.name || (isPharmType ? 'Farmácia' : 'Hospital'),
                lat: itemLat,
                lon: itemLon,
                address: addressStr,
                phone: '192 / Não informado',
                distance
              };

              if (isPharmType) {
                pharmacies.push(resource);
              } else {
                hospitals.push(resource);
              }
            });
          }
        } catch (err) {
          clearTimeout(searchTimeoutId);
          console.warn(`Nominatim fallback search failed for ${queryTerm}:`, err.message);
        }
      };

      // Execute queries in parallel if their lists are empty
      const promises = [];
      if (hospitals.length === 0) {
        promises.push(searchFallback('hospital', false));
        promises.push(searchFallback('posto de saude', false));
      }
      if (pharmacies.length === 0) {
        promises.push(searchFallback('farmacia', true));
        promises.push(searchFallback('drogaria', true));
      }

      await Promise.all(promises);
    }
  }

  // Sort by distance (closest first)
  hospitals.sort((a, b) => a.distance - b.distance);
  pharmacies.sort((a, b) => a.distance - b.distance);

  const result = { hospitals, pharmacies };
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: result
    }));
  } catch (err) {
    console.debug('Failed to write resources cache:', err);
  }

  return result;
}
