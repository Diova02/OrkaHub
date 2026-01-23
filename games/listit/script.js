import { OrkaCloud } from '../../core/scripts/orka-cloud.js';
import { OrkaGameManager } from '../../core/scripts/orka-game-manager.js'; // NOVO CÉREBRO
import { OrkaMath, OrkaAudio, OrkaFX, OrkaCalendar, OrkaTutorial, Utils, OrkaStorage } from '../../core/scripts/orka-lib.js';
import { GameData } from './game-data.js';

const GAME_ID = 'list-it'; // ID base
const MAX_ATTEMPTS = 2;

// --- INSTÂNCIA DO GERENTE ---
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
    startTime: null // Para medir tempo de resolução
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializa Manager (Auth, Sessão, Nick)
    const { profile } = await Game.init();
    
    // Configura Audio
    OrkaAudio.loadAll({
        pop: '../../assets/sfx/pop.mp3',
        lock: '../../assets/sfx/ui_lock.mp3',
        win: '../../assets/sfx/win_short.mp3',
        error: '../../assets/sfx/error.mp3'
    });

    setupTutorial();
    setupCalendar(); 
    
    // Bindings
    document.getElementById('btn-submit').addEventListener('click', handleSubmit);
    document.getElementById('btn-share').addEventListener('click', shareResult);
    document.getElementById('btn-close-result').addEventListener('click', () => Utils.toggleModal('modal-result', false));

    // Carrega o jogo de HOJE
    loadGame(new Date());
});

// --- CORE: CARREGAMENTO ---

async function loadGame(dateObj) {
    state.date = dateObj;
    state.attempts = 0;
    state.isGameOver = false;
    state.lockedIndices = [];
    state.startTime = Date.now();
    
    // Checkpoint de início de nível
    Game.checkpoint({ status: 'level_load', date: getDateKey(dateObj) });

    // UI: Data no Header
    const dateOptions = { day: '2-digit', month: 'long' };
    document.getElementById('date-display').textContent = dateObj.toLocaleDateString('pt-BR', dateOptions);
    document.getElementById('feedback-msg').textContent = "";
    updateDots();

    // 1. Gera Nível (Baseado na data)
    // Nota: O OrkaCloud V5 retorna profile.language no init, mas aqui pegamos direto do getter
    const lang = OrkaCloud.getProfile()?.language || 'pt-BR'; // ✅ V5 Nova
    const level = GameData.getLevel(state.date, lang);
    document.getElementById('daily-prompt').textContent = level.prompt;

    // 2. Preload Imagens
    state.items = await preloadImages(level.items);

    // 3. Busca Save Específico DO DIA (Fim do Monólito)
    const cloudId = getCloudId(state.date);
    const storageKey = getStorageKey(state.date);

    // Estratégia Híbrida: Tenta Cloud V5 -> Falha -> Tenta Local -> Falha -> Novo Jogo
    let daySave = await OrkaCloud.loadSave(cloudId);
    
    if (!daySave) {
        daySave = OrkaStorage.load(storageKey);
        // Se achou local mas não na nuvem, sincroniza silenciosamente
        if (daySave) OrkaCloud.saveGame(cloudId, daySave);
    }

    if (daySave) {
        restoreSave(daySave);
    } else {
        renderGrid();
        saveProgress(); // Salva estado inicial
    }
}

