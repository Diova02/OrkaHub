import { OrkaCloud, supabase } from '../../core/scripts/orka-cloud.js';
import { OrkaFX } from '../../core/scripts/orka-lib.js'; // Importando a Lib Visual
import { palavrasPT, palavrasEN } from './palavras.js';

// --- ESTADO LOCAL ---
let state = {
    roomId: null,
    roomCode: null,
    playerId: OrkaCloud.getPlayerId(),
    nickname: OrkaCloud.getNickname() || 'Anonimo',
    isHost: false,
    language: 'pt-BR',
    dictionary: palavrasPT,
    round: 1,
    players: [],
    usedWords: [] // Lista de palavras já usadas na sala
};

// --- DOM ELEMENTS ---
const screens = {
    lobby: document.getElementById('scene-lobby'),
    waiting: document.getElementById('scene-waiting'),
    game: document.getElementById('scene-game')
};

const inputs = {
    roomCode: document.getElementById('input-room-code'),
    word: document.getElementById('word-input')
};

const suggestionsBox = document.getElementById('suggestions-box');
const modalVictory = document.getElementById('modal-victory');

// --- INICIALIZAÇÃO ---
async function init() {
    setupLanguageButtons();
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) { inputs.roomCode.value = code; joinRoom(code); }
}

// --- AUTOCOMPLETE INTELIGENTE ---
inputs.word.addEventListener('input', () => {
    const val = inputs.word.value.trim().toUpperCase();
    if (val.length < 1) { suggestionsBox.style.display = 'none'; return; }

    // FILTRO: Começa com o texto digitado E NÃO está na lista de usadas
    const matches = state.dictionary
        .filter(w => w.startsWith(val) && !state.usedWords.includes(w)) 
        .slice(0, 5); 

    renderSuggestions(matches);
});

function renderSuggestions(matches) {
    if (matches.length === 0) { suggestionsBox.style.display = 'none'; return; }
    suggestionsBox.innerHTML = '';
    matches.forEach(word => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = word;
        div.onclick = () => {
            inputs.word.value = word;
            suggestionsBox.style.display = 'none';
            inputs.word.focus();
        };
        suggestionsBox.appendChild(div);
    });
    suggestionsBox.style.display = 'block';
}

// Fechar sugestões ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('#suggestions-box') && !e.target.closest('#word-input')) {
        suggestionsBox.style.display = 'none';
    }
});

// --- LÓGICA DE SALA ---
document.getElementById('btn-create').addEventListener('click', async () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    // Cria a sala já com array vazio de palavras usadas
    const { data, error } = await supabase.from('jinx_rooms')
        .insert({ code, language: state.language, status: 'waiting', used_words: [] })
        .select().single();
    
    if (error) return alert('Erro ao criar sala.');
    state.isHost = true;
    enterRoom(data);
});

document.getElementById('btn-join').addEventListener('click', () => {
    const code = inputs.roomCode.value.toUpperCase();
    if (code.length < 4) return;
    joinRoom(code);
});

async function joinRoom(code) {
    const { data, error } = await supabase.from('jinx_rooms').select('*').eq('code', code).single();
    if (error || !data) return alert('Sala não encontrada.');
    enterRoom(data);
}

async function enterRoom(roomData) {
    state.roomId = roomData.id;
    state.roomCode = roomData.code;
    state.usedWords = roomData.used_words || []; // Carrega histórico de palavras
    setLang(roomData.language);
    
    // Entra na sala (Upsert evita erro de duplicação se já tiver a constraint no banco)
    await supabase.from('jinx_room_players').upsert({
        room_id: state.roomId, player_id: state.playerId, nickname: state.nickname
    }, { onConflict: 'player_id, room_id' });

    document.getElementById('display-code').innerText = state.roomCode;
    showScreen(roomData.status === 'playing' ? 'game' : 'waiting');
    subscribeToRoom();
}

