import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const crops = [
  { name: 'Rice', icon: '🌾', yieldPerAcre: 18, soils: ['Alluvial', 'Red', 'Laterite'], minRain: 100, maxRain: 900 },
  { name: 'Wheat', icon: '🌾', yieldPerAcre: 16, soils: ['Alluvial', 'Black'], minRain: 0, maxRain: 150 },
  { name: 'Maize', icon: '🌽', yieldPerAcre: 14, soils: ['Red', 'Alluvial', 'Black'], minRain: 30, maxRain: 400 },
  { name: 'Cotton', icon: '☁️', yieldPerAcre: 8, soils: ['Black', 'Red'], minRain: 30, maxRain: 500 },
  { name: 'Sugarcane', icon: '🎋', yieldPerAcre: 35, soils: ['Alluvial', 'Black', 'Red'], minRain: 50, maxRain: 700 },
  { name: 'Groundnut', icon: '🥜', yieldPerAcre: 8, soils: ['Sandy', 'Red'], minRain: 30, maxRain: 400 },
  { name: 'Soybean', icon: '🫘', yieldPerAcre: 9, soils: ['Black', 'Red'], minRain: 40, maxRain: 500 },
  { name: 'Ragi', icon: '🌱', yieldPerAcre: 7, soils: ['Red', 'Laterite', 'Mountain'], minRain: 20, maxRain: 350 },
  { name: 'Jowar', icon: '🌾', yieldPerAcre: 7, soils: ['Black', 'Red'], minRain: 15, maxRain: 300 },
  { name: 'Tur', icon: '🌿', yieldPerAcre: 4, soils: ['Black', 'Red'], minRain: 20, maxRain: 400 },
  { name: 'Gram', icon: '🫘', yieldPerAcre: 5, soils: ['Black', 'Alluvial'], minRain: 0, maxRain: 150 },
  { name: 'Mustard', icon: '🌼', yieldPerAcre: 6, soils: ['Alluvial', 'Sandy'], minRain: 0, maxRain: 150 },
  { name: 'Potato', icon: '🥔', yieldPerAcre: 10, soils: ['Alluvial', 'Red'], minRain: 10, maxRain: 250 },
  { name: 'Tomato', icon: '🍅', yieldPerAcre: 12, soils: ['Red', 'Alluvial'], minRain: 10, maxRain: 250 },
  { name: 'Onion', icon: '🧅', yieldPerAcre: 12, soils: ['Red', 'Alluvial', 'Black'], minRain: 5, maxRain: 200 },
]

