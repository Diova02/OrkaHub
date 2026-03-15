document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURAÇÃO DOS EDITORES ---
    const cmConfig = { theme: 'monokai', lineNumbers: true, lineWrapping: true, tabSize: 2 };
    const editors = {
        html: CodeMirror(document.getElementById('editor-html'), { ...cmConfig, mode: 'xml' }),
        css: CodeMirror(document.getElementById('editor-css'), { ...cmConfig, mode: 'css' }),
        js: CodeMirror(document.getElementById('editor-js'), { ...cmConfig, mode: 'javascript' })
    };

    // --- 2. SISTEMA DE MODAL CUSTOMIZADO ---
    const modal = document.getElementById('orka-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalInput = document.getElementById('modal-input');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    function showModal({ title, message, type = 'alert', inputValue = '' }) {
        return new Promise((resolve) => {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            if (type === 'prompt') {
                modalInput.style.display = 'block'; modalInput.value = inputValue;
                setTimeout(() => modalInput.focus(), 100);
            } else { modalInput.style.display = 'none'; }

            btnCancel.style.display = (type === 'alert') ? 'none' : 'block';
            modal.classList.add('active');

            const cleanup = () => { modal.classList.remove('active'); btnConfirm.onclick = null; btnCancel.onclick = null; };
            btnConfirm.onclick = () => { cleanup(); resolve(type === 'prompt' ? modalInput.value : true); };
            btnCancel.onclick = () => { cleanup(); resolve(type === 'prompt' ? null : false); };
        });
    }

    // --- 3. PERSISTÊNCIA DE PROJETOS ---
    const STORAGE_KEY = 'orka_lab_projects';
    const ACTIVE_KEY = 'orka_lab_active_id';
    let projects = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    let currentProjectId = localStorage.getItem(ACTIVE_KEY);

    if (Object.keys(projects).length === 0) {
        const defaultId = 'proj_' + Date.now();
        projects[defaultId] = {
            name: 'Meu Primeiro Jogo',
            html: '<h1>Olá, Orka Hub!</h1>\n<button onclick="testLog()">Testar Console</button>',
            css: 'h1 { color: #0055ff; text-align: center; font-family: sans-serif; }',
            js: 'console.log("Lab iniciado!");\n\nwindow.testLog = () => {\n  console.warn("Isso é um aviso!");\n};'
        };
        currentProjectId = defaultId;
        saveData();
    } else if (!currentProjectId || !projects[currentProjectId]) {
        currentProjectId = Object.keys(projects)[0];
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        localStorage.setItem(ACTIVE_KEY, currentProjectId);
    }

    function loadActiveProject() {
        const p = projects[currentProjectId];
        if (p) {
            editors.html.setValue(p.html || '');
            editors.css.setValue(p.css || '');
            editors.js.setValue(p.js || '');
            document.getElementById('active-project-name').innerHTML = `${p.name} <span class="material-icons" style="font-size: 0.7rem;">edit</span>`;
            renderProjectList();
        }
    }

    Object.values(editors).forEach(editor => {
        editor.on('change', () => {
            if(projects[currentProjectId]) {
                projects[currentProjectId].html = editors.html.getValue();
                projects[currentProjectId].css = editors.css.getValue();
                projects[currentProjectId].js = editors.js.getValue();
                saveData();
            }
        });
    });

    // --- 4. MOTOR DE EXECUÇÃO & CONSOLE ---
    const consoleOutput = document.getElementById('console-output');
    
    // Script injetado para capturar logs do iframe
    const consoleScript = `
        <script>
            window.onerror = function(msg, url, lineNo, columnNo, error) {
                window.parent.postMessage({ type: 'error', text: msg + ' (Linha: ' + lineNo + ')' }, '*');
                return false;
            };
            ['log', 'warn', 'error'].forEach(method => {
                const original = console[method];
                console[method] = function(...args) {
                    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
                    window.parent.postMessage({ type: method, text: text }, '*');
                    original.apply(console, args);
                };
            });
        <\/script>
    `;

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
            const div = document.createElement('div');
            div.className = `log-line log-${event.data.type}`;
            div.textContent = `> ${event.data.text}`;
            consoleOutput.appendChild(div);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
    });

    function runCode() {
        consoleOutput.innerHTML = ''; // Limpa o console a cada execução
        const p = projects[currentProjectId];
        const iframe = document.getElementById('preview-frame');
        
        const hasHtmlTag = /<html/i.test(p.html);
        let finalOutput = '';

        if (hasHtmlTag) {
            finalOutput = p.html
                .replace(/<head>/i, `<head>${consoleScript}`)
                .replace(/<\/head>/i, `<style>${p.css}</style></head>`)
                .replace(/<\/body>/i, `<script type="module">${p.js}<\/script></body>`);
        } else {
            finalOutput = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    ${consoleScript}
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>${p.css}</style>
                </head>
                <body>
                    ${p.html}
                    <script type="module">${p.js}<\/script>
                </body>
                </html>
            `;
        }
        iframe.srcdoc = finalOutput;
    }

    // --- 5. NAVEGAÇÃO DE ABAS & ATALHOS ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const viewEditor = document.getElementById('view-editor');
    const viewPreview = document.getElementById('view-preview');
    const toolbar = document.getElementById('mobile-toolbar');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetView = btn.getAttribute('data-view');
            
            if (targetView === 'preview') {
                viewEditor.classList.remove('active');
                viewPreview.classList.add('active');
                toolbar.style.display = 'none';
                runCode(); 
            } else {
                viewPreview.classList.remove('active');
                viewEditor.classList.add('active');
                toolbar.style.display = 'flex';

                const targetLang = btn.getAttribute('data-target');
                document.querySelectorAll('.editor-pane').forEach(p => p.classList.remove('active'));
                document.getElementById(`editor-${targetLang}`).classList.add('active');
                setTimeout(() => editors[targetLang].refresh(), 10);
            }
        });
    });

    document.querySelectorAll('.shortcut-key').forEach(btn => {
        btn.addEventListener('click', () => {
            const activePane = document.querySelector('.editor-pane.active');
            const editor = editors[activePane.id.replace('editor-', '')];
            editor.getDoc().replaceRange(btn.innerText, editor.getDoc().getCursor());
            editor.focus();
        });
    });

    // --- 6. BARRA SUPERIOR & SIDEBAR ---
    document.getElementById('btn-run').addEventListener('click', () => {
        const previewBtn = document.querySelector('[data-view="preview"]');
        if(!previewBtn.classList.contains('active')) previewBtn.click();
        else runCode(); // Força recarregar se já estiver no preview
    });

    document.getElementById('btn-clear').addEventListener('click', async () => {
        const confirmClear = await showModal({ title: 'Limpar Código', message: 'Deseja apagar todo o código deste projeto?', type: 'confirm' });
        if (confirmClear) {
            editors.html.setValue(''); editors.css.setValue(''); editors.js.setValue('');
        }
    });

    // Renomear Projeto Clicando no Topo
    document.getElementById('active-project-name').addEventListener('click', async () => {
        const p = projects[currentProjectId];
        const newName = await showModal({ title: 'Renomear Projeto', message: 'Digite o novo nome:', type: 'prompt', inputValue: p.name });
        if (newName && newName.trim() !== '') {
            p.name = newName.trim();
            saveData(); loadActiveProject();
        }
    });

    // Lógica da Sidebar
    const sidebar = document.getElementById('lab-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    function toggleSidebar() { sidebar.classList.toggle('active'); overlay.classList.toggle('active'); }
    document.getElementById('btn-menu').addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);

    function renderProjectList() {
        const projectListEl = document.getElementById('project-list');
        projectListEl.innerHTML = '';
        Object.keys(projects).forEach(id => {
            const p = projects[id];
            const div = document.createElement('div');
            div.className = `project-item ${id === currentProjectId ? 'active' : ''}`;
            div.innerHTML = `
                <span class="project-name">${p.name}</span>
                <button class="btn-icon btn-delete-project" title="Excluir">
                    <span class="material-icons" style="font-size: 1.1rem; pointer-events:none;">delete</span>
                </button>
            `;
            
            div.addEventListener('click', async (e) => {
                if(e.target.closest('.btn-delete-project')) {
                    if(Object.keys(projects).length === 1) return showModal({ title: 'Atenção', message: 'Você não pode excluir seu único projeto.' });
                    
                    const confirmDel = await showModal({ title: 'Excluir Projeto', message: `Excluir "${p.name}" para sempre?`, type: 'confirm' });
                    if(confirmDel) {
                        delete projects[id];
                        if(currentProjectId === id) currentProjectId = Object.keys(projects)[0];
                        saveData(); loadActiveProject();
                    }
                } else {
                    currentProjectId = id;
                    loadActiveProject();
                    toggleSidebar();
                }
            });
            projectListEl.appendChild(div);
        });
    }

    document.getElementById('btn-new-project').addEventListener('click', async () => {
        const name = await showModal({ title: 'Novo Projeto', message: 'Nome do projeto:', type: 'prompt' });
        if(name && name.trim() !== '') {
            const newId = 'proj_' + Date.now();
            projects[newId] = { name: name.trim(), html: '', css: '', js: '' };
            currentProjectId = newId;
            saveData(); loadActiveProject();
            toggleSidebar();
        }
    });

    // Exportar ZIP
    document.getElementById('btn-export').addEventListener('click', () => {
        const zip = new JSZip(); const p = projects[currentProjectId];
        const safeName = p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let finalHtml = p.html;
        
        if (!/<html/i.test(finalHtml)) {
            finalHtml = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <title>${p.name}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  ${p.html}\n  <script type="module" src="script.js"></script>\n</body>\n</html>`;
        } else {
            finalHtml = finalHtml.replace(/<\/head>/i, `  <link rel="stylesheet" href="style.css">\n</head>`).replace(/<\/body>/i, `  <script type="module" src="script.js"></script>\n</body>`);
        }
        
        zip.file("index.html", finalHtml); zip.file("style.css", p.css); zip.file("script.js", p.js);
        zip.generateAsync({type:"blob"}).then(content => {
            const link = document.createElement('a'); link.href = URL.createObjectURL(content);
            link.download = `${safeName}_orkalab.zip`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });
    });

    // Inicializa
    loadActiveProject();
});