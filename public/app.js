// CBT Maker Studio Client Application
// High-Fidelity 2D PDF Text & Visual Question Diagram Slicing Engine
let currentQuestions = [];
let currentSubjects = [];
let generatedHtmlContent = null;
let currentPdfDoc = null;
let autoCropsMap = new Map(); // Map<qNum, { dataUrl, pageNum, rect }>

// Pre-configured 4-Key Rotation Pool
const INITIAL_ROTATION_KEYS = [
  atob("QVEuQWI4Uk42TC11WThnZTllaGdoN1ViemY3TGNRd1R0WDUzZHpKTDlTMmFvQXhPaFlqVXc="),
  atob("QVEuQWI4Uk42TFpWY29VWHdzb2lvYUJHQ1c3dlhVaTEydjVBc203bVhmQ24xNmdMa3lYMkE="),
  atob("QVEuQWI4Uk42SngtbXlWTzNsYy0xRHItekowVnNyYVQ3N3N4d0hIOWZpdGQ1dzNVZ0s0Umc="),
  atob("QVEuQWI4Uk42S0dmOWkwZVFla2ZBSXh1ZnZ0RGVBaWlCWmNZRmxrZ1E1M0FuSzhKajlOZFE=")
];

function getStoredKeys() {
  const saved = localStorage.getItem('cbt_gemini_keys');
  if (saved) return saved;
  return INITIAL_ROTATION_KEYS.join('\n');
}

function updateKeysBadge() {
  const keys = getStoredKeys().split(/[\n,;]+/).filter(k => k.trim().length > 5);
  const badge = document.getElementById('label-active-keys');
  if (badge) {
    badge.textContent = `API Key Pool (${keys.length})`;
  }
}

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

// Cropper Modal Elements
const cropperModal = document.getElementById('cropper-modal');
const cropperCanvas = document.getElementById('cropper-canvas');
const cropperBox = document.getElementById('cropper-selection-box');
const cropperCanvasContainer = document.getElementById('cropper-canvas-container');
const cropperModalTitle = document.getElementById('cropper-modal-title');
const cropperPageNumLabel = document.getElementById('cropper-page-num');
const cropperPrevPageBtn = document.getElementById('cropper-prev-page');
const cropperNextPageBtn = document.getElementById('cropper-next-page');
const cropperCancelBtn = document.getElementById('cropper-btn-cancel');
const cropperResetBtn = document.getElementById('cropper-btn-reset-box');
const cropperApplyBtn = document.getElementById('cropper-btn-apply');

let activeCropQIdx = null;
let cropperCurrentPage = 1;
let cropperTotalPages = 1;
let isDraggingSelection = false;
let selStartX = 0;
let selStartY = 0;
let selRect = null; // { x, y, width, height } in canvas pixels

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

/**
 * Filter coaching watermarks and repeated header/footer noise
 */
