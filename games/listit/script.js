import { OrkaCloud } from '../../core/scripts/orka-cloud.js';
import { OrkaGameManager } from '../../core/scripts/orka-game-manager.js';
import { OrkaMath, OrkaAudio, OrkaFX, OrkaCalendar, OrkaTutorial, Utils, OrkaStorage } from '../../core/scripts/orka-lib.js';
import { GameData, TYPE_TRANSLATIONS } from './game-data.js';

const GAME_ID = 'listit';
const MAX_ATTEMPTS = 3;

const Game = new OrkaGameManager({
    gameId: GAME_ID,
    enforceLogin: true,
    heartbeatInterval: 30000 
});

let state = {
    date: new Date(),
    items: [],
    attempts: 0,
    isGameOver: false,
    lockedIndices: [],
    wrongIndices: [], // Controla os itens errados (vermelhos)
    startTime: null
};

document.addEventListener('DOMContentLoaded', async () => {
    const { profile } = await Game.init();
    
    OrkaAudio.loadAll({
        pop: '../../assets/sfx/pop.mp3',
        lock: '../../assets/sfx/ui_lock.mp3',
        win: '../../assets/sfx/win_short.mp3',
        error: '../../assets/sfx/error.mp3',
        tick: '../../assets/sfx/pop.mp3' // Som opcional para roleta (usando pop como placeholder)
    });

    setupTutorial();
    setupCalendar(); 
    
    document.getElementById('btn-submit').addEventListener('click', handleSubmit);
    document.getElementById('btn-share').addEventListener('click', shareResult);

    loadGame(new Date());
});

async function loadGame(dateObj) {
    // ... (reset de estados mantém igual) ...
    state.date = dateObj;
    state.attempts = 0;
    state.isGameOver = false;
    state.lockedIndices = [];
    state.wrongIndices = [];
    state.startTime = Date.now();
    
    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.disabled = false;
    document.getElementById('feedback-msg').textContent = "";

    Game.checkpoint({ status: 'level_load', date: getDateKey(dateObj) });

    // ... (displays de data mantém igual) ...
    const dateOptions = { day: '2-digit', month: 'long' };
    document.getElementById('date-display').textContent = dateObj.toLocaleDateString('pt-BR', dateOptions);
    updateDots();

    const lang = OrkaCloud.getProfile()?.language || 'pt-BR';
    const level = GameData.getLevel(state.date, lang);
    state.items = await Utils.preloadImages(level.items);

    // [CORREÇÃO AQUI]
    const dateRef = getDateKey(state.date);
    const storageKey = getStorageKey(state.date); // LocalStorage ainda usa a chave combinada

    // Carrega da nuvem passando (ID, DataRef)
    let daySave = await OrkaCloud.loadSave(GAME_ID, dateRef);
    
    // Se não veio da nuvem, tenta local
    if (!daySave) daySave = OrkaStorage.load(storageKey);

    // [MIGRAÇÃO] Se achou local mas não na nuvem, salva na nuvem agora
    if (daySave && !await OrkaCloud.loadSave(GAME_ID, dateRef)) {
        console.log("Migrando save local para nuvem...");
        OrkaCloud.saveGame(GAME_ID, daySave, dateRef);
    }

    if (daySave) {
        // ... (restante da função igual) ...
        document.getElementById('daily-prompt').textContent = level.prompt;
        document.getElementById('prompt-sub').textContent = `Tema: ${level.theme}`;
        restoreSave(daySave);
    } else {
        // ... (lógica de intro igual) ...
        const introKey = `${GAME_ID}_intro_${getDateKey(state.date)}`;
        
        // Dica: removi o "if (true)" hardcoded, use a lógica real
        const hasSeenIntro = localStorage.getItem(introKey); 

        if (!hasSeenIntro) {
            runIntroSequence(level, introKey);
        } else {
            document.getElementById('daily-prompt').textContent = level.prompt;
            document.getElementById('prompt-sub').textContent = `Tema: ${level.theme}`;
            renderGrid();
            saveProgress();
        }
    }
}

