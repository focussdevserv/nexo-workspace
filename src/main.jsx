import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import './fonts.css';
import './styles.css';
import './navigation.css';
import './dark-mode.css';
import './notifications.css';
import './premium-design.css';
import './screens/mobile-touch-targets.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.user) delete event.user;
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
      if (event.request.url) event.request.url = event.request.url.split(/[?#]/, 1)[0].replace(/:\/\/[^/@]+@/, '://');
    }
    for (const breadcrumb of event.breadcrumbs || []) {
      delete breadcrumb.message;
      delete breadcrumb.data;
    }
    return event;
  },
});

function AppErrorFallback() {
  return <main className="app-error-page" role="alert">
    <section className="app-error-card">
      <div className="app-error-brand"><span>F</span><strong>Focusshub</strong></div>
      <div className="app-error-icon" aria-hidden="true">!</div>
      <p className="app-error-kicker">Esta área está indisponível</p>
      <h1>Não foi possível abrir esta tela</h1>
      <p className="app-error-copy">Atualize a página para tentar novamente. Se o problema continuar, volte ao menu e abra outra área.</p>
      <button className="app-error-retry" type="button" onClick={() => window.location.reload()}>Atualizar página</button>
    </section>
  </main>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={AppErrorFallback}>
    <React.StrictMode><App /></React.StrictMode>
  </Sentry.ErrorBoundary>,
);
