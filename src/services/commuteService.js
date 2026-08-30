/**
 * Google Maps Commute Intelligence Service
 * Estimates daily commute duration, route details, peak/off-peak driving times,
 * toll costs, and public transit (train/tram) & cycling estimates.
 */

// Expanded coordinate index for Greater Melbourne & Australian Suburbs
export const SUBURB_GEO_DATABASE = {
  'balaclava': { lat: -37.8697, lon: 144.9961, hasTrain: true, trainLine: 'Sandringham Line' },
  'st kilda': { lat: -37.8640, lon: 144.9820, hasTrain: false, trainLine: 'Tram 16 / 96' },
  'st kilda road': { lat: -37.8420, lon: 144.9750, hasTrain: false, trainLine: 'Tram Corridor' },
  'prahran': { lat: -37.8500, lon: 144.9960, hasTrain: true, trainLine: 'Sandringham Line' },
  'windsor': { lat: -37.8550, lon: 144.9910, hasTrain: true, trainLine: 'Sandringham Line' },
  'elsternwick': { lat: -37.8845, lon: 145.0028, hasTrain: true, trainLine: 'Sandringham Line' },
  'caulfield': { lat: -37.8770, lon: 145.0420, hasTrain: true, trainLine: 'Frankston / Pakenham / Cranbourne Line' },
  'south yarra': { lat: -37.8390, lon: 144.9920, hasTrain: true, trainLine: 'Pakenham / Cranbourne / Frankston / Sandringham' },
  'richmond': { lat: -37.8230, lon: 144.9980, hasTrain: true, trainLine: 'Major Transit Hub (All Eastern Lines)' },
  'cremorne': { lat: -37.8280, lon: 144.9930, hasTrain: true, trainLine: 'Richmond / East Richmond Station' },
  'melbourne cbd': { lat: -37.8136, lon: 144.9631, hasTrain: true, trainLine: 'City Loop (Flinders St / Central)' },
  'cbd': { lat: -37.8136, lon: 144.9631, hasTrain: true, trainLine: 'City Loop' },
  'docklands': { lat: -37.8180, lon: 144.9450, hasTrain: true, trainLine: 'Southern Cross / City Circle Tram' },
  'southbank': { lat: -37.8250, lon: 144.9640, hasTrain: true, trainLine: 'Flinders Street Station Access' },
  'port melbourne': { lat: -37.8390, lon: 144.9350, hasTrain: false, trainLine: 'Tram 109' },
  'south melbourne': { lat: -37.8330, lon: 144.9570, hasTrain: false, trainLine: 'Tram 1 / 12 / 96' },
  'collingwood': { lat: -37.8030, lon: 144.9880, hasTrain: true, trainLine: 'Mernda / Hurstbridge Line' },
  'fitzroy': { lat: -37.7980, lon: 144.9780, hasTrain: false, trainLine: 'Tram 11 / 96' },
  'carlton': { lat: -37.8010, lon: 144.9670, hasTrain: false, trainLine: 'Swanston St Tram Corridor' },
  'hawthorn': { lat: -37.8220, lon: 145.0350, hasTrain: true, trainLine: 'Belgrave / Lilydale / Alamein Line' },
  'camberwell': { lat: -37.8330, lon: 145.0570, hasTrain: true, trainLine: 'Belgrave / Lilydale Line' },
  'kew': { lat: -37.8080, lon: 145.0320, hasTrain: false, trainLine: 'Tram 48 / 109' },
  'clayton': { lat: -37.9150, lon: 145.1290, hasTrain: true, trainLine: 'Pakenham / Cranbourne Line' },
  'mulgrave': { lat: -37.9300, lon: 145.1850, hasTrain: false, trainLine: 'Monash Bus Corridor' },
  'box hill': { lat: -37.8190, lon: 145.1220, hasTrain: true, trainLine: 'Belgrave / Lilydale Line' },
  'dandenong': { lat: -37.9870, lon: 145.2150, hasTrain: true, trainLine: 'Pakenham / Cranbourne Line' },
  'footscray': { lat: -37.8010, lon: 144.9010, hasTrain: true, trainLine: 'Sunbury / Werribee / Williamstown Line' },
  'tullamarine': { lat: -37.7050, lon: 144.8830, hasTrain: false, trainLine: 'SkyBus / Airport Express' },
  'ringwood': { lat: -37.8140, lon: 145.2280, hasTrain: true, trainLine: 'Belgrave / Lilydale Line' },
  'brighton': { lat: -37.9060, lon: 144.9990, hasTrain: true, trainLine: 'Sandringham Line' },
  'moorabbin': { lat: -37.9340, lon: 145.0370, hasTrain: true, trainLine: 'Frankston Line' },
  'cheltenham': { lat: -37.9660, lon: 145.0550, hasTrain: true, trainLine: 'Frankston Line' },
  'alton': { lat: -37.8680, lon: 144.8310, hasTrain: true, trainLine: 'Werribee Line' },
  'werribee': { lat: -37.9000, lon: 144.6600, hasTrain: true, trainLine: 'Werribee Line' },
  'geelong': { lat: -38.1499, lon: 144.3617, hasTrain: true, trainLine: 'V/Line Regional' },
  'sydney': { lat: -33.8688, lon: 151.2093, hasTrain: true, trainLine: 'Sydney Trains Network' },
  'brisbane': { lat: -27.4705, lon: 153.0260, hasTrain: true, trainLine: 'Queensland Rail Network' }
};

