import { useEffect, useMemo, useState } from 'react'
import { findLocation, formatLocationLabel, nameCoordinates } from './locationService.js'
import { useLanguage } from './locales/LanguageContext.jsx'
import { featureText, cropNames, soilNames, cropReasonText, cropErrors, soilReasonText } from './locales/featureText.js'
import { translations } from './locales/translations.js'

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
  { name: 'Okra', hindi: 'भिंडी', kannada: 'ಬೆಂಡೆಕಾಯಿ', icon: '🥬', seasons: ['Kharif', 'Zaid'], soils: ['Red', 'Alluvial', 'Black'], minTemp: 20, maxTemp: 35, minRain: 10, maxRain: 300 },
  { name: 'Brinjal', hindi: 'बैंगन', kannada: 'ಬದನೆಕಾಯಿ', icon: '🍆', seasons: ['Kharif', 'Rabi', 'Zaid'], soils: ['Red', 'Alluvial', 'Black'], minTemp: 18, maxTemp: 35, minRain: 10, maxRain: 300 },
  { name: 'Chilli', hindi: 'मिर्च', kannada: 'ಮೆಣಸಿನಕಾಯಿ', icon: '🌶️', seasons: ['Kharif', 'Rabi'], soils: ['Red', 'Alluvial', 'Black'], minTemp: 18, maxTemp: 32, minRain: 10, maxRain: 250 },
  { name: 'Banana', hindi: 'केला', kannada: 'ಬಾಳೆಹಣ್ಣು', icon: '🍌', seasons: ['Kharif', 'Rabi', 'Zaid'], soils: ['Alluvial', 'Red'], minTemp: 20, maxTemp: 35, minRain: 50, maxRain: 500 },
  { name: 'Mango', hindi: 'आम', kannada: 'ಮಾವು', icon: '🥭', seasons: ['Kharif', 'Rabi', 'Zaid'], soils: ['Red', 'Alluvial'], minTemp: 20, maxTemp: 38, minRain: 30, maxRain: 500 },
  { name: 'Papaya', hindi: 'पपीता', kannada: 'ಪಪ್ಪಾಯಿ', icon: '🍈', seasons: ['Kharif', 'Rabi', 'Zaid'], soils: ['Red', 'Alluvial'], minTemp: 22, maxTemp: 35, minRain: 50, maxRain: 400 },
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
  const { language } = useLanguage()
  const season = getSeason(new Date())
  const t = featureText[language] || featureText.en
  const localeNames = cropNames[language] || cropNames.en
  const localeSoils = soilNames[language] || soilNames.en
  const localizedSeason = translations[language]?.[season.toLowerCase()] || season
  const [searchText, setSearchText] = useState('')
  const [place, setPlace] = useState(readSavedLocation)
  const [weatherResult, setWeatherResult] = useState(null)
  const [soilOverride, setSoilOverride] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)
  const placeKey = place ? `${place.latitude},${place.longitude}` : ''
  const weather = weatherResult?.placeKey === placeKey ? weatherResult.data : null

  useEffect(() => {
    if (!place) return
    let active = true
    nameCoordinates(place.latitude, place.longitude, language).then((named) => {
      if (!active || (named.name === place.name && named.region === place.region)) return
      const localized = { ...place, ...named }
      setPlace(localized)
      localStorage.setItem('cropsense-location', JSON.stringify(localized))
    }).catch(() => {})
    return () => { active = false }
  }, [place, language])

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
      .catch(() => {
        if (stillOnPage) {
          setError(cropErrors[language] || cropErrors.en)
        }
      })

    return () => {
      stillOnPage = false
    }
  }, [place, placeKey, language])

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
      const foundPlace = await findLocation(searchText, language)
      setPlace(foundPlace)
      localStorage.setItem('cropsense-location', JSON.stringify(foundPlace))
      setSearchText('')
    } catch {
      setError(t.notFound)
    } finally {
      setLoading(false)
    }
  }

  function useMyLocation() {
    setError('')
    if (!navigator.geolocation) return setError(t.geoUnavailable)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const named = await nameCoordinates(coords.latitude, coords.longitude, language)
        const found = { ...named, latitude: coords.latitude, longitude: coords.longitude }
        setPlace(found)
        localStorage.setItem('cropsense-location', JSON.stringify(found))
      } catch {
        setError(t.locationError)
      } finally { setLocating(false) }
    }, () => { setError(t.permission); setLocating(false) })
  }

  return (
    <main className="crop-page">
      <section className="crop-heading">
        <p className="section-label">{t.cropTitle}</p>
        <h1>{t.cropTitle}</h1>
        <p>{t.cropIntro}</p>
      </section>

      <section className="crop-location-card">
        <h2>{t.location}</h2>
        <p>
          {place
            ? formatLocationLabel(place)
            : t.searchHint}
        </p>
        {place?.provider === 'OpenStreetMap' && <small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small>}
        <button className="secondary-button" type="button" onClick={useMyLocation} disabled={locating}>
          {locating ? t.locating : t.useLocation}
        </button>

        <form className="location-form" onSubmit={handleSearch}>
          <label htmlFor="crop-place-search">{t.townLabel}</label>
          <div className="location-form-row">
            <input
              id="crop-place-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t.example}
              inputMode={searchText.length > 0 && /^\d*$/.test(searchText) ? 'numeric' : 'search'}
              autoComplete="off"
              maxLength={100}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={loading || !searchText.trim()}
            >
              {loading ? t.wait : t.find}
            </button>
          </div>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>

      {place && (
        <>
          <section className="soil-card">
            <div>
              <p className="section-label">{t.soilLabel}</p>
              <h2>{soil ? `${t.soilChosen}: ${localeSoils[['Black','Red','Sandy','Alluvial'].indexOf(soil)]}` : t.soilQuestion}</h2>
              <p>{t.soilHint}</p>
            </div>

            <div className="soil-options" aria-label="Choose a different soil">
              {['Not sure', 'Black', 'Red', 'Sandy', 'Alluvial'].map((soilType, index) => {
                const value = index === 0 ? '' : soilType
                const label = index === 0 ? t.notSure : localeSoils[index - 1]

                return (
                <button
                  className={soil === value ? 'soil-option selected' : 'soil-option'}
                  key={soilType}
                  type="button"
                  onClick={() => setSoilOverride(value)}
                >
                  {label}
                </button>
                )
              })}
            </div>
          </section>

          <p className="crop-context">
            {t.season}: <strong>{localizedSeason}</strong>
            {temperature != null && (
              <>
                {' · '}
                {t.temperature}: <strong>{Math.round(temperature)}°C</strong>
              </>
            )}
            {recentRain != null && (
              <>
                {' · '}
                {t.rain30}: <strong>{recentRain.toFixed(0)} mm</strong>
              </>
            )}
          </p>

          {!weather && !error && (
            <p className="loading-message">
              {t.loading}
            </p>
          )}

          {weather && (
            <section className="crop-results">
            <h2>{t.matches} {place.name}</h2>
            <p className="crop-context-note">
              {t.checked}{soil ? `, ${soil}` : ''}.
            </p>

            {recommendations.length > 0 ? (
              <div className="crop-grid">
                {recommendations.map((crop) => (
                  <article className="crop-card" key={crop.name}>
                    <span className="crop-icon" aria-hidden="true">
                      {crop.icon}
                    </span>

                    <div>
                      <h3>{localeNames[crops.findIndex((item) => item.name === crop.name)]}</h3>
                    </div>

                    <p className="crop-reason">
                      <strong>{t.why}</strong>{' '}
                      {(cropReasonText[language] || cropReasonText.en)
                        .replace('{season}', localizedSeason)
                        .replace('{temp}', String(Math.round(temperature)))
                        .replace('{rain}', recentRain.toFixed(0))
                        .replace('{soil}', soil ? `${soilReasonText[language] || soilReasonText.en}: ${localeSoils[['Black','Red','Sandy','Alluvial'].indexOf(soil)]}` : '')}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="crop-context-note" role="status">
                {t.noMatches}
              </p>
            )}

            <p className="crop-data-source">
              {t.source} (<a href="https://icar.gov.in/sites/default/files/Circulars/ICAR%20En-Kharif-Agro-Advisories%20for%20Farmers-2025.pdf" target="_blank" rel="noreferrer">ICAR</a>)
            </p>
          </section>
          )}

          <p className="crop-disclaimer">
            {t.source}
          </p>
        </>
      )}
    </main>
  )
}
