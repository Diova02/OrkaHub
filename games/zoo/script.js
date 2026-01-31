//Game data
import animalsDB from './animais.js';
import curiositiesDB from './curiosidades.js';
import { dictionary } from './trad.js';

//Orka APIs
import { 
    OrkaFX, OrkaDate, OrkaStorage, Utils, 
    OrkaI18n, OrkaAutocomplete, OrkaTutorial, OrkaCalendar 
} from '../../core/scripts/orka-lib.js';

// 1. IMPORTAÇÃO DA NOVA ARQUITETURA
import { OrkaGameManager } from '../../core/scripts/orka-game-manager.js'; 
import { OrkaCloud } from '../../core/scripts/orka-cloud.js'; // Ainda usada para loads específicos

// ==========================================
// 1. CONFIGURAÇÃO & DADOS
// ==========================================
const GAME_ID = 'zoo';
const MAX_ATTEMPTS = 10;
const START_DATE = new Date("2025-12-01T00:00:00");
const POP_SCALE = ["Extinto","Dezenas", "Centenas", "Milhares", "Milhões", "Bilhões", "Trilhões"];

// --- INSTÂNCIA DO GERENTE (O Novo Cérebro) ---
const Game = new OrkaGameManager({
    gameId: GAME_ID,
    enforceLogin: true,      // Garante que ninguém jogue sem Nickname
    heartbeatInterval: 60000 // Salva sessão a cada 1 minuto
});

// Mapas de Dados (Mantido idêntico)
const enMap = { "Mamifero": "Mammal", "Ave": "Bird", "Reptil": "Reptile", "Anfibio": "Amphibian", "Peixe": "Fish", "Inseto": "Insect", "Aracnideo": "Arachnid", "Molusco": "Mollusk", "Crustaceo": "Crustacean", "terrestre": "Terrestrial", "aquatico": "Aquatic", "aereo": "Aerial", "Carnivoro": "Carnivore", "Herbivoro": "Herbivore", "Onivoro": "Omnivore", "Insetivoro": "Insectivore", "Piscivoro": "Piscivore", "Nectarivoro": "Nectarivore", "Hematofago": "Hematophage", "Africa": "Africa", "Asia": "Asia", "Europa": "Europe", "America": "Americas", "Oceania": "Oceania", "Antartida": "Antarctica", "Extinto": "Extinct", "Anelideo": "Annelid", "Detritivoro": "Detritivore", "Filtrador":"Filter Feeder", "Hematofago":"Hematophagous", "Porifero":"Porifera", "Tardigrado":"Tardigrade", "Cnidario":"Cnidaria", "Equinodermo":"Echinodermata", "Diurno": "Diurnal", "Noturno": "Nocturnal", "Crepuscular": "Crepuscular", "Catemeral": "Cathemeral" };
const ptCorrections = { "terrestre": "Terrestre", "aquatico": "Aquático", "aereo": "Aéreo", "America": "América", "Africa": "África", "Asia": "Ásia", "Antartida": "Antártida", "Oceania": "Oceania", "Europa": "Europa", "Mamifero": "Mamífero", "Reptil": "Réptil", "Anfibio": "Anfíbio", "Aracnideo": "Aracnídeo", "Crustaceo": "Crustáceo", "Carnivoro": "Carnívoro", "Herbivoro": "Herbívoro", "Onivoro": "Onívoro", "Insetivoro": "Insetívoro", "Piscivoro": "Piscívoro", "Nectarivoro": "Nectarívoro", "Hematofago": "Hematófago", "Filtrador":"Filtrador", "Extinto": "Extinto", "Anelideo": "Anelídeo", "Detritivoro": "Detritívoro", "Diurno": "Diurno", "Noturno": "Noturno", "Crepuscular": "Crepuscular", "Catemeral": "Catemeral" };
const CHECKPOINTS = [];
const SPECIAL_DAYS = {};

// ==========================================
// 2. ESTADO
// ==========================================
let gameState = { 
    targetAnimal: null, 
    attemptsCount: 0, 
    guessedNames: new Set(), 
    isGameOver: false, 
    currentDate: new Date() 
};
let startTime = null;
let endTime = null;
let currentLang = 'pt';

const gridBody = document.getElementById("grid-body");
const attemptDisplay = document.getElementById("attempt-count");
const dateDisplay = document.getElementById("date-display");
const summaryBox = document.getElementById("page-end-summary");

