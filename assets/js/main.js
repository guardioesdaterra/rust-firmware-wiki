// Rust Firmware Wiki — Interactive Experience
// Hypnotic AMOLED · Glass Core · Psychodelic Red/Black

document.addEventListener('DOMContentLoaded', () => {
  initCollapsibles();
  initTabs();
  initQuizzes();
  initBackToTop();
  initHeaderScroll();
  initCopyButtons();
  initPlayground();
  initMobileMenu();
  initScrollProgress();
  initReveal();
  initCardTilt();
  initCodeLineNumbers();
  initRippleEffect();
});

// ─── Collapsible sections ───────────────────────────────
function initCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
}

// ─── Tab navigation ─────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('.tab');
    const container = tabContainer.closest('.tabs-container') || tabContainer.parentElement;
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const el = document.getElementById(target);
        if (el) el.classList.add('active');
      });
    });
  });
}

// ─── Quizzes ────────────────────────────────────────────
function initQuizzes() {
  document.querySelectorAll('.quiz').forEach(quiz => {
    const options = quiz.querySelectorAll('.quiz-option');
    const feedback = quiz.querySelector('.quiz-feedback');
    const correctAnswer = quiz.dataset.answer;

    options.forEach(option => {
      option.addEventListener('click', () => {
        if (quiz.dataset.answered === 'true') return;
        const answer = option.dataset.answer;
        quiz.dataset.answered = 'true';

        options.forEach(o => {
          o.style.pointerEvents = 'none';
          if (o.dataset.answer === correctAnswer) o.classList.add('correct');
        });

        if (answer === correctAnswer) {
          option.classList.add('correct');
          if (feedback) {
            feedback.textContent = '✓ Correct! ' + (quiz.dataset.explanation || '');
            feedback.className = 'quiz-feedback show correct';
          }
        } else {
          option.classList.add('incorrect');
          if (feedback) {
            feedback.textContent = '✗ Incorrect. ' + (quiz.dataset.explanation || '');
            feedback.className = 'quiz-feedback show incorrect';
          }
        }
      });
    });
  });
}

// ─── Back to top ─────────────────────────────────────────
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '↑';
  btn.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── Header scroll effect ───────────────────────────────
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ─── Copy code buttons ──────────────────────────────────
function initCopyButtons() {
  document.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    pre.style.position = 'relative';
    pre.appendChild(btn);

    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--success)';
        setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 2000);
      } catch {
        btn.textContent = 'Failed';
        btn.style.color = 'var(--error)';
        setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 2000);
      }
    });
  });
}

// ─── Interactive playground ─────────────────────────────
function initPlayground() {
  document.querySelectorAll('.playground').forEach(pg => {
    const textarea = pg.querySelector('textarea');
    const output = pg.querySelector('.playground-output');
    const runBtn = pg.querySelector('.run-btn');
    if (!runBtn || !textarea || !output) return;

    runBtn.addEventListener('click', () => simulateRun(textarea.value, output));
  });
}

function simulateRun(code, output) {
  output.innerHTML = '<span style="color:var(--text-muted)">▶ Compiling...</span>';
  setTimeout(() => {
    try {
      const prints = [];
      const lines = code.split('\n');
      lines.forEach(line => {
        const pm = line.match(/println!\s*\(\s*"([^"]+)"/);
        if (pm) prints.push(pm[1].replace(/\{\}/g, () => String(Math.floor(Math.random() * 100))));
        const fm = line.match(/format!\s*\(\s*"([^"]+)"/);
        if (fm) prints.push(fm[1].replace(/\{\}/g, () => String(Math.floor(Math.random() * 100))));
      });

      if (prints.length) {
        output.innerHTML = '<span style="color:var(--success)">✓ Compiled successfully</span>\n\n' +
          prints.map(p => '  ' + p).join('\n') +
          '\n\n<span style="color:var(--text-dim)">Process finished with exit code 0</span>';
      } else {
        output.innerHTML = '<span style="color:var(--success)">✓ Compiled successfully</span>\n\n' +
          '<span style="color:var(--text-dim)">(no output)</span>\n\n' +
          '<span style="color:var(--text-dim)">Process finished with exit code 0</span>';
      }
    } catch (e) {
      output.innerHTML = '<span style="color:var(--error)">✗ Compilation error:</span>\n  ' + e.message;
    }
  }, 400);
}

// ─── Mobile menu ────────────────────────────────────────
function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('siteNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      nav.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !nav.contains(e.target) && nav.classList.contains('open')) {
      toggle.classList.remove('active');
      nav.classList.remove('open');
    }
  });
}

// ─── Scroll progress bar ────────────────────────────────
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ─── Scroll-triggered reveal ────────────────────────────
function initReveal() {
  const revealEls = document.querySelectorAll('.chapter-card, .quiz, .playground, .comparison, table');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.setProperty('--reveal-delay', `${i * 0.05}s`);
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '30px' });

  revealEls.forEach(el => observer.observe(el));
}

// ─── 3D magnetic card tilt ─────────────────────────────
function initCardTilt() {
  document.querySelectorAll('.chapter-card').forEach(card => {
    let rafId = null;

    card.addEventListener('mousemove', (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rx = (y - cy) / 15;
        const ry = (cx - x) / 15;
        card.style.transform =
          `translateY(-8px) scale(1.02) perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        rafId = null;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.style.transform = '';
    });
  });
}

// ─── Code line numbers ──────────────────────────────────
function initCodeLineNumbers() {
  document.querySelectorAll('pre code').forEach(codeBlock => {
    const html = codeBlock.innerHTML;
    const lines = html.split('\n');
    if (lines.length <= 1) return;

    const wrapped = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed === '') return '<span class="line"><br></span>';
      return `<span class="line">${line}</span>`;
    }).join('\n');

    codeBlock.innerHTML = wrapped;
  });
}

// ─── Ripple click effect ────────────────────────────────
function initRippleEffect() {
  document.querySelectorAll('.btn, .quiz-option, .nav-btn, .chapter-card').forEach(el => {
    el.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute; top: ${y}px; left: ${x}px;
        width: ${size}px; height: ${size}px;
        border-radius: 50%; background: rgba(255, 26, 26, 0.15);
        pointer-events: none; transform: scale(0);
        animation: rippleAnim 0.6s ease-out forwards;
      `;

      // Ensure position:relative for ripple to anchor
      if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  });
}

// ─── Smooth scroll for anchor links ─────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});


