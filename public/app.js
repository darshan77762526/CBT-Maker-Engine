// CBT Maker Studio Client Application
let currentQuestions = [];
let currentSubjects = [];
let generatedHtmlContent = null;

const paperInput = document.getElementById('input-paper-pdf');
const keyInput = document.getElementById('input-key-pdf');
const dropPaper = document.getElementById('drop-paper');
const dropKey = document.getElementById('drop-key');
const labelPaper = document.getElementById('label-paper-file');
const labelKey = document.getElementById('label-key-file');
const btnParse = document.getElementById('btn-parse-paper');
const btnToggleRaw = document.getElementById('btn-toggle-raw-text');
const rawTextPanel = document.getElementById('raw-text-panel');
const rawTextInput = document.getElementById('raw-text-input');

const configPanel = document.getElementById('config-panel');
const questionsPanel = document.getElementById('questions-panel');
const questionsList = document.getElementById('questions-list');
const btnGenerate = document.getElementById('btn-generate-all');
const btnPreviewTop = document.getElementById('btn-preview-top');
const btnDownloadTop = document.getElementById('btn-download-top');
const btnAddQuestion = document.getElementById('btn-add-question');

// Drag & drop handlers
dropPaper.addEventListener('click', () => paperInput.click());
paperInput.addEventListener('change', () => {
  if (paperInput.files[0]) {
    labelPaper.innerHTML = `<span class="text-sky-400 font-bold">${paperInput.files[0].name}</span>`;
  }
});

dropKey.addEventListener('click', () => keyInput.click());
keyInput.addEventListener('change', () => {
  if (keyInput.files[0]) {
    labelKey.innerHTML = `<span class="text-emerald-400 font-bold">${keyInput.files[0].name}</span>`;
  }
});

btnToggleRaw.addEventListener('click', () => {
  rawTextPanel.classList.toggle('hidden');
});

// Trigger Parsing
btnParse.addEventListener('click', async () => {
  const formData = new FormData();
  const defaultSubj = document.getElementById('default-subject-select').value;
  formData.append('defaultSubject', defaultSubj);

  if (paperInput.files[0]) {
    formData.append('paperPdf', paperInput.files[0]);
  }
  if (keyInput.files[0]) {
    formData.append('keyPdf', keyInput.files[0]);
  }
  if (rawTextInput.value.trim()) {
    formData.append('rawText', rawTextInput.value.trim());
  }

  if (!paperInput.files[0] && !rawTextInput.value.trim()) {
    alert('Please select a PDF file or paste text content first');
    return;
  }

  btnParse.disabled = true;
  btnParse.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Parsing PDF &amp; Extracting Questions...</span>`;

  try {
    const res = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to parse');

    currentQuestions = data.questions || [];
    currentSubjects = data.stats.subjects || [defaultSubj];

    document.getElementById('stat-q-count').innerText = data.stats.totalQuestions;
    document.getElementById('stat-k-count').innerText = data.stats.detectedAnswers;
    document.getElementById('badge-total-extracted').innerText = `${data.stats.totalQuestions} Questions`;

    configPanel.classList.remove('hidden');
    questionsPanel.classList.remove('hidden');

    renderQuestions();
    window.scrollTo({ top: configPanel.offsetTop - 80, behavior: 'smooth' });
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btnParse.disabled = false;
    btnParse.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i><span>Parse &amp; Extract CBT Questions</span>`;
  }
});

