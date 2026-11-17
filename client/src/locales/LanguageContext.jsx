import { createContext, useContext, useState } from 'react'
import { supportedLanguages, translate } from './translations.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')

  const value = {
    language,
    setLanguage,
    languages: supportedLanguages,
    t: (key) => translate(language, key),
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }

  return context
}