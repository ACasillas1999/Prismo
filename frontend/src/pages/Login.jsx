import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Target, Mail, Lock, ArrowRight } from 'lucide-react';
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";



export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';
  const isDark = (localStorage.getItem('prismo_theme') || 'light') === 'dark';

  const particlesInit = useCallback(async engine => {
    await loadSlim(engine);
  }, []);

  const particlesConfig = useMemo(() => ({
    fullScreen: { enable: true, zIndex: 0 },
    background: {
      color: {
        value: "transparent",
      },
    },
    fpsLimit: 120,
    interactivity: {
      events: {
        onClick: { enable: true, mode: "push" },
        onHover: { enable: true, mode: "grab" },
        resize: true,
      },
      modes: {
        push: { quantity: 4 },
        grab: { distance: 150, links: { opacity: 0.5 } },
      },
    },
    particles: {
      color: { 
        value: isDark 
          ? ["#8B5CF6", "#3B82F6", "#EC4899", "#10B981", "#F43F5E", "#06B6D4", "#F59E0B"]
          : ["#6366F1", "#3B82F6", "#10B981", "#F43F5E", "#8B5CF6"]
      },
      links: {
        color: "random",
        distance: 150,
        enable: true,
        opacity: 0.4,
        width: 1,
        triangles: {
          enable: true,
          opacity: 0.1
        }
      },
      move: {
        direction: "none",
        enable: true,
        outModes: { default: "bounce" },
        random: true,
        speed: 1.2,
        straight: false,
      },
      number: { density: { enable: true, area: 800 }, value: 70 },
      opacity: { value: 0.7 },
      shape: { 
        type: ["polygon", "triangle"],
        options: {
          polygon: { sides: 3 }
        }
      },
      size: { value: { min: 2, max: 5 } },
    },
    detectRetina: true,
  }), [isDark]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ParticlesProvider init={particlesInit}>
      <div className="login-page">
        <Particles
          id="tsparticles"
          options={particlesConfig}
        />
        {/* Animated background overlay */}
      <div className="login-page__bg" style={{ pointerEvents: 'none', zIndex: 0 }} />

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo */}
        <div className="login-card__logo">
          <motion.div
            className="login-card__logo-icon"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <Target size={26} color="white" strokeWidth={2.5} />
          </motion.div>
          <span className="login-card__logo-text">Prismo</span>
        </div>

        <p className="login-card__subtitle">
          Sistema de Evaluación de KPIs
        </p>

        {/* Form */}
        <form className="login-card__form" onSubmit={handleSubmit}>
          {error && (
            <motion.div
              className="login-card__error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {error}
            </motion.div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Correo electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                id="login-email"
                type="email"
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="admin@prismo.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                id="login-password"
                type="password"
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <motion.button
            type="submit"
            className="btn btn--primary btn--lg"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ marginTop: 'var(--space-2)' }}
          >
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, borderTopColor: 'white' }} />
            ) : (
              <>
                Iniciar Sesión
                <ArrowRight size={18} />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
    </ParticlesProvider>
  );
}