function cleanWatermarks(text) {
  if (!text) return '';
  return text
    .replace(/^[^\n]*(?:DOWNLOAD\s+[^\n]*APP\s+NOW|IIT\s+SCHOOL|ALLEN|FIITJEE|PHYSICS\s*WALLAH|UNACADEMY|RESONANCE)[^\n]*$/gmi, '')
    .replace(/^[^\n]*(?:Page\s*\d+\s*(?:of|\/)\s*\d+|DPP\s*[-–]\s*\d+)[^\n]*$/gmi, '')
    .replace(/^[A-Z\s]{4,}\s*\(\s*[A-Za-z\s]+\s*\)\s*\d+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Reconstruct text lines from PDF.js items using 2D coordinates (Y top-to-bottom, X left-to-right)
 */
function reconstructTextLinesFromItems(items) {
  if (!items || items.length === 0) return { text: '', linePositions: [] };

  // Sort descending by Y (higher Y is higher up in PDF coordinate space), then ascending by X
  const sorted = items.slice().sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 3.5) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  const lines = [];
  const linePositions = [];
  let currentLine = [];
  let currentY = null;
  let currentMinX = null;

  for (const item of sorted) {
    if (!item.str || !item.str.trim()) continue;
    const itemY = item.transform[5];
    const itemX = item.transform[4];

    if (currentY === null) {
      currentY = itemY;
      currentMinX = itemX;
      currentLine.push(item.str);
    } else if (Math.abs(itemY - currentY) <= 4.0) {
      currentLine.push(item.str);
    } else {
      const lineStr = currentLine.join(' ');
      lines.push(lineStr);
      linePositions.push({ text: lineStr, pdfY: currentY, pdfX: currentMinX });
      currentLine = [item.str];
      currentY = itemY;
      currentMinX = itemX;
    }
  }

  if (currentLine.length > 0) {
    const lineStr = currentLine.join(' ');
    lines.push(lineStr);
    linePositions.push({ text: lineStr, pdfY: currentY, pdfX: currentMinX });
  }

  return {
    text: lines.join('\n'),
    linePositions
  };
}

/**
 * Process PDF: Renders pages, extracts 2D-sorted text, detects question anchors,
 * and automatically slices visual question cards (including diagrams).
 */
async function processPdfWithVisualSlices(file) {
  if (typeof pdfjsLib === 'undefined' || !file) return null;

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  currentPdfDoc = pdf;
  autoCropsMap.clear();

  let completeText = '';
  const questionAnchorPattern = /(?:^|\n|\s{3,})(?:(?:Q(?:uestion)?\.?\s*)(\d{1,3})|(\d{1,3}))[\.\)\:\-]\s+/gi;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const scale = 1.6; // High DPI for crisp diagram rendering
    const viewport = page.getViewport({ scale });

    // Render page to offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Extract text items and reconstruct 2D lines
    const textContent = await page.getTextContent();
    const { text: pageText, linePositions } = reconstructTextLinesFromItems(textContent.items);
    completeText += '\n' + pageText;

    // Detect question anchors on this page to calculate visual bounding boxes
    const detectedOnPage = [];
    for (const lp of linePositions) {
      questionAnchorPattern.lastIndex = 0;
      const match = questionAnchorPattern.exec(lp.text);
      if (match) {
        const qNum = parseInt(match[1] || match[2], 10);
        if (qNum > 0 && qNum <= 300) {
          // Convert PDF Y to Canvas Screen Y
          const canvasY = Math.max(0, viewport.height - (lp.pdfY * scale));
          detectedOnPage.push({ qNum, canvasY });
        }
      }
    }

    // Sort detected questions by canvas Y
    detectedOnPage.sort((a, b) => a.canvasY - b.canvasY);

    // Slice each question box from the canvas
    for (let i = 0; i < detectedOnPage.length; i++) {
      const cur = detectedOnPage[i];
      const next = detectedOnPage[i + 1];
      const startY = Math.max(0, cur.canvasY - 12);
      const endY = next ? Math.min(canvas.height, next.canvasY - 12) : Math.min(canvas.height, startY + 450);
      const sliceH = Math.max(80, endY - startY);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const sCtx = sliceCanvas.getContext('2d');
      sCtx.drawImage(canvas, 0, startY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const qImgData = sliceCanvas.toDataURL('image/jpeg', 0.85);
      autoCropsMap.set(cur.qNum, {
        dataUrl: qImgData,
        pageNum,
        startY,
        sliceH
      });
    }
  }

  return cleanWatermarks(completeText);
}

/**
 * Direct client-side Gemini extraction (Zero serverless timeout, unlimited duration)
 */
