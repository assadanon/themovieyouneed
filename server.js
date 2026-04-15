require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB = 'https://api.themoviedb.org/3';

// ── Quiz Data ─────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    text: "How do you feel when you think about where you are in life right now?",
    options: [
      "Lost and unmoored — like I've drifted from who I was meant to be",
      "Quietly content — things feel mostly okay",
      "Heavy — like I'm carrying something I can't put down",
      "Restless and eager — I want more than what I currently have",
      "Hopeful and building — I feel like I'm moving somewhere"
    ]
  },
  {
    text: "When you're completely alone with your thoughts, what feeling shows up most?",
    options: [
      "Loneliness — I miss having someone truly close",
      "Clarity — I actually enjoy the quiet",
      "Anxiety — my thoughts spiral and won't settle",
      "Numbness — I don't feel much at all",
      "Peace — I feel comfortable in my own company"
    ]
  },
  {
    text: "What's weighing on you most right now?",
    options: [
      "A relationship that isn't working the way I need it to",
      "The feeling that I'm running out of time for something important",
      "Something I need to say but haven't found the words for",
      "Whether the choices I've made are the right ones",
      "Nothing specific — just a quiet, persistent heaviness"
    ]
  },
  {
    text: "How well do you feel understood by the people around you?",
    options: [
      "Rarely — they see a version of me, not who I actually am",
      "Sometimes — a few people come close",
      "I'm not sure — I don't open up enough to really know",
      "Often — I have people who genuinely get me",
      "Deeply — I feel truly known"
    ]
  },
  {
    text: "Which of these best describes where you are emotionally right now?",
    options: [
      "Overwhelmed — feeling everything too intensely",
      "Quietly hopeful — things feel tender but manageable",
      "Numb — not feeling very much at all",
      "Restless — I want to feel something different",
      "Tender and close to the surface — easily moved"
    ]
  },
  {
    text: "What do you most wish you could do right now?",
    options: [
      "Cry — really let it all out, with no judgment",
      "Disappear for a while — be somewhere completely different",
      "Have someone sit with me and truly understand",
      "Finally make sense of what I've been feeling",
      "Start fresh — leave something behind and begin again"
    ]
  },
  {
    text: "When was the last time you felt genuinely at peace?",
    options: [
      "Recently — I carry a general sense of calm",
      "A while ago — I'm working my way back to it",
      "In brief moments — it comes and goes",
      "Not recently — something has been pulling at me",
      "I'm not sure — peace feels abstract to me right now"
    ]
  },
  {
    text: "How do you feel about the people closest to you?",
    options: [
      "Grateful — I feel genuinely loved and supported",
      "Distant — I love them, but something has disconnected",
      "Unseen — they care, but they don't quite get it",
      "Protective — I hold back so I don't burden them",
      "Curious — I want to go deeper but don't know how"
    ]
  },
  {
    text: "When you imagine the next year of your life, what comes up first?",
    options: [
      "Excitement — I have real things to build toward",
      "Uncertainty — I can't picture it clearly",
      "Fear — I'm worried about what might change or not change",
      "Hope — I believe something will shift",
      "Heaviness — something needs to change but I don't know how"
    ]
  },
  {
    text: "If you could receive one thing from the world right now, what would it be?",
    options: [
      "To feel truly seen and understood",
      "To understand something I've been confused about for too long",
      "To be transported — to feel completely elsewhere",
      "To release something I've been carrying",
      "To feel genuinely connected to someone"
    ]
  }
];

