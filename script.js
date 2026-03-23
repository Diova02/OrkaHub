import { OrkaCloud } from './core/orka-cloud.js';
import { OrkaFX, OrkaMath } from './core/orka-lib.js'; 
import { translations } from './translate.js'; 
import { OrkaPet } from './core/orka-pet.js'; // PET bro
import { gamesList, shelves, gamesTags, GAME_STATUS } from './games.js'

// NOTA: jsPDF agora é carregado via <script> no HTML, não via import, para evitar erros de módulo.

// --- ELEMENTOS DO DOM ---
const els = {
    displayNick: document.getElementById('display-nick'),
    inputNick: document.getElementById('input-nick'),
    viewMode: document.getElementById('view-nick-mode'),
    editMode: document.getElementById('edit-nick-mode'),
    btnAdd: document.getElementById('btn-add-nick'),
    btnWelcome: document.getElementById('btn-welcome-ready'),
    modal: document.getElementById('modal-profile'),
    
    // Auth Elements
    loginContainer: document.getElementById('auth-logged-in'),
    emailInputContainer: document.getElementById('auth-step-email'),
    otpContainer: document.getElementById('auth-step-otp'),
    emailDisplay: document.getElementById('display-email-auth'),
    inputEmail: document.getElementById('input-email'),
    inputOtp: document.getElementById('input-otp'),
    authMsg: document.getElementById('auth-msg'),
    
    // Admin
    btnAdmin: document.getElementById("tab-admin")
};

// --- FRASES DE CARREGAMENTO ---
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

let dailyStatus = {};

function getGameData(game) {
    const id = game.id;
    return {
        ...game,
        title: game.title,
        descKey: `game_${id}_desc`,
        icon: `assets/icons/${id}-logo.png`,
        print: `assets/prints/print-${id}.png`,
        dev: game.creator || "Orka Studio", // Agora usa o campo 'creator' refatorado
        // A URL agora pode usar a info de port se necessário, mas mantemos a base
        playUrl: `console.html?id=${id}&url=games/${id}/&port=${game.port}&title=${game.title}`
    };
}

// --- INICIALIZAÇÃO ---

window.addEventListener('load', async () => { // Adicione async aqui
    const loaderMsg = document.getElementById('loader-msg');
    if (loaderMsg) {
        loaderMsg.textContent = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    }

    // 1. Aguarda a inicialização completa do Hub (Auth + Fetch Dados + Render)
    await initHub(); 

    // 2. Inicia o Pet (pode ser em paralelo ou depois)
    const pet = new OrkaPet();
    pet.init();

    //lógica menu mobile
    const btnMobile = document.getElementById('btn-mobile-menu');
    const actionsMenu = document.getElementById('header-actions-container');

    if (btnMobile && actionsMenu) {
        btnMobile.onclick = (e) => {
            e.stopPropagation();
            actionsMenu.classList.toggle('active');
            const icon = btnMobile.querySelector('.material-icons');
            icon.textContent = actionsMenu.classList.contains('active') ? 'close' : 'menu';
        };

        // Fecha ao clicar fora
        document.addEventListener('click', () => {
            actionsMenu.classList.remove('active');
            btnMobile.querySelector('.material-icons').textContent = 'menu';
        });
    }
    
    // 2. Remove Loader após carregamento
    setTimeout(() => {
        const loader = document.getElementById('orka-loader');
        if(loader) loader.classList.add('hidden');
    }, 1200);
});

// Encerramento Seguro
window.addEventListener('pagehide', () => {
    OrkaCloud.endSession({ reason: 'hub_closed' });
});

async function initHub() {
    // 1. Inicializa Conexão V5
    const user = await OrkaCloud.initAuth();
    
    if (user) {
        // [NOVO] Inicia o heartbeat do Hub assim que o player é validado
        OrkaCloud.startHeartbeatSession('orkahub'); 
    }
    
    // 3. Lógica do "Recepcionista" (Check Redirect)
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnTo');
    
    const profile = OrkaCloud.getProfile();
    if (returnUrl && profile && profile.nickname) {
        OrkaFX.toast("Redirecionando para o jogo...", "info");
        setTimeout(() => window.location.href = decodeURIComponent(returnUrl), 800);
        return; 
    }

    // NOVO: Carrega status dos jogos antes de desenhar
    dailyStatus = await fetchDailyStatus();
    updateHubUI(dailyStatus); // Passa o status para a UI
}

