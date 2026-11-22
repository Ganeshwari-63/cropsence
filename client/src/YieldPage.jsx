import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from './locales/LanguageContext.jsx'
import { yieldText, cropNames, soilNames } from './locales/featureText.js'
import { formatLocationLabel, nameCoordinates } from './locationService.js'
import CropNameInput from './CropNameInput.jsx'
import { cropInputText, yieldOtherText } from './locales/cropInputText.js'

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
  const { language } = useLanguage()
  const t = yieldText[language] || yieldText.en
  const cropInput = cropInputText[language] || cropInputText.en
  const otherText = yieldOtherText[language] || yieldOtherText.en
  const names = cropNames[language] || cropNames.en
  const soils = soilNames[language] || soilNames.en
  const [place, setPlace] = useState(readSavedLocation)
  const [weather, setWeather] = useState(null)
  const [selectedCrop, setSelectedCrop] = useState(crops[0])
  const [otherCropSelected, setOtherCropSelected] = useState(false)
  const [otherCropName, setOtherCropName] = useState('')
  const [otherYieldRate, setOtherYieldRate] = useState('')
  const [area, setArea] = useState(1)
  const [unit, setUnit] = useState('acres')
  const [price, setPrice] = useState('')
  const [weatherError, setWeatherError] = useState('')

  useEffect(() => {
    if (!place) return
    let active = true
    nameCoordinates(place.latitude, place.longitude, language).then((named) => {
      if (!active || (named.name === place.name && named.region === place.region)) return
      const localized = { ...place, ...named }
      setPlace(localized)
      localStorage.setItem('cropsense-location', JSON.stringify(localized))
    }).catch(() => {
      if (!active || place.provider !== 'OpenStreetMap') return
      if (place.name === t.location && !place.region) return
      const fallback = { ...place, name: t.location, region: '' }
      setPlace(fallback)
      localStorage.setItem('cropsense-location', JSON.stringify(fallback))
    })
    return () => { active = false }
  }, [place, language, t.location])

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
      .catch(() => {
        if (stillOnPage) {
          setWeatherError(t.weatherError)
        }
      })

    return () => {
      stillOnPage = false
    }
  }, [place, t.weatherError])

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
  const customExpectedQuintals = Number(otherYieldRate) > 0
    ? Number(otherYieldRate) * area
    : null
  const resultQuintals = otherCropSelected ? customExpectedQuintals : expectedQuintals
  const expectedKg = resultQuintals === null ? null : resultQuintals * 100
  const estimatedIncome = price && resultQuintals !== null ? resultQuintals * Number(price) : null
  const selectedCropName = otherCropSelected
    ? otherCropName.trim() || cropInput.other
    : names[crops.indexOf(selectedCrop)]
  const quintalLabel = language === 'hi' ? 'क्विंटल' : language === 'kn' ? 'ಕ್ವಿಂಟಾಲ್' : language === 'ta' ? 'குவிண்டால்' : language === 'te' ? 'క్వிண்டాళ్లు' : language === 'ml' ? 'ക്വിന്റൽ' : language === 'bn' ? 'কুইন্টাল' : language === 'mr' ? 'क्विंटल' : language === 'pa' ? 'ਕੁਇੰਟਲ' : 'quintals'

  function toggleAreaUnit() {
    const nextUnit = unit === 'acres' ? 'hectares' : 'acres'
    setUnit(nextUnit)
    setOtherYieldRate((currentRate) => {
      if (!currentRate) return currentRate
      const convertedRate = Number(currentRate) * (nextUnit === 'hectares' ? 2.471 : 1 / 2.471)
      return convertedRate.toFixed(2)
    })
  }

  function changeArea(amount) {
    setArea((currentArea) => Math.max(0.5, currentArea + amount))
  }

  return (
    <main className="yield-page">
      <section className="yield-heading">
        <p className="section-label">{t.tag}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </section>

      <section className="yield-location">
        <h2>{t.location}</h2>

        {place ? (
          <>
            <p>
              {formatLocationLabel(place)}
            </p>
            <p>{t.soil}: {soils[['Black','Red','Sandy','Alluvial','Mountain'].indexOf(soil)] || soil}</p>
          </>
        ) : (
          <p>
            {t.noLocation}
          </p>
        )}

        <Link to="/weather">{t.weatherLink}</Link>

        {weatherError && <p className="error-message">{weatherError}</p>}
      </section>

      <section className="yield-controls">
        <div>
          <h2>{t.crop}</h2>

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
                onClick={() => {
                  setSelectedCrop(crop)
                  setOtherCropSelected(false)
                }}
                aria-pressed={selectedCrop.name === crop.name}
              >
                <span aria-hidden="true">{crop.icon}</span>
                {names[crops.indexOf(crop)]}
              </button>
            ))}
            <button
              className={otherCropSelected ? 'yield-crop selected' : 'yield-crop'}
              type="button"
              onClick={() => setOtherCropSelected(true)}
              aria-pressed={otherCropSelected}
            >
              <span aria-hidden="true">🌱</span>
              {cropInput.other}
            </button>
          </div>

          {otherCropSelected && (
            <div className="yield-other-crop-fields">
              <CropNameInput
                id="yield-other-crop-name"
                language={language}
                value={otherCropName}
                onChange={setOtherCropName}
              />
              <div className="crop-rate-picker">
                <label htmlFor="yield-other-crop-rate">
                  {otherText.rateLabel.replace('{unit}', unit === 'acres' ? t.acres : t.hectares)}
                </label>
                <input
                  id="yield-other-crop-rate"
                  type="number"
                  min="0"
                  step="0.1"
                  value={otherYieldRate}
                  onChange={(event) => setOtherYieldRate(event.target.value)}
                  placeholder="0"
                />
                <small>{otherText.rateHint}</small>
              </div>
            </div>
          )}
        </div>

        <div className="area-picker">
          <h2>{t.area}</h2>

          <div className="area-controls">
            <button
              type="button"
              onClick={() => changeArea(-0.5)}
              aria-label={t.decrease}
            >
              −
            </button>

            <strong>{area.toFixed(1)}</strong>

            <button
              type="button"
              onClick={() => changeArea(0.5)}
              aria-label={t.increase}
            >
              +
            </button>

            <button
              className="unit-button"
              type="button"
              onClick={toggleAreaUnit}
            >
              {unit === 'acres' ? t.acres : t.hectares}
            </button>
          </div>
        </div>

        <div className="price-picker">
          <label htmlFor="crop-price">
            {t.price}
          </label>

          <input
            id="crop-price"
            type="number"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={t.priceExample}
          />
        </div>
      </section>

      <section className="yield-result">
        <span className="yield-result-icon" aria-hidden="true">
          {otherCropSelected ? '🌱' : selectedCrop.icon}
        </span>

        <div>
          <p className="section-label">{t.estimate}</p>
          <h2>{selectedCropName}</h2>

          {!otherCropSelected && (
            <p className="yield-range">
              {lowEstimate.toFixed(1)}–{highEstimate.toFixed(1)} {quintalLabel}
            </p>
          )}

          {otherCropSelected ? (
            customExpectedQuintals !== null ? (
              <>
                <p>{t.expected}: {customExpectedQuintals.toFixed(1)} {quintalLabel} · {expectedKg.toFixed(0)} kg</p>
                <p className="yield-custom-note">{otherText.basedOnInput}</p>
              </>
            ) : (
              <p className="yield-custom-note">{otherText.rateHint}</p>
            )
          ) : (
            <p>
              {t.expected}: {expectedQuintals.toFixed(1)} · {expectedKg.toFixed(0)} kg
            </p>
          )}

          {estimatedIncome !== null && (
            <p className="estimated-income">
              {t.income}: ₹
              {estimatedIncome.toLocaleString(language === 'en' ? 'en-IN' : `${language}-IN`, {
                maximumFractionDigits: 0,
              })}
            </p>
          )}

          {recentRain !== null && (
            <>
              <p>
                {t.rain}: {recentRain.toFixed(1)} mm
              </p>
            </>
          )}
        </div>
      </section>

      <p className="yield-disclaimer">
        {t.disclaimer}
      </p>
    </main>
  )
}
