import { useEffect, useMemo, useState } from 'react'
import { findLocation, formatLocationLabel } from './locationService.js'

const crops = [
  {
    name: 'Rice',
    hindi: 'धान',
    kannada: 'ಅಕ್ಕಿ',
    icon: '🌾',
    seasons: ['Kharif'],
    soils: ['Alluvial', 'Red', 'Laterite'],
    minTemp: 20,
    maxTemp: 35,
    minRain: 100,
    maxRain: 900,
  },
  {
    name: 'Wheat',
    hindi: 'गेहूँ',
    kannada: 'ಗೋಧಿ',
    icon: '🌾',
    seasons: ['Rabi'],
    soils: ['Alluvial', 'Black'],
    minTemp: 10,
    maxTemp: 25,
    minRain: 0,
    maxRain: 150,
  },
  {
    name: 'Maize',
    hindi: 'मक्का',
    kannada: 'ಮೆಕ್ಕೆಜೋಳ',
    icon: '🌽',
    seasons: ['Kharif', 'Rabi'],
    soils: ['Red', 'Alluvial', 'Black'],
    minTemp: 18,
    maxTemp: 32,
    minRain: 30,
    maxRain: 400,
  },
  {
    name: 'Cotton',
    hindi: 'कपास',
    kannada: 'ಹತ್ತಿ',
    icon: '☁️',
    seasons: ['Kharif'],
    soils: ['Black', 'Red'],
    minTemp: 21,
    maxTemp: 35,
    minRain: 30,
    maxRain: 500,
  },
  {
    name: 'Sugarcane',
    hindi: 'गन्ना',
    kannada: 'ಕಬ್ಬು',
    icon: '🎋',
    seasons: ['Kharif', 'Rabi'],
    soils: ['Alluvial', 'Black', 'Red'],
    minTemp: 20,
    maxTemp: 38,
    minRain: 50,
    maxRain: 700,
  },
  {
    name: 'Groundnut',
    hindi: 'मूंगफली',
    kannada: 'ಕಡಲೆಕಾಯಿ',
    icon: '🥜',
    seasons: ['Kharif'],
    soils: ['Sandy', 'Red'],
    minTemp: 20,
    maxTemp: 32,
    minRain: 30,
    maxRain: 400,
  },
  {
    name: 'Soybean',
    hindi: 'सोयाबीन',
    kannada: 'ಸೋಯಾಬೀನ್',
    icon: '🫘',
    seasons: ['Kharif'],
    soils: ['Black', 'Red'],
    minTemp: 20,
    maxTemp: 32,
    minRain: 40,
    maxRain: 500,
  },
  {
    name: 'Ragi',
    hindi: 'रागी',
    kannada: 'ರಾಗಿ',
    icon: '🌱',
    seasons: ['Kharif'],
    soils: ['Red', 'Laterite', 'Mountain'],
    minTemp: 18,
    maxTemp: 32,
    minRain: 20,
    maxRain: 350,
  },
  {
    name: 'Jowar',
    hindi: 'ज्वार',
    kannada: 'ಜೋಳ',
    icon: '🌾',
    seasons: ['Kharif', 'Rabi'],
    soils: ['Black', 'Red'],
    minTemp: 20,
    maxTemp: 35,
    minRain: 15,
    maxRain: 300,
  },
  {
    name: 'Tur',
    hindi: 'तूर',
    kannada: 'ತೊಗರಿ',
    icon: '🌿',
    seasons: ['Kharif'],
    soils: ['Black', 'Red'],
    minTemp: 20,
    maxTemp: 35,
    minRain: 20,
    maxRain: 400,
  },
  {
    name: 'Gram',
    hindi: 'चना',
    kannada: 'ಕಡಲೆ',
    icon: '🫘',
    seasons: ['Rabi'],
    soils: ['Black', 'Alluvial'],
    minTemp: 10,
    maxTemp: 28,
    minRain: 0,
    maxRain: 150,
  },
  {
    name: 'Mustard',
    hindi: 'सरसों',
    kannada: 'ಸಾಸಿವೆ',
    icon: '🌼',
    seasons: ['Rabi'],
    soils: ['Alluvial', 'Sandy'],
    minTemp: 10,
    maxTemp: 28,
    minRain: 0,
    maxRain: 150,
  },
  {
    name: 'Potato',
    hindi: 'आलू',
    kannada: 'ಆಲೂಗಡ್ಡೆ',
    icon: '🥔',
    seasons: ['Rabi'],
    soils: ['Alluvial', 'Red'],
    minTemp: 10,
    maxTemp: 25,
    minRain: 10,
    maxRain: 250,
  },
  {
    name: 'Tomato',
    hindi: 'टमाटर',
    kannada: 'ಟೊಮೇಟೊ',
    icon: '🍅',
    seasons: ['Rabi', 'Zaid'],
    soils: ['Red', 'Alluvial'],
    minTemp: 18,
    maxTemp: 32,
    minRain: 10,
    maxRain: 250,
  },
  {
    name: 'Onion',
    hindi: 'प्याज',
    kannada: 'ಈರುಳ್ಳಿ',
    icon: '🧅',
    seasons: ['Rabi', 'Zaid'],
    soils: ['Red', 'Alluvial', 'Black'],
    minTemp: 15,
    maxTemp: 32,
    minRain: 5,
    maxRain: 200,
  },
]