function updateHubUI() {
    const profile = OrkaCloud.getProfile(); 
    if (!profile) return;

    // A. Idioma
    const langFull = profile.language || 'pt-BR';
    const langSimple = langFull.startsWith('en') ? 'en' : 'pt';
    renderDynamicHub(langSimple); // Agora o Hub decide o que mostrar e onde.
    applyHubTranslation(langFull);
    updateLangButtons(langFull);

    // B. Nickname
    const hasValidNickname = profile && profile.nickname && profile.nickname.toLowerCase() !== 'ghost';

    if (hasValidNickname) {
        els.displayNick.textContent = profile.nickname;
        els.inputNick.value = profile.nickname;
        els.viewMode.style.display = 'flex';
        els.editMode.style.display = 'none';
        if(els.btnAdd) els.btnAdd.style.display = 'none';
    } else {
        // Caso o usuário não tenha nick (usuário novo ou ghost)
        els.displayNick.textContent = '';
        els.inputNick.value = '';
        els.viewMode.style.display = 'none';
        els.editMode.style.display = 'none';
        if(els.btnAdd) els.btnAdd.style.display = 'block';
        
        // FORÇAR ABERTURA: Se não tem nick, abre o modal direto
        // Removi a trava do 'orka_hub_intro_seen' para garantir que ele defina o nick
        openModal(); 
        
        // Feedback visual opcional
        const lang = profile.language?.startsWith('en') ? 'en' : 'pt';
        const welcomeMsg = lang === 'en' ? "Welcome! Please set your nickname." : "Bem-vindo! Crie seu perfil para começar.";
        OrkaFX.toast(welcomeMsg, "info");
    }

    // C. Avatar & Header
    updateAvatarUI(profile.profile_image); 

    // D. Bolos (Via RPC Ledger)
    const boloDisplay = document.getElementById('header-bolo-count');
    if (boloDisplay) {
        // 1. Mostra o cached/zero enquanto carrega para não ficar vazio
        boloDisplay.textContent = profile.bolo || "..."; 
        
        // 2. Busca o saldo real no Ledger (Async)
        OrkaCloud.getClient()
            .rpc('get_my_balance')
            .then(({ data, error }) => {
                if (!error && data !== null) {
                    boloDisplay.textContent = data;
                    
                    // Opcional: Animaçãozinha visual quando o valor atualiza
                    boloDisplay.style.transition = "transform 0.3s";
                    boloDisplay.style.transform = "scale(1.2)";
                    setTimeout(() => boloDisplay.style.transform = "scale(1)", 300);
                }
            })
            .catch(err => console.error("Erro ao buscar saldo:", err));
    }

    // E. Auth State
    const user = OrkaCloud.getUser();
    const isAnon = !user.email;
    
    if (!isAnon) {
        if(els.loginContainer) els.loginContainer.style.display = 'flex';
        if(els.emailInputContainer) els.emailInputContainer.style.display = 'none';
        if(els.otpContainer) els.otpContainer.style.display = 'none';
        if(els.emailDisplay) els.emailDisplay.textContent = user.email;
    } else {
        if(els.loginContainer) els.loginContainer.style.display = 'none';
        if(els.emailInputContainer) els.emailInputContainer.style.display = 'flex';
    }

    // F. Admin & Partners Visibility
    const role = profile.role || 'user';
    const btnAdmin = document.getElementById("tab-admin");
    const btnPartners = document.getElementById("tab-partners"); // Novo

    if (role === 'admin') {
        if(btnAdmin) btnAdmin.style.display = "block";
        if(btnPartners) btnPartners.style.display = "block"; // Novo
    } else {
        if(btnAdmin) btnAdmin.style.display = "none";
        if(btnPartners) btnPartners.style.display = "none"; // Novo
        
        // Se estiver numa aba restrita, chuta pro início
        const activeSection = document.querySelector('.tab-content.active');
        if(activeSection && (activeSection.id === 'section-admin' || activeSection.id === 'section-partners')) {
            showTab('games');
        }
    }
}