const SCORING = [
  [{ meaning: 3 }, { connection: 2, meaning: 1 }, { catharsis: 3 }, { escapism: 3 }, { meaning: 2, connection: 1 }],
  [{ connection: 3 }, { meaning: 2, escapism: 1 }, { catharsis: 2, meaning: 1 }, { meaning: 3 }, { connection: 2, escapism: 1 }],
  [{ connection: 3, validation: 1 }, { meaning: 3 }, { catharsis: 3 }, { meaning: 2, validation: 1 }, { catharsis: 2, meaning: 1 }],
  [{ validation: 3, connection: 1 }, { validation: 2 }, { catharsis: 2, meaning: 1 }, { connection: 3 }, { connection: 3, validation: 1 }],
  [{ catharsis: 3 }, { meaning: 2, connection: 1 }, { meaning: 2, catharsis: 2 }, { escapism: 3 }, { catharsis: 2, connection: 1 }],
  [{ catharsis: 3 }, { escapism: 3 }, { connection: 3, validation: 1 }, { meaning: 3 }, { escapism: 2, catharsis: 1 }],
  [{ connection: 2, meaning: 1 }, { meaning: 2, catharsis: 1 }, { meaning: 2 }, { catharsis: 3 }, { meaning: 3 }],
  [{ connection: 3 }, { connection: 2, catharsis: 1 }, { validation: 3 }, { catharsis: 3, connection: 1 }, { connection: 2, meaning: 1 }],
  [{ meaning: 2, escapism: 1 }, { meaning: 3 }, { catharsis: 2, meaning: 1 }, { meaning: 2, validation: 1 }, { catharsis: 2, escapism: 2 }],
  [{ validation: 3, connection: 2 }, { meaning: 3 }, { escapism: 3 }, { catharsis: 3 }, { connection: 3 }],
];

function computeNeedScores(answers) {
  const scores = { catharsis: 0, meaning: 0, connection: 0, validation: 0, escapism: 0 };
  answers.forEach((answerIdx, qIdx) => {
    const map = SCORING[qIdx]?.[answerIdx] || {};
    Object.entries(map).forEach(([need, val]) => { scores[need] += val; });
  });
  return scores;
}

function buildAnswerSummary(answers) {
  return answers.map((answerIdx, qIdx) => {
    const q = QUESTIONS[qIdx];
    return `Q${qIdx + 1}: "${q.text}"\nAnswer: "${q.options[answerIdx]}"`;
  }).join('\n\n');
}

// ── TMDB Helpers ──────────────────────────────────────────────────────────────

