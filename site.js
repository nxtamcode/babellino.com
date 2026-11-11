(() => {
  const element = document.getElementById('site-config');
  if (!element) return;
  const config = JSON.parse(element.textContent);
  const supported = code => config.languages.find(language => language.code === code);
  const match = tag => supported(String(tag).toLowerCase().split('-')[0]);
  const remember = code => {
    try { localStorage.setItem('babellino-language', code); } catch { /* Storage is optional. */ }
  };
  const preferred = () => {
    try {
      const saved = supported(localStorage.getItem('babellino-language'));
      if (saved) return saved;
    } catch { /* Private browsing or blocked storage: use the browser preference. */ }
    return (navigator.languages || [navigator.language]).map(match).find(Boolean) || supported('en');
  };
  const explicit = supported(new URLSearchParams(location.search).get('lang'));
  if (explicit) remember(explicit.code);

  // Only the unlocalized entry point selects automatically. Explicit localized
  // URLs remain shareable/crawlable, even when a different preference is stored.
  if (!config.errors && (location.pathname === '/' || location.pathname === '/index.html')) {
    const chosen = explicit || preferred();
    if (chosen.code !== 'en') {
      const target = new URL(chosen.path, location.origin);
      target.search = location.search;
      target.searchParams.delete('lang');
      target.hash = location.hash;
      location.replace(target.href);
      return;
    }
  }

  function localizeError(language) {
    const copy = config.errors[language.code];
    document.documentElement.lang = language.lang;
    document.title = copy.errorTitle;
    document.getElementById('error-heading').textContent = copy.errorHeading;
    document.getElementById('error-message').textContent = copy.errorMessage;
    const home = document.getElementById('error-home');
    home.textContent = copy.backHome;
    home.href = language.path + (language.code === 'en' ? '?lang=en' : '');
    const brand = document.querySelector('.header .wordmark');
    brand.href = home.href;
    brand.setAttribute('aria-label', copy.home);
    document.querySelector('[data-language-label]').textContent = `${copy.languageMenu}: `;
    const label = document.querySelector('[data-language-name]');
    label.textContent = language.name;
    label.lang = language.lang;
    document.querySelectorAll('[data-locale]').forEach(link => {
      if (link.dataset.locale === language.code) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (config.errors) {
      const pathLanguage = supported(location.pathname.split('/')[1]);
      // Translate the error in place; never turn a missing URL into a 200 redirect.
      localizeError(explicit || pathLanguage || preferred());
    }
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-locale]');
    const menu = document.querySelector('.site-language');
    if (link && supported(link.dataset.locale)) {
      remember(link.dataset.locale);
      if (config.errors) {
        event.preventDefault();
        localizeError(supported(link.dataset.locale));
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    } else if (menu && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    const menu = document.querySelector('.site-language[open]');
    if (event.key === 'Escape' && menu) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
})();
