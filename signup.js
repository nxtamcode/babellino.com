/* Load the owner-supplied embed only near the signup section. No custom API,
   attribution script, email storage, or invented submission-success handling. */
(() => {
  'use strict';
  const section = document.querySelector('#updates');
  const mount = document.querySelector('#signup-embed');
  const status = document.querySelector('.signup-status');
  if (!section || !mount || !status) return;

  function loadForm() {
    status.textContent = status.dataset.loading;
    status.hidden = false;
    const failed = () => {
      status.textContent = status.dataset.error;
      status.hidden = false;
    };
    const timeout = setTimeout(failed, 15000);
    // The loader creates the cross-origin iframe. Label it for assistive tech;
    // its load event is NOT evidence of subscription success or delivery.
    const observer = new MutationObserver(() => {
      const frame = mount.querySelector('iframe');
      if (!frame) return;
      frame.title = mount.dataset.formTitle;
      frame.addEventListener('load', () => {
        clearTimeout(timeout);
        status.hidden = true;
      });
      observer.disconnect();
    });
    observer.observe(mount, { childList: true, subtree: true });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://subscribe-forms.beehiiv.com/v3/loader.js';
    script.dataset.beehiivForm = '686fd649-8c20-4918-b7ab-f87bda722800';
    script.addEventListener('error', () => { clearTimeout(timeout); failed(); });
    mount.append(script);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      loadForm();
    }, { rootMargin: '200px' });
    observer.observe(section);
  } else {
    loadForm();
  }
})();
