import { OrkaCloud, supabase } from '../../core/scripts/orka-cloud.js';
import { OrkaFX } from '../../core/scripts/orka-lib.js';
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
    usedWords: [],
    
    // Controle de Teclado
    suggestionIndex: -1,
    currentSuggestions: []
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
const btnPlayAgain = document.getElementById('btn-play-again');

// --- INICIALIZAÇÃO ---
async function init() {
    setupLanguageButtons();
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) { inputs.roomCode.value = code; joinRoom(code); }
}

// --- UX: AUTOCOMPLETE & TECLADO ---

// 1. Input Texto
inputs.word.addEventListener('input', () => {
    const val = inputs.word.value.trim().toUpperCase();
    state.suggestionIndex = -1; // Reseta seleção

    if (val.length < 1) { 
        suggestionsBox.style.display = 'none'; 
        return; 
    }

    // Filtra e guarda no estado
    state.currentSuggestions = state.dictionary
        .filter(w => w.startsWith(val) && !state.usedWords.includes(w)) 
        .slice(0, 5); 

    renderSuggestions(state.currentSuggestions);
});

// 2. Navegação por Teclado (Keydown)
inputs.word.addEventListener('keydown', (e) => {
    if (suggestionsBox.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.suggestionIndex++;
        if (state.suggestionIndex >= state.currentSuggestions.length) state.suggestionIndex = 0; // Loop
        updateSuggestionHighlight();
    } 
    else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.suggestionIndex--;
        if (state.suggestionIndex < 0) state.suggestionIndex = state.currentSuggestions.length - 1; // Loop
        updateSuggestionHighlight();
    } 
    else if (e.key === 'Enter') {
        // Se tiver algo selecionado na lista, usa ele
        if (state.suggestionIndex > -1 && state.currentSuggestions[state.suggestionIndex]) {
            e.preventDefault();
            selectSuggestion(state.currentSuggestions[state.suggestionIndex]);
        }
        // Se não, o evento 'keypress' padrão cuida do envio
    }
});

function renderSuggestions(matches) {
    if (matches.length === 0) { suggestionsBox.style.display = 'none'; return; }
    
    suggestionsBox.innerHTML = '';
    matches.forEach((word, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = word;
        div.dataset.index = index; // Para referência
        
        div.onclick = () => selectSuggestion(word);
        suggestionsBox.appendChild(div);
    });
    suggestionsBox.style.display = 'block';
}

function updateSuggestionHighlight() {
    const items = suggestionsBox.querySelectorAll('.suggestion-item');
    items.forEach((item, idx) => {
        if (idx === state.suggestionIndex) {
            item.classList.add('selected');
            // Scroll suave se necessário
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectSuggestion(word) {
    inputs.word.value = word;
    suggestionsBox.style.display = 'none';
    state.suggestionIndex = -1;
    inputs.word.focus();
    // Opcional: Enviar direto ao selecionar? Melhor deixar o usuário dar Enter final.
}

// Fechar ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('#suggestions-box') && !e.target.closest('#word-input')) {
        suggestionsBox.style.display = 'none';
    }
});


// --- LÓGICA DE SALA ---

document.getElementById('btn-create').addEventListener('click', async () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data, error } = await supabase.from('jinx_rooms')
        .insert({ code, language: state.language, status: 'waiting', used_words: [] })
        .select().single();
    
    if (error) return OrkaFX.toast('Erro ao criar sala', 'error');
    
    state.isHost = true;
    enterRoom(data);
});

document.getElementById('btn-join').addEventListener('click', () => {
    const code = inputs.roomCode.value.toUpperCase();
    if (code.length < 4) return OrkaFX.toast('Código inválido', 'error');
    joinRoom(code);
});

document.getElementById('btn-leave').addEventListener('click', async () => {
    if(confirm("Sair da sala?")) {
        await supabase.from('jinx_room_players').delete().eq('player_id', state.playerId);
        window.location.reload();
    }
});