// --- REALTIME ---
function subscribeToRoom() {
    supabase.channel(`room:${state.roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jinx_room_players', filter: `room_id=eq.${state.roomId}` }, handlePlayerChange)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jinx_rooms', filter: `id=eq.${state.roomId}` }, handleRoomChange)
        .subscribe((status) => { if (status === 'SUBSCRIBED') fetchPlayers(); });
}

async function fetchPlayers() {
    const { data } = await supabase.from('jinx_room_players').select('*').eq('room_id', state.roomId);
    state.players = data;
    renderPlayers();
    checkMyStatus();
}

function handlePlayerChange(payload) {
    if (payload.eventType === 'INSERT') state.players.push(payload.new);
    else if (payload.eventType === 'UPDATE') {
        const index = state.players.findIndex(p => p.id === payload.new.id);
        if (index !== -1) state.players[index] = payload.new;
    } else if (payload.eventType === 'DELETE') {
        state.players = state.players.filter(p => p.id !== payload.old.id);
    }
    renderPlayers();
    checkMyStatus();
    checkGameLogic(); // Host verifica se todos jogaram
}

function handleRoomChange(payload) {
    if (payload.new.status === 'playing') showScreen('game');
    
    // Sincroniza palavras usadas (importante para quem entra depois ou perde sync)
    if (payload.new.used_words) {
        state.usedWords = payload.new.used_words;
    }

    if (payload.new.status === 'finished') {
        // Se não for host, mostra a tela de vitória quando o status muda
        if (!state.isHost) endGameUI(); 
    }
}

// --- GAMEPLAY LOCAL ---
function checkMyStatus() {
    const myPlayer = state.players.find(p => p.player_id === state.playerId);
    if (myPlayer) {
        // Se eu não estou pronto (is_ready=false) e meu input está travado -> DESTRAVA
        if (!myPlayer.is_ready && inputs.word.disabled && !modalVictory.classList.contains('active')) {
            inputs.word.disabled = false;
            inputs.word.value = '';
            inputs.word.focus();
            
            // Feedback visual sutil de nova rodada
            const statusText = document.getElementById('status-text');
            if(statusText) {
                const originalText = statusText.innerText;
                statusText.innerText = "NOVA TENTATIVA...";
                setTimeout(() => statusText.innerText = "SINCRONIA MENTAL", 1500);
            }
        } else if (myPlayer.is_ready) {
            inputs.word.disabled = true;
        }
    }
}

// --- LÓGICA DO HOST (SERVIDOR) ---
async function checkGameLogic() {
    if (!state.isHost || state.players.length === 0) return;
    const allReady = state.players.every(p => p.is_ready);
    
    if (allReady) {
        setTimeout(async () => {
            // Re-busca para garantir dados frescos
            const { data: currentPlayers } = await supabase.from('jinx_room_players').select('*').eq('room_id', state.roomId);
            const words = currentPlayers.map(p => p.current_word);
            
            // Verifica se todos são iguais ao primeiro
            const allMatch = words.every(w => w === words[0]);

            if (allMatch) {
                // VITÓRIA!
                state.usedWords.push(words[0]); 
                await finishGame(words[0]);
            } else {
                // FALHA -> Queima as palavras e reseta
                // Filtra para adicionar apenas novas ao array de usadas
                const newWords = words.filter(w => !state.usedWords.includes(w));
                state.usedWords.push(...newWords); 
                await resetRound();
            }
        }, 3000); // 3s de suspense
    }
}

async function resetRound() {
    state.round++;
    document.getElementById('round-counter').innerText = `RODADA ${state.round}`;
    
    // 1. Atualiza lista de proibidas na Sala
    await supabase.from('jinx_rooms').update({ used_words: state.usedWords }).eq('id', state.roomId);
    
    // 2. Reseta status dos jogadores (isso dispara o checkMyStatus nos clientes)
    await supabase.from('jinx_room_players').update({ is_ready: false, current_word: '' }).eq('room_id', state.roomId);
}

// --- ENVIO DA PALAVRA ---
async function sendWord() {
    const word = inputs.word.value.trim().toUpperCase();
    
    // Validação 1: Existe no Dicionário?
    if (!state.dictionary.includes(word)) {
        flashError(); return;
    }
    // Validação 2: Já foi usada?
    if (state.usedWords.includes(word)) {
        alert('Essa palavra já foi usada!'); 
        flashError(); return;
    }

    inputs.word.disabled = true;
    if(suggestionsBox) suggestionsBox.style.display = 'none';

    await supabase.from('jinx_room_players')
        .update({ is_ready: true, current_word: word })
        .eq('player_id', state.playerId).eq('room_id', state.roomId);
}

function flashError() {
    inputs.word.style.borderColor = 'var(--status-wrong)';
    OrkaFX.shake('word-input'); // Usa o shake da lib se quiser, ou CSS
    setTimeout(() => inputs.word.style.borderColor = '#333', 500);
}

// --- FIM DE JOGO ---
async function finishGame(winningWord) {
    // 1. Salva histórico
    await supabase.from('jinx_room_history').insert({
        code: state.roomCode, 
        player_names: state.players.map(p => p.nickname),
        rounds_count: state.round, 
        result: 'win'
    });

    // 2. Marca sala como finalizada e salva última palavra
    await supabase.from('jinx_rooms')
        .update({ status: 'finished', used_words: state.usedWords })
        .eq('id', state.roomId);
    
    // 3. Mostra vitória para o Host imediatamente
    endGameUI(winningWord);

    // 4. Agenda autodestruição da sala
    setTimeout(async () => {
        await supabase.from('jinx_rooms').delete().eq('id', state.roomId);
    }, 10000); 
}

function endGameUI(word) {
    let finalWord = word;
    // Se o cliente não recebeu a palavra (não é host), tenta pegar do estado local
    if (!finalWord && state.players.length > 0) {
        finalWord = state.players[0].current_word;
    }

    document.getElementById('final-round').innerText = state.round;
    document.getElementById('winning-word').innerText = finalWord || "JINX!";
    
    modalVictory.style.display = 'flex';
    modalVictory.classList.add('active');

    // --- AQUI ESTÁ A INTEGRAÇÃO COM A LIB ---
    OrkaFX.confetti(); 
}

// --- RENDERIZAÇÃO E UTILITÁRIOS ---
function renderPlayers() {
    const grid = document.getElementById('players-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const allReady = state.players.length > 0 && state.players.every(pl => pl.is_ready);

    // Lista de Espera
    const waitingList = document.getElementById('waiting-list');
    if (waitingList) {
        waitingList.innerHTML = state.players.map(p => `<div style="background:#111; padding:10px; border-radius:4px; display:inline-block; margin:5px;">${p.nickname}</div>`).join('');
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            if (state.isHost && state.players.length >= 2) btnStart.disabled = false;
            else btnStart.disabled = true;
        }
    }

    // Grid Principal
    state.players.forEach(p => {
        const isMe = p.player_id === state.playerId;
        const isReady = p.is_ready;
        let displayWord = '...';
        let cardClass = 'player-card';

        if (isReady) {
            cardClass += ' ready';
            if (!allReady) displayWord = 'PRONTO';
        }
        if (allReady) {
            displayWord = p.current_word || '';
            cardClass += ' revealed';
        }

        grid.innerHTML += `
            <div class="${cardClass}">
                <div class="player-avatar"><span class="material-icons" style="color:#666; font-size:32px;">${isReady ? 'check_circle' : 'person'}</span></div>
                <div class="player-nick" style="color:${isMe ? 'var(--orka-accent)' : '#888'}">${p.nickname}</div>
                <div class="player-word-display">${displayWord}</div>
            </div>`;
    });
}

function showScreen(name) {
    Object.values(screens).forEach(s => s.style.display = 'none');
    screens[name].style.display = 'flex';
}

function setupLanguageButtons() {
    const btnPt = document.getElementById('btn-lang-pt');
    const btnEn = document.getElementById('btn-lang-en');
    if(btnPt) btnPt.onclick = () => setLang('pt-BR');
    if(btnEn) btnEn.onclick = () => setLang('en-US');
}

function setLang(lang) {
    state.language = lang;
    state.dictionary = (lang === 'en-US') ? palavrasEN : palavrasPT;
    const btnPt = document.getElementById('btn-lang-pt');
    const btnEn = document.getElementById('btn-lang-en');
    
    if (btnPt && btnEn) {
        if(lang === 'pt-BR') {
            btnPt.style.background = 'var(--orka-accent)'; btnPt.style.color = 'white';
            btnEn.style.background = '#222'; btnEn.style.color = '#888';
        } else {
            btnEn.style.background = 'var(--orka-accent)'; btnEn.style.color = 'white';
            btnPt.style.background = '#222'; btnPt.style.color = '#888';
        }
    }
}

// --- EVENTOS FINAIS ---
if (inputs.word) {
    inputs.word.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendWord(); });
}
const btnSend = document.getElementById('btn-send-word');
if (btnSend) btnSend.addEventListener('click', sendWord);

const btnStart = document.getElementById('btn-start');
if (btnStart) btnStart.addEventListener('click', async () => await supabase.from('jinx_rooms').update({ status: 'playing' }).eq('id', state.roomId));

// Iniciar
init();