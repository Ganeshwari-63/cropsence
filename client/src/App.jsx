import { useEffect } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import WeatherPage from './WeatherPage.jsx'
import CropPage from './CropPage.jsx'
import YieldPage from './YieldPage.jsx'
import DiseasePage from './DiseasePage.jsx'
import { useLanguage } from './locales/LanguageContext.jsx'

const tools = [
  {
    kind: 'weather',
    titleKey: 'weather',
    descriptionKey: 'weatherDescription',
    path: '/weather',
  },
  {
    kind: 'crop',
    titleKey: 'crop',
    descriptionKey: 'cropDescription',
    path: '/crop',
  },
  {
    kind: 'disease',
    titleKey: 'disease',
    descriptionKey: 'diseaseDescription',
    path: '/disease',
  },
  {
    kind: 'yield',
    titleKey: 'yield',
    descriptionKey: 'yieldDescription',
    path: '/yield',
  },
]

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

function WeatherIllustration() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="83" cy="34" r="19" fill="#e8b84d" />
      <path d="M83 7v9M83 52v9M56 34h9M101 34h9M64 15l7 7M96 47l7 7M102 15l-7 7M71 47l-7 7" stroke="#d99a36" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 82h58a17 17 0 0 0 0-34 24 24 0 0 0-45-4 19 19 0 0 0-13 38Z" fill="#f8fbf2" stroke="#6f9574" strokeWidth="4" strokeLinejoin="round" />
      <path d="m42 96-5 12M65 96l-5 12M88 96l-5 12" stroke="#78a8b5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function CropIllustration() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M20 98c22-9 58-9 80 0" fill="none" stroke="#8c6338" strokeWidth="5" strokeLinecap="round" />
      <path d="M60 96V31" fill="none" stroke="#3f7949" strokeWidth="5" strokeLinecap="round" />
      <path d="M57 75C40 72 30 60 28 45c17 2 28 12 29 30ZM63 63c17-3 28-15 29-30-17 2-27 12-29 30ZM57 49C43 43 37 32 38 20c14 5 21 15 19 29ZM63 42c13-5 20-16 18-28-13 5-19 16-18 28Z" fill="#78a951" stroke="#3f7949" strokeWidth="3" strokeLinejoin="round" />
      <path d="M24 103h72" stroke="#c99655" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function DiseaseIllustration() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M60 96C28 82 22 57 35 35c12-19 37-24 57-22 2 29-4 54-23 70-4 4-7 7-9 13Z" fill="#83ad5f" stroke="#3f7949" strokeWidth="4" strokeLinejoin="round" />
      <path d="M37 81c12-16 25-29 43-42M55 65l-2-19M66 55l18 2M46 75l-1-15" fill="none" stroke="#e8f0d8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="79" cy="78" r="19" fill="#fffdf5" stroke="#426b49" strokeWidth="5" />
      <path d="m93 92 14 14" stroke="#426b49" strokeWidth="6" strokeLinecap="round" />
      <circle cx="79" cy="78" r="7" fill="#d99054" />
    </svg>
  )
}

function YieldIllustration() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M26 101V64M48 101V45M70 101V31M92 101V53" stroke="#4e824c" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 76c-9-4-13-11-13-19 9 2 14 7 15 16M26 86c9-4 13-11 13-19-9 2-14 7-15 16M48 60c-9-4-13-11-13-19 9 2 14 7 15 16M48 72c9-4 13-11 13-19-9 2-14 7-15 16M70 47c-9-4-13-11-13-19 9 2 14 7 15 16M70 58c9-4 13-11 13-19-9 2-14 7-15 16M92 68c-9-4-13-11-13-19 9 2 14 7 15 16" fill="#d8b04e" stroke="#a47b2f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 103h88" stroke="#9c7044" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function ToolIllustration({ kind }) {
  const illustrations = {
    weather: <WeatherIllustration />,
    crop: <CropIllustration />,
    disease: <DiseaseIllustration />,
    yield: <YieldIllustration />,
  }

  return (
    <div className={'tool-illustration tool-illustration-' + kind}>
      {illustrations[kind]}
    </div>
  )
}

function getSeasonKey(date) {
  const month = date.getMonth()

  if (month >= 5 && month <= 9) return 'kharif'
  if (month === 10 || month === 11 || month <= 2) return 'rabi'
  return 'zaid'
}