// --- ANIMAÇÃO DE INTRODUÇÃO ---
function runIntroSequence(levelData, storageKey) {
    const titleEl = document.getElementById('daily-prompt');
    const subTitleEl = document.getElementById('prompt-sub');
    
    // Lista de textos possíveis para a roleta
    // Extrai apenas os textos em PT do TYPE_TRANSLATIONS
    const possibleTitles = Object.values(TYPE_TRANSLATIONS).map(t => t.pt);

    // Estado inicial visual
    subTitleEl.style.opacity = '0'; 
    renderGrid(true); // Renderiza cards escondidos (.card-hidden)

    let iterations = 0;
    const maxIterations = 40; // ~3,2 segundos
    const intervalTime = 70; // Velocidade da troca

    const interval = setInterval(() => {
        // Efeito roleta
        const randomTitle = possibleTitles[Math.floor(Math.random() * possibleTitles.length)];
        titleEl.textContent = randomTitle;
        // OrkaAudio.play('tick', 0.1); // Som opcional

        iterations++;
        if (iterations >= maxIterations) {
            clearInterval(interval);
            finishIntro();
        }
    }, intervalTime);

    function finishIntro() {
        // 1. Revela Título Oficial
        titleEl.textContent = levelData.prompt;
        titleEl.style.color = "var(--orka-accent)";
        setTimeout(() => titleEl.style.color = "", 400);

        // 2. Revela Tema (Subtítulo)
        subTitleEl.textContent = `${levelData.theme}`;
        subTitleEl.style.opacity = '1';
        subTitleEl.style.transition = 'opacity 0.5s ease-in';
        subTitleEl.style.fontWeight = 'bold';

        // 3. Revela Cards em Cascata
        const cards = document.querySelectorAll('.card-slot');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.remove('card-hidden');
                card.classList.add('card-reveal'); // Classe do CSS que faz o pop-in
                OrkaAudio.play('pop', 0.2 + (index * 0.05));
            }, index * 120); // Delay progressivo
        });

        // Marca que já viu
        localStorage.setItem(storageKey, 'true');
        saveProgress();
    }
}

