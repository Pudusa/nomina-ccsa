import React, { useState } from 'react';
import { apiFetch } from '../../utils/api';
import { Icon } from '../Icon';

interface LoginModalProps {
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error('Credenciales inválidas.');

      if (data.token) {
        localStorage.setItem('nomina_token', data.token);
        localStorage.setItem('nomina_user', JSON.stringify(data.user));
        onLoginSuccess();
      }
    } catch {
      // Mensaje genérico: nunca revela si el usuario existe ni el motivo del fallo.
      setError('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <div className="login-accent" />
        <div className="login-body">
          <div className="login-heading">
            <div className="login-icon"><Icon name="lock" filled className="login-lock" /></div>
            <span className="login-portal-badge">
              <Icon name="verified_user" className="login-badge-icon" /> Portal Seguro de Operaciones
            </span>
            <h1 className="login-title">Acceso al Sistema</h1>
            <p className="login-subtitle">Nómina y Asistencia CCSA</p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <Icon name="error" filled className="login-error-icon" />
              <div className="login-error-body">
                <div className="login-error-head">
                  <strong>{error}</strong>
                  <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso"><Icon name="close" /></button>
                </div>
                <p>Verifique su usuario o contraseña e intente nuevamente.</p>
                <small>Mensaje de seguridad genérico para protección de credenciales</small>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="username">
                <span>Usuario <b className="login-required">*</b></span>
                <small>Identificador único</small>
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="person" /></span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. m.martinez o #1001"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">
                <span>Contraseña <b className="login-required">*</b></span>
                <small>Credencial de acceso</small>
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="key" /></span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            </div>

            <div className="login-note">
              <Icon name="verified_user" className="login-note-icon" />
              <p>
                Acceso exclusivo para personal autorizado de Nómina y Recursos Humanos CCSA.
                No existen canales externos de autoregistro ni restablecimiento.
              </p>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <><span className="login-spinner" /> Iniciando sesión...</>
              ) : (
                <>Ingresar al Sistema <Icon name="login" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