function updateAvatarUI(imgSlugOrUrl) {
    const imgElement = document.getElementById('user-avatar');
    const container = document.querySelector('.profile-avatar-box');
    const headerImg = document.getElementById('header-avatar-img');
    const headerIcon = document.getElementById('header-avatar-icon');
    const defaultIcon = document.getElementById('default-avatar-icon');

    const avatarUrl = (imgSlugOrUrl && !imgSlugOrUrl.includes('/')) 
        ? `assets/avatars/${imgSlugOrUrl}.png` 
        : imgSlugOrUrl;

    if (avatarUrl && avatarUrl !== 'default') {
        container?.classList.add('loading');
        if(imgElement) imgElement.style.display = 'none';

        const tempImg = new Image();
        tempImg.src = avatarUrl;
        tempImg.onload = () => {
            if(imgElement) { imgElement.src = avatarUrl; imgElement.style.display = 'block'; }
            container?.classList.remove('loading');
            if(defaultIcon) defaultIcon.style.display = 'none';

            if(headerImg && headerIcon) {
                headerImg.src = avatarUrl;
                headerImg.style.display = 'block';
                headerIcon.style.display = 'none';
            }
        };
    } else {
        container?.classList.remove('loading');
        if(imgElement) imgElement.style.display = 'none';
        if(defaultIcon) defaultIcon.style.display = 'block';
        
        if(headerImg && headerIcon) {
            headerImg.style.display = 'none';
            headerIcon.style.display = 'block';
        }
    }
}

// --- NAVEGAÇÃO & ABAS ---

document.getElementById("tabs").addEventListener("click", async (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    await showTab(btn.dataset.tab);
});

async function showTab(activeId) {
    document.querySelectorAll(".tab-btn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.tab === activeId)
    );
    document.querySelectorAll(".tab-content").forEach(section => {
        section.classList.toggle('active', section.id === `section-${activeId}`);
    });

    const profile = OrkaCloud.getProfile();
    if (activeId === "admin" && profile?.role === "admin") {
        await loadAdminDashboard();
    }
}

// --- PERFIL & NICKNAME ---

function openModal() { els.modal?.classList.add('active'); }
document.getElementById('btn-profile')?.addEventListener('click', () => { openModal(); updateHubUI(); });
document.getElementById('btn-close-profile')?.addEventListener('click', () => els.modal?.classList.remove('active'));

function toggleEditMode(isEditing) {
    if (isEditing) {
        els.viewMode.style.display = 'none';
        if(els.btnAdd) els.btnAdd.style.display = 'none';
        els.editMode.style.display = 'flex';
        els.inputNick.focus();
    } else {
        updateHubUI();
    }
}

document.getElementById('btn-edit-nick')?.addEventListener('click', () => toggleEditMode(true));
document.getElementById('btn-add-nick')?.addEventListener('click', () => toggleEditMode(true));

document.getElementById('btn-save-nick')?.addEventListener('click', async () => {
    const newNick = els.inputNick.value.trim();
    if (newNick) {
        await OrkaCloud.updateProfile({ nickname: newNick });
        toggleEditMode(false);
        
        if (els.btnWelcome) {
            const lang = OrkaCloud.getProfile().language.startsWith('en') ? 'en' : 'pt';
            const msgTemplate = translations[lang].readyBtn;
            els.btnWelcome.textContent = msgTemplate.replace('{nick}', newNick);
            els.btnWelcome.style.display = 'block';
            els.btnWelcome.onclick = () => { els.modal.classList.remove('active'); els.btnWelcome.style.display = 'none';}
        }
    }
});

document.getElementById('btn-delete-nick')?.addEventListener('click', async () => {
    if(confirm("Zerar perfil?")) {
        localStorage.removeItem('orka_nickname');
        await OrkaCloud.updateProfile({ nickname: '' });
        updateHubUI();
    }
});

