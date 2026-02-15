import { OrkaCloud } from './core/scripts/orka-cloud.js';
import { OrkaFX, OrkaMath } from './core/scripts/orka-lib.js'; 
import { translations } from './translate.js'; 
import { OrkaPet } from './core/scripts/orka-pet.js'; // PET bro
import { gamesList, shelves, gamesTags } from './games.js'

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
        dev: game.dev || "Orka Studio",
        // A mágica da URL centralizada no Console Mestre:
        //playUrl: `console.html?id=${id}&url=games/${id}/&portrait=${game.allowPortrait}&title=${game.title}`
        playUrl: `console.html?id=${id}&url=games/${id}/&portrait=true&title=${game.title}`
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
    await OrkaCloud.initAuth();
    
    // 2. Inicia Sessão de Navegação (Hub)
    await OrkaCloud.startSession('orkahub');
    
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

// function renderGames(lang) {
//     const t = translations[lang];
//     const role = OrkaCloud.getProfile()?.role || 'user';

//     // Limpa os containers antes de renderizar
//     ['daily', 'web', 'soon', 'pnp'].forEach(type => {
//         const container = document.getElementById(`list-${type}`);
//         if(container) container.innerHTML = '';
//     });

//     gamesList.forEach(game => {
//         if (!game.releaseDate && role !== 'admin') return;

//         const container = document.getElementById(`list-${game.type}`);
//         if (!container) return;

//         // Usa a helper para pegar os dados limpos
//         const data = getGameData(game);

//         const card = document.createElement(data.active ? 'a' : 'div');
//         card.className = 'game-card-horizontal';
        
//         if (!data.active) {
//             card.style.opacity = '0.5';
//             card.style.cursor = 'default';
//         } else {
//             card.href = data.playUrl;
//             card.onclick = (e) => {
//                 e.preventDefault();
//                 setTimeout(() => window.location.href = data.playUrl, 150);
//             };
//         }

//         // Lógica de Tags: NOVO (7 dias) e Recompensa (Bolo)
//         const isNew = checkIsNew(data.releaseDate);
//         const isUpdated = checkIsUpdated(data.lastUpdate); // Nova verificação

//         let tagHTML = '';
//         if (data.active) {
//             if (isNew) {
//                 tagHTML = `<span class="tag-new">NOVO</span>`;
//             } else if (isUpdated) {
//                 tagHTML = `<span class="tag-updated">ATUALIZADO</span>`;
//             }
//         }
        
//         let rewardHTML = '';
//         if (data.type === 'daily' && data.active && !dailyStatus[data.id]) {
//             rewardHTML = `
//             <div class="tag-reward" title="Recompensa disponível!">
//                 <span class="material-icons" style="font-size:0.9rem;">cake</span>
//             </div>`;
//         }

//         const printSrc = data.print || `assets/prints/print-default.png`;
//         const printHTML = data.active ? 
//             `<div class="print-container" style="position:relative;">
//                 <img src="${printSrc}" class="card-print" style="height:100%; width:100%; object-fit:cover; border:none;" onerror="this.src='assets/icons/orka-logo.png'">
//                 ${tagHTML}
//                 ${rewardHTML} 
//              </div>` :
//             `<div class="card-print" style="display:flex; align-items:center; justify-content:center; color:#444; font-size:1.5rem;">🚧</div>`;

//         const desc = t[data.descKey] || '...';
//         const iconHTML = data.active ? `<img src="${data.icon}" class="card-icon">` : '';

//         card.innerHTML = `
//             ${printHTML}
//             <div class="card-content">
//                 <div class="card-info-top">
//                     ${iconHTML}
//                     <div class="card-text">
//                         <h3>${data.title}</h3> 
//                         <p>${desc}</p>
//                     </div>
//                 </div>
//                 ${data.active ? '<div class="card-action"><span class="material-icons">play_arrow</span></div>' : ''}
//             </div>
//         `;
//         container.appendChild(card);
//     });
// }

