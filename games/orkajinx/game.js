import { OrkaGameManager } from '../../core/scripts/orka-game-manager.js';
import { OrkaCloud } from '../../core/scripts/orka-cloud.js';
import { OrkaFX, OrkaUI, OrkaI18n, OrkaAutocomplete, Utils } from '../../core/scripts/orka-lib.js';
import Traducao from './trad.js';
import { palavrasPT, palavrasEN } from './palavras.js';

// --- INSTÂNCIA DO GERENTE ---
const GAME_ID = 'jinx';
const Game = new OrkaGameManager({
    gameId: GAME_ID,
    enforceLogin: true, // Garante que tem Nick e Avatar antes de entrar
    heartbeatInterval: 60000 
});

// Acesso ao Supabase para Realtime (via getter seguro)
const supabase = OrkaCloud.getClient ? OrkaCloud.getClient() : null;
if (!supabase) console.error("FATAL: OrkaCloud V5 precisa exportar getClient() para jogos multiplayer!");

// --- ESTADO ---
let state = {
    roomId: null,
    roomCode: null,
    playerId: null,
    nickname: 'Anonimo',
    avatar: 'default', 
    isHost: false,
    hostId: null,
    language: 'pt-BR',
    dictionary: palavrasPT,
    round: 1,
    players: [],
    usedWords: [],
    timeLimit: 90,
    roundStartTime: null,
    timerInterval: null,
};

const screens = {
    lobby: document.getElementById('scene-lobby'),
    waiting: document.getElementById('scene-waiting'),
    game: document.getElementById('scene-game')
};
const inputs = {
    roomCode: document.getElementById('input-room-code'),
    word: document.getElementById('word-input')
};
const modalVictory = document.getElementById('modal-victory');
const btnPlayAgain = document.getElementById('btn-play-again');

// --- INICIALIZAÇÃO PADRONIZADA (V5) ---

async function init() {
    // 1. O Manager resolve Auth, Nick, Avatar e Sessão
    const { profile, user } = await Game.init();
    
    state.playerId = user.id;
    state.nickname = profile.nickname;
    state.avatar = profile.profile_image || 'default'; // V5 usa profile_image
    
    // 2. Configurações de Língua
    const cloudLang = profile.language || 'pt-BR';
    const langCode = cloudLang.startsWith('en') ? 'en' : 'pt';
    OrkaI18n.init(Traducao, langCode);
    setInternalLang(cloudLang);
    setupLanguageButtons();

    setupAutocomplete();

    // Entra direto se tiver código na URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) { inputs.roomCode.value = code; joinRoom(code); }
}

function setupAutocomplete() {
    OrkaAutocomplete.attach(
        'word-input',
        'suggestions-box',
        state.dictionary,
        (selectedWord) => {
            inputs.word.value = selectedWord;
            sendWord();
        },
        { method: 'startsWith', searchKeys: [] } 
    );
}

function setupLanguageButtons() {
    const btnPt = document.getElementById('btn-lang-pt');
    const btnEn = document.getElementById('btn-lang-en');
    if(btnPt) btnPt.onclick = () => { setInternalLang('pt-BR'); OrkaI18n.init(Traducao, 'pt'); };
    if(btnEn) btnEn.onclick = () => { setInternalLang('en-US'); OrkaI18n.init(Traducao, 'en'); };
}

function setInternalLang(fullLang) {
    state.language = fullLang;
    state.dictionary = (fullLang === 'en-US') ? palavrasEN : palavrasPT;
    
    const btnPt = document.getElementById('btn-lang-pt');
    const btnEn = document.getElementById('btn-lang-en');
    const active = 'background:var(--orka-accent); color:white; border-color:var(--orka-accent);';
    const inactive = 'background:#111; color:#666; border-color:#333;';
    
    if (btnPt) btnPt.style.cssText = fullLang === 'pt-BR' ? active : inactive;
    if (btnEn) btnEn.style.cssText = fullLang === 'en-US' ? active : inactive;

    setupAutocomplete();
    // Atualiza preferência no perfil global via V5
    OrkaCloud.updateProfile({ language: fullLang });
}

// --- LÓGICA DE SALA ---

