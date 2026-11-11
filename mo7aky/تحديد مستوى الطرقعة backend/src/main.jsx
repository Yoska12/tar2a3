import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

// Initialize document direction and language
const initializeLanguage = () => {
  const savedLanguage = localStorage.getItem('i18nextLng') || 'ar';
  document.documentElement.lang = savedLanguage;
  document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.add(savedLanguage === 'ar' ? 'rtl' : 'ltr');
};

initializeLanguage();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

