// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = {
  popular:      { label: 'The Mainstream Choice',        shortName: 'mainstream',    color: '#f4a7b9' },
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

// Shuffle state
let originalResults  = null;
let shuffledResults  = null;
let showingShuffled  = false;
let shuffleUsed      = false;

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const mobileHeader      = document.getElementById('mobileHeader');
const logoWrap          = document.getElementById('logoWrap');
const logoLine1         = logoWrap.querySelector('.logo-line1');
const logoLine2         = logoWrap.querySelector('.logo-line2');
const landing           = document.getElementById('landing');
const tagline           = document.getElementById('tagline');
const startBtn          = document.getElementById('startBtn');
const restoreBtn        = document.getElementById('restoreBtn');
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
const revealBtn         = document.getElementById('revealBtn');
const profileReveal     = document.getElementById('profileReveal');
const restartBtn        = document.getElementById('restartBtn');
const shareBtn          = document.getElementById('shareBtn');
const shuffleBtn        = document.getElementById('shuffleBtn');

// ── Age Slider Fill ───────────────────────────────────────────────────────────
// Draws a yellow fill from 0→thumb on the track so the chosen age is visible.
function updateSliderFill(value) {
  const pct = (value / 100) * 100;
  ageSlider.style.background =
    `linear-gradient(to right, #f7d44c 0%, #f7d44c ${pct}%, #102540 ${pct}%, #102540 100%)`;
}

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

  // Initialise slider fill at default value (25)
  updateSliderFill(25);

  // Show "resume last prescription" button if a recent save exists (< 24h)
  try {
    const saved = localStorage.getItem('moviePrescription');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Date.now() - parsed.timestamp < 86400000) {
        restoreBtn.classList.remove('hidden');
      }
    }
  } catch (_) { /* ignore bad storage */ }

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

async function transitionToQuestion(index, direction = 'forward') {
  quizContainer.classList.add('transitioning');
  await sleep(220);
  showQuestion(index);
  quizContainer.classList.remove('transitioning');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Keyboard navigation ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;

  // Onboarding: ENTER triggers continue
  if (!onboardingSection.classList.contains('hidden')) {
    obContinueBtn.click();
    return;
  }

  // Quiz: ENTER advances to next question or submits on the last one
  if (!quizSection.classList.contains('hidden')) {
    if (!submitBtn.classList.contains('hidden')) {
      submitBtn.click();
    } else if (!nextBtn.classList.contains('hidden')) {
      nextBtn.click();
    }
  }
});

// ── Onboarding ────────────────────────────────────────────────────────────────
function showOnboarding() {
  landing.classList.add('hidden');
  onboardingSection.classList.remove('hidden');
  userAge = 25;
  ageSlider.value = 25;
  ageSliderValue.textContent = '25';
  updateSliderFill(25);
}

ageSlider.addEventListener('input', () => {
  userAge = parseInt(ageSlider.value, 10);
  ageSliderValue.textContent = userAge;
  updateSliderFill(userAge);
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

// Restore last prescription from localStorage
restoreBtn.addEventListener('click', () => {
  try {
    const saved = localStorage.getItem('moviePrescription');
    if (!saved) return;
    const { profile, recommendations } = JSON.parse(saved);
    logoWrap.classList.add('shrunk');
    landing.classList.add('hidden');
    renderResults({ profile, recommendations });
  } catch (_) {
    restoreBtn.classList.add('hidden');
  }
});

backBtn.addEventListener('click', () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    transitionToQuestion(currentQuestion, 'back');
  }
});

nextBtn.addEventListener('click', () => {
  if (answers[currentQuestion] !== null && currentQuestion < questions.length - 1) {
    currentQuestion++;
    transitionToQuestion(currentQuestion, 'forward');
  }
});

submitBtn.addEventListener('click', submitQuiz);

// ── Start over with two-click confirmation ────────────────────────────────────
let restartConfirming     = false;
let restartConfirmTimeout = null;