// --- IDIOMA & RENDER ---

function updateLangButtons(currentLang) {
    document.querySelectorAll('.lang-option').forEach(btn => {
        if (btn.dataset.lang === currentLang) btn.classList.add('selected');
        else btn.classList.remove('selected');
        
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', async () => {
            await OrkaCloud.updateProfile({ language: newBtn.dataset.lang });
            updateHubUI();
        });
    });
}

function applyHubTranslation(langFull) {
    const lang = langFull.startsWith('en') ? 'en' : 'pt';
    const t = translations[lang];

    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-t-title]').forEach(el => {
        const key = el.getAttribute('data-t-title');
        if (t[key]) el.title = t[key];
    });

    renderDynamicHub(lang);
}

async function renderDynamicHub(langSimple) {
    const mainContainer = document.getElementById('main-hub-content');
    if (!mainContainer) return;
    mainContainer.innerHTML = '';

    const profile = OrkaCloud.getProfile();
    const isAdmin = profile?.role === 'admin';
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const userPlatform = isMobile ? 'MOBILE' : 'DESKTOP';

    const authorizedGames = gamesList.filter(game => {
        // 1. Filtro de Status (Aqui era onde dava o erro)
        if (game.status === GAME_STATUS.HIDDEN && !isAdmin) return false;
        if (game.status === GAME_STATUS.SPOILER && !isAdmin) return false;

        // 2. Filtro de Plataforma (Port)
        if (!isAdmin && game.port !== 'BOTH' && game.port !== userPlatform) return false;

        // 3. Futuro Filtro de Linguagem (Exemplo)
        // if (!game.languages.includes(langSimple) && !showAllLanguages) return false;

        return game.releaseDate || isAdmin;
    });

    const thematicKeys = Object.keys(shelves).filter(key => shelves[key].priority === 2);
    const selectedThematics = OrkaMath.shuffle([...thematicKeys]).slice(0, 3);

    const shelfPlan = [
        { ...shelves.NEW_UPDATED, isNews: true },
        shelves.DAILY,
        ...selectedThematics.map(key => shelves[key]),
        shelves.SOON
    ];

    shelfPlan.forEach(shelf => {
        const gamesForThisShelf = filterGamesByShelf(shelf, authorizedGames);
        if (gamesForThisShelf.length > 0 || shelf.id === 'soon') {
            renderShelf(shelf, gamesForThisShelf, mainContainer, langSimple);
        }
    });
}

// --- FUNÇÕES TERCEIRIZADAS (AUXILIARES) ---
// 1. Ajuste na Filtragem e Ordenação
function filterGamesByShelf(shelf, listToFilter) {
    let filtered;
    
    if (shelf.isNews) {
        filtered = listToFilter.filter(g => checkIsNew(g.releaseDate) || checkIsUpdated(g.lastUpdate));
        return filtered.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    }
    
    filtered = listToFilter.filter(game => {
        const tags = gamesTags[game.id] || [];
        return tags.some(tag => shelf.tags?.includes(tag)) || game.type === shelf.id;
    });
    return filtered;
}

// 2. Ajuste no Título (Branding)
function renderShelf(shelf, games, container, lang) {
    const section = document.createElement('section');
    section.className = 'hub-section';
    
    const title = document.createElement('h2');
    // Branding Orka: ID em uppercase + Título
    const shelfID = shelf.id.toUpperCase().replace('_', ' ');
    title.textContent = `${shelfID} — ${shelf.title}`; 
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'game-list';
    
    const displayGames = (shelf.priority === 2) ? OrkaMath.shuffle([...games]) : games;
    
    displayGames.forEach(game => {
        list.appendChild(createGameCard(game, lang));
    });

    section.appendChild(list);
    container.appendChild(section);
}

