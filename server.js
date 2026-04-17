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

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Simple in-memory IP-based limiter — no extra dependencies needed.
const ipRequestMap = new Map();
const RATE_LIMIT_MAX    = 4;      // max quiz submissions per window per IP
const RATE_LIMIT_WINDOW = 60000;  // 60-second rolling window

function isRateLimited(ip) {
  const now   = Date.now();
  const entry = ipRequestMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    ipRequestMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

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
    text: "When you think about who you were a year ago, how do you feel?",
    options: [
      "Distant — I've changed so much I barely recognise that version of me",
      "Wistful — I miss something that was simpler or clearer then",
      "Proud — I can see real growth in myself",
      "Stuck — I feel like I haven't moved as much as I wanted to",
      "Uncertain — the comparison makes me uneasy"
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
    text: "What does your mind most feel like doing right now?",
    options: [
      "Getting lost in something — I want to stop thinking and just be absorbed",
      "Making sense of something — there's a thought I keep turning over",
      "Feeling something deeply — I'm in the mood to be moved",
      "Being surprised — I want something I didn't expect",
      "Resting inside a story — just settling somewhere and staying a while"
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
  // Q1: How do you feel about where you are in life right now?
  // lost/unmoored | quietly content | heavy | restless/eager | hopeful/building
  [{ meaning: 3, identity: 2 }, { comfort: 2, meaning: 1 }, { catharsis: 3 }, { growth: 2, escapism: 2 }, { hope: 3, meaning: 1 }],

  // Q2: When completely alone with your thoughts, what feeling shows up most?
  // loneliness | clarity/quiet | anxiety/spiral | numbness | peace
  [{ connection: 3 }, { meaning: 2, comfort: 1 }, { catharsis: 2, meaning: 1 }, { catharsis: 2, meaning: 2 }, { comfort: 2, connection: 1 }],

  // Q3: What's weighing on you most right now?
  // relationship | running out of time | something unsaid | choices | quiet heaviness
  [{ connection: 3, validation: 1 }, { meaning: 2, growth: 2 }, { catharsis: 3 }, { meaning: 2, validation: 1 }, { catharsis: 2, meaning: 1 }],

  // Q4: How well understood do you feel?
  // rarely | sometimes | not sure | often | deeply
  [{ validation: 3, identity: 2 }, { validation: 2, connection: 1 }, { identity: 2, catharsis: 1 }, { connection: 3 }, { connection: 3, comfort: 1 }],

  // Q5 (new): When you think about who you were a year ago, how do you feel?
  // distant/barely recognise | wistful/miss simpler | proud/real growth | stuck | uncertain/uneasy
  [{ identity: 3, growth: 1 }, { catharsis: 2, comfort: 2 }, { growth: 3, meaning: 1 }, { growth: 2, catharsis: 2 }, { identity: 2, meaning: 1 }],

  // Q6: What do you most wish you could do right now?
  // cry | disappear | have someone with me | make sense | start fresh
  [{ catharsis: 3 }, { escapism: 3 }, { connection: 3, validation: 1 }, { meaning: 3 }, { growth: 2, escapism: 2 }],

  // Q7: What does your mind most feel like doing right now?
  // getting lost | making sense | feeling deeply | being surprised | resting in a story
  [{ escapism: 3 }, { meaning: 3 }, { catharsis: 3 }, { growth: 2, meaning: 1 }, { comfort: 3 }],

  // Q8: How do you feel about the people closest to you?
  // grateful | distant | unseen | protective/hold back | curious
  [{ connection: 3, comfort: 1 }, { connection: 2, catharsis: 1 }, { validation: 3 }, { catharsis: 3, connection: 1 }, { connection: 2, growth: 1 }],

  // Q9: When you imagine the next year, what comes up first?
  // excitement | uncertainty | fear | hope | heaviness
  [{ hope: 3, growth: 1 }, { meaning: 3 }, { catharsis: 2, meaning: 1 }, { hope: 3 }, { catharsis: 2, growth: 2 }],

  // Q10: If you could receive one thing from the world right now?
  // truly seen | understand something | transported | release | connected
  [{ validation: 3, connection: 2 }, { meaning: 3 }, { escapism: 3 }, { catharsis: 3 }, { connection: 3 }],
];

// ── Children's Quiz (age < 12) ────────────────────────────────────────────────
const QUESTIONS_KIDS = [
  {
    text: "What kind of story sounds most exciting to you right now?",
    options: [
      "A big adventure with lots of action and brave heroes",
      "A funny story that makes me laugh out loud",
      "A story about friendship and sticking together no matter what",
      "A magical world full of wonders I've never imagined",
      "A mystery I get to help figure out along the way"
    ]
  },
  {
    text: "How are you feeling today?",
    options: [
      "Happy and full of energy — ready for anything",
      "A little sad or missing someone special",
      "Bored — I really need something exciting to happen",
      "Worried or nervous about something",
      "Cozy and calm — just want to relax and feel good"
    ]
  },
  {
    text: "What kind of hero do you like most in a story?",
    options: [
      "Someone super brave who never backs down from a challenge",
      "Someone hilarious who always finds a way to make everyone smile",
      "Someone kind and caring who protects the people they love",
      "Someone clever who solves every problem with their brain",
      "Someone ordinary who discovers they're more special than they knew"
    ]
  },
  {
    text: "What do you most want to feel when the movie ends?",
    options: [
      "Pumped up — like I could go on an adventure myself",
      "Happy and giggly from all the funny moments",
      "Warm inside — like everything is going to be okay",
      "Amazed — like I just saw something truly magical",
      "Like I made a new imaginary best friend"
    ]
  },
  {
    text: "If you could step into a movie world, which would you choose?",
    options: [
      "A world where animals can talk and become your best friends",
      "Outer space or a faraway planet full of alien wonders",
      "A magical kingdom with castles, dragons, and spells",
      "A secret world hidden inside our everyday one",
      "Anywhere — as long as my best friends come with me"
    ]
  },
  {
    text: "What's the best kind of ending to a story?",
    options: [
      "The hero defeats the villain and everyone is safe",
      "Everyone laughs, dances, and celebrates together",
      "Something surprising happens that I never saw coming",
      "The hero learns an important lesson about themselves",
      "Two characters become best friends forever"
    ]
  },
  {
    text: "Which of these sounds most like how you're feeling right now?",
    options: [
      "A little lonely — I'd love a story with a great friendship in it",
      "Restless — I want something thrilling and full of action",
      "I just want to feel safe and cozy — nothing too scary",
      "Curious — I want to discover or learn something new",
      "I want to go somewhere completely different in my imagination"
    ]
  },
  {
    text: "How do you feel about scary or tense moments in movies?",
    options: [
      "Bring them on — I love the thrill!",
      "A little suspense is okay, but nothing too scary",
      "I prefer zero scary stuff — keep it fun and happy",
      "Monsters and villains are fine if the good guys win in the end",
      "Spooky is okay as long as it's also kind of funny"
    ]
  },
  {
    text: "Which of these would you most want to see in a movie?",
    options: [
      "Dragons, unicorns, or other magical creatures",
      "Dogs, cats, or real animals doing human things",
      "Robots or friendly aliens from another world",
      "Tiny creatures with a giant secret world of their own",
      "I don't mind — the characters matter more than the creatures"
    ]
  },
  {
    text: "What matters most to you in a movie?",
    options: [
      "Exciting action and cool adventures",
      "Lots of laughs from start to finish",
      "Characters I really love and root for",
      "A world I wish I could actually live in",
      "A story that makes me feel something real in my heart"
    ]
  }
];

const SCORING_KIDS = [
  // Q1: story type — adventure | funny | friendship | magical | mystery
  [{ escapism: 3, growth: 1 }, { catharsis: 3 }, { connection: 3 }, { escapism: 3, meaning: 1 }, { meaning: 3 }],
  // Q2: feeling today — happy/energy | sad/missing | bored | worried | cozy
  [{ connection: 2, hope: 1 }, { catharsis: 3, connection: 1 }, { escapism: 3 }, { comfort: 3, catharsis: 1 }, { comfort: 3 }],
  // Q3: hero type — brave | funny | kind | clever | ordinary/special
  [{ escapism: 2, growth: 2 }, { catharsis: 3 }, { connection: 3, comfort: 1 }, { meaning: 3 }, { identity: 3, hope: 1 }],
  // Q4: want to feel at end — pumped | giggly | warm | amazed | new friend
  [{ escapism: 3, growth: 1 }, { catharsis: 3 }, { comfort: 3, hope: 1 }, { escapism: 3, meaning: 1 }, { connection: 3 }],
  // Q5: movie world — animals talk | space | kingdom | secret world | with friends
  [{ connection: 2, escapism: 2 }, { escapism: 3, meaning: 1 }, { escapism: 3 }, { escapism: 2, meaning: 2 }, { connection: 3, comfort: 1 }],
  // Q6: best ending — hero wins | celebrate | surprise | hero learns | best friends
  [{ escapism: 2, hope: 2 }, { connection: 3, catharsis: 1 }, { meaning: 3 }, { growth: 3, meaning: 1 }, { connection: 3 }],
  // Q7: feeling right now — lonely | restless | safe/cozy | curious | somewhere different
  [{ connection: 3, catharsis: 1 }, { escapism: 3, growth: 1 }, { comfort: 3 }, { meaning: 3 }, { escapism: 3 }],
  // Q8: scary moments — bring it | little ok | none | good wins | spooky-funny
  [{ escapism: 3, growth: 1 }, { escapism: 2, comfort: 1 }, { comfort: 3 }, { hope: 2, meaning: 1 }, { catharsis: 2, escapism: 1 }],
  // Q9: creatures — magical | animals | robots/aliens | tiny world | characters matter
  [{ escapism: 3, meaning: 1 }, { connection: 3 }, { escapism: 3 }, { escapism: 2, meaning: 2 }, { connection: 2, meaning: 2 }],
  // Q10: what matters most — action | laughs | characters | world | feel something
  [{ escapism: 3 }, { catharsis: 3 }, { connection: 3 }, { escapism: 2, meaning: 2 }, { catharsis: 2, meaning: 2 }],
];

function computeNeedScores(answers, isKid = false) {
  const scoring = isKid ? SCORING_KIDS : SCORING;
  const scores = {
    catharsis: 0, meaning: 0, connection: 0, validation: 0,
    escapism: 0,  comfort: 0, hope: 0,       growth: 0, identity: 0,
  };
  answers.forEach((answerIdx, qIdx) => {
    const map = scoring[qIdx]?.[answerIdx] || {};
    Object.entries(map).forEach(([need, val]) => { scores[need] += val; });
  });
  return scores;
}

function buildAnswerSummary(answers, isKid = false) {
  const qs = isKid ? QUESTIONS_KIDS : QUESTIONS;
  return answers.map((answerIdx, qIdx) => {
    const q = qs[qIdx];
    return `Q${qIdx + 1}: "${q.text}"\nAnswer: "${q.options[answerIdx]}"`;
  }).join('\n\n');
}

// ── Safe JSON parser with markdown-fence stripping ────────────────────────────
// Claude occasionally prepends/appends extra text or code fences.
// This tries two passes before giving up, preventing hard server crashes.
function safeParseJSON(text, label) {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch (_) {
    // Strip ```json ... ``` or ``` ... ``` fences and retry
    const stripped = t
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    try {
      return JSON.parse(stripped);
    } catch {
      throw new Error(`Claude returned invalid JSON for ${label}. Raw: ${t.slice(0, 300)}`);
    }
  }
}

// ── Claude retry wrapper ──────────────────────────────────────────────────────
// If Claude returns invalid JSON, safeParseJSON throws. This retries the entire
// API call (not just the parse) up to maxRetries times before giving up.
async function callWithRetry(fn, label, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries) throw e;
      console.warn(`[${label}] attempt ${attempt + 1} failed — ${e.message}. Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
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

// Genre 10751 = Family, 16 = Animation
// When kidMode=true every pool restricts to family/animation content
const KID_GENRE_FILTER = '&with_genres=10751|16';

async function fetchPopularPool(kidMode = false) {
  const extra = kidMode ? KID_GENRE_FILTER : '';
  const pages = randPages(3, 1, 8);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_count.desc&vote_average.gte=6.5&vote_count.gte=500${extra}&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 12);
}

async function fetchIndiePool(kidMode = false) {
  const extra = kidMode ? KID_GENRE_FILTER : '';
  const pages = randPages(4, 1, 20);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=30&vote_count.lte=500&vote_average.gte=7.0${extra}&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 12);
}

async function fetchAnimationPool(kidMode = false) {
  const genre = kidMode ? '10751|16' : '16';
  // Fetch global pool (may be anime-heavy) + explicitly non-Japanese pool, then mix.
  // This prevents the category from being dominated by Studio Ghibli / anime alone.
  const [globalPages, nonJaPages] = [randPages(3, 1, 7), randPages(2, 1, 7)];
  const [global, nonJa] = await Promise.all([
    Promise.all(globalPages.map(p =>
      tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=100&with_genres=${genre}&page=${p}`)
        .then(d => filterMovies(d.results)).catch(() => [])
    )).then(r => shuffle(r.flat())),
    Promise.all(nonJaPages.map(p =>
      tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=80&with_genres=${genre}&without_original_language=ja&page=${p}`)
        .then(d => filterMovies(d.results)).catch(() => [])
    )).then(r => shuffle(r.flat())),
  ]);
  // Blend: 9 from global (may include anime), 9 from non-Japanese, then re-shuffle
  return shuffle([...global.slice(0, 6), ...nonJa.slice(0, 6)]);
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

async function fetchClassicPool(kidMode = false) {
  if (kidMode) {
    // Classic family/animation films released before 1995, well-rated
    const pages = randPages(3, 1, 5);
    const results = await Promise.all(pages.map(p =>
      tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=100&with_genres=10751|16&primary_release_date.lte=1995-12-31&vote_average.gte=7.0&page=${p}`)
        .then(d => filterMovies(d.results)).catch(() => [])
    ));
    return shuffle(results.flat()).slice(0, 12);
  }
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