/**
 * Extract coordinates from a location string
 */
export const lookupLocationCoords = (locationStr = '') => {
  const loc = (locationStr || '').toLowerCase();
  
  for (const [suburb, data] of Object.entries(SUBURB_GEO_DATABASE)) {
    if (loc.includes(suburb)) {
      return { suburb, ...data };
    }
  }

  // Fallback defaults
  if (loc.includes('melbourne') || loc.includes('vic')) {
    return { suburb: 'melbourne cbd', ...SUBURB_GEO_DATABASE['melbourne cbd'] };
  }

  return { suburb: 'melbourne cbd', ...SUBURB_GEO_DATABASE['melbourne cbd'] };
};

/**
 * Calculates Haversine distance in km
 */
export const calculateDistanceKm = (originLoc, destLoc) => {
  const o = lookupLocationCoords(originLoc);
  const d = lookupLocationCoords(destLoc);

  const R = 6371;
  const dLat = (d.lat - o.lat) * (Math.PI / 180);
  const dLon = (d.lon - o.lon) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(o.lat * (Math.PI / 180)) * Math.cos(d.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Determine Toll Roads & Costs
 * (e.g. CityLink, EastLink, West Gate Tunnel based on origin/destination)
 */
export const estimateTolls = (originSuburb, destSuburb, distanceKm) => {
  const o = (originSuburb || '').toLowerCase();
  const d = (destSuburb || '').toLowerCase();

  // If travel is within same local region, no tolls
  if (distanceKm <= 7 && (o.includes('balaclava') || o.includes('st kilda') || o.includes('prahran')) && (d.includes('cbd') || d.includes('southbank') || d.includes('south yarra'))) {
    return { hasTolls: false, estimatedCost: '$0.00', tollRoads: 'Free Route (St Kilda Rd / Kings Way)' };
  }

  // Crossing to Northern/Western suburbs from SE often takes CityLink (Bolte/Tunnels)
  const isWestOrNorth = d.includes('tullamarine') || d.includes('footscray') || d.includes('alton') || d.includes('werribee') || d.includes('docklands');
  const isFarEast = d.includes('ringwood') || d.includes('dandenong') || d.includes('mulgrave');

  if (isWestOrNorth && distanceKm > 10) {
    return {
      hasTolls: true,
      estimatedCost: '$6.40 – $9.80',
      tollRoads: 'CityLink (Domain Tunnel / Bolte Bridge)'
    };
  }

  if (isFarEast && distanceKm > 20) {
    return {
      hasTolls: true,
      estimatedCost: '$4.20 – $7.50',
      tollRoads: 'EastLink / Monash Fwy'
    };
  }

  if (distanceKm > 25) {
    return {
      hasTolls: true,
      estimatedCost: '$5.50 – $8.90',
      tollRoads: 'CityLink Tollway'
    };
  }

  return { hasTolls: false, estimatedCost: '$0.00', tollRoads: 'Toll-free Arterials' };
};

/**
 * Calculate Comprehensive Commute Breakdown
 */
export const getCommuteDetails = (originLoc = 'BALACLAVA VIC 3183', destLoc = 'Melbourne VIC') => {
  const origin = lookupLocationCoords(originLoc);
  const dest = lookupLocationCoords(destLoc);
  const distanceKm = Math.max(1, calculateDistanceKm(originLoc, destLoc));

  const isRemote = (destLoc || '').toLowerCase().includes('remote') || (destLoc || '').toLowerCase().includes('work from home');

  if (isRemote) {
    return {
      isRemote: true,
      distanceKm: 0,
      transit: { durationMin: 0, label: '0 min (Remote)', lines: 'Work from Home' },
      car: { peakMin: 0, offPeakMin: 0, peakLabel: '0 min', offPeakLabel: '0 min', tolls: { hasTolls: false, estimatedCost: '$0.00' } },
      bike: { durationMin: 0, label: '0 min', bikePaths: 'N/A' },
      googleMapsUrls: {
        transit: '#',
        driving: '#',
        bicycling: '#'
      }
    };
  }

  // 1. Driving: Base average ~45 km/h in metro
  // Off-Peak: ~35-50 km/h + 3 min signal buffer
  const offPeakMin = Math.max(5, Math.round((distanceKm / 42) * 60) + 4);
  // Peak Hours (8:00 AM / 5:30 PM): Congestion factor 1.5x - 1.8x
  const peakMultiplier = distanceKm > 15 ? 1.65 : 1.45;
  const peakMin = Math.max(offPeakMin + 5, Math.round(offPeakMin * peakMultiplier));

  // 2. Public Transit (Train / Tram)
  // Sandringham line to CBD is ~14 mins + 4 min walk
  let transitMin = 0;
  let transitLine = origin.trainLine || 'Metro Train';

  if (distanceKm <= 8 && (dest.suburb.includes('cbd') || dest.suburb.includes('southbank') || dest.suburb.includes('richmond'))) {
    transitMin = 18; // ~14 min train + 4 min walk
    transitLine = 'Sandringham Line Direct (15m freq)';
  } else if (distanceKm <= 15) {
    transitMin = Math.round(distanceKm * 2.2) + 8;
    transitLine = `${origin.trainLine} + Connection`;
  } else {
    transitMin = Math.round(distanceKm * 2.4) + 12;
    transitLine = 'Metro Train / Bus Network';
  }

  // 3. Bicycle (Avg speed 18 km/h + 3 min trail connection)
  const bikeMin = Math.round((distanceKm / 18) * 60) + 3;
  const bikePaths = distanceKm <= 10 ? 'Bay Trail / St Kilda Rd Bike Lane' : 'Main Yarra Trail / Capital City Trail';

  // 4. Tolls
  const tolls = estimateTolls(origin.suburb, dest.suburb, distanceKm);

  // 5. Google Maps Direct Navigation URLs
  const cleanOrigin = encodeURIComponent(originLoc || 'Balaclava VIC');
  const cleanDest = encodeURIComponent(destLoc || 'Melbourne VIC');
  
  const googleMapsUrls = {
    transit: `https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=transit`,
    driving: `https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=driving`,
    bicycling: `https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=bicycling`
  };

  return {
    isRemote: false,
    distanceKm,
    originSuburb: origin.suburb,
    destSuburb: dest.suburb,
    transit: {
      durationMin: transitMin,
      label: `${transitMin} mins`,
      lines: transitLine
    },
    car: {
      peakMin,
      offPeakMin,
      peakLabel: `${peakMin} mins (Peak 8am/5pm)`,
      offPeakLabel: `${offPeakMin} mins (Off-Peak)`,
      tolls
    },
    bike: {
      durationMin: bikeMin,
      label: `${bikeMin} mins`,
      bikePaths
    },
    googleMapsUrls
  };
};