restartBtn.addEventListener('click', () => {
  if (restartConfirming) {
    clearTimeout(restartConfirmTimeout);
    restartConfirming = false;
    restartBtn.textContent = 'start over';
    restartBtn.classList.remove('confirming');
    goHome();
  } else {
    restartConfirming = true;
    restartBtn.textContent = 'are you sure?';
    restartBtn.classList.add('confirming');
    restartConfirmTimeout = setTimeout(() => {
      restartConfirming = false;
      restartBtn.textContent = 'start over';
      restartBtn.classList.remove('confirming');
    }, 3000);
  }
});

// ── Share button with success feedback ────────────────────────────────────────
shareBtn.addEventListener('click', async () => {
  if (!lastResults) return;
  shareBtn.textContent = 'generating...';
  shareBtn.disabled = true;
  try {
    const blob = await generateResultsImage(lastResults);
    const file = new File([blob], 'my-prescription.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Movie Prescription' });
      showShareSuccess('shared ✓');
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my-prescription.png'; a.click();
      URL.revokeObjectURL(url);
      showShareSuccess('saved ✓');
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Share failed:', e);
      shareBtn.textContent = 'share results';
    } else {
      shareBtn.textContent = 'share results';
    }
  } finally {
    shareBtn.disabled = false;
  }
});

function showShareSuccess(label) {
  shareBtn.textContent = label;
  shareBtn.classList.add('success');
  setTimeout(() => {
    shareBtn.textContent = 'share results';
    shareBtn.classList.remove('success');
  }, 2500);
}

// ── Shuffle picks ─────────────────────────────────────────────────────────────
shuffleBtn.addEventListener('click', async () => {
  // If shuffle was already used, toggle between original and shuffled
  if (shuffleUsed) {
    if (showingShuffled) {
      showingShuffled = false;
      shuffleBtn.textContent = 'see shuffled picks';
      renderResults(originalResults, true);
    } else {
      showingShuffled = true;
      shuffleBtn.textContent = 'see original picks';
      renderResults(shuffledResults, true);
    }
    return;
  }

  // First shuffle: fetch fresh recommendations with the same answers
  shuffleBtn.textContent = 'shuffling...';
  shuffleBtn.disabled = true;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 120000);
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, age: userAge }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Shuffle failed.');

    originalResults  = { ...lastResults };
    shuffledResults  = data;
    shuffleUsed      = true;
    showingShuffled  = true;

    renderResults(shuffledResults, true);
    shuffleBtn.textContent = 'see original picks';
    shuffleBtn.disabled    = false;
  } catch (e) {
    console.error('Shuffle failed:', e);
    shuffleBtn.textContent = 'shuffle picks';
    shuffleBtn.disabled = false;

    const msg = e.name === 'AbortError' ? 'Request timed out.' : (e.message || 'Shuffle failed.');
    showToast(msg);
  }
});

// ── Image export helpers ──────────────────────────────────────────────────────
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
  // Sort by fit percentage descending so the poster reflects the ranked order
  const recs = [...recommendations].sort((a, b) => b.fit_percentage - a.fit_percentage);

  const DPR       = 2;
  const W         = 700;
  const PAD       = 44;
  const POSTER_W  = 90;
  const POSTER_H  = 135;
  const CARD_H    = POSTER_H + 10;
  const GAP       = 12;
  const CARD_PAD  = 14;
  const cardsTop  = 186;
  const H         = cardsTop + (CARD_H + GAP) * recs.length + 72;

  // Pre-load all posters in parallel
  const posters = await Promise.all(
    recs.map(r => r.poster ? loadImage(r.poster) : Promise.resolve(null))
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
  for (let i = 0; i < recs.length; i++) {
    const rec    = recs[i];
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

    // Category label (left) + fit percentage (right-aligned)
    ctx.fillStyle = cat.color || '#ffffff';
    ctx.font = `600 10px 'DM Sans', sans-serif`;
    ctx.fillText((cat.label || rec.category).toUpperCase(), tx, y + 22);

    // Percentage badge — right-aligned in the header area
    const pctText = `${rec.fit_percentage}%`;
    ctx.font = `700 12px 'DM Sans', sans-serif`;
    const pctW = ctx.measureText(pctText).width;
    ctx.fillText(pctText, tx + tw - pctW, y + 22);

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
  if (!nowHidden) {
    setTimeout(() => {
      void profileReveal.offsetHeight; // force reflow so scrollHeight is current
      const pageBottom = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.scrollTo({ top: pageBottom, behavior: 'smooth' });
    }, 200);
  }
});