async function joinRoom(code) {
    const { data, error } = await supabase.from('jinx_rooms').select('*').eq('code', code).single();
    if (error || !data) return OrkaFX.toast('Sala não encontrada', 'error');
    enterRoom(data);
}

async function enterRoom(roomData) {
    state.roomId = roomData.id;
    state.roomCode = roomData.code;
    state.usedWords = roomData.used_words || [];
    setLang(roomData.language);
    
    await supabase.from('jinx_room_players').upsert({
        room_id: state.roomId, player_id: state.playerId, nickname: state.nickname
    }, { onConflict: 'player_id, room_id' });

    document.getElementById('display-code').innerText = state.roomCode;
    
    // Decide qual tela mostrar
    handleRoomStatus(roomData.status);
    
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
        // Se eu fui kickado (ex: sala deletada manualmente)
        if(payload.old.player_id === state.playerId) window.location.reload();
    }
    renderPlayers();
    checkMyStatus();
    checkGameLogic(); 
}

function handleRoomChange(payload) {
    // Atualiza palavras usadas
    if (payload.new.used_words) state.usedWords = payload.new.used_words;

    // Gerencia estados globais da sala
    handleRoomStatus(payload.new.status);
}

function handleRoomStatus(status) {
    if (status === 'waiting') {
        modalVictory.classList.remove('active'); // Fecha modal se estiver aberto
        modalVictory.style.display = 'none';
        state.round = 1;
        document.getElementById('round-counter').innerText = `RODADA 1`;
        showScreen('waiting');
    }
    else if (status === 'playing') {
        modalVictory.classList.remove('active');
        modalVictory.style.display = 'none';
        showScreen('game');
    }
    else if (status === 'finished') {
        if (!state.isHost) endGameUI(); 
    }
}


// --- GAMEPLAY ---

// Verifica estado local (destrava input se resetar rodada)
function checkMyStatus() {
    const myPlayer = state.players.find(p => p.player_id === state.playerId);
    if (myPlayer) {
        if (!myPlayer.is_ready && inputs.word.disabled && !modalVictory.classList.contains('active')) {
            inputs.word.disabled = false;
            inputs.word.value = '';
            inputs.word.focus();
            
            const st = document.getElementById('status-text');
            st.innerText = "NOVA TENTATIVA...";
            setTimeout(() => st.innerText = "SINCRONIA MENTAL", 1500);
        } else if (myPlayer.is_ready) {
            inputs.word.disabled = true;
        }
    }
}

// Lógica Host
async function checkGameLogic() {
    if (!state.isHost || state.players.length === 0) return;
    const allReady = state.players.every(p => p.is_ready);
    
    if (allReady) {
        setTimeout(async () => {
            const { data: currentPlayers } = await supabase.from('jinx_room_players').select('*').eq('room_id', state.roomId);
            const words = currentPlayers.map(p => p.current_word);
            const allMatch = words.every(w => w === words[0]);

            if (allMatch) {
                // VITÓRIA
                state.usedWords.push(words[0]); 
                await finishGame(words[0]);
            } else {
                // ERRO
                const newWords = words.filter(w => !state.usedWords.includes(w));
                state.usedWords.push(...newWords); 
                
                // Feedback visual de erro para todos (via status update poderia ser melhor, mas vamos no simples)
                // O resetRound já vai limpar tudo.
                await resetRound();
            }
        }, 3000);
    }
}

async function resetRound() {
    state.round++;
    document.getElementById('round-counter').innerText = `RODADA ${state.round}`;
    
    await supabase.from('jinx_rooms').update({ used_words: state.usedWords }).eq('id', state.roomId);
    await supabase.from('jinx_room_players').update({ is_ready: false, current_word: '' }).eq('room_id', state.roomId);
}

// --- ENVIO ---
async function sendWord() {
    const word = inputs.word.value.trim().toUpperCase();
    
    if (!state.dictionary.includes(word)) {
        flashError(); return;
    }
    if (state.usedWords.includes(word)) {
        OrkaFX.toast('Palavra já utilizada!', 'error');
        flashError(); return;
    }

    inputs.word.disabled = true;
    suggestionsBox.style.display = 'none';

    await supabase.from('jinx_room_players')
        .update({ is_ready: true, current_word: word })
        .eq('player_id', state.playerId).eq('room_id', state.roomId);
}

