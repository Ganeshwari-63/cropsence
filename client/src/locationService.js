const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

const indiaPlaceNames = {
  bangalore: 'Bengaluru',
  mysore: 'Mysuru',
  calcutta: 'Kolkata',
  bombay: 'Mumbai',
  madras: 'Chennai',
  mangalore: 'Mangaluru',
  belgaum: 'Belagavi',
  gulbarga: 'Kalaburagi',
  hubli: 'Hubballi',
  cochin: 'Kochi',
  coimbatore: 'Coimbatore',
  trichur: 'Thrissur',
  trivandrum: 'Thiruvananthapuram',
  pondicherry: 'Puducherry',
}

function normalizeLocationName(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(',')
    .map((part, index) => {
      const trimmed = part.trim()
      return index === 0
        ? indiaPlaceNames[trimmed.toLowerCase()] || trimmed
        : trimmed
    })
    .join(', ')
}

async function geocodeIndia(query, language = 'en') {
  const params = new URLSearchParams({
    name: normalizeLocationName(query),
    count: '10',
    language,
    format: 'json',
    countryCode: 'IN',
  })
  const response = await fetch(`${GEOCODING_URL}?${params}`)

  if (!response.ok) {
    throw new Error('The place search is temporarily unavailable. Please try again.')
  }

  const data = await response.json()

  return (data.results || [])
    .filter((result) => result.country_code === 'IN')
    .sort((first, second) => {
      const localityCodes = ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPL']
      const firstIsLocality = localityCodes.includes(first.feature_code) ? 1 : 0
      const secondIsLocality = localityCodes.includes(second.feature_code) ? 1 : 0

      return secondIsLocality - firstIsLocality ||
        (second.population || 0) - (first.population || 0)
    })
}

function makeLocation(result, postalDetails = null) {
  const regionParts = postalDetails
    ? [postalDetails.district, postalDetails.state]
    : [result.admin2, result.admin1, result.country]
  const region = [...new Set(regionParts.filter(Boolean))].join(', ')

  return {
    name: result.name,
    region,
    state: result.admin1 || postalDetails?.state || '',
    latitude: result.latitude,
    longitude: result.longitude,
    postcode: postalDetails?.postcode || '',
    postOffice: postalDetails?.postOffice || '',
    provider: postalDetails ? 'India Post' : 'GeoNames',
  }
}

async function lookupPinCode(pinCode) {
  const response = await fetch(`/api/pincode/${pinCode}`)

  if (response.status === 404) {
    throw new Error('That PIN code was not found. Check all six digits and try again.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'The PIN code service is unavailable. Please try again.')
  }

  return data
}

export async function findLocation(searchText, language = 'en') {
  const query = searchText.trim().replace(/\s+/g, ' ')

  if (!query) {
    throw new Error('Enter a town name or six-digit PIN code.')
  }

  if (/^\d+$/.test(query) && !/^\d{6}$/.test(query)) {
    throw new Error('An Indian PIN code has six digits. Please enter all six.')
  }

  if (/^\d{6}$/.test(query)) {
    const pinData = await lookupPinCode(query)
    const offices = pinData.offices || []
    const office = offices.find((item) => item.deliveryStatus === 'Delivery') || offices[0]

    if (!office) {
      throw new Error('No post office was found for that PIN code.')
    }

    const postalDetails = {
      postcode: query,
      postOffice: office.name,
      district: office.district,
      state: office.state,
    }

    if (
      Number.isFinite(office.latitude) &&
      Number.isFinite(office.longitude)
    ) {
      let localized = null
      try { localized = await nameCoordinates(office.latitude, office.longitude, language) } catch { /* Keep the postal service result if reverse lookup is unavailable. */ }
      return {
        name: localized?.name || office.name.replace(/\s+(?:H\.\s*O|S\.\s*O|B\.\s*O)$/i, '').trim(),
        region: localized?.region || [office.district, office.state].filter(Boolean).join(', '),
        state: office.state || '',
        latitude: office.latitude,
        longitude: office.longitude,
        postcode: query,
        postOffice: office.name,
        provider: localized?.provider || 'India Post',
      }
    }

    const searchTerms = [
      [office.name, office.district, office.state].filter(Boolean).join(', '),
      [office.name, office.state].filter(Boolean).join(', '),
      [office.district, office.state].filter(Boolean).join(', '),
    ]

    for (const searchTerm of [...new Set(searchTerms)]) {
      const results = await geocodeIndia(searchTerm, language)

      if (results.length > 0) {
        return makeLocation(results[0], postalDetails)
      }
    }

    throw new Error('The PIN was found, but its town could not be mapped. Try the nearby town name.')
  }

  const results = await geocodeIndia(query, language)

  if (results.length === 0) {
    throw new Error('I could not find that Indian town. Try adding its district or state.')
  }

  const requestedName = normalizeLocationName(query.split(',')[0]).toLowerCase()
  const exactMatch = results.find(
    (result) => result.name.trim().toLowerCase() === requestedName
  )
  const result = exactMatch || results[0]

  return makeLocation(result)
}

export async function nameCoordinates(latitude, longitude, language = 'en') {
  const response = await fetch(`/api/reverse-geocode?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&language=${encodeURIComponent(language)}`)
  if (!response.ok) throw new Error('Could not resolve your location name.')
  return { ...(await response.json()), provider: 'OpenStreetMap' }
}

export function formatLocationLabel(place) {
  if (!place) return ''

  const label = [place.name, place.region].filter(Boolean).join(' · ')
  return place.postcode ? `${label} · PIN ${place.postcode}` : label
}
