import { useEffect, useState } from 'react'
import { useLanguage } from './locales/LanguageContext.jsx'
import { weatherTranslations } from './locales/weather.js'
import { weatherFeatureText, weatherErrors, featureText, cropNames } from './locales/featureText.js'
import { findLocation, formatLocationLabel, getDevicePosition, nameCoordinates } from './locationService.js'

const dateLocales = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
}

function readSavedLocation() {
  try {
    const savedLocation = localStorage.getItem('cropsense-location')
    return savedLocation ? JSON.parse(savedLocation) : null
  } catch {
    return null
  }
}

export default function WeatherPage() {
  const { language } = useLanguage()
  const text = weatherTranslations[language] || weatherTranslations.en
  const extra = weatherFeatureText[language] || weatherFeatureText.en
  const common = featureText[language] || featureText.en
  const dateLocale = dateLocales[language] || 'en-IN'

  const [searchText, setSearchText] = useState('')
  const [place, setPlace] = useState(readSavedLocation)
  const [weatherResult, setWeatherResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentCrop, setCurrentCrop] = useState('')
  const cropOptions = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Groundnut', 'Soybean', 'Ragi', 'Jowar', 'Tur', 'Gram', 'Mustard', 'Potato', 'Tomato', 'Onion', 'Okra', 'Brinjal', 'Chilli', 'Banana', 'Mango', 'Papaya']
  const selectedCropName = currentCrop === 'Other' ? extra.other : (cropNames[language] || cropNames.en)[cropOptions.indexOf(currentCrop)]
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
    }).catch(() => {
      if (!active || place.provider !== 'OpenStreetMap') return
      if (place.name === common.location && !place.region) return
      const fallback = { ...place, name: common.location, region: '' }
      setPlace(fallback)
      localStorage.setItem('cropsense-location', JSON.stringify(fallback))
      setError(common.locationError)
    })
    return () => { active = false }
  }, [place, language, common.location, common.locationError])

  function savePlace(newPlace) {
    setPlace(newPlace)
    localStorage.setItem('cropsense-location', JSON.stringify(newPlace))
  }

  async function handleSearch(event) {
    event.preventDefault()

    if (!searchText.trim()) return

    setLoading(true)
    setError('')

    try {
      const foundPlace = await findLocation(searchText, language)
      savePlace(foundPlace)
      setSearchText('')
    } catch {
      setError(common.notFound)
    } finally {
      setLoading(false)
    }
  }

  function useMyLocation() {
    setError('')

    if (!navigator.geolocation) {
      setError(common.geoUnavailable)
      return
    }

    setLoading(true)

    getDevicePosition()
      .then(async ({ coords }) => {
        const { latitude, longitude } = coords
        try {
          const named = await nameCoordinates(latitude, longitude, language)
          savePlace({ ...named, latitude, longitude })
        } catch {
          savePlace({ name: common.location, region: '', latitude, longitude, provider: 'Device GPS' })
          setError(common.locationError)
        }
      })
      .catch((locationError) => {
        setError(locationError?.code === 1 ? common.permission : common.geoUnavailable)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!place) return

    let stillOnThisPage = true

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${place.latitude}` +
      `&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum` +
      `&past_days=30&forecast_days=5&timezone=auto`

    fetch(weatherUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error('The weather service is unavailable. Please try again.')
        }

        return response.json()
      })
      .then((weatherData) => {
        if (stillOnThisPage) {
          setWeatherResult({
            placeKey: `${place.latitude},${place.longitude}`,
            data: weatherData,
          })
        }
      })
      .catch(() => {
        if (stillOnThisPage) {
          setError(weatherErrors[language] || weatherErrors.en)
        }
      })

    return () => {
      stillOnThisPage = false
    }
  }, [place, placeKey, language])

  const forecastDays =
    weather?.daily?.time?.slice(-5).map((date, index) => {
      const firstForecastIndex = weather.daily.time.length - 5
      const dataIndex = firstForecastIndex + index

      return {
        date,
        high: weather.daily.temperature_2m_max[dataIndex],
        low: weather.daily.temperature_2m_min[dataIndex],
        rainChance: weather.daily.precipitation_probability_max[dataIndex],
        rainAmount: weather.daily.precipitation_sum[dataIndex],
      }
    }) || []

  const pastRainfall =
    weather?.daily?.precipitation_sum
      ?.slice(0, -5)
      .reduce((total, amount) => total + (amount || 0), 0) || 0

  const nextTwoDaysRainfall =
    weather?.daily?.precipitation_sum
      ?.slice(-5, -3)
      .reduce((total, amount) => total + (amount || 0), 0) || 0

  const todayRainChance =
    weather?.daily?.precipitation_probability_max?.slice(-5)[0] || 0

  const windSpeed = weather?.current?.wind_speed_10m || 0
  const avoidSpraying = todayRainChance > 50 || windSpeed > 20
  const delayWatering = nextTwoDaysRainfall > 5

  return (
    <main className="weather-page">
      <section className="weather-heading">
        <p className="section-label">{text.sectionLabel}</p>
        <h1>{text.heading}</h1>
        <p>{text.introduction}</p>
      </section>

      <section className="location-card">
        <div>
          <h2>{text.locationTitle}</h2>
          <p>
            {place
              ? formatLocationLabel(place)
              : text.locationHint}
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={useMyLocation}
          disabled={loading}
        >
          {text.useMyLocation}
        </button>

        <form className="location-form" onSubmit={handleSearch}>
          <label htmlFor="place-search">{text.searchLabel}</label>
          <div className="location-form-row">
            <input
              id="place-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={text.searchPlaceholder}
                inputMode={searchText.length > 0 && /^\d*$/.test(searchText) ? 'numeric' : 'search'}
              autoComplete="off"
              maxLength={100}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={loading || !searchText.trim()}
            >
              {loading ? text.pleaseWait : text.findLocation}
            </button>
          </div>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>

      {!place && (
        <section className="weather-empty">
          <span aria-hidden="true">📍</span>
          <h2>{text.chooseLocation}</h2>
          <p>{text.forecastDescription}</p>
        </section>
      )}

      {place && loading && !weather && (
        <p className="loading-message">{text.loadingWeather}</p>
      )}

      {weather && (
        <>
          <section className="current-weather-card">
            <div>
              <p className="section-label">{text.currentConditions}</p>
              <h2>{place.name}</h2>
              <p className="temperature">
                {Math.round(weather.current.temperature_2m)}°C
              </p>
              <p>
                {text.humidity}: {weather.current.relative_humidity_2m}% ·{' '}
                {text.wind}: {weather.current.wind_speed_10m} km/h
              </p>
            </div>
            <span className="weather-big-icon" aria-hidden="true">
              🌤️
            </span>
          </section>

          <section className="forecast-section">
            <h2>{text.nextFiveDays}</h2>

            <div className="forecast-grid">
              {forecastDays.map((day) => (
                <article className="forecast-card" key={day.date}>
                  <h3>
                    {new Intl.DateTimeFormat(dateLocale, {
                      weekday: 'short',
                    }).format(new Date(`${day.date}T12:00:00`))}
                  </h3>
                  <span className="forecast-icon" aria-hidden="true">
                    🌦️
                  </span>
                  <p>
                    {Math.round(day.high)}° / {Math.round(day.low)}°C
                  </p>
                  <small>
                    {text.rain}: {day.rainChance ?? 0}% · {day.rainAmount ?? 0} mm
                  </small>
                </article>
              ))}
            </div>
          </section>

          <section className="field-advice">
            <h2>{text.fieldTips}</h2>
            <label htmlFor="weather-crop">{extra.currentCrop}</label>
            <select id="weather-crop" value={currentCrop} onChange={(event) => setCurrentCrop(event.target.value)}>
              <option value="">{extra.chooseCrop}</option>
              {[...cropOptions, 'Other'].map((crop, index) => <option key={crop} value={crop}>{crop === 'Other' ? extra.other : (cropNames[language] || cropNames.en)[index]}</option>)}
            </select>
            {!currentCrop && <p>{extra.noCrop}</p>}

            <article className="advice-card">
              <h3>{text.irrigation}</h3>
              <p>{currentCrop ? `${selectedCropName}: ${delayWatering ? extra.irrigation.replace('{mm}', nextTwoDaysRainfall.toFixed(1)) : extra.noRain}` : text.checkSoil}</p>
            </article>

            <article className="advice-card">
              <h3>{text.spraying}</h3>
              <p>{currentCrop ? `${selectedCropName}: ${avoidSpraying ? extra.sprayRain : extra.sprayDry}` : text.waitSpraying}</p>
            </article>

            <article className="advice-card">
              <h3>{text.harvesting}</h3>
              <p>
                {currentCrop ? `${selectedCropName}: ${todayRainChance > 50 ? extra.harvestRain : extra.harvestDry}` : text.checkForecast}
              </p>
            </article>
          </section>

          <p className="weather-note">
            {text.previousRainfall}: {pastRainfall.toFixed(1)} mm.{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{text.dataSource}</a>{' '}
            {extra.adviceNote}
          </p>
        </>
      )}
    </main>
  )
}