function flashError() {
    inputs.word.style.borderColor = 'var(--status-wrong)';
    OrkaFX.shake('word-input'); 
    setTimeout(() => inputs.word.style.borderColor = '#333', 500);
}


// --- FIM DE JOGO & REPLAY ---

async function finishGame(winningWord) {
    // 1. Histórico
    await supabase.from('jinx_room_history').insert({
        code: state.roomCode, player_names: state.players.map(p => p.nickname),
        rounds_count: state.round, result: 'win'
    });

    // 2. Status Finished
    await supabase.from('jinx_rooms')
        .update({ status: 'finished', used_words: state.usedWords })
        .eq('id', state.roomId);
    
    // 3. UI Host
    endGameUI(winningWord);

    // REMOVIDO: Auto-delete. A sala persiste para replay.
}

function endGameUI(word) {
    let finalWord = word;
    if (!finalWord && state.players.length > 0) finalWord = state.players[0].current_word;

    document.getElementById('final-round').innerText = state.round;
    document.getElementById('winning-word').innerText = finalWord || "JINX!";
    
    // Configura botões do Modal
    if (state.isHost) {
        btnPlayAgain.textContent = "Jogar Novamente";
        btnPlayAgain.disabled = false;
        btnPlayAgain.onclick = resetGameRoom; // Função de reset
    } else {
        btnPlayAgain.textContent = "Aguardando Host...";
        btnPlayAgain.disabled = true;
    }

    modalVictory.style.display = 'flex';
    setTimeout(() => modalVictory.classList.add('active'), 10);
    OrkaFX.confetti(); 
}

// --- FUNÇÃO DE RESET (REPLAY) ---
async function resetGameRoom() {
    // Reseta sala para 'waiting', limpa palavras usadas (novo jogo = tudo limpo?)
    // Geralmente num "Play Again" queremos zerar as palavras usadas.
    
    await supabase.from('jinx_rooms')
        .update({ status: 'waiting', used_words: [] }) // Zera palavras
        .eq('id', state.roomId);
        
    // Limpa status dos jogadores
    await supabase.from('jinx_room_players')
        .update({ is_ready: false, current_word: '' })
        .eq('room_id', state.roomId);
}


// --- RENDERIZAÇÃO ---
function renderPlayers() {
    const grid = document.getElementById('players-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const allReady = state.players.length > 0 && state.players.every(pl => pl.is_ready);

    const waitingList = document.getElementById('waiting-list');
    if (waitingList) {
        waitingList.innerHTML = state.players.map(p => `
            <div style="background:#222; padding:8px 15px; border-radius:20px; font-size:0.9rem; border:1px solid #333;">
                ${p.nickname}
            </div>
        `).join('');
        
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            if (state.isHost) {
                btnStart.style.display = 'block';
                btnStart.disabled = state.players.length < 2;
                if(state.players.length < 2) btnStart.textContent = "Aguardando Jogadores...";
                else btnStart.textContent = "COMEÇAR JOGO";
            } else {
                btnStart.style.display = 'none'; // Esconde se não for host
            }
        }
    }

    state.players.forEach(p => {
        const isMe = p.player_id === state.playerId;
        const isReady = p.is_ready;
        let displayWord = '...';
        let cardClass = 'player-card';

        if (isReady) { cardClass += ' ready'; if (!allReady) displayWord = 'PRONTO'; }
        if (allReady) { displayWord = p.current_word || ''; cardClass += ' revealed'; }

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

// Event Listeners
if (inputs.word) {
    inputs.word.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendWord(); });
}
document.getElementById('btn-send-word').addEventListener('click', sendWord);
document.getElementById('btn-start').addEventListener('click', async () => 
    await supabase.from('jinx_rooms').update({ status: 'playing' }).eq('id', state.roomId)
);

init();