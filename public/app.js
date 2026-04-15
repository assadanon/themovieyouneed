// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = {
  popular:      { label: 'The Popular Choice',           shortName: 'popular',       color: '#f4a7b9' },
  indie:        { label: 'The Hidden Gem',                shortName: 'hidden gem',    color: '#4dd0e1' },
  animation:    { label: 'The Animated One',              shortName: 'animated',      color: '#7ecba8' },
  classic:      { label: 'The Hall of Fame Choice',       shortName: 'hall of fame',  color: '#c9d4db' },
  world_cinema: { label: 'The World Cinema One',          shortName: 'world cinema',  color: '#ce93d8' },
  short:        { label: 'The Under 100 Minutes Choice',  shortName: 'under 100 min', color: '#ffa94d' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let questions = [];
let answers   = [];
let currentQuestion = 0;
let userAge = 25;
let lastResults = null; // stored for image export

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const logoWrap          = document.getElementById('logoWrap');
const logoLine1         = logoWrap.querySelector('.logo-line1');
const logoLine2         = logoWrap.querySelector('.logo-line2');
const landing           = document.getElementById('landing');
const tagline           = document.getElementById('tagline');
const startBtn          = document.getElementById('startBtn');
const onboardingSection = document.getElementById('onboardingSection');
const obStepAge         = document.getElementById('obStepAge');
const ageSlider         = document.getElementById('ageSlider');
const ageSliderValue    = document.getElementById('ageSliderValue');
const obContinueBtn     = document.getElementById('obContinueBtn');
const quizSection       = document.getElementById('quizSection');
const quizContainer     = document.getElementById('quizContainer');
const loadingSection    = document.getElementById('loadingSection');
const loadingSub        = document.getElementById('loadingSub');
const resultsSection    = document.getElementById('resultsSection');
const progressFill      = document.getElementById('progressFill');
const questionNumber    = document.getElementById('questionNumber');
const questionText      = document.getElementById('questionText');
const optionsEl         = document.getElementById('options');
const backBtn           = document.getElementById('backBtn');
const nextBtn           = document.getElementById('nextBtn');
const submitBtn         = document.getElementById('submitBtn');
const prescriptionState = document.getElementById('prescriptionState');
const prescriptionNeed  = document.getElementById('prescriptionNeed');
const recommendationsEl = document.getElementById('recommendations');
const ourChoiceEl       = document.getElementById('ourChoice');
const revealBtn         = document.getElementById('revealBtn');
const profileReveal     = document.getElementById('profileReveal');
const restartBtn        = document.getElementById('restartBtn');
const shareBtn          = document.getElementById('shareBtn');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Preview shortcut — append ?preview to the URL to jump straight to mock results
  if (new URLSearchParams(window.location.search).has('preview')) {
    showPreviewResults();
    return;
  }

  try {
    const res = await fetch('/api/questions');
    questions = await res.json();
  } catch (e) {
    console.error('Failed to load questions:', e);
  }

  // ── Logo animation (pure JS — no CSS keyframes) ──
  // Line 1 fades in
  setTimeout(() => { logoLine1.style.opacity = '1'; }, 300);
  // Line 2 fades in 0.5s later
  setTimeout(() => { logoLine2.style.opacity = '1'; }, 800);
  // Line 1 fades out
  setTimeout(() => { logoLine1.style.opacity = '0'; }, 2500);
  // After line 1 is fully invisible: collapse its space, then glide logo to corner
  setTimeout(() => {
    logoWrap.classList.add('shrunk'); // CSS collapses line1 in sync with the glide
    setTimeout(() => {
      tagline.classList.add('visible');
      setTimeout(() => startBtn.classList.add('visible'), 350);
    }, 1050);
  }, 3300);
}