async function renderDynamicHub(langSimple) {
    const mainContainer = document.getElementById('main-hub-content');
    if (!mainContainer) return;
    mainContainer.innerHTML = '';

    const profile = OrkaCloud.getProfile();
    const isAdmin = profile?.role === 'admin';

    // Filtra a lista global para esta renderização específica
    const authorizedGames = gamesList.filter(game => {
        // Se tem data de lançamento, qualquer um vê. Se não tem, só admin.
        return game.releaseDate || isAdmin;
    });

    // 1. Lógica de Seleção de Categorias
    const thematicKeys = Object.keys(shelves).filter(key => shelves[key].priority === 2);
    const selectedThematics = OrkaMath.shuffle([...thematicKeys]).slice(0, 3);

    const shelfPlan = [
        { ...shelves.NEW_UPDATED, isNews: true },
        shelves.DAILY,
        ...selectedThematics.map(key => shelves[key]),
        shelves.SOON
    ];

    // 2. Renderização das Prateleiras (passando a lista autorizada)
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
    const isNew = checkIsNew(data.releaseDate);
    // CORREÇÃO: lastUpdate em vez de last_update
    const isUpdated = checkIsUpdated(data.lastUpdate); 

    const card = document.createElement(data.active ? 'a' : 'div');
    card.className = 'game-card-horizontal';
    
    if (data.active) {
        card.href = data.playUrl;
    }

    let tagHTML = '';
    if (isNew) {
        tagHTML = `<span class="tag-new">NOVO</span>`;
    } else if (isUpdated) {
        tagHTML = `<span class="tag-updated">ATUALIZADO</span>`;
    }

    // Adicionando o rewardHTML (Bolo) se necessário
    let rewardHTML = '';
    if (data.type === 'daily' && data.active && !dailyStatus[data.id]) {
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
                </div>
            </div>
            ${data.active ? '<div class="card-action"><span class="material-icons">play_arrow</span></div>' : ''}
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
//  ADMIN DASHBOARD 2.0 (BI Edition)
// =========================================================

let adminDataCache = null;

// Helper de formatação de tempo
function formatDuration(seconds) {
    if (!seconds) return '0s';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

async function loadAdminDashboard() {
    const supabase = OrkaCloud.getClient();
    // RPC V2 (Carrega tudo: raw e clean)
    const { data, error } = await supabase.rpc('get_analytics_report');
    
    if (error) return console.error("Admin Error:", error);
    
    adminDataCache = data;
    renderAdminUI();
}

function renderAdminUI() {
    // Se não tiver dados carregados ainda, aborta
    if (!adminDataCache) return;

    // Toggle: Dados Limpos (sem devs) vs Dados Brutos
    // Nota: A lógica de filtrar devs deve acontecer ANTES, na função fetchAdminData, 
    // gerando o objeto 'clean' e 'raw'. Aqui só escolhemos qual mostrar.
    const hideAdmins = document.getElementById('toggle-admin-data') && document.getElementById('toggle-admin-data').checked;
    const dataset = hideAdmins ? adminDataCache.clean : adminDataCache.raw;

    // --- 1. KPIs GERAIS ---
    // Total de Jogadores (Tabela players)
    updateElement('adm-users', dataset.users);
    
    // Sessões Ativas Agora (Baseado no last_heartbeat_at)
    updateElement('adm-sessions', `${dataset.sessions} (${dataset.active_sessions} on)`); // Mudado de 'sessions' total para 'ativas agora' que é mais útil
    
    // --- 2. ECONOMIA (Novidade!) ---
    // Mostra quantos bolos foram gerados vs queimados
    if (dataset.economy) {
        const netEconomy = dataset.economy.minted + dataset.economy.burned; // Burned geralmente é negativo
        updateElement('adm-economy', `🎂 ${netEconomy} (Global)`);
        // Dica: Você pode criar um tooltip mostrando: +${dataset.economy.minted} / ${dataset.economy.burned}
    }

    // --- 3. TEMPO (Hub vs Jogo) ---
    updateElement('adm-game-time', formatDuration(dataset.game_time));
    updateElement('adm-hub-time', formatDuration(dataset.hub_time));

    // --- 4. TABELA DE PERFORMANCE DOS JOGOS ---
    const tbody = document.querySelector('#adm-games-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Ordena por tempo total de jogo
    const sortedGames = (dataset.games_stats || []).sort((a, b) => b.time - a.time);

    if (sortedGames.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Sem dados nas novas tabelas.</td></tr>';
        return;
    }

    sortedGames.forEach(stat => {
        // Identifica se é o Hub
        const isHub = stat.game_id === 'hub' || stat.game_id === 'orkahub'; // Ajuste conforme seu ID real no banco
        
        // Busca nome bonitinho na lista de jogos (gamesList do script.js)
        const gameInfo = gamesList.find(g => g.id === stat.game_id);
        
        let title = gameInfo ? gameInfo.title : stat.game_id;
        let iconHtml = gameInfo ? `<img src="assets/icons/${gameInfo.icon}" style="width:20px; vertical-align:middle; margin-right:5px;">` : '';

        if (isHub) {
            title = "🏠 ORKA HUB (Navegação)";
            iconHtml = '';
        }

        const row = `
            <tr style="${isHub ? 'background: rgba(255,255,255,0.05); font-style:italic;' : ''}">
                <td style="text-align:left;">
                    ${iconHtml}
                    <span style="${isHub ? 'opacity:0.7' : 'font-weight:bold'}">${title}</span>
                </td>
                <td>${stat.plays}</td>
                <td>${stat.uniques}</td> <td style="color:${isHub ? '#999' : 'var(--orka-accent)'}; font-family:monospace;">
                    ${formatDuration(stat.time)}
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Helper simples para não quebrar se o elemento não existir no HTML
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// Toggle Listener
document.getElementById('toggle-admin-data')?.addEventListener('change', renderAdminUI);

// Botão Refresh
document.getElementById('btn-refresh-adm')?.addEventListener('click', loadAdminDashboard);

// Botão Cleaner
document.getElementById('btn-run-cleaner')?.addEventListener('click', async () => {
    if(!confirm("⚠️ Limpar usuários fantasmas inativos?\nIsso pode remover visitantes que não logaram.")) return;
    
    const supabase = OrkaCloud.getClient();
    const { data, error } = await supabase.rpc('clean_ghost_users');
    
    if (error) alert("Erro: " + error.message);
    else {
        alert(data || "Limpeza concluída!");
        loadAdminDashboard();
    }
});

// --- GERADOR DE RELATÓRIO (PDF) ---

document.getElementById('btn-generate-report')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-generate-report');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons orka-spin">refresh</span> Gerando...';

    try {
        await generateWeeklyReport();
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar relatório: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">picture_as_pdf</span> Relatório Semanal';
    }
});

async function generateWeeklyReport() {
    const supabase = OrkaCloud.getClient();
    
    // Datas: Semana Passada (Dom -> Sab)
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    
    const end = new Date(today);
    end.setDate(today.getDate() - (dayOfWeek + 1)); 
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    // Datas: Semana Retrasada (Para Comparação)
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - 6);
    prevStart.setHours(0, 0, 0, 0);

    const { data: currentWeek } = await supabase.rpc('get_analytics_report', { start_date: start, end_date: end });
    const { data: prevWeek } = await supabase.rpc('get_analytics_report', { start_date: prevStart, end_date: prevEnd });

    // Salva LocalStorage
    const reportKey = `orka_report_${formatDate(end)}`;
    localStorage.setItem(reportKey, JSON.stringify(currentWeek.clean));

    // Gera PDFs
    createPDF(currentWeek.clean, prevWeek.clean, start, end, true); 
    createPDF(currentWeek.clean, prevWeek.clean, start, end, false); 
}

function createPDF(curr, prev, start, end, isPublic) {
    // CORREÇÃO: Usa jsPDF global (carregado via script tag)
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF();
    const rangeStr = `${formatDate(start)} - ${formatDate(end)}`;
    
    // Header
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 204, 0); 
    doc.setFontSize(22);
    doc.text("ORKA STUDIO", 20, 20);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(isPublic ? "RELATÓRIO SEMANAL" : "RELATÓRIO INTERNO (COMPARATIVO)", 20, 30);
    doc.text(rangeStr, 150, 30);

    // Corpo
    doc.setTextColor(0, 0, 0);
    let y = 60;

    doc.setFontSize(16);
    doc.text("Métricas Gerais", 20, y);
    y += 10;

    const metrics = [
        { label: "Jogadores Ativos", val: curr.users, prev: prev.users },
        { label: "Sessões Totais", val: curr.sessions, prev: prev.sessions },
        { label: "Horas Jogadas (Games)", val: (curr.game_time / 3600).toFixed(1) + 'h', prev: (prev.game_time / 3600).toFixed(1) + 'h' },
        { label: "Horas no Hub", val: (curr.hub_time / 3600).toFixed(1) + 'h', prev: (prev.hub_time / 3600).toFixed(1) + 'h' }
    ];

    metrics.forEach(m => {
        doc.setFontSize(12);
        doc.text(`${m.label}:`, 20, y);
        doc.text(`${m.val}`, 80, y);

        if (!isPublic) {
            const valNum = parseFloat(m.val);
            const prevNum = parseFloat(m.prev);
            
            if (!isNaN(valNum) && !isNaN(prevNum) && prevNum > 0) {
                const diff = ((valNum - prevNum) / prevNum) * 100;
                const symbol = diff > 0 ? "▲" : (diff < 0 ? "▼" : "=");
                const color = diff > 0 ? [0, 150, 0] : (diff < 0 ? [200, 0, 0] : [100, 100, 100]);
                
                doc.setTextColor(...color);
                doc.text(`${symbol} ${Math.abs(diff).toFixed(1)}%`, 110, y);
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setTextColor(150, 150, 150);
                doc.text("(Sem dados prev)", 110, y);
                doc.setTextColor(0, 0, 0);
            }
        }
        y += 10;
    });

    // Detalhe Jogos
    y += 20;
    doc.setFontSize(16);
    doc.text("Performance por Jogo", 20, y);
    y += 10;

    (curr.games_stats || []).forEach(game => {
        if (game.game_id === 'orkahub') return;
        const name = game.game_id.toUpperCase().replace('_', ' ');
        const duration = (game.time / 60).toFixed(1) + ' min';
        
        doc.setFontSize(11);
        doc.text(`• ${name}: ${game.plays} plays | ${duration}`, 25, y);
        y += 8;
    });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Gerado automaticamente pelo Orka Command Center", 20, 280);

    const filename = isPublic ? `Orka_Relatorio_${formatDate(end)}.pdf` : `Orka_INTERNO_${formatDate(end)}.pdf`;
    doc.save(filename);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Verifica quais jogos o usuário já interagiu hoje (ganhou ou perdeu)
// No script.js, substitua a antiga checkDailyStatus por esta:
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