// Helpers de Chaves (Essenciais para a arquitetura fracionada)
function getDateKey(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localDate = new Date(dateObj.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

function getCloudId(dateObj) {
    return `${GAME_ID}_${getDateKey(dateObj)}`;
}

function getStorageKey(dateObj) {
    return `${GAME_ID}_${getDateKey(dateObj)}`;
}

// --- RENDERIZAÇÃO ---

function renderGrid() {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';

    state.items.forEach((item, displayIndex) => {
        const card = document.createElement('div');
        card.className = 'card-slot';
        card.dataset.index = displayIndex;

        // Lógica de Travamento
        if (state.lockedIndices.includes(displayIndex)) card.classList.add('correct');
        else if (!state.isGameOver) {
            card.draggable = true;
            setupDragEvents(card);
        }

        // 1. Imagem
        if (item.imgUrl) {
            const img = document.createElement('img');
            img.src = item.imgUrl;
            img.className = 'card-image';
            img.draggable = false;
            card.appendChild(img);
        }

        // 2. Texto
        const text = document.createElement('span');
        text.className = 'card-text';
        text.textContent = item.name;
        card.appendChild(text);

        // 3. Overlay de Resultado
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

// --- FIM DE JOGO (Atualizado com Manager) ---

async function finishGame(win) {
    state.isGameOver = true;
    renderGrid(); 
    
    // Salva estado final no dia específico
    await saveProgress(win);

    // UI Feedback
    const title = document.getElementById('result-title');
    const msg = document.getElementById('result-message');

    if (win) {
        OrkaAudio.play('win');
        OrkaFX.confetti();
        title.textContent = "ORDEM PERFEITA!";
        title.style.color = "var(--status-correct)";
        msg.textContent = `Você completou o desafio do dia ${state.date.getDate()}.`;

        // Manager resolve: Recompensa, Score e Sessão
        // Nota: Enviamos 'score' como 100 se ganhar, ou baseada em tentativas, para ter algum dado numérico
        const isToday = getDateKey(state.date) === getDateKey(new Date());
        
        if (isToday) {
            await Game.endGame('win', { 
                attempts: state.attempts,
                level_date: getDateKey(state.date)
            });
            OrkaFX.toast("+1 BOLO (Desafio de Hoje)", "success");
        } else {
            // Se for dia passado, registra vitória mas o Manager sabe que não dá bolo diário
            // (A lógica de travar bolo repetido está na procedure SQL claim_daily_reward)
            await Game.endGame('win', { note: 'past_date' });
        }

    } else {
        OrkaAudio.play('error');
        title.textContent = "NÃO FOI DESSA VEZ";
        title.style.color = "var(--status-wrong)";
        msg.textContent = "Veja a ordem correta revelada nos cards.";
        
        Game.endGame('lose', { 
            attempts: state.attempts,
            level_date: getDateKey(state.date)
        });
    }

    setTimeout(() => Utils.toggleModal('modal-result', true), 2000);
}

// --- SAVE & RESTORE (Fracionado) ---

async function saveProgress(forceWin = null) {
    // Objeto do dia atual apenas
    const currentData = {
        items: state.items,
        attempts: state.attempts,
        lockedIndices: state.lockedIndices,
        finished: state.isGameOver,
        win: forceWin
    };

    // 1. Salva Local (Para o calendário ler rápido)
    const storageKey = getStorageKey(state.date);
    OrkaStorage.save(storageKey, currentData);

    // 2. Salva Nuvem (Para persistência segura)
    const cloudId = getCloudId(state.date);
    await OrkaCloud.saveGame(cloudId, currentData);
}

function restoreSave(data) {
    state.items = data.items;
    state.attempts = data.attempts;
    state.lockedIndices = data.lockedIndices;
    state.isGameOver = data.finished;
    
    renderGrid();
    updateDots();
    
    if (state.isGameOver) {
        setTimeout(() => Utils.toggleModal('modal-result', true), 500);
    }
}

// --- CALENDÁRIO ---

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
        
        // LÓGICA DE CORES: Lê do LocalStorage (Rápido e sem custo de leitura no banco)
        // Se o usuário limpar o cache, as cores somem, mas ao clicar no dia, o Cloud recupera o save.
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

// --- UTILS DE IMAGEM & DRAG-DROP ---

async function preloadImages(items) {
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    const resolveItem = async (item) => {
        const cleanName = Utils.normalize(item.name).replace(/\s+/g, '').toLowerCase();
        for (const ext of extensions) {
            const src = `../../assets/imagens/${cleanName}.${ext}`;
            if (await checkImageExists(src)) return { ...item, imgUrl: src };
        }
        return { ...item, imgUrl: null };
    };
    return Promise.all(items.map(resolveItem));
}

function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// --- EVENTOS DRAG & DROP (Mantidos Idênticos) ---

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

        OrkaAudio.play('pop', 0.6);
        renderGrid();
        
        // NOVO: Checkpoint de interação
        Game.checkpoint({ action: 'swap', attempts: state.attempts });
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('drag-source', 'dragging');
    document.querySelectorAll('.card-slot').forEach(el => el.classList.remove('drag-over'));
}

// Mobile Touch
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
        OrkaAudio.play('pop', 0.6);
        renderGrid();
        Game.checkpoint({ action: 'swap_touch', attempts: state.attempts });
    }
    touchSrc.classList.remove('dragging');
    touchSrc = null;
}

// --- SUBMIT ---

async function handleSubmit() {
    if (state.isGameOver) return;

    let correctCount = 0;
    let newLocked = [];
    const msg = document.getElementById('feedback-msg');

    state.items.forEach((item, index) => {
        if (item.id === index) {
            correctCount++;
            if (!state.lockedIndices.includes(index)) newLocked.push(index);
        } else {
            const card = document.querySelector(`.card-slot[data-index="${index}"]`);
            if (card) {
                card.classList.add('wrong');
                setTimeout(() => card.classList.remove('wrong'), 500);
            }
        }
    });

    state.lockedIndices = [...state.lockedIndices, ...newLocked];
    state.attempts++;
    updateDots();

    if (newLocked.length > 0) OrkaAudio.play('lock');
    
    // Checkpoint de tentativa
    Game.checkpoint({ 
        action: 'submit', 
        attempts: state.attempts,
        correct_count: correctCount 
    });

    if (correctCount === state.items.length) {
        await finishGame(true);
    } else if (state.attempts >= MAX_ATTEMPTS) {
        await finishGame(false);
    } else {
        msg.textContent = `Você acertou ${correctCount}. Ajuste os itens vermelhos!`;
        msg.style.color = "var(--status-partial)";
        renderGrid();
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
    // Usamos OrkaDate para pegar o índice do dia relativo ao início do ano
    const dayIndex = OrkaDate.getIndexByDate(state.date, new Date('2024-01-01'), 9999);
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
        localStorage.removeItem(GAME_ID); // Limpa flag do tutorial
        setupTutorial();
    };
}