(() => {
  // Theme toggle
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    function updateAppScreenshots(theme) {
      const isDark = theme === 'dark' ||
        (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.querySelectorAll('.showcase-slide img').forEach(img => {
        img.src = img.src.replace(isDark ? '-light.png' : '-dark.png', isDark ? '-dark.png' : '-light.png');
      });
    }

    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      updateAppScreenshots(saved);
    }

    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const isDark = current === 'dark' ||
        (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);

      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateAppScreenshots(next);
    });
  }

  // Version badge + download links
  fetch('version.json')
    .then(r => r.json())
    .then(data => {
      const badge = document.getElementById('version-badge');
      if (badge && data.version) badge.textContent = 'v' + data.version + ' · ';

      const dmgUrl = 'https://github.com/ghaida/emdy/releases/download/v' + data.version + '/Emdy-' + data.version + '-arm64.dmg';
      document.querySelectorAll('.download-button').forEach(btn => {
        btn.href = dmgUrl;
      });
      document.querySelectorAll('.hero-cta').forEach(btn => {
        btn.href = dmgUrl;
      });
    })
    .catch(() => {});

  // Showcase carousel
  const tabs = document.querySelectorAll('.showcase-tab');
  const slides = document.querySelectorAll('.showcase-slide');
  const title = document.querySelector('.showcase-title');
  const caption = document.querySelector('.showcase-caption');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.slide;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      slides.forEach(s => {
        s.classList.remove('active');
        s.hidden = true;
      });
      const activeSlide = document.getElementById('slide-' + target);
      if (activeSlide) {
        activeSlide.classList.add('active');
        activeSlide.hidden = false;
      }

      if (title && tab.dataset.title) {
        title.textContent = tab.dataset.title;
      }
      if (caption && tab.dataset.caption) {
        caption.textContent = tab.dataset.caption;
      }
    });
  });
})();
