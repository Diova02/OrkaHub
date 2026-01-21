import { OrkaCloud, supabase } from './core/scripts/orka-cloud.js';
import { OrkaFX } from './core/scripts/orka-lib.js'; 

export const gamesList = [
    { id: 'zoo', type: 'daily', title: 'ORKA ZOO', descKey: 'game_zoo_desc', icon: 'zoo-logo.png', print: 'print-zoo.png', url: 'games/orkazoo/', releaseDate: '2026-01-05', active: true },
    { id: 'jinx', type: 'web', title: 'ORKA JINX', descKey: 'game_jinx_desc', icon: 'jinx-logo.png', print: 'print-jinx.png', url: 'games/orkajinx/', releaseDate: '2026-01-13', active: true },
    { id: 'eagle', type: 'web', title: 'EAGLE AIM', descKey: 'game_eagle_desc', icon: 'eagle-logo.png', print: 'print-eagle.png', url: 'games/eagleaim/', releaseDate: '2026-01-17', active: true },
    // Jogos em breve
    { id: 'listit', type: 'soon', title: 'LISTIT', descKey: 'game_listit_desc', icon: null, print: null, url: '#', active: false },
    { id: 'disco', type: 'soon', title: 'DISCOMANIA', descKey: 'game_disco_desc', icon: null, print: null, url: '#', active: false },
    { id: 'firewall', type: 'soon', title: 'FIREWALL', descKey: 'game_firewall_desc', icon: null, print: null, url: '#', active: false }
];

// --- TRADUÇÕES CENTRALIZADAS ---
export const translations = {
    'pt': {
        // UI Geral
        loaderTitle: "CARREGANDO...",
        tabGames: "JOGOS", tabAbout: "SOBRE", tabAdmin: "ADMIN",
        dailyGames: "Jogos Diários", webGames: "Jogos Web", pnpGames: "PnP", soonGames: "Nos próximos episódios...",
        aboutTitle: "SOBRE A ORKA", aboutText: "Somos um estúdio focado em experiências web simples e divertidas.",
        footerCopy: "© 2026 Orka Studio. Todos os direitos reservados.",
        emptyMsg: "Nada aqui ainda!",

        // Perfil e Auth
        profileBtn: "Configurar Perfil", profileTitle: "PERFIL", nickLabel: "Seu Apelido", langLabel: "Idioma / Language",
        readyBtn: "Tudo pronto, {nick}!", addNick: "Adicionar Nickname",
        langDesc: "Jogos usarão esta preferência automaticamente.",
        syncLabel: "Sincronizar (Login)", syncDesc: "Receba um código por e-mail para salvar seu progresso.",
        authSent: "Código enviado! Cheque seu e-mail.",
        authSuccess: "Login realizado com sucesso!",
        authError: "Erro. Tente novamente.",
        
        // Jogos
        game_zoo_desc: "Descubra o animal do dia.",
        game_jinx_desc: "Leia a mente alheia.",
        game_listit_desc: "Deduza a ordem do dia.",
        game_disco_desc: "Descubra a música do dia.",
        game_eagle_desc: "Atire o mais rápido que puder.",
        game_firewall_desc: "Evolua seu poderoso canhão."
    },
    'en': {
        loaderTitle: "LOADING...",
        tabGames: "GAMES", tabAbout: "ABOUT", tabAdmin: "ADMIN",
        dailyGames: "Daily Games", webGames: "Web Games", pnpGames: "Print & Play", soonGames: "Coming Soon...",
        aboutTitle: "ABOUT ORKA", aboutText: "We are a studio focused on simple and fun web experiences.",
        footerCopy: "© 2026 Orka Studio. All rights reserved.",
        emptyMsg: "Nothing here yet!",

        profileBtn: "Profile Settings", profileTitle: "PROFILE", nickLabel: "Your Nickname", langLabel: "Language",
        readyBtn: "All set, {nick}!", addNick: "Add Nickname",
        langDesc: "Games will use this preference automatically.",
        syncLabel: "Sync (Login)", syncDesc: "Get a code via email to save your progress.",
        authSent: "Code sent! Check your email.",
        authSuccess: "Logged in successfully!",
        authError: "Error. Try again.",

        game_zoo_desc: "Discover the daily animal.",
        game_jinx_desc: "Read other minds.",
        game_listit_desc: "Deduce the daily order.",
        game_disco_desc: "Guess the daily song.",
        game_eagle_desc: "Shoot as fast as you can.",
        game_firewall_desc: "Grind your powerful cannon."
    }
};