// Render question cards with inline editing
function renderQuestions() {
  questionsList.innerHTML = currentQuestions.map((q, idx) => {
    const isMcq = q.type === 'MCQ';

    let optionsMarkup = '';
    if (isMcq) {
      const opts = q.options && q.options.length === 4 ? q.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
      optionsMarkup = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          ${opts.map((optText, oIdx) => {
            const val = String(oIdx + 1);
            const isCorrect = String(q.answer) === val;
            return `
              <div class="flex items-center gap-2 p-2.5 rounded-xl border ${isCorrect ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/60'}">
                <button type="button" onclick="setQuestionAnswer(${idx}, '${val}')" class="w-7 h-7 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center transition ${isCorrect ? 'bg-emerald-500 text-slate-900 shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}" title="Click to set as correct answer">
                  ${String.fromCharCode(65 + oIdx)}
                </button>
                <input type="text" value="${optText.replace(/"/g, '&quot;')}" onchange="updateOptionText(${idx}, ${oIdx}, this.value)" class="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none" placeholder="Option ${String.fromCharCode(65 + oIdx)} text..." />
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      optionsMarkup = `
        <div class="pt-2 flex items-center gap-3">
          <span class="text-xs font-bold text-slate-400">Correct Integer / Numerical Answer:</span>
          <input type="text" value="${q.answer || ''}" onchange="setQuestionAnswer(${idx}, this.value)" class="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500" placeholder="e.g. 25 or -4" />
        </div>
      `;
    }

    return `
      <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3 transition hover:border-slate-700">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-mono font-bold text-xs">${q.num}</span>
            <input type="text" value="${q.subject}" onchange="updateQuestionField(${idx}, 'subject', this.value)" class="bg-slate-900 border border-slate-700 rounded-md px-2 py-0.5 text-xs text-slate-300 font-semibold w-28" />
            <select onchange="updateQuestionField(${idx}, 'section', this.value)" class="bg-slate-900 border border-slate-700 rounded-md px-2 py-0.5 text-xs text-slate-300">
              <option value="Section A" ${q.section === 'Section A' ? 'selected' : ''}>Section A</option>
              <option value="Section B" ${q.section === 'Section B' ? 'selected' : ''}>Section B</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" onclick="toggleQuestionType(${idx})" class="px-2.5 py-1 rounded-md text-[11px] font-bold border ${isMcq ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}">
              ${q.type}
            </button>
            <button type="button" onclick="deleteQuestion(${idx})" class="text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <div>
          <textarea rows="2" onchange="updateQuestionField(${idx}, 'text', this.value)" class="w-full bg-slate-900/80 border border-slate-800 focus:border-sky-500 rounded-xl p-3 text-xs text-slate-200 focus:outline-none" placeholder="Question statement...">${q.text || ''}</textarea>
        </div>

        ${optionsMarkup}
      </div>
    `;
  }).join('');
}

// State updater helpers
window.updateQuestionField = function(idx, field, val) {
  if (currentQuestions[idx]) {
    currentQuestions[idx][field] = val;
  }
};

window.updateOptionText = function(qIdx, optIdx, val) {
  if (currentQuestions[qIdx]) {
    if (!currentQuestions[qIdx].options) currentQuestions[qIdx].options = [];
    currentQuestions[qIdx].options[optIdx] = val;
  }
};

window.setQuestionAnswer = function(qIdx, val) {
  if (currentQuestions[qIdx]) {
    currentQuestions[qIdx].answer = val;
    renderQuestions();
  }
};

window.toggleQuestionType = function(idx) {
  if (currentQuestions[idx]) {
    currentQuestions[idx].type = currentQuestions[idx].type === 'MCQ' ? 'Numerical' : 'MCQ';
    if (currentQuestions[idx].type === 'MCQ' && (!currentQuestions[idx].options || currentQuestions[idx].options.length === 0)) {
      currentQuestions[idx].options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
    }
    renderQuestions();
  }
};

window.deleteQuestion = function(idx) {
  if (confirm(`Delete Question ${currentQuestions[idx]?.num}?`)) {
    currentQuestions.splice(idx, 1);
    currentQuestions.forEach((q, i) => q.num = i + 1);
    document.getElementById('badge-total-extracted').innerText = `${currentQuestions.length} Questions`;
    renderQuestions();
  }
};

btnAddQuestion.addEventListener('click', () => {
  const nextNum = currentQuestions.length + 1;
  currentQuestions.push({
    qid: `QID_${nextNum}_${Date.now().toString(36)}`,
    num: nextNum,
    subject: document.getElementById('default-subject-select').value || 'Physics',
    section: 'Section A',
    type: 'MCQ',
    text: `Question statement ${nextNum}`,
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    answer: '1',
    qImg: ''
  });
  document.getElementById('badge-total-extracted').innerText = `${currentQuestions.length} Questions`;
  renderQuestions();
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

// Compile CBT HTML File
async function compileCbt() {
  const payload = {
    title: document.getElementById('cfg-title').value.trim() || 'Computer Based Test',
    subtitle: 'Autonomous National Testing CBT Environment',
    durationMinutes: parseInt(document.getElementById('cfg-duration').value, 10) || 180,
    subjects: Array.from(new Set(currentQuestions.map(q => q.subject))),
    markingScheme: {
      correct: parseInt(document.getElementById('cfg-mark-pos').value, 10) || 4,
      incorrect: parseInt(document.getElementById('cfg-mark-neg').value, 10) || -1,
      unattempted: 0
    },
    questions: currentQuestions
  };

  btnGenerate.disabled = true;
  btnGenerate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compiling CBT HTML...`;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    generatedHtmlContent = data.html;

    btnPreviewTop.classList.remove('hidden');
    btnDownloadTop.classList.remove('hidden');

    alert('CBT Examination HTML compiled successfully! You can now test run it or download the file.');
  } catch (err) {
    alert('Compilation error: ' + err.message);
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = `<i class="fa-solid fa-check"></i> <span>Compile CBT HTML</span>`;
  }
}

btnGenerate.addEventListener('click', compileCbt);

btnPreviewTop.addEventListener('click', () => {
  window.open('/preview', '_blank');
});

btnDownloadTop.addEventListener('click', () => {
  if (!generatedHtmlContent) return;
  const blob = new Blob([generatedHtmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanTitle = (document.getElementById('cfg-title').value || 'cbt_exam').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${cleanTitle}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