// ── Quiz Logic ────────────────────────────────────────────────────────────────
function showQuestion(index) {
  const q     = questions[index];
  const total = questions.length;

  questionNumber.textContent = `${index + 1} / ${total}`;
  progressFill.style.width   = `${(index / total) * 100}%`;
  questionText.textContent   = q.text;

  optionsEl.innerHTML = '';
  q.options.forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.className = 'option' + (answers[index] === i ? ' selected' : '');
    btn.textContent = optText;
    btn.addEventListener('click', () => selectOption(i));
    optionsEl.appendChild(btn);
  });

  const hasAnswer = answers[index] !== null && answers[index] !== undefined;
  const isLast    = index === total - 1;

  backBtn.classList.toggle('hidden', index === 0);
  nextBtn.classList.toggle('hidden', !hasAnswer || isLast);
  submitBtn.classList.toggle('hidden', !hasAnswer || !isLast);
}

function selectOption(optionIndex) {
  answers[currentQuestion] = optionIndex;
  document.querySelectorAll('.option').forEach((btn, i) => {
    btn.classList.toggle('selected', i === optionIndex);
  });
  const isLast = currentQuestion === questions.length - 1;
  nextBtn.classList.toggle('hidden', isLast);
  submitBtn.classList.toggle('hidden', !isLast);
}

async function transitionToQuestion(index) {
  quizContainer.classList.add('transitioning');
  await sleep(220);
  showQuestion(index);
  quizContainer.classList.remove('transitioning');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function showOnboarding() {
  landing.classList.add('hidden');
  onboardingSection.classList.remove('hidden');
  userAge = 25;
  ageSlider.value       = 25;
  ageSliderValue.textContent = '25';
}

ageSlider.addEventListener('input', () => {
  userAge = parseInt(ageSlider.value, 10);
  ageSliderValue.textContent = userAge;
});

obContinueBtn.addEventListener('click', startQuiz);

function startQuiz() {
  onboardingSection.classList.add('hidden');
  quizSection.classList.remove('hidden');
  answers = Array(questions.length).fill(null);
  currentQuestion = 0;
  showQuestion(0);
}

// ── Events ────────────────────────────────────────────────────────────────────
startBtn.addEventListener('click', async () => {
  if (!questions.length) {
    startBtn.textContent = 'loading...';
    try {
      const res = await fetch('/api/questions');
      questions = await res.json();
    } catch (e) {
      startBtn.textContent = 'start quiz';
      console.error('Failed to load questions:', e);
      return;
    }
    startBtn.textContent = 'start quiz';
  }
  showOnboarding();
});

backBtn.addEventListener('click', () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    transitionToQuestion(currentQuestion);
  }
});

nextBtn.addEventListener('click', () => {
  if (answers[currentQuestion] !== null && currentQuestion < questions.length - 1) {
    currentQuestion++;
    transitionToQuestion(currentQuestion);
  }
});

submitBtn.addEventListener('click', submitQuiz);
restartBtn.addEventListener('click', goHome);

shareBtn.addEventListener('click', async () => {
  if (!lastResults) return;
  shareBtn.textContent = 'generating...';
  shareBtn.disabled = true;
  try {
    const blob = await generateResultsImage(lastResults);
    const file = new File([blob], 'my-prescription.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Movie Prescription' });
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my-prescription.png'; a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.error('Share failed:', e);
  } finally {
    shareBtn.textContent = 'share results';
    shareBtn.disabled = false;
  }
});

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    // Route TMDB images through our proxy so canvas can draw them (no CORS taint)
    img.src = src.includes('image.tmdb.org')
      ? `/api/poster?url=${encodeURIComponent(src)}`
      : src;
  });
}