logoWrap.addEventListener('click', () => {
  if (logoWrap.classList.contains('shrunk')) goHome();
});

function goHome() {
  quizSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  mobileHeader.classList.add('hidden');
  onboardingSection.classList.add('hidden');
  answers = Array(questions.length || 10).fill(null);
  currentQuestion = 0;
  userAge = 25;
  profileReveal.classList.add('hidden');
  revealBtn.textContent = 'what does this say about you?';

  // Reset shuffle state
  originalResults = null;
  shuffledResults = null;
  showingShuffled = false;
  shuffleUsed     = false;
  shuffleBtn.textContent = 'shuffle picks';
  shuffleBtn.disabled    = false;
  shuffleBtn.classList.add('hidden');

  // Reset restart button
  restartConfirming = false;
  clearTimeout(restartConfirmTimeout);
  restartBtn.textContent = 'start over';
  restartBtn.classList.remove('confirming');

  // Reset results title
  const pageTitle = resultsSection.querySelector('.rx-page-title');
  if (pageTitle) pageTitle.classList.remove('visible');

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

  // Show a "taking longer than usual" message after 55s
  const slowTimeout = setTimeout(async () => {
    loadingSub.style.opacity = '0';
    await sleep(300);
    loadingSub.textContent = 'this is taking a bit longer than usual...';
    loadingSub.style.opacity = '1';
  }, 55000);

  // Hard abort at 2 minutes
  const controller = new AbortController();
  const hardTimeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, age: userAge }),
      signal: controller.signal,
    });

    clearTimeout(hardTimeout);
    clearTimeout(slowTimeout);
    clearInterval(msgInterval);

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    renderResults(data);
  } catch (err) {
    clearTimeout(hardTimeout);
    clearTimeout(slowTimeout);
    clearInterval(msgInterval);
    loadingSection.classList.add('hidden');
    quizSection.classList.remove('hidden');

    const msg = err.name === 'AbortError'
      ? 'The request timed out. Please try again.'
      : (err.message || 'Something went wrong. Please try again.');

    showToast(msg);
  }
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message) {
  const errorBox = document.createElement('div');
  errorBox.style.cssText = `
    position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
    background: #1a0a0a; border: 1px solid #8b3030; color: #e88;
    padding: 1rem 1.5rem; border-radius: 5px; font-size: 0.9rem;
    max-width: 480px; text-align: center; z-index: 999;
    font-family: 'DM Sans', sans-serif;
  `;
  errorBox.textContent = message;
  document.body.appendChild(errorBox);
  setTimeout(() => errorBox.remove(), 6000);
}

