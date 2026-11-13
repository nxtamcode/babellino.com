(() => {
  const visual = document.querySelector('.hero-title-visual');
  const controls = document.querySelector('.hero-language-controls');
  const label = document.getElementById('hero-language');
  const toggle = document.getElementById('hero-language-toggle');
  if (!visual || !controls || !label || !toggle) return;

  const config = JSON.parse(document.getElementById('site-config').textContent);
  const phrases = [config.languages.find(p => p.code === config.locale),
    ...config.languages.filter(p => p.code !== config.locale)];
  visual.classList.add('is-animated');
  const slides = [visual.querySelector('.headline-slide')];
  for (const phrase of phrases.slice(1)) {
    const slide = document.createElement('span');
    slide.className = 'headline-slide';
    slide.lang = phrase.lang;
    phrase.lines.forEach((text, index) => {
      const line = document.createElement(index === 2 ? 'em' : 'span');
      line.className = 'headline-line';
      line.textContent = text;
      slide.append(line);
    });
    visual.append(slide);
    slides.push(slide);
  }

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let paused = false;
  let timer;
  // All slides occupy the same CSS grid cell. Natural wrapping and the tallest
  // slide reserve space without shrinking individual languages or moving the CTA.

  const show = index => {
    current = index;
    slides.forEach((slide, position) => slide.classList.toggle('is-current', position === index));
    label.textContent = phrases[index].name;
    label.lang = phrases[index].lang;
  };

  const schedule = () => {
    clearTimeout(timer);
    if (paused || motion.matches || document.hidden) return;
    timer = setTimeout(() => {
      show((current + 1) % phrases.length);
      schedule();
    }, 6000);
  };

  const updateButton = () => {
    toggle.textContent = config.labels[paused ? 'resume' : 'pause'];
    toggle.setAttribute('aria-label', config.labels[paused ? 'resumeLabel' : 'pauseLabel']);
  };

  const updateMotion = () => {
    controls.hidden = motion.matches;
    if (motion.matches) {
      paused = false;
      show(0);
    }
    updateButton();
    schedule();
  };

  toggle.addEventListener('click', () => {
    paused = !paused;
    updateButton();
    schedule();
  });
  motion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', schedule);
  updateMotion();
})();