document.getElementById('btn-create').addEventListener('click', async () => {
    if(!state.playerId) return OrkaFX.toast("Conectando...", "info");

    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data, error } = await supabase.from('jinx_rooms')
        .insert({ 
            code, 
            language: state.language, 
            status: 'waiting', 
            used_words: [], 
            current_round: 1, 
            time_limit: 90, 
            round_start_time: new Date() 
        })
        .select().single();
    
    if (error) return OrkaFX.toast(OrkaI18n.t('errCreate'), 'error');
    
    // Checkpoint: Criou sala
    Game.checkpoint({ action: 'create_room', room_code: code });
    enterRoom(data);
});

document.getElementById('btn-join').addEventListener('click', () => {
    const code = inputs.roomCode.value.toUpperCase();
    if (code.length < 4) return OrkaFX.toast(OrkaI18n.t('errCode'), 'error');
    joinRoom(code);
});

document.getElementById('btn-leave').addEventListener('click', () => {
    OrkaUI.confirm(OrkaI18n.t('leaveTitle'), OrkaI18n.t('leaveMsg'), async () => await leaveRoomLogic());
});

async function joinRoom(code) {
    const { data, error } = await supabase.from('jinx_rooms').select('*').eq('code', code).single();
    if (error || !data) return OrkaFX.toast(OrkaI18n.t('errNotFound'), 'error');
    
    Game.checkpoint({ action: 'join_room', room_code: code });
    enterRoom(data);
}

async function enterRoom(roomData) {
    state.roomId = roomData.id;
    state.roomCode = roomData.code;
    state.usedWords = roomData.used_words || [];
    
    setInternalLang(roomData.language);
    const shortLang = roomData.language.startsWith('en') ? 'en' : 'pt';
    OrkaI18n.init(Traducao, shortLang);
    
    // Avatar Full URL (O V5 já tratou se é default ou custom)
    const avatarUrl = state.avatar.includes('/') ? state.avatar : `../../assets/avatars/${state.avatar}.png`;

    await supabase.from('jinx_room_players').upsert({
        room_id: state.roomId, 
        player_id: state.playerId, 
        nickname: state.nickname, 
        profile_image: avatarUrl, 
        last_word: ''
    }, { onConflict: 'player_id, room_id' });

    document.getElementById('display-code').innerText = state.roomCode;
    handleRoomUpdate(roomData); 
    subscribeToRoom();
}

async function leaveRoomLogic() {
    if (!state.roomId) return;
    
    Game.checkpoint({ action: 'leave_room' });

    if (state.isHost) {
        // Host deleta a sala (idealmente deveria migrar host, mas deletar é mais seguro pra MVP)
        await supabase.from('jinx_rooms').delete().eq('id', state.roomId);
    } else {
        await supabase.from('jinx_room_players').delete().eq('player_id', state.playerId);
    }
    
    // Encerra sessão do jogo atual e volta pro hub
    Game.endGame('abandoned');
    window.location.href = '../../index.html'; 
}

// O Manager cuida do beacon, mas precisamos limpar a sala no DB
window.addEventListener('beforeunload', () => {
    if (state.roomId) {
        const table = state.isHost ? 'jinx_rooms' : 'jinx_room_players';
        const key = state.isHost ? 'id' : 'player_id';
        const val = state.isHost ? state.roomId : state.playerId;
        // Tenta limpar (fetch keepalive seria melhor aqui também, mas supabase js client já tenta)
        supabase.from(table).delete().eq(key, val).then();
    }
});

// --- REALTIME ---

function subscribeToRoom() {
    const channel = supabase.channel(`room:${state.roomId}`);
    channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jinx_room_players', filter: `room_id=eq.${state.roomId}` }, handlePlayerChange)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jinx_room_players' }, handlePlayerChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jinx_rooms', filter: `id=eq.${state.roomId}` }, handleRoomChange) 
        .subscribe((status) => { if (status === 'SUBSCRIBED') fetchPlayers(); });
}

async function fetchPlayers() {
    const { data } = await supabase.from('jinx_room_players')
        .select('*').eq('room_id', state.roomId).order('joined_at', { ascending: true });
    state.players = data || [];
    determineHost();
    renderPlayers();
    checkMyStatus();
}

function determineHost() {
    if (state.players.length > 0) {
        state.hostId = state.players[0].player_id;
        state.isHost = (state.hostId === state.playerId);
    }
}

