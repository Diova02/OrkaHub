import { OrkaCloud } from './core/scripts/orka-cloud.js';
import { OrkaFX } from './core/scripts/orka-lib.js'; // Importando FX para o Toast

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
let welcomeBtn = null;

// --- FUNÇÕES ---

// Transforma loadProfileData em async para esperar o Cloud
async function loadProfileData() {
    // 1. CARREGAMENTO INICIAL (A MÁGICA ACONTECE AQUI)
    // Isso garante que temos os dados reais do banco antes de decidir abrir o modal
    await OrkaCloud.init();

    await OrkaCloud.startSession('orka_hub'); // <--- ISSO GERA O SESSION_ID

    const currentNick = OrkaCloud.getNickname();
    const currentLang = OrkaCloud.getLanguage();
    const avatarUrl = OrkaCloud.getAvatarUrl();

    // Reset visual
    if(welcomeBtn) welcomeBtn.style.display = 'none';

    // 2. Avatar
    const imgElement = document.getElementById('user-avatar');
    const iconElement = document.getElementById('default-avatar-icon');
    if (imgElement && iconElement) {
        if (avatarUrl) {
            imgElement.src = avatarUrl;
            imgElement.style.display = 'block';
            iconElement.style.display = 'none';
        } else {
            imgElement.style.display = 'none';
            iconElement.style.display = 'block';
        }
    }

    // 3. Nickname & Lógica de Abertura Automática
    if (currentNick) {
        // Tem nick: Mostra normal
        displayNick.textContent = currentNick;
        inputNick.value = currentNick;
        
        viewMode.style.display = 'flex';
        editMode.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'none';
    } else {
        // Não tem nick: Prepara UI de "Novo"
        displayNick.textContent = '';
        inputNick.value = '';
        
        viewMode.style.display = 'none';
        editMode.style.display = 'none';
        if(btnAdd) btnAdd.style.display = 'block'; 

        // LÓGICA DA PRIMEIRA VEZ (Check LocalStorage)
        const hasSeenIntro = localStorage.getItem('orka_hub_intro_seen');
        
        if (!hasSeenIntro) {
            openModal(false); // Abre
            OrkaFX.toast("Bem vindo ao Orka Hub!", "info"); // Toast
            localStorage.setItem('orka_hub_intro_seen', 'true'); // Marca como visto
        }
    }

    // 4. Idioma
    langBtns.forEach(btn => {
        if (btn.dataset.lang === currentLang) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
}

function openModal(forceStay = false) {
    if (!modal) return;
    modal.classList.add('active');
    if(btnClose) btnClose.style.display = 'flex'; 
    modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };
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
        if(btnAdd) btnAdd.style.display = 'none';

        if (!welcomeBtn) {
            welcomeBtn = document.createElement('button');
            welcomeBtn.className = 'orka-btn orka-btn-primary';
            welcomeBtn.style.width = '100%';
            welcomeBtn.style.marginTop = '15px';
            welcomeBtn.style.padding = '15px';
            welcomeBtn.onclick = () => modal.classList.remove('active');
            const container = document.querySelector('.profile-section');
            if(container) container.appendChild(welcomeBtn);
        }

        welcomeBtn.textContent = `Tudo pronto, ${newNick}!`;
        welcomeBtn.style.display = 'block';
        
        if (!localStorage.getItem('orka_language')) OrkaCloud.setLanguage('pt-BR');
        
        // Garante que não abre mais sozinho
        localStorage.setItem('orka_hub_intro_seen', 'true');
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

// Eventos
if (btnOpen) btnOpen.addEventListener('click', () => { 
    // Força abrir mesmo se já viu intro, pois foi clique manual
    openModal(false); 
    loadProfileData(); // Recarrega dados para garantir frescor
});

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

// Exemplo de conexão (adicione no seu script.js)
const btnRegister = document.getElementById('btn-register');
const btnLogin = document.getElementById('btn-login');

btnRegister.onclick = async () => {
    const email = document.getElementById('acc-email').value;
    const pass = document.getElementById('acc-pass').value;
    
    // Chama o OrkaCloud V3.3
    const result = await OrkaCloud.registerAccount(email, pass);
    
    if (result.success) {
        if (result.bonus) OrkaFX.toast("Conta criada! +5 Bolos 🎂", "success");
        else OrkaFX.toast("Conta atualizada!", "success");
        // Fecha modal
    } else {
        OrkaFX.toast(result.error, "error");
    }
};

btnLogin.onclick = async () => {
    const email = document.getElementById('acc-email').value;
    const pass = document.getElementById('acc-pass').value;
    
    // Chama o OrkaCloud V3.3
    const result = await OrkaCloud.loginAccountAccount(email, pass);
    
    if (result.success) {
        if (result.bonus) OrkaFX.toast("Conta criada! +5 Bolos 🎂", "success");
        else OrkaFX.toast("Conta atualizada!", "success");
        // Fecha modal
    } else {
        OrkaFX.toast(result.error, "error");
    }
};

// Inicialização
window.addEventListener('load', loadProfileData);