// ==========================================
// 3. INICIALIZAÇÃO (REFATORADO)
// ==========================================
async function initGame(dateInput = new Date()) {
    // 1. Inicializa via Game Manager (Resolve Auth, Nickname, Proteção e Sessão)
    const { profile } = await Game.init();
    
    // 2. Configura Idioma (Pega do profile retornado pelo Manager)
    const cloudLang = profile?.language || 'pt-BR';
    const langCode = cloudLang.startsWith('en') ? 'en' : 'pt';
    currentLang = OrkaI18n.init(dictionary, langCode);

    // 3. Setup Lógica
    resetGameUI();
    gameState.currentDate = new Date(dateInput);
    gameState.currentDate.setHours(0,0,0,0);
    
    updateDateDisplay();
    gameState.targetAnimal = getTargetByDate(gameState.currentDate);

    // 4. Input Inteligente
    OrkaAutocomplete.attach(
        "guess-input", 
        "suggestions", 
        animalsDB, 
        processGuessFromInput, 
        {
            searchKeys: ['nome.pt', 'nome.en'],
            displayKey: (item) => currentLang === 'pt' ? item.nome.pt : item.nome.en
        }
    );

    // 5. Tutorial
    OrkaTutorial.checkAndShow('orkaZooTutorialV4', { 
        title: OrkaI18n.t('tutTitle'),
        steps: [ OrkaI18n.t('tut1'), OrkaI18n.t('tut2'), OrkaI18n.t('tut3'), OrkaI18n.t('tut4'), OrkaI18n.t('tut5') ],
        btnText: OrkaI18n.t('tutBtn')
    });

    await loadProgress(); // Agora usa loadSave da V5 internamente

    OrkaCalendar.bind({
        triggerBtn: 'calendar-btn', modalId: 'modal-calendar', gridId: 'calendar-grid', titleId: 'calendar-month-year', prevBtn: 'prev-month', nextBtn: 'next-month'             
    }, {
        minDate: '2026-01-01',            
        getCurrentDate: () => gameState.currentDate, 
        getDayClass: (isoDate) => {
            const key = `orkaZoo_${isoDate}`; 
            const data = OrkaStorage.load(key);
            if (!data) return ''; 
            if (data.win) return 'win';
            if (data.over) return 'lose';
            return 'playing'; 
        },
        onSelect: (date) => {
            gameState.currentDate = date; 
            initGame(date);           
            Utils.toggleModal('modal-calendar', false); 
        }
    });
}

function resetGameUI() {
    gameState.attemptsCount = 0;
    gameState.guessedNames.clear();
    gameState.isGameOver = false;
    OrkaAutocomplete.clear("guess-input");
    document.getElementById("guess-input").disabled = false;
    document.getElementById("submit-btn").disabled = false;
    gridBody.innerHTML = "";
    summaryBox.style.display = "none";
    attemptDisplay.textContent = "0";
    Utils.toggleModal('modal-end', false);
    
    const emptyState = document.getElementById("empty-state");
    if(emptyState) emptyState.style.display = "block";
    
    startTime = null;
    endTime = null;
}

// ==========================================
// 4. LÓGICA DO JOGO
// ==========================================
function getTargetByDate(dateObj) {
    const dateKey = dateObj.toISOString().split('T')[0];
    if (SPECIAL_DAYS[dateKey]) {
        const special = animalsDB.find(a => a.nome.pt === SPECIAL_DAYS[dateKey]);
        if (special) return special;
    }
    let activeDbSize = animalsDB.length;
    for (const check of CHECKPOINTS) {
        if (dateObj < new Date(check.date)) { activeDbSize = check.limit; break; }
    }
    const totalDays = OrkaDate.getIndexByDate(dateObj, START_DATE, 9999999);
    const index = totalDays % activeDbSize;
    return animalsDB[index] || animalsDB[animalsDB.length - 1];
}

function processGuessFromInput(data) {
    if (gameState.isGameOver) return;
    
    let guessObj = null;
    if (typeof data === 'string') {
        const val = Utils.normalize(data);
        guessObj = animalsDB.find(a => Utils.normalize(a.nome.pt) === val || Utils.normalize(a.nome.en) === val);
    } else {
        guessObj = data;
    }

    if (!guessObj) { OrkaFX.toast(OrkaI18n.t("toastErrList"), "error"); OrkaFX.shake("guess-input"); return; }
    if (gameState.guessedNames.has(guessObj.nome.pt)) { OrkaFX.toast(OrkaI18n.t("toastErrDup"), "error"); OrkaFX.shake("guess-input"); return; }

    if (!startTime) startTime = Date.now();

    const emptyState = document.getElementById("empty-state");
    if(emptyState) emptyState.style.display = "none";

    gameState.guessedNames.add(guessObj.nome.pt);
    gameState.attemptsCount++;
    attemptDisplay.textContent = gameState.attemptsCount;
    
    renderRow(guessObj);
    saveProgress();
    OrkaAutocomplete.clear("guess-input");

    // NOVO: Checkpoint do Game Manager
    // Isso garante que se o user sair agora, sabemos que ele tentou X vezes e qual foi o último score
    Game.checkpoint({
        attempts: gameState.attemptsCount, // ISSO vai aparecer no metadata agora
        last_guess: guessObj.nome.pt,
        current_status: 'guessing'
    });
    
    if (guessObj.nome.pt === gameState.targetAnimal.nome.pt) {
        endGame(true);
    } else if (gameState.attemptsCount >= MAX_ATTEMPTS) {
        endGame(false);
    }
}