function handlePlayerChange(payload) {
    if (payload.eventType === 'INSERT') {
        if (!state.players.find(p => p.id === payload.new.id)) {
            state.players.push(payload.new);
            OrkaFX.toast(`${payload.new.nickname} ${OrkaI18n.t('joined')}`, 'info');
        }
    } else if (payload.eventType === 'UPDATE') {
        const index = state.players.findIndex(p => p.id === payload.new.id);
        if (index !== -1) state.players[index] = payload.new;
    } else if (payload.eventType === 'DELETE') {
        const pExists = state.players.find(p => p.id === payload.old.id);
        if (pExists) {
            state.players = state.players.filter(p => p.id !== payload.old.id);
            OrkaFX.toast(`${pExists.nickname} ${OrkaI18n.t('left')}`, 'default');
            if(payload.old.player_id === state.playerId) window.location.href = '../../index.html';
        }
    }
    determineHost(); renderPlayers(); checkMyStatus(); checkGameLogic(); 
    updateVictoryModalUI();
}

function handleRoomChange(payload) {
    if (payload.eventType === 'DELETE') {
        OrkaFX.toast(OrkaI18n.t('roomClosed'), 'warning');
        setTimeout(() => window.location.href = '../../index.html', 2000);
        return;
    }
    handleRoomUpdate(payload.new);
}

function handleRoomUpdate(roomData) {
    if (!roomData) return;
    if (roomData.current_round) {
        state.round = roomData.current_round;
        const ctr = document.getElementById('round-counter');
        if(ctr) ctr.innerText = `${OrkaI18n.t('round')} ${roomData.current_round}`;
    }
    if (roomData.used_words) state.usedWords = roomData.used_words;
    
    if (roomData.round_start_time) {
        state.roundStartTime = roomData.round_start_time;
        state.timeLimit = roomData.time_limit || 90;
        if (roomData.status === 'playing') startLocalTimer();
    }

    if (roomData.status === 'waiting') {
        Utils.toggleModal('modal-victory', false);
        showScreen('waiting');
    } else if (roomData.status === 'playing') {
        Utils.toggleModal('modal-victory', false);
        showScreen('game');
    } else if (roomData.status === 'finished' && !state.isHost) {
        showEndModal('win'); 
    } else if (roomData.status === 'timeout') {
        showEndModal('loss');
    }
}

function checkMyStatus() {
    const myPlayer = state.players.find(p => p.player_id === state.playerId);
    if (myPlayer) {
        if (!myPlayer.is_ready && inputs.word.disabled && !modalVictory.classList.contains('active')) {
            inputs.word.disabled = false; inputs.word.value = ''; inputs.word.focus();
        } else if (myPlayer.is_ready) {
            inputs.word.disabled = true;
        }
    }
}

async function checkGameLogic() {
    if (!state.isHost || state.players.length === 0) return;
    const allReady = state.players.every(p => p.is_ready);
    
    if (allReady) {
        const { data: currentPlayers } = await supabase.from('jinx_room_players').select('*').eq('room_id', state.roomId);
        if(!currentPlayers) return; 

        const words = currentPlayers.map(p => p.current_word);
        const allMatch = words.every(w => w === words[0]);

        if (allMatch) {
            OrkaFX.confetti(); 
            setTimeout(async () => {
                state.usedWords.push(words[0]); 
                await finishGame(words[0]);
            }, 800);
        } else {
            const newWords = words.filter(w => !state.usedWords.includes(w));
            state.usedWords.push(...newWords); 
            setTimeout(showNextRoundButton, 1500);
        }
    }
}

async function resetRound() {
    const nextRound = (state.round || 1) + 1;
    const promises = state.players.map(p => supabase.from('jinx_room_players').update({ is_ready: false, last_word: p.current_word || '', current_word: '' }).eq('id', p.id));
    await Promise.all(promises);
    await supabase.from('jinx_rooms').update({ used_words: state.usedWords, current_round: nextRound, round_start_time: new Date() }).eq('id', state.roomId);
    
    Game.checkpoint({ action: 'next_round', round: nextRound });
}

async function resetGameRoom() {
    if (state.players.length < 2) return OrkaFX.toast("Esperando jogadores...", "warning");

    await supabase.from('jinx_rooms')
        .update({ status: 'waiting', used_words: [], current_round: 1 })
        .eq('id', state.roomId);
        
    const updatePromises = state.players.map(p => 
        supabase.from('jinx_room_players')
            .update({ is_ready: false, current_word: '', last_word: '' })
            .eq('id', p.id)
    );
    await Promise.all(updatePromises);
    
    Game.checkpoint({ action: 'reset_game' });
}

