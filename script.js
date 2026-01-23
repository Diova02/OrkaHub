import { OrkaCloud } from './core/scripts/orka-cloud.js';
import { OrkaFX } from './core/scripts/orka-lib.js'; 
import { translations } from './translate.js'; 

// NOTA: jsPDF agora é carregado via <script> no HTML, não via import, para evitar erros de módulo.

export const gamesList = [
    { id: 'zoo', type: 'daily', title: 'ORKA ZOO', descKey: 'game_zoo_desc', icon: 'zoo-logo.png', print: 'print-zoo.png', url: 'games/orkazoo/', releaseDate: '2026-01-05', active: true },
    { id: 'jinx', type: 'web', title: 'ORKA JINX', descKey: 'game_jinx_desc', icon: 'jinx-logo.png', print: 'print-jinx.png', url: 'games/orkajinx/', releaseDate: '2026-01-13', active: true },
    { id: 'eagle', type: 'daily', title: 'EAGLE AIM', descKey: 'game_eagle_desc', icon: 'eagle-logo.png', print: 'print-eagle.png', url: 'games/eagleaim/', releaseDate: '2026-01-17', active: true },
    { id: 'listit', type: 'daily', title: 'LISTIT', descKey: 'game_listit_desc', icon: null, print: null, url: 'games/listit/', active: true, adminOnly: true },
    // Em breve
    { id: 'disco', type: 'soon', title: 'DISCOMANIA', descKey: 'game_disco_desc', icon: null, print: null, url: '#', active: false },
    { id: 'firewall', type: 'soon', title: 'FIREWALL', descKey: 'game_firewall_desc', icon: null, print: null, url: '#', active: false }
];

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

// --- INICIALIZAÇÃO ---

window.addEventListener('load', () => {
    // 1. Define mensagem aleatória
    const loaderMsg = document.getElementById('loader-msg');
    if (loaderMsg) {
        loaderMsg.textContent = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    }

    initHub();
    
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
    await OrkaCloud.startSession('orka_hub');
    
    // 3. Lógica do "Recepcionista" (Check Redirect)
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnTo');
    
    const profile = OrkaCloud.getProfile();
    if (returnUrl && profile && profile.nickname) {
        OrkaFX.toast("Redirecionando para o jogo...", "info");
        setTimeout(() => window.location.href = decodeURIComponent(returnUrl), 800);
        return; 
    }

    // 4. Carrega UI
    updateHubUI();
}

function updateHubUI() {
    const profile = OrkaCloud.getProfile(); 
    if (!profile) return;

    // A. Idioma
    const langFull = profile.language || 'pt-BR';
    applyHubTranslation(langFull);
    updateLangButtons(langFull);

    // B. Nickname
    if (profile.nickname) {
        els.displayNick.textContent = profile.nickname;
        els.inputNick.value = profile.nickname;
        els.viewMode.style.display = 'flex';
        els.editMode.style.display = 'none';
        if(els.btnAdd) els.btnAdd.style.display = 'none';
    } else {
        els.displayNick.textContent = '';
        els.inputNick.value = '';
        els.viewMode.style.display = 'none';
        els.editMode.style.display = 'none';
        if(els.btnAdd) els.btnAdd.style.display = 'block';
        
        if (!localStorage.getItem('orka_hub_intro_seen')) {
            openModal();
            OrkaFX.toast("Bem-vindo! Crie seu perfil.", "info");
            localStorage.setItem('orka_hub_intro_seen', 'true');
        }
    }

    // C. Avatar & Header
    updateAvatarUI(profile.profile_image); 

    // D. Bolos
    const boloDisplay = document.getElementById('header-bolo-count');
    if (boloDisplay) boloDisplay.textContent = profile.bolo || 0;

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

    // F. Admin Visibility
    const role = profile.role || 'user';
    if (role === 'admin') {
        if(els.btnAdmin) els.btnAdmin.style.display = "block";
    } else {
        if(els.btnAdmin) els.btnAdmin.style.display = "none";
        if(document.getElementById('section-admin')?.classList.contains('active')) {
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

    renderGames(lang);
}

function renderGames(lang) {
    const t = translations[lang];
    const role = OrkaCloud.getProfile()?.role || 'user';

    ['daily', 'web', 'soon', 'pnp'].forEach(type => {
        const container = document.getElementById(`list-${type}`);
        if(container) container.innerHTML = '';
    });

    gamesList.forEach(game => {
        if (game.adminOnly && role !== 'admin') return;

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
        updateAuthMsg("Erro ao enviar.", "wrong");
        console.error(error);
    }
});

document.getElementById('btn-verify-code')?.addEventListener('click', async () => {
    const email = els.inputEmail.value.trim();
    const token = els.inputOtp.value.trim();
    updateAuthMsg("Verificando...", "info");

    const supabase = OrkaCloud.getClient();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

    if (!error) {
        updateAuthMsg("Sucesso!", "correct");
        OrkaFX.confetti();
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
    if (!adminDataCache) return;

    // Toggle: Se marcado, usa dados limpos (sem admin). Se desmarcado, usa raw.
    const hideAdmins = document.getElementById('toggle-admin-data') && document.getElementById('toggle-admin-data').checked;
    const dataset = hideAdmins ? adminDataCache.clean : adminDataCache.raw;

    // 1. KPIs
    document.getElementById('adm-users').textContent = dataset.users;
    document.getElementById('adm-sessions').textContent = dataset.sessions;
    
    // TEMPO SEPARADO (Hub vs Game)
    document.getElementById('adm-game-time').textContent = formatDuration(dataset.game_time);
    document.getElementById('adm-hub-time').textContent = formatDuration(dataset.hub_time);

    // 2. Tabela Performance
    const tbody = document.querySelector('#adm-games-table tbody');
    tbody.innerHTML = '';
    
    // Ordena jogos por tempo total
    const sortedGames = (dataset.games_stats || []).sort((a,b) => b.time - a.time);

    if (sortedGames.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sem dados.</td></tr>';
        return;
    }

    sortedGames.forEach(stat => {
        const isHub = stat.game_id === 'orka_hub';
        const gameInfo = gamesList.find(g => g.id === stat.game_id);
        
        let title = gameInfo ? gameInfo.title : stat.game_id;
        if (isHub) title = "🏠 ORKA HUB (Menu)";

        const row = `
            <tr style="${isHub ? 'opacity:0.7; font-style:italic;' : ''}">
                <td style="text-align:left;">${title}</td>
                <td>${stat.plays}</td>
                <td>${stat.uniques}</td>
                <td style="color:${isHub ? '#ccc' : 'var(--orka-accent)'}">${formatDuration(stat.time)}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
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
        if (game.game_id === 'orka_hub') return;
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