// 3. Correção da Tag de Atualização
function createGameCard(game, lang) {
    const data = getGameData(game); 
    const profile = OrkaCloud.getProfile();
    const isAdmin = profile?.role === 'admin';

    const isNew = checkIsNew(data.releaseDate);
    const isUpdated = checkIsUpdated(data.lastUpdate); 
    
    // NOVO: Lógica de Manutenção
    const inMaintenance = data.status === GAME_STATUS.MAINTENANCE;
    
    // O card só é um link (<a>) se estiver ativo ou se for admin em manutenção
    const canAccess = data.status === GAME_STATUS.ACTIVE || (inMaintenance && isAdmin);
    const card = document.createElement(canAccess ? 'a' : 'div');
    
    // Adiciona classe de manutenção se necessário
    card.className = `game-card-horizontal ${inMaintenance ? 'in-maintenance' : ''}`;
    
    if (canAccess) {
        card.href = data.playUrl;
    }

    let tagHTML = '';
    if (inMaintenance) {
        tagHTML = `<span class="tag-maintenance">MANUTENÇÃO</span>`;
    } else if (isNew) {
        tagHTML = `<span class="tag-new">NOVO</span>`;
    } else if (isUpdated) {
        tagHTML = `<span class="tag-updated">ATUALIZADO</span>`;
    }

    let rewardHTML = '';
    // Só mostra o bolo se estiver ativo e não estiver em manutenção
    if (data.type === 'daily' && !inMaintenance && !dailyStatus[data.id]) {
        rewardHTML = `<div class="tag-reward"><span class="material-icons" style="font-size:0.9rem;">cake</span></div>`;
    }

    card.innerHTML = `
        <div class="print-container" style="position:relative;">
            <img src="${data.print}" class="card-print" onerror="this.src='assets/icons/orka-logo.png'">
            ${tagHTML}
            ${rewardHTML}
        </div>
        <div class="card-content">
            <div class="card-info-top">
                <img src="${data.icon}" class="card-icon">
                <div class="card-text">
                    <h3>${data.title}</h3>
                    <small style="opacity:0.7;">${data.dev}</small> 
                </div>
            </div>
            ${canAccess ? '<div class="card-action"><span class="material-icons">play_arrow</span></div>' : ''}
        </div>
    `;
    return card;
}

function checkIsNew(dateString) {
    if (!dateString) return false;
    const release = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - release) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
}

function checkIsUpdated(updateDateString) {
    if (!updateDateString) return false;
    const update = new Date(updateDateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - update) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
}

// --- AUTH (OTP) ---

document.getElementById('btn-send-code')?.addEventListener('click', async () => {
    const email = els.inputEmail.value.trim();
    if (!email.includes('@')) return updateAuthMsg("Email inválido.", "wrong");
    
    updateAuthMsg("Conectando...", "info");
    const supabase = OrkaCloud.getClient(); 
    
    const { error } = await supabase.auth.signInWithOtp({ email });
    
    if (!error) {
        els.emailInputContainer.style.display = 'none';
        els.otpContainer.style.display = 'flex';
        updateAuthMsg("Código enviado!", "correct");
        els.inputOtp.focus();
    } else {
        updateAuthMsg("Erro ao enviar. Por favor, aguarde um minuto e tente novamente.", "wrong");
        console.error(error);
    }
});

document.getElementById('btn-verify-code')?.addEventListener('click', async () => {
    const email = els.inputEmail.value.trim();
    const token = els.inputOtp.value.trim();
    
    // 1. SALVA O ID DO ANÔNIMO ATUAL ANTES DE LOGAR
    const currentUser = OrkaCloud.getUser();
    const oldAnonId = (currentUser && currentUser.is_anonymous) ? currentUser.id : null;

    updateAuthMsg("Verificando...", "info");

    const supabase = OrkaCloud.getClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

    if (!error) {
        updateAuthMsg("Sucesso!", "correct");
        OrkaFX.confetti();
        
        // 2. SE O LOGIN DEU CERTO E TINHA UM ANÔNIMO, DELETA ELE
        // Verifica se o ID novo é diferente do antigo para não se auto-deletar por engano
        if (oldAnonId && data.user.id !== oldAnonId) {
            await OrkaCloud.deleteGhost(oldAnonId);
        }

        await initHub(); 
        
        setTimeout(() => {
            els.modal.classList.remove('active');
            els.emailInputContainer.style.display = 'flex';
            els.otpContainer.style.display = 'none';
            els.inputOtp.value = '';
        }, 1500);
    } else {
        updateAuthMsg("Código inválido.", "wrong");
    }
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if(confirm("Sair da conta?")) {
        await OrkaCloud.getClient().auth.signOut();
        window.location.reload();
    }
});