async function sendWord() {
    const rawInput = inputs.word.value.trim();
    let finalWord = Utils.normalize(rawInput).toUpperCase(); 
    const normalizedInput = Utils.normalize(rawInput);
    const match = state.dictionary.find(w => Utils.normalize(w) === normalizedInput);
    
    if (match) {
        finalWord = match; 
    } else {
        OrkaFX.toast(OrkaI18n.t('unknownWord'), 'error');
        OrkaFX.shake('word-input');
        return;
    }

    if (state.usedWords.includes(finalWord)) { 
        OrkaFX.toast(OrkaI18n.t('usedWord'), 'error'); 
        OrkaFX.shake('word-input');
        return; 
    }

    inputs.word.disabled = true;
    OrkaAutocomplete.clear('word-input');

    await supabase.from('jinx_room_players')
        .update({ is_ready: true, current_word: finalWord })
        .eq('player_id', state.playerId).eq('room_id', state.roomId);
        
    // Checkpoint pessoal: Palavra enviada
    Game.checkpoint({ action: 'word_sent', word_length: finalWord.length });
}

async function finishGame(winningWord) {
    // Vitória no Jinx!
    // Aqui usamos 'win' para Analytics, mas Jinx não tem Daily Reward nem Leaderboard pessoal
    // então o Game.endGame serve mais para fechar a sessão com sucesso.
    Game.endGame('win', { 
        rounds_played: state.round, 
        players_count: state.players.length,
        role: state.isHost ? 'host' : 'guest',
        winning_word: winningWord
    });
    
    await supabase.from('jinx_rooms').update({ status: 'finished', used_words: state.usedWords }).eq('id', state.roomId);
    showEndModal('win', winningWord);
}

function showEndModal(type, word = null) {
    clearInterval(state.timerInterval);
    const timerDisplay = document.getElementById('timer-display');
    if(timerDisplay) timerDisplay.classList.remove('panic'); 

    const icon = modalVictory.querySelector('.victory-icon');
    const title = modalVictory.querySelector('.victory-title');
    const subtitle = modalVictory.querySelector('.victory-subtitle');
    const wordBox = document.getElementById('winning-word');
    
    if (type === 'win') {
        modalVictory.querySelector('.modal-content').classList.remove('defeat-mode');
        icon.innerText = "✨";
        title.innerText = OrkaI18n.t('winTitle');
        subtitle.innerHTML = OrkaI18n.t('winSub').replace('{round}', state.round);
        
        let finalWord = word;
        if (!finalWord && state.players.length > 0) finalWord = state.players[0].current_word;
        wordBox.innerText = finalWord || "JINX!";
        OrkaFX.confetti(); 
    } else {
        modalVictory.querySelector('.modal-content').classList.add('defeat-mode');
        icon.innerText = "💀";
        title.innerText = OrkaI18n.t('loseTitle');
        subtitle.innerHTML = OrkaI18n.t('loseSub').replace('{round}', state.round);
        wordBox.innerText = OrkaI18n.t('timeout');
    }

    updateVictoryModalUI();
    modalVictory.style.display = 'flex';
    setTimeout(() => modalVictory.classList.add('active'), 10);
}

function updateVictoryModalUI() {
    if (state.isHost) {
        btnPlayAgain.textContent = OrkaI18n.t('playAgain');
        btnPlayAgain.disabled = state.players.length < 2;
        if(state.players.length < 2) btnPlayAgain.textContent = OrkaI18n.t('waitingStart');
        btnPlayAgain.onclick = resetGameRoom; 
    } else {
        btnPlayAgain.textContent = OrkaI18n.t('waitingHost');
        btnPlayAgain.disabled = true;
    }
}

function startLocalTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.round === 1) {
         const timerDisplay = document.getElementById('timer-display');
         if(timerDisplay) timerDisplay.innerText = "00:00"; 
         return;
    }

    let isTimeoutProcessing = false;
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return;

    state.timerInterval = setInterval(() => {
        if (!state.roundStartTime) return;
        const now = new Date().getTime();
        const start = new Date(state.roundStartTime).getTime();
        const diff = (start + (state.timeLimit * 1000)) - now;

        if (diff <= 0) {
            clearInterval(state.timerInterval); 
            timerDisplay.innerText = "00:00";
            timerDisplay.classList.add('panic');
            
            if (!inputs.word.disabled) {
                inputs.word.disabled = true;
                OrkaFX.shake('game-app');
            }
            
            if (state.isHost && !isTimeoutProcessing) {
                isTimeoutProcessing = true;
                supabase.from('jinx_rooms').update({ status: 'timeout' }).eq('id', state.roomId).then();
                Game.endGame('lose', { reason: 'timeout' }); // Registra derrota por tempo
            }
        } else {
            const totalSeconds = Math.ceil(diff / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timerDisplay.innerText = `${minutes < 10 ? '0'+minutes : minutes}:${seconds < 10 ? '0'+seconds : seconds}`;
            if (diff < 10000) timerDisplay.classList.add('panic'); else timerDisplay.classList.remove('panic');
        }
    }, 250);
}

