import { Icon } from '../Icon';

interface SessionExpiredModalProps {
  onReLogin: () => void;
}

export function SessionExpiredModal({ onReLogin }: SessionExpiredModalProps) {
  return (
    <div className="modal-backdrop" role="alertdialog" aria-label="Sesión expirada">
      <div className="modal-content session-expired">
        <div className="session-expired-icon"><Icon name="lock" filled /></div>
        <h2>Tu sesión ha expirado</h2>
        <p className="modal-subtitle">
          Por seguridad, tu sesión terminó por inactividad o porque tus credenciales cambiaron.
          Inicia sesión de nuevo para continuar.
        </p>
        <p className="session-expired-note">
          No se perdieron datos: todo lo que viste era de solo lectura.
        </p>
        <div className="modal-actions">
          <button className="btn-save" onClick={onReLogin}>
            <Icon name="login" /> Iniciar sesión de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