async function tmdbFetch(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${TMDB}${endpoint}${sep}api_key=${TMDB_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`);
  return res.json();
}

function filterMovies(results) {
  return (results || []).filter(m => m.poster_path && m.overview);
}

// Category-specific TMDB pools

// Pick N distinct random integers in [min, max]
function randPages(count, min, max) {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return pool.sort(() => Math.random() - 0.5).slice(0, count);
}

// Shuffle an array in place and return it
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

async function fetchPopularPool() {
  // Mainstream hits — randomise which pages we pull so the candidate set varies
  const pages = randPages(3, 1, 8);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_count.desc&vote_average.gte=6.5&vote_count.gte=1500&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 18);
}

async function fetchIndiePool() {
  // Hidden gems: genuinely obscure — tight vote_count ceiling enforces it
  // Wide page spread (1–20) prevents the same films appearing each run
  const pages = randPages(4, 1, 20);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=30&vote_count.lte=500&vote_average.gte=7.0&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 18);
}

async function fetchAnimationPool() {
  // Genre 16 = Animation — randomise pages for variety
  const pages = randPages(3, 1, 7);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=100&with_genres=16&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 18);
}

// ── Hall of Fame: 100 curated IDs from AFI Top 100 & Sight and Sound Greatest Films ──
const HALL_OF_FAME_IDS = [
  // ── AFI Top 100 (pre-1985) ──────────────────────────────────────────────────
  15,    // Citizen Kane (1941)
  238,   // The Godfather (1972)
  289,   // Casablanca (1942)
  1578,  // Raging Bull (1980)
  872,   // Singin' in the Rain (1952)
  770,   // Gone with the Wind (1939)
  947,   // Lawrence of Arabia (1962)
  426,   // Vertigo (1958)
  630,   // The Wizard of Oz (1939)
  901,   // City Lights (1931)
  3114,  // The Searchers (1956)
  11,    // Star Wars (1977)
  539,   // Psycho (1960)
  62,    // 2001: A Space Odyssey (1968)
  599,   // Sunset Blvd. (1950)
  37247, // The Graduate (1967)
  961,   // The General (1926)
  654,   // On the Waterfront (1954)
  1585,  // It's a Wonderful Life (1946)
  1422,  // Chinatown (1974)
  640,   // Some Like It Hot (1959)
  596,   // The Grapes of Wrath (1940)
  601,   // E.T. the Extra-Terrestrial (1982)
  595,   // To Kill a Mockingbird (1962)
  3083,  // Mr. Smith Goes to Washington (1939)
  288,   // High Noon (1952)
  705,   // All About Eve (1950)
  996,   // Double Indemnity (1944)
  28,    // Apocalypse Now (1979)
  963,   // The Maltese Falcon (1941)
  240,   // The Godfather Part II (1974)
  510,   // One Flew Over the Cuckoo's Nest (1975)
  703,   // Annie Hall (1977)
  826,   // The Bridge on the River Kwai (1957)
  935,   // Dr. Strangelove (1964)
  475,   // Bonnie and Clyde (1967)
  3116,  // Midnight Cowboy (1969)
  981,   // The Philadelphia Story (1940)
  3078,  // It Happened One Night (1934)
  702,   // A Streetcar Named Desire (1951)
  1625,  // Rear Window (1954)
  103,   // Taxi Driver (1976)
  11778, // The Deer Hunter (1978)
  213,   // North by Northwest (1959)
  578,   // Jaws (1975)
  1366,  // Rocky (1976)
  10774, // Network (1976)
  85,    // Raiders of the Lost Ark (1981)
  185,   // A Clockwork Orange (1971)
  642,   // Butch Cassidy and the Sundance Kid (1969)
  891,   // All the President's Men (1976)
  3082,  // Modern Times (1936)
  576,   // The Wild Bunch (1969)
  624,   // Easy Rider (1969)
  389,   // 12 Angry Men (1957)
  78,    // Blade Runner (1982)
  665,   // Ben-Hur (1959)
  1051,  // The French Connection (1971)
  25188, // The Last Picture Show (1971)
  3121,  // Nashville (1975)
  694,   // The Shining (1980)
  9576,  // Tootsie (1982)
  15764, // Sophie's Choice (1982)
  838,   // American Graffiti (1973)
  10784, // Cabaret (1972)
  3063,  // Duck Soup (1933)
  900,   // Bringing Up Baby (1938)
  // ── Sight & Sound Greatest Films (pre-1985, not duplicated above) ───────────
  18148, // Tokyo Story (1953)
  346,   // Seven Samurai (1954)
  548,   // Rashomon (1950)
  5156,  // Bicycle Thieves (1948)
  776,   // The Rules of the Game (1939)
  797,   // Persona (1966)
  614,   // Wild Strawberries (1957)
  895,   // Andrei Rublev (1966)
  1396,  // Mirror / Zerkalo (1975)
  1398,  // Stalker (1979)
  439,   // La Dolce Vita (1960)
  422,   // 8½ (1963)
  405,   // La Strada (1954)
  631,   // Sunrise: A Song of Two Humans (1927)
  780,   // The Passion of Joan of Arc (1928)
  44012, // Jeanne Dielman, 23 quai du Commerce (1975)
  43904, // L'Atalante (1934)
  20108, // Au Hasard Balthazar (1966)
  48035, // Ordet (1955)
  851,   // Brief Encounter (1945)
  3112,  // The Night of the Hunter (1955)
  17295, // The Battle of Algiers (1966)
  4495,  // The Spirit of the Beehive (1973)
  335,   // Once Upon a Time in the West (1968)
  5801,  // Pather Panchali (1955)
  20530, // Late Spring / Banshun (1949)
  832,   // M (1931)
  26317, // Man with a Movie Camera (1929)
  2748,  // Journey to Italy (1954)
  946,   // Letter from an Unknown Woman (1948)
  490,   // The Seventh Seal (1957)
  147,   // The 400 Blows (1959)
  269,   // Breathless / À bout de souffle (1960)
];

async function fetchClassicPool() {
  // Hall of Fame: randomly sample 20 of the 100 curated icons each run for variety
  const selectedIds = shuffle([...HALL_OF_FAME_IDS]).slice(0, 20);
  const results = await Promise.all(
    selectedIds.map(id =>
      tmdbFetch(`/movie/${id}`)
        .then(m => (m.poster_path && m.overview ? m : null))
        .catch(() => null)
    )
  );
  return results.filter(Boolean);
}

async function fetchShortPool() {
  // Films ≤ 110 minutes — compact, well-regarded
  const pages = randPages(3, 1, 12);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=500&vote_average.gte=7.0&with_runtime.lte=110&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 18);
}

async function fetchWorldCinemaPool() {
  // Non-English, non-mainstream — cap vote_count to exclude mega-hits (Parasite, Amelie etc.)
  // Wide page spread per language so different films surface each run
  const langs = ['fr', 'ja', 'ko', 'it', 'es', 'de', 'zh', 'fa', 'ru', 'da', 'tr', 'pt', 'ar', 'sv', 'hi', 'pl', 'nl', 'ro', 'cs', 'hu'];
  const selected = shuffle([...langs]).slice(0, 8);
  const results = await Promise.all(
    selected.map(lang => {
      const page = Math.floor(Math.random() * 6) + 1;
      return tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=80&vote_count.lte=25000&vote_average.gte=7.0&with_original_language=${lang}&page=${page}`)
        .then(d => filterMovies(d.results).slice(0, 4))
        .catch(() => []);
    })
  );
  return shuffle(results.flat());
}