function renderPlayers() {
    const grid = document.getElementById('players-grid');
    if (!grid) return; grid.innerHTML = '';
    
    const allReady = state.players.length > 0 && state.players.every(pl => pl.is_ready);
    let isWin = false;
    if(allReady) {
        const words = state.players.map(p => p.current_word);
        isWin = words.every(w => w === words[0]);
    }

    const waitingList = document.getElementById('waiting-list');
    if (waitingList) {
        waitingList.innerHTML = state.players.map(p => `
            <div style="background:#222; padding:8px 15px; border-radius:20px; font-size:0.9rem; border:1px solid #333; display:flex; align-items:center; gap:5px;">
                ${p.player_id === state.hostId ? '👑' : ''} ${p.nickname}
            </div>`).join('');
        
        const btnStart = document.getElementById('btn-start');
        if (btnStart && state.isHost) {
            btnStart.style.display = 'block';
            btnStart.disabled = state.players.length < 2;
            btnStart.textContent = state.players.length < 2 ? OrkaI18n.t('waitingStart') : OrkaI18n.t('startGame');
        } else if (btnStart) {
            btnStart.style.display = 'none';
        }
    }

    state.players.forEach(p => {
        const isMe = p.player_id === state.playerId;
        const isReady = p.is_ready;
        let displayWord = '...';
        let cardClass = 'player-card';

        if (isReady) { cardClass += ' ready'; if (!allReady) displayWord = OrkaI18n.t('youAreReady'); }
        if (allReady) { displayWord = p.current_word || ''; cardClass += ' revealed'; if (isWin) cardClass += ' winner'; }

        // Render Avatar
        const avatarHtml = p.profile_image && p.profile_image.includes('/') 
            ? `<img src="${p.profile_image}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
            : `<span class="material-icons" style="color:#666; font-size:32px;">${isReady ? 'check_circle' : 'person'}</span>`;

        grid.innerHTML += `
            <div class="${cardClass}">
                <div class="player-avatar">
                    ${p.player_id === state.hostId ? '<div class="host-crown">👑</div>' : ''}
                    ${avatarHtml}
                </div>
                <div class="player-nick" style="color:${isMe ? 'var(--orka-accent)' : '#888'}">${p.nickname}</div>
                <div class="player-word-display">${displayWord}</div>
                <div class="last-word-display">${p.last_word || ''}</div>
            </div>`;
    });
}

function showScreen(name) {
    Object.values(screens).forEach(s => s.style.display = 'none');
    screens[name].style.display = 'flex';
}

document.getElementById('btn-send-word').addEventListener('click', sendWord);
document.getElementById('btn-start').addEventListener('click', async () => await supabase.from('jinx_rooms').update({ status: 'playing' }).eq('id', state.roomId));

function showNextRoundButton() {
    const oldBtn = document.getElementById('btn-next-round-dynamic');
    if (oldBtn) oldBtn.remove();
    const btn = document.createElement('button');
    btn.id = 'btn-next-round-dynamic';
    btn.innerHTML = `<span class="material-icons" style="vertical-align:middle; margin-right:5px;">fast_forward</span> ${OrkaI18n.t('nextRound')} (5)`;
    btn.className = 'orka-btn btn-next-glow'; 
    btn.style.cssText = `position:fixed; bottom:15%; left:50%; transform:translateX(-50%); z-index:9999; padding:12px 30px; border-radius:50px; border:2px solid white; font-weight:bold; color:white; animation: popInElastic 0.5s forwards;`;
    document.body.appendChild(btn);
    let countdown = 5;
    let autoTimer = null;
    const goNext = () => { clearInterval(autoTimer); btn.style.opacity = '0'; setTimeout(() => btn.remove(), 200); resetRound(); };
    btn.onclick = goNext;
    autoTimer = setInterval(() => {
        countdown--;
        btn.innerHTML = `<span class="material-icons" style="vertical-align:middle; margin-right:5px;">fast_forward</span> ${OrkaI18n.t('nextRound')} (${countdown})`;
        if (countdown <= 0) goNext();
    }, 1000);
}

init();