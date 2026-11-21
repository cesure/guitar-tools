/* Gemeinsame Demo-Logik für alle UI-Entwürfe.
   Jeder Entwurf liefert nur Markup + CSS und markiert Elemente mit data-Attributen:
   - Navigation:   [data-tab="x"]  ↔  [data-view="x"]
   - Tonfinder:    [data-t=note|string|next]
   - Metronom:     [data-m=bpm|minus|plus|range|meter|sub|dots|toggle|ramp|ramp-step|ramp-every|ramp-target|status]
   - Skalen:       [data-s=board|root|scale|shape|labels]
   Alle Texte hier sind bewusst noch hart codiert (deutsch) – i18n kommt mit der echten App. */
window.GT = (() => {
  const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'H'];
  const INTERVALS = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const SCALES = {
    'moll-penta': { name: 'Moll-Pentatonik', iv: [0, 3, 5, 7, 10] },
    'dur-penta':  { name: 'Dur-Pentatonik',  iv: [0, 2, 4, 7, 9] },
    'dur':        { name: 'Dur',             iv: [0, 2, 4, 5, 7, 9, 11] },
    'moll':       { name: 'Natürlich Moll',  iv: [0, 2, 3, 5, 7, 8, 10] },
    'harm-moll':  { name: 'Harmonisch Moll', iv: [0, 2, 3, 5, 7, 8, 11] },
    'mel-moll':   { name: 'Melodisch Moll',  iv: [0, 2, 3, 5, 7, 9, 11] },
  };
  const TUNING = [4, 11, 7, 2, 9, 4]; // e H G D A E (oben → unten wie in Tabs)
  const STRING_NAMES = ['tiefe E-Saite', 'A-Saite', 'D-Saite', 'G-Saite', 'H-Saite', 'hohe e-Saite'];
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- Segment-Buttons ---------- */
  function seg(el, items, value, onChange) {
    el.innerHTML = items.map(([v, l]) =>
      `<button type="button" data-v="${v}" class="${String(v) === String(value) ? 'active' : ''}">${l}</button>`).join('');
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      onChange(b.dataset.v);
    };
  }

  function choice(el, items, value, onChange) {
    if (el.tagName === 'SELECT') {
      el.innerHTML = items.map(([v, l]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${l}</option>`).join('');
      el.onchange = () => onChange(el.value);
    } else seg(el, items, value, onChange);
  }

  /* ---------- Griffbrett ---------- */
  // Form/Lage n: Fenster um den n-ten Skalenton auf der tiefen E-Saite (vereinfachte Box-Logik für die Demo)
  function shapeWindow(root, scale, shape) {
    if (!shape) return null;
    const iv = SCALES[scale].iv;
    let start = ((root - 4 + 12) % 12) + iv[shape - 1];
    if (start > 12) start -= 12;
    return [Math.max(0, start - 1), start + (iv.length === 5 ? 3 : 4)];
  }

  function fretboard(el, opts = {}) {
    const o = { root: 9, scale: 'moll-penta', shape: 0, labels: 'note', frets: 15, ...opts };
    const iv = SCALES[o.scale].iv;
    const win = shapeWindow(o.root, o.scale, o.shape);
    let h = '';
    TUNING.forEach((s, si) => {
      for (let f = 0; f <= o.frets; f++) {
        const n = (s + f) % 12;
        const rel = (n - o.root + 12) % 12;
        let m = '';
        if (iv.includes(rel)) {
          const dim = win && (f < win[0] || f > win[1]);
          m = `<span class="m${rel === 0 ? ' root' : ''}${dim ? ' dim' : ''}">${o.labels === 'iv' ? INTERVALS[rel] : NOTES[n]}</span>`;
        }
        h += `<div class="fb-cell f${f}" style="--sw:${(0.8 + si * 0.4).toFixed(1)}px">${m}</div>`;
      }
    });
    for (let f = 0; f <= o.frets; f++) {
      const inlay = f === 12 ? ' inlay dbl' : [3, 5, 7, 9, 15].includes(f) ? ' inlay' : '';
      h += `<div class="fb-cell lbl f${f}${inlay}"><span>${f || ''}</span></div>`;
    }
    el.classList.add('fb');
    el.style.setProperty('--frets', o.frets);
    el.innerHTML = h;
  }

  function scaleExplorer() {
    const board = $('[data-s=board]');
    if (!board) return;
    const st = { root: 9, scale: 'moll-penta', shape: 0, labels: 'note' };
    const draw = () => fretboard(board, st);
    const shapeEl = $('[data-s=shape]');
    const drawShapes = () => {
      if (!shapeEl) return;
      const n = SCALES[st.scale].iv.length;
      const word = n === 5 ? 'Form' : 'Lage';
      choice(shapeEl, [[0, 'Alle'], ...Array.from({ length: n }, (_, i) => [i + 1, `${word} ${i + 1}`])], st.shape,
        (v) => { st.shape = +v; draw(); });
    };
    if ($('[data-s=root]')) choice($('[data-s=root]'), NOTES.map((n, i) => [i, n]), st.root, (v) => { st.root = +v; draw(); });
    if ($('[data-s=scale]')) choice($('[data-s=scale]'), Object.entries(SCALES).map(([k, s]) => [k, s.name]), st.scale,
      (v) => { st.scale = v; st.shape = 0; drawShapes(); draw(); });
    if ($('[data-s=labels]')) choice($('[data-s=labels]'), [['note', 'Töne'], ['iv', 'Intervalle']], st.labels, (v) => { st.labels = v; draw(); });
    drawShapes();
    draw();
  }

  /* ---------- Tonfinder ---------- */
  function trainer() {
    const note = $('[data-t=note]');
    if (!note) return;
    const naturals = [0, 2, 4, 5, 7, 9, 11];
    const go = () => {
      note.textContent = NOTES[naturals[(Math.random() * 7) | 0]];
      const s = $('[data-t=string]');
      if (s) s.textContent = STRING_NAMES[(Math.random() * 6) | 0];
      note.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 160 });
    };
    document.querySelectorAll('[data-t=next]').forEach((b) => b.addEventListener('click', go));
  }

  /* ---------- Metronom (Demo, mit Ton & Steigerung) ---------- */
  function metronome() {
    const bpmEl = $('[data-m=bpm]');
    if (!bpmEl) return;
    let bpm = +bpmEl.textContent || 96, beats = 4, sub = 1, on = false, timer = null, i = 0, bar = 0, ctx = null;
    const dotsEl = $('[data-m=dots]');
    const range = $('[data-m=range]');
    const val = (k, d) => +($(`[data-m=${k}]`)?.value || d);
    const status = (t) => { const s = $('[data-m=status]'); if (s) s.textContent = t; };

    const setBpm = (v) => {
      bpm = Math.max(30, Math.min(260, v));
      document.querySelectorAll('[data-m=bpm]').forEach((e) => (e.textContent = bpm));
      if (range) range.value = bpm;
    };
    const drawDots = () => { if (dotsEl) dotsEl.innerHTML = Array.from({ length: beats }, (_, k) => `<i class="${k === 0 ? 'accent' : ''}"></i>`).join(''); };

    $('[data-m=minus]')?.addEventListener('click', () => setBpm(bpm - 1));
    $('[data-m=plus]')?.addEventListener('click', () => setBpm(bpm + 1));
    range?.addEventListener('input', () => setBpm(+range.value));
    if ($('[data-m=meter]')) choice($('[data-m=meter]'), [['4', '4/4'], ['3', '3/4'], ['6', '6/8']], '4', (v) => { beats = +v; i = 0; drawDots(); });
    if ($('[data-m=sub]')) choice($('[data-m=sub]'), [['1', '♩ Viertel'], ['2', '♪ Achtel'], ['4', '♬ Sechzehntel'], ['3', '³ Triolen']], '1', (v) => { sub = +v; i = 0; });

    const click = (lvl) => {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = [800, 1150, 1700][lvl];
      g.gain.setValueAtTime([0.12, 0.3, 0.45][lvl], t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.06);
    };

    const tick = () => {
      const perBar = beats * sub, pos = i % perBar, isBeat = pos % sub === 0;
      if (isBeat && dotsEl) [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === pos / sub));
      click(pos === 0 ? 2 : isBeat ? 1 : 0);
      i++;
      if (i % perBar === 0) {
        bar++;
        const ramp = $('[data-m=ramp]')?.checked;
        const target = val('ramp-target', 140), every = val('ramp-every', 4), step = val('ramp-step', 5);
        if (ramp && bar % every === 0 && bpm < target) setBpm(Math.min(target, bpm + step));
        status(`Takt ${bar} · ${bpm} BPM${ramp ? (bpm >= target ? ' · Ziel erreicht' : ` → ${target}`) : ''}`);
      }
      timer = setTimeout(tick, 60000 / bpm / sub);
    };

    document.querySelectorAll('[data-m=toggle]').forEach((btn) => btn.addEventListener('click', () => {
      on = !on;
      document.querySelectorAll('[data-m=toggle]').forEach((b) => {
        b.classList.toggle('playing', on);
        if (b.dataset.off) b.textContent = on ? b.dataset.on : b.dataset.off;
      });
      if (on) { i = 0; bar = 0; tick(); }
      else { clearTimeout(timer); dotsEl && [...dotsEl.children].forEach((d) => d.classList.remove('on')); }
    }));
    drawDots();
    setBpm(bpm);
  }

  /* ---------- Navigation ---------- */
  function tabs() {
    const btns = document.querySelectorAll('[data-tab]');
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.classList.toggle('active', x.dataset.tab === b.dataset.tab));
      document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== b.dataset.tab));
    }));
  }

  function init() { tabs(); trainer(); metronome(); scaleExplorer(); }
  return { init, fretboard, NOTES, SCALES };
})();