async function generateResultsImage({ recommendations }) {
  const DPR       = 2;
  const W         = 700;
  const PAD       = 44;
  const POSTER_W  = 90;
  const POSTER_H  = 135;
  const CARD_H    = POSTER_H + 10; // a little breathing room top/bottom
  const GAP       = 12;
  const CARD_PAD  = 14;
  const cardsTop  = 186;
  const H         = cardsTop + (CARD_H + GAP) * recommendations.length + 72;

  // Pre-load all posters in parallel
  const posters = await Promise.all(
    recommendations.map(r => r.poster ? loadImage(r.poster) : Promise.resolve(null))
  );

  const canvas = document.createElement('canvas');
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // Background
  const bg = ctx.createRadialGradient(W / 2, H * 0.28, 0, W / 2, H * 0.28, W * 0.95);
  bg.addColorStop(0, '#0d2238');
  bg.addColorStop(1, '#050e1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Logo
  ctx.fillStyle = '#f7d44c';
  ctx.font = `700 13px 'Playfair Display', serif`;
  ctx.fillText('The movie you NEED.', PAD, 44);

  // Title
  ctx.fillStyle = '#00e5a0';
  ctx.font = `700 32px 'Playfair Display', serif`;
  ctx.fillText('YOUR PRESCRIPTION:', PAD, 126);

  // Cards
  for (let i = 0; i < recommendations.length; i++) {
    const rec    = recommendations[i];
    const cat    = CATEGORIES[rec.category] || {};
    const y      = cardsTop + i * (CARD_H + GAP);
    const cardW  = W - PAD * 2;
    const poster = posters[i];

    // Card bg
    ctx.fillStyle = '#0b1d31';
    roundRect(ctx, PAD, y, cardW, CARD_H, 10);
    ctx.fill();

    // Left colour bar
    ctx.fillStyle = cat.color || '#ffffff';
    roundRect(ctx, PAD, y, 4, CARD_H, [10, 0, 0, 10]);
    ctx.fill();

    // Poster
    const posterX = PAD + 16;
    const posterY = y + (CARD_H - POSTER_H) / 2;
    if (poster) {
      ctx.save();
      roundRect(ctx, posterX, posterY, POSTER_W, POSTER_H, 6);
      ctx.clip();
      ctx.drawImage(poster, posterX, posterY, POSTER_W, POSTER_H);
      ctx.restore();
    } else {
      ctx.fillStyle = '#102540';
      roundRect(ctx, posterX, posterY, POSTER_W, POSTER_H, 6);
      ctx.fill();
    }

    // Text area starts after poster
    const tx = posterX + POSTER_W + 16;
    const tw = cardW - (tx - PAD) - CARD_PAD;

    // Category label
    ctx.fillStyle = cat.color || '#ffffff';
    ctx.font = `600 10px 'DM Sans', sans-serif`;
    ctx.fillText((cat.label || rec.category).toUpperCase(), tx, y + 22);

    // Title
    ctx.fillStyle = '#eef6fc';
    ctx.font = `700 16px 'Playfair Display', serif`;
    wrapText(ctx, `${rec.title} (${rec.year})`, tx, y + 44, tw, 20, 2);

    // Director
    ctx.fillStyle = '#5a7a95';
    ctx.font = `300 11px 'DM Sans', sans-serif`;
    ctx.fillText(`dir. ${rec.director || ''}`, tx, y + 74);

    // Synopsis
    ctx.fillStyle = '#8aa8be';
    ctx.font = `300 11px 'DM Sans', sans-serif`;
    wrapText(ctx, rec.synopsis || '', tx, y + 94, tw, 16, 2);

    // Why line
    ctx.fillStyle = '#4a7060';
    ctx.font = `italic 11px 'DM Sans', sans-serif`;
    wrapText(ctx, rec.why_this_film || '', tx, y + 130, tw, 15, 1);
  }

  // Footer
  ctx.fillStyle = '#304f68';
  ctx.font = `300 11px 'DM Sans', sans-serif`;
  ctx.fillText('notthemovie.you/want', PAD, H - 26);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
  ctx.lineTo(x + r[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.quadraticCurveTo(x, y, x + r[0], y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  if (!text) return;
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
      if (++lines >= maxLines) { ctx.fillText(line + '…', x, y); return; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

revealBtn.addEventListener('click', () => {
  const nowHidden = profileReveal.classList.toggle('hidden');
  revealBtn.textContent = nowHidden ? 'what does this say about you?' : 'close';
});

logoWrap.addEventListener('click', () => {
  if (logoWrap.classList.contains('shrunk')) goHome();
});

function goHome() {
  quizSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  onboardingSection.classList.add('hidden');
  answers = Array(questions.length || 10).fill(null);
  currentQuestion = 0;
  userAge = 25;
  profileReveal.classList.add('hidden');
  ourChoiceEl.classList.add('hidden');
  revealBtn.textContent = 'what does this say about you?';
  landing.classList.remove('hidden');
}

// ── Submission ────────────────────────────────────────────────────────────────
async function submitQuiz() {
  quizSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');

  const loadingMessages = [
    'analyzing your psychological profile',
    'consulting the film archives',
    'matching narrative arcs to your needs',
    'curating your prescription',
    'almost there...',
  ];
  let msgIdx = 0;
  const msgInterval = setInterval(async () => {
    msgIdx = (msgIdx + 1) % loadingMessages.length;
    loadingSub.style.opacity = '0';
    await sleep(300);
    loadingSub.textContent = loadingMessages[msgIdx];
    loadingSub.style.opacity = '1';
  }, 3200);

  try {
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, age: userAge }),
    });

    const data = await res.json();
    clearInterval(msgInterval);

    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    renderResults(data);
  } catch (err) {
    clearInterval(msgInterval);
    loadingSection.classList.add('hidden');
    quizSection.classList.remove('hidden');

    const errorBox = document.createElement('div');
    errorBox.style.cssText = `
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      background: #1a0a0a; border: 1px solid #8b3030; color: #e88;
      padding: 1rem 1.5rem; border-radius: 5px; font-size: 0.9rem;
      max-width: 480px; text-align: center; z-index: 999;
    `;
    errorBox.textContent = err.message;
    document.body.appendChild(errorBox);
    setTimeout(() => errorBox.remove(), 6000);
  }
}

// ── Render Results ────────────────────────────────────────────────────────────
function renderResults({ profile, recommendations }) {
  lastResults = { profile, recommendations };
  loadingSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  profileReveal.classList.add('hidden');
  ourChoiceEl.classList.add('hidden');
  revealBtn.textContent = 'what does this say about you?';

  prescriptionState.textContent = `"${profile.psychological_state}"`;
  prescriptionNeed.textContent  = profile.core_need;

  recommendationsEl.innerHTML = '';

  if (!recommendations || recommendations.length === 0) {
    recommendationsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0">No recommendations found. Please try again.</p>';
    return;
  }

  // Sort by fit_percentage descending
  const sorted = [...recommendations].sort((a, b) => b.fit_percentage - a.fit_percentage);

  // ── Two-row + animated panel between them ──────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'rx-grid';

  const row0 = document.createElement('div');
  row0.className = 'rx-row';

  const expandedPanel = document.createElement('div');
  expandedPanel.className = 'rx-expanded-panel';

  const row1 = document.createElement('div');
  row1.className = 'rx-row';

  const cards = sorted.map(rec => createMovieCard(rec));
  cards.slice(0, 3).forEach(c => row0.appendChild(c));
  cards.slice(3, 6).forEach(c => row1.appendChild(c));

  grid.appendChild(row0);
  grid.appendChild(expandedPanel);
  grid.appendChild(row1);
  recommendationsEl.appendChild(grid);

  // ── Expansion state ──────────────────────────────────────────────────────
  let expandedIndex = null;
  let panelBusy     = false;

  // ── Connecting outline (visually links ghost card to expanded panel) ──────
  const connOutline = document.createElement('div');
  connOutline.className = 'rx-col-outline';
  grid.appendChild(connOutline);

  function showOutline(i, panelTargetH) {
    const catColor  = CATEGORIES[sorted[i].category]?.color || 'var(--text-dim)';
    const gridRect  = grid.getBoundingClientRect();
    const cardRect  = cards[i].getBoundingClientRect();
    const panelRect = expandedPanel.getBoundingClientRect();
    const totalH    = (panelRect.top - cardRect.top) + panelTargetH;

    connOutline.style.setProperty('--outline-color', catColor);
    connOutline.style.left   = (cardRect.left  - gridRect.left  - 4) + 'px';
    connOutline.style.top    = (cardRect.top   - gridRect.top   - 4) + 'px';
    connOutline.style.width  = (cardRect.width + 8) + 'px';
    connOutline.style.height = (totalH         + 8) + 'px';
    connOutline.classList.add('visible');
  }

  function hideOutline() {
    connOutline.classList.remove('visible');
  }

  // ── Scroll so ghost card + panel are vertically centred in viewport ───────
  function scrollToCenter(i, panelTargetH) {
    const cardRect  = cards[i].getBoundingClientRect();
    const panelRect = expandedPanel.getBoundingClientRect();
    const topAbs    = cardRect.top  + window.scrollY;
    const botAbs    = panelRect.top + window.scrollY + panelTargetH;
    const target    = topAbs + (botAbs - topAbs) / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  // ── Soft fade-out then height-collapse ────────────────────────────────────
  function collapseCardBody(card) {
    const body = card.querySelector('.card-body');
    if (!body) return;
    const h = body.offsetHeight;
    card.dataset.bodyH = h;

    // Step 1: fade content out softly
    body.style.transition = 'opacity 0.3s ease';
    body.style.opacity    = '0';

    // Step 2: after fade, collapse height (flex:none lets explicit height win)
    setTimeout(() => {
      body.style.flex       = 'none';
      body.style.overflow   = 'hidden';
      body.style.transition = 'none';
      body.style.height     = h + 'px';
      body.style.opacity    = '1'; // reset so it doesn't interfere with expand
      card.classList.add('card-selected');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        body.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        body.style.height     = '0px';
      }));
    }, 310);
  }

  // ── Height-expand then fade content back in ───────────────────────────────
  function expandCardBody(card) {
    const body   = card.querySelector('.card-body');
    if (!body) return;
    const target = parseInt(card.dataset.bodyH, 10) || 0;

    body.style.opacity    = '0';
    card.classList.remove('card-selected');
    body.style.transition = 'none';
    body.style.height     = '0px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      body.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      body.style.height     = target + 'px';
      // After expand, fade content back in
      setTimeout(() => {
        body.style.transition = 'opacity 0.3s ease';
        body.style.opacity    = '1';
        setTimeout(() => {
          body.style.flex       = '';
          body.style.height     = '';
          body.style.overflow   = '';
          body.style.transition = '';
          body.style.opacity    = '';
          delete card.dataset.bodyH;
        }, 320);
      }, 520);
    }));
  }

  function wireCloseBtn() {
    const btn = expandedPanel.querySelector('.ep-close-btn');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); closePanel(); });
  }

  function openPanel(i) {
    if (panelBusy) return;
    panelBusy = true;
    expandedIndex = i;
    collapseCardBody(cards[i]);

    expandedPanel.innerHTML = buildExpandedHTML(sorted[i]);
    wireCloseBtn();

    // Capture panel target height before animation starts
    expandedPanel.style.transition = 'none';
    expandedPanel.style.height     = '0px';
    expandedPanel.getBoundingClientRect();
    const panelTargetH = expandedPanel.scrollHeight;

    // Animate panel open (1.5s)
    expandedPanel.style.transition = 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
    expandedPanel.style.height     = panelTargetH + 'px';

    // Auto-scroll so the combined view is centred (let animation start first)
    setTimeout(() => scrollToCenter(i, panelTargetH), 150);

    // Show connecting outline once panel is mostly open
    setTimeout(() => showOutline(i, panelTargetH), 1200);

    setTimeout(() => {
      expandedPanel.style.height = 'auto';
      panelBusy = false;
    }, 1520);
  }

  function switchCard(i) {
    const prev = expandedIndex;
    expandedIndex = i;

    hideOutline();
    expandCardBody(cards[prev]);
    collapseCardBody(cards[i]);

    // Crossfade panel content
    const inner = expandedPanel.querySelector('.ep-inner');
    const updateContent = () => {
      expandedPanel.innerHTML = buildExpandedHTML(sorted[i]);
      wireCloseBtn();
      // Re-show outline for new card after content settles
      const panelTargetH = expandedPanel.scrollHeight;
      setTimeout(() => {
        scrollToCenter(i, panelTargetH);
        showOutline(i, panelTargetH);
      }, 400);
    };
    if (inner) {
      inner.style.opacity = '0';
      setTimeout(updateContent, 200);
    } else {
      updateContent();
    }
  }

  function closePanel() {
    if (panelBusy) return;
    panelBusy = true;
    const prev = expandedIndex;
    expandedIndex = null;

    hideOutline();
    if (prev !== null) expandCardBody(cards[prev]);

    // Freeze then animate panel to 0 (0.8s)
    const h = expandedPanel.scrollHeight;
    expandedPanel.style.transition = 'none';
    expandedPanel.style.height     = h + 'px';
    expandedPanel.getBoundingClientRect();
    expandedPanel.style.transition = 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    expandedPanel.style.height     = '0px';

    setTimeout(() => {
      expandedPanel.innerHTML    = '';
      expandedPanel.style.transition = '';
      panelBusy = false;
    }, 820);
  }

  cards.forEach((card, i) => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-tmdb-link')) return;
      if (i === expandedIndex) {
        closePanel();
      } else if (expandedIndex !== null) {
        switchCard(i);
      } else {
        openPanel(i);
      }
    });
  });

  // Staggered reveal
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('revealed'), i * 100);
  });

  // Our choice — highest fit_percentage
  const best = recommendations.reduce((a, b) => a.fit_percentage > b.fit_percentage ? a : b);
  const cat = CATEGORIES[best.category] || { shortName: best.category, color: 'var(--white)' };
  ourChoiceEl.innerHTML =
    `our choice this time is ` +
    `<span class="our-choice-cat" style="color:${cat.color}">${cat.shortName.toUpperCase()}</span>`;
  ourChoiceEl.classList.remove('hidden');

  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