function getGreetingKey(hour) {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function ToolVideoBackground({ pathname }) {
  const toolByPath = {
    '/weather': 'weather',
    '/crop': 'crop',
    '/disease': 'disease',
    '/yield': 'yield',
  }
  const tool = toolByPath[pathname]

  if (!tool) return null

  return (
    <div className={'tool-video-backdrop tool-video-backdrop-' + tool} aria-hidden="true">
      <video autoPlay muted loop playsInline preload="metadata" tabIndex={-1}>
        <source src={'/videos/features/' + tool + '.mp4'} type="video/mp4" />
        <source src="/videos/rice-field.mp4" type="video/mp4" />
      </video>
      <div className="tool-video-shade" />
    </div>
  )
}

function Header() {
  const { language, setLanguage, languages, t } = useLanguage()

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="CropSense home">
        <span className="brand-mark" aria-hidden="true">
          <CropIllustration />
        </span>
        <span className="brand-copy">
          <strong>CropSense</strong>
          <small>{t('tagline')}</small>
        </span>
      </Link>

      <nav className="main-nav" aria-label="Main navigation">
        <Link to="/">{t('home')}</Link>
        <Link to="/features">{t('features')}</Link>
        <Link to="/about">{t('about')}</Link>
      </nav>

      <label className="language-picker">
        <span className="visually-hidden">Choose language</span>
        <select
          aria-label="Choose language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {languages.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </header>
  )
}

function HomePage() {
  const { language, t } = useLanguage()
  const now = new Date()
  const dateText = new Intl.DateTimeFormat(
    dateLocales[language] || 'en-IN',
    { dateStyle: 'full' }
  ).format(now)

  return (
    <main className="home-page">
      <section className="hero" id="home">
        <div className="hero-video-layer" aria-hidden="true">
          <video
            className="hero-farm-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
          >
            <source src="/videos/rice-field.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="hero-video-shade" aria-hidden="true" />

        <div className="hero-content">
          <p className="date-line">
            {t(getGreetingKey(now.getHours()))} <span aria-hidden="true">·</span> {dateText}
          </p>

          <p className="season-label">
            <span className="season-dot" aria-hidden="true" />
            {t(getSeasonKey(now))}
            {language === 'en' ? ' season' : ''}
          </p>

          <h1>{t('heroTitle')}</h1>
          <p className="hero-description">{t('heroDescription')}</p>

          <Link className="hero-cta" to="/features">
            <span>{t('exploreFeatures')}</span>
            <span className="cta-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="hero-caption">
          <span className="caption-line" />
          <span>{t('tagline')}</span>
        </div>
      </section>
    </main>
  )
}

function FeaturesPage() {
  const { t } = useLanguage()

  return (
    <main className="features-page">
      <div className="features-video-layer" aria-hidden="true">
        <video className="features-background-video" autoPlay muted loop playsInline preload="metadata" tabIndex={-1}>
          <source src="/videos/rice-field.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="features-video-shade" aria-hidden="true" />

      <section className="feature-list" aria-label={t('features')}>
        {tools.map((tool) => (
          <Link className="feature-option" to={tool.path} key={tool.path}>
            <span className="feature-option-icon" aria-hidden="true">
              <ToolIllustration kind={tool.kind} />
            </span>
            <span className="feature-option-title">{t(tool.titleKey)}</span>
          </Link>
        ))}
      </section>
    </main>
  )
}

function AboutPage() {
  const { t } = useLanguage()
  const steps = ['stepOne', 'stepTwo', 'stepThree']

  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <p className="eyebrow">{t('aboutLabel')}</p>
          <h1>{t('aboutTitle')}</h1>
          <p className="about-lead">{t('aboutDescription')}</p>
        </div>
        <div className="about-art" aria-hidden="true">
          <ToolIllustration kind="crop" />
          <span className="about-sun" />
          <span className="about-field about-field-one" />
          <span className="about-field about-field-two" />
        </div>
      </section>

      <section className="about-process">
        <div className="about-section-heading">
          <p className="eyebrow">{t('toolsLabel')}</p>
          <h2>{t('howItWorks')}</h2>
        </div>

        <div className="about-steps">
          {steps.map((key, index) => (
            <article className="about-step" key={key}>
              <span className="about-step-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p>{t(key)}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="about-disclaimer">
        <span className="disclaimer-icon" aria-hidden="true">✓</span>
        <p>{t('disclaimer')}</p>
      </aside>
    </main>
  )
}

function NotFoundPage() {
  const { t } = useLanguage()

  return (
    <main className="about-page not-found-page">
      <p className="eyebrow">CropSense</p>
      <h1>{t('notFound')}</h1>
      <p>{t('pageNotFoundDescription')}</p>
      <Link className="hero-cta" to="/">
        <span>{t('goHome')}</span>
        <span className="cta-arrow" aria-hidden="true">↗</span>
      </Link>
    </main>
  )
}

function AppContent() {
  const { t } = useLanguage()
  const location = useLocation()
  const isHomePage = location.pathname === '/'
  const isFeaturePicker = location.pathname === '/features'

  return (
    <>
      <ScrollToTop />
      <Header />
      <ToolVideoBackground pathname={location.pathname} />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/crop" element={<CropPage />} />
        <Route path="/yield" element={<YieldPage />} />
        <Route path="/disease" element={<DiseasePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {!isHomePage && !isFeaturePicker && (
        <footer className="site-footer">
          <p>CropSense · {t('tagline')}</p>
          <p>{t('disclaimer')}</p>
        </footer>
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

\n