document.getElementById('btn-cancel-otp')?.addEventListener('click', () => {
    els.emailInputContainer.style.display = 'flex';
    els.otpContainer.style.display = 'none';
    updateAuthMsg("", "info");
});

function updateAuthMsg(text, type) {
    els.authMsg.textContent = text;
    els.authMsg.style.color = type === 'correct' ? 'var(--status-correct)' : (type === 'wrong' ? 'var(--status-wrong)' : '#fff');
}

// =========================================================
//  ADMIN DASHBOARD 2.0 (BI Edition) - CONSOLIDADO
// =========================================================

// Helper de formatação de tempo (Único e Centralizado)
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

// 1. CARREGAMENTO PRINCIPAL
async function loadAdminDashboard() {
    const supabase = OrkaCloud.getClient();
    updateAuthMsg("Carregando BI da View SQL...", "info");

    try {
        const { data, error } = await supabase
            .from('game_sessions_dashboard')
            .select('*')
            .not('game_id', 'is', null)
            .order('total_play_time_seconds', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            updateAuthMsg("Nenhum dado encontrado", "info");
            return;
        }

        renderAdminTable(data);
        renderAdminChart(data);

        // 1. TEMPO BRUTO (Soma de tudo: Jogos + Hub)
        const totalBrutoSeconds = data.reduce((acc, curr) => acc + (curr.total_play_time_seconds || 0), 0);

        // 2. NAVEGAÇÃO (Apenas quando o game_id é 'orkahub')
        const navigationData = data.find(s => s.game_id === 'orkahub');
        const totalNavigationSeconds = navigationData ? navigationData.total_play_time_seconds : 0;

        // 3. TEMPO LÍQUIDO (Total Bruto menos o tempo do Hub)
        const totalLiquidoSeconds = totalBrutoSeconds - totalNavigationSeconds;

        // --- ATUALIZAÇÃO DOS ELEMENTOS NO HTML ---

        // Tempo BRUTO (Total Geral)
        updateElement('adm-total-time', formatDuration(totalBrutoSeconds)); 

        // Tempo LÍQUIDO (De fato jogando - adm-playtime)
        updateElement('adm-playtime', formatDuration(totalLiquidoSeconds));

        // NAVEGAÇÃO (Explorando o Hub - adm-hubtime)
        updateElement('adm-hubtime', formatDuration(totalNavigationSeconds));

        // Sessões e Usuários (Mantendo a lógica anterior)
        const totalUsers = data.reduce((acc, curr) => acc + (curr.unique_players || 0), 0);
        const totalSessions = data.reduce((acc, curr) => acc + (curr.total_sessions || 0), 0);

        updateElement('adm-users', totalUsers);
        updateElement('adm-sessions', totalSessions);

        updateAuthMsg("Dashboard atualizado!", "correct");

    } catch (error) {
        console.error("Erro ao carregar Dashboard:", error);
        OrkaFX.toast(error.message, "wrong");
    }
}