document.getElementById("submit-btn").addEventListener("click", () => {
    processGuessFromInput(document.getElementById("guess-input").value);
});

// ==========================================
// 5. RENDERIZAÇÃO (REFATORADO)
// ==========================================
function renderRow(guess, isReveal = false) {
    const row = document.createElement("div");
    row.className = "guess-row";
    if (isReveal) row.classList.add("revealed");

    const target = gameState.targetAnimal;
    const createCell = (html, status) => {
        const div = document.createElement("div");
        div.className = `cell ${status}`;
        div.innerHTML = html;
        row.appendChild(div);
    };

    // 1. Nome
    const dName = currentLang === 'pt' ? guess.nome.pt : guess.nome.en;
    createCell(dName, guess.nome.pt === target.nome.pt ? "correct" : "wrong");

    // 2. Peso
    let wClass = "wrong", wArrow = "";
    if (guess.peso === target.peso) wClass = "correct";
    else wArrow = guess.peso < target.peso ? "↑" : "↓";
    createCell(`${formatWeight(guess.peso)} <div class='arrow'>${wArrow}</div>`, wClass);

    // 3. Dieta
    createCell(formatTerm(guess.dieta), guess.dieta === target.dieta ? "correct" : "wrong");
    
    // 4. Habitat
    const dispHab = guess.habitat.map(h => formatTerm(h)).join(", ");
    createCell(dispHab, getArrayStatus(guess.habitat, target.habitat));

    // 5. Continentes
    let dispCont = guess.continentes.length >= 5 ? OrkaI18n.t("global") : guess.continentes.map(c => formatTerm(c)).join(", ");
    createCell(dispCont, getArrayStatus(guess.continentes, target.continentes));

    // 6. CLASSE & SUBCLASSE (NOVA LÓGICA)
    // Se a classe bate mas a sub não: Partial (Amarelo)
    let classeStatus = "wrong";
    if (guess.classe === target.classe) {
        classeStatus = (guess.subclasse === target.subclasse) ? "correct" : "partial";
    }
    const labelClasse = `${formatTerm(guess.classe)}${guess.subclasse ? ' - ' + formatTerm(guess.subclasse) : ''}`;
    createCell(labelClasse, classeStatus);

    // 7. População
    let pClass = "wrong", pArrow = "";
    const gIdx = POP_SCALE.indexOf(guess.populacao);
    const tIdx = POP_SCALE.indexOf(target.populacao);
    if (gIdx === tIdx) pClass = "correct";
    else pArrow = gIdx < tIdx ? "↑" : "↓";
    createCell(`${guess.populacao} <div class='arrow'>${pArrow}</div>`, pClass);

    // --- COLUNA DE VIDA REMOVIDA AQUI ---

    // 8. Ciclo
    createCell(formatTerm(guess.ciclo), guess.ciclo === target.ciclo ? "correct" : "wrong");

    if (isReveal) {
        gridBody.appendChild(row);
        setTimeout(() => row.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
        gridBody.prepend(row);
    }
}

// ==========================================
// 6. STORAGE & FIM DE JOGO
// ==========================================
function getStorageKey() {
    return `orkaZoo_${gameState.currentDate.toISOString().split('T')[0]}`;
}

// Função helper simples para pegar a string de data ISO (YYYY-MM-DD)
function getCurrentDateRef() {
    return gameState.currentDate.toISOString().split('T')[0];
}

async function saveProgress() {
    const dataParaSalvar = {
        guessed: Array.from(gameState.guessedNames),
        over: gameState.isGameOver,
        win: gameState.isGameOver && Array.from(gameState.guessedNames).pop() === gameState.targetAnimal.nome.pt,
        startT: startTime,
        endT: endTime,
        attempts: gameState.attemptsCount
    };

    // 1. Salva Local (Storage)
    OrkaStorage.save(getStorageKey(), dataParaSalvar);
    OrkaStorage.updateCalendarStatus(gameState.currentDate, dataParaSalvar.win ? 'win' : (dataParaSalvar.over ? 'lose' : 'playing'));

    // 2. Salva Nuvem (CORREÇÃO AQUI)
    // Passamos 3 argumentos: ID do jogo, Dados, Referência de Data
    const dateRef = getCurrentDateRef();
    await OrkaCloud.saveGame(GAME_ID, dataParaSalvar, dateRef);
}

async function loadProgress() {
    const dateRef = getCurrentDateRef();
    
    // 1. Tenta carregar da Nuvem usando a nova assinatura (ID, DataRef)
    let data = await OrkaCloud.loadSave(GAME_ID, dateRef);

    // Fallback: Se não tem na nuvem, tenta local e migra
    if (!data) {
        data = OrkaStorage.load(getStorageKey());
        
        // Se achou localmente e o jogo já acabou, salva na nuvem para persistir
        if (data && data.over) {
            console.log(`☁️ Migrando save local de ${dateRef} para nuvem...`);
            OrkaCloud.saveGame(GAME_ID, data, dateRef);
        }
    }

    // ... Resto da lógica de renderização (mantém igual) ...
    if (data) {
        startTime = data.startT;
        endTime = data.endT;
        // (O resto do seu código de loadProgress continua aqui...)
        if (data.guessed && data.guessed.length > 0) {
             const emptyState = document.getElementById("empty-state");
             if(emptyState) emptyState.style.display = "none";
        }

        gridBody.innerHTML = "";
        gameState.guessedNames.clear();
        gameState.attemptsCount = 0;

        if (Array.isArray(data.guessed)) {
            data.guessed.forEach(name => {
                const obj = animalsDB.find(a => a.nome.pt === name);
                if(obj) {
                    gameState.guessedNames.add(name);
                    gameState.attemptsCount++;
                    renderRow(obj);
                }
            });
        }
        attemptDisplay.textContent = gameState.attemptsCount;
        
        if(data.over) {
            gameState.isGameOver = true;
            document.getElementById("guess-input").disabled = true;
            document.getElementById("submit-btn").disabled = true;
            if (!data.win) renderRow(gameState.targetAnimal, true);
            
            const isToday = gameState.currentDate.toDateString() === new Date().toDateString();
            fillEndModal(data.win); 
            if (isToday) Utils.toggleModal('modal-end', true);
        }
    }
}

function getCloudGameId() {
    const dateStr = gameState.currentDate.toISOString().split('T')[0];
    return `${GAME_ID}_${dateStr}`;
}

async function endGame(win) {
    gameState.isGameOver = true;
    endTime = Date.now();
    document.getElementById("guess-input").disabled = true;
    document.getElementById("submit-btn").disabled = true;
    
    if (!win) renderRow(gameState.targetAnimal, true);
    await saveProgress();

    fillEndModal(win);
    
    const isToday = gameState.currentDate.toDateString() === new Date().toDateString();
    
    if (win) { 
        OrkaFX.confetti(); 
        if (isToday) {
            Game.endGame('win', { attempts: gameState.attemptsCount });
            OrkaFX.toast(OrkaI18n.t('toastWin') + " (+1 🎂)", "success");
        } else {
            Game.endGame('win', { note: 'past_date' });
            OrkaFX.toast(OrkaI18n.t('toastWin'), "success");
        }
    } else { 
        Game.endGame('lose', { attempts: gameState.attemptsCount });
        OrkaFX.toast(OrkaI18n.t('toastLose'), "error"); 
    }
    
    setTimeout(() => { Utils.toggleModal('modal-end', true); }, 1500);
}

async function fillEndModal(win) {
    const titleEl = document.getElementById('end-title');
    titleEl.textContent = win ? OrkaI18n.t('winTitle') : OrkaI18n.t('loseTitle');
    
    const animalName = currentLang === 'pt' ? gameState.targetAnimal.nome.pt : gameState.targetAnimal.nome.en;
    document.getElementById('reveal-name').textContent = animalName;

    // NOVO: Usando Utils.preloadImages para carregar a imagem do modal
    const revealImg = document.getElementById('reveal-img');
    const imageData = await Utils.preloadImages([{ name: gameState.targetAnimal.nome.pt }]);
    
    if (imageData[0].imgUrl) {
        revealImg.src = imageData[0].imgUrl;
        revealImg.style.display = 'block';
    } else {
        revealImg.style.display = 'none';
    }

    let statText = win 
        ? OrkaI18n.t('animalFound').replace('{animal}', animalName).replace('{attempts}', `<b>${gameState.attemptsCount}</b>`)
        : OrkaI18n.t('animalReveal').replace('{animal}', animalName);
    
    if (startTime && endTime) {
        const diff = Math.floor((endTime - startTime) / 1000);
        statText += `<br><span style="font-size:0.85rem; color:#888;">⏱ ${Utils.formatTime(diff)}</span>`;
    }
    document.getElementById('end-stats').innerHTML = statText;
    summaryBox.style.display = "flex";
}

// ==========================================
// 7. CALENDÁRIO & CURIOSIDADES
// ==========================================

document.getElementById("tip-btn").addEventListener("click", () => {
    const tipIndex = OrkaDate.getDailyIndex(START_DATE, curiositiesDB.length);
    const tip = curiositiesDB[tipIndex];
    const content = currentLang === 'pt' ? tip.dica.pt : tip.dica.en;
    document.getElementById("tip-text").innerHTML = `<strong style="color:var(--accent-color)">${OrkaI18n.t("didYouKnow")}</strong>${content}`;
    const imgName = Utils.normalize(tip.img).replace(/\s+/g, "");
    tryLoadImage(document.getElementById("tip-img"), imgName, ['png', 'jpg', 'jpeg', 'webp', 'svg'], 0);
    Utils.toggleModal("modal-tip", true);
});

// ==========================================
// 8. HELPERS
// ==========================================
function formatTerm(val) {
    if (!val) return "?";
    const map = currentLang === 'pt' ? ptCorrections : enMap;
    return map[val] || val.charAt(0).toUpperCase() + val.slice(1);
}
function formatWeight(kg) { return kg < 1 ? (kg * 1000) + "g" : (kg >= 1000 ? (kg / 1000) + "t" : kg + "kg"); }
function getArrayStatus(g, t) {
    const intersect = g.filter(x => t.includes(x));
    if (g.length === t.length && intersect.length === t.length) return "correct";
    if (intersect.length > 0) return "partial";
    return "wrong";
}
function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = gameState.currentDate.toLocaleDateString(currentLang === 'pt' ? 'pt-BR' : 'en-US', options);
    dateDisplay.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}