async function getMovieCredits(id) {
  return tmdbFetch(`/movie/${id}/credits`);
}

// ── Claude Helpers ────────────────────────────────────────────────────────────

async function analyzeWithClaude(answerSummary, topNeeds, age) {
  const isChild = typeof age === 'number' && age < 12;
  const ageNote = isChild
    ? `\nIMPORTANT: This viewer is under 12 years old. All film recommendations must be age-appropriate for children.`
    : '';

  const prompt = `You are a clinical psychologist specializing in narrative therapy and film as therapeutic tool.

A person has completed a psychological needs assessment. Based on their answers, write:
1. "psychological_state": one crisp sentence naming their dominant emotional/psychological condition right now — ALWAYS write in direct second person ("you are", "you feel", "you're") — NEVER use "they", "the individual", or third person
2. "core_need": one sentence identifying the single deepest unmet psychological need — ALWAYS write in direct second person ("you need", "your need") — NEVER use "they", "the individual", or third person
3. "film_prescription_note": one sentence describing (without naming a specific film) the TYPE of story they need — what themes, emotional arc, or narrative quality would serve this person's psychological needs.
4. "top_needs": array of 3 need labels (from: catharsis, connection, validation, meaning, escapism, comfort, identity, growth, hope, stimulation, safety, autonomy, joy, grief)
5. "search_queries": array of 3 SHORT movie search terms (1–2 words each) for a movie database keyword search. Simple emotional or thematic words like "grief", "redemption", "identity", "freedom", "loss". Must be brief.

Respond ONLY as JSON (no backticks, no preamble):
{"psychological_state":"...","core_need":"...","film_prescription_note":"...","top_needs":["...","...","..."],"search_queries":["...","...","..."]}

Their responses:
${answerSummary}

Dominant psychological signals detected: ${topNeeds.map(([k, v]) => `${k}(${v})`).join(', ')}${ageNote}`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(msg.content[0].text.trim());
}

