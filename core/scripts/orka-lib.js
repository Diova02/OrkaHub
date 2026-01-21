/* =================================================================
   ORKA STUDIO - CORE LIBRARY (V3.0)
   Ferramentas comuns para Lógica, Áudio, FX e Matemática.
   ================================================================= */

import { OrkaCloud } from './orka-cloud.js';

// =========================
// 1. MATH & RNG (O Cérebro)
// =========================

export const OrkaMath = {
    // Algoritmo Mulberry32: Rápido e determinístico
    createSeededRNG: (seed) => {
        return function() {
            var t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    },

    // Gera semente baseada na data (Formato Int: 20241025)
    getDateSeed: (dateObj = new Date()) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return parseInt(`${y}${m}${d}`);
    },

    // --- NOVOS UTILITÁRIOS ---

    // Retorna inteiro entre min e max (inclusive)
    randomRange: (min, max, rngFunction = Math.random) => {
        return Math.floor(rngFunction() * (max - min + 1)) + min;
    },

    // Embaralha array (Fisher-Yates) suportando RNG customizado
    shuffle: (array, rngFunction = Math.random) => {
        let currentIndex = array.length, randomIndex;
        // Enquanto restarem elementos...
        while (currentIndex != 0) {
            // Pega um elemento restante...
            randomIndex = Math.floor(rngFunction() * currentIndex);
            currentIndex--;
            // E troca com o elemento atual.
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    },

    // Pega item aleatório de um array
    pickRandom: (array, rngFunction = Math.random) => {
        return array[Math.floor(rngFunction() * array.length)];
    }
};

// =========================
// 2. DATA & TEMPO (O Relógio)
// =========================
export const OrkaDate = {
    // Retorna índice do dia (0, 1, 2...) desde a data de lançamento
    getDailyIndex: (startDateStr, dbSize) => {
        const today = new Date();
        return OrkaDate.getIndexByDate(today, startDateStr, dbSize);
    },
    
    getIndexByDate: (targetDate, startDateStr, dbSize) => {
        const t = new Date(targetDate); t.setHours(0,0,0,0);
        const s = new Date(startDateStr); s.setHours(0,0,0,0); // Garante hora zerada
        
        const diffTime = t - s; // Diferença em milissegundos
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if(diffDays < 0) return 0; // Evita índices negativos antes do lançamento
        return diffDays % dbSize; // Loopa se o banco acabar
    },

    // Seleciona X itens baseados no dia (Rotação determinística)
    getDailyCategories: (startDate, categoriesKeys, amount = 4) => {
        const today = new Date(); today.setHours(0,0,0,0);
        const start = new Date(startDate); start.setHours(0,0,0,0);
        
        const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
        
        // Pula 'amount' posições a cada dia
        const baseIndex = diffDays * amount; 
        
        let selected = [];
        for(let i = 0; i < amount; i++) {
            const index = (baseIndex + i) % categoriesKeys.length;
            selected.push(categoriesKeys[index]);
        }
        return selected;
    }
};

// =========================
// 3. AUDIO ENGINE (Web Audio API)
// =========================
export const OrkaAudio = {
    context: null,
    buffers: {},

    init: () => {
        if (!OrkaAudio.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            OrkaAudio.context = new AudioContext();
        }
    },

    // Carrega múltiplos sons e retorna Promise quando TODOS acabarem
    // Uso: await OrkaAudio.loadAll({ jump: 'jump.mp3', win: 'win.mp3' });
    loadAll: async (soundMap) => {
        OrkaAudio.init();
        const promises = Object.entries(soundMap).map(async ([key, path]) => {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await OrkaAudio.context.decodeAudioData(arrayBuffer);
                OrkaAudio.buffers[key] = audioBuffer;
                return true;
            } catch (e) {
                console.warn(`🔇 Falha ao carregar som: ${key} (${path})`, e);
                return false;
            }
        });
        return Promise.all(promises);
    },

    play: (key, volume = 1.0, pitch = 1.0) => {
        if (!OrkaAudio.context) OrkaAudio.init();
        if (OrkaAudio.context.state === 'suspended') OrkaAudio.context.resume();

        const buffer = OrkaAudio.buffers[key];
        if (!buffer) return;

        const source = OrkaAudio.context.createBufferSource();
        source.buffer = buffer;
        
        // Efeito de Pitch (Opcional, bom para sons repetitivos não enjoarem)
        if (pitch !== 1.0) source.playbackRate.value = pitch;

        const gainNode = OrkaAudio.context.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(OrkaAudio.context.destination);
        source.start(0);
    }
};

