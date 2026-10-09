(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const scriptElement = document.currentScript;
  const INLINE_APP_SOURCE = scriptElement && !scriptElement.src ? scriptElement.textContent : null;
  const EMBEDDED_DATA_TAG = $('#regelwerk-export-data');
  const SITE_KEY = EMBEDDED_DATA_TAG?.dataset.storageKey || 'regelwerk-static-site-v1';
  const VISITS_KEY = 'regelwerk-local-visits-v1';
  const ADMIN_TOKEN_KEY = 'regelwerk-admin-remembered-v1';
  const SOUND_KEY = 'regelwerk-ui-sounds-v1';
  const ADMIN_SALT_HEX = 'd38bbd98289b87dc0a6f4a8741e28f1a';
  const ADMIN_HASH_HEX = 'c9e05951e2862f5832971e6158bb1a5f7bb4ef58cddc02230ab1a4c3823229da';
  const ADMIN_ITERATIONS = 600000;
  const safeParse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const starter = {
    currentPage: 'start',
    pages: [{
      id: 'start', name: 'Startseite', icon: '⌂', title: 'Dein Regelwerk',
      lead: 'Ein flexibler Ort für Dokumente, Anleitungen, Geschichten und Notizen. Öffne den Admin-Modus, um Seiten und Inhalte zu gestalten.',
      sections: []
    }]
  };

  const allowedTags = new Set(['P','DIV','SPAN','BR','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','U','S','DEL','MARK','BLOCKQUOTE','UL','OL','LI','TABLE','THEAD','TBODY','TR','TH','TD','PRE','CODE','A','IMG','HR','SUB','SUP','FONT','SMALL','DL','DT','DD']);
  const dangerousTags = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','VIDEO','AUDIO','SOURCE','LINK','META','BASE']);
  const allowedFonts = new Set(['Arial','Georgia','Times New Roman','Courier New','Verdana','Tahoma','Trebuchet MS','system-ui','sans-serif','serif','monospace']);
  function cleanCssValue(property, value) {
    const v = String(value || '').trim();
    if (!v || /url\s*\(|expression|javascript:|[<>]/i.test(v)) return '';
    if (property === 'font-size') return /^(\d{1,3}(\.\d+)?)(px|pt|em|rem|%)$/.test(v) ? v : '';
    if (property === 'text-align') return /^(left|center|right|justify|start|end)$/.test(v) ? v : '';
    if (property === 'width' || property === 'max-width') return /^(auto|[1-9]\d{0,3}(px|%))$/.test(v) ? v : '';
    if (property === 'height' || property === 'max-height') return /^(auto|[1-9]\d{0,3}(px|%))$/.test(v) ? v : '';
    if (property === 'font-weight') return /^(normal|bold|bolder|lighter|[1-9]00)$/.test(v) ? v : '';
    if (property === 'font-style') return /^(normal|italic|oblique)$/.test(v) ? v : '';
    if (property === 'text-decoration' || property === 'text-decoration-line') return /^(none|(underline|line-through|overline)(\s+(underline|line-through|overline))*)$/.test(v) ? v : '';
    if (property === 'vertical-align') return /^(super|sub|baseline)$/.test(v) ? v : '';
    if (property === 'margin-left' || property === 'padding-left' || property === 'text-indent') return /^-?\d{1,3}(px|em|rem)$/.test(v) ? v : '';
    if (property === 'line-height') return /^\d(\.\d+)?$/.test(v) ? v : '';
    if (property === 'font-family') {
      const name = v.replace(/^['"]|['"]$/g, '');
      return allowedFonts.has(name) ? name : '';
    }
    if (property === 'color' || property === 'background-color') {
      return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg+-]+\)|[a-z]{3,20})$/i.test(v) ? v : '';
    }
    return '';
  }
  function sanitizeHtml(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
    function cleanNode(parent) {
      for (const node of [...parent.childNodes]) {
        if (node.nodeType === Node.COMMENT_NODE) { node.remove(); continue; }
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (dangerousTags.has(node.tagName)) { node.remove(); continue; }
        if (!allowedTags.has(node.tagName)) {
          cleanNode(node);
          node.replaceWith(...node.childNodes);
          continue;
        }
        const tag = node.tagName;
        for (const attr of [...node.attributes]) {
          const name = attr.name.toLowerCase();
          if (name === 'style') {
            const styles = [];
            for (const part of attr.value.split(';')) {
              const index = part.indexOf(':');
              if (index < 0) continue;
              const prop = part.slice(0, index).trim().toLowerCase();
              const val = cleanCssValue(prop, part.slice(index + 1));
              if (val) styles.push(`${prop}:${val}`);
            }
            if (styles.length) node.setAttribute('style', styles.join(';'));
            else node.removeAttribute('style');
          } else if (tag === 'A' && name === 'href') {
            try { const url = new URL(attr.value, location.href); if (!['http:','https:','mailto:'].includes(url.protocol)) node.removeAttribute(attr.name); else node.setAttribute('href', url.href); } catch { node.removeAttribute(attr.name); }
          } else if (tag === 'A' && ['target','rel','title'].includes(name)) {
            if (name === 'target' && attr.value !== '_blank' && attr.value !== '_self') node.removeAttribute(attr.name);
            if (name === 'rel') node.setAttribute('rel','noopener noreferrer');
          } else if (tag === 'IMG' && name === 'src') {
            if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\r\n]+$/i.test(attr.value)) node.removeAttribute(attr.name);
          } else if (tag === 'IMG' && ['alt','width','height','title'].includes(name)) {
            if (['width','height'].includes(name) && !/^\d{1,4}$/.test(attr.value)) node.removeAttribute(attr.name);
          } else if (tag === 'FONT' && ['color','face','size'].includes(name)) {
            if (name === 'color' && !cleanCssValue('color', attr.value)) node.removeAttribute(attr.name);
            if (name === 'face' && !allowedFonts.has(attr.value)) node.removeAttribute(attr.name);
            if (name === 'size' && !/^[1-7]$/.test(attr.value)) node.removeAttribute(attr.name);
          } else if (tag === 'TD' || tag === 'TH') {
            if (['colspan','rowspan'].includes(name)) { if (!/^[1-9]\d?$/.test(attr.value)) node.removeAttribute(attr.name); }
            else if (!['style'].includes(name)) node.removeAttribute(attr.name);
          } else {
            node.removeAttribute(attr.name);
          }
        }
        if (tag === 'A') { node.setAttribute('rel','noopener noreferrer'); }
        if (tag === 'IMG') { node.setAttribute('loading','lazy'); node.setAttribute('style', `${node.getAttribute('style') || ''};max-width:100%;height:auto`); }
        cleanNode(node);
      }
    }
    cleanNode(parsed.body);
    return parsed.body.innerHTML;
  }
  function plainTextToHtml(value) {
    return String(value || '').split(/\n{2,}/).map(line => `<p>${escapeHtml(line).replace(/\n/g,'<br>') || '<br>'}</p>`).join('');
  }
  function normalizeSiteData(input) {
    if (!input || !Array.isArray(input.pages) || !input.pages.length) return structuredClone(starter);
    const pages = input.pages.map((page, index) => {
      let sections;
      if (Array.isArray(page.sections)) {
        sections = page.sections.map((section, sectionIndex) => ({
          id: String(section.id || `section-${index}-${sectionIndex}`),
          title: String(section.title || `Abschnitt ${sectionIndex + 1}`),
          html: sanitizeHtml(section.html ?? section.contentHtml ?? section.content ?? plainTextToHtml(section.text || ''))
        }));
      } else {
        sections = [];
        if (page.sectionTitle || page.sectionLead) sections.push({ id:`legacy-intro-${index}`, title:String(page.sectionTitle || 'Einleitung'), html:plainTextToHtml(page.sectionLead || '') });
        (Array.isArray(page.cards) ? page.cards : []).forEach((card, cardIndex) => sections.push({ id:`legacy-card-${index}-${cardIndex}`, title:String(card.title || `Inhalt ${cardIndex + 1}`), html:plainTextToHtml(card.text || '') }));
        if (page.extraTitle || page.extraText) sections.push({ id:`legacy-extra-${index}`, title:String(page.extraTitle || 'Weitere Informationen'), html:plainTextToHtml(page.extraText || '') });
        (Array.isArray(page.extraSections) ? page.extraSections : []).forEach((section, sectionIndex) => sections.push({ id:`legacy-section-${index}-${sectionIndex}`, title:String(section.title || `Abschnitt ${sectionIndex + 1}`), html:plainTextToHtml(section.text || '') }));
      }
      const name = String(page.name || page.title || `Seite ${index + 1}`);
      return { id:String(page.id || `page-${index}-${Date.now().toString(36)}`), name, icon:String(page.icon || '◇'), title:String(page.title || name), lead:String(page.lead || ''), sections };
    });
    const currentPage = pages.some(page => page.id === input.currentPage) ? input.currentPage : pages[0].id;
    return { currentPage, pages };
  }

  const embeddedData = safeParse(EMBEDDED_DATA_TAG?.textContent, null);
  let data = normalizeSiteData(safeParse(localStorage.getItem(SITE_KEY), null) || embeddedData || starter);
  let isAdmin = false;
  let editMode = false;
  let lastEditor = null;
  let lastSelectedImage = null;
  let savedRange = null;
  let actionCallback = null;
  let soundContext = null;
  let soundsEnabled = localStorage.getItem(SOUND_KEY) !== 'false';

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  const save = () => {
    try { localStorage.setItem(SITE_KEY, JSON.stringify(data)); return true; }
    catch (error) { showNotice(error?.name === 'QuotaExceededError' ? 'Speicher voll. Verkleinere Bilder oder entferne nicht benötigte Inhalte.' : 'Lokales Speichern war nicht möglich. Exportiere zur Sicherheit ein ZIP.','error'); return false; }
  };
  const current = () => data.pages.find(page => page.id === data.currentPage) || data.pages[0];
  const multiline = value => escapeHtml(value).replace(/\n/g,'<br>');
  function showNotice(message, type = 'success') {
    const notice = $('#notice');
    notice.textContent = message;
    notice.className = `notice notice-${type}`;
    notice.hidden = false;
    playUiSound(type === 'error' ? 'error' : type === 'success' ? 'success' : 'click');
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => { notice.hidden = true; }, 4400);
  }
  const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  function playUiSound(kind = 'click') {
    if (!soundsEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      soundContext ||= new AudioCtx();
      if (soundContext.state === 'suspended') soundContext.resume();
      const now = soundContext.currentTime;
      const notes = kind === 'success' ? [660,880] : kind === 'error' ? [260,190] : kind === 'swipe' ? [350,610] : kind === 'hover' ? [680] : kind === 'type' ? [530] : [420];
      notes.forEach((frequency, index) => {
        const oscillator = soundContext.createOscillator();
        const gain = soundContext.createGain();
        const start = now + index * (kind === 'success' || kind === 'error' || kind === 'swipe' ? .055 : .0);
        const duration = kind === 'hover' ? .018 : kind === 'swipe' ? .09 : .045;
        oscillator.type = kind === 'swipe' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        if (kind === 'swipe') oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, start + duration);
        gain.gain.setValueAtTime(kind === 'hover' ? .008 : kind === 'swipe' ? .018 : .02, start);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(gain); gain.connect(soundContext.destination);
        oscillator.start(start); oscillator.stop(start + duration + .005);
      });
    } catch (_) { /* Audio is progressive enhancement and must never block the UI. */ }
  }
  function renderNav() {
    $('#pageNav').innerHTML = data.pages.map(page => `<button class="nav-item ${page.id === data.currentPage ? 'active' : ''}" type="button" data-page="${escapeHtml(page.id)}"><span class="nav-icon">${escapeHtml(page.icon || '◇')}</span><span class="nav-item-label">${escapeHtml(page.name)}</span></button>`).join('');
    $('#breadcrumbPage').textContent = current().name;
  }
  function editable(value, key, tag = 'span', cls = '') {
    return `<${tag} class="${cls} ${editMode ? 'editable' : ''}" ${editMode ? 'contenteditable="true" spellcheck="true"' : ''} data-field="${escapeHtml(key)}">${multiline(value)}</${tag}>`;
  }
  const editorToolbar = () => `
    <div class="rich-toolbar" role="toolbar" aria-label="Dokumentformatierung">
      <div class="toolbar-group" aria-label="Textformat">
        <button type="button" class="tool-btn tool-bold" data-command="bold" title="Fett (Strg+B)" aria-label="Fett"><b>B</b></button>
        <button type="button" class="tool-btn" data-command="italic" title="Kursiv (Strg+I)" aria-label="Kursiv"><i>I</i></button>
        <button type="button" class="tool-btn" data-command="underline" title="Unterstrichen (Strg+U)" aria-label="Unterstrichen"><u>U</u></button>
        <button type="button" class="tool-btn" data-command="strikeThrough" title="Durchgestrichen" aria-label="Durchgestrichen"><s>S</s></button>
        <button type="button" class="tool-btn" data-command="superscript" title="Hochgestellt" aria-label="Hochgestellt">x²</button>
        <button type="button" class="tool-btn" data-command="subscript" title="Tiefgestellt" aria-label="Tiefgestellt">x₂</button>
        <button type="button" class="tool-btn" data-command="removeFormat" title="Formatierung entfernen" aria-label="Formatierung entfernen">Tx</button>
      </div>
      <div class="toolbar-group" aria-label="Absatz und Schrift">
        <select id="blockFormat" class="tool-select" aria-label="Absatzformat" title="Absatzformat"><option value="p">Fließtext</option><option value="h1">Überschrift 1</option><option value="h2">Überschrift 2</option><option value="h3">Überschrift 3</option><option value="h4">Überschrift 4</option><option value="blockquote">Zitat</option><option value="pre">Code-Block</option></select>
        <select id="fontFamily" class="tool-select font-select" aria-label="Schriftart" title="Schriftart"><option value="system-ui">System</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times</option><option value="Courier New">Monospace</option><option value="Verdana">Verdana</option><option value="Tahoma">Tahoma</option><option value="Trebuchet MS">Trebuchet</option></select>
        <label class="font-size-wrap" title="Schriftgröße in Pixeln"><span>Größe</span><input id="fontSize" type="number" inputmode="numeric" min="8" max="96" step="1" value="16" aria-label="Schriftgröße in Pixeln"></label>
      </div>
      <div class="toolbar-group color-group" aria-label="Farben">
        <label class="color-tool" title="Schriftfarbe" aria-label="Schriftfarbe"><span>A</span><input id="textColor" type="color" value="#252838" aria-label="Schriftfarbe"></label>
        <label class="color-tool marker-tool" title="Textmarkerfarbe" aria-label="Textmarkerfarbe"><span>▰</span><input id="highlightColor" type="color" value="#fff09a" aria-label="Textmarkerfarbe"></label>
      </div>
      <div class="toolbar-group" aria-label="Listen und Ausrichtung">
        <button type="button" class="tool-btn" data-command="insertUnorderedList" title="Aufzählung" aria-label="Aufzählung">☷</button>
        <button type="button" class="tool-btn" data-command="insertOrderedList" title="Nummerierte Liste" aria-label="Nummerierte Liste">1.</button>
        <button type="button" class="tool-btn" data-command="indent" title="Einzug vergrößern" aria-label="Einzug vergrößern">⇥</button>
        <button type="button" class="tool-btn" data-command="outdent" title="Einzug verkleinern" aria-label="Einzug verkleinern">⇤</button>
        <button type="button" class="tool-btn" data-command="justifyLeft" title="Linksbündig" aria-label="Linksbündig">≡</button>
        <button type="button" class="tool-btn" data-command="justifyCenter" title="Zentriert" aria-label="Zentriert">☰</button>
        <button type="button" class="tool-btn" data-command="justifyRight" title="Rechtsbündig" aria-label="Rechtsbündig">⇥</button>
        <button type="button" class="tool-btn" data-command="justifyFull" title="Blocksatz" aria-label="Blocksatz">▤</button>
      </div>
      <div class="toolbar-group" aria-label="Inhalte einfügen">
        <select id="tableSize" class="tool-select table-select" aria-label="Tabellengröße" title="Tabellengröße"><option value="2x2">2 × 2</option><option value="3x3" selected>3 × 3</option><option value="4x3">4 × 3</option><option value="4x4">4 × 4</option><option value="5x4">5 × 4</option><option value="6x4">6 × 4</option><option value="5x5">5 × 5</option></select>
        <button type="button" class="tool-btn" data-insert="table" title="Tabelle einfügen" aria-label="Tabelle einfügen">▦</button>
        <button type="button" class="tool-btn" data-insert="image" title="Bild einfügen" aria-label="Bild einfügen">▧</button>
        <select id="imageSize" class="tool-select image-size-select" aria-label="Breite des ausgewählten Bildes" title="Ausgewähltes Bild skalieren"><option value="auto">Bildgröße</option><option value="25%">25 %</option><option value="50%">50 %</option><option value="75%">75 %</option><option value="100%">100 %</option></select>
        <button type="button" class="tool-btn" data-insert="link" title="Link einfügen" aria-label="Link einfügen">↗</button>
        <button type="button" class="tool-btn" data-insert="code" title="Code-Block einfügen" aria-label="Code-Block einfügen">&lt;/&gt;</button>
        <button type="button" class="tool-btn" data-insert="hr" title="Trennlinie" aria-label="Trennlinie einfügen">—</button>
      </div>
      <div class="toolbar-group" aria-label="Verlauf">
        <button type="button" class="tool-btn" data-command="undo" title="Rückgängig" aria-label="Rückgängig">↶</button>
        <button type="button" class="tool-btn" data-command="redo" title="Wiederholen" aria-label="Wiederholen">↷</button>
      </div>
    </div>`;

  function renderPage() {
    const page = current();
    const toolbar = isAdmin ? `<div class="edit-toolbar" aria-label="Website-Verwaltung">
      <div class="editor-heading"><span class="editor-tag">${editMode ? 'Dokument-Editor aktiv' : 'Admin-Modus'}</span><span class="editor-help">${editMode ? 'Text markieren und formatieren · Änderungen werden lokal gespeichert' : 'Verwalte Dokumentseiten und ihre Abschnitte'}</span></div>
      <div class="admin-actions"><button class="button button-quiet" type="button" id="toggleEdit">${editMode ? '✓ Bearbeitung beenden' : '✎ Dokument bearbeiten'}</button><button class="button button-quiet" type="button" id="addPage">＋ Neue Seite</button><button class="button button-quiet" type="button" id="renamePage">Seite umbenennen</button><button class="button button-quiet danger-button" type="button" id="deletePage">Seite löschen</button><button class="button button-quiet" type="button" id="addSection">＋ Abschnitt</button><button class="button button-primary" type="button" id="settingsExport">Exportieren / sichern</button><button class="button button-quiet" type="button" id="importJson">Entwurf importieren</button><button class="button button-quiet" type="button" id="resetLocal">Zurücksetzen</button><button class="button button-quiet sound-setting" type="button" id="toggleSounds" aria-pressed="${soundsEnabled}">${soundsEnabled ? '♫ Töne an' : '♪ Töne aus'}</button></div>
      ${editMode ? editorToolbar() : ''}
    </div>` : '';
    const sections = (page.sections || []).map((section, index) => `
      <section class="document-section" data-section-id="${escapeHtml(section.id)}">
        <div class="document-section-heading">${editable(section.title, `sections.${index}.title`, 'h2', 'dynamic-section-title')}
          ${isAdmin ? `<button class="section-menu-btn" type="button" data-action="rename-section" data-section-index="${index}" aria-label="Abschnitt umbenennen" title="Abschnitt umbenennen">···</button>` : ''}
        </div>
        <div class="doc-body ${editMode ? 'doc-body-editing' : ''}" data-rich-section="${index}" ${editMode ? 'contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"' : ''} aria-label="Inhalt: ${escapeHtml(section.title)}">${sanitizeHtml(section.html || '<p><br></p>')}</div>
        ${isAdmin ? `<div class="section-admin-controls"><button class="button button-quiet" type="button" data-action="rename-section" data-section-index="${index}">Abschnitt umbenennen</button><button class="button button-quiet" type="button" data-action="move-up" data-section-index="${index}" ${index===0?'disabled':''} title="Abschnitt nach oben">↑</button><button class="button button-quiet" type="button" data-action="move-down" data-section-index="${index}" ${index===page.sections.length-1?'disabled':''} title="Abschnitt nach unten">↓</button><button class="button button-quiet danger-button" type="button" data-action="delete-section" data-section-index="${index}">Abschnitt löschen</button></div>` : ''}
      </section>`).join('');
    const emptyState = page.sections.length ? '' : `<div class="empty-sections"><strong>Noch kein Inhalt auf dieser Seite</strong><p>${isAdmin ? 'Nutze „＋ Abschnitt“, um ein neues Dokumentkapitel zu erstellen.' : 'Hier wurden noch keine Inhalte veröffentlicht.'}</p></div>`;
    $('#pageCanvas').innerHTML = `${toolbar}<section class="page-hero document-hero"><div class="hero-content"><p class="eyebrow">REGELWERK · DOKUMENTE</p>${editable(page.title,'title','h1')}${editable(page.lead,'lead','p','page-lead')}</div><div class="hero-orb" aria-hidden="true"></div></section><div class="dynamic-sections" aria-label="Dokumentabschnitte">${sections}${emptyState}</div>`;
    $$('[data-field][contenteditable="true"]').forEach(element => element.addEventListener('input', () => {
      const path = element.dataset.field.split('.');
      let target = current();
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = element.innerText.replace(/\r/g,'');
      save();
    }));
    $$('.doc-body[contenteditable="true"]').forEach(editor => editor.addEventListener('input', () => {
      const index = Number(editor.dataset.richSection);
      if (!current().sections[index]) return;
      current().sections[index].html = sanitizeHtml(editor.innerHTML.replace(/\u200b/g,''));
      lastEditor = editor;
      save();
    }));
  }
  // Schreibt den aktuellen Editor-Inhalt sicher in die Daten (vor Beenden, Export, Seitenwechsel, Schließen)
  function flushEditors() {
    if (!editMode) return;
    try {
      $$('.doc-body[contenteditable="true"]').forEach(editor => { const s = current().sections[Number(editor.dataset.richSection)]; if (s) s.html = sanitizeHtml(editor.innerHTML.replace(/\u200b/g,'')); });
      $$('[data-field][contenteditable="true"]').forEach(element => { const path = element.dataset.field.split('.'); let t = current(); for (let i = 0; i < path.length - 1; i++) t = t[path[i]]; t[path[path.length - 1]] = element.innerText.replace(/\r/g,''); });
      save();
    } catch (_) {}
  }
  window.addEventListener('pagehide', flushEditors);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushEditors(); });
  function render() { renderNav(); renderPage(); }

  function hexToBytes(hex) { return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte,16))); }
  function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2,'0')).join(''); }
  async function verifyAdminPassword(value) {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
    const result = await crypto.subtle.deriveBits({name:'PBKDF2',salt:hexToBytes(ADMIN_SALT_HEX),iterations:ADMIN_ITERATIONS,hash:'SHA-256'},keyMaterial,256);
    return bytesToHex(result) === ADMIN_HASH_HEX;
  }
  function openModal(id) { const modal = $('#' + id); if (!modal) return; modal.hidden = false; const focusable = $('input:not([type=hidden]),button,select,textarea', modal); if (focusable) setTimeout(() => focusable.focus(),0); }
  function closeModal(id) { const modal = $('#' + id); if (modal) modal.hidden = true; }
  function openAdmin() {
    $('#adminModalTitle').textContent = 'Admin-Modus';
    $('#adminIntro').textContent = 'Gib das Admin-Passwort ein, um Dokumentseiten und Inhalte zu gestalten.';
    $('#confirmLabel').hidden = true; $('#adminPasswordConfirm').hidden = true;
    $('#adminSubmit').textContent = 'Admin öffnen'; $('#adminPassword').value = ''; $('#adminPasswordConfirm').value = '';
    $('#adminError').hidden = true; $('#adminError').textContent = ''; openModal('adminModal');
  }
  function openActionModal({title,description='',label='Name',placeholder='',initial='',confirmText='Speichern',danger=false,confirmOnly=false,onConfirm}) {
    actionCallback = onConfirm || null;
    $('#actionTitle').textContent = title;
    $('#actionDescription').textContent = description;
    $('#actionLabel').textContent = label;
    $('#actionInput').value = initial;
    $('#actionInput').placeholder = placeholder;
    $('#actionInputWrap').hidden = confirmOnly;
    $('#actionConfirm').textContent = confirmText;
    $('#actionConfirm').className = `button ${danger ? 'button-danger' : 'button-primary'}`;
    $('#actionError').hidden = true; $('#actionError').textContent = '';
    openModal('actionModal');
    if (!confirmOnly) $('#actionInput').focus();
  }
  $('#actionForm').addEventListener('submit', event => {
    event.preventDefault();
    const value = $('#actionInput').value.trim();
    if (!$('#actionInputWrap').hidden && !value) { $('#actionError').textContent = 'Bitte gib einen Namen oder Wert ein.'; $('#actionError').hidden = false; playUiSound('error'); return; }
    const callback = actionCallback; actionCallback = null; closeModal('actionModal');
    if (callback) callback(value);
  });
  $('#adminButton').addEventListener('click', () => {
    if (isAdmin) { isAdmin = false; editMode = false; try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch (_) {} $('#adminButton').innerHTML = '<span>◇</span> Admin-Modus'; render(); showNotice('Admin-Modus beendet.'); }
    else openAdmin();
  });
  $('#adminForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#adminSubmit'); const errorMessage = $('#adminError');
    errorMessage.hidden = true; errorMessage.textContent = ''; button.disabled = true; button.textContent = 'Prüfe Passwort …';
    try {
      if (!await verifyAdminPassword($('#adminPassword').value)) {
        errorMessage.textContent = 'Das Passwort stimmt nicht. Bitte überprüfe deine Eingabe.'; errorMessage.hidden = false;
        $('#adminPassword').setAttribute('aria-invalid','true'); $('#adminPassword').focus(); playUiSound('error'); return;
      }
      $('#adminPassword').removeAttribute('aria-invalid'); isAdmin = true; try { if ($('#adminRemember').checked) localStorage.setItem(ADMIN_TOKEN_KEY, ADMIN_HASH_HEX); else localStorage.removeItem(ADMIN_TOKEN_KEY); } catch (_) {} try { if (window.PasswordCredential && navigator.credentials && $('#adminRemember').checked) navigator.credentials.store(new PasswordCredential({ id: 'admin', name: 'Regelwerk Admin', password: $('#adminPassword').value })); } catch (_) {} closeModal('adminModal');
      $('#adminButton').innerHTML = '<span>✓</span> Admin aktiv'; render(); showNotice('Admin-Modus aktiviert. Dokumente werden lokal gespeichert.');
    } catch (_) {
      errorMessage.textContent = 'Die Passwortprüfung ist nicht verfügbar. Öffne die Website über HTTPS (z. B. GitHub Pages).'; errorMessage.hidden = false; playUiSound('error');
    } finally { button.disabled = false; button.textContent = 'Admin öffnen'; }
  });

  // Restore the editor selection after clicking a formatting control.
  document.addEventListener('focusin', event => { if (event.target.matches('.doc-body[contenteditable="true"]')) lastEditor = event.target; });
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
    const editor = anchor?.closest?.('.doc-body[contenteditable="true"]');
    if (editor) { lastEditor = editor; savedRange = selection.getRangeAt(0).cloneRange(); }
  });
  function restoreEditorSelection() {
    const editor = lastEditor && document.contains(lastEditor) ? lastEditor : $('.doc-body[contenteditable="true"]');
    if (!editor) { showNotice('Aktiviere zuerst „Dokument bearbeiten“ und wähle Text aus.','error'); return false; }
    lastEditor = editor; editor.focus();
    const selection = window.getSelection();
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(savedRange); }
    return true;
  }
  function applyInlineStyle(property, value) {
    if (!restoreEditorSelection()) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span'); span.style.setProperty(property,value); span.append(document.createTextNode('\u200b'));
      range.insertNode(span); const next = document.createRange(); next.setStart(span.firstChild,1); next.collapse(true); selection.removeAllRanges(); selection.addRange(next); savedRange = next.cloneRange(); lastEditor.focus();
    } else {
      const span = document.createElement('span'); span.style.setProperty(property,value);
      try { span.append(range.extractContents()); range.insertNode(span); selection.removeAllRanges(); const next = document.createRange(); next.selectNodeContents(span); selection.addRange(next); savedRange = next.cloneRange(); }
      catch (_) { document.execCommand('styleWithCSS',false,true); document.execCommand(property==='color'?'foreColor':'hiliteColor',false,value); }
    }
    lastEditor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
  }
  function insertHtmlAtCursor(html) {
    if (!restoreEditorSelection()) return;
    document.execCommand('insertHTML',false,sanitizeHtml(html));
    lastEditor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertHTML'}));
  }
  function insertTable() {
    const dimensions = ($('#tableSize')?.value || '3x3').split('x').map(Number); const rows = Math.min(10,Math.max(1,dimensions[0])); const cols = Math.min(10,Math.max(1,dimensions[1]));
    const html = `<table><tbody>${Array.from({length:rows},(_,r)=>`<tr>${Array.from({length:cols},(_,c)=>r===0?`<th scope="col">Kopf ${c+1}</th>`:`<td>Text</td>`).join('')}</tr>`).join('')}</tbody></table><p><br></p>`;
    insertHtmlAtCursor(html); showNotice(`Tabelle mit ${rows} Zeilen und ${cols} Spalten eingefügt.`);
  }
  function handleRichInsert(type) {
    if (type === 'table') insertTable();
    if (type === 'image') { if (!restoreEditorSelection()) return; $('#imageFile').click(); }
    if (type === 'code') insertHtmlAtCursor('<pre><code>Code hier eingeben …</code></pre><p><br></p>');
    if (type === 'hr') insertHtmlAtCursor('<hr><p><br></p>');
    if (type === 'link') {
      const selectionText = window.getSelection()?.toString() || '';
      openActionModal({title:'Link einfügen',description:'Gib eine vollständige Webadresse (https://…) oder eine E-Mail-Adresse ein.',label:'Link-Adresse',placeholder:'https://example.com',initial:'https://',confirmText:'Link einfügen',onConfirm:value=>{
        let href = value; if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) href = `mailto:${value}`;
        try { const url = new URL(href); if (!['http:','https:','mailto:'].includes(url.protocol)) throw new Error(); }
        catch { showNotice('Bitte gib eine gültige HTTPS-, HTTP- oder E-Mail-Adresse an.','error'); return; }
        if (!restoreEditorSelection()) return;
        if (selectionText) document.execCommand('createLink',false,href); else insertHtmlAtCursor(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a>`);
        lastEditor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'})); showNotice('Link eingefügt.');
      }});
    }
  }

  document.addEventListener('click', event => {
    const image = event.target.closest?.('.doc-body img');
    if (image) { lastSelectedImage = image; $$('.doc-body img.selected-for-size').forEach(item => item.classList.remove('selected-for-size')); image.classList.add('selected-for-size'); }
  });
  let lastHoverSoundAt = 0;
  document.addEventListener('pointerover', event => {
    const interactive = event.target.closest('button,a,[role="button"],select,input[type="color"],input[type="checkbox"],.nav-item,.toggle-row');
    const now = Date.now();
    if (interactive && !interactive.contains(event.relatedTarget) && now - lastHoverSoundAt > 70) { lastHoverSoundAt = now; playUiSound('hover'); }
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('button,a,[role="button"],select,input[type="color"],input[type="checkbox"],.toggle-row');
    if (target && !target.hasAttribute('data-no-sound')) playUiSound('click');
  }, true);
  document.addEventListener('paste', event => {
    const editor = event.target.closest?.('.doc-body[contenteditable="true"]');
    if (!editor) return;
    const html = event.clipboardData?.getData('text/html'); const text = event.clipboardData?.getData('text/plain');
    event.preventDefault(); lastEditor = editor;
    if (html) document.execCommand('insertHTML',false,sanitizeHtml(html));
    else document.execCommand('insertText',false,text || '');
    editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
      showNotice(editMode ? 'Dokument gespeichert.' : 'Deine lokalen Änderungen sind gespeichert.');
      return;
    }
    if (event.key === 'Escape') {
      for (const id of ['actionModal','adminModal','exportModal']) if (!$('#'+id).hidden) { closeModal(id); actionCallback=null; return; }
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
      const editor = event.target.closest?.('.doc-body[contenteditable="true"]');
      if (editor && ['b','i','u'].includes(event.key.toLowerCase())) { /* native editor shortcuts remain enabled */ }
    }
  });
  document.addEventListener('mousedown', event => {
    if (event.target.closest('.rich-toolbar button')) event.preventDefault();
  });
  document.addEventListener('click', event => {
    const commandButton = event.target.closest('[data-command]');
    if (commandButton) {
      if (!restoreEditorSelection()) return;
      const command = commandButton.dataset.command;
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(command, false, null);
      if (lastEditor) lastEditor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'formatText'}));
      return;
    }
    const insertButton = event.target.closest('[data-insert]');
    if (insertButton) { handleRichInsert(insertButton.dataset.insert); return; }
    const nav = event.target.closest('[data-page]');
    if (nav) { flushEditors(); if (data.currentPage !== nav.dataset.page) playUiSound('swipe'); data.currentPage = nav.dataset.page; save(); render(); logLocalVisit(); return; }
    const close = event.target.closest('[data-close]'); if (close) closeModal(close.dataset.close);
    if (event.target.classList?.contains('modal-backdrop') && event.target.id) { closeModal(event.target.id); actionCallback=null; }
    if (event.target.id === 'toggleEdit') {
      flushEditors(); editMode = !editMode; render();
      if (editMode) { const editor = $('.doc-body[contenteditable="true"]'); if (editor) { lastEditor=editor; editor.focus(); } }
      showNotice(editMode ? 'Editor geöffnet. Markiere Text, um ihn zu formatieren.' : 'Bearbeitung beendet. Änderungen sind gespeichert.');
    }
    if (event.target.id === 'settingsExport') { flushEditors(); refreshExportMeta(); openModal('exportModal'); }
    if (event.target.id === 'toggleSounds') { soundsEnabled=!soundsEnabled; localStorage.setItem(SOUND_KEY,String(soundsEnabled)); render(); showNotice(soundsEnabled?'Oberflächenklänge aktiviert.':'Oberflächenklänge ausgeschaltet.'); }
    if (event.target.id === 'addSection') {
      const page = current(); const section = {id:makeId('section'),title:`Abschnitt ${page.sections.length+1}`,html:'<p>Beginne hier zu schreiben …</p>'};
      page.sections.push(section); save(); editMode=true; render(); const editor=$$('.doc-body[contenteditable="true"]').at(-1); if(editor){lastEditor=editor;editor.focus();}
      showNotice('Neuer Dokumentabschnitt erstellt.');
    }
    if (event.target.id === 'addPage') openActionModal({title:'Neue Dokumentseite',description:'Erstelle eine leere Seite, ähnlich einer Dokument- oder Story-Seite.',label:'Seitentitel',placeholder:'z. B. Kapitel 1',initial:'Neue Seite',confirmText:'Seite erstellen',onConfirm:name=>{
      const page={id:makeId('page'),name,icon:'◇',title:name,lead:'',sections:[{id:makeId('section'),title:'Kapitel 1',html:'<p><br></p>'}]}; data.pages.push(page); data.currentPage=page.id; editMode=true; save(); render(); const firstEditor=$('.doc-body[contenteditable="true"]'); if(firstEditor){lastEditor=firstEditor;firstEditor.focus();} showNotice(`„${name}“ wurde erstellt. Du kannst direkt losschreiben.`);
    }});
    if (event.target.id === 'renamePage') { const page=current(); openActionModal({title:'Seite umbenennen',description:'Der neue Name erscheint in der Navigation.',label:'Seitenname',initial:page.name,confirmText:'Umbenennen',onConfirm:name=>{const oldName=page.name;page.name=name;if(!page.title||page.title===oldName)page.title=name;save();render();showNotice('Seite umbenannt.');}}); }
    if (event.target.id === 'deletePage') {
      if(data.pages.length<2){showNotice('Die letzte Seite kann nicht gelöscht werden.','error');return;}
      const page=current(); openActionModal({title:'Seite löschen?',description:`„${page.name}“ und alle ${page.sections.length} Abschnitte werden entfernt. Das lässt sich nur über einen vorherigen Export rückgängig machen.`,confirmOnly:true,confirmText:'Seite endgültig löschen',danger:true,onConfirm:()=>{data.pages=data.pages.filter(item=>item.id!==page.id);data.currentPage=data.pages[0].id;save();render();showNotice('Seite gelöscht.');}});
    }
    const actionButton=event.target.closest('[data-action]');
    if(actionButton){const index=Number(actionButton.dataset.sectionIndex);const section=current().sections[index];if(!section)return;
      if(actionButton.dataset.action==='rename-section') openActionModal({title:'Abschnitt umbenennen',description:'Gib dem Kapitel einen passenden Namen.',label:'Abschnittstitel',initial:section.title,confirmText:'Umbenennen',onConfirm:name=>{section.title=name;save();render();showNotice('Abschnitt umbenannt.');}});
      if(actionButton.dataset.action==='delete-section') openActionModal({title:'Abschnitt löschen?',description:`„${section.title}“ und sein gesamter Inhalt werden entfernt.`,confirmOnly:true,confirmText:'Abschnitt löschen',danger:true,onConfirm:()=>{current().sections.splice(index,1);save();render();showNotice('Abschnitt gelöscht.');}});
      if(actionButton.dataset.action==='move-up'&&index>0){[current().sections[index-1],current().sections[index]]=[current().sections[index],current().sections[index-1]];save();render();showNotice('Abschnitt nach oben verschoben.');}
      if(actionButton.dataset.action==='move-down'&&index<current().sections.length-1){[current().sections[index+1],current().sections[index]]=[current().sections[index],current().sections[index+1]];save();render();showNotice('Abschnitt nach unten verschoben.');}
    }
    if (event.target.id==='exportJson') exportFile('Regelwerk_Entwurf.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
    if (event.target.id==='importJson') $('#jsonFile').click();
    if (event.target.id==='resetLocal') openActionModal({title:'Lokale Inhalte zurücksetzen?',description:'Alle Seiten und Abschnitte, die Besuchsliste und die optionale Browser-ID werden aus diesem Browser entfernt. Exportiere vorher deine Daten, wenn du sie behalten möchtest.',confirmOnly:true,confirmText:'Alles zurücksetzen',danger:true,onConfirm:()=>{localStorage.removeItem(SITE_KEY);localStorage.removeItem(VISITS_KEY);data=structuredClone(starter);save();render();refreshExportMeta();showNotice('Lokale Inhalte zurückgesetzt.');}});
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'blockFormat') {
      if (!restoreEditorSelection()) return;
      document.execCommand('formatBlock', false, `<${event.target.value}>`);
      if (lastEditor) lastEditor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'formatBlock'}));
    }
    if (event.target.id === 'fontFamily') {
      if (!restoreEditorSelection()) return;
      document.execCommand('styleWithCSS',false,true); document.execCommand('fontName',false,event.target.value);
      if (lastEditor) lastEditor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'formatText'}));
    }
    if (event.target.id === 'fontSize') { const size = Math.max(8, Math.min(96, Number.parseInt(event.target.value,10) || 16)); event.target.value = String(size); applyInlineStyle('font-size',`${size}px`); }
    if (event.target.id === 'imageSize') {
      if (!lastSelectedImage || !document.contains(lastSelectedImage)) { showNotice('Klicke zuerst im Dokument auf ein Bild, das du skalieren möchtest.','error'); event.target.value='auto'; return; }
      lastSelectedImage.style.width = event.target.value === 'auto' ? 'auto' : event.target.value;
      lastSelectedImage.style.maxWidth = '100%'; lastSelectedImage.style.height = 'auto';
      const editor = lastSelectedImage.closest('.doc-body'); if (editor) editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'formatText'}));
      showNotice('Bildgröße angepasst.');
    }
    if (event.target.id === 'textColor') applyInlineStyle('color',event.target.value);
    if (event.target.id === 'highlightColor') applyInlineStyle('background-color',event.target.value);
  });

  $('#jsonFile').addEventListener('change', async event => {
    const file=event.target.files[0]; if(!file)return;
    try { const parsed=normalizeSiteData(JSON.parse(await file.text())); if(!parsed.pages.length)throw new Error('empty'); data=parsed;save();render();showNotice('Entwurf importiert.'); }
    catch { showNotice('Import fehlgeschlagen. Bitte eine gültige JSON-Exportdatei auswählen.','error'); }
    event.target.value='';
  });
  $('#imageFile').addEventListener('change', async event => {
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    if(!/^image\/(png|jpeg|gif|webp)$/.test(file.type)){showNotice('Bitte verwende ein PNG-, JPG-, GIF- oder WebP-Bild.','error');return;}
    if(file.size>2*1024*1024){showNotice('Das Bild ist größer als 2 MB. Bitte verkleinere es vor dem Einfügen.','error');return;}
    const reader=new FileReader();reader.onload=()=>{const uri=String(reader.result||'');if(!uri.startsWith('data:image/')){showNotice('Bild konnte nicht gelesen werden.','error');return;}insertHtmlAtCursor(`<p><img src="${uri}" alt="Eingefügtes Bild" style="max-width:100%;height:auto"></p>`);showNotice('Bild eingefügt und im Dokument eingebettet.');};reader.onerror=()=>showNotice('Bild konnte nicht gelesen werden.','error');reader.readAsDataURL(file);
  });

  function exportFile(name, content, type) {
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  function formatDate(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  function refreshExportMeta(){}
  function escapeScriptJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');}
  function decodeBundledSource(id) {
    const element = document.getElementById(id);
    const raw = element?.textContent?.trim();
    if (!raw) return null;
    try {
      const binary = atob(raw.replace(/\s+/g, ''));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_) { return null; }
  }
  function injectSourceBundles(html, sources) {
    html = html.replace(/<script id=\"regelwerk-source-(?:html|css|js|readme)\" type=\"application\/octet-stream\">[\s\S]*?<\/script>\s*/gi, '');
    const encode = value => { const bytes = new TextEncoder().encode(value); let binary = ''; for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(binary); };
    const tags = [['html',sources.html],['css',sources.css],['js',sources.js],['readme',sources.readme]].map(([name,content]) => `<script id=\"regelwerk-source-${name}\" type=\"application/octet-stream\">${encode(content)}</script>`).join('\n');
    return html.replace('</head>', `${tags}\n</head>`);
  }
  async function fetchPackageSources(){
    const bundled = {html:decodeBundledSource('regelwerk-source-html'),css:decodeBundledSource('regelwerk-source-css'),js:decodeBundledSource('regelwerk-source-js'),readme:decodeBundledSource('regelwerk-source-readme')};
    if (bundled.html && bundled.css && bundled.js) return {...bundled,readme:bundled.readme || '# Regelwerk\n\nWebsitepaket für GitHub Pages.\n'};
    try {
      const [htmlResponse,cssResponse,jsResponse,readmeResponse]=await Promise.all([
        fetch(new URL('./index.html',location.href),{cache:'no-store'}),fetch(new URL('./styles.css',location.href),{cache:'no-store'}),fetch(new URL('./app.js',location.href),{cache:'no-store'}),fetch(new URL('./README.md',location.href),{cache:'no-store'}).catch(()=>null)
      ]);
      if(!htmlResponse.ok||!cssResponse.ok||!jsResponse.ok)throw new Error('Quelldateien fehlen. Verwende das vollständige Regelwerk-ZIP oder öffne die Website über einen lokalen Webserver.');
      return {html:await htmlResponse.text(),css:await cssResponse.text(),js:await jsResponse.text(),readme:readmeResponse?.ok?await readmeResponse.text():'# Regelwerk\n\nWebsitepaket für GitHub Pages.\n'};
    } catch (error) {
      throw new Error(error?.message || 'Die Quelldateien konnten nicht geladen werden.');
    }
  }
  function injectDataTag(html, storageKey){
    html=html.replace(/<script id="regelwerk-export-data" type="application\/json"[\s\S]*?<\/script>\s*/i,'');
    const tag=`<script id="regelwerk-export-data" type="application/json" data-storage-key="${storageKey}">${escapeScriptJson(data)}</script>\n`;
    return html.replace('</head>',`${tag}</head>`);
  }
  function makeStandaloneHtml(sources){
    const storageKey=`regelwerk-export-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    let html=injectDataTag(sources.html,storageKey);
    html=injectSourceBundles(html,sources);
    const css=sources.css.replace(/<\/style/gi,'<\\/style');const js=sources.js.replace(/<\/script/gi,'<\\/script');
    html=html.replace(/<link rel="stylesheet" href="styles\.css">/i,`<style data-regelwerk-export-styles>\n${css}\n</style>`);
    html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>Regelwerk</title>');
    html=html.replace('<script src="app.js"></script>',`<script>\n${js}\n</script>`);
    if(html.includes('src="app.js"')||html.includes('href="styles.css"'))throw new Error('Standalone-Export konnte nicht vollständig eingebettet werden.');
    return '<!doctype html>\n'+html.replace(/^<!doctype html>\s*/i,'');
  }
  async function exportWebsite(){
    const button=$('#exportHtml');button.disabled=true;button.textContent='HTML wird erstellt …';
    try{save();const sources=await fetchPackageSources();const html=makeStandaloneHtml(sources);exportFile(`Regelwerk_${formatDate()}.html`,html,'text/html;charset=utf-8');closeModal('exportModal');showNotice('Eigenständige HTML-Datei erstellt.');}
    catch(error){showNotice(error.message||'HTML-Export fehlgeschlagen.','error');}
    finally{button.disabled=false;button.textContent='Einzelne HTML-Datei';refreshExportMeta();}
  }
  function crc32(bytes){if(!crc32.table){crc32.table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crc32.table[n]=c>>>0;}}let crc=0xffffffff;for(const byte of bytes)crc=crc32.table[(crc^byte)&0xff]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function u16(value){return [value&255,(value>>>8)&255];}
  function u32(value){return [value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255];}
  function buildZip(entries){
    const encoder=new TextEncoder();const files=entries.map(entry=>({name:encoder.encode(entry.name),data:typeof entry.content==='string'?encoder.encode(entry.content):entry.content}));
    const localParts=[];const centralParts=[];let offset=0;const now=new Date();const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2);const dosDate=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    for(const file of files){const crc=crc32(file.data);const local=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(file.data.length),...u32(file.data.length),...u16(file.name.length),...u16(0)];localParts.push(new Uint8Array(local),file.name,file.data);
      const central=[...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(file.data.length),...u32(file.data.length),...u16(file.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)];centralParts.push(new Uint8Array(central),file.name);offset+=local.length+file.name.length+file.data.length;}
    const centralSize=centralParts.reduce((sum,part)=>sum+part.length,0);const centralOffset=offset;const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  }
  async function exportZipPackage(){
    const button=$('#exportZip');button.disabled=true;button.textContent='ZIP wird erstellt …';
    try{
      save();const sources=await fetchPackageSources();const storageKey=`regelwerk-export-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;let html=injectDataTag(sources.html,storageKey);html=injectSourceBundles(html,sources);
      const readme=`# Regelwerk\n\n## Website veröffentlichen\n1. Entpacke dieses Archiv.\n2. Lade **index.html**, **app.js**, **styles.css**, **README.md** und **.nojekyll** gemeinsam in den Veröffentlichungsordner deines GitHub-Pages-Repositories.\n3. Öffne die veröffentlichte Seite und melde dich im Admin-Modus an, um Dokumentseiten und Abschnitte zu bearbeiten.\n\n## Funktionen\n- Mehrere Dokumentseiten und Kapitel, lokale Speicherung im Browser\n- Formatierbarer Text mit Schriftart/-größe/-farbe, Textmarker, Tabellen, Listen, Zitaten, Links, Code-Blöcken und eingebetteten Bildern\n- Lokale ZIP- und HTML-Exporte\n- Responsive Bedienoberfläche und optionale Oberflächenklänge\n\n## Hinweis zur Speicherung\nSeitenänderungen werden lokal im Browser gespeichert. Wenn du in einem anderen Browser arbeitest oder Site-Dateien neu veröffentlichst, exportiere vorher ein ZIP, damit die aktuellen Inhalte darin eingebettet sind. Ein statisches GitHub-Pages-Projekt synchronisiert keine Bearbeitungen zwischen verschiedenen Besuchern.\n`;
      const blob=buildZip([{name:'index.html',content:html},{name:'app.js',content:sources.js},{name:'styles.css',content:sources.css},{name:'README.md',content:readme},{name:'.nojekyll',content:''}]);
      const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`Regelwerk_Website_${formatDate()}.zip`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);closeModal('exportModal');showNotice('Website-ZIP erstellt. Enthalten sind die Website-Dateien und deine aktuellen Dokumente; Export funktioniert auch nach dem Entpacken lokal.');
    }catch(error){showNotice(error.message||'ZIP-Export fehlgeschlagen.','error');}
    finally{button.disabled=false;button.textContent='Website als ZIP herunterladen';refreshExportMeta();}
  }
  $('#exportHtml').addEventListener('click',exportWebsite);$('#exportZip').addEventListener('click',exportZipPackage);

  function logLocalVisit(){}

  // Touch gestures change documents only when a horizontal swipe is intentional.
  let touchStart=null;
  document.addEventListener('touchstart',event=>{const target=event.target;if(target.closest('input,textarea,select,button,.doc-body[contenteditable="true"]')){touchStart=null;return;}const touch=event.changedTouches[0];touchStart={x:touch.clientX,y:touch.clientY};},{passive:true});
  document.addEventListener('touchend',event=>{if(!touchStart)return;const touch=event.changedTouches[0];const dx=touch.clientX-touchStart.x,dy=touch.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)<95||Math.abs(dy)>65)return;const index=data.pages.findIndex(page=>page.id===data.currentPage);const next=data.pages[index+(dx<0?1:-1)];if(next){data.currentPage=next.id;save();render();logLocalVisit();playUiSound('swipe');}}, {passive:true});

  // ===== Globale Seitensuche (alle Seiten, relevanzsortiert, Sprung + Hervorhebung) =====
  const SEARCH_BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,td,th,div';
  const foldText = value => { let out = ''; for (const ch of String(value)) { const f = ch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); out += f.length === ch.length ? f : ch; } return out; };
  const isWordChar = ch => !!ch && /[\p{L}\p{N}]/u.test(ch);
  // Fügt Textteile zusammen, faltet Groß-/Kleinschreibung und Akzente und reduziert Leerraum; optional mit Zeichen-Zuordnung.
  function buildSearchText(parts, wantMap) {
    let plain = '', folded = ''; const map = wantMap ? [] : null; let lastSpace = false;
    parts.forEach((part, partIndex) => {
      let offset = 0;
      for (const ch of String(part)) {
        const isSpace = /\s/.test(ch);
        if (isSpace) { if (!lastSpace) { plain += ' '; folded += ' '; if (map) map.push({ part: partIndex, offset }); } lastSpace = true; }
        else { const f = foldText(ch); plain += ch; folded += f; if (map) for (let k = 0; k < f.length; k++) map.push({ part: partIndex, offset }); lastSpace = false; }
        offset += ch.length;
      }
    });
    return { plain, folded, map };
  }
  function groupTextBlocks(root) {
    const groups = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let owner = node.parentElement ? node.parentElement.closest(SEARCH_BLOCKS) : null;
      if (!owner || !root.contains(owner)) owner = root;
      if (!groups.has(owner)) groups.set(owner, []);
      groups.get(owner).push(node);
    }
    return [...groups.values()].filter(nodes => nodes.some(n => /\S/.test(n.data)));
  }
  function findOccurrences(folded, query) {
    const result = []; if (!query) return result;
    const startsWord = isWordChar(query[0]), endsWord = isWordChar(query[query.length - 1]);
    let from = 0, idx;
    while ((idx = folded.indexOf(query, from)) !== -1) {
      const end = idx + query.length;
      const startOk = !startsWord || idx === 0 || !isWordChar(folded[idx - 1]);
      const endOk = !endsWord || end >= folded.length || !isWordChar(folded[end]);
      result.push({ idx, tier: startOk ? (endOk ? 2 : 1) : 3 });
      from = idx + 1;
    }
    return result;
  }
  let searchIndex = null, searchResults = [], searchActive = -1, searchQuery = '';
  function buildSearchIndex() {
    const entries = [];
    data.pages.forEach((page, pageOrder) => {
      const add = (kind, sIdx, bIdx, label, text) => { const t = buildSearchText([text], false); if (t.plain.trim()) entries.push({ pageId: page.id, pageName: page.name, pageOrder, kind, sIdx, bIdx, label, plain: t.plain, folded: t.folded }); };
      add('title', -1, 0, 'Seitentitel', page.title);
      add('lead', -1, 0, 'Einleitung', page.lead);
      (page.sections || []).forEach((section, sIdx) => {
        add('stitle', sIdx, 0, section.title || 'Abschnitt', section.title);
        const body = new DOMParser().parseFromString(sanitizeHtml(section.html || ''), 'text/html').body;
        groupTextBlocks(body).forEach((nodes, bIdx) => add('body', sIdx, bIdx, section.title || 'Abschnitt', nodes.map(n => n.data).join('')));
      });
    });
    searchIndex = entries;
  }
  function runSearch(raw) {
    const query = buildSearchText([raw.trim()], false).folded;
    searchQuery = query;
    if (!query) return [];
    if (!searchIndex) buildSearchIndex();
    const hits = [];
    for (const entry of searchIndex) {
      const occ = findOccurrences(entry.folded, query);
      if (!occ.length) continue;
      const best = occ.reduce((a, b) => b.tier < a.tier ? b : a);
      hits.push({ entry, tier: best.tier, idx: best.idx, len: query.length });
    }
    const currentId = data.currentPage;
    hits.sort((a, b) => a.tier - b.tier || (b.entry.pageId === currentId) - (a.entry.pageId === currentId) || a.entry.pageOrder - b.entry.pageOrder);
    return hits;
  }
  function renderSearchPanel() {
    const panel = $('#searchPanel'); const raw = $('#globalSearch').value;
    if (!raw.trim()) { panel.hidden = true; panel.innerHTML = ''; searchResults = []; return; }
    searchResults = runSearch(raw); searchActive = -1;
    const LIMIT = 400, shown = searchResults.slice(0, LIMIT);
    const titles = { 1: 'Wortanfänge', 2: 'Exakte Worttreffer', 3: 'Teiltreffer' };
    let html = '', lastTier = 0;
    shown.forEach((hit, i) => {
      if (hit.tier !== lastTier) { lastTier = hit.tier; html += `<div class="search-group">${titles[hit.tier]} · ${searchResults.filter(h => h.tier === hit.tier).length}</div>`; }
      const text = hit.entry.plain, start = Math.max(0, hit.idx - 60), end = Math.min(text.length, hit.idx + hit.len + 90);
      const snippet = (start > 0 ? '… ' : '') + escapeHtml(text.slice(start, hit.idx)) + '<mark>' + escapeHtml(text.slice(hit.idx, hit.idx + hit.len)) + '</mark>' + escapeHtml(text.slice(hit.idx + hit.len, end)) + (end < text.length ? ' …' : '');
      html += `<button type="button" class="search-result" role="option" data-sr="${i}"><span class="sr-where">${escapeHtml(hit.entry.pageName)} · ${escapeHtml(hit.entry.label)}</span><span class="sr-text">${snippet}</span></button>`;
    });
    if (!shown.length) html = '<div class="search-empty">Keine Treffer auf diesen Seiten.</div>';
    else if (searchResults.length > LIMIT) html += `<div class="search-more">${searchResults.length - LIMIT} weitere Treffer – Suchbegriff eingrenzen.</div>`;
    panel.innerHTML = html; panel.hidden = false; panel.scrollTop = 0;
  }
  function closeSearchPanel() { const p = $('#searchPanel'); if (p) p.hidden = true; }
  function setSearchActive(next) {
    const buttons = $$('#searchPanel .search-result'); if (!buttons.length) return;
    searchActive = (next + buttons.length) % buttons.length;
    buttons.forEach((b, i) => b.classList.toggle('active', i === searchActive));
    buttons[searchActive].scrollIntoView({ block: 'nearest' });
  }
  let searchHitTimer = null;
  function clearSearchHit() {
    clearTimeout(searchHitTimer);
    if (window.CSS && CSS.highlights) CSS.highlights.delete('search-hit');
    $$('.search-hit-wrap').forEach(span => { const parent = span.parentNode; if (!parent) return; while (span.firstChild) parent.insertBefore(span.firstChild, span); span.remove(); parent.normalize(); });
  }
  function highlightSearchHit(hit) {
    const e = hit.entry; let host = null, nodes = null;
    if (e.kind === 'title') host = $('#pageCanvas [data-field="title"]');
    else if (e.kind === 'lead') host = $('#pageCanvas [data-field="lead"]');
    else if (e.kind === 'stitle') host = $(`#pageCanvas [data-field="sections.${e.sIdx}.title"]`);
    else { const body = $(`#pageCanvas .doc-body[data-rich-section="${e.sIdx}"]`); const groups = body ? groupTextBlocks(body) : []; nodes = groups[e.bIdx]; host = body; }
    if (!host) return;
    if (!nodes) nodes = groupTextBlocks(host).flat();
    if (!nodes || !nodes.length) return;
    const built = buildSearchText(nodes.map(n => n.data), true);
    const occ = findOccurrences(built.folded, searchQuery);
    const pick = occ.find(o => o.tier === hit.tier) || occ[0];
    if (!pick) return;
    const a = built.map[pick.idx], z = built.map[Math.min(pick.idx + searchQuery.length, built.map.length) - 1];
    if (!a || !z) return;
    const range = document.createRange();
    range.setStart(nodes[a.part], a.offset); range.setEnd(nodes[z.part], Math.min(nodes[z.part].data.length, z.offset + 1));
    clearSearchHit();
    (range.startContainer.parentElement || host).scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (window.CSS && CSS.highlights && window.Highlight) CSS.highlights.set('search-hit', new Highlight(range));
    else { try { const span = document.createElement('span'); span.className = 'search-hit-wrap'; range.surroundContents(span); } catch (_) { /* Hervorhebung ist optional */ } }
    searchHitTimer = setTimeout(clearSearchHit, 3200);
  }
  function jumpToSearchHit(hit) {
    closeSearchPanel();
    if (data.currentPage !== hit.entry.pageId) { playUiSound('swipe'); data.currentPage = hit.entry.pageId; save(); render(); logLocalVisit(); }
    setTimeout(() => highlightSearchHit(hit), 60);
  }
  (function initGlobalSearch() {
    const input = $('#globalSearch'); if (!input) return;
    input.addEventListener('focus', () => { buildSearchIndex(); if (input.value.trim()) renderSearchPanel(); });
    input.addEventListener('input', () => { if (!searchIndex) buildSearchIndex(); renderSearchPanel(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { closeSearchPanel(); input.blur(); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); setSearchActive(searchActive + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setSearchActive(searchActive - 1); }
      else if (event.key === 'Enter') { event.preventDefault(); const hit = searchResults[searchActive >= 0 ? searchActive : 0]; if (hit) jumpToSearchHit(hit); }
      event.stopPropagation();
    });
    $('#searchPanel').addEventListener('click', event => { const button = event.target.closest('[data-sr]'); if (button) jumpToSearchHit(searchResults[Number(button.dataset.sr)]); });
    document.addEventListener('click', event => { if (!event.target.closest('#pageSearch')) closeSearchPanel(); });
  })();

  // Alte Cookie-/Statistik-Reste entfernen und gemerkten Admin-Login wiederherstellen
  try { ['regelwerk-static-consent-v1','regelwerk-local-visits-v1','regelwerk-browser-id-v1'].forEach(k => localStorage.removeItem(k)); document.cookie = 'regelwerk_browser_id=; Max-Age=0; Path=/; SameSite=Lax'; } catch (_) {}
  try { if (localStorage.getItem(ADMIN_TOKEN_KEY) === ADMIN_HASH_HEX) { isAdmin = true; $('#adminButton').innerHTML = '<span>✓</span> Admin aktiv'; } } catch (_) {}
  $('#year').textContent=new Date().getFullYear();render();
})();
