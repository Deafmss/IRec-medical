/**
 * Service to handle geocoding, nearby health resources lookup via OpenStreetMap APIs,
 * and geographical calculations.
 */

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
  let query = '';
  if (street && city && state) {
    query = `${street} ${number || ''}, ${neighborhood || ''}, ${city} - ${state}, Brasil`;
  } else if (city && state) {
    query = `${city} - ${state}, Brasil`;
  } else {
    return null;
  }

  const userAgent = 'iRecMedicalApp/1.0 (contact@irec.example.com)';

  try {
    console.log(`Geocoding: ${query}`);
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    let res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    let data = await res.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }

    // Fallback: If street geocoding failed, try just city and state
    if (street && city) {
      const fallbackQuery = `${city} - ${state}, Brasil`;
      console.log(`Precise geocode failed. Trying fallback: ${fallbackQuery}`);
      url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`;
      res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
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

  const hospitals = [];
  const pharmacies = [];

  // Check if position is within/near Itapuranga, GO (within 12km) to inject exact local establishments
  const itapurangaCenterLat = -15.5605889;
  const itapurangaCenterLon = -49.9489571;
  const isItapuranga = getDistance(numLat, numLon, itapurangaCenterLat, itapurangaCenterLon) <= 12;

  if (isItapuranga) {
    const predefinedHospitals = [
      {
        id: "itapuranga_hosp_sf",
        name: "Hospital São Francisco",
        lat: -15.562111,
        lon: -49.949483,
        address: "Rua João do Couto Rosa, 249, Centro - Itapuranga/GO",
        phone: "(62) 3312-1154"
      },
      {
        id: "itapuranga_hosp_muni",
        name: "Hospital Municipal de Itapuranga (HMI)",
        lat: -15.564264,
        lon: -49.947838,
        address: "Av. Olavo Bilac Marinho, 645, Centro - Itapuranga/GO",
        phone: "(62) 3312-1190"
      },
      {
        id: "itapuranga_hosp_sc",
        name: "Hospital Santa Casa do Povo",
        lat: -15.560800,
        lon: -49.937400,
        address: "Av. Agoncílio da Silva Moreira, S/N, Parque Alvorada - Itapuranga/GO",
        phone: "(62) 3312-1200"
      }
    ];

    const predefinedPharmacies = [
      {
        id: "itapuranga_pharm_nr1",
        name: "Drogarias Nossa Rede (São Pedro)",
        lat: -15.561260,
        lon: -49.947018,
        address: "Rua 48, 1020, Centro - Itapuranga/GO",
        phone: "(62) 3312-1500"
      },
      {
        id: "itapuranga_pharm_fil",
        name: "Drogaria Filadélfia",
        lat: -15.562400,
        lon: -49.948500,
        address: "Rua 45, 899, Centro - Itapuranga/GO",
        phone: "(62) 3312-1800"
      },
      {
        id: "itapuranga_pharm_sp",
        name: "Farmácia São Pedro",
        lat: -15.561900,
        lon: -49.947800,
        address: "Rua 45, 1668, Centro - Itapuranga/GO",
        phone: "(62) 3312-2000"
      }
    ];

    predefinedHospitals.forEach(h => {
      hospitals.push({
        ...h,
        distance: getDistance(numLat, numLon, h.lat, h.lon)
      });
    });

    predefinedPharmacies.forEach(p => {
      pharmacies.push({
        ...p,
        distance: getDistance(numLat, numLon, p.lat, p.lon)
      });
    });
  }

  // Define optimized Overpass QL query using 'nwr' and expanded tags
  const query = `[out:json][timeout:8];(
    nwr["amenity"~"hospital|clinic|doctors|health_post|health_centre"](around:${radiusMeters},${numLat},${numLon});
    nwr["healthcare"~"hospital|clinic|centre|doctor"](around:${radiusMeters},${numLat},${numLon});
    nwr["amenity"="pharmacy"](around:${radiusMeters},${numLat},${numLon});
    nwr["healthcare"="pharmacy"](around:${radiusMeters},${numLat},${numLon});
    nwr["shop"~"pharmacy|chemist"](around:${radiusMeters},${numLat},${numLon});
    nwr["building"~"hospital|clinic"](around:${radiusMeters},${numLat},${numLon});
  );out center;`;

  // List of public Overpass mirrors to try in rotation
  const mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
  ];

  let rawElements = [];
  let querySuccess = false;
  const userAgent = 'iRecMedicalApp/1.0 (contact@irec.example.com)';

  // Try mirrors in sequence
  for (const mirror of mirrors) {
    console.log(`Querying Overpass mirror: ${mirror}...`);
    const url = `${mirror}?data=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout per mirror

    try {
      const res = await fetch(url, { 
        headers: { 'User-Agent': userAgent },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        rawElements = data.elements || [];
        querySuccess = true;
        console.log(`Overpass query succeeded on mirror ${mirror}. Found ${rawElements.length} elements.`);
        break; // Stop querying other mirrors
      } else {
        console.warn(`Mirror ${mirror} returned status ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`Mirror ${mirror} request timed out (4s limit reached).`);
      } else {
        console.warn(`Mirror ${mirror} error:`, err.message);
      }
    }
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

  return { hospitals, pharmacies };
}
