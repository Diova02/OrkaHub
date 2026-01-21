import animalsDB from './animais.js';
import curiositiesDB from './curiosidades.js';
import { 
    OrkaFX, OrkaDate, OrkaStorage, Utils, 
    OrkaI18n, OrkaAutocomplete, OrkaTutorial, OrkaCalendar 
} from '../../core/scripts/orka-lib.js';
import { OrkaCloud } from '../../core/scripts/orka-cloud.js';

// ==========================================
// 1. CONFIGURAÇÃO & DADOS
// ==========================================
const GAME_ID = 'orka_zoo';
const MAX_ATTEMPTS = 10;
const START_DATE = new Date("2025-12-01T00:00:00");
const POP_SCALE = ["Extinto","Dezenas", "Centenas", "Milhares", "Milhões", "Bilhões", "Trilhões"];

// Dicionário de Tradução COMPLETO
const dictionary = {
    pt: {
        gameTitle: "Orka Zoo",
        guessPlaceholder: "Digite um animal...",
        btnGuess: "CHUTAR", // Botão principal
        attempts: "Tentativas", 
        global: "Global",
        yrs: "anos",
        
        // Mensagens de Estado Inicial (Vazio)
        startMsg: "Tudo começa com um chute...",
        startSub: "Digite o nome de um animal para iniciar a caçada!",

        // Cabeçalho da Tabela (IMPORTANTE: O HTML precisa ter data-t com essas chaves)
        hAnimal: "Animal",
        hWeight: "Peso",
        hDiet: "Dieta",
        hHabitat: "Habitat",
        hContinent: "Continente",
        hClass: "Classe",
        hPop: "Pop.",
        hLife: "Vida",
        hCycle: "Ciclo",

        // Tutorial (Texto mais claro)
        tutTitle: "COMO JOGAR",
        tut1: "O objetivo é descobrir o <strong>animal secreto</strong> do dia.",
        tut2: "<span style='color:#2e8b57'>🟩 VERDE:</span> A característica está exata.",
        tut3: "<span style='color:#e4b00f'>🟨 AMARELO:</span> Parcialmente correto (ex: acerta um dos habitats).",
        tut4: "Setas (↑ ↓) indicam se o valor (peso, população) é maior ou menor.",
        tut5: "Você tem 10 tentativas. Boa sorte!",
        tutBtn: "BORA JOGAR!",

        // Fim de Jogo & Toast
        winTitle: "VITÓRIA!", loseTitle: "FIM DE JOGO", 
        winMsg: "Você descobriu o animal!", loseMsg: "Acabaram as tentativas.",
        toastErrList: "Animal não encontrado!", toastErrDup: "Você já tentou esse animal!", 
        toastWin: "Parabéns! Você venceu!", toastLose: "Fim de jogo!",
        tomorrow: "Volte amanhã para novos desafios!",
        shareMsg: "Resultado copiado!",
        didYouKnow: "Você sabia? ",
        animalFound: "Você acertou <strong>{animal}</strong> em {attempts} tentativa(s).", 
        animalReveal: "O animal era <strong>{animal}</strong>."
    },
    en: {
        gameTitle: "Orka Zoo",
        guessPlaceholder: "Type an animal...",
        btnGuess: "GUESS",
        attempts: "Attempts", 
        global: "Global",
        yrs: "yrs",

        // Empty State
        startMsg: "It all starts with a guess...",
        startSub: "Type an animal name to begin the hunt!",

        // Table Headers
        hAnimal: "Animal",
        hWeight: "Weight",
        hDiet: "Diet",
        hHabitat: "Habitat",
        hContinent: "Continent",
        hClass: "Class",
        hPop: "Pop.",
        hLife: "Life",
        hCycle: "Cycle",

        // Tutorial
        tutTitle: "HOW TO PLAY",
        tut1: "Your goal is to find the <strong>secret animal</strong> of the day.",
        tut2: "<span style='color:#2e8b57'>🟩 GREEN:</span> Exact match.",
        tut3: "<span style='color:#e4b00f'>🟨 YELLOW:</span> Partial match (e.g. correct habitat).",
        tut4: "Arrows (↑ ↓) indicate higher or lower values.",
        tut5: "You have 10 attempts. Good luck!",
        tutBtn: "LET'S PLAY!",

        // End Game & Toast
        winTitle: "VICTORY!", loseTitle: "GAME OVER", 
        winMsg: "You found the animal!", loseMsg: "Out of attempts.",
        toastErrList: "Animal not found!", toastErrDup: "Already guessed that!", 
        toastWin: "Congrats! You won!", toastLose: "Game Over!",
        tomorrow: "Come back tomorrow for new challenges!",
        shareMsg: "Copied to clipboard!",
        didYouKnow: "Did you know? ",
        animalFound: "You guessed <strong>{animal}</strong> in {attempts} attempt(s).", 
        animalReveal: "The animal was <strong>{animal}</strong>."
    }
};