// ── Render Results ────────────────────────────────────────────────────────────
// isShuffle=true means we're toggling between saved states; skip reset of shuffle controls.
function renderResults({ profile, recommendations }, isShuffle = false) {
  lastResults = { profile, recommendations };

  // Save to localStorage for session restore
  try {
    localStorage.setItem('moviePrescription', JSON.stringify({
      profile, recommendations, timestamp: Date.now(),
    }));
  } catch (_) { /* storage full or unavailable */ }

  loadingSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  mobileHeader.classList.remove('hidden');

  profileReveal.classList.add('hidden');
  revealBtn.textContent = 'what does this say about you?';

  prescriptionState.textContent = `"${profile.psychological_state}"`;
  prescriptionNeed.textContent  = profile.core_need;

  recommendationsEl.innerHTML = '';

  if (!recommendations || recommendations.length === 0) {
    recommendationsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0">No recommendations found. Please try again.</p>';
    return;
  }

  // Results page title entrance animation
  const pageTitle = resultsSection.querySelector('.rx-page-title');
  if (pageTitle) {
    pageTitle.classList.remove('visible');
    requestAnimationFrame(() => requestAnimationFrame(() => pageTitle.classList.add('visible')));
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

  // ── SVG perimeter stroke: traces the union outline of ghost card + panel ────
  const strokeSvg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  strokeSvg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:4;opacity:0;';
  strokePath.setAttribute('fill', 'none');
  strokePath.setAttribute('stroke-width', '2');
  strokePath.setAttribute('stroke-linecap', 'round');
  strokePath.setAttribute('stroke-linejoin', 'round');
  strokeSvg.appendChild(strokePath);
  grid.appendChild(strokeSvg);

  function hideOutline() {
    strokeSvg.style.transition = 'opacity 0.3s ease';
    strokeSvg.style.opacity    = '0';
  }

  // ── Scroll so the expanded panel is vertically centred in the viewport ───────
  // Centers the panel (the main content), letting the ghost card sit above/below.
  // If the panel alone is taller than the viewport, pin its top with a margin.
  // Custom eased scroll — gives full control over duration and curve,
  // unlike browser smooth-scroll which is fast and linear-ish.
  function easedScrollTo(targetY, duration = 950) {
    const startY    = window.scrollY;
    const distance  = targetY - startY;
    if (Math.abs(distance) < 2) return;
    const startTime = performance.now();
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(progress));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Fade-out + collapse height simultaneously ─────────────────────────────
  function collapseCardBody(card) {
    const body = card.querySelector('.card-body');
    if (!body) return;
    const h = body.offsetHeight;
    body.style.overflow = 'hidden';
    body.style.height   = h + 'px';
    body.getBoundingClientRect();
    body.style.transition = 'opacity 0.35s ease, height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    body.style.opacity    = '0';
    body.style.height     = '0px';
    card.classList.add('card-selected');
  }

  // ── Restore: expand height then fade content back in ─────────────────────
  function expandCardBody(card) {
    const body = card.querySelector('.card-body');
    if (!body) return;
    card.classList.remove('card-selected');
    body.style.transition = '';
    body.style.height     = '';
    body.style.overflow   = '';
    body.style.opacity    = '0';
    requestAnimationFrame(() => {
      body.style.transition = 'opacity 0.35s ease';
      body.style.opacity    = '1';
    });
    setTimeout(() => {
      body.style.transition = '';
      body.style.opacity    = '';
    }, 380);
  }

  function wireCloseBtn() {
    const btn = expandedPanel.querySelector('.ep-close-btn');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); closePanel(); });

    // Watch trailer button
    const trailerBtn = expandedPanel.querySelector('.ep-trailer-btn');
    if (trailerBtn) {
      trailerBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const movieId = trailerBtn.dataset.movieId;
        const prev = trailerBtn.textContent;
        trailerBtn.textContent = 'loading...';
        trailerBtn.disabled = true;
        try {
          const res  = await fetch(`/api/trailer?id=${movieId}`);
          const data = await res.json();
          if (data.key) {
            window.open(`https://www.youtube.com/watch?v=${data.key}`, '_blank', 'noopener');
            trailerBtn.textContent = 'watch trailer';
          } else {
            trailerBtn.textContent = 'no trailer found';
            setTimeout(() => { trailerBtn.textContent = 'watch trailer'; trailerBtn.disabled = false; }, 2500);
            return;
          }
        } catch {
          trailerBtn.textContent = 'error';
          setTimeout(() => { trailerBtn.textContent = 'watch trailer'; trailerBtn.disabled = false; }, 2500);
          return;
        }
        trailerBtn.disabled = false;
      });
    }
  }

  function openPanel(i) {
    if (panelBusy) return;
    panelBusy = true;
    expandedIndex = i;

    collapseCardBody(cards[i]);

    expandedPanel.innerHTML = buildExpandedHTML(sorted[i]);
    wireCloseBtn();

    const epInner = expandedPanel.querySelector('.ep-inner');
    if (epInner) { epInner.style.opacity = '0'; epInner.style.transition = 'none'; }

    expandedPanel.style.transition = 'none';
    expandedPanel.style.height     = '0px';
    expandedPanel.getBoundingClientRect();
    const panelTargetH = expandedPanel.scrollHeight;

    const catColor = CATEGORIES[sorted[i].category]?.color || 'var(--text-dim)';

    if (i < 3) cards[i].classList.add('ghost-top');
    expandedPanel.style.borderRadius = i < 3 ? '0 0 10px 10px' : '';

    setTimeout(() => {
      const panelTopAbs   = expandedPanel.getBoundingClientRect().top + window.scrollY;
      const panelFinalMid = panelTopAbs + panelTargetH / 2;
      const scrollTarget  = panelTargetH >= window.innerHeight
        ? panelTopAbs - 24
        : panelFinalMid - window.innerHeight / 2;

      expandedPanel.style.willChange = 'height';
      expandedPanel.style.transition = `height 1.0s cubic-bezier(0.76, 0, 0.24, 1)`;
      expandedPanel.getBoundingClientRect();
      expandedPanel.style.height = panelTargetH + 'px';

      easedScrollTo(Math.max(0, scrollTarget));
    }, 380);

    setTimeout(() => {
      const gridRect  = grid.getBoundingClientRect();
      const cardRect2 = cards[i].getBoundingClientRect();
      const panelRect = expandedPanel.getBoundingClientRect();

      const gL = cardRect2.left   - gridRect.left;
      const gR = cardRect2.right  - gridRect.left;
      const gT = cardRect2.top    - gridRect.top;
      const gB = cardRect2.bottom - gridRect.top;
      const pL = 0, pR = gridRect.width;
      const pT = panelRect.top    - gridRect.top;
      const pB = panelRect.bottom - gridRect.top;

      const raw = i < 3
        ? [[gL,gT],[gR,gT],[gR,pT],[pR,pT],[pR,pB],[pL,pB],[pL,pT],[gL,pT]]
        : [[pL,pT],[pR,pT],[pR,pB],[gR,pB],[gR,gB],[gL,gB],[gL,pB],[pL,pB]];
      const pts = raw.filter((p, j, a) => j === 0 || p[0] !== a[j-1][0] || p[1] !== a[j-1][1]);

      strokePath.setAttribute('d', roundedPath(pts, 10));
      strokePath.setAttribute('stroke', catColor);
      strokePath.style.filter = `drop-shadow(0 0 6px ${catColor})`;
      strokeSvg.style.transition = 'none';
      strokeSvg.style.opacity    = '0';
      strokeSvg.getBoundingClientRect();
      strokeSvg.style.transition = 'opacity 0.45s ease';
      strokeSvg.style.opacity    = '0.8';
    }, 1530);

    setTimeout(() => {
      if (epInner) {
        epInner.style.transition = 'opacity 0.5s ease';
        epInner.style.opacity    = '1';
      }
    }, 1630);

    setTimeout(() => {
      expandedPanel.style.height     = 'auto';
      expandedPanel.style.willChange = '';
      panelBusy = false;
    }, 1850);
  }

  function closePanel(onDone) {
    if (panelBusy) { if (onDone) onDone(); return; }
    panelBusy = true;
    const prev = expandedIndex;
    expandedIndex = null;

    hideOutline();
    if (prev !== null) {
      expandCardBody(cards[prev]);
      cards[prev].classList.remove('ghost-top', 'ghost-bottom');
    }
    expandedPanel.style.borderRadius = '';

    const h = expandedPanel.scrollHeight;
    expandedPanel.style.transition  = 'none';
    expandedPanel.style.height      = h + 'px';
    expandedPanel.style.willChange  = 'height';
    expandedPanel.getBoundingClientRect();
    expandedPanel.style.transition  = 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    expandedPanel.style.height      = '0px';

    setTimeout(() => {
      expandedPanel.innerHTML        = '';
      expandedPanel.style.transition = '';
      expandedPanel.style.willChange = '';
      panelBusy = false;
      if (onDone) onDone();
    }, 820);
  }

  cards.forEach((card, i) => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-tmdb-link')) return;
      if (i === expandedIndex) {
        closePanel();
      } else if (expandedIndex !== null) {
        closePanel(() => openPanel(i));
      } else {
        openPanel(i);
      }
    });
  });

  // Staggered reveal
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('revealed'), i * 100);
  });

  // Set up shuffle button — only on first (non-shuffle) render
  if (!isShuffle) {
    shuffleUsed     = false;
    showingShuffled = false;
    shuffleBtn.textContent = 'shuffle picks';
    shuffleBtn.disabled    = false;
    shuffleBtn.classList.remove('hidden');
  }

  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