// ── Build expanded panel HTML ─────────────────────────────────────────────────
function buildExpandedHTML(rec) {
  const cat = CATEGORIES[rec.category] || {};
  const actorsLine = (rec.actors || []).join(' · ');
  const crewLine = [
    rec.director ? `<span class="crew-dir">dir.</span> ${escapeHtml(rec.director)}` : '',
    actorsLine   ? escapeHtml(actorsLine) : '',
  ].filter(Boolean).join('<span class="crew-sep"> · </span>');

  const runtimeText = rec.runtime ? `${rec.runtime} min` : '';
  const tmdbUrl     = `https://www.themoviedb.org/movie/${rec.tmdb_id}`;

  const posterHTML = rec.poster
    ? `<img src="${rec.poster}" alt="${escapeHtml(rec.title)}" loading="lazy">`
    : `<div class="poster-placeholder">🎬</div>`;

  return `
    <div class="ep-inner" style="--cat-color:${cat.color || 'var(--bg3)'}">
      <div class="ep-band" style="background:${cat.color || 'var(--bg3)'}">
        <span class="ep-cat-name">${escapeHtml(cat.label || rec.category)}</span>
        <button class="ep-close-btn" aria-label="Close">×</button>
      </div>
      <div class="ep-body">
        <div class="ep-poster">${posterHTML}</div>
        <div class="ep-details">
          <div class="ep-title">${escapeHtml(rec.title)}<span class="ep-year"> (${rec.year})</span></div>
          <div class="ep-crew">${crewLine}</div>
          ${rec.why_this_film ? `<p class="ep-why">${escapeHtml(rec.why_this_film)}</p>` : ''}
          ${rec.synopsis      ? `<p class="ep-synopsis">${escapeHtml(rec.synopsis)}</p>` : ''}
          <div class="ep-meta">
            ${runtimeText  ? `<span class="ep-runtime">⏱ ${runtimeText}</span>` : ''}
            <span class="ep-fit">${rec.fit_percentage}% resonance</span>
            ${rec.tmdb_id  ? `<a class="ep-tmdb-link" href="${tmdbUrl}" target="_blank" rel="noopener">show more →</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Create collapsed card (thumbnail + category band) ─────────────────────────
function createMovieCard(movie) {
  const cat  = CATEGORIES[movie.category] || {};
  const card = document.createElement('div');
  card.className = 'rx-card';
  card.style.setProperty('--cat-color', cat.color || 'var(--bg3)');

  const posterHTML = movie.poster
    ? `<img src="${movie.poster}" alt="${escapeHtml(movie.title)}" loading="lazy">`
    : `<div class="poster-placeholder">🎬</div>`;

  const actorsLine = (movie.actors || []).join(' · ');
  const crewLine   = [
    movie.director ? `<span class="crew-dir">dir.</span> ${escapeHtml(movie.director)}` : '',
    actorsLine     ? escapeHtml(actorsLine) : '',
  ].filter(Boolean).join('<span class="crew-sep"> · </span>');

  card.innerHTML = `
    <div class="card-band" style="background:${cat.color || 'var(--bg3)'}">
      <span class="card-band-label">${escapeHtml(cat.label || movie.category)}</span>
    </div>
    <div class="card-body">
      <div class="card-poster-wrap">${posterHTML}</div>
      <div class="card-content">
        <div class="card-title">${escapeHtml(movie.title)}<span class="card-year"> (${movie.year})</span></div>
        <div class="card-crew">${crewLine}</div>
        <span class="fit-badge">${movie.fit_percentage}% resonance</span>
      </div>
    </div>
  `;

  return card;
}

// ── Preview shortcut (dev only — visit ?preview) ──────────────────────────────
function showPreviewResults() {
  logoWrap.classList.add('shrunk');
  landing.classList.add('hidden');
  renderResults({
    profile: {
      psychological_state: 'contemplative restlessness with a hunger for narrative depth',
      core_need: 'You need a film that mirrors your inner search for meaning while offering escape from the mundane — something that challenges without exhausting.',
    },
    recommendations: [
      {
        category: 'popular', title: 'Inception', year: 2010,
        director: 'Christopher Nolan',
        actors: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page'],
        synopsis: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
        why_this_film: 'Your hunger for layered, cerebral narratives makes this architecture of dreams a perfect prescription.',
        fit_percentage: 94, runtime: 148, tmdb_id: 27205,
        poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
      },
      {
        category: 'indie', title: 'Eternal Sunshine of the Spotless Mind', year: 2004,
        director: 'Michel Gondry', actors: ['Jim Carrey', 'Kate Winslet'],
        synopsis: 'When their relationship turns sour, a couple undergoes a medical procedure to have each other erased from their memories.',
        why_this_film: 'A hidden gem that captures emotional truth in ways mainstream cinema rarely achieves.',
        fit_percentage: 88, runtime: 108, tmdb_id: 38,
        poster: 'https://image.tmdb.org/t/p/w500/5MwkWH9tYHv3mV9OiQ0ZhjR2411.jpg',
      },
      {
        category: 'animation', title: 'Spirited Away', year: 2001,
        director: 'Hayao Miyazaki', actors: ['Daveigh Chase', 'Suzanne Pleshette'],
        synopsis: 'A young girl wanders into a world ruled by gods, witches, and spirits, where humans are changed into beasts.',
        why_this_film: 'This animated masterpiece speaks to the part of you yearning for wonder and transformation.',
        fit_percentage: 85, runtime: 125, tmdb_id: 129,
        poster: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
      },
      {
        category: 'classic', title: 'Vertigo', year: 1958,
        director: 'Alfred Hitchcock', actors: ['James Stewart', 'Kim Novak'],
        synopsis: 'A retired detective becomes obsessed with a woman he has been hired to follow, drawn into a labyrinth of identity and desire.',
        why_this_film: 'A hall of fame classic resonating with your psychological depth and appetite for unresolved tension.',
        fit_percentage: 82, runtime: 128, tmdb_id: 426,
        poster: 'https://image.tmdb.org/t/p/w500/3DqDMZJzelNG2mGVvIQfsiL0LZB.jpg',
      },
      {
        category: 'world_cinema', title: 'Parasite', year: 2019,
        director: 'Bong Joon-ho', actors: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong'],
        synopsis: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.',
        why_this_film: "World cinema at its most precise — this film's social architecture speaks directly to your current worldview.",
        fit_percentage: 79, runtime: 132, tmdb_id: 496243,
        poster: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
      },
      {
        category: 'short', title: 'Lost in Translation', year: 2003,
        director: 'Sofia Coppola', actors: ['Bill Murray', 'Scarlett Johansson'],
        synopsis: 'A faded movie star and a neglected young woman form an unlikely bond after crossing paths in Tokyo.',
        why_this_film: 'At 102 minutes, this quiet film says more in its silences than most epics say in three hours.',
        fit_percentage: 76, runtime: 102, tmdb_id: 196,
        poster: 'https://image.tmdb.org/t/p/w500/sQBBgWEd0VPLUJjjDRCoCB0SKjf.jpg',
      },
    ],
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
