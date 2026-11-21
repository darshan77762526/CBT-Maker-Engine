/**
 * Autonomous CBT HTML Exam Generator
 * Compiles questions and configuration into a standalone, interactive CBT examination file
 */

function generateCbtHtml(config) {
  const {
    title = 'Computer Based Test — National Testing Platform',
    subtitle = 'Official Computer Based Test (CBT) Environment',
    durationMinutes = 180,
    subjects = ['Physics', 'Chemistry', 'Mathematics'],
    markingScheme = { correct: 4, incorrect: -1, unattempted: 0 },
    questions = []
  } = config;

  const totalQuestions = questions.length;
  const maxMarks = totalQuestions * markingScheme.correct;
  const totalDurationSec = durationMinutes * 60;
  const storageKey = 'cbt_test_' + Math.random().toString(36).substring(2, 10);

  const questionsJson = JSON.stringify(questions);
  const subjectsJson = JSON.stringify(subjects);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    .nta-header { background: linear-gradient(90deg, #162d4c 0%, #1e3a5f 100%); }
    .pal-btn {
      width: 40px; height: 36px; font-size: 13px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
      position: relative; cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease;
      user-select: none;
    }
    .pal-btn:hover { transform: translateY(-1px); }
    .pal-active { outline: 2.5px solid #0284c7; outline-offset: 2px; }
    .st-not_visited {
      background: #f1f5f9; color: #334155; border: 1.5px solid #94a3b8; border-radius: 6px;
    }
    .st-not_answered {
      background: #dc2626; color: #ffffff; border: 1.5px solid #b91c1c;
      border-radius: 6px 6px 14px 14px;
    }
    .st-answered {
      background: #16a34a; color: #ffffff; border: 1.5px solid #15803d;
      border-radius: 14px 14px 6px 6px;
    }
    .st-marked {
      background: #7c3aed; color: #ffffff; border: 1.5px solid #6d28d9;
      border-radius: 9999px;
    }
    .st-answered_marked {
      background: #7c3aed; color: #ffffff; border: 1.5px solid #6d28d9;
      border-radius: 9999px;
    }
    .st-answered_marked::after {
      content: ''; position: absolute; right: 1px; bottom: 1px;
      width: 11px; height: 11px; background: #22c55e;
      border: 2px solid #ffffff; border-radius: 9999px;
    }
    .opt-card {
      transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
    }
    .opt-card:hover { border-color: #0284c7; background-color: #f0f9ff; }
    .opt-card.selected {
      border-color: #0284c7; background-color: #e0f2fe;
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.18);
    }
    .keypad-btn {
      height: 44px; font-weight: 700; font-size: 16px;
      border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff;
      color: #0f172a; transition: background-color 0.1s ease, transform 0.08s ease;
    }
    .keypad-btn:hover { background: #f1f5f9; }
    .keypad-btn:active { transform: scale(0.96); background: #e2e8f0; }
    #btn-start-exam {
      cursor: pointer !important;
      transition: transform 0.1s ease, background-color 0.15s ease !important;
      touch-action: manipulation !important;
      background-color: #0284c7 !important;
      color: #ffffff !important;
    }
    #btn-start-exam:hover { background-color: #0369a1 !important; }
    #btn-start-exam:active { transform: scale(0.97) !important; background-color: #075985 !important; }
  </style>
</head>
<body class="bg-slate-100 text-slate-900 min-h-screen flex flex-col">

  <!-- 1. INSTRUCTIONS VIEW -->
  <div id="view-instructions" class="flex-1 flex flex-col">
    <header class="nta-header text-white px-4 sm:px-6 py-3.5 shadow-md">
      <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-amber-400 text-slate-900 font-extrabold text-sm flex items-center justify-center shadow">NTA</div>
          <div>
            <h1 class="text-base sm:text-lg font-bold tracking-tight">${title}</h1>
            <p class="text-xs text-slate-200">${subtitle}</p>
          </div>
        </div>
        <div class="text-xs bg-white/10 border border-white/20 rounded-md px-3 py-1.5 font-medium">
          Official Examination Portal &bull; Auto-Grading Engine
        </div>
      </div>
    </header>

    <main class="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-bold text-slate-800">General Instructions — Please Read Carefully</h2>
          <span class="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">${totalQuestions} Questions &bull; ${maxMarks} Marks &bull; ${durationMinutes} Minutes</span>
        </div>

        <div class="p-5 sm:p-6 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <div class="text-xs font-semibold text-slate-500 uppercase">Subjects</div>
              <div class="font-bold text-slate-900 mt-1">${subjects.join(', ')}</div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <div class="text-xs font-semibold text-slate-500 uppercase">Marking Scheme</div>
              <div class="font-bold text-emerald-600 mt-1">+${markingScheme.correct} Correct <span class="text-slate-400 font-normal">|</span> <span class="text-red-500">${markingScheme.incorrect} Incorrect</span></div>
              <div class="text-[11px] text-slate-500 mt-0.5">0 for unattempted questions</div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <div class="text-xs font-semibold text-slate-500 uppercase">Auto-Grading</div>
              <div class="font-bold text-slate-900 mt-1">Official Final Key</div>
              <div class="text-[11px] text-slate-500 mt-0.5">Instant scorecard & detailed review</div>
            </div>
          </div>

          <ol class="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-700">
            <li>Total duration of the examination is <strong>${durationMinutes} minutes</strong>. The countdown timer in the top bar will automatically submit when it reaches zero.</li>
            <li>All questions are compulsory according to examination guidelines.</li>
            <li>For MCQs, choose exactly one option. For Numerical questions, enter the integer or decimal value using the virtual keypad.</li>
            <li>The Question Palette on the right displays real-time status of each question using official testing badges:</li>
          </ol>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div class="flex items-center gap-2.5 p-2 rounded bg-slate-50 border border-slate-200"><span class="pal-btn st-not_visited !w-7 !h-6 !text-[11px]">1</span><span>You have not visited the question yet.</span></div>
            <div class="flex items-center gap-2.5 p-2 rounded bg-slate-50 border border-slate-200"><span class="pal-btn st-not_answered !w-7 !h-6 !text-[11px]">2</span><span>You have not answered the question.</span></div>
            <div class="flex items-center gap-2.5 p-2 rounded bg-slate-50 border border-slate-200"><span class="pal-btn st-answered !w-7 !h-6 !text-[11px]">3</span><span>You have answered the question.</span></div>
            <div class="flex items-center gap-2.5 p-2 rounded bg-slate-50 border border-slate-200"><span class="pal-btn st-marked !w-7 !h-6 !text-[11px]">4</span><span>Marked for Review (not answered).</span></div>
            <div class="flex items-center gap-2.5 p-2 rounded bg-slate-50 border border-slate-200 sm:col-span-2"><span class="pal-btn st-answered_marked !w-7 !h-6 !text-[11px]">5</span><span>Answered &amp; Marked for Review (WILL be evaluated).</span></div>
          </div>

          <div class="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label class="flex items-start gap-2.5 cursor-pointer select-none">
              <input id="chk-declare" type="checkbox" class="mt-1 w-4 h-4 accent-sky-600 rounded" checked />
              <span class="text-xs sm:text-sm text-slate-700">I have read and understood all instructions. I am ready to begin the CBT examination.</span>
            </label>
            <button id="btn-start-exam" type="button" class="px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-sm transition shrink-0 cursor-pointer">
              Proceed to Exam &rarr;
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- 2. ACTIVE CBT EXAM VIEW -->
  <div id="view-exam" class="hidden flex-1 flex flex-col min-h-screen">
    <header class="nta-header text-white px-4 py-2.5 shadow-md flex items-center justify-between sticky top-0 z-20">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded bg-amber-400 text-slate-900 font-extrabold text-xs flex items-center justify-center">CBT</div>
        <div class="hidden sm:block">
          <div class="text-xs font-bold">${title}</div>
          <div class="text-[10px] text-slate-300">National Testing Examination Platform</div>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 bg-black/30 border border-white/20 rounded-lg px-3 py-1.5">
          <span class="text-[11px] text-slate-300 font-medium">Time Left:</span>
          <span id="timer-display" class="font-mono font-extrabold text-base text-amber-300">03:00:00</span>
        </div>
        <button id="btn-submit-exam-top" type="button" class="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition">Submit Test</button>
      </div>
    </header>

    <!-- Subject Switcher -->
    <div class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between overflow-x-auto">
      <div id="subject-tabs" class="flex items-center gap-1.5"></div>
      <div class="flex items-center gap-2 shrink-0 text-xs">
        <span class="text-slate-500 font-medium">Marking:</span>
        <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">+${markingScheme.correct}</span>
        <span class="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-bold">${markingScheme.incorrect}</span>
      </div>
    </div>

    <!-- Main Exam Body -->
    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <!-- Question Section -->
      <section class="flex-1 flex flex-col bg-white overflow-y-auto" id="question-scroll-area">
        <div class="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span id="q-number-badge" class="font-extrabold text-sm text-slate-900">Question No. 1</span>
            <span id="q-section-badge" class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Section A</span>
          </div>
          <div class="text-xs text-slate-500 font-mono" id="q-id-label">QID: 1</div>
        </div>

        <div class="p-5 sm:p-6 flex-1 space-y-5">
          <div id="q-text-container" class="text-base text-slate-800 leading-relaxed font-medium"></div>

          <!-- Question Diagram / Figure Container -->
          <div id="q-diagram-container" class="hidden"></div>

          <!-- MCQ Options Container -->
          <div id="mcq-options-container" class="space-y-3 pt-2"></div>

          <!-- Numerical Input Container -->
          <div id="numerical-container" class="hidden max-w-md pt-2 space-y-3">
            <label class="block text-xs font-bold text-slate-600 uppercase">Enter Numerical Response:</label>
            <input id="sa-input" type="text" autocomplete="off" placeholder="Type answer or use keypad..." class="w-full px-3.5 py-2.5 text-lg font-mono font-bold bg-white border-2 border-slate-300 focus:border-sky-600 focus:outline-none rounded-lg" />
            <div id="virtual-keypad" class="grid grid-cols-3 gap-2 pt-1">
              <button type="button" data-key="7" class="keypad-btn">7</button>
              <button type="button" data-key="8" class="keypad-btn">8</button>
              <button type="button" data-key="9" class="keypad-btn">9</button>
              <button type="button" data-key="4" class="keypad-btn">4</button>
              <button type="button" data-key="5" class="keypad-btn">5</button>
              <button type="button" data-key="6" class="keypad-btn">6</button>
              <button type="button" data-key="1" class="keypad-btn">1</button>
              <button type="button" data-key="2" class="keypad-btn">2</button>
              <button type="button" data-key="3" class="keypad-btn">3</button>
              <button type="button" data-key="-" class="keypad-btn">&minus;</button>
              <button type="button" data-key="0" class="keypad-btn">0</button>
              <button type="button" data-key="." class="keypad-btn">.</button>
              <button type="button" data-key="BACKSPACE" class="keypad-btn col-span-2 !bg-amber-50 !border-amber-300 !text-amber-900 text-sm">Backspace</button>
              <button type="button" data-key="CLEAR" class="keypad-btn !bg-red-50 !border-red-300 !text-red-700 text-sm">Clear</button>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 sticky bottom-0">
          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-save-next" type="button" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition">Save &amp; Next</button>
            <button id="btn-clear-resp" type="button" class="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm transition">Clear</button>
            <button id="btn-save-mark" type="button" class="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm transition">Save &amp; Mark for Review</button>
            <button id="btn-mark-next" type="button" class="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs sm:text-sm transition">Mark for Review &amp; Next</button>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-prev" type="button" class="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm transition">&larr; Back</button>
            <button id="btn-next" type="button" class="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm transition">Next &rarr;</button>
          </div>
        </div>
      </section>

      <!-- Right Palette Sidebar -->
      <aside class="w-full lg:w-[320px] bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0">
        <div class="p-3 border-b border-slate-200 bg-white grid grid-cols-2 gap-2 text-[11px]">
          <div class="flex items-center gap-2"><span id="cnt-not_visited" class="pal-btn st-not_visited !w-6 !h-6 !text-[10px]">0</span><span>Not Visited</span></div>
          <div class="flex items-center gap-2"><span id="cnt-not_answered" class="pal-btn st-not_answered !w-6 !h-6 !text-[10px]">0</span><span>Not Answered</span></div>
          <div class="flex items-center gap-2"><span id="cnt-answered" class="pal-btn st-answered !w-6 !h-6 !text-[10px]">0</span><span>Answered</span></div>
          <div class="flex items-center gap-2"><span id="cnt-marked" class="pal-btn st-marked !w-6 !h-6 !text-[10px]">0</span><span>Marked Review</span></div>
          <div class="col-span-2 flex items-center gap-2"><span id="cnt-answered_marked" class="pal-btn st-answered_marked !w-6 !h-6 !text-[10px]">0</span><span>Answered &amp; Marked</span></div>
        </div>

        <div class="px-4 py-2 bg-sky-900 text-white text-xs font-bold flex items-center justify-between">
          <span id="pal-subject-name">Questions</span>
          <span id="pal-total-count" class="text-sky-200 text-[11px] font-mono">${totalQuestions} Qs</span>
        </div>

        <div class="p-3 flex-1 overflow-y-auto">
          <div id="palette-grid" class="grid grid-cols-5 gap-2 justify-items-center"></div>
        </div>
      </aside>
    </div>
  </div>

  <!-- 3. RESULTS & REVIEW VIEW -->
  <div id="view-results" class="hidden flex-1 flex flex-col bg-slate-100 min-h-screen">
    <header class="nta-header text-white px-5 py-4 shadow-md flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold">${title}</h2>
        <p class="text-xs text-slate-300">Official Scorecard &amp; In-Detail Question Analysis</p>
      </div>
      <button onclick="location.reload()" class="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold">Restart Test</button>
    </header>

    <main class="max-w-5xl w-full mx-auto p-5 sm:p-6 space-y-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Total Score</span>
          <div class="text-4xl font-extrabold text-slate-900 mt-1"><span id="res-score">0</span> <span class="text-base text-slate-400 font-normal">/ ${maxMarks}</span></div>
          <div class="text-xs text-slate-500 mt-1">Accuracy: <span id="res-accuracy" class="font-bold text-slate-700">0%</span> &bull; Time: <span id="res-time" class="font-bold text-slate-700">0m</span></div>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center text-xs">
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg"><div id="res-correct" class="text-xl font-bold text-emerald-700">0</div><div class="text-emerald-800 font-medium mt-0.5">Correct</div></div>
          <div class="p-3 bg-red-50 border border-red-200 rounded-lg"><div id="res-incorrect" class="text-xl font-bold text-red-600">0</div><div class="text-red-800 font-medium mt-0.5">Incorrect</div></div>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg"><div id="res-unattempted" class="text-xl font-bold text-slate-600">0</div><div class="text-slate-700 font-medium mt-0.5">Unattempted</div></div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="font-bold text-base text-slate-800">Question-by-Question Solution Breakdown</h3>
        <div id="review-list" class="space-y-4"></div>
      </div>
    </main>
  </div>

  <script>
    const QUESTIONS = ${questionsJson};
    const SUBJECTS = ${subjectsJson};
    const TOTAL_DURATION_SEC = ${totalDurationSec};
    const STORAGE_KEY = '${storageKey}';
    const MARKING = ${JSON.stringify(markingScheme)};

    const state = {
      screen: 'instructions',
      currentIdx: 0,
      remainingSec: TOTAL_DURATION_SEC,
      answers: {},
      paused: false
    };

    function initAnswers() {
      const a = {};
      QUESTIONS.forEach(q => {
        a[q.num] = { status: 'not_visited', response: null, timeSec: 0 };
      });
      return a;
    }

    state.answers = initAnswers();

    function showScreen(name) {
      state.screen = name;
      document.getElementById('view-instructions').classList.toggle('hidden', name !== 'instructions');
      document.getElementById('view-exam').classList.toggle('hidden', name !== 'exam');
      document.getElementById('view-results').classList.toggle('hidden', name !== 'results');
    }

    let timerHandle = null;
    function startTimer() {
      if (timerHandle) clearInterval(timerHandle);
      timerHandle = setInterval(() => {
        if (state.screen !== 'exam' || state.paused) return;
        state.remainingSec = Math.max(0, state.remainingSec - 1);
        updateTimerDisplay();
        if (state.remainingSec <= 0) {
          submitExam();
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      const s = state.remainingSec;
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const str = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      const el = document.getElementById('timer-display');
      if (el) el.textContent = str;
    }

    function renderSubjectTabs() {
      const container = document.getElementById('subject-tabs');
      if (!container) return;
      const currentQ = QUESTIONS[state.currentIdx];
      container.innerHTML = SUBJECTS.map(subj => {
        const isActive = currentQ && currentQ.subject === subj;
        return \`<button type="button" data-subj="\${subj}" class="subj-tab px-3.5 py-1.5 rounded-lg text-xs font-bold transition \${isActive ? 'bg-sky-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">\${subj}</button>\`;
      }).join('');
    }

    function visitQuestion(idx) {
      if (idx < 0 || idx >= QUESTIONS.length) return;
      state.currentIdx = idx;
      const q = QUESTIONS[idx];
      const entry = state.answers[q.num];
      if (entry.status === 'not_visited') {
        entry.status = 'not_answered';
      }
      renderExam();
      renderPalette();
      renderSubjectTabs();
    }

    let draftResponse = null;

    function renderExam() {
      const q = QUESTIONS[state.currentIdx];
      const entry = state.answers[q.num];
      draftResponse = entry.response;

      document.getElementById('q-number-badge').textContent = \`Question No. \${q.num}\`;
      document.getElementById('q-section-badge').textContent = \`\${q.subject} \u2022 \${q.section}\`;
      document.getElementById('q-id-label').textContent = \`QID: \${q.qid}\`;

      const textContainer = document.getElementById('q-text-container');
      const diagramBox = document.getElementById('q-diagram-container');

      // Visual Question Card Presentation (Zero OCR clutter)
      if (q.qImg && q.qImg.trim()) {
        diagramBox.innerHTML = \`
          <div class="my-2 bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 text-center shadow-sm">
            <img src="\${q.qImg}" alt="Question No. \${q.num}" class="max-w-full max-h-[520px] mx-auto rounded-lg object-contain cursor-zoom-in shadow-sm hover:opacity-95 transition" onclick="zoomDiagram('\${q.qImg.replace(/'/g, "\\\\'")}')" />
            <div class="text-[11px] text-slate-400 font-medium mt-3 flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
              <span>Click question image to view full size</span>
            </div>
          </div>
        \`;
        diagramBox.classList.remove('hidden');
        if (textContainer) textContainer.classList.add('hidden');
      } else {
        diagramBox.innerHTML = '';
        diagramBox.classList.add('hidden');
        if (textContainer) {
          textContainer.innerHTML = q.text || \`Question \${q.num}\`;
          textContainer.classList.remove('hidden');
        }
      }

      const mcqBox = document.getElementById('mcq-options-container');
      const numBox = document.getElementById('numerical-container');

      if (q.type === 'MCQ') {
        mcqBox.classList.remove('hidden');
        numBox.classList.add('hidden');

        const defaultLetters = ['A', 'B', 'C', 'D'];
        mcqBox.innerHTML = \`
          <div class="space-y-2.5 pt-1">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Choose Correct Option:</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              \${[0, 1, 2, 3].map(oIdx => {
                const val = String(oIdx + 1);
                const letter = defaultLetters[oIdx];
                const optText = q.options && q.options[oIdx] ? q.options[oIdx].trim() : \`Option (\${letter})\`;
                const isSel = draftResponse === val;
                return \`
                  <div data-val="\${val}" class="opt-card p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3.5 transition \${isSel ? 'selected' : 'border-slate-200 bg-white hover:border-sky-300'}">
                    <span class="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 \${isSel ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 text-slate-700'}">(\${letter})</span>
                    <span class="text-sm font-semibold text-slate-800 flex-1">\${optText}</span>
                  </div>
                \`;
              }).join('')}
            </div>
          </div>
        \`;
      } else {
        mcqBox.classList.add('hidden');
        numBox.classList.remove('hidden');
        document.getElementById('sa-input').value = draftResponse || '';
      }
    }

    function renderPalette() {
      const grid = document.getElementById('palette-grid');
      if (!grid) return;

      const counts = { not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0 };

      grid.innerHTML = QUESTIONS.map((q, idx) => {
        const entry = state.answers[q.num];
        counts[entry.status] = (counts[entry.status] || 0) + 1;
        const isActive = idx === state.currentIdx;
        return \`<button type="button" data-idx="\${idx}" class="pal-btn st-\${entry.status} \${isActive ? 'pal-active' : ''}">\${q.num}</button>\`;
      }).join('');

      for (const [k, v] of Object.entries(counts)) {
        const el = document.getElementById('cnt-' + k);
        if (el) el.textContent = v;
      }
    }

    function submitExam() {
      if (timerHandle) clearInterval(timerHandle);

      let correct = 0;
      let incorrect = 0;
      let unattempted = 0;
      let totalScore = 0;

      function compareAnswers(userVal, officialVal) {
        if (!userVal || !officialVal) return false;
        const u = String(userVal).trim();
        const o = String(officialVal).trim();
        if (u.toUpperCase() === o.toUpperCase()) return true;
        const uFloat = parseFloat(u);
        const oFloat = parseFloat(o);
        if (!isNaN(uFloat) && !isNaN(oFloat) && Math.abs(uFloat - oFloat) < 0.001) {
          return true;
        }
        return false;
      }

      const reviewCards = QUESTIONS.map(q => {
        const entry = state.answers[q.num];
        const userResp = entry.response;
        const official = q.answer;

        let statusText = '';
        let isCorrect = false;

        if (!userResp) {
          unattempted++;
          statusText = 'Unattempted';
        } else if (compareAnswers(userResp, official)) {
          correct++;
          isCorrect = true;
          totalScore += MARKING.correct;
          statusText = 'Correct (+' + MARKING.correct + ')';
        } else {
          incorrect++;
          totalScore += MARKING.incorrect;
          statusText = 'Incorrect (' + MARKING.incorrect + ')';
        }

        return \`
          <div class="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sm text-slate-900">Q.\${q.num} (\${q.subject})</span>
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full \${isCorrect ? 'bg-emerald-100 text-emerald-800' : userResp ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}">\${statusText}</span>
            </div>
            <div class="text-sm text-slate-800 font-medium">\${q.text}</div>
            \${q.qImg ? \`<div class="my-2.5 text-center bg-slate-50 border border-slate-200 rounded-lg p-2"><img src="\${q.qImg}" alt="Question Figure" class="max-w-full max-h-56 mx-auto rounded object-contain cursor-zoom-in" onclick="zoomDiagram('\${q.qImg.replace(/'/g, "\\\\'")}')" /></div>\` : ''}
            <div class="pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-xs font-mono">
              <div>Your Answer: <strong class="\${isCorrect ? 'text-emerald-700' : userResp ? 'text-red-600' : 'text-slate-400'}">\${userResp || 'None'}</strong></div>
              <div>Official Answer Key: <strong class="text-emerald-700">\${official || 'Pending'}</strong></div>
            </div>
          </div>
        \`;
      }).join('');

      const totalAttempted = correct + incorrect;
      const accuracy = totalAttempted > 0 ? Math.round((correct / totalAttempted) * 100) : 0;
      const timeTakenMins = Math.round((TOTAL_DURATION_SEC - state.remainingSec) / 60);

      document.getElementById('res-score').textContent = totalScore;
      document.getElementById('res-accuracy').textContent = accuracy + '%';
      document.getElementById('res-time').textContent = timeTakenMins + 'm';
      document.getElementById('res-correct').textContent = correct;
      document.getElementById('res-incorrect').textContent = incorrect;
      document.getElementById('res-unattempted').textContent = unattempted;
      document.getElementById('review-list').innerHTML = reviewCards;

      showScreen('results');
    }

    // Event Bindings
    document.addEventListener('DOMContentLoaded', () => {
      // Proceed to exam with fullscreen
      const startBtn = document.getElementById('btn-start-exam');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          showScreen('exam');
          startTimer();
          visitQuestion(0);
          try {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
            }
          } catch (e) {}
        });
      }

      // Subject switcher
      document.getElementById('subject-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.subj-tab');
        if (!btn) return;
        const subj = btn.dataset.subj;
        const firstIdx = QUESTIONS.findIndex(q => q.subject === subj);
        if (firstIdx !== -1) visitQuestion(firstIdx);
      });

      // Palette selection
      document.getElementById('palette-grid').addEventListener('click', (e) => {
        const btn = e.target.closest('.pal-btn');
        if (!btn) return;
        visitQuestion(parseInt(btn.dataset.idx, 10));
      });

      // MCQ selection
      document.getElementById('mcq-options-container').addEventListener('click', (e) => {
        const card = e.target.closest('.opt-card');
        if (!card) return;
        draftResponse = card.dataset.val;
        document.querySelectorAll('.opt-card').forEach(c => {
          const isSel = c.dataset.val === draftResponse;
          c.classList.toggle('selected', isSel);
          const icon = c.querySelector('span');
          if (icon) {
            icon.className = isSel ? 'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-sky-600 text-white' : 'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-700';
          }
        });
      });

      // Virtual keypad for numerical questions
      document.getElementById('virtual-keypad').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const key = btn.dataset.key;
        const input = document.getElementById('sa-input');
        if (key === 'CLEAR') input.value = '';
        else if (key === 'BACKSPACE') input.value = input.value.slice(0, -1);
        else input.value += key;
        draftResponse = input.value;
      });

      // Save & Next
      document.getElementById('btn-save-next').addEventListener('click', () => {
        const q = QUESTIONS[state.currentIdx];
        const entry = state.answers[q.num];
        entry.response = draftResponse;
        entry.status = draftResponse ? 'answered' : 'not_answered';
        visitQuestion(state.currentIdx + 1);
      });

      // Save & Mark for Review
      document.getElementById('btn-save-mark').addEventListener('click', () => {
        const q = QUESTIONS[state.currentIdx];
        const entry = state.answers[q.num];
        entry.response = draftResponse;
        entry.status = draftResponse ? 'answered_marked' : 'marked';
        visitQuestion(state.currentIdx + 1);
      });

      // Mark for Review & Next
      document.getElementById('btn-mark-next').addEventListener('click', () => {
        const q = QUESTIONS[state.currentIdx];
        const entry = state.answers[q.num];
        entry.status = entry.response ? 'answered_marked' : 'marked';
        visitQuestion(state.currentIdx + 1);
      });

      // Clear response
      document.getElementById('btn-clear-resp').addEventListener('click', () => {
        const q = QUESTIONS[state.currentIdx];
        state.answers[q.num].response = null;
        draftResponse = null;
        renderExam();
      });

      // Back & Next
      document.getElementById('btn-prev').addEventListener('click', () => visitQuestion(state.currentIdx - 1));
      document.getElementById('btn-next').addEventListener('click', () => visitQuestion(state.currentIdx + 1));

      // Submit
      document.getElementById('btn-submit-exam-top').addEventListener('click', () => {
        if (confirm('Are you sure you want to finish and submit your CBT examination?')) {
          submitExam();
        }
      });
    });

    // Diagram Zoom Handlers
    window.zoomDiagram = function(src) {
      const modal = document.getElementById('diagram-zoom-modal');
      const img = document.getElementById('diagram-zoom-img');
      if (modal && img) {
        img.src = src;
        modal.classList.remove('hidden');
      }
    };
    window.closeDiagramZoom = function() {
      const modal = document.getElementById('diagram-zoom-modal');
      if (modal) modal.classList.add('hidden');
    };
  </script>

  <!-- Diagram Zoom Overlay Modal -->
  <div id="diagram-zoom-modal" class="hidden fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onclick="closeDiagramZoom()">
    <div class="relative max-w-5xl max-h-[92vh] flex flex-col items-center" onclick="event.stopPropagation()">
      <button type="button" onclick="closeDiagramZoom()" class="absolute -top-10 right-0 text-white hover:text-red-400 font-bold text-xs flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full cursor-pointer transition">
        <span>Close</span> &times;
      </button>
      <img id="diagram-zoom-img" src="" alt="Enlarged Diagram" class="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl bg-white border border-slate-700 p-2" />
    </div>
  </div>
</body>
</html>`;
}

module.exports = { generateCbtHtml };
