import { OrkaCloud } from './core/scripts/orka-cloud.js';

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

// Variável para controle do botão de boas-vindas
let welcomeBtn = null;

// --- FUNÇÕES ---

function loadProfileData() {
    const currentNick = OrkaCloud.getNickname();
    const currentLang = OrkaCloud.getLanguage();

    // Remove botão de boas-vindas se existir (reset visual)
    if(welcomeBtn) welcomeBtn.style.display = 'none';

    // 1. Lógica do Nickname
    if (currentNick) {
        // Usuário existe
        displayNick.textContent = currentNick;
        inputNick.value = currentNick;
        
        viewMode.style.display = 'flex';
        editMode.style.display = 'none';
        btnAdd.style.display = 'none';
    } else {
        // Novo Usuário (Boas Vindas)
        displayNick.textContent = '';
        inputNick.value = '';
        
        viewMode.style.display = 'none';
        editMode.style.display = 'none';
        btnAdd.style.display = 'block'; 
        
        // MUDANÇA 1: openModal(false) -> Modal Opcional (sempre tem botão fechar)
        openModal(false); 
    }

    // 2. Lógica do Idioma
    langBtns.forEach(btn => {
        if (btn.dataset.lang === currentLang) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
}

function openModal(forceStay = false) {
    if (!modal) return;
    modal.classList.add('active');
    
    // MUDANÇA 2: Sempre mostramos o botão fechar, ignorando forceStay visualmente
    // Mantemos a lógica apenas para impedir clique fora se desejado, 
    // mas o botão X estará sempre lá.
    if(btnClose) btnClose.style.display = 'flex'; 

    if (forceStay) {
        modal.onclick = (e) => { if(e.target === modal) return; }; 
    } else {
        modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };
    }
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
        
        // MUDANÇA 3: Fluxo de Boas-Vindas
        // Esconde os modos de edição
        editMode.style.display = 'none';
        viewMode.style.display = 'none';
        btnAdd.style.display = 'none';

        // Cria ou atualiza o botão de boas-vindas
        if (!welcomeBtn) {
            welcomeBtn = document.createElement('button');
            welcomeBtn.className = 'orka-btn orka-btn-primary';
            welcomeBtn.style.width = '100%';
            welcomeBtn.style.marginTop = '15px';
            welcomeBtn.style.padding = '15px';
            welcomeBtn.onclick = () => modal.classList.remove('active'); // Fecha ao clicar
            
            // Insere no final da seção de perfil
            const container = document.querySelector('.profile-section');
            if(container) container.appendChild(welcomeBtn);
        }

        welcomeBtn.textContent = `Seja bem-vindo(a), ${newNick}!`;
        welcomeBtn.style.display = 'block';

        // Garante idioma padrão
        if (!localStorage.getItem('orka_language')) {
             OrkaCloud.setLanguage('pt-BR');
        }
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

// --- EVENTOS ---

if (btnOpen) {
    btnOpen.addEventListener('click', () => { 
        loadProfileData();
        openModal(false); 
    });
}

if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

if (btnEdit) btnEdit.addEventListener('click', () => toggleEditMode(true));
if (btnAdd) btnAdd.addEventListener('click', () => toggleEditMode(true));

if (btnSave) btnSave.addEventListener('click', saveNickname);
if (inputNick) {
    inputNick.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNickname();
    });
}

if (btnDelete) btnDelete.addEventListener('click', deleteNickname);

langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        OrkaCloud.setLanguage(lang);
        loadProfileData();
    });
});

// Inicialização
window.addEventListener('load', loadProfileData);