async function fetchShortPool(kidMode = false) {
  const extra = kidMode ? KID_GENRE_FILTER : '';
  const pages = randPages(3, 1, 12);
  const results = await Promise.all(pages.map(p =>
    tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=200&vote_average.gte=7.0&with_runtime.lte=99${extra}&page=${p}`)
      .then(d => filterMovies(d.results)).catch(() => [])
  ));
  return shuffle(results.flat()).slice(0, 12);
}

async function fetchWorldCinemaPool(kidMode = false) {
  const extra = kidMode ? KID_GENRE_FILTER : '';
  // Exclude animated films — they belong in the animation category, not world cinema.
  // This prevents anime from dominating this pool.
  const noAnim = '&without_genres=16';

  if (kidMode) {
    const langs = ['ja', 'fr', 'it', 'de', 'es', 'zh', 'ko', 'sv'];
    const results = await Promise.all(langs.map(lang => {
      const page = Math.floor(Math.random() * 6) + 1;
      return tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=80&vote_count.lte=25000&vote_average.gte=7.0&with_original_language=${lang}${extra}${noAnim}&page=${page}`)
        .then(d => filterMovies(d.results).slice(0, 4)).catch(() => []);
    }));
    return shuffle(results.flat());
  }

  // Balanced language groups: pick 2 European, 2 Asian, 1 Latin/Middle-Eastern each run
  // so no single region dominates the candidate pool.
  const european  = ['fr', 'it', 'de', 'sv', 'da', 'nl', 'pl', 'ro', 'cs', 'hu', 'ru'];
  const asian     = ['ja', 'ko', 'zh', 'hi', 'fa', 'tr'];
  const latinMid  = ['es', 'pt', 'ar'];
  const selected  = [
    ...shuffle([...european]).slice(0, 4),
    ...shuffle([...asian]).slice(0, 3),
    ...shuffle([...latinMid]).slice(0, 1),
  ];
  const results = await Promise.all(
    selected.map(lang => {
      const page = Math.floor(Math.random() * 6) + 1;
      return tmdbFetch(`/discover/movie?sort_by=vote_average.desc&vote_count.gte=80&vote_count.lte=25000&vote_average.gte=7.0&with_original_language=${lang}${noAnim}&page=${page}`)
        .then(d => filterMovies(d.results).slice(0, 3)).catch(() => []);
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

  return safeParseJSON(msg.content[0].text, 'psychological analysis');
}

async function rankByCategoryWithClaude(profile, pools, kidMode = false, originalRecs = null) {
  const fmt = (label, films) =>
    `--- ${label} ---\n` + (films.length
      ? films.map(m =>
          `ID:${m.id} | "${m.title}" (${m.release_date?.slice(0, 4) || '?'}) | ${(m.overview || '').slice(0, 180)}`
        ).join('\n')
      : '(no candidates available)');

  const candidateSection = [
    fmt('MAINSTREAM POOL — for "popular" category (the mainstream choice: high vote count, widely seen)', pools.popular),
    fmt('INDIE POOL — for "indie" category (art-house, lesser-known, lower vote count preferred)', pools.indie),
    fmt('ANIMATION POOL — for "animation" category (must be animated film)', pools.animation),
    fmt('CLASSIC POOL — for "classic" category (pre-1985, legendary all-time greats)', pools.classic),
    fmt('WORLD CINEMA POOL — for "world_cinema" category (non-English language only)', pools.world_cinema),
    fmt('SHORT FILM POOL — for "short" category (runtime ≤ 99 minutes)', pools.short),
  ].join('\n\n');

  const kidInstruction = kidMode
    ? '\nIMPORTANT: This viewer is under 12 years old. Every film you select MUST be appropriate for children — G or PG rated, no adult themes, violence, or language. Prioritise wonder, adventure, friendship, and family themes.\n'
    : '';

  // Shuffle constraint: runner-up picks must score lower than the originals
  let shuffleConstraint = '';
  if (originalRecs && originalRecs.length > 0) {
    const caps = {};
    for (const r of originalRecs) caps[r.category] = r.fit_percentage;
    const capLines = Object.entries(caps)
      .map(([cat, pct]) => `  - ${cat}: must be < ${pct}%`)
      .join('\n');
    const excludeIds = originalRecs.map(r => r.tmdb_id).join(', ');
    shuffleConstraint = `\nSHUFFLE CONSTRAINTS — this is a runner-up request. The user already saw their ideal picks. Rules:
1. Do NOT select any film with these TMDB IDs (already shown): ${excludeIds}
2. Assign fit_percentage STRICTLY LOWER than the original in each category:
${capLines}
These are second-choice films — their resonance scores must reflect that.\n`;
  }

  const prompt = `You are a film therapist and narrative psychologist. Your task is NARRATIVE MIRRORING: match each film's protagonist journey to this viewer's psychological need.${kidInstruction}${shuffleConstraint}

DEEP LOGIC:
- CATHARSIS → suppressed emotion finally surfaces; protagonist breaks or releases
- MEANING → purposelessness confronted; clarity earned through hard truth
- VALIDATION → protagonist dismissed or invisible, ultimately proven right about themselves
- CONNECTION → emotional isolation cracks; protagonist discovers they are not alone
- ESCAPISM → a world so complete the viewer can fully inhabit it
- COMFORT → safety sought; protagonist finds warmth, belonging, and home
- HOPE → despair confronted; protagonist discovers a reason to believe again
- GROWTH → stagnation broken; protagonist transforms through trial and challenge
- IDENTITY → self-confusion resolved; protagonist discovers who they truly are

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
- SHORT: choose the film with the best psychological fit that is ≤ 99 minutes runtime — NEVER pick a film over 99 minutes for this category
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

  return safeParseJSON(msg.content[0].text, 'film ranking');
}

// ── Main API Route ────────────────────────────────────────────────────────────

app.post('/api/quiz', async (req, res) => {
  try {
    // Rate limiting
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute before trying again.' });
    }

    const { answers, age } = req.body;
    if (!Array.isArray(answers) || answers.length !== 10) {
      return res.status(400).json({ error: 'Expected 10 quiz answers.' });
    }

    // Kid mode: age under 12 → age-appropriate content everywhere
    const kidMode = typeof age === 'number' && age < 12;
    if (kidMode) console.log('Kid mode active (age', age, ')');

    // 1. Compute need scores
    const needScores    = computeNeedScores(answers, kidMode);
    const topNeeds      = Object.entries(needScores).sort(([, a], [, b]) => b - a);
    const answerSummary = buildAnswerSummary(answers, kidMode);

    // 2. Claude Call 1: psychological analysis
    console.log('Claude Call 1: psychological analysis...');
    const profile = await callWithRetry(
      () => analyzeWithClaude(answerSummary, topNeeds, age),
      'Claude analysis'
    );
    profile.needScores = needScores;
    console.log('Profile:', JSON.stringify(profile, null, 2));

    // 3. Fetch category pools in parallel
    console.log('Fetching category pools...');
    const [popularPool, indiePool, animationPool, classicPool, worldPool, shortPool] = await Promise.all([
      fetchPopularPool(kidMode).catch(e => { console.error('popular pool failed:', e.message); return []; }),
      fetchIndiePool(kidMode).catch(e => { console.error('indie pool failed:', e.message); return []; }),
      fetchAnimationPool(kidMode).catch(e => { console.error('animation pool failed:', e.message); return []; }),
      fetchClassicPool(kidMode).catch(e => { console.error('classic pool failed:', e.message); return []; }),
      fetchWorldCinemaPool(kidMode).catch(e => { console.error('world pool failed:', e.message); return []; }),
      fetchShortPool(kidMode).catch(e => { console.error('short pool failed:', e.message); return []; }),
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
    const { recommendations } = await callWithRetry(
      () => rankByCategoryWithClaude(profile, pools, kidMode),
      'Claude ranking'
    );

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

// Returns a fresh poster URL for a given TMDB movie ID.
// Client calls this via onerror when a hardcoded/cached poster path 404s.
app.get('/api/poster-url', async (req, res) => {
  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const data = await tmdbFetch(`/movie/${id}`);
    const poster = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null;
    res.json({ poster });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Returns a YouTube trailer key for a given TMDB movie ID.
app.get('/api/trailer', async (req, res) => {
  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const data = await tmdbFetch(`/movie/${id}/videos`);
    const trailer = (data.results || [])
      .filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
      .sort((a, b) => (a.type === 'Trailer' && b.type !== 'Trailer' ? -1 : 1))[0];
    res.json({ key: trailer?.key || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve quiz questions
app.get('/api/questions', (req, res) => {
  const age = parseInt(req.query.age, 10);
  const isKid = !isNaN(age) && age < 12;
  const qs = isKid ? QUESTIONS_KIDS : QUESTIONS;
  res.json(qs.map(q => ({ text: q.text, options: q.options })));
});

// Shuffle: re-fetches TMDB pools and re-ranks using the existing psychological profile.
// Skips the first Claude analysis call — ~50% faster than a full quiz re-run.
app.post('/api/shuffle', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute before trying again.' });
    }

    const { profile, age, originalRecommendations } = req.body;
    if (!profile || !profile.psychological_state) {
      return res.status(400).json({ error: 'Valid profile required.' });
    }

    const kidMode = typeof age === 'number' && age < 12;

    // Fetch fresh pools
    console.log('Shuffle: fetching fresh pools...');
    const [popularPool, indiePool, animationPool, classicPool, worldPool, shortPool] = await Promise.all([
      fetchPopularPool(kidMode).catch(e => { console.error('popular pool failed:', e.message); return []; }),
      fetchIndiePool(kidMode).catch(e => { console.error('indie pool failed:', e.message); return []; }),
      fetchAnimationPool(kidMode).catch(e => { console.error('animation pool failed:', e.message); return []; }),
      fetchClassicPool(kidMode).catch(e => { console.error('classic pool failed:', e.message); return []; }),
      fetchWorldCinemaPool(kidMode).catch(e => { console.error('world pool failed:', e.message); return []; }),
      fetchShortPool(kidMode).catch(e => { console.error('short pool failed:', e.message); return []; }),
    ]);

    const pools = {
      popular: popularPool, indie: indiePool, animation: animationPool,
      classic: classicPool, world_cinema: worldPool, short: shortPool,
    };

    // Exclude original picks from candidate pools so Claude can't re-select them
    if (Array.isArray(originalRecommendations) && originalRecommendations.length > 0) {
      const originalIds = new Set(originalRecommendations.map(r => r.tmdb_id));
      for (const key of Object.keys(pools)) {
        pools[key] = pools[key].filter(m => !originalIds.has(m.id));
      }
    }

    const totalCandidates = Object.values(pools).reduce((s, p) => s + p.length, 0);
    if (totalCandidates < 5) throw new Error('Not enough movie candidates found. Please try again.');

    // Re-rank with same profile but fresh candidates and lower-score constraint
    console.log('Shuffle: Claude re-ranking...');
    const { recommendations } = await callWithRetry(
      () => rankByCategoryWithClaude(profile, pools, kidMode, originalRecommendations || null),
      'Claude shuffle ranking'
    );

    // Enrich
    const allMovies = [...popularPool, ...indiePool, ...animationPool, ...classicPool, ...worldPool, ...shortPool];
    const movieMap  = {};
    for (const m of allMovies) movieMap[m.id] = m;

    const enriched = await Promise.all(
      recommendations.slice(0, 6).map(async (rec) => {
        const movie = movieMap[rec.tmdb_id];
        if (!movie) { console.warn(`Shuffle: movie ${rec.tmdb_id} not in pool`); return null; }

        const [credits, details] = await Promise.all([
          getMovieCredits(movie.id).catch(() => ({ crew: [], cast: [] })),
          tmdbFetch(`/movie/${movie.id}`).catch(() => ({})),
        ]);
        const director = credits.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
        const actors   = (credits.cast || []).slice(0, 3).map(a => a.name);
        const runtime  = details.runtime || null;

        const overview = movie.overview || '';
        let synopsis = overview;
        if (overview.length > 350) {
          const sentenceMatch = overview.match(/^[\s\S]{100,350}?[.!?](?=\s|$)/);
          synopsis = sentenceMatch ? sentenceMatch[0] : overview.slice(0, overview.lastIndexOf(' ', 300) || 300) + '…';
        }

        return {
          tmdb_id: movie.id, category: rec.category, title: movie.title,
          year: movie.release_date?.slice(0, 4) || '',
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          director, actors, runtime, synopsis,
          why_this_film: rec.why_this_film, fit_percentage: rec.fit_percentage,
        };
      })
    );

    const finalRecs = enriched.filter(Boolean);
    console.log(`Shuffle: returning ${finalRecs.length} recommendations`);
    res.json({ profile, recommendations: finalRecs });

  } catch (err) {
    console.error('Error in /api/shuffle:', err);
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 Not the movie you want. The movie you need.`);
  console.log(`   Running at http://localhost:${PORT}\n`);
});
