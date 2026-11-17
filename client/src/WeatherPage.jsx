import { useEffect, useState } from 'react'
import { useLanguage } from './locales/LanguageContext.jsx'
import { weatherTranslations } from './locales/weather.js'
import { findLocation, formatLocationLabel } from './locationService.js'

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
  const dateLocale = dateLocales[language] || 'en-IN'

  const [searchText, setSearchText] = useState('')
  const [place, setPlace] = useState(readSavedLocation)
  const [weatherResult, setWeatherResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const placeKey = place ? `${place.latitude},${place.longitude}` : ''
  const weather = weatherResult?.placeKey === placeKey ? weatherResult.data : null

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
      const foundPlace = await findLocation(searchText)
      savePlace(foundPlace)
      setSearchText('')
    } catch (searchError) {
      setError(searchError.message || 'Place search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function useMyLocation() {
    setError('')

    if (!navigator.geolocation) {
      setError('Location access is not available in this browser.')
      return
    }

    setLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        savePlace({
          name: 'Your location',
          region: 'Using your device location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLoading(false)
      },
      () => {
        setError(
          'Location permission was not given. You can search for a town or PIN code instead.'
        )
        setLoading(false)
      }
    )
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
      .catch((weatherError) => {
        if (stillOnThisPage) {
          setError(weatherError.message || 'Could not load the weather.')
        }
      })

    return () => {
      stillOnThisPage = false
    }
  }, [place, placeKey])

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

            <article className="advice-card">
              <h3>{text.irrigation}</h3>
              <p>{delayWatering ? text.rainExpected : text.checkSoil}</p>
            </article>

            <article className="advice-card">
              <h3>{text.spraying}</h3>
              <p>{avoidSpraying ? text.waitSpraying : text.calmSpraying}</p>
            </article>

            <article className="advice-card">
              <h3>{text.harvesting}</h3>
              <p>
                {todayRainChance > 50 ? text.dryWindow : text.checkForecast}
              </p>
            </article>
          </section>

          <p className="weather-note">
            {text.previousRainfall}: {pastRainfall.toFixed(1)} mm.{' '}
            {text.dataSource}
          </p>
        </>
      )}
    </main>
  )
}