// =========================
// 4. VISUAL FX (Juice)
// =========================
export const OrkaFX = {
    confetti: (amount = 60) => {
        const colors = ['#0055ff', '#ffffff', '#2e8b57', '#e4b00f', '#ff0055'];
        const fragment = document.createDocumentFragment(); // Performance: Reflow único

        for (let i = 0; i < amount; i++) {
            const c = document.createElement('div');
            // Estilos inline para evitar CSS externo obrigatório
            Object.assign(c.style, {
                position: 'fixed', top: '-10px', width: '10px', height: '10px',
                zIndex: '9999', opacity: '0.9', borderRadius: '2px', pointerEvents: 'none',
                left: Math.random() * 100 + 'vw',
                backgroundColor: colors[Math.floor(Math.random() * colors.length)]
            });

            const duration = Math.random() * 3 + 2;
            c.style.animation = `fall ${duration}s linear forwards`;
            c.style.animationDelay = Math.random() * 1 + 's'; // Delay menor para resposta mais rápida
            
            fragment.appendChild(c);
            
            // Auto-limpeza
            setTimeout(() => c.remove(), duration * 1000 + 1000);
        }
        document.body.appendChild(fragment);
    },
    
    toast: (msg, type = 'info') => {
        let container = document.getElementById('toast-container');
        if(!container) { 
            container = document.createElement('div'); 
            container.id = 'toast-container'; 
            // Garante que o container tenha estilo básico se não houver CSS
            container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;";
            document.body.appendChild(container);
        }
        
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.textContent = msg;
        // Animação CSS deve estar no seu arquivo de estilo global, 
        // mas aqui forçamos o texto caso não carregue estilo
        if(!div.style.padding) div.style.cssText = "background: #333; color: #fff; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";
        
        container.appendChild(div);
        
        setTimeout(() => {
            div.style.transition = "opacity 0.5s";
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 500);
        }, 3000);
    },

    shake: (elementId, intensity = 5) => {
        const el = document.getElementById(elementId);
        if(el) el.animate([
            { transform: `translateX(-${intensity}px)` }, 
            { transform: `translateX(${intensity}px)` }, 
            { transform: 'translateX(0)' }
        ], { duration: 300, easing: 'ease-in-out' });
    }
};

// =========================
// 5. STORAGE & UTILS
// =========================
export const OrkaStorage = {
    save: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    
    load: (key, defaultVal = null) => {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultVal;
    },
    
    // Atualiza status local do calendário (Vitória/Derrota/Jogado)
    updateCalendarStatus: (dateObj, status) => {
        const iso = dateObj.toISOString().split('T')[0];
        const stats = OrkaStorage.load('orka_calendar_global', {});
        stats[iso] = status;
        OrkaStorage.save('orka_calendar_global', stats);
    }
};

export const Utils = {
    // Normaliza strings para comparações (ex: "Maçã" -> "maca")
    normalize: (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "",
    
    // Toggle simples de classe CSS
    toggleModal: (id, show = true) => {
        const el = document.getElementById(id);
        if(!el) return;
        if(show) el.classList.add('active'); else el.classList.remove('active');
    },

    // Formata milissegundos para MM:SS
    formatTime: (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2,'0');
        const s = Math.floor(seconds % 60).toString().padStart(2,'0');
        return `${m}:${s}`;
    }
};

// =========================
// 6. MÓDULO UI: CALENDÁRIO (V2.0 - Gerenciado)
// =========================