// 2. RENDERIZAÇÃO DA TABELA REFORMULADA
function renderAdminTable(stats) {
    const tbody = document.querySelector('#adm-games-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    stats.forEach(stat => {
        const gameInfo = gamesList.find(g => g.id === stat.game_id);
        const title = gameInfo ? gameInfo.title : stat.game_id.toUpperCase();
        const icon = gameInfo ? `<img src="assets/icons/${gameInfo.id}-logo.png" style="width:20px; margin-right:8px;">` : '';
        
        const row = `
            <tr>
                <td style="text-align:left; font-weight:bold; display:flex; align-items:center;">
                    ${icon} ${title}
                </td>
                <td>${stat.unique_players}</td>
                <td>${stat.total_sessions}</td>
                <td style="color:var(--orka-accent); font-family:monospace;">
                    ${formatDuration(stat.avg_session_time_seconds)}
                </td>
                <td style="font-weight:600;">
                    ${formatDuration(stat.total_play_time_seconds)}
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// 3. RENDERIZAÇÃO DO GRÁFICO (Chart.js)
function renderAdminChart(stats) {
    const canvas = document.getElementById('orkaTimeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.orkaChartInstance) window.orkaChartInstance.destroy();

    window.orkaChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: stats.map(s => {
                const info = gamesList.find(g => g.id === s.game_id);
                return info ? info.title : s.game_id;
            }),
            datasets: [{
                data: stats.map(s => s.total_play_time_seconds),
                backgroundColor: ['#0055ff', '#ffcc00', '#ff6b6b', '#20c997', '#6f42c1', '#fd7e14'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff', font: { family: 'Inter' } } }
            }
        }
    });
}

// 4. RELATÓRIO PDF (Consolidado: Usa a versão createPDF que é mais completa)
async function handleReportGeneration() {
    const btn = document.getElementById('btn-generate-report');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons orka-spin">refresh</span> Gerando...';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Captura o gráfico atual para o PDF
        const canvas = document.getElementById('orkaTimeChart');
        const imgData = canvas ? canvas.toDataURL('image/png') : null;

        // Layout do PDF
        doc.setFillColor(20, 20, 20);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 204, 0); 
        doc.setFontSize(22);
        doc.text("ORKA HUB ANALYTICS", 20, 25);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Relatório extraído em: ${new Date().toLocaleString()}`, 20, 50);

        if (imgData) {
            doc.text("Distribuição de Tempo por Jogo:", 20, 65);
            doc.addImage(imgData, 'PNG', 15, 70, 180, 100);
        }

        doc.save(`Orka_BI_${new Date().toISOString().split('T')[0]}.pdf`);
        OrkaFX.toast("Relatório gerado!", "correct");
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar PDF: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">picture_as_pdf</span> Relatório Semanal';
    }
}

// --- LISTENERS E AUXILIARES ---
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

document.getElementById('btn-refresh-adm')?.addEventListener('click', loadAdminDashboard);
document.getElementById('btn-generate-report')?.addEventListener('click', handleReportGeneration);

document.getElementById('btn-run-cleaner')?.addEventListener('click', async () => {
    if(!confirm("⚠️ Limpar usuários fantasmas inativos?")) return;
    const { data, error } = await OrkaCloud.getClient().rpc('clean_ghost_users');
    if (error) alert("Erro: " + error.message);
    else { alert(data || "Limpeza concluída!"); loadAdminDashboard(); }
});

// Verifica quais jogos o usuário já interagiu hoje (ganhou ou perdeu)
// --- FUNÇÃO DE STATUS DIÁRIO ---

async function fetchDailyStatus() {
    const user = OrkaCloud.getUser();
    if (!user) return {};

    const supabase = OrkaCloud.getClient();
    const today = new Date().toISOString().split('T')[0];

    console.log("🔍 Verificando status diário para:", today);

    // Faremos duas buscas em paralelo (muito rápido)
    const [claimsReq, savesReq] = await Promise.all([
        // 1. Já recebeu recompensa? (Vitórias)
        supabase.from('daily_claims')
            .select('game_id')
            .eq('player_id', user.id)
            .eq('claimed_at', today),

        // 2. Já finalizou um save hoje? (Derrotas ou Vitórias sem claim)
        // Buscamos saves do dia onde o jogo acabou (over, finished, etc)
        supabase.from('game_saves')
            .select('game_id, save_data')
            .eq('player_id', user.id)
            .eq('date_reference', today)
    ]);

    const statusMap = {};

    // A. Processa Claims (Vitórias Pagas)
    if (claimsReq.data) {
        claimsReq.data.forEach(c => statusMap[c.game_id] = 'reward_claimed');
    }

    // B. Processa Saves (Jogou até o fim?)
    if (savesReq.data) {
        savesReq.data.forEach(save => {
            const data = save.save_data || {};
            
            // Verifica flags comuns de fim de jogo nos seus scripts (Listit, Zoo, etc)
            // Listit usa 'finished', Zoo usa 'over', Eagle usa 'status'
            const isFinished = data.over === true || data.finished === true || data.status === 'finished';

            if (isFinished) {
                // Se já estava marcado como claimed, mantém. Se não, marca como jogado.
                if (!statusMap[save.game_id]) {
                    statusMap[save.game_id] = 'played_no_reward';
                }
            }
        });
    }

    console.log("📅 Status Consolidado:", statusMap);
    return statusMap;
}

