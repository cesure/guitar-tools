<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import Seg from './Seg.svelte';
  import MicPanel from './MicPanel.svelte';
  import { audio, pluck } from '../lib/audio';
  import { load, oneOf, save } from '../lib/storage';
  import { PitchListener, type Pitch } from '../lib/pitch';
  import { NATURALS, NOTE_NAMES, STRING_LABELS, TUNING, midiToFreq } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, mic, lang, settingsHref }: { t: Messages['finder']; mic: Messages['mic']; lang: Lang; settingsHref: string } = $props();

  const names = $derived(NOTE_NAMES[lang]);
  const strLabels = $derived(STRING_LABELS[lang]);
  const settings = $state(
    load('gt-finder', {
      strings: [true, true, true, true, true, true],
      all12: false,
      mode: 'one' as 'one' | 'all',
      length: 10,
      breather: 'normal' as 'short' | 'normal' | 'key',
      successSound: true,
    }, (v) => ({
      ...v,
      mode: oneOf(v.mode, ['one', 'all'] as const, 'one'),
      length: oneOf(v.length, [5, 10, 20, 0], 10),
      breather: oneOf(v.breather, ['short', 'normal', 'key'] as const, 'normal'),
      strings: v.strings.map(Boolean),
    })),
  );
  $effect(() => save('gt-finder', settings));

  /* ================= Ablauf ================= */
  type Phase = 'idle' | 'countdown' | 'search' | 'breather' | 'summary';
  let phase = $state<Phase>('idle');
  let paused = $state(false);
  let countdown = $state(3);
  const inRound = $derived(phase === 'countdown' || phase === 'search' || phase === 'breather');

  let note = $state(0);
  let string = $state(0); // Modus „Eine Saite“
  let step = $state(0); // Modus „Alle Saiten“: aktuelle Saite (0 = tiefe E)
  let found = $state<(number | null)[]>(Array(6).fill(null));
  let done = $state(0); // fertige Töne in dieser Runde
  const activeString = $derived(settings.mode === 'one' ? string : step);

  /** Bund des Tons auf einer Saite (0–11); Bund 12 zählt wie 0. */
  const fretOf = (s: number, n: number) => (n - (TUNING[s] % 12) + 12) % 12;
  const targetMidis = (s: number, n: number) => {
    const f = fretOf(s, n);
    return f === 0 ? [TUNING[s], TUNING[s] + 12] : [TUNING[s] + f];
  };

  /* ================= Uhr: läuft nur, solange gesucht wird ================= */
  let elapsedMs = $state(0);
  let targetMs = 0;
  let segStart = $state(0);
  let nowTick = $state(0);
  const liveMs = $derived(elapsedMs + (segStart ? Math.max(0, nowTick - segStart) : 0));
  const startClock = () => (segStart = performance.now());
  function stopClock() {
    if (!segStart) return;
    const d = performance.now() - segStart;
    elapsedMs += d;
    targetMs += d;
    segStart = 0;
  }

  /* ================= Statistik ================= */
  let hits = $state(0);
  let mistakes = $state(0);
  let results: { label: string; ms: number }[] = [];
  let summary = $state<{ total: number; avg: number; slowest: string; best: number | null; newBest: boolean; complete: boolean } | null>(null);
  const bestKey = $derived(`${settings.mode}-${settings.length}-${settings.all12 ? 12 : 7}`);

  /* ================= Rückmeldungen ================= */
  let hitInfo = $state<string | null>(null);
  let wrongMsg = $state<string | null>(null);
  let shake = $state(false);
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
  let breatherTimer: ReturnType<typeof setTimeout> | null = null;

  function startRound() {
    if (settings.mode === 'one' && !settings.strings.some(Boolean)) return;
    hits = 0;
    mistakes = 0;
    done = 0;
    elapsedMs = 0;
    results = [];
    summary = null;
    paused = false;
    phase = 'countdown';
    countdown = 3;
    const tick = () => {
      if (phase !== 'countdown') return;
      if (countdown > 1) {
        countdown--;
        later(tick, 650);
      } else newTarget();
    };
    later(tick, 650);
  }

  function newTarget() {
    const pool = settings.all12 ? [...Array(12).keys()] : NATURALS;
    const strs = settings.strings.flatMap((on, i) => (on ? [i] : []));
    let n: number;
    let s = string;
    do {
      n = pool[(Math.random() * pool.length) | 0];
      if (settings.mode === 'one') s = strs[(Math.random() * strs.length) | 0];
    } while (done > 0 && n === note && (settings.mode === 'all' || s === string) && pool.length > 1);
    note = n;
    string = s;
    step = 0;
    found = Array(6).fill(null);
    targetMs = 0;
    hitInfo = null;
    wrongMsg = null;
    lastWrong = -1;
    stable = 0;
    targetSince = performance.now();
    phase = 'search';
    if (!paused) startClock();
  }

  /** Richtiger Ton – per Mikrofon oder „Gefunden“. */
  function hit() {
    if (phase !== 'search' || paused) return;
    stopClock();
    hits++;
    const s = activeString;
    const fret = fretOf(s, note);
    results.push({ label: `${names[note]} · ${strLabels[s]}`, ms: targetMs });
    targetMs = 0;
    successSound();
    // „leere tiefen E-Saite“ wäre falsch → bei leeren Saiten nur „E-Saite“ / „e-Saite“
    const stringName = fret === 0 ? t.stringNames[s].replace(/^(tiefen|hohen|low|high) /, '') : t.stringNames[s];
    hitInfo = (fret === 0 ? t.foundOpen : t.foundAt).replace('{note}', names[note]).replace('{fret}', String(fret)).replace('{string}', stringName);

    if (settings.mode === 'all') {
      found[s] = fret;
      if (step < 5) {
        step++;
        stable = 0;
        lastWrong = -1;
        targetSince = performance.now();
        startClock();
        return;
      }
      hitInfo = t.allFound;
    } else {
      found = found.map((f, i) => (i === s ? fret : null));
    }
    done++;
    phase = 'breather';
    if (settings.breather !== 'key') breatherTimer = setTimeout(advance, settings.breather === 'short' ? 1000 : 2500);
  }

  function advance() {
    if (breatherTimer) clearTimeout(breatherTimer);
    breatherTimer = null;
    if (settings.length && done >= settings.length) finish();
    else newTarget();
  }

  /** Runde vorzeitig beenden: mit Ergebnis, wenn schon etwas gefunden wurde, sonst zurück zum Start. */
  function stopRound() {
    timers.forEach(clearTimeout);
    timers = [];
    if (hits === 0) {
      stopClock();
      if (breatherTimer) clearTimeout(breatherTimer);
      breatherTimer = null;
      paused = false;
      hitInfo = null;
      wrongMsg = null;
      phase = 'idle';
    } else finish();
  }

  function finish() {
    stopClock();
    if (breatherTimer) clearTimeout(breatherTimer);
    paused = false;
    const total = elapsedMs;
    const slowest = results.reduce((a, b) => (b.ms > a.ms ? b : a), { label: '–', ms: 0 });
    const bests = load<Record<string, number>>('gt-finder-best', {});
    const prev = bests[bestKey] ?? null;
    const complete = settings.length > 0 && done >= settings.length;
    const newBest = complete && (prev === null || total < prev);
    if (newBest) save('gt-finder-best', { ...bests, [bestKey]: total });
    summary = { total, avg: done ? total / done : 0, slowest: slowest.label, best: newBest ? total : prev, newBest, complete };
    phase = 'summary';
  }

  function togglePause() {
    if (phase !== 'search' && phase !== 'breather') return;
    if (!paused) {
      paused = true;
      stopClock();
      if (breatherTimer) clearTimeout(breatherTimer);
      breatherTimer = null;
    } else {
      paused = false;
      if (phase === 'search') startClock();
      else advance();
    }
  }

  /* ================= Klänge ================= */
  /** Bis dahin ignoriert das Mikrofon Töne (eigener Lautsprecher klingt nach). */
  let deafUntil = 0;
  function listen() {
    pluck(midiToFreq(targetMidis(activeString, note)[0]));
    deafUntil = performance.now() + 2600;
  }
  function successSound() {
    if (!settings.successSound) return;
    const ac = audio();
    [1318.5, 1760].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const t0 = ac.currentTime + i * 0.09;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + 0.3);
    });
    deafUntil = performance.now() + 450;
  }

  /* ================= Mikrofon ================= */
  let micOn = $state(false);
  let heard = $state<Pitch | null>(null);
  let stable = 0;
  let stableMidi = -1;
  let lastWrong = -1;
  let silence = 0;

  /** Zeitpunkt, ab dem die aktuelle Aufgabe (bzw. Saite) gilt – nur danach angeschlagene Töne zählen */
  let targetSince = 0;
  /** Wurde der gehörte Ton nach Beginn der aktuellen Aufgabe angeschlagen? (nicht nur nachklingend) */
  const freshAttack = (p: Pitch) => p.sinceAttack <= performance.now() - targetSince;

  const listener = new PitchListener((p) => {
    heard = p && performance.now() >= deafUntil ? p : null;
    if (!heard) {
      stable = 0;
      if (++silence > 6) lastWrong = -1; // nach ~0,3 s Stille zählt derselbe falsche Ton wieder
      return;
    }
    silence = 0;
    // Nur neu angeschlagene Töne zählen – ein nachklingender Ton der vorigen Saite
    // (gleiche Tonhöhe gibt es oft auf mehreren Saiten) löst sonst gleich den nächsten Treffer aus.
    if (phase !== 'search' || paused || Math.abs(heard.cents) > 40 || !freshAttack(heard)) {
      stable = 0;
      return;
    }
    stable = heard.midi === stableMidi ? stable + 1 : 1;
    stableMidi = heard.midi;
    if (targetMidis(activeString, note).includes(heard.midi)) {
      if (stable === 3) hit(); // ~150 ms stabil
    } else if (stable === 8 && heard.clarity >= 0.9 && heard.sinceAttack < 1500 && heard.midi !== lastWrong) {
      // Fehler nur bei klarem, angeschlagenem Ton, der ~0,4 s klingt –
      // Berühren, Abdämpfen oder Mitschwingen zählen nicht
      lastWrong = heard.midi;
      mistakes++;
      wrongMsg = t.wrong.replace('{heard}', `${names[heard.midi % 12]}${Math.floor(heard.midi / 12) - 1}`).replace('{target}', names[note]);
      shake = true;
      later(() => (shake = false), 450);
      later(() => (wrongMsg = null), 1800);
    }
  });

  /** Live-Anzeige: wie weit liegt der gehörte Ton vom gesuchten entfernt? */
  const direction = $derived.by(() => {
    if (!heard || phase !== 'search' || paused || heard.clarity < 0.8 || !freshAttack(heard)) return null;
    const targets = targetMidis(activeString, note);
    const target = targets.reduce((a, b) => (Math.abs(b - heard!.midi) < Math.abs(a - heard!.midi) ? b : a));
    const diff = heard.midi - target + heard.cents / 100;
    const semis = heard.midi - target;
    const sameNote = heard.midi % 12 === note;
    let text: string;
    if (semis === 0) text = '✓';
    else if (sameNote) text = t.octave;
    else text = `${semis > 0 ? t.tooHigh : t.tooLow} · ${Math.abs(semis)} ${Math.abs(semis) === 1 ? t.semi : t.semis}`;
    return { pos: Math.max(-6, Math.min(6, diff)), text, ok: semis === 0, label: `${names[heard.midi % 12]}${Math.floor(heard.midi / 12) - 1}` };
  });

  /* ================= Tastatur & Uhr ================= */
  function onkeydown(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') {
      e.preventDefault();
      if (paused) togglePause();
      else if (phase === 'idle' || phase === 'summary') startRound();
      else if (phase === 'search') hit();
      else if (phase === 'breather') advance();
    } else if (k === 'p') togglePause();
    else if (k === 'escape' && inRound) stopRound();
    else if (k === 'r' && (phase === 'search' || phase === 'breather')) listen();
  }

  let clock: ReturnType<typeof setInterval>;
  onMount(() => (clock = setInterval(() => (nowTick = performance.now()), 100)));
  onDestroy(() => {
    clearInterval(clock);
    timers.forEach(clearTimeout);
    if (breatherTimer) clearTimeout(breatherTimer);
  });

  const fmt = (ms: number) => {
    const sec = ms / 1000;
    const m = Math.floor(sec / 60);
    const rest = (sec % 60).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return m ? `${m}:${(sec % 60 < 10 ? '0' : '') + rest}` : `${rest} s`;
  };

  /* Mini-Griffbrett (Bund 0–12, hohe e-Saite oben) */
  const FW = 22.5;
  const fx = (f: number) => (f === 0 ? 10 : 22 + (f - 0.5) * FW);
  const sy = (s: number) => 10 + (5 - s) * 13;