/**
 * COMO IMPLEMENTAR O CALENDÁRIO:
 * ------------------------------
 * 1. No HTML, crie a estrutura do modal com os IDs necessários:
 * - Botão que abre: id="btn-calendar"
 * - Modal container: id="modal-calendar"
 * - Grid vazio: id="calendar-grid"
 * - Título do mês: id="calendar-title"
 * - Botões prev/next: id="btn-prev", id="btn-next" (Adicione class="calendar-nav-btn")
 * * 2. No JS do jogo, chame o bind apenas uma vez:
 * OrkaCalendar.bind({
 * triggerBtn: 'btn-calendar',
 * modalId: 'modal-calendar',
 * gridId: 'calendar-grid',
 * titleId: 'calendar-title',
 * prevBtn: 'btn-prev',
 * nextBtn: 'btn-next'
 * }, {
 * minDate: '2024-01-01',
 * getCurrentDate: () => gameState.dataAtual, // Função que retorna a data do jogo
 * onSelect: (date) => { iniciarJogo(date); fecharModal(); }
 * });
 */
export const OrkaCalendar = {
    state: {
        viewDate: new Date(),
        config: null
    },

    bind: (map, config = {}) => {
        const trigger = document.getElementById(map.triggerBtn);
        const prev = document.getElementById(map.prevBtn);
        const next = document.getElementById(map.nextBtn);
        
        OrkaCalendar.state.config = { ...map, ...config };
        
        // Abrir Calendário
        if (trigger) {
            trigger.addEventListener('click', () => {
                // Pega a data atual do jogo (se for função) ou usa hoje
                let target = new Date();
                if (typeof config.getCurrentDate === 'function') {
                    target = config.getCurrentDate();
                } else if (config.currentDate) {
                    target = config.currentDate;
                }
                
                OrkaCalendar.state.viewDate = new Date(target);
                OrkaCalendar.update();
                Utils.toggleModal(map.modalId, true);
            });
        }

        // Navegação
        if (prev) prev.onclick = () => OrkaCalendar.changeMonth(-1);
        if (next) next.onclick = () => OrkaCalendar.changeMonth(1);
    },

    changeMonth: (delta) => {
        OrkaCalendar.state.viewDate.setMonth(OrkaCalendar.state.viewDate.getMonth() + delta);
        OrkaCalendar.update();
    },

    update: () => {
        const { gridId, titleId } = OrkaCalendar.state.config;
        // Agora desestruturamos também o getDayClass
        const { minDate = '2024-01-01', onSelect, getDayClass } = OrkaCalendar.state.config;
        
        const grid = document.getElementById(gridId);
        const label = document.getElementById(titleId);
        if(!grid || !label) return;

        grid.innerHTML = "";
        
        const view = OrkaCalendar.state.viewDate;
        const year = view.getFullYear();
        const month = view.getMonth();
        
        const monthName = view.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        label.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toISOString().split('T')[0];

        // REMOVIDO: const history = OrkaStorage.load('orka_calendar_global', {}); <-- ISSO ERA O CULPADO

        // Dias vazios
        for(let i=0; i<firstDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            grid.appendChild(div);
        }

        // Dias preenchidos
        for(let d=1; d<=daysInMonth; d++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = d;
            
            const isoDate = new Date(year, month, d).toISOString().split('T')[0];
            
            // --- NOVO: Pergunta ao jogo qual a classe desse dia ---
            if (typeof getDayClass === 'function') {
                const statusClass = getDayClass(isoDate); // O jogo retorna 'win', 'lose' ou ''
                if (statusClass) div.classList.add(statusClass);
            }

            // Validação de data (Futuro ou Passado bloqueado)
            if (isoDate < minDate || isoDate > todayStr) {
                div.classList.add('disabled');
            } else {
                div.onclick = () => {
                    if(div.classList.contains('disabled')) return;
                    if(onSelect) onSelect(new Date(year, month, d));
                };
            }
            grid.appendChild(div);
        }
    }
};

