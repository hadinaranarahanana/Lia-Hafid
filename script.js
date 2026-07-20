/* ============================================================
   SCRIPT.JS — Main application logic
   Sections:
   1. Config & helpers
   2. Preloader
   3. Gallery image bootstrap (auto-detect gallery1..12.webp)
   4. Envelope opening sequence (GSAP)
   5. Lenis smooth scroll (right panel)
   6. AOS init
   7. Left panel + Hero background slideshows
   8. Countdown timers
   9. Gallery Swiper + Lightbox
   10. Floating nav / back-to-top / music
   11. Gift tabs + copy to clipboard + calendar links
   12. RSVP form (Supabase)
   13. Wishes form + realtime + pagination (Supabase)
   14. Micro-interactions: magnetic buttons, ripple
============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CONFIG & HELPERS
  ============================================================ */
  const CONFIG = {
    galleryCount: 12,
    galleryPath: 'assets/image/gallery/',
    galleryExt: 'jpeg', // ganti di sini jika format foto kamu beda (webp/jpg/png)
    weddingDate: new Date('2026-12-12T08:00:00+07:00'),
    heroSlideInterval: 3000,
    leftSlideInterval: 4500
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function debounce(fn, wait = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /** Generates the ordered list of gallery image paths. */
  function getGalleryImages() {
    return Array.from({ length: CONFIG.galleryCount }, (_, i) => `${CONFIG.galleryPath}gallery${i + 1}.${CONFIG.galleryExt}`);
  }

  /**
   * Attaches a graceful fallback for missing images: if a gallery
   * photo hasn't been uploaded yet, show a soft gradient panel
   * instead of a broken image icon, so the layout still looks
   * intentional during setup.
   */
  function applyImageFallback(el, isBackgroundImage = true) {
    const gradients = [
      'linear-gradient(135deg,#f0dfc0,#c9a667)',
      'linear-gradient(135deg,#e3caa0,#8b7355)',
      'linear-gradient(135deg,#f8f3ea,#e3caa0)'
    ];
    const pick = gradients[Math.floor(Math.random() * gradients.length)];
    if (isBackgroundImage) {
      el.style.backgroundImage = pick;
    } else {
      el.style.background = pick;
      el.removeAttribute('src');
    }
  }

  function preloadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  /* ============================================================
     2. PRELOADER
  ============================================================ */
  window.addEventListener('load', () => {
    const preloader = $('#preloader');
    if (preloader) {
      setTimeout(() => preloader.classList.add('is-hidden'), 500);
    }
  });

  /* ============================================================
     3. GUEST NAME FROM URL (?to=Nama+Tamu)
  ============================================================ */
  function initGuestName() {
    const params = new URLSearchParams(window.location.search);
    const guest = params.get('to');
    if (guest) {
      $('#guest-name').textContent = decodeURIComponent(guest.replace(/\+/g, ' '));
    }
  }

  /* ============================================================
     4. SECTION BACKGROUND SLIDESHOWS (Hero + Left Panel)
  ============================================================ */
  async function buildSlideshow(container, images, intervalMs, offset = 0) {
    if (!container) return;
    images.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.style.backgroundImage = `url('${src}')`;
      if (i === offset % images.length) slide.classList.add('is-active');
      container.appendChild(slide);
    });

    const slides = $$('.slide', container);
    let current = offset % images.length;

    // Verify images exist; if not, fall back gracefully per-slide.
    images.forEach(async (src, i) => {
      const ok = await preloadImage(src);
      if (!ok) applyImageFallback(slides[i], true);
    });

    setInterval(() => {
      slides[current].classList.remove('is-active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('is-active');
    }, intervalMs);
  }

  function initBackgroundSlideshows() {
    const images = getGalleryImages();
    buildSlideshow($('#left-slideshow'), images, CONFIG.leftSlideInterval, 1);
    buildSlideshow($('#hero-bg-slideshow'), images, CONFIG.heroSlideInterval, 0);

    // Verify single-image section backgrounds (bride/groom/event/etc.)
    $$('.section-bg[style]').forEach(async (el) => {
      const match = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      if (!match) return;
      const ok = await preloadImage(match[1]);
      if (!ok) applyImageFallback(el, true);
    });
  }

  /* ============================================================
     5. ENVELOPE OPENING SEQUENCE
  ============================================================ */
  function initEnvelope() {
    const envelopeScreen = $('#envelope-screen');
    const openBtn = $('#open-invitation-btn');
    const mainApp = $('#main-app');
    const flap = $('.envelope-flap');
    const letter = $('#envelope-letter');
    const envelopeBox = $('#envelope-box');
    const music = $('#bg-music');
    const musicToggle = $('#music-toggle');

    if (!openBtn) return;

    /**
     * Reveals the main app without GSAP. Used as a safety net when the
     * GSAP CDN script fails to load (no internet, blocked by firewall/
     * ad-blocker, etc.) so the invitation never gets stuck on this screen.
     */
    function openWithoutGSAP() {
      envelopeScreen.style.transition = 'opacity 0.6s ease';
      envelopeScreen.style.opacity = '0';
      setTimeout(() => {
        envelopeScreen.remove();
        mainApp.hidden = false;
        mainApp.style.transition = 'opacity 0.6s ease';
        mainApp.style.opacity = '0';
        requestAnimationFrame(() => { mainApp.style.opacity = '1'; });

        if (music) {
          music.volume = 0.5;
          music.play().then(() => {
            musicToggle.setAttribute('aria-pressed', 'true');
          }).catch(() => {
            musicToggle.setAttribute('aria-pressed', 'false');
          });
        }

        document.dispatchEvent(new CustomEvent('invitation:opened'));
      }, 600);
    }

    openBtn.addEventListener('click', () => {
      openBtn.disabled = true;
      envelopeScreen.classList.add('is-opening');

      // Watchdog: if for any reason the invitation hasn't opened within
      // 4s of clicking (stalled animation, unexpected error, etc.),
      // force it open so the guest is never stuck.
      let opened = false;
      document.addEventListener('invitation:opened', () => { opened = true; }, { once: true });
      setTimeout(() => {
        if (!opened && document.body.contains(envelopeScreen)) {
          console.warn('[Envelope] Watchdog: animasi tidak selesai dalam 4 detik, membuka paksa.');
          openWithoutGSAP();
        }
      }, 4000);

      // Safety net: if GSAP (loaded from CDN) isn't available — e.g. no
      // internet connection or the script was blocked — skip the fancy
      // envelope animation and open the invitation with a simple fade
      // instead of leaving the user stuck on this screen.
      if (typeof gsap === 'undefined') {
        console.warn('[Envelope] GSAP tidak termuat (cek koneksi internet / CDN). Menggunakan mode buka sederhana.');
        openWithoutGSAP();
        return;
      }

      try {
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          onComplete: () => {
            envelopeScreen.remove();
            mainApp.hidden = false;

            // Reveal main content
            gsap.fromTo(
              mainApp,
              { opacity: 0 },
              { opacity: 1, duration: 0.9, ease: 'power2.out' }
            );
            gsap.fromTo(
              '.right-panel .hero-content > *',
              { y: 30, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.9, stagger: 0.12, delay: 0.2 }
            );

            // Autoplay music (best-effort; browsers require gesture, which this click provides)
            if (music) {
              music.volume = 0.5;
              music.play().then(() => {
                musicToggle.setAttribute('aria-pressed', 'true');
              }).catch(() => {
                musicToggle.setAttribute('aria-pressed', 'false');
              });
            }

            document.dispatchEvent(new CustomEvent('invitation:opened'));
          }
        });

        // 1. Flap opens
        tl.to(flap, { rotationX: 180, duration: 0.7, transformOrigin: 'top center' });
        // 2. Letter slides out & up
        tl.to(letter, { y: -140, duration: 0.8 }, '-=0.25');
        // 3. Envelope shifts aside
        tl.to(envelopeBox, { x: 60, opacity: 0, duration: 0.6 }, '-=0.3');
        // 4. Whole opening screen fades + scales out
        tl.to(envelopeScreen, { opacity: 0, scale: 1.05, duration: 0.7 }, '-=0.2');
      } catch (err) {
        // Any unexpected runtime error should never leave the guest
        // stuck on the envelope screen — fall back to a simple open.
        console.error('[Envelope] Animasi GSAP gagal, fallback ke mode sederhana:', err);
        openWithoutGSAP();
      }
    });
  }

  /* ============================================================
     6. LENIS SMOOTH SCROLL (right panel scrolls independently)
  ============================================================ */
  function initLenis() {
    const rightPanel = $('.right-panel');
    if (!rightPanel || typeof Lenis === 'undefined') return null;

    const isDesktop = window.matchMedia('(min-width: 901px)').matches;

    const lenis = new Lenis({
      wrapper: isDesktop ? rightPanel : window,
      content: isDesktop ? rightPanel : document.documentElement,
      duration: 1.1,
      smoothWheel: true,
      easing: (t) => 1 - Math.pow(1 - t, 3)
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on('scroll', () => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
    });

    return lenis;
  }

  /* ============================================================
     7. AOS INIT
  ============================================================ */
  function initAOS() {
    if (typeof AOS === 'undefined') return;
    AOS.init({
      duration: 900,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60
    });

    // AOS measures against window scroll by default; since the
    // right panel scrolls independently on desktop, re-trigger a
    // refresh on its scroll events (throttled).
    const rightPanel = $('.right-panel');
    if (rightPanel) {
      rightPanel.addEventListener('scroll', debounce(() => AOS.refresh(), 200));
    }
  }

  /* ============================================================
     8. COUNTDOWN TIMERS
  ============================================================ */
  function initCountdown() {
    function update() {
      const now = new Date();
      let diff = CONFIG.weddingDate - now;
      if (diff < 0) diff = 0;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const pad = (n) => String(n).padStart(2, '0');

      // Hero countdown
      const heroDays = $('#cd-days'), heroHours = $('#cd-hours'), heroMin = $('#cd-minutes'), heroSec = $('#cd-seconds');
      if (heroDays) heroDays.textContent = pad(days);
      if (heroHours) heroHours.textContent = pad(hours);
      if (heroMin) heroMin.textContent = pad(minutes);
      if (heroSec) heroSec.textContent = pad(seconds);

      // Event section countdown
      $$('[data-cd]').forEach((el) => {
        const key = el.dataset.cd;
        const map = { days, hours, minutes, seconds };
        el.textContent = pad(map[key]);
      });
    }
    update();
    setInterval(update, 1000);
  }

  /* ============================================================
     9. GALLERY SWIPER + LIGHTBOX
  ============================================================ */
  function initGallerySwiper() {
    const wrapper = $('#gallery-swiper-wrapper');
    if (!wrapper) return;

    const images = getGalleryImages();
    images.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.innerHTML = `<img src="${src}" alt="Momen kebersamaan Anantya & Bhaskara ${i + 1}" loading="lazy" data-index="${i}">`;
      wrapper.appendChild(slide);
    });

    // Fallback for missing images
    $$('#gallery-swiper-wrapper img').forEach((img) => {
      img.addEventListener('error', () => applyImageFallback(img, false), { once: true });
    });

    if (typeof Swiper === 'undefined') return;

    new Swiper('.gallery-swiper', {
      slidesPerView: 1.15,
      spaceBetween: 16,
      centeredSlides: true,
      loop: true,
      autoplay: { delay: 3500, disableOnInteraction: false },
      lazy: true,
      pagination: { el: '.swiper-pagination', clickable: true },
      navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
      breakpoints: {
        640: { slidesPerView: 1.6 }
      },
      a11y: { enabled: true }
    });

    // Lightbox
    const lightbox = $('#lightbox');
    const lightboxImg = $('#lightbox-img');
    const closeBtn = $('#lightbox-close');

    wrapper.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.hidden = false;
      closeBtn.focus();
    });

    function closeLightbox() {
      lightbox.hidden = true;
      lightboxImg.src = '';
    }
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
  }

  /* ============================================================
     10. FLOATING NAV / BACK-TO-TOP / MUSIC
  ============================================================ */
  function initFloatingUI() {
    const rightPanel = $('.right-panel');
    const backToTop = $('#back-to-top');
    const navLinks = $$('.floating-nav a');
    const musicToggle = $('#music-toggle');
    const music = $('#bg-music');

    if (!rightPanel) return;

    const scrollTarget = () => (window.matchMedia('(min-width: 901px)').matches ? rightPanel : window);

    function onScroll() {
      const scroller = scrollTarget();
      const scrollY = scroller === window ? window.scrollY : rightPanel.scrollTop;

      // back to top visibility
      if (backToTop) backToTop.hidden = scrollY < 400 ? true : false;
      if (backToTop) backToTop.classList.toggle('is-visible', scrollY > 400);

      // active section indicator
      const sections = $$('.section[id]');
      let activeId = sections[0] && sections[0].id;
      const refPoint = (scroller === window ? window.innerHeight : rightPanel.clientHeight) * 0.4;

      sections.forEach((sec) => {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= refPoint) activeId = sec.id;
      });

      navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === activeId));
    }

    rightPanel.addEventListener('scroll', debounce(onScroll, 50));
    window.addEventListener('scroll', debounce(onScroll, 50));
    onScroll();

    if (backToTop) {
      backToTop.addEventListener('click', () => {
        const scroller = scrollTarget();
        if (scroller === window) window.scrollTo({ top: 0, behavior: 'smooth' });
        else rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    navLinks.forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = $(a.getAttribute('href'));
        if (!target) return;
        if (window.matchMedia('(min-width: 901px)').matches) {
          rightPanel.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        } else {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    if (musicToggle && music) {
      musicToggle.addEventListener('click', () => {
        if (music.paused) {
          music.play().catch(() => {});
          musicToggle.setAttribute('aria-pressed', 'true');
        } else {
          music.pause();
          musicToggle.setAttribute('aria-pressed', 'false');
        }
      });
    }
  }

  /* ============================================================
     11. GIFT TABS + COPY + CALENDAR LINKS
  ============================================================ */
  function initGiftTabs() {
    const buttons = $$('.gift-tab-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        $$('.gift-tab-panel').forEach((p) => { p.classList.remove('active'); p.hidden = true; });
        const panel = $(`.gift-tab-panel[data-panel="${btn.dataset.tab}"]`);
        if (panel) { panel.classList.add('active'); panel.hidden = false; }
      });
    });
  }

  function initCopyButtons() {
    $$('.btn-copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const target = $(`#${btn.dataset.copyTarget}`);
        if (!target) return;
        try {
          await navigator.clipboard.writeText(target.textContent.trim());
          const original = btn.textContent;
          btn.textContent = 'Tersalin!';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
        } catch (err) {
          console.error('Clipboard error:', err);
        }
      });
    });
  }

  function toICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  function initCalendarButtons() {
    $$('.add-to-calendar').forEach((btn) => {
      btn.addEventListener('click', () => {
        const isAkad = btn.dataset.event === 'akad';
        const start = new Date(CONFIG.weddingDate);
        if (!isAkad) start.setHours(11, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + (isAkad ? 2 : 3));

        const title = isAkad ? 'Akad Nikah Anantya & Bhaskara' : 'Resepsi Anantya & Bhaskara';
        const location = isAkad ? 'Masjid Al-Ikhlas, Jakarta Selatan' : 'The Kayana Grand Ballroom, Jakarta Selatan';

        const ics = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'BEGIN:VEVENT',
          `DTSTART:${toICSDate(start)}`,
          `DTEND:${toICSDate(end)}`,
          `SUMMARY:${title}`,
          `LOCATION:${location}`,
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\n');

        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.ics`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  /* ============================================================
     12. RSVP FORM (Supabase)
  ============================================================ */
  function initRSVPForm() {
    const form = $('#rsvp-form');
    if (!form) return;

    const submitBtn = $('#rsvp-submit-btn');
    const statusEl = $('#rsvp-status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nama = $('#rsvp-nama').value.trim();
      const kehadiran = $('#rsvp-kehadiran').value;
      const jumlah = parseInt($('#rsvp-jumlah').value, 10) || 1;
      const pesan = $('#rsvp-pesan').value.trim();

      let valid = true;
      $('#error-nama').textContent = '';
      $('#error-kehadiran').textContent = '';

      if (!nama) { $('#error-nama').textContent = 'Nama wajib diisi.'; valid = false; }
      if (!kehadiran) { $('#error-kehadiran').textContent = 'Silakan pilih konfirmasi kehadiran.'; valid = false; }
      if (!valid) return;

      submitBtn.disabled = true;
      $('.btn-submit-text', submitBtn).textContent = 'Mengirim...';
      $('.btn-spinner', submitBtn).hidden = false;
      statusEl.textContent = '';
      statusEl.className = 'form-status';

      const { data, error } = await window.WeddingSupabase.submitRSVP({ nama, kehadiran, jumlah_tamu: jumlah, pesan });

      submitBtn.disabled = false;
      $('.btn-submit-text', submitBtn).textContent = 'Kirim Konfirmasi';
      $('.btn-spinner', submitBtn).hidden = true;

      if (error) {
        statusEl.textContent = 'Terjadi kesalahan. Silakan coba lagi.';
        statusEl.classList.add('error');
        return;
      }

      statusEl.textContent = 'Terima kasih! Konfirmasi kehadiran Anda telah kami terima.';
      statusEl.classList.add('success');
      form.reset();

      if (typeof gsap !== 'undefined') {
        gsap.fromTo(statusEl, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });
      }
    });
  }

  /* ============================================================
     13. WISHES FORM + REALTIME + PAGINATION
  ============================================================ */
  function initWishes() {
    const form = $('#wish-form');
    const list = $('#wishes-list');
    const sortSelect = $('#wishes-sort-select');
    const loadMoreBtn = $('#wishes-load-more');
    const emptyState = $('#wishes-empty');

    if (!form || !list) return;

    let page = 0;
    const pageSize = 8;
    let sort = 'newest';
    let totalCount = 0;
    let loadedIds = new Set();

    function getInitials(name) {
      return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    }

    function timeAgo(dateStr) {
      const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
      if (diff < 60) return 'Baru saja';
      if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
      return `${Math.floor(diff / 86400)} hari lalu`;
    }

    function renderWish(row, prepend = false) {
      if (loadedIds.has(row.id)) return;
      loadedIds.add(row.id);

      const li = document.createElement('li');
      li.className = 'wish-item';
      li.innerHTML = `
        <span class="wish-avatar" aria-hidden="true">${getInitials(row.nama)}</span>
        <div class="wish-body">
          <p class="wish-name">${escapeHTML(row.nama)}</p>
          <p class="wish-message">${escapeHTML(row.pesan)}</p>
          <span class="wish-time">${timeAgo(row.created_at)}</span>
        </div>
      `;
      if (prepend) list.prepend(li); else list.appendChild(li);
      emptyState.hidden = true;
    }

    function escapeHTML(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    async function loadPage() {
      const { data, error, count } = await window.WeddingSupabase.getUcapanList(page, pageSize, sort);
      totalCount = count || 0;

      if (error) {
        console.error('[Wishes] load error:', error);
        return;
      }

      if (page === 0) {
        list.innerHTML = '';
        loadedIds = new Set();
      }

      if (!data || data.length === 0) {
        if (page === 0) emptyState.hidden = false;
        loadMoreBtn.hidden = true;
        return;
      }

      data.forEach((row) => renderWish(row));
      loadMoreBtn.hidden = (page + 1) * pageSize >= totalCount;
    }

    loadPage();

    loadMoreBtn.addEventListener('click', () => {
      page += 1;
      loadPage();
    });

    sortSelect.addEventListener('change', () => {
      sort = sortSelect.value;
      page = 0;
      loadPage();
    });

    // Realtime: new wishes appear instantly at top when sorted by "newest"
    window.WeddingSupabase.subscribeUcapanRealtime((row) => {
      if (sort === 'newest') renderWish(row, true);
    });

    // Submit new wish
    const submitBtn = $('#wish-submit-btn');
    const statusEl = $('#wish-status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = $('#wish-nama').value.trim();
      const pesan = $('#wish-pesan').value.trim();
      if (!nama || !pesan) return;

      submitBtn.disabled = true;
      $('.btn-submit-text', submitBtn).textContent = 'Mengirim...';
      $('.btn-spinner', submitBtn).hidden = false;

      const { data, error } = await window.WeddingSupabase.submitUcapan({ nama, pesan });

      submitBtn.disabled = false;
      $('.btn-submit-text', submitBtn).textContent = 'Kirim Ucapan';
      $('.btn-spinner', submitBtn).hidden = true;

      if (error) {
        statusEl.textContent = 'Gagal mengirim ucapan. Silakan coba lagi.';
        statusEl.className = 'form-status error';
        return;
      }

      statusEl.textContent = 'Terima kasih atas ucapan dan doanya!';
      statusEl.className = 'form-status success';
      form.reset();
      // Realtime subscription will render it; as a fallback also render directly.
      if (data) renderWish(data, true);
    });
  }

  /* ============================================================
     14. MICRO-INTERACTIONS: magnetic buttons + ripple
  ============================================================ */
  function initMagneticButtons() {
    if (typeof gsap === 'undefined') return;
    const targets = $$('.btn-open, .btn-submit, .btn-outline');

    targets.forEach((btn) => {
      btn.classList.add('magnetic-btn');
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: x * 0.25, y: y * 0.3, duration: 0.3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  function initRippleEffect() {
    $$('.btn-open, .btn-submit, .btn-outline, .btn-copy').forEach((btn) => {
      btn.style.position = btn.style.position || 'relative';
      btn.style.overflow = 'hidden';
      btn.addEventListener('click', function (e) {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.left = `${e.clientX - rect.left}px`;
        ripple.style.top = `${e.clientY - rect.top}px`;
        ripple.style.width = ripple.style.height = `${Math.max(rect.width, rect.height)}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      });
    });
  }

  /* ============================================================
     15. GSAP SCROLL-TRIGGERED SECTION REVEALS
  ============================================================ */
  function initScrollReveals() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const rightPanel = $('.right-panel');
    const isDesktop = window.matchMedia('(min-width: 901px)').matches;

    $$('.section-title').forEach((title) => {
      gsap.fromTo(
        title,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: title,
            scroller: isDesktop ? rightPanel : window,
            start: 'top 85%'
          }
        }
      );
    });
  }

  /* ============================================================
     INIT — DOM READY
  ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    initGuestName();
    initEnvelope();
    initCountdown();

    document.addEventListener('invitation:opened', () => {
      initBackgroundSlideshows();
      initLenis();
      initAOS();
      initGallerySwiper();
      initFloatingUI();
      initGiftTabs();
      initCopyButtons();
      initCalendarButtons();
      initRSVPForm();
      initWishes();
      initMagneticButtons();
      initRippleEffect();
      initScrollReveals();
    }, { once: true });
  });
})();