// --- ELEMENTOS DO DOM ---
const modal = document.getElementById('modal-profile');
const btnOpen = document.getElementById('btn-profile');
const btnClose = document.getElementById('btn-close-profile');
const viewMode = document.getElementById('view-nick-mode');
const editMode = document.getElementById('edit-nick-mode');
const displayNick = document.getElementById('display-nick');
const inputNick = document.getElementById('input-nick');
const btnEdit = document.getElementById('btn-edit-nick');
const btnSave = document.getElementById('btn-save-nick');
const btnDelete = document.getElementById('btn-delete-nick');
const btnAdd = document.getElementById('btn-add-nick');
const langBtns = document.querySelectorAll('.lang-option');
const btnWelcome = document.getElementById('btn-welcome-ready');

let welcomeBtn = null; // Refatoração para evitar erros de undefined

// --- INICIALIZAÇÃO ---

async function loadProfileData() {
    await OrkaCloud.init();
    const role = OrkaCloud.getRole() || 'user';
    await OrkaCloud.startSession('orka_hub'); 

    // 1. Aplica Idioma e Tradução IMEDIATAMENTE
    const currentLang = OrkaCloud.getLanguage();
    applyHubTranslation(); // Atualiza toda a UI (Abas, Footer, Jogos)

    // 2. Nickname
    const currentNick = OrkaCloud.getNickname();
    if (currentNick) {
        displayNick.textContent = currentNick;
        inputNick.value = currentNick;
        viewMode.style.display = 'flex';
        editMode.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'none';
    } else {
        displayNick.textContent = '';
        inputNick.value = '';
        viewMode.style.display = 'none';
        editMode.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'block'; 

        const hasSeenIntro = localStorage.getItem('orka_hub_intro_seen');
        if (!hasSeenIntro) {
            openModal(false); 
            OrkaFX.toast("Welcome / Bem-vindo!", "info");
            localStorage.setItem('orka_hub_intro_seen', 'true');
        }
    }

    // 3. Avatar e Bolos
    const avatarUrl = OrkaCloud.getAvatarUrl();
    const currentBolo = OrkaCloud.getBolo();
    const boloDisplay = document.getElementById('header-bolo-count');
    if (boloDisplay) boloDisplay.textContent = currentBolo;

    const imgElement = document.getElementById('user-avatar');
    const container = document.querySelector('.profile-avatar-box');
    if (avatarUrl) {
        container.classList.add('loading');
        imgElement.style.display = 'none';
        const tempImg = new Image();
        tempImg.src = avatarUrl;
        tempImg.onload = () => {
            imgElement.src = avatarUrl;
            imgElement.style.display = 'block';
            container.classList.remove('loading');
            document.getElementById('default-avatar-icon').style.display = 'none';
        };
    } else {
        container.classList.remove('loading');
        imgElement.style.display = 'none';
        document.getElementById('default-avatar-icon').style.display = 'block';
    }

    // 4. UI de Login (Apenas OTP)
    const currentEmail = OrkaCloud.getEmail();
    const loginContainer = document.getElementById('auth-logged-in');
    const emailInputContainer = document.getElementById('auth-step-email');
    const otpContainer = document.getElementById('auth-step-otp');
    const emailDisplay = document.getElementById('display-email-auth');

    if (currentEmail) {
        if(loginContainer) loginContainer.style.display = 'flex';
        if(emailInputContainer) emailInputContainer.style.display = 'none';
        if(otpContainer) otpContainer.style.display = 'none';
        if(emailDisplay) emailDisplay.textContent = currentEmail;
    } else {
        if(loginContainer) loginContainer.style.display = 'none';
        if(emailInputContainer) emailInputContainer.style.display = 'flex';
    }

    // 5. Botões de Idioma
    langBtns.forEach(btn => {
        if (btn.dataset.lang === currentLang) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });

    // 6. Admin Tab Visibility
    const btnAdmin = document.getElementById("tab-admin");
    if (role === "admin") {
        if(btnAdmin) btnAdmin.style.display = "block";
    } else {
        if(btnAdmin) btnAdmin.style.display = "none";
        // Se estava na aba admin mas não é mais, volta para home
        if(document.getElementById('section-admin').classList.contains('active')) {
            showTab('games');
        }
    }
}

// --- LÓGICA DE ABAS ---
document.getElementById("tabs").addEventListener("click", async (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    await showTab(btn.dataset.tab);
});