// =========================
// 8. MÓDULO DE INTERNACIONALIZAÇÃO (I18N)
// =========================
export const OrkaI18n = {
    dictionary: {},
    currentLang: 'pt',

    // Inicializa e traduz a página automaticamente
    init: (dict, langOverride = null) => {
        OrkaI18n.dictionary = dict;
        
        // 1. Tenta pegar do Cloud, ou LocalStorage, ou usa PT padrão
        const savedLang = langOverride || OrkaCloud.getLanguage() || localStorage.getItem('orka_language') || 'pt-BR';
        OrkaI18n.currentLang = savedLang.startsWith('en') ? 'en' : 'pt';
        
        // 2. Aplica na hora
        OrkaI18n.updateDOM();
        
        return OrkaI18n.currentLang;
    },

    // Função t('chave') para usar dentro do JS
    t: (key) => {
        const langDict = OrkaI18n.dictionary[OrkaI18n.currentLang];
        return (langDict && langDict[key]) ? langDict[key] : key;
    },

    // Busca elementos com data-t="chave" e troca o texto
    updateDOM: () => {
        document.querySelectorAll("[data-t]").forEach(el => {
            const key = el.getAttribute("data-t");
            el.innerHTML = OrkaI18n.t(key); // innerHTML para permitir <b>bold</b>
        });
        
        // Atualiza placeholders de inputs
        document.querySelectorAll("[data-t-placeholder]").forEach(el => {
            const key = el.getAttribute("data-t-placeholder");
            el.placeholder = OrkaI18n.t(key);
        });
    },

    toggleLang: () => {
        OrkaI18n.currentLang = OrkaI18n.currentLang === 'pt' ? 'en' : 'pt';
        OrkaCloud.setLanguage(OrkaI18n.currentLang); // Salva na nuvem
        OrkaI18n.updateDOM();
        return OrkaI18n.currentLang;
    }
};

// =========================
// 9. MÓDULO UI: AUTOCOMPLETE (V3.2 - Deduplicação e Fix Setas)
// =========================
export const OrkaAutocomplete = {
    attach: (inputId, containerId, dataSource, onSubmit, config = {}) => {
        const input = document.getElementById(inputId);
        const box = document.getElementById(containerId);
        if(!input || !box) return;

        // Cleanup
        if (input._orkaHandlers) {
            input.removeEventListener("input", input._orkaHandlers.onInput);
            input.removeEventListener("keydown", input._orkaHandlers.onKeydown);
            document.removeEventListener("click", input._orkaHandlers.onClickOutside);
        }

        let currentFocus = -1;
        // Detecta se é array simples ou objetos
        const isSimpleArray = dataSource.length > 0 && typeof dataSource[0] === 'string';
        const keys = config.searchKeys || ['nome'];

        const getVal = (item) => {
            if (isSimpleArray) return item;
            if (typeof config.displayKey === 'function') return config.displayKey(item);
            const path = config.displayKey || 'nome';
            return path.split('.').reduce((o, i) => o[i], item);
        };

        const onInput = function() {
            const val = Utils.normalize(this.value);
            closeList();
            if (!val) return;
            currentFocus = -1;

            // 1. Filtra
            const rawMatches = dataSource.filter(item => {
                const itemStr = Utils.normalize(getVal(item));
                if (config.method === 'startsWith') return itemStr.startsWith(val);
                return itemStr.includes(val);
            });

            // 2. Ordena
            rawMatches.sort((a, b) => getVal(a).localeCompare(getVal(b)));

            // 3. Deduplica (Novo!)
            // Remove "gelo" se "Gelo" já entrou, baseando-se no valor normalizado
            const uniqueMatches = [];
            const seen = new Set();
            
            for (const item of rawMatches) {
                const normalized = Utils.normalize(getVal(item));
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    uniqueMatches.push(item);
                }
            }

            if (uniqueMatches.length > 0) {
                box.style.display = "block";
                // Limita a 5 sugestões
                uniqueMatches.slice(0, 5).forEach(match => {
                    const div = document.createElement("div");
                    div.className = "suggestion-item";
                    div.textContent = getVal(match); // Exibe o texto original do banco
                    div.addEventListener("click", () => {
                        input.value = getVal(match);
                        closeList();
                        onSubmit(match); 
                    });
                    box.appendChild(div);
                });
            }
        };

        const onKeydown = function(e) {
            let items = box.getElementsByClassName("suggestion-item");
            if (e.key === "ArrowDown") {
                e.preventDefault(); // Impede o cursor de andar no input
                currentFocus++;
                addActive(items);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                currentFocus--;
                addActive(items);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (currentFocus > -1 && items && items[currentFocus]) {
                    items[currentFocus].click();
                } else {
                    const val = Utils.normalize(input.value);
                    const exact = dataSource.find(item => Utils.normalize(getVal(item)) === val);
                    closeList();
                    onSubmit(exact || input.value); 
                }
            }
        };

        const onClickOutside = (e) => { if (e.target !== input && e.target !== box) closeList(); };

        function addActive(items) {
            if (!items || items.length === 0) return;
            Array.from(items).forEach(x => x.classList.remove("selected")); // OBS: Mudei de 'active' para 'selected' para bater com o CSS
            
            if (currentFocus >= items.length) currentFocus = 0;
            if (currentFocus < 0) currentFocus = (items.length - 1);
            
            items[currentFocus].classList.add("selected"); 
            items[currentFocus].scrollIntoView({block: "nearest"});
        }

        function closeList() {
            box.innerHTML = "";
            box.style.display = "none";
        }

        input.addEventListener("input", onInput);
        input.addEventListener("keydown", onKeydown);
        document.addEventListener("click", onClickOutside);
        input._orkaHandlers = { onInput, onKeydown, onClickOutside };
    },
    
    clear: (inputId) => {
        const el = document.getElementById(inputId);
        if(el) el.value = "";
    }
};