// ── Build expanded panel HTML ─────────────────────────────────────────────────
function buildExpandedHTML(rec) {
  const cat = CATEGORIES[rec.category] || {};
  const actorsFormatted = (rec.actors || []).join(', ');
  const crewLine = [
    rec.director     ? `<span class="crew-dir">dir.</span> ${escapeHtml(rec.director)}` : '',
    actorsFormatted  ? `<span class="crew-with">with:</span> ${escapeHtml(actorsFormatted)}` : '',
  ].filter(Boolean).join('<span class="crew-sep"> | </span>');

  const runtimeText = rec.runtime ? `${rec.runtime} min` : '';
  const tmdbUrl     = `https://www.themoviedb.org/movie/${rec.tmdb_id}`;

  const posterHTML = rec.poster
    ? `<img src="${rec.poster}" alt="${escapeHtml(rec.title)}" loading="lazy" data-tmdb-id="${rec.tmdb_id}" onerror="refreshPoster(this)">`
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
            ${rec.tmdb_id  ? `<button class="ep-trailer-btn" data-movie-id="${rec.tmdb_id}">watch trailer</button>` : ''}
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
    ? `<img src="${movie.poster}" alt="${escapeHtml(movie.title)}" loading="lazy" data-tmdb-id="${movie.tmdb_id}" onerror="refreshPoster(this)">`
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

// ── Rounded SVG path from polygon points ──────────────────────────────────────
// Replaces sharp corners with quadratic bezier curves of radius r
function roundedPath(pts, r) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1];
    const len1 = Math.hypot(dx1, dy1);
    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
    const len2 = Math.hypot(dx2, dy2);
    if (!len1 || !len2) {
      d += i ? ` L ${curr[0]} ${curr[1]}` : `M ${curr[0]} ${curr[1]}`;
      continue;
    }
    const ar = Math.min(r, len1 / 2, len2 / 2);
    const ax = curr[0] - (dx1 / len1) * ar, ay = curr[1] - (dy1 / len1) * ar;
    const bx = curr[0] + (dx2 / len2) * ar, by = curr[1] + (dy2 / len2) * ar;
    d += i
      ? ` L ${ax} ${ay} Q ${curr[0]} ${curr[1]} ${bx} ${by}`
      : `M ${ax} ${ay} Q ${curr[0]} ${curr[1]} ${bx} ${by}`;
  }
  return d + ' Z';
}

// Re-fetches a fresh poster URL from TMDB when the cached path returns a 404.
// Called via onerror on every <img> that has a data-tmdb-id attribute.
function refreshPoster(img) {
  const id = img.dataset.tmdbId;
  if (!id || img.dataset.refreshed) return;
  img.dataset.refreshed = 'true';
  fetch(`/api/poster-url?id=${id}`)
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d?.poster) {
        img.src = d.poster;
      } else {
        const ph = document.createElement('div');
        ph.className = 'poster-placeholder poster-blank';
        img.replaceWith(ph);
      }
    })
    .catch(() => {
      const ph = document.createElement('div');
      ph.className = 'poster-placeholder poster-blank';
      img.replaceWith(ph);
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
