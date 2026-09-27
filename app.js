(() => {
  'use strict';

  const EASY_LETTERS = ['A','B','C','D','E','F','G','H','I','J','L','M','N','O','P','Q','R','S','T','U','V'];
  const HARD_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  const STORAGE_KEY = 'tap-palavra-settings-v1';

  const $ = (id) => document.getElementById(id);
  const screens = [...document.querySelectorAll('.screen')];

  const el = {
    playerCount: $('player-count'), turnTime: $('turn-time'), targetScore: $('target-score'), hardLetters: $('hard-letters'),
    playerInputs: $('player-inputs'), scoreboard: $('scoreboard'), roundScoreboard: $('round-scoreboard'), finalScoreboard: $('final-scoreboard'),
    introCategory: $('intro-category'), introStarter: $('intro-starter'), roundNumberLabel: $('round-number-label'), gameRoundLabel: $('game-round-label'),
    gameCategory: $('game-category'), currentPlayer: $('current-player'), turnHelp: $('turn-help'), wheel: $('letter-wheel'), centerButton: $('center-button'),
    timerValue: $('timer-value'), centerLabel: $('center-label'), roundWinner: $('round-winner'), roundScoreMessage: $('round-score-message'),
    gameWinner: $('game-winner'), gameFinalMessage: $('game-final-message'), pauseModal: $('pause-modal'), confirmModal: $('confirm-modal'),
    toast: $('toast'), installButton: $('btn-install'), deckStatus: $('deck-status')
  };

  const state = {
    players: [],
    currentPlayerIndex: 0,
    starterIndex: 0,
    round: 0,
    targetScore: 3,
    turnSeconds: 10,
    letters: EASY_LETTERS,
    usedLetters: new Set(),
    selectedLetter: null,
    category: '',
    deck: [],
    timerId: null,
    turnDeadline: null,
    pausedRemainingMs: null,
    paused: false,
    roundActive: false,
    wakeLock: null,
    installPrompt: null,
    lastSecondSound: null
  };

  function showScreen(id) {
    screens.forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.playerCount) el.playerCount.value = String(saved.playerCount);
      if (saved.turnSeconds) el.turnTime.value = String(saved.turnSeconds);
      if (saved.targetScore) el.targetScore.value = String(saved.targetScore);
      el.hardLetters.checked = Boolean(saved.hardLetters);
      renderPlayerInputs(saved.names || []);
    } catch {
      renderPlayerInputs();
    }
  }

  function saveSettings() {
    const names = [...el.playerInputs.querySelectorAll('input')].map(i => i.value.trim());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      playerCount: Number(el.playerCount.value),
      turnSeconds: Number(el.turnTime.value),
      targetScore: Number(el.targetScore.value),
      hardLetters: el.hardLetters.checked,
      names
    }));
  }

  function renderPlayerInputs(existing = []) {
    const count = Number(el.playerCount.value);
    const current = [...el.playerInputs.querySelectorAll('input')].map(i => i.value);
    const source = current.length ? current : existing;
    el.playerInputs.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.className = 'player-input';
      input.maxLength = 18;
      input.autocomplete = 'off';
      input.placeholder = `Jogador ${i + 1}`;
      input.value = source[i] || '';
      input.setAttribute('aria-label', `Nome do jogador ${i + 1}`);
      input.addEventListener('input', saveSettings);
      el.playerInputs.appendChild(input);
    }
  }

  function quickNames() {
    const defaults = ['Jogador 1','Jogador 2','Jogador 3','Jogador 4','Jogador 5','Jogador 6','Jogador 7','Jogador 8'];
    [...el.playerInputs.querySelectorAll('input')].forEach((input, i) => input.value = defaults[i]);
    saveSettings();
  }

  function shuffled(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function resetDeck(exclude = []) {
    const excluded = new Set(exclude.filter(Boolean));
    const cards = (window.GAME_CARDS || []).filter(card => !excluded.has(card));
    state.deck = shuffled(cards);
  }

  function drawCategory() {
    const previous = state.category;
    if (!state.deck.length) resetDeck(previous ? [previous] : []);
    state.category = state.deck.pop() || 'Animais';
    updateDeckStatus();
  }

  function updateDeckStatus() {
    if (!el.deckStatus) return;
    const total = (window.GAME_CARDS || []).length;
    const remaining = state.deck.length;
    el.deckStatus.textContent = `${remaining} de ${total} cartas ainda não sorteadas`;
  }

  function redrawCategory() {
    if (state.roundActive) return;
    const oldCategory = state.category;
    drawCategory();
    el.introCategory.textContent = state.category;
    playClick();
    vibrate(25);
    if (oldCategory !== state.category) showToast('Nova categoria sorteada!');
  }

  function startNewGame() {
    saveSettings();
    const names = [...el.playerInputs.querySelectorAll('input')].map((input, i) => input.value.trim() || `Jogador ${i + 1}`);
    state.players = names.map((name, i) => ({ id: i + 1, name, score: 0, eliminated: false }));
    state.turnSeconds = Number(el.turnTime.value);
    state.targetScore = Number(el.targetScore.value);
    state.letters = el.hardLetters.checked ? HARD_LETTERS : EASY_LETTERS;
    state.round = 0;
    state.starterIndex = Math.floor(Math.random() * state.players.length);
    resetDeck();
    beginRoundSetup();
  }

  function beginRoundSetup() {
    stopTimer();
    state.round += 1;
    state.players.forEach(p => p.eliminated = false);
    state.usedLetters.clear();
    state.selectedLetter = null;
    state.roundActive = false;
    drawCategory();

    // Alterna o jogador inicial para equilibrar a partida.
    if (state.round > 1) state.starterIndex = (state.starterIndex + 1) % state.players.length;
    state.currentPlayerIndex = state.starterIndex;

    el.roundNumberLabel.textContent = `Rodada ${state.round}`;
    el.introCategory.textContent = state.category;
    el.introStarter.textContent = state.players[state.currentPlayerIndex].name;
    showScreen('screen-round-intro');
  }

  async function beginRound() {
    state.roundActive = true;
    state.paused = false;
    el.gameRoundLabel.textContent = `Rodada ${state.round}`;
    el.gameCategory.textContent = state.category;
    renderWheel();
    renderScoreboard(el.scoreboard);
    updateTurnUI();
    showScreen('screen-game');
    await requestWakeLock();
    startTurnTimer();
  }

  function renderWheel() {
    el.wheel.querySelectorAll('.letter-btn').forEach(b => b.remove());
    const total = state.letters.length;
    const radiusPercent = total > 23 ? 42 : 41;
    state.letters.forEach((letter, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'letter-btn';
      button.dataset.letter = letter;
      button.textContent = letter;
      const angle = (Math.PI * 2 * index / total) - Math.PI / 2;
      const left = 50 + Math.cos(angle) * radiusPercent;
      const top = 50 + Math.sin(angle) * radiusPercent;
      button.style.setProperty('--left', `${left}%`);
      button.style.setProperty('--top', `${top}%`);
      button.addEventListener('click', () => selectLetter(letter));
      el.wheel.appendChild(button);
    });
    refreshLetterButtons();
  }

  function refreshLetterButtons() {
    el.wheel.querySelectorAll('.letter-btn').forEach(button => {
      const letter = button.dataset.letter;
      const used = state.usedLetters.has(letter);
      const selected = state.selectedLetter === letter;
      button.classList.toggle('used', used);
      button.classList.toggle('selected', selected);
      button.disabled = used || state.paused || !state.roundActive;
    });

    const ready = Boolean(state.selectedLetter) && !state.paused && state.roundActive;
    el.centerButton.disabled = !ready;
    el.centerButton.classList.toggle('ready', ready);
    el.centerLabel.textContent = ready ? 'PASSAR' : 'ESCOLHA';
  }

  function selectLetter(letter) {
    if (!state.roundActive || state.paused || state.usedLetters.has(letter)) return;
    // Permite corrigir a seleção antes de confirmar.
    state.selectedLetter = state.selectedLetter === letter ? null : letter;
    refreshLetterButtons();
    playClick();
    vibrate(20);
  }

  function confirmTurn() {
    if (!state.selectedLetter || state.paused || !state.roundActive) return;
    const confirmedLetter = state.selectedLetter;
    state.usedLetters.add(confirmedLetter);
    state.selectedLetter = null;
    playConfirm();
    vibrate(40);

    if (state.usedLetters.size >= state.letters.length) {
      // Se todas as letras acabarem, reinicia as letras sem eliminar ninguém.
      state.usedLetters.clear();
      showToast('Todas as letras foram usadas. A roda foi liberada novamente!');
    }

    advanceToNextActivePlayer();
    refreshLetterButtons();
    updateTurnUI();
    startTurnTimer();
  }

  function activePlayers() {
    return state.players.filter(p => !p.eliminated);
  }

  function advanceToNextActivePlayer() {
    if (activePlayers().length <= 1) return finishRound();
    let next = state.currentPlayerIndex;
    do {
      next = (next + 1) % state.players.length;
    } while (state.players[next].eliminated);
    state.currentPlayerIndex = next;
  }

  function eliminateCurrentPlayer() {
    if (!state.roundActive) return;
    stopTimer();
    const player = state.players[state.currentPlayerIndex];
    player.eliminated = true;
    state.selectedLetter = null;
    playTimeout();
    vibrate([180, 80, 180]);
    showToast(`${player.name} foi eliminado!`);
    renderScoreboard(el.scoreboard);

    if (activePlayers().length <= 1) {
      setTimeout(finishRound, 650);
      return;
    }
    advanceToNextActivePlayer();
    refreshLetterButtons();
    updateTurnUI();
    setTimeout(startTurnTimer, 450);
  }

  function finishRound() {
    if (!state.roundActive) return;
    state.roundActive = false;
    stopTimer();
    releaseWakeLock();
    const winner = activePlayers()[0];
    if (!winner) return;
    winner.score += 1;
    playRoundWin();
    vibrate([80,60,80,60,160]);

    el.roundWinner.textContent = winner.name;
    el.roundScoreMessage.textContent = `${winner.name} ganhou 1 carta. Primeiro a ${state.targetScore} vence a partida.`;
    renderScoreboard(el.roundScoreboard, winner.id);

    if (winner.score >= state.targetScore) {
      setTimeout(() => finishGame(winner), 400);
      return;
    }
    showScreen('screen-round-end');
  }

  function finishGame(winner) {
    stopTimer();
    state.roundActive = false;
    releaseWakeLock();
    el.gameWinner.textContent = winner.name;
    el.gameFinalMessage.textContent = `${winner.name} chegou a ${winner.score} carta${winner.score === 1 ? '' : 's'} em ${state.round} rodada${state.round === 1 ? '' : 's'}.`;
    renderScoreboard(el.finalScoreboard, winner.id);
    showScreen('screen-game-end');
  }

  function renderScoreboard(container, highlightId = null) {
    container.innerHTML = '';
    state.players.forEach((player, index) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      if (index === state.currentPlayerIndex && state.roundActive) chip.classList.add('current');
      if (player.eliminated && state.roundActive) chip.classList.add('eliminated');
      if (player.id === highlightId) chip.classList.add('current');
      chip.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span><span class="card-count">${player.score}</span> carta${player.score === 1 ? '' : 's'}</span>`;
      container.appendChild(chip);
    });
  }

  function updateTurnUI() {
    const player = state.players[state.currentPlayerIndex];
    el.currentPlayer.textContent = player.name;
    el.turnHelp.textContent = state.selectedLetter
      ? `Letra ${state.selectedLetter} selecionada. Toque no centro para passar.`
      : 'Fale uma resposta, toque na letra inicial e depois no centro.';
    renderScoreboard(el.scoreboard);
  }

  function startTurnTimer(customMs = null) {
    stopTimer();
    if (!state.roundActive || state.paused) return;
    const duration = customMs ?? state.turnSeconds * 1000;
    state.turnDeadline = Date.now() + duration;
    state.lastSecondSound = null;
    tickTimer();
    state.timerId = setInterval(tickTimer, 100);
  }

  function tickTimer() {
    const remainingMs = Math.max(0, state.turnDeadline - Date.now());
    const seconds = Math.ceil(remainingMs / 1000);
    el.timerValue.textContent = String(seconds).padStart(2, '0');
    const warning = remainingMs <= 3000 && remainingMs > 0;
    el.centerButton.classList.toggle('warning', warning);

    if (warning && seconds !== state.lastSecondSound) {
      state.lastSecondSound = seconds;
      playTick();
      vibrate(12);
    }

    if (remainingMs <= 0) eliminateCurrentPlayer();
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
    el.centerButton.classList.remove('warning');
  }

  function pauseGame() {
    if (!state.roundActive || state.paused) return;
    state.pausedRemainingMs = Math.max(0, state.turnDeadline - Date.now());
    state.paused = true;
    stopTimer();
    refreshLetterButtons();
    el.pauseModal.classList.remove('hidden');
  }

  function resumeGame() {
    if (!state.roundActive || !state.paused) return;
    state.paused = false;
    el.pauseModal.classList.add('hidden');
    refreshLetterButtons();
    startTurnTimer(state.pausedRemainingMs || state.turnSeconds * 1000);
  }

  function quitToHome() {
    stopTimer();
    releaseWakeLock();
    state.roundActive = false;
    state.paused = false;
    el.confirmModal.classList.add('hidden');
    showScreen('screen-home');
  }

  function replayWithSameSettings() {
    showScreen('screen-setup');
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  async function releaseWakeLock() {
    try { await state.wakeLock?.release(); } catch {}
    state.wakeLock = null;
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.roundActive && !state.paused) {
      await requestWakeLock();
      tickTimer();
    }
  });

  function vibrate(pattern) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  let audioCtx;
  function tone(freq, duration = .06, volume = .035, type = 'sine', delay = 0) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + .008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration + .02);
    } catch {}
  }
  function playClick() { tone(540, .045, .025, 'triangle'); }
  function playConfirm() { tone(610, .05, .035, 'triangle'); tone(820, .07, .03, 'triangle', .05); }
  function playTick() { tone(900, .045, .025, 'square'); }
  function playTimeout() { tone(180, .18, .05, 'sawtooth'); tone(120, .25, .04, 'sawtooth', .12); }
  function playRoundWin() { [523,659,784,1047].forEach((f,i) => tone(f,.13,.035,'triangle',i*.09)); }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2200);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  // Eventos de interface
  $('btn-new-game').addEventListener('click', () => showScreen('screen-setup'));
  document.querySelectorAll('[data-go-home]').forEach(b => b.addEventListener('click', () => showScreen('screen-home')));
  el.playerCount.addEventListener('change', () => { renderPlayerInputs(); saveSettings(); });
  el.turnTime.addEventListener('change', saveSettings);
  el.targetScore.addEventListener('change', saveSettings);
  el.hardLetters.addEventListener('change', saveSettings);
  $('btn-randomize-names').addEventListener('click', quickNames);
  $('btn-start-game').addEventListener('click', startNewGame);
  $('btn-begin-round').addEventListener('click', beginRound);
  $('btn-redraw-category').addEventListener('click', redrawCategory);
  el.centerButton.addEventListener('click', confirmTurn);
  $('btn-pause').addEventListener('click', pauseGame);
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-quit').addEventListener('click', () => el.confirmModal.classList.remove('hidden'));
  $('btn-cancel-quit').addEventListener('click', () => el.confirmModal.classList.add('hidden'));
  $('btn-confirm-quit').addEventListener('click', quitToHome);
  $('btn-next-round').addEventListener('click', beginRoundSetup);
  $('btn-play-again').addEventListener('click', replayWithSameSettings);
  $('btn-home').addEventListener('click', quitToHome);

  // Instalação PWA
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.installPrompt = event;
    el.installButton.classList.remove('hidden');
  });
  el.installButton.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    el.installButton.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => el.installButton.classList.add('hidden'));

  // Service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  loadSettings();
})();