function tryLoadImage(img, name, formats, idx) {
    if (idx >= formats.length) { img.style.display = 'none'; return; }
    img.src = `../../assets/imagens/${name}.${formats[idx]}`;
    img.onload = () => img.style.display = 'block';
    img.onerror = () => tryLoadImage(img, name, formats, idx+1);
}

window.shareResult = function() {
    OrkaCloud.trackEvent('share_result', { win: gameState.isGameOver });
    const dateStr = gameState.currentDate.toLocaleDateString('pt-BR');
    const attemptStr = gameState.isGameOver ? gameState.attemptsCount : "X";
    let text = `🦁 Orka Zoo ${dateStr}\n${OrkaI18n.t('attempts')}: ${attemptStr}/10\n\n`;
    
    gameState.guessedNames.forEach(name => {
        const guess = animalsDB.find(a => a.nome.pt === name);
        if(guess) {
            const t = gameState.targetAnimal;
            let row = (guess.nome.pt === t.nome.pt) ? "🟩" : "🟥"; // Nome
            row += (guess.peso === t.peso) ? "🟩" : "🟥"; // Peso
            row += (guess.dieta === t.dieta) ? "🟩" : "🟥"; // Dieta
            
            const hS = getArrayStatus(guess.habitat, t.habitat); 
            row += hS==="correct"?"🟩":(hS==="partial"?"🟨":"🟥"); // Habitat
            
            const cS = getArrayStatus(guess.continentes, t.continentes); 
            row += cS==="correct"?"🟩":(cS==="partial"?"🟨":"🟥"); // Continentes
            
            // Lógica de Compartilhamento da Classe (Considerando Subclasse)
            if (guess.classe === t.classe) {
                row += (guess.subclasse === t.subclasse) ? "🟩" : "🟨";
            } else {
                row += "🟥";
            }

            row += (POP_SCALE.indexOf(guess.populacao) === POP_SCALE.indexOf(t.populacao)) ? "🟩" : "🟥"; // Pop
            // (Expectativa de vida removida do emoji)
            row += (guess.ciclo === t.ciclo) ? "🟩" : "🟥"; // Ciclo
            
            text += row + "\n";
        }
    });
    text += "\nJogue em: orka-hub.vercel.app/games/orkazoo/";
    navigator.clipboard.writeText(text).then(() => OrkaFX.toast(OrkaI18n.t("shareMsg"), "success"));
};

window.closeModal = (id) => Utils.toggleModal(id, false);
// REMOVIDO: window.onbeforeunload (O GameManager já cuida disso)

initGame();