function getDateKey(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localDate = new Date(dateObj.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

function getStorageKey(dateObj) { return `${GAME_ID}_${getDateKey(dateObj)}`; }

// --- RENDERIZAÇÃO ---
// Adicionamos parametro 'hidden' para permitir renderizar cards invisíveis para a intro
function renderGrid(hidden = false) {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';

    state.items.forEach((item, displayIndex) => {
        const card = document.createElement('div');
        const imgClass = item.imgUrl ? '' : 'no-image';
        
        let classes = `card-slot ${imgClass}`;
        
        // Aplica classe de erro se estiver na lista de errados
        if (state.wrongIndices.includes(displayIndex)) {
            classes += ' wrong';
        }
        
        // Esconde para animação
        if (hidden) classes += ' card-hidden';

        card.className = classes;
        card.dataset.index = displayIndex;

        if (state.lockedIndices.includes(displayIndex)) card.classList.add('correct');
        else if (!state.isGameOver) {
            card.draggable = true;
            setupDragEvents(card);
        }

        if (item.imgUrl) {
            const img = document.createElement('img');
            img.src = item.imgUrl;
            img.className = 'card-image';
            img.draggable = false;
            card.appendChild(img);
        }

        const text = document.createElement('span');
        text.className = 'card-text';
        text.textContent = item.name;
        card.appendChild(text);

        if (state.isGameOver) {
            const overlay = document.createElement('div');
            overlay.className = 'result-overlay';
            const isPosCorrect = item.id === displayIndex;
            const colorStyle = isPosCorrect ? 'var(--status-correct)' : 'var(--status-wrong)';

            overlay.innerHTML = `
                <div class="result-value">${item.value}</div>
                <div class="result-label" style="color:${colorStyle}">
                    ${isPosCorrect ? 'CORRETO' : `#${item.id + 1}`}
                </div>
            `;
            card.appendChild(overlay);
        }
        container.appendChild(card);
    });
}

async function finishGame(win) {
    state.isGameOver = true;
    renderGrid(); 
    await saveProgress(win);

    document.getElementById('btn-submit').disabled = true;
    const feedbackMsg = document.getElementById('feedback-msg');

    if (win) {
        OrkaAudio.play('win');
        OrkaFX.confetti();
        feedbackMsg.textContent = "JOGO FINALIZADO! PARABÉNS!";
        feedbackMsg.style.color = "var(--status-correct)";

        const isToday = getDateKey(state.date) === getDateKey(new Date());
        if (isToday) {
            await Game.endGame('win', { attempts: state.attempts, level_date: getDateKey(state.date) });
            OrkaFX.toast("+1 BOLO (Desafio de Hoje)", "success");
        } else {
            await Game.endGame('win', { note: 'past_date' });
        }
    } else {
        OrkaAudio.play('error');
        feedbackMsg.textContent = "JOGO FINALIZADO!";
        feedbackMsg.style.color = "var(--status-wrong)";
        Game.endGame('lose', { attempts: state.attempts, level_date: getDateKey(state.date) });
    }
}

async function saveProgress(forceWin = null) {
    const currentData = {
        items: state.items,
        attempts: state.attempts,
        lockedIndices: state.lockedIndices,
        wrongIndices: state.wrongIndices,
        finished: state.isGameOver,
        win: forceWin
    };

    // 1. LocalStorage (Continua usando a chave concatenada, isso está certo)
    const storageKey = getStorageKey(state.date);
    OrkaStorage.save(storageKey, currentData);

    // 2. OrkaCloud (AQUI MUDOU: Separamos ID e Data)
    const dateRef = getDateKey(state.date); // '2024-01-28'
    await OrkaCloud.saveGame(GAME_ID, currentData, dateRef);
}

function restoreSave(data) {
    state.items = data.items;
    state.attempts = data.attempts;
    state.lockedIndices = data.lockedIndices;
    state.wrongIndices = data.wrongIndices || []; // Restaura vermelhos
    state.isGameOver = data.finished;
    
    if (state.isGameOver) {
        document.getElementById('btn-submit').disabled = true;
        const feedbackMsg = document.getElementById('feedback-msg');
        const won = data.win !== undefined ? data.win : (state.lockedIndices.length === state.items.length);
        feedbackMsg.textContent = won ? "JOGO FINALIZADO! PARABÉNS!" : "JOGO FINALIZADO!";
        feedbackMsg.style.color = won ? "var(--status-correct)" : "var(--status-wrong)";
    }
    renderGrid();
    updateDots();
}

function setupCalendar() {
    OrkaCalendar.bind({
        triggerBtn: 'btn-calendar', 
        modalId: 'modal-calendar', 
        gridId: 'calendar-grid', 
        titleId: 'calendar-title', 
        prevBtn: 'btn-prev', 
        nextBtn: 'btn-next'
    }, {
        minDate: '2024-01-01',
        getCurrentDate: () => state.date,
        onSelect: (d) => { 
            loadGame(d); 
            Utils.toggleModal('modal-calendar', false); 
        },
        getDayClass: (isoDate) => {
            const key = `${GAME_ID}_${isoDate}`;
            const dayData = OrkaStorage.load(key);
            if (!dayData) return ''; 
            if (dayData.finished) return dayData.win ? 'win' : 'lose';
            if (dayData.attempts > 0) return 'playing';
            return '';
        }
    });
}

// Funções de Drag & Drop
let dragSrcEl = null;

function setupDragEvents(el) {
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('touchstart', handleTouchStart, {passive: true});
    el.addEventListener('touchmove', handleTouchMove, {passive: false});
    el.addEventListener('touchend', handleTouchEnd);
}

function handleDragStart(e) {
    if (this.classList.contains('correct')) { e.preventDefault(); return; }
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
    setTimeout(() => this.classList.add('drag-source'), 0);
}

function handleDragEnter(e) {
    if (this !== dragSrcEl && !this.classList.contains('correct')) this.classList.add('drag-over');
}
function handleDragOver(e) { e.preventDefault(); return false; }
function handleDragLeave(e) { this.classList.remove('drag-over'); }

function handleDrop(e) {
    e.stopPropagation();
    if (dragSrcEl) dragSrcEl.classList.remove('drag-source', 'dragging');
    this.classList.remove('drag-over');

    if (dragSrcEl !== this && !this.classList.contains('correct')) {
        const srcIdx = Number(dragSrcEl.dataset.index);
        const tgtIdx = Number(this.dataset.index);

        const temp = state.items[srcIdx];
        state.items[srcIdx] = state.items[tgtIdx];
        state.items[tgtIdx] = temp;

        // LIMPA O VERMELHO DOS ENVOLVIDOS NA TROCA
        state.wrongIndices = state.wrongIndices.filter(idx => idx !== srcIdx && idx !== tgtIdx);

        OrkaAudio.play('pop', 0.6);
        renderGrid();
        Game.checkpoint({ action: 'swap', attempts: state.attempts });
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('drag-source', 'dragging');
    document.querySelectorAll('.card-slot').forEach(el => el.classList.remove('drag-over'));
}

let touchSrc = null;
function handleTouchStart(e) {
    if (this.classList.contains('correct')) return;
    touchSrc = this;
    this.classList.add('dragging');
}
function handleTouchMove(e) { e.preventDefault(); }
function handleTouchEnd(e) {
    if (!touchSrc) return;
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.card-slot');
    
    if (target && target !== touchSrc && !target.classList.contains('correct')) {
        const srcIdx = Number(touchSrc.dataset.index);
        const tgtIdx = Number(target.dataset.index);
        const temp = state.items[srcIdx];
        state.items[srcIdx] = state.items[tgtIdx];
        state.items[tgtIdx] = temp;
        
        // LIMPA O VERMELHO DOS ENVOLVIDOS NA TROCA
        state.wrongIndices = state.wrongIndices.filter(idx => idx !== srcIdx && idx !== tgtIdx);

        OrkaAudio.play('pop', 0.6);
        renderGrid();
        Game.checkpoint({ action: 'swap_touch', attempts: state.attempts });
    }
    touchSrc.classList.remove('dragging');
    touchSrc = null;
}

async function handleSubmit() {
    if (state.isGameOver) return;

    let correctCount = 0;
    let newLocked = [];
    state.wrongIndices = []; // Reseta para recalcular tudo

    const msg = document.getElementById('feedback-msg');

    state.items.forEach((item, index) => {
        if (item.id === index) {
            correctCount++;
            if (!state.lockedIndices.includes(index)) newLocked.push(index);
        } else {
            // Adiciona aos errados persistentes
            state.wrongIndices.push(index);
        }
    });

    state.lockedIndices = [...state.lockedIndices, ...newLocked];
    state.attempts++;
    updateDots();

    if (newLocked.length > 0) OrkaAudio.play('lock');
    
    Game.checkpoint({ action: 'submit', attempts: state.attempts, correct_count: correctCount });

    if (correctCount === state.items.length) {
        await finishGame(true);
    } else if (state.attempts >= MAX_ATTEMPTS) {
        await finishGame(false);
    } else {
        msg.textContent = `Você acertou ${correctCount}. Ajuste os itens vermelhos!`;
        msg.style.color = "var(--status-partial)";
        renderGrid(); // Renderiza já com o estado .wrong aplicado
        saveProgress();
    }
}

function updateDots() {
    const dots = [document.getElementById('dot-1'), document.getElementById('dot-2')];
    dots.forEach((d, i) => {
        d.className = 'dot';
        if (i < state.attempts) d.classList.add('fail');
        if (i === state.attempts && !state.isGameOver) d.classList.add('active');
    });
    if (state.isGameOver && state.lockedIndices.length === state.items.length) {
        dots.forEach(d => d.className = 'dot success');
    }
}

function shareResult() {
    const dayIndex = 1 + Math.floor((state.date - new Date('2024-01-01')) / (1000 * 60 * 60 * 24));
    const status = state.lockedIndices.length === state.items.length ? "🧠 Gênio" : "📚 Aprendendo";
    const text = `List-it #${dayIndex}\n${status} - ${state.attempts}/${MAX_ATTEMPTS}\nJogue em: orka-hub.vercel.app`;
    if (navigator.share) navigator.share({text});
    else { navigator.clipboard.writeText(text); OrkaFX.toast("Copiado!"); }
}

function setupTutorial() {
    OrkaTutorial.checkAndShow(GAME_ID, {
        title: "COMO JOGAR",
        steps: [
            "Ordene os itens seguindo a regra (ex: do mais leve ao mais pesado).",
            "Toque em <strong>CONFIRMAR</strong> para checar.",
            "Itens <span style='color:lightgreen'>VERDES</span> estão certos e travam.",
            "Itens <span style='color:red'>VERMELHOS</span> estão errados.",
            "Você tem uma <strong>segunda chance</strong> para corrigir os vermelhos!"
        ]
    });
    document.getElementById('btn-tutorial').onclick = () => {
        localStorage.removeItem(GAME_ID);
        setupTutorial();
    };
}