// --- LÓGICA DO MODAL DE APOIO (PIX) ---
const modalSupport = document.getElementById('modal-support');
const btnOpenSupport = document.querySelector('.btn-coffee'); // Seleciona o link/botão existente
const btnCloseSupport = document.getElementById('btn-close-support');
const btnCopyPix = document.getElementById('btn-copy-pix');

// Abrir Modal (Prevenindo o comportamento padrão do link #)
btnOpenSupport?.addEventListener('click', (e) => {
    e.preventDefault();
    modalSupport.classList.add('active');
});

// Fechar Modal
btnCloseSupport?.addEventListener('click', () => modalSupport.classList.remove('active'));

// Copiar Chave PIX
btnCopyPix?.addEventListener('click', async () => {
    const pixValue = document.getElementById('pix-key-value').value;
    try {
        await navigator.clipboard.writeText(pixValue);
        OrkaFX.toast("Chave copiada! Valeu demais! ☕", "success");
        
        // Feedback visual no botão
        const icon = btnCopyPix.querySelector('.material-icons');
        icon.textContent = 'check';
        setTimeout(() => icon.textContent = 'content_copy', 2000);
    } catch (err) {
        OrkaFX.toast("Erro ao copiar chave.", "wrong");
    }
});

// Fechar ao clicar fora
modalSupport?.addEventListener('click', (e) => {
    if (e.target === modalSupport) modalSupport.classList.remove('active');
});

// ==========================================
// EVENTO TEMPORÁRIO: ANIVERSÁRIO
// ==========================================
// async function initBirthdayEvent() {
//     const modal = document.getElementById('modal-birthday');
//     const btn = document.getElementById('btn-congratulate');
//     const input = document.getElementById('bday-msg');
//     const modalContent = modal.querySelector('.modal-content');

//     // 1. Verifica se o usuário já pegou o bolo de hoje (usando a tabela de claims ou localStorage)
//     const hasClaimed = localStorage.getItem('orka_bday_2026_claimed');
//     if (hasClaimed) return;

//     modal.style.display = 'flex';
//     modalContent.classList.add('modal-birthday-active');

//     btn.onclick = async () => {
//         const msg = input.value.trim();
        
//         // Desabilita para evitar múltiplos cliques
//         btn.disabled = true;
//         btn.innerHTML = '<span class="material-icons orka-spin">refresh</span> ENVIANDO...';

//         try {
//             // A. Salva a mensagem no Banco (usando uma RPC ou salvando num save_game especial)
//             const today = new Date().toISOString().split('T')[0]; 
//             await OrkaCloud.saveGame('orkahub', { message: msg }, today);

//             // B. Dá o Bolo (Aproveitando sua função addBolo)
//             await OrkaCloud.addBolo(5); // 5 fatias de presente!

//             // C. Efeito Visual
//             OrkaFX.confetti(200);
//             OrkaFX.toast("Você ganhou 5 fatias de bolo! 🍰", "success");

//             // D. Salva que já participou e fecha
//             localStorage.setItem('orka_bday_2026_claimed', 'true');
//             setTimeout(() => modal.style.display = 'none', 1500);

//         } catch (e) {
//             OrkaFX.toast("Erro ao processar presente.", "wrong");
//             btn.disabled = false;
//         }
//     };
// }

// Chame isso no final do seu window.addEventListener('load', ...)
//initBirthdayEvent();