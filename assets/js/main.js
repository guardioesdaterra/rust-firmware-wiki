// Rust Firmware Wiki - Interactive Features

document.addEventListener('DOMContentLoaded', function() {
  initCollapsibles();
  initTabs();
  initQuizzes();
  initBackToTop();
  initHeaderScroll();
  initCopyButtons();
  initPlayground();
});

// Collapsible sections
function initCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      section.classList.toggle('open');
    });
  });
}

// Tab navigation
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('.tab');
    const contents = tabContainer.parentElement.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
      });
    });
  });
}

// Quiz functionality
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
          if (o.dataset.answer === correctAnswer) {
            o.classList.add('correct');
          }
        });

        if (answer === correctAnswer) {
          option.classList.add('correct');
          feedback.textContent = 'Correct! ' + (quiz.dataset.explanation || '');
          feedback.className = 'quiz-feedback show correct';
        } else {
          option.classList.add('incorrect');
          feedback.textContent = 'Incorrect. ' + (quiz.dataset.explanation || '');
          feedback.className = 'quiz-feedback show incorrect';
        }
      });
    });
  });
}

// Back to top button
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '↑';
  btn.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Header scroll effect
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// Copy code buttons
function initCopyButtons() {
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.style.cssText = `
      position: absolute;
      top: 0.5rem;
      right: 4rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.3rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
      z-index: 10;
    `;

    pre.style.position = 'relative';
    pre.appendChild(btn);

    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;

      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--success)';
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.style.color = 'var(--text-muted)';
        }, 2000);
      } catch (err) {
        btn.textContent = 'Failed';
        btn.style.color = 'var(--error)';
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.style.color = 'var(--text-muted)';
        }, 2000);
      }
    });
  });
}

// Interactive playground
function initPlayground() {
  document.querySelectorAll('.playground').forEach(playground => {
    const textarea = playground.querySelector('textarea');
    const output = playground.querySelector('.playground-output');
    const runBtn = playground.querySelector('.run-btn');

    if (!runBtn || !textarea || !output) return;

    runBtn.addEventListener('click', () => {
      const code = textarea.value;
      simulateRun(code, output);
    });
  });
}

function simulateRun(code, output) {
  output.innerHTML = '<span class="info">Compiling...\n</span>';

  setTimeout(() => {
    try {
      // Simple Rust simulation
      const prints = [];
      const lines = code.split('\n');

      lines.forEach(line => {
        // Match println! patterns
        const printMatch = line.match(/println!\s*\(\s*"([^"]+)"/);
        if (printMatch) {
          let text = printMatch[1];
          // Replace simple format patterns
          text = text.replace(/\{\}/g, () => Math.floor(Math.random() * 100));
          prints.push(text);
        }

        // Match println! with variables
        const varMatch = line.match(/println!\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/);
        if (varMatch) {
          prints.push(varMatch[1].replace(/\{\}/g, '42'));
        }
      });

      if (prints.length > 0) {
        output.innerHTML = '<span class="success">Program output:</span>\n\n' +
          prints.map(p => '> ' + p).join('\n') +
          '\n\n<span class="success">Process finished with exit code 0</span>';
      } else {
        output.innerHTML = '<span class="success">Process finished with exit code 0</span>\n\n(No output)';
      }
    } catch (e) {
      output.innerHTML = '<span class="error">Error: ' + e.message + '</span>';
    }
  }, 500);
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