function readSavedLocation() {
  try {
    const saved = localStorage.getItem('cropsense-location')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function getSeason(date) {
  const month = date.getMonth()

  if (month >= 5 && month <= 9) return 'Kharif'
  if (month === 10 || month === 11 || month <= 2) return 'Rabi'
  return 'Zaid'
}

export default function CropPage() {
  const [searchText, setSearchText] = useState('')
  const [place, setPlace] = useState(readSavedLocation)
  const [weatherResult, setWeatherResult] = useState(null)
  const [soilOverride, setSoilOverride] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const placeKey = place ? `${place.latitude},${place.longitude}` : ''
  const weather = weatherResult?.placeKey === placeKey ? weatherResult.data : null

  const season = getSeason(new Date())
  const soil = soilOverride
  const temperature = weather?.current?.temperature_2m
  const recentRain =
    weather?.daily?.precipitation_sum
      ?.slice(0, -5)
      .reduce((total, amount) => total + (amount || 0), 0) ?? null

  useEffect(() => {
    if (!place) return

    let stillOnPage = true

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${place.latitude}` +
      `&longitude=${place.longitude}` +
      `&current=temperature_2m` +
      `&daily=precipitation_sum` +
      `&past_days=30&forecast_days=5&timezone=auto`

    fetch(weatherUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Weather data is unavailable right now.')
        }

        return response.json()
      })
      .then((data) => {
        if (stillOnPage) {
          setWeatherResult({
            placeKey: `${place.latitude},${place.longitude}`,
            data,
          })
        }
      })
      .catch((weatherError) => {
        if (stillOnPage) {
          setError(weatherError.message || 'Could not load weather data.')
        }
      })

    return () => {
      stillOnPage = false
    }
  }, [place, placeKey])

  const recommendations = useMemo(() => {
    if (!weather || temperature == null || recentRain == null) return []

    return crops
      .map((crop) => {
        const seasonMatch = crop.seasons.includes(season)
        const temperatureMatch =
          temperature >= crop.minTemp && temperature <= crop.maxTemp
        const rainfallMatch =
          recentRain >= crop.minRain && recentRain <= crop.maxRain
        const soilMatch = soil ? crop.soils.includes(soil) : null
        const matchCount = [
          seasonMatch,
          temperatureMatch,
          rainfallMatch,
          soil ? soilMatch : null,
        ].filter(Boolean).length

        return {
          ...crop,
          seasonMatch,
          temperatureMatch,
          rainfallMatch,
          soilMatch,
          matchCount,
        }
      })
      .filter(
        (crop) =>
          crop.seasonMatch &&
          crop.temperatureMatch &&
          crop.rainfallMatch &&
          (soil ? crop.soilMatch : true)
      )
      .sort((first, second) =>
        second.matchCount - first.matchCount ||
        Number(second.seasonMatch) - Number(first.seasonMatch)
      )
      .slice(0, 3)
  }, [season, soil, temperature, recentRain, weather])

  async function handleSearch(event) {
    event.preventDefault()

    if (!searchText.trim()) return

    setLoading(true)
    setError('')

    try {
      const foundPlace = await findLocation(searchText)
      setPlace(foundPlace)
      localStorage.setItem('cropsense-location', JSON.stringify(foundPlace))
      setSearchText('')
    } catch (searchError) {
      setError(searchError.message || 'Could not find that location.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="crop-page">
      <section className="crop-heading">
        <p className="section-label">CROP PLANNING</p>
        <h1>Crop recommendations</h1>
        <p>
          Compare crops against the current season and local weather. Add your
          soil type only if you know it.
        </p>
      </section>

      <section className="crop-location-card">
        <h2>Your location</h2>
        <p>
          {place
            ? formatLocationLabel(place)
            : 'Search for a town or enter a 6-digit Indian PIN code.'}
        </p>

        <form className="location-form" onSubmit={handleSearch}>
          <label htmlFor="crop-place-search">Town, district, or PIN code</label>
          <div className="location-form-row">
            <input
              id="crop-place-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="For example: Mysuru or 570001"
              inputMode={searchText.length > 0 && /^\d*$/.test(searchText) ? 'numeric' : 'search'}
              autoComplete="off"
              maxLength={100}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={loading || !searchText.trim()}
            >
              {loading ? 'Please wait…' : 'Find location'}
            </button>
          </div>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>

      {place && (
        <>
          <section className="soil-card">
            <div>
              <p className="section-label">OPTIONAL FIELD DETAIL</p>
              <h2>{soil ? `Selected field soil: ${soil}` : 'Do you know your field soil?'}</h2>
              <p>Soil is not guessed from your state. Leave “Not sure” unless you know your field soil.</p>
            </div>

            <div className="soil-options" aria-label="Choose a different soil">
              {['Not sure', 'Black', 'Red', 'Sandy', 'Alluvial'].map((soilType) => {
                const value = soilType === 'Not sure' ? '' : soilType

                return (
                <button
                  className={soil === value ? 'soil-option selected' : 'soil-option'}
                  key={soilType}
                  type="button"
                  onClick={() => setSoilOverride(value)}
                >
                  {soilType}
                </button>
                )
              })}
            </div>
          </section>

          <p className="crop-context">
            Season: <strong>{season}</strong>
            {temperature != null && (
              <>
                {' · '}
                Temperature: <strong>{Math.round(temperature)}°C</strong>
              </>
            )}
            {recentRain != null && (
              <>
                {' · '}
                Rain in the last 30 days: <strong>{recentRain.toFixed(0)} mm</strong>
              </>
            )}
          </p>

          {!weather && !error && (
            <p className="loading-message">
              Checking local weather to improve the crop matches…
            </p>
          )}

          {weather && (
            <section className="crop-results">
            <h2>Crop matches for {place.name}</h2>
            <p className="crop-context-note">
              Checked against the current season, local weather, and rainfall from the last 30 days
              {soil ? `, and your selected ${soil.toLowerCase()} soil` : ''}.
            </p>

            {recommendations.length > 0 ? (
              <div className="crop-grid">
                {recommendations.map((crop) => (
                  <article className="crop-card" key={crop.name}>
                    <span className="crop-icon" aria-hidden="true">
                      {crop.icon}
                    </span>

                    <div>
                      <h3>{crop.name}</h3>
                      <p>
                        {crop.hindi} · {crop.kannada}
                      </p>
                    </div>

                    <p className="crop-reason">
                      <strong>Why it appears:</strong>{' '}
                      {`listed for the ${season} season · current temperature ${Math.round(temperature)}°C is within its screening range`}
                      {` · 30-day rainfall ${recentRain.toFixed(0)} mm is within its screening range`}
                      {soil && ` · ${soil} soil is listed for this crop`}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="crop-context-note" role="status">
                No crop in this screening list matches all the current checks. Try another location or confirm local sowing guidance with your Krishi Vigyan Kendra.
              </p>
            )}

            <p className="crop-data-source">
              Weather source: Open-Meteo. Crop ranges are a broad screening guide, not a field-specific guarantee.
            </p>
          </section>
          )}

          <p className="crop-disclaimer">
            Confirm sowing dates, irrigation, and soil conditions with your local Krishi Vigyan Kendra or agriculture officer before planting.
          </p>
        </>
      )}
    </main>
  )
}