async function extractWithGeminiDirect(rawText, defaultSubject = 'Physics') {
  const keys = getStoredKeys().split(/[\n,;]+/).map(k => k.trim()).filter(k => k.length > 5);
  if (keys.length === 0) return null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const prompt = `
You are an expert exam question digitizer for competitive exams (JEE, NEET, CBSE).
Analyze the following exam paper text and extract all questions into a clean JSON structure.

EXAM TEXT:
"""
${rawText.substring(0, 60000)}
"""

RULES:
1. Extract ALL questions sequentially (1, 2, 3, ...).
2. Clean question statement text. Strip watermarks like "DOWNLOAD IIT SCHOOL APP NOW", coaching ads, page numbers.
3. Keep mathematical expressions and formulas intact.
4. For MCQs: Provide exactly 4 options in the "options" array. Set "type": "MCQ".
5. For Numerical/Integer type questions: Set "type": "Numerical", "options": [].
6. Set "subject" ("${defaultSubject}"), "section" ("Section A" for MCQ, "Section B" for Numerical).
7. If an Answer Key is present at the end, map the answer for each question into "answer" (e.g. "1", "2", "3", "4" or numerical value).
8. Flag if the question requires a diagram ("hasDiagram": true/false).

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "subjects": ["Physics"],
  "questions": [
    {
      "num": 1,
      "subject": "Physics",
      "section": "Section A",
      "type": "Numerical",
      "text": "The current I flowing through the given circuit will be ________ A.",
      "options": [],
      "answer": "2",
      "hasDiagram": true
    }
  ]
}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      });

      clearTimeout(timeout);
      if (!res.ok) continue;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text);
      if (parsed.questions && parsed.questions.length > 0) {
        return parsed;
      }
    } catch (e) {
      clearTimeout(timeout);
      console.warn(`[ClientGemini] Key #${i+1} attempt failed:`, e.message);
    }
  }

  return null;
}

