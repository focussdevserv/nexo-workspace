const browserGlobals = [
  'window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'URL',
  'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData', 'crypto',
  'navigator', 'alert', 'confirm', 'prompt', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'console', 'structuredClone', 'atob', 'btoa',
  'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'HTMLElement',
  'Element', 'Node', 'CustomEvent', 'Event', 'Image', 'location', 'history',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
];

export default [{
  files: ['src/**/*.{js,jsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: Object.fromEntries(browserGlobals.map((name) => [name, 'readonly'])),
  },
  rules: { 'no-undef': 'error' },
}];