async function rankByCategoryWithClaude(profile, pools) {
  const fmt = (label, films) =>
    `--- ${label} ---\n` + (films.length
      ? films.map(m =>
          `ID:${m.id} | "${m.title}" (${m.release_date?.slice(0, 4) || '?'}) | ${(m.overview || '').slice(0, 180)}`
        ).join('\n')
      : '(no candidates available)');

  const candidateSection = [
    fmt('MAINSTREAM POOL — for "popular" category (high vote count, widely seen)', pools.popular),
    fmt('INDIE POOL — for "indie" category (art-house, lesser-known, lower vote count preferred)', pools.indie),
    fmt('ANIMATION POOL — for "animation" category (must be animated film)', pools.animation),
    fmt('CLASSIC POOL — for "classic" category (pre-1985, legendary all-time greats)', pools.classic),
    fmt('WORLD CINEMA POOL — for "world_cinema" category (non-English language only)', pools.world_cinema),
    fmt('SHORT FILM POOL — for "short" category (runtime ≤ 110 minutes)', pools.short),
  ].join('\n\n');

  const prompt = `You are a film therapist and narrative psychologist. Your task is NARRATIVE MIRRORING: match each film's protagonist journey to this viewer's psychological need.

DEEP LOGIC:
- CATHARSIS → suppressed emotion finally surfaces; protagonist breaks or releases
- MEANING → purposelessness confronted; clarity earned through hard truth
- VALIDATION → protagonist dismissed or invisible, ultimately proven right about themselves
- CONNECTION → emotional isolation cracks; protagonist discovers they are not alone
- ESCAPISM → a world so complete the viewer can fully inhabit it

VIEWER PROFILE:
Psychological state: ${profile.psychological_state}
Core unmet need: ${profile.core_need}
Film prescription: ${profile.film_prescription_note}
Top needs: ${profile.top_needs.join(', ')}

Select exactly ONE film from each pool. Rules:
- INDIE: choose the least commercially known film that still serves the need — prefer hidden gems over accessible hits
- WORLD CINEMA: must be a non-English language film — no exceptions
- ANIMATION: must be an animated film — no exceptions
- CLASSIC: must be pre-1985; choose a genuinely legendary all-time great, not an obscure pick — these are icons everyone should see
- SHORT: choose the film with the best psychological fit that is ≤ 110 minutes runtime
- Do NOT repeat the same film across categories
- Foreign and non-English films are equally valid across all categories
- CRITICAL: Do NOT default to the most famous or obvious film in a pool. The pools are randomised — treat every candidate equally. Pick based purely on psychological fit, not cultural prominence. A lesser-known film that truly mirrors the viewer's need beats a famous one that only loosely fits.

${candidateSection}

For each film:
- "category": exactly one of: "popular", "indie", "animation", "classic", "world_cinema", "short"
- "tmdb_id": the numeric ID before the pipe
- "why_this_film": one sentence addressed to the viewer ("you"), naming the protagonist's journey and how it serves their specific need. Under 25 words.
- "fit_percentage": how well this film serves this person's psychological needs (honest — not every category will be a perfect fit). Range 62–97, no two identical.

Return ONLY JSON (no backticks):
{"recommendations":[{"category":"popular","tmdb_id":0,"why_this_film":"...","fit_percentage":0},{"category":"indie","tmdb_id":0,"why_this_film":"...","fit_percentage":0},{"category":"animation","tmdb_id":0,"why_this_film":"...","fit_percentage":0},{"category":"classic","tmdb_id":0,"why_this_film":"...","fit_percentage":0},{"category":"world_cinema","tmdb_id":0,"why_this_film":"...","fit_percentage":0},{"category":"short","tmdb_id":0,"why_this_film":"...","fit_percentage":0}]}`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(msg.content[0].text.trim());
}

// ── Main API Route ────────────────────────────────────────────────────────────