// =========================
// 10. MÓDULO UI: TUTORIAL PADRÃO (Atualizado)
// =========================
export const OrkaTutorial = {
    checkAndShow: (gameKey, content) => {
        if (localStorage.getItem(gameKey)) return;

        const modalId = 'orka-generic-tutorial';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay'; 
            document.body.appendChild(modal);
        }

        // Gera lista HTML limpa (<ul>)
        const stepsHtml = content.steps.map(s => `<li>${s}</li>`).join('');
        
        modal.innerHTML = `
            <div class="modal-content tutorial-box">
                <h2>${content.title}</h2>
                <div class="tutorial-body">
                    <ul class="tutorial-list">
                        ${stepsHtml}
                    </ul>
                </div>
                <button id="btn-close-tut" class="orka-btn orka-btn-primary orka-btn-xl">
                    ${content.btnText || 'ENTENDI'}
                </button>
            </div>
        `;

        setTimeout(() => modal.classList.add('active'), 100);

        const closeBtn = document.getElementById('btn-close-tut');
        closeBtn.onclick = () => {
            modal.classList.remove('active');
            localStorage.setItem(gameKey, 'true'); 
            setTimeout(() => modal.remove(), 500); 
        };
        closeBtn.focus();
    }
};

// =========================
// 11. MÓDULO UI GERAL (Alertas e Confirmações)
// =========================
export const OrkaUI = {
    // Modal de Confirmação Genérico
    confirm: (title, text, onConfirm) => {
        // Verifica se já existe, senão cria
        const modalId = 'orka-confirm-modal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:400px">
                    <h3 id="${modalId}-title" style="color:var(--status-wrong); margin-top:0"></h3>
                    <p id="${modalId}-text" style="color:#ccc; margin: 15px 0 25px 0"></p>
                    <div style="display:flex; gap:10px; justify-content:center">
                        <button id="${modalId}-cancel" class="orka-btn">CANCELAR</button>
                        <button id="${modalId}-ok" class="orka-btn orka-btn-primary" style="background:var(--status-wrong)">CONFIRMAR</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Popula textos
        document.getElementById(`${modalId}-title`).textContent = title;
        document.getElementById(`${modalId}-text`).textContent = text;
        
        // Configura Botões (Clonagem para limpar listeners antigos)
        const btnOk = document.getElementById(`${modalId}-ok`);
        const btnCancel = document.getElementById(`${modalId}-cancel`);
        
        const newOk = btnOk.cloneNode(true);
        const newCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newOk, btnOk);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        // Abre
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);

        // Ações
        const close = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        newCancel.addEventListener('click', close);
        newOk.addEventListener('click', () => {
            close();
            onConfirm();
        });
    }
};