// Mapas de Dados (Lógica Interna)
const enMap = {
    "Mamifero": "Mammal", "Ave": "Bird", "Reptil": "Reptile", "Anfibio": "Amphibian", "Peixe": "Fish", "Inseto": "Insect", "Aracnideo": "Arachnid", "Molusco": "Mollusk", "Crustaceo": "Crustacean",
    "terrestre": "Terrestrial", "aquatico": "Aquatic", "aereo": "Aerial",
    "Carnivoro": "Carnivore", "Herbivoro": "Herbivore", "Onivoro": "Omnivore", "Insetivoro": "Insectivore", "Piscivoro": "Piscivore", "Nectarivoro": "Nectarivore", "Hematofago": "Hematophage",
    "Africa": "Africa", "Asia": "Asia", "Europa": "Europe", "America": "Americas", "Oceania": "Oceania", "Antartida": "Antarctica",
    "Extinto": "Extinct", "Anelideo": "Annelid", "Detritivoro": "Detritivore", "Filtrador":"Filter Feeder", "Hematofago":"Hematophagous",
    "Porifero":"Porifera", "Tardigrado":"Tardigrade", "Cnidario":"Cnidaria", "Equinodermo":"Echinodermata",
    "Diurno": "Diurnal", "Noturno": "Nocturnal", "Crepuscular": "Crepuscular", "Catemeral": "Cathemeral"
};