// Trigger Parsing
btnParse.addEventListener('click', async () => {
  const formData = new FormData();
  const defaultSubj = document.getElementById('default-subject-select').value;
  formData.append('defaultSubject', defaultSubj);

  btnParse.disabled = true;
  btnParse.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Analyzing &amp; Cropping Diagrams...</span>`;

  try {
    let extractedPaperText = '';
    if (paperInput.files[0]) {
      extractedPaperText = await processPdfWithVisualSlices(paperInput.files[0]);
      if (extractedPaperText) {
        formData.append('rawText', extractedPaperText);
      } else {
        formData.append('paperPdf', paperInput.files[0]);
      }
    }

    if (keyInput.files[0]) {
      let extractedKeyText = '';
      try {
        const keyPdf = await pdfjsLib.getDocument({ data: await keyInput.files[0].arrayBuffer() }).promise;
        for (let i = 1; i <= keyPdf.numPages; i++) {
          const p = await keyPdf.getPage(i);
          const tc = await p.getTextContent();
          extractedKeyText += '\n' + tc.items.map(it => it.str).join(' ');
        }
      } catch (e) {}

      if (extractedKeyText.trim()) {
        formData.append('answerKeyText', extractedKeyText);
      } else {
        formData.append('keyPdf', keyInput.files[0]);
      }
    }

    if (!extractedPaperText && rawTextInput.value.trim()) {
      formData.append('rawText', rawTextInput.value.trim());
    }

    if (!paperInput.files[0] && !rawTextInput.value.trim()) {
      alert('Please select a PDF file or paste text content first');
      btnParse.disabled = false;
      btnParse.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i><span>Parse &amp; Extract CBT Questions</span>`;
      return;
    }

    let extractedQuestions = null;
    let detectedAnswersCount = 0;
    let subjectsList = [defaultSubj];

    // Attempt direct Gemini extraction if text was extracted
    const textToParse = extractedPaperText || rawTextInput.value.trim();
    if (textToParse) {
      btnParse.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Extracting with Gemini AI...</span>`;
      try {
        const directResult = await extractWithGeminiDirect(textToParse, defaultSubj);
        if (directResult && directResult.questions && directResult.questions.length > 0) {
          extractedQuestions = directResult.questions.map((q, idx) => ({
            qid: `QID_${q.num || idx + 1}_${Date.now().toString(36)}`,
            num: q.num || idx + 1,
            subject: q.subject || defaultSubj,
            section: q.section || (q.type === 'Numerical' ? 'Section B' : 'Section A'),
            type: q.type || 'MCQ',
            text: q.text || `Question ${q.num || idx + 1}`,
            options: q.options && q.options.length === 4 ? q.options : (q.type === 'MCQ' ? ['Option 1', 'Option 2', 'Option 3', 'Option 4'] : []),
            answer: q.answer ? String(q.answer) : '',
            hasDiagram: !!q.hasDiagram,
            qImg: ''
          }));
          subjectsList = directResult.subjects && directResult.subjects.length > 0 ? directResult.subjects : [defaultSubj];
          detectedAnswersCount = extractedQuestions.filter(q => q.answer).length;
        }
      } catch (err) {
        console.warn('Direct Gemini attempt fallback to server:', err);
      }
    }

    if (!extractedQuestions) {
      btnParse.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Structuring Questions &amp; Answers...</span>`;
      const activeKeys = getStoredKeys();
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: {
          'x-gemini-keys': activeKeys.replace(/\n+/g, ',')
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse');
      extractedQuestions = data.questions || [];
      subjectsList = data.stats.subjects || [defaultSubj];
      detectedAnswersCount = data.stats.detectedAnswers;
    }

    currentQuestions = extractedQuestions || [];
    currentSubjects = subjectsList;

    // Associate auto-cropped visual diagrams (circuits, formulas, figures)
    for (const q of currentQuestions) {
      if (autoCropsMap.has(q.num)) {
        q.qImg = autoCropsMap.get(q.num).dataUrl;
      }
    }

    document.getElementById('stat-q-count').innerText = currentQuestions.length;
    document.getElementById('stat-k-count').innerText = detectedAnswersCount;
    document.getElementById('badge-total-extracted').innerText = `${currentQuestions.length} Questions`;

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

// Render question cards with diagram preview and inline editing
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

    // Diagram section
    let diagramMarkup = '';
    if (q.qImg && q.qImg.trim()) {
      diagramMarkup = `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="${q.qImg}" alt="Question Diagram" class="max-h-24 max-w-xs rounded border border-slate-700 bg-white p-1 object-contain" />
            <div class="space-y-1">
              <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <i class="fa-solid fa-image text-sky-400"></i> Diagram Attached
              </span>
              <p class="text-[11px] text-slate-500">Includes circuit / diagram / formulas from PDF</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="openCropperModal(${idx})" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1">
              <i class="fa-solid fa-crop-simple text-sky-400"></i>
              <span>Re-crop</span>
            </button>
            <button type="button" onclick="removeQuestionDiagram(${idx})" class="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 transition">
              <i class="fa-solid fa-trash mr-1"></i> Remove
            </button>
          </div>
        </div>
      `;
    } else {
      diagramMarkup = `
        <div class="flex items-center gap-2 pt-1">
          <button type="button" onclick="openCropperModal(${idx})" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5">
            <i class="fa-solid fa-crop-simple text-sky-400"></i>
            <span>Crop Diagram from PDF</span>
          </button>
          <label class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-upload text-emerald-400"></i>
            <span>Upload Image</span>
            <input type="file" accept="image/*" class="hidden" onchange="uploadCustomDiagram(${idx}, this)" />
          </label>
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

        ${diagramMarkup}

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

window.removeQuestionDiagram = function(idx) {
  if (currentQuestions[idx]) {
    currentQuestions[idx].qImg = '';
    renderQuestions();
  }
};

window.uploadCustomDiagram = function(idx, input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentQuestions[idx].qImg = e.target.result;
      renderQuestions();
    };
    reader.readAsDataURL(input.files[0]);
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

// Interactive Cropper Modal Logic
window.openCropperModal = async function(idx) {
  activeCropQIdx = idx;
  const q = currentQuestions[idx];
  cropperModalTitle.textContent = `Crop Diagram for Question ${q.num} (${q.subject})`;

  if (!currentPdfDoc) {
    alert('Please upload a PDF file first to use interactive cropping.');
    return;
  }

  // Determine initial page number
  let targetPage = 1;
  if (autoCropsMap.has(q.num)) {
    targetPage = autoCropsMap.get(q.num).pageNum;
  }
  cropperCurrentPage = targetPage;
  cropperTotalPages = currentPdfDoc.numPages;

  cropperModal.classList.remove('hidden');
  await renderCropperPage(cropperCurrentPage);
};

async function renderCropperPage(pageNum) {
  if (!currentPdfDoc) return;
  cropperPageNumLabel.textContent = `${pageNum} / ${cropperTotalPages}`;
  cropperBox.classList.add('hidden');
  selRect = null;

  const page = await currentPdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });
  cropperCanvas.width = viewport.width;
  cropperCanvas.height = viewport.height;
  const ctx = cropperCanvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
}

cropperPrevPageBtn.addEventListener('click', async () => {
  if (cropperCurrentPage > 1) {
    cropperCurrentPage--;
    await renderCropperPage(cropperCurrentPage);
  }
});

cropperNextPageBtn.addEventListener('click', async () => {
  if (cropperCurrentPage < cropperTotalPages) {
    cropperCurrentPage++;
    await renderCropperPage(cropperCurrentPage);
  }
});

cropperCancelBtn.addEventListener('click', () => {
  cropperModal.classList.add('hidden');
});

cropperResetBtn.addEventListener('click', () => {
  cropperBox.classList.add('hidden');
  selRect = null;
});

// Cropper selection mouse/touch events
cropperCanvasContainer.addEventListener('mousedown', (e) => {
  isDraggingSelection = true;
  const rect = cropperCanvas.getBoundingClientRect();
  selStartX = e.clientX - rect.left;
  selStartY = e.clientY - rect.top;
  cropperBox.style.left = `${selStartX}px`;
  cropperBox.style.top = `${selStartY}px`;
  cropperBox.style.width = '0px';
  cropperBox.style.height = '0px';
  cropperBox.classList.remove('hidden');
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingSelection) return;
  const rect = cropperCanvas.getBoundingClientRect();
  const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

  const left = Math.min(selStartX, curX);
  const top = Math.min(selStartY, curY);
  const width = Math.abs(curX - selStartX);
  const height = Math.abs(curY - selStartY);

  cropperBox.style.left = `${left}px`;
  cropperBox.style.top = `${top}px`;
  cropperBox.style.width = `${width}px`;
  cropperBox.style.height = `${height}px`;

  // Scale relative to actual canvas resolution
  const scaleX = cropperCanvas.width / rect.width;
  const scaleY = cropperCanvas.height / rect.height;

  selRect = {
    x: left * scaleX,
    y: top * scaleY,
    width: width * scaleX,
    height: height * scaleY
  };
});

window.addEventListener('mouseup', () => {
  isDraggingSelection = false;
});

cropperApplyBtn.addEventListener('click', () => {
  if (activeCropQIdx === null || !currentQuestions[activeCropQIdx]) return;

  if (!selRect || selRect.width < 10 || selRect.height < 10) {
    alert('Please drag a selection rectangle around the diagram first.');
    return;
  }

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = selRect.width;
  cropCanvas.height = selRect.height;
  const cCtx = cropCanvas.getContext('2d');

  cCtx.drawImage(
    cropperCanvas,
    selRect.x, selRect.y, selRect.width, selRect.height,
    0, 0, selRect.width, selRect.height
  );

  const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
  currentQuestions[activeCropQIdx].qImg = croppedDataUrl;

  cropperModal.classList.add('hidden');
  renderQuestions();
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

// API Key Pool Modal Handlers
const btnApiKeys = document.getElementById('btn-api-keys');
const keysModal = document.getElementById('keys-modal');
const btnCloseKeysModal = document.getElementById('btn-close-keys-modal');
const inputApiKeys = document.getElementById('input-api-keys');
const btnSaveKeys = document.getElementById('btn-save-keys');
const btnResetDefaultKeys = document.getElementById('btn-reset-default-keys');

if (btnApiKeys && keysModal) {
  btnApiKeys.addEventListener('click', () => {
    inputApiKeys.value = getStoredKeys();
    keysModal.classList.remove('hidden');
  });

  btnCloseKeysModal.addEventListener('click', () => {
    keysModal.classList.add('hidden');
  });

  btnSaveKeys.addEventListener('click', () => {
    const val = inputApiKeys.value.trim();
    if (val) {
      localStorage.setItem('cbt_gemini_keys', val);
    } else {
      localStorage.removeItem('cbt_gemini_keys');
    }
    updateKeysBadge();
    keysModal.classList.add('hidden');
    alert('Gemini API key pool updated successfully!');
  });

  btnResetDefaultKeys.addEventListener('click', () => {
    localStorage.setItem('cbt_gemini_keys', INITIAL_ROTATION_KEYS.join('\n'));
    inputApiKeys.value = INITIAL_ROTATION_KEYS.join('\n');
    updateKeysBadge();
    alert('Restored 4 default API rotation keys.');
  });

  // Initialize badge on load
  updateKeysBadge();
}