function readSavedLocation() {
  try {
    const saved = localStorage.getItem('cropsense-location')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function guessSoil(stateName = '') {
  const state = stateName.toLowerCase()

  if (state.includes('rajasthan')) return 'Sandy'

  if (
    state.includes('maharashtra') ||
    state.includes('madhya pradesh') ||
    state.includes('gujarat') ||
    state.includes('telangana')
  ) {
    return 'Black'
  }

  if (
    state.includes('karnataka') ||
    state.includes('tamil nadu') ||
    state.includes('andhra') ||
    state.includes('odisha') ||
    state.includes('kerala')
  ) {
    return 'Red'
  }

  if (
    state.includes('himachal') ||
    state.includes('uttarakhand') ||
    state.includes('sikkim')
  ) {
    return 'Mountain'
  }

  return 'Alluvial'
}

export default function YieldPage() {
  const [place] = useState(readSavedLocation)
  const [weather, setWeather] = useState(null)
  const [selectedCrop, setSelectedCrop] = useState(crops[0])
  const [area, setArea] = useState(1)
  const [unit, setUnit] = useState('acres')
  const [price, setPrice] = useState('')
  const [weatherError, setWeatherError] = useState('')

  useEffect(() => {
    if (!place) return

    let stillOnPage = true

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${place.latitude}` +
      `&longitude=${place.longitude}` +
      `&daily=precipitation_sum` +
      `&past_days=30&forecast_days=5&timezone=auto`

    fetch(weatherUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not read local rainfall data.')
        }

        return response.json()
      })
      .then((data) => {
        if (stillOnPage) setWeather(data)
      })
      .catch((error) => {
        if (stillOnPage) {
          setWeatherError(error.message || 'Rainfall data is unavailable.')
        }
      })

    return () => {
      stillOnPage = false
    }
  }, [place])

  const soil = guessSoil(place?.state || place?.region || '')
  const recentRain =
    weather?.daily?.precipitation_sum
      ?.slice(0, -5)
      .reduce((total, amount) => total + (amount || 0), 0) ?? null

  const areaInAcres = unit === 'hectares' ? area * 2.471 : area
  const soilFactor = selectedCrop.soils.includes(soil) ? 0.95 : 0.75

  let rainfallFactor = 1

  if (recentRain !== null && recentRain < selectedCrop.minRain) {
    rainfallFactor = 0.85
  } else if (recentRain !== null && recentRain > selectedCrop.maxRain) {
    rainfallFactor = 0.8
  }

  const expectedQuintals =
    selectedCrop.yieldPerAcre * areaInAcres * soilFactor * rainfallFactor

  const lowEstimate = expectedQuintals * 0.8
  const highEstimate = expectedQuintals * 1.2
  const expectedKg = expectedQuintals * 100
  const estimatedIncome = price ? expectedQuintals * Number(price) : null

  function changeArea(amount) {
    setArea((currentArea) => Math.max(0.5, currentArea + amount))
  }

  return (
    <main className="yield-page">
      <section className="yield-heading">
        <p className="section-label">HARVEST PLANNING</p>
        <h1>Yield estimate</h1>
        <p>
          Choose a crop and land area to see a planning range for your harvest.
        </p>
      </section>

      <section className="yield-location">
        <h2>Your location</h2>

        {place ? (
          <>
            <p>
              {place.name} · {place.region}
            </p>
            <p>Regional soil estimate: {soil}</p>
          </>
        ) : (
          <p>
            No location is saved yet. Choose a location on the Weather or Crop
            page to include local conditions.
          </p>
        )}

        <Link to="/weather">Choose a location on the Weather page</Link>

        {weatherError && <p className="error-message">{weatherError}</p>}
      </section>

      <section className="yield-controls">
        <div>
          <h2>Choose a crop</h2>

          <div className="yield-crop-grid">
            {crops.map((crop) => (
              <button
                className={
                  selectedCrop.name === crop.name
                    ? 'yield-crop selected'
                    : 'yield-crop'
                }
                type="button"
                key={crop.name}
                onClick={() => setSelectedCrop(crop)}
                aria-pressed={selectedCrop.name === crop.name}
              >
                <span aria-hidden="true">{crop.icon}</span>
                {crop.name}
              </button>
            ))}
          </div>
        </div>

        <div className="area-picker">
          <h2>Land area</h2>

          <div className="area-controls">
            <button
              type="button"
              onClick={() => changeArea(-0.5)}
              aria-label="Decrease land area"
            >
              −
            </button>

            <strong>{area.toFixed(1)}</strong>

            <button
              type="button"
              onClick={() => changeArea(0.5)}
              aria-label="Increase land area"
            >
              +
            </button>

            <button
              className="unit-button"
              type="button"
              onClick={() =>
                setUnit((currentUnit) =>
                  currentUnit === 'acres' ? 'hectares' : 'acres'
                )
              }
            >
              {unit}
            </button>
          </div>
        </div>

        <div className="price-picker">
          <label htmlFor="crop-price">
            Market price per quintal (optional)
          </label>

          <input
            id="crop-price"
            type="number"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="For example: 2200"
          />
        </div>
      </section>

      <section className="yield-result">
        <span className="yield-result-icon" aria-hidden="true">
          {selectedCrop.icon}
        </span>

        <div>
          <p className="section-label">PLANNING ESTIMATE</p>
          <h2>{selectedCrop.name}</h2>

          <p className="yield-range">
            {lowEstimate.toFixed(1)}–{highEstimate.toFixed(1)} quintals
          </p>

          <p>
            Expected: {expectedQuintals.toFixed(1)} quintals ·{' '}
            {expectedKg.toFixed(0)} kg
          </p>

          {estimatedIncome !== null && (
            <p className="estimated-income">
              Approximate gross income: ₹
              {estimatedIncome.toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </p>
          )}

          {recentRain !== null && (
            <p>
              Rain over the previous 30 days: {recentRain.toFixed(1)} mm
            </p>
          )}
        </div>
      </section>

      <p className="yield-disclaimer">
        An estimate for planning, not a guarantee. Actual harvests depend on
        seed, field conditions, water, and farming practices.
      </p>
    </main>
  )
}