async function showTab(activeId) {
    // 1. Atualiza Botões
    document.querySelectorAll(".tab-btn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.tab === activeId)
    );

    // 2. Atualiza Seções
    document.querySelectorAll(".tab-content").forEach(section => {
        if (section.id === `section-${activeId}`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // 3. Se for Admin, carrega dados
    const role = OrkaCloud.getRole();
    if (activeId === "admin" && role === "admin") {
        await loadAdminDashboard();
    }
}

// --- ADMIN DASHBOARD ---
async function loadAdminDashboard() {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    if (error) return console.error(error);

    document.getElementById('adm-total-users').textContent = data.total_users;
    document.getElementById('adm-active').textContent = data.active_24h;
    document.getElementById('adm-sessions').textContent = data.total_sessions;

    const tbody = document.querySelector('#adm-games-table tbody');
    tbody.innerHTML = '';
    
    data.games_ranking.forEach(gameStat => {
        const gameInfo = gamesList.find(g => g.id === gameStat.game_id);
        const title = gameInfo ? gameInfo.title : gameStat.game_id;
        const row = `<tr><td>${title}</td><td>${gameStat.play_count}</td><td>${gameStat.unique_players}</td></tr>`;
        tbody.innerHTML += row;
    });
}

document.getElementById('btn-run-cleaner')?.addEventListener('click', async () => {
    if(!confirm("Limpar usuários fantasmas inativos?")) return;
    const { data, error } = await supabase.rpc('clean_ghost_users');
    alert(error ? "Erro: " + error.message : data);
    loadAdminDashboard();
});

document.getElementById('btn-refresh-adm')?.addEventListener('click', loadAdminDashboard);

// --- MODAL & PERFIL ---
function openModal(forceStay = false) {
    if (!modal) return;
    modal.classList.add('active');
}

function toggleEditMode(isEditing) {
    if (isEditing) {
        viewMode.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'none';
        editMode.style.display = 'flex';
        inputNick.focus();
    } else {
        loadProfileData();
    }
}

async function saveNickname() {
    const newNick = inputNick.value.trim();
    if (newNick) {
        await OrkaCloud.updateNickname(newNick);
        editMode.style.display = 'none';
        viewMode.style.display = 'none';
        
        if (btnWelcome) {
            const lang = OrkaCloud.getLanguage().startsWith('en') ? 'en' : 'pt';
            const msgTemplate = translations[lang].readyBtn;
            btnWelcome.textContent = msgTemplate.replace('{nick}', newNick);
            btnWelcome.style.display = 'block';
            btnWelcome.onclick = () => { modal.classList.remove('active'); btnWelcome.style.display = 'none';}
        }
        loadProfileData();
    } else {
        await deleteNickname();
        loadProfileData();
    }
}

async function deleteNickname() {
    localStorage.removeItem('orka_nickname');
    await OrkaCloud.updateNickname('');
    loadProfileData();
}

// Event Listeners Gerais
if (btnOpen) btnOpen.addEventListener('click', () => { openModal(false); loadProfileData(); });
if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
if (btnEdit) btnEdit.addEventListener('click', () => toggleEditMode(true));
if (btnAdd) btnAdd.addEventListener('click', () => toggleEditMode(true));
if (btnSave) btnSave.addEventListener('click', saveNickname);
if (inputNick) inputNick.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNickname(); });
if (btnDelete) btnDelete.addEventListener('click', deleteNickname);

langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        OrkaCloud.setLanguage(lang);
        loadProfileData();
    });
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if(confirm("Deseja desconectar?")) {
        await OrkaCloud.logout();
        loadProfileData();
    }
});

// --- TRADUÇÃO & RENDER ---
function applyHubTranslation() {
    const langFull = OrkaCloud.getLanguage() || 'pt-BR';
    const lang = langFull.startsWith('en') ? 'en' : 'pt';
    const t = translations[lang];

    // Traduz textos gerais (data-t)
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (t[key]) el.textContent = t[key];
    });

    // Traduz atributos (title)
    document.querySelectorAll('[data-t-title]').forEach(el => {
        const key = el.getAttribute('data-t-title');
        if (t[key]) el.title = t[key];
    });

    renderGames(lang);
}

function renderGames(lang) {
    ['daily', 'web', 'soon', 'pnp'].forEach(type => {
        const container = document.getElementById(`list-${type}`);
        if(container) container.innerHTML = '';
    });

    const t = translations[lang];

    gamesList.forEach(game => {
        const container = document.getElementById(`list-${game.type}`);
        if (!container) return;

        const card = document.createElement(game.active ? 'a' : 'div');
        card.className = 'game-card-horizontal';
        
        if (!game.active) {
            card.style.opacity = '0.5';
            card.style.cursor = 'default';
        } else {
            card.href = game.url;
            card.onclick = (e) => {
                e.preventDefault();
                OrkaCloud.track('game_click', 'hub_conversion', { game: game.id });
                setTimeout(() => window.location.href = game.url, 150);
            };
        }

        const printSrc = game.print ? `assets/prints/${game.print}` : '';
        const isNew = checkIsNew(game.releaseDate);
        const tagHTML = (isNew && game.active) ? `<span class="tag-new">NOVO</span>` : '';

        const printHTML = game.active ? 
            `<div class="print-container">
                <img src="${printSrc}" class="card-print" style="height:100%; width:100%; object-fit:cover; border:none;" onerror="this.src='assets/icons/orka-logo.png'">
                ${tagHTML}
             </div>` : 
            `<div class="card-print" style="display:flex; align-items:center; justify-content:center; color:#444; font-size:1.5rem;">🚧</div>`;

        const iconSrc = game.icon ? `assets/icons/${game.icon}` : '';
        const desc = t[game.descKey] || '...';
        const iconHTML = game.active ? `<img src="${iconSrc}" class="card-icon">` : '';

        card.innerHTML = `
            ${printHTML}
            <div class="card-content">
                <div class="card-info-top">
                    ${iconHTML}
                    <div class="card-text">
                        <h3>${game.title}</h3>
                        <p>${desc}</p>
                    </div>
                </div>
                ${game.active ? '<div class="card-action"><span class="material-icons">play_arrow</span></div>' : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function checkIsNew(dateString) {
    if (!dateString) return false;
    const release = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - release) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
}

// --- AUTH (OTP Flow) ---
const inputEmail = document.getElementById('input-email');
const inputOtp = document.getElementById('input-otp');
const authMsg = document.getElementById('auth-msg');

document.getElementById('btn-send-code').addEventListener('click', async () => {
    const email = inputEmail.value.trim();
    if (!email.includes('@')) {
        authMsg.textContent = "Email inválido.";
        return;
    }
    const btn = document.getElementById('btn-send-code');
    btn.innerHTML = '<span class="material-icons orka-spin">refresh</span>';
    btn.disabled = true;
    authMsg.textContent = "Conectando...";
    
    try {
        const res = await OrkaCloud.requestEmailLogin(email);
        if (!res.error) {
            document.getElementById('auth-step-email').style.display = 'none';
            document.getElementById('auth-step-otp').style.display = 'flex';
            const lang = OrkaCloud.getLanguage().startsWith('en') ? 'en' : 'pt';
            authMsg.textContent = translations[lang].authSent;
            authMsg.style.color = "var(--status-correct)";
            inputOtp.focus();
        } else {
            authMsg.textContent = "Erro no servidor.";
            authMsg.style.color = "var(--status-wrong)";
        }
    } finally {
        btn.innerHTML = '<span class="material-icons">send</span>';
        btn.disabled = false;
    }
});

document.getElementById('btn-verify-code').addEventListener('click', async () => {
    const email = inputEmail.value.trim();
    const token = inputOtp.value.trim();
    authMsg.textContent = "Verificando...";

    const res = await OrkaCloud.verifyEmailLogin(email, token);
    if (!res.error) {
        const lang = OrkaCloud.getLanguage().startsWith('en') ? 'en' : 'pt';
        authMsg.textContent = translations[lang].authSuccess;
        authMsg.style.color = "var(--status-correct)";
        
        if (res.isNewUser) {
            OrkaFX.toast("+5 Bolos 🎂", "success");
            OrkaFX.confetti(); 
        }
        await loadProfileData();
        setTimeout(() => {
            modal.classList.remove('active');
            // Reseta visual auth
            document.getElementById('auth-step-email').style.display = 'flex';
            document.getElementById('auth-step-otp').style.display = 'none';
            inputOtp.value = '';
            authMsg.textContent = '';
        }, 1500);
    } else {
        authMsg.textContent = "Código inválido.";
        authMsg.style.color = "var(--status-wrong)";
    }
});

document.getElementById('btn-cancel-otp').addEventListener('click', () => {
    document.getElementById('auth-step-email').style.display = 'flex';
    document.getElementById('auth-step-otp').style.display = 'none';
    authMsg.textContent = "";
});

// --- LOADER ---
const loadingMessages = [
    "Seja bem-vindo(a) ao universo Orka!",
    "Beba água! Hidratação dá mais XP.",
    "Nossos duendes estão polindo os pixels...",
    "Ouvi falar que o criador da Orka é um gatinho...",
    "Carregando texturas de alta definição (mentira)...",
    "Organizando os decks de cartas...",
    "Calibrando a mira da águia...",
    "Alimentando os animais do zoológico..."
];

document.getElementById('loader-msg').textContent = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

window.addEventListener('load', () => {
    loadProfileData();
    setTimeout(() => {
        document.getElementById('orka-loader').classList.add('hidden');
    }, 1200);
});

// Encerramento de sessão limpo
window.addEventListener('pagehide', () => { // 'pagehide' é mais seguro que 'beforeunload' moderno
    OrkaCloud.endSession({ reason: 'close' });
});