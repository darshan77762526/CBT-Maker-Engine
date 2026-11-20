# CBT Maker Engine — Autonomous Non-AI PDF to CBT Compiler

Standalone engine that converts standard PDF question papers and answer keys directly into official Computer Based Test (CBT) HTML files with zero AI API keys and zero external dependencies.

---

### Features
1. **Deterministic Parser (`parser.js`):**
   - Extracts questions, MCQs (4 options), and Section B Numerical questions using Mozilla's `pdfjs-dist` text stream & regex state machine.
   - Detects sections (`Section A`, `Section B`) and subjects (`Physics`, `Chemistry`, `Mathematics`, etc.).
   - Parses Answer Keys automatically whether embedded at the end of the PDF or uploaded as a separate file/text.
2. **Interactive Visual Studio UI (`public/`):**
   - Drag & drop PDF question papers and answer keys.
   - Live editable question cards: adjust question statements, click to select official answer keys, toggle question types.
   - Configure exam metadata, duration (minutes), and marking schemes (+4 / -1).
3. **CBT Engine Compiler (`template.js`):**
   - Outputs a self-contained, single-file CBT HTML paper.
   - Features NTA question palette, live countdown timer, virtual keypad for numerical input, subject tabs, zoom, and instant scorecard & review mode.
   - Cross-browser fullscreen mode on Proceed to Exam.
4. **Instant Preview & Export:**
   - 1-Click **"Live Test Run"**: Test-drive the compiled exam immediately in your browser.
   - 1-Click **"Download CBT HTML"**: Produces the standalone `.html` paper ready to upload directly to our main CBT portal.

---

### Quick Start
```bash
cd /home/codespace/.gemini/antigravity-cli/scratch/CBT-Maker-Engine
npm start
# Opens studio at http://localhost:5050
```