</script>

<svelte:window {onkeydown} />

<div class="grid2">
  <div class="card stage" class:hit={phase === 'breather' && !paused} class:shake>
    <!-- Kopfzeile: Fortschritt, Uhr, Fehler -->
    <div class="topbar">
      <span>
        {#if inRound}
          {@const n = phase === 'breather' ? done : done + 1}
          {settings.length
            ? t.progress.replace('{n}', String(Math.max(1, Math.min(n, settings.length)))).replace('{total}', String(settings.length))
            : t.progressEndless.replace('{n}', String(Math.max(1, n)))}
        {/if}
      </span>
      <span class="clock" class:off={!segStart}>{inRound || phase === 'summary' ? `⏱ ${fmt(liveMs)}` : ''}</span>
      <span class="miss">{inRound && micOn ? `✗ ${mistakes}` : ''}</span>
    </div>

    {#if phase === 'summary' && summary}
      <div class="summary">
        <h2>{summary.complete ? t.summary : t.summaryStopped}</h2>
        {#if summary.newBest}<div class="badge">🏆 {t.newBest}</div>{/if}
        <div class="sgrid">
          <div><strong>{fmt(summary.total)}</strong><span>{t.time}</span></div>
          <div><strong>{fmt(summary.avg)}</strong><span>{t.avg}</span></div>
          {#if micOn || mistakes}
            <div><strong>{mistakes}</strong><span>{t.mistakes}</span></div>
            <div><strong>{Math.round((hits / Math.max(1, hits + mistakes)) * 100)} %</strong><span>{t.hitRate}</span></div>
          {/if}
          <div><strong class="small">{summary.slowest}</strong><span>{t.slowest}</span></div>
          {#if summary.best !== null}<div><strong>{fmt(summary.best)}</strong><span>{t.best}</span></div>{/if}
        </div>
        <button class="btn big" onclick={startRound}>{t.again}</button>
      </div>
    {:else}
      <div class="note" aria-live="polite">
        {#if phase === 'countdown'}
          {#key countdown}<span class="count" in:scale={{ start: 1.4, duration: 250 }}>{countdown}</span>{/key}
        {:else if phase === 'idle'}
          <span class="q">?</span>
        {:else}
          {#key `${note}-${string}-${done}`}<span in:scale={{ start: 0.92, duration: 160 }}>{names[note]}</span>{/key}
        {/if}
        {#if phase === 'breather' && !paused}
          <span class="check" in:scale={{ start: 0.4, duration: 220 }}>✓</span>
        {/if}
      </div>

      <p class="task">
        {#if phase === 'idle'}{t.idle}
        {:else if phase === 'countdown'}{t.countdown}
        {:else if settings.mode === 'one'}{t.on} <b>{t.stringNames[string]}</b>
        {:else}{t.allTask}{/if}
      </p>

      {#if settings.mode === 'all' && (phase === 'search' || phase === 'breather')}
        <div class="steps">
          {#each strLabels as label, i}
            <div class="stepchip" class:now={i === step && phase === 'search'} class:done={found[i] !== null}>
              <strong>{label}</strong><span>{found[i] !== null ? found[i] : ''}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if phase === 'search' || phase === 'breather'}
        <svg class="mini" viewBox="0 0 300 86" aria-hidden="true">
          <rect x="22" y="4" width={12 * FW} height="78" rx="3" class="wood" />
          {#each [3, 5, 7, 9] as f}<circle cx={fx(f)} cy="43" r="3" class="inlay" />{/each}
          <circle cx={fx(12)} cy="30" r="3" class="inlay" /><circle cx={fx(12)} cy="56" r="3" class="inlay" />
          {#each Array(13) as _, k}<line x1={22 + k * FW} x2={22 + k * FW} y1="4" y2="82" class="fret" class:nut={k === 0} />{/each}
          {#each Array(6) as _, s}
            <line x1="22" x2={22 + 12 * FW} y1={sy(s)} y2={sy(s)} class="str" class:active={s === activeString && phase === 'search'} />
          {/each}
          {#each found as f, s}
            {#if f !== null}<circle cx={fx(f)} cy={sy(s)} r="5.5" class="dot" in:scale={{ duration: 200 }} />{/if}
          {/each}
        </svg>
      {/if}

      <!-- Rückmeldung: gefunden / falsch / zu hoch–tief -->
      <div class="feedback">
        {#if paused}
          <p class="info">⏸ {t.paused}</p>
        {:else if phase === 'breather' || (settings.mode === 'all' && hitInfo && phase === 'search' && !direction && !wrongMsg)}
          <p class="good">✓ {hitInfo}</p>
          {#if phase === 'breather' && settings.breather === 'key'}<p class="info small">{t.nextHint}</p>{/if}
        {:else if wrongMsg}
          <p class="bad">✗ {wrongMsg}</p>
        {:else if direction && phase === 'search'}
          <div class="dir" class:ok={direction.ok}>
            <div class="scale">
              <span class="tick center"></span>
              <span class="marker" style:left="{50 + (direction.pos / 6) * 50}%"></span>
            </div>
            <p><b>{direction.label}</b> · {direction.text}</p>
          </div>
        {:else if phase === 'search' && micOn}
          <p class="info">{t.listening}</p>
        {/if}
      </div>

      <div class="row" style="justify-content:center">
        {#if phase === 'idle'}
          <button class="btn big" onclick={startRound}>{t.start}</button>
        {:else if paused}
          <button class="btn" onclick={togglePause}>▶ {t.resume}</button>
        {:else if phase === 'search'}
          <button class="btn" onclick={hit}>{t.found}</button>
          <button class="btn ghost" onclick={listen}>{t.listen}</button>
          <button class="btn ghost" onclick={togglePause} aria-label={t.pause}>⏸</button>
        {:else if phase === 'breather'}
          <button class="btn" onclick={advance}>{t.next} →</button>
          <button class="btn ghost" onclick={togglePause} aria-label={t.pause}>⏸</button>
        {/if}
        {#if inRound}
          <button class="btn ghost" onclick={stopRound}>■ {t.stop}</button>
        {/if}
      </div>
      <p class="keys">{t.keys}</p>
    {/if}
  </div>

  <div class="card side">
    <div class="label">{t.mic}</div>
    <MicPanel {listener} t={mic} {settingsHref} startLabel={t.micStart} stopLabel={t.micStop} bind:running={micOn} />
    {#if !micOn}<p class="small">{t.micHint}</p>{/if}

    <fieldset disabled={inRound}>
      <div class="label" style="margin-top:20px">{t.settings}</div>
      <div class="field">
        <span>{t.mode}</span>
        <Seg small label={t.mode} bind:value={settings.mode} items={[{ value: 'one', label: t.modeOne }, { value: 'all', label: t.modeAll }]} />
      </div>
      {#if settings.mode === 'one'}
        <div class="field">
          <span>{t.strings}</span>
          <div class="seg small" role="group" aria-label={t.strings}>
            {#each strLabels as s, i}
              <button type="button" aria-pressed={settings.strings[i]} class:active={settings.strings[i]} onclick={() => (settings.strings[i] = !settings.strings[i])}>{s}</button>
            {/each}
          </div>
        </div>
      {/if}
      <div class="field">
        <span>{t.notes}</span>
        <Seg small label={t.notes} bind:value={settings.all12} items={[{ value: false, label: t.naturals }, { value: true, label: t.all12 }]} />
      </div>
      <div class="field">
        <span>{t.length}</span>
        <Seg small label={t.length} bind:value={settings.length} items={[5, 10, 20, 0].map((v) => ({ value: v, label: v ? String(v) : t.endless }))} />
      </div>
      <div class="field">
        <span>{t.breather}</span>
        <Seg
          small
          label={t.breather}
          bind:value={settings.breather}
          items={[{ value: 'short', label: t.breatherShort }, { value: 'normal', label: t.breatherNormal }, { value: 'key', label: t.breatherKey }]}
        />
      </div>
      <div class="field">
        <label for="finder-ding">{t.successSound}</label>
        <input id="finder-ding" type="checkbox" bind:checked={settings.successSound} />
      </div>
    </fieldset>
  </div>
</div>

<style>
  .stage { text-align: center; position: relative; transition: border-color 0.2s, background 0.25s; }
  .stage.hit { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, var(--panel)); }
  .stage.shake { animation: shake 0.4s; border-color: #d9534f; }
  @keyframes shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }

  .topbar { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; font-size: 13px; color: var(--muted); min-height: 20px; }
  .topbar span:first-child { text-align: left; }
  .topbar .miss { text-align: right; color: #c0392b; font-weight: 600; }
  .clock { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text); }
  .clock.off { color: var(--muted); }

  .note { font-size: clamp(100px, 16vw, 180px); font-weight: 600; line-height: 1; margin: 8px 0; display: grid; place-items: center; }
  .note > span { grid-area: 1 / 1; }
  .note .q { color: var(--muted); }
  .note .count { color: var(--accent); }
  .hit .note > span:first-child { color: var(--ok); opacity: 0.25; }
  .check { color: var(--ok); font-size: 0.8em; }
  .task { color: var(--muted); margin: 0; }
  .task b { color: var(--accent); font-weight: 600; }

  .steps { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 14px 0 0; }
  .stepchip { border: 1px solid var(--line); border-radius: 10px; padding: 6px 0 4px; background: var(--bg); transition: 0.2s; }
  .stepchip strong { display: block; font-size: 17px; }
  .stepchip span { display: block; font-size: 11px; color: var(--ok); font-weight: 700; min-height: 1.3em; }
  .stepchip.now { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); }
  .stepchip.done { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }

  .mini { width: 100%; max-width: 420px; display: block; margin: 14px auto 0; }
  .mini .wood { fill: var(--fb-bg); }
  .mini .fret { stroke: var(--fb-fret); stroke-width: 1.5; }
  .mini .fret.nut { stroke: var(--fb-nut); stroke-width: 4; }
  .mini .str { stroke: var(--fb-string); stroke-width: 1; }
  .mini .str.active { stroke: var(--accent); stroke-width: 2.5; }
  .mini .inlay { fill: var(--fb-inlay); opacity: 0.6; }
  .mini .dot { fill: var(--ok); stroke: var(--panel); stroke-width: 1.5; }

  .feedback { min-height: 64px; margin: 12px 0; display: grid; place-items: center; }
  .feedback p { margin: 0; }
  .good { color: var(--ok); font-weight: 700; font-size: 18px; }
  .bad { color: #c0392b; font-weight: 600; }
  .info { color: var(--muted); }
  .small { font-size: 12.5px; color: var(--muted); }
  .dir { width: 100%; max-width: 320px; }
  .dir .scale { position: relative; height: 10px; border-radius: 99px; margin-bottom: 8px;
    background: linear-gradient(90deg, #d9534f33, var(--panel2) 40%, var(--panel2) 60%, #d9534f33); }
  .dir .tick.center { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; background: var(--text); }
  .dir .marker { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); transform: translate(-50%, -50%); transition: left 0.1s; }
  .dir.ok .marker { background: var(--ok); }
  .dir p { color: var(--muted); }
  .dir.ok p { color: var(--ok); }

  .btn.big { padding: 14px 36px; font-size: 17px; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .keys { color: var(--muted); font-size: 12px; margin: 16px 0 0; }

  .summary h2 { margin: 8px 0 4px; font-size: 26px; }
  .badge { display: inline-block; background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); font-weight: 700; padding: 4px 12px; border-radius: 99px; margin-bottom: 8px; }
  .sgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 14px 0 20px; }
  .sgrid div { background: var(--bg); border-radius: 10px; padding: 12px; }
  .sgrid strong { display: block; font-size: 22px; }
  .sgrid strong.small { font-size: 16px; color: var(--text); }
  .sgrid span { color: var(--muted); font-size: 12.5px; }

  .side fieldset { border: none; padding: 0; margin: 0; min-width: 0; }
  .side fieldset:disabled { opacity: 0.5; }
  .side p.small { margin: 8px 0 0; }
  @media (max-width: 720px) {
    .keys { display: none; }
    .steps { gap: 4px; }
  }
</style>