app.post('/api/quiz', async (req, res) => {
  try {
    const { answers, age } = req.body;
    if (!Array.isArray(answers) || answers.length !== 10) {
      return res.status(400).json({ error: 'Expected 10 quiz answers.' });
    }

    // 1. Compute need scores
    const needScores   = computeNeedScores(answers);
    const topNeeds     = Object.entries(needScores).sort(([, a], [, b]) => b - a);
    const answerSummary = buildAnswerSummary(answers);

    // 2. Claude Call 1: psychological analysis
    console.log('Claude Call 1: psychological analysis...');
    const profile = await analyzeWithClaude(answerSummary, topNeeds, age);
    profile.needScores = needScores;
    console.log('Profile:', JSON.stringify(profile, null, 2));

    // 3. Fetch category pools in parallel
    console.log('Fetching category pools...');
    const [popularPool, indiePool, animationPool, classicPool, worldPool, shortPool] = await Promise.all([
      fetchPopularPool().catch(e => { console.error('popular pool failed:', e.message); return []; }),
      fetchIndiePool().catch(e => { console.error('indie pool failed:', e.message); return []; }),
      fetchAnimationPool().catch(e => { console.error('animation pool failed:', e.message); return []; }),
      fetchClassicPool().catch(e => { console.error('classic pool failed:', e.message); return []; }),
      fetchWorldCinemaPool().catch(e => { console.error('world pool failed:', e.message); return []; }),
      fetchShortPool().catch(e => { console.error('short pool failed:', e.message); return []; }),
    ]);

    console.log(`Pool sizes — popular:${popularPool.length} indie:${indiePool.length} animation:${animationPool.length} classic:${classicPool.length} world:${worldPool.length} short:${shortPool.length}`);

    const pools = {
      popular:      popularPool,
      indie:        indiePool,
      animation:    animationPool,
      classic:      classicPool,
      world_cinema: worldPool,
      short:        shortPool,
    };

    const totalCandidates = Object.values(pools).reduce((s, p) => s + p.length, 0);
    if (totalCandidates < 5) {
      throw new Error('Not enough movie candidates found. Please try again.');
    }

    // 4. Claude Call 2: pick one per category
    console.log('Claude Call 2: ranking by category...');
    const { recommendations } = await rankByCategoryWithClaude(profile, pools);

    // 5. Enrich each recommendation with credits, runtime + synopsis
    const allMovies = [...popularPool, ...indiePool, ...animationPool, ...classicPool, ...worldPool, ...shortPool];
    const movieMap  = {};
    for (const m of allMovies) movieMap[m.id] = m;

    const enriched = await Promise.all(
      recommendations.slice(0, 6).map(async (rec) => {
        const movie = movieMap[rec.tmdb_id];
        if (!movie) {
          console.warn(`Movie ID ${rec.tmdb_id} not found in any pool`);
          return null;
        }

        // Fetch credits and full details (for runtime) in parallel
        const [credits, details] = await Promise.all([
          getMovieCredits(movie.id).catch(() => ({ crew: [], cast: [] })),
          tmdbFetch(`/movie/${movie.id}`).catch(() => ({})),
        ]);
        const director = credits.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
        const actors   = (credits.cast || []).slice(0, 3).map(a => a.name);
        const runtime  = details.runtime || null; // minutes

        const overview = movie.overview || '';
        let synopsis = overview;
        if (overview.length > 350) {
          // Prefer ending at a sentence boundary within 150–350 chars
          const sentenceMatch = overview.match(/^[\s\S]{100,350}?[.!?](?=\s|$)/);
          if (sentenceMatch) {
            synopsis = sentenceMatch[0];
          } else {
            const cut = overview.lastIndexOf(' ', 300);
            synopsis = (cut > 50 ? overview.slice(0, cut) : overview.slice(0, 300)) + '…';
          }
        }

        return {
          tmdb_id:      movie.id,
          category:     rec.category,
          title:        movie.title,
          year:         movie.release_date?.slice(0, 4) || '',
          poster:       movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          director,
          actors,
          runtime,
          synopsis,
          why_this_film:   rec.why_this_film,
          fit_percentage:  rec.fit_percentage,
        };
      })
    );

    const finalRecs = enriched.filter(Boolean);
    console.log(`Returning ${finalRecs.length} recommendations`);

    res.json({ profile, recommendations: finalRecs });

  } catch (err) {
    console.error('Error in /api/quiz:', err);
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

// Proxy TMDB poster images to avoid CORS issues when drawing to canvas
app.get('/api/poster', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://image.tmdb.org/')) {
    return res.status(400).send('Invalid URL');
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).send('Upstream error');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).send('Proxy error');
  }
});

// Serve quiz questions
app.get('/api/questions', (req, res) => {
  res.json(QUESTIONS.map(q => ({ text: q.text, options: q.options })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 Not the movie you want. The movie you need.`);
  console.log(`   Running at http://localhost:${PORT}\n`);
});
