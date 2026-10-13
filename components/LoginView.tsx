import React, { useState } from 'react';
import * as api from '../services/api';

interface LoginViewProps {
  onLoggedIn: () => void;
}

// Anmeldung mit dem ChurchTools-Konto. Zugangsdaten werden nur zur Prüfung an
// ChurchTools weitergegeben und nirgends gespeichert.
const LoginView: React.FC<LoginViewProps> = ({ onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.login(username, password, needsTotp ? totpCode : undefined);
      if (result.ok) {
        setPassword('');
        setTotpCode('');
        onLoggedIn();
        return;
      }
      if (result.needsTotp) setNeedsTotp(true);
      setError(result.error);
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Predigtplaner</h1>
          <p className="text-sm text-gray-500">Anmeldung mit dem ChurchTools-Konto</p>
        </div>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Benutzername oder E-Mail</label>
          <input id="username" type="text" autoComplete="username" required value={username}
            onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
          <input id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        {needsTotp && (
          <div>
            <label htmlFor="totp" className="block text-sm font-medium text-gray-700 mb-1">Bestätigungscode (2FA)</label>
            <input id="totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required
              value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className={inputClass} />
          </div>
        )}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
          {isSubmitting ? 'Anmelden...' : 'Anmelden'}
        </button>
        <p className="text-xs text-gray-400">Es wird nur ein technisch notwendiges Sitzungs-Cookie gesetzt (12 Stunden gültig).</p>
      </form>
    </div>
  );
};

export default LoginView;
