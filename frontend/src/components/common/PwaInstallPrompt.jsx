import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, 
  Download, 
  CheckCircle2, 
  HelpCircle, 
  Share2, 
  PlusSquare, 
  MoreVertical, 
  Apple, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Modal from './Modal';

export default function PwaInstallPrompt({ className = '' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState('android');
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent || '';
    const iOSCheck = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIOS(iOSCheck);
    if (iOSCheck) {
      setGuideTab('ios');
    }

    // Check if running as installed PWA (standalone)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      // Prevent automatic prompt to customize the display
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      // If no native prompt is available (e.g. iOS or manual install needed), open visual guide
      setShowGuide(true);
    }
  };

  // If already running in standalone mode
  if (isStandalone || isInstalled) {
    return (
      <div className={`pwa-installed-pill ${className}`}>
        <CheckCircle2 size={16} className="pwa-installed-pill__icon" />
        <span>Aplicación Prismo instalada</span>
      </div>
    );
  }

  return (
    <>
      <div className={`pwa-install-banner ${className}`}>
        <div className="pwa-install-banner__content">
          <div className="pwa-install-banner__icon-wrap">
            <Smartphone size={22} className="pwa-install-banner__phone-icon" />
            <span className="pwa-install-banner__glow" />
          </div>

          <div className="pwa-install-banner__info">
            <div className="pwa-install-banner__title-row">
              <span className="pwa-install-banner__title">Instalar Prismo en tu móvil</span>
              <span className="pwa-badge">APP MÓVIL</span>
            </div>
            <p className="pwa-install-banner__desc">
              Accede más rápido y úsalo a pantalla completa como una app nativa
            </p>
          </div>
        </div>

        <div className="pwa-install-banner__actions">
          <motion.button
            type="button"
            className="btn btn--primary btn--sm pwa-install-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInstallClick}
          >
            <Download size={15} />
            <span>{deferredPrompt ? 'Instalar ahora' : 'Instalar en celular'}</span>
          </motion.button>

          <button
            type="button"
            className="pwa-help-link"
            onClick={() => setShowGuide(true)}
          >
            <HelpCircle size={14} />
            <span>¿Cómo instalar?</span>
          </button>
        </div>
      </div>

      {/* Installation Guide Modal */}
      <Modal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        title="Instalar Prismo en tu dispositivo"
        size="default"
      >
        <div className="pwa-guide">
          {/* OS Switcher Tabs */}
          <div className="pwa-guide__tabs">
            <button
              type="button"
              className={`pwa-guide__tab ${guideTab === 'android' ? 'pwa-guide__tab--active' : ''}`}
              onClick={() => setGuideTab('android')}
            >
              <Smartphone size={16} />
              <span>Android / Chrome</span>
            </button>
            <button
              type="button"
              className={`pwa-guide__tab ${guideTab === 'ios' ? 'pwa-guide__tab--active' : ''}`}
              onClick={() => setGuideTab('ios')}
            >
              <Apple size={16} />
              <span>iPhone / iPad (iOS)</span>
            </button>
          </div>

          {/* Android Steps */}
          {guideTab === 'android' && (
            <div className="pwa-guide__steps">
              {deferredPrompt && (
                <div className="pwa-guide__direct-action">
                  <p>Tu navegador admite instalación directa con un clic:</p>
                  <button
                    type="button"
                    className="btn btn--primary btn--md"
                    style={{ width: '100%', marginTop: '8px' }}
                    onClick={() => {
                      setShowGuide(false);
                      handleInstallClick();
                    }}
                  >
                    <Download size={18} />
                    Instalar Prismo directamente
                  </button>
                </div>
              )}

              <div className="pwa-step-card">
                <div className="pwa-step-card__number">1</div>
                <div className="pwa-step-card__body">
                  <div className="pwa-step-card__title">Abre el menú de opciones</div>
                  <div className="pwa-step-card__desc">
                    En Google Chrome, toca los <strong>tres puntos verticales (<MoreVertical size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />)</strong> en la esquina superior derecha.
                  </div>
                </div>
              </div>

              <div className="pwa-step-card">
                <div className="pwa-step-card__number">2</div>
                <div className="pwa-step-card__body">
                  <div className="pwa-step-card__title">Selecciona instalar</div>
                  <div className="pwa-step-card__desc">
                    Toca en <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                  </div>
                </div>
              </div>

              <div className="pwa-step-card">
                <div className="pwa-step-card__number">3</div>
                <div className="pwa-step-card__body">
                  <div className="pwa-step-card__title">Confirma la instalación</div>
                  <div className="pwa-step-card__desc">
                    Pulsa <strong>"Instalar"</strong>. Prismo se añadirá a la pantalla de inicio de tu teléfono con su propio icono.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* iOS Steps */}
          {guideTab === 'ios' && (
            <div className="pwa-guide__steps">
              <div className="pwa-guide__notice">
                <Sparkles size={16} className="pwa-guide__notice-icon" />
                <span>En iOS, abre Prismo usando <strong>Safari</strong> para habilitar la instalación.</span>
              </div>

              <div className="pwa-step-card">
                <div className="pwa-step-card__number">1</div>
                <div className="pwa-step-card__body">
                  <div className="pwa-step-card__title">Toca el botón Compartir</div>
                  <div className="pwa-step-card__desc">
                    En la barra inferior de Safari, pulsa el icono de <strong>Compartir (<Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />)</strong> (cuadrado con una flecha apuntando hacia arriba).
                  </div>
                </div>
              </div>

              <div className="pwa-step-card">
                <div className="pwa-step-card__number">2</div>
                <div className="pwa-step-card__body">
                  <div className="pwa-step-card__title">Añadir a la pantalla de inicio</div>
                  <div className="pwa-step-card__desc">
                    Desliza hacia abajo en las opciones y selecciona <strong>"Añadir a pantalla de inicio" (<PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />)</strong>.
                  </div>
                </div>
              </div>

              <div className="pwa-step-card">
                <div className="pwa-step-card__number">3</div>
                <div className="pwa-step-card__body">
                  <div className="pwa-step-card__title">Confirma pulsando Añadir</div>
                  <div className="pwa-step-card__desc">
                    Toca <strong>"Añadir"</strong> en la esquina superior derecha. ¡Listo! Prismo aparecerá como una app en tu iPhone/iPad.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits summary */}
          <div className="pwa-benefits">
            <div className="pwa-benefit-item">
              <CheckCircle2 size={16} color="var(--accent-success)" />
              <span>Funciona a pantalla completa sin barra de navegación</span>
            </div>
            <div className="pwa-benefit-item">
              <CheckCircle2 size={16} color="var(--accent-success)" />
              <span>Carga ultra rápida y menor consumo de datos</span>
            </div>
            <div className="pwa-benefit-item">
              <CheckCircle2 size={16} color="var(--accent-success)" />
              <span>Acceso directo con un solo toque desde tu celular</span>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