const ptCorrections = {
    "terrestre": "Terrestre", "aquatico": "Aquático", "aereo": "Aéreo",
    "America": "América", "Africa": "África", "Asia": "Ásia", "Antartida": "Antártida", "Oceania": "Oceania", "Europa": "Europa",
    "Mamifero": "Mamífero", "Reptil": "Réptil", "Anfibio": "Anfíbio", "Aracnideo": "Aracnídeo", "Crustaceo": "Crustáceo",
    "Carnivoro": "Carnívoro", "Herbivoro": "Herbívoro", "Onivoro": "Onívoro", "Insetivoro": "Insetívoro", "Piscivoro": "Piscívoro", 
    "Nectarivoro": "Nectarívoro", "Hematofago": "Hematófago", "Filtrador":"Filtrador",
    "Extinto": "Extinto", "Anelideo": "Anelídeo", "Detritivoro": "Detritívoro",
    "Diurno": "Diurno", "Noturno": "Noturno", "Crepuscular": "Crepuscular", "Catemeral": "Catemeral"
};

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
// 3. INICIALIZAÇÃO
// ==========================================
async function initGame(dateInput = new Date()) {
    // 1. Cloud & Lang
    await OrkaCloud.init();
    
    // IMPORTANTE: Aqui garantimos que se o Cloud retornar 'en-US', pegamos 'en'.
    // E se não tiver nada, força 'pt'.
    const cloudLang = OrkaCloud.getLanguage() || 'pt-BR';
    const langCode = cloudLang.startsWith('en') ? 'en' : 'pt';
    
    // Inicializa I18n com o dicionário
    currentLang = OrkaI18n.init(dictionary, langCode);

    // 2. Sessão
    const isToday = new Date().toDateString() === dateInput.toDateString();
    if (isToday) await OrkaCloud.startSession(GAME_ID);

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
    OrkaTutorial.checkAndShow('orkaZooTutorialV4', { // Mudei a chave para V4 para forçar aparecer para você testar
        title: OrkaI18n.t('tutTitle'),
        steps: [
            OrkaI18n.t('tut1'),
            OrkaI18n.t('tut2'),
            OrkaI18n.t('tut3'),
            OrkaI18n.t('tut4'),
            OrkaI18n.t('tut5')
        ],
        btnText: OrkaI18n.t('tutBtn')
    });

    loadProgress();

    OrkaCalendar.bind({
        triggerBtn: 'calendar-btn',
        modalId: 'modal-calendar',
        gridId: 'calendar-grid',
        titleId: 'calendar-month-year',
        prevBtn: 'prev-month',
        nextBtn: 'next-month'
    }, {
        minDate: START_DATE.toISOString().split('T')[0],
        currentDate: gameState.currentDate, // Para abrir focado no dia do jogo atual
        onSelect: (d) => { 
            initGame(d); 
            Utils.toggleModal('modal-calendar', false); // Lib fecha o modal ou você fecha aqui
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
    
    // Mostra o Empty State (Mensagem inicial)
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
        if (dateObj < new Date(check.date)) {
            activeDbSize = check.limit;
            break; 
        }
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
        guessObj = animalsDB.find(a => 
            Utils.normalize(a.nome.pt) === val || Utils.normalize(a.nome.en) === val
        );
    } else {
        guessObj = data;
    }

    if (!guessObj) { 
        OrkaFX.toast(OrkaI18n.t("toastErrList"), "error"); 
        OrkaFX.shake("guess-input"); 
        return; 
    }
    if (gameState.guessedNames.has(guessObj.nome.pt)) { 
        OrkaFX.toast(OrkaI18n.t("toastErrDup"), "error"); 
        OrkaFX.shake("guess-input"); 
        return; 
    }

    if (!startTime) startTime = Date.now();

    // Esconde msg inicial
    const emptyState = document.getElementById("empty-state");
    if(emptyState) emptyState.style.display = "none";

    gameState.guessedNames.add(guessObj.nome.pt);
    gameState.attemptsCount++;
    attemptDisplay.textContent = gameState.attemptsCount;
    
    renderRow(guessObj);
    saveProgress();
    OrkaAutocomplete.clear("guess-input");

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
// 5. RENDERIZAÇÃO
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

    const dName = currentLang === 'pt' ? guess.nome.pt : guess.nome.en;
    createCell(dName, guess.nome.pt === target.nome.pt ? "correct" : "wrong");

    let wClass = "wrong", wArrow = "";
    if (guess.peso === target.peso) wClass = "correct";
    else wArrow = guess.peso < target.peso ? "↑" : "↓";
    createCell(`${formatWeight(guess.peso)} <div class='arrow'>${wArrow}</div>`, wClass);

    createCell(formatTerm(guess.dieta), guess.dieta === target.dieta ? "correct" : "wrong");
    
    const dispHab = guess.habitat.map(h => formatTerm(h)).join(", ");
    createCell(dispHab, getArrayStatus(guess.habitat, target.habitat));

    let dispCont = guess.continentes.length >= 5 ? OrkaI18n.t("global") : guess.continentes.map(c => formatTerm(c)).join(", ");
    createCell(dispCont, getArrayStatus(guess.continentes, target.continentes));

    createCell(formatTerm(guess.classe), guess.classe === target.classe ? "correct" : "wrong");

    let pClass = "wrong", pArrow = "";
    const gIdx = POP_SCALE.indexOf(guess.populacao);
    const tIdx = POP_SCALE.indexOf(target.populacao);
    if (gIdx === tIdx) pClass = "correct";
    else pArrow = gIdx < tIdx ? "↑" : "↓";
    createCell(`${guess.populacao} <div class='arrow'>${pArrow}</div>`, pClass);

    let vClass = "wrong", vArrow = "";
    if (guess.vida === target.vida) vClass = "correct";
    else vArrow = guess.vida < target.vida ? "↑" : "↓";
    createCell(`${guess.vida} <span style="font-size:0.7em">${OrkaI18n.t('yrs')}</span> <div class='arrow'>${vArrow}</div>`, vClass);

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

async function saveProgress() {
    // 1. Prepara os dados REAIS baseados no seu gameState atual
    // AQUI ESTAVA O ERRO: Usamos 'gameState' e não 'state'
    const dataParaSalvar = {
        guessed: Array.from(gameState.guessedNames), // Converte o Set de chutes para Lista
        over: gameState.isGameOver,
        win: gameState.isGameOver && Array.from(gameState.guessedNames).pop() === gameState.targetAnimal.nome.pt,
        startT: startTime,
        endT: endTime,
        attempts: gameState.attemptsCount // Útil ter o contador salvo explícito
    };

    // 2. Salva Localmente (Backup/Offline)
    OrkaStorage.save(getStorageKey(), dataParaSalvar);
    OrkaStorage.updateCalendarStatus(gameState.currentDate, dataParaSalvar.win ? 'win' : (dataParaSalvar.over ? 'lose' : 'playing'));

    // 3. Salva na Nuvem (A CADA CHUTE)
    // Removemos o 'if (gameState.isGameOver)' para salvar o progresso parcial também
    const cloudId = getCloudGameId();
    
    //console.log(`☁️ Salvando progresso parcial em: ${cloudId}`); // (Opcional: Debug)
    await OrkaCloud.saveGameProgress(cloudId, dataParaSalvar);
}

async function loadProgress() {
    // 1. Gera o ID específico para a data que estamos vendo no calendário
    const cloudId = getCloudGameId();

    // 2. Tenta buscar na nuvem usando esse ID específico
    let data = await OrkaCloud.loadGameSave(cloudId, null);

    // 3. Fallback para LocalStorage (se não achar na nuvem)
    if (!data) {
        data = OrkaStorage.load(getStorageKey());
        
        // Migração Silenciosa: Se achou local mas não na nuvem, sobe pra nuvem
        if (data && data.over) {
            console.log(`☁️ Migrando save de ${cloudId} para nuvem...`);
            OrkaCloud.saveGameProgress(cloudId, data);
        }
    }

    // 4. Se tiver dados (da nuvem ou local), restaura o jogo
    if (data) {
        startTime = data.startT;
        endTime = data.endT;

        if (data.guessed && data.guessed.length > 0) {
             const emptyState = document.getElementById("empty-state");
             if(emptyState) emptyState.style.display = "none";
        }

        // Limpa o grid antes de desenhar para evitar duplicatas ao trocar de data
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
            
            // Só revela o animal se perdeu (se ganhou, o último chute já é o animal)
            if (!data.win) renderRow(gameState.targetAnimal, true);
            
            // O modal só deve abrir automaticamente se for o dia de HOJE.
            // Se estou navegando no calendário, não quero popups na cara.
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
            await OrkaCloud.addBolo(1); 
            OrkaFX.toast(OrkaI18n.t('toastWin') + " (+1 🎂)", "success");
        } else {
            OrkaFX.toast(OrkaI18n.t('toastWin'), "success");
        }
    } else { 
        OrkaFX.toast(OrkaI18n.t('toastLose'), "error"); 
    }
    OrkaCloud.endSession({ win, animal: gameState.targetAnimal.nome.pt, attempts: gameState.attemptsCount });
    setTimeout(() => { Utils.toggleModal('modal-end', true); }, 1500);
}

function fillEndModal(win) {
    const titleEl = document.getElementById('end-title');
    titleEl.textContent = win ? OrkaI18n.t('winTitle') : OrkaI18n.t('loseTitle');
    titleEl.style.color = win ? "var(--win-color)" : "var(--lose-color)";
    document.getElementById('end-msg').textContent = win ? OrkaI18n.t('winMsg') : OrkaI18n.t('loseMsg');
    
    const animalName = currentLang === 'pt' ? gameState.targetAnimal.nome.pt : gameState.targetAnimal.nome.en;
    document.getElementById('reveal-name').textContent = animalName;

    const revealImg = document.getElementById('reveal-img');
    const baseName = Utils.normalize(gameState.targetAnimal.nome.pt).replace(/\s+/g, "");
    tryLoadImage(revealImg, baseName, ['png', 'jpg', 'jpeg', 'webp'], 0);

    let statText = win 
        ? OrkaI18n.t('animalFound').replace('{animal}', animalName).replace('{attempts}', `<b>${gameState.attemptsCount}</b>`)
        : OrkaI18n.t('animalReveal').replace('{animal}', animalName);
    
    if (startTime && endTime) {
        const diff = Math.floor((endTime - startTime) / 1000);
        statText += `<br><span style="font-size:0.85rem; color:#888;">⏱ ${Utils.formatTime(diff)}</span>`;
    }
    document.getElementById('end-stats').innerHTML = statText;
    summaryBox.innerHTML = `<h3 style="color:${win?'var(--win-color)':'var(--lose-color)'}">${titleEl.textContent}</h3><p>${statText}</p><p style="font-size:0.8rem;color:#888;margin-top:15px"><i>${OrkaI18n.t('tomorrow')}</i></p>`;
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
    OrkaCloud.track('share_result', 'conversion', { win: gameState.isGameOver });
    const dateStr = gameState.currentDate.toLocaleDateString('pt-BR');
    const attemptStr = gameState.isGameOver && gameState.guessedNames.has(gameState.targetAnimal.nome.pt) ? gameState.attemptsCount : "X";
    let text = `🦁 Orka Zoo ${dateStr}\n${OrkaI18n.t('attempts')}: ${attemptStr}/10\n\n`;
    
    gameState.guessedNames.forEach(name => {
        const guess = animalsDB.find(a => a.nome.pt === name);
        if(guess) {
            const t = gameState.targetAnimal;
            let row = (guess.nome.pt === t.nome.pt) ? "🟩" : "🟥";
            row += (guess.peso === t.peso) ? "🟩" : "🟥";
            row += (guess.dieta === t.dieta) ? "🟩" : "🟥";
            const hS = getArrayStatus(guess.habitat, t.habitat); row += hS==="correct"?"🟩":(hS==="partial"?"🟨":"🟥");
            const cS = getArrayStatus(guess.continentes, t.continentes); row += cS==="correct"?"🟩":(cS==="partial"?"🟨":"🟥");
            row += (guess.classe === t.classe) ? "🟩" : "🟥";
            const gIdx = POP_SCALE.indexOf(guess.populacao); const tIdx = POP_SCALE.indexOf(t.populacao);
            row += (gIdx === tIdx) ? "🟩" : "🟥";
            text += row + "\n";
        }
    });
    text += "\nJogue em: orka-hub.vercel.app/games/orkazoo/";
    navigator.clipboard.writeText(text).then(() => OrkaFX.toast(OrkaI18n.t("shareMsg"), "success"));
};

window.closeModal = (id) => Utils.toggleModal(id, false);
window.addEventListener('beforeunload', () => OrkaCloud.endSession({ reason: 'tab_closed' }));

initGame();