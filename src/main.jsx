import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import './styles.css';
import './navigation.css';
import './notifications.css';

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
  return <main role="alert" style={{ maxWidth: 520, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#18212f' }}>
    <h1>Não foi possível abrir esta tela</h1>
    <p>Recarregue o app. Se o problema continuar, tente novamente em alguns instantes.</p>
    <button type="button" onClick={() => window.location.reload()}>Recarregar o app</button>
  </main>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={AppErrorFallback}>
    <React.StrictMode><App /></React.StrictMode>
  </Sentry.ErrorBoundary>,
);
