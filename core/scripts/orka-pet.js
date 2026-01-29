import { OrkaMath, OrkaFX } from './orka-lib.js';

export class OrkaPet {
    constructor() {
        this.el = null;
        
        // --- ESTADO PERSISTENTE (Salvo no localStorage) ---
        this.state = {
            pos: { x: 50, y: 50 },
            isHidden: true, // Começa oculto
            color: '#ffcc00',
            accessory: null,
            unlocked: ['#ffcc00', '#ff5555', '#55ff55', '#5555ff', '#ffffff']
        };

        // --- ESTADO DE EXECUÇÃO (Física/Lógica) ---
        this.vel = { x: 0, y: 0 };
        this.isDragging = false;
        this.isFlying = false;
        this.isWalking = false;
        
        // Controle de Mouse/Touch
        this.dragOffset = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.lastDragTime = 0;
        
        this.aiTimer = null;
    }

    init() {
        // 1. Carrega Save
        const saved = localStorage.getItem('orka_pet_data');
        if (saved) {
            try { this.state = { ...this.state, ...JSON.parse(saved) }; } catch(e){}
        }

        // 2. Configura o Botão do Header (Sempre existe)
        this.setupHeaderButton();

        // 3. Se NÃO estiver oculto, cria o bicho
        if (!this.state.isHidden) {
            this.spawn(true); // true = sem animação de pop
        }
    }

    // =================================================================
    //  GERENCIAMENTO DE VIDA (HEADER & SPAWN)
    // =================================================================

    setupHeaderButton() {
        const btn = document.getElementById('btn-pet-toggle');
        if (!btn) return;

        const icon = document.getElementById('btn-pet-toggle');
        const face = document.getElementById('pet-preview-dummy');

        // Função local para atualizar visual do botão
        const updateBtnUI = () => {
            const icon = document.getElementById('btn-pet-icon');
            const face = document.getElementById('btn-pet-face-preview');

            // Se os elementos não existirem, sai da função sem quebrar o site
            if (!icon || !face) return; 

            if (this.state && !this.state.isHidden) {
                icon.style.display = 'none';
                face.style.display = 'flex';
            } else {
                icon.style.display = 'block';
                face.style.display = 'none';
            }
        }

        // Roda a primeira vez para garantir o estado correto
        updateBtnUI();

        // Click Handler
        btn.onclick = () => {
            if (this.state.isHidden) {
                this.spawn(); 
                updateBtnUI(); // <--- Agora o código chegará aqui!
            } else {
                this.openCustomizationModal(); 
            }
        };
    }

    spawn(instant = false) {
        this.state.isHidden = false;
        this.saveState(); // Garante que a função existe lá embaixo

        if (!this.el) this.createDOM();
        
        this.el.style.display = 'flex';
        this.updateSkin(); 

        // Animation POP
        if (!instant) {
            // Posição inicial: perto do botão do header
            this.el.style.top = "60px";
            this.el.style.left = "85%"; 
            this.el.style.transform = "scale(0)";
            
            // Pequeno delay para o navegador processar o display:flex antes da transição
            requestAnimationFrame(() => {
                this.el.style.transition = "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
                this.el.style.transform = "scale(1)";
            });
        } else {
            this.updateDOMPosition();
        }

        this.startAI();
    }

    recall() {
        this.state.isHidden = true;
        this.saveState();
        
        // Para Cérebro
        clearTimeout(this.aiTimer);
        this.isWalking = false;

        // Animation Shrink
        if (this.el) {
            this.el.style.transition = "transform 0.3s, top 0.5s, left 0.5s";
            this.el.style.transform = "scale(0) rotate(180deg)";
            this.el.style.top = "20px"; // Vai em direção ao header
            this.el.style.left = "90%";
            
            setTimeout(() => {
                if(this.el) {
                    this.el.remove(); 
                    this.el = null;
                }
            }, 500);
        }

        // Atualiza o botão imediatamente
        this.setupHeaderButton();
    }

    // =================================================================
    //  DOM & VISUAL
    // =================================================================

    createDOM() {
        this.el = document.createElement('div');
        this.el.id = 'orka-pet-layer';
        this.el.className = 'orka-pet';
        
        this.el.innerHTML = `
            <div class="pet-accessory-layer"></div>
            <div class="pet-face">
                <div class="pet-eye left" id="pet-eye-l"></div>
                <div class="pet-eye right" id="pet-eye-r"></div>
                <div class="pet-mouth" id="pet-mouth">w</div>
            </div>
        `;
        
        document.body.appendChild(this.el);
        
        // Cache dos elementos internos
        this.eyeL = this.el.querySelector('#pet-eye-l');
        this.eyeR = this.el.querySelector('#pet-eye-r');
        this.mouth = this.el.querySelector('#pet-mouth');

        this.bindEvents();
    }

    updateSkin() {
        if (!this.el) return;
        
        // 1. Cor
        this.el.style.backgroundColor = this.state.color;

        // 2. Acessório
        const accLayer = this.el.querySelector('.pet-accessory-layer');
        if (this.state.accessory) {
            accLayer.style.backgroundImage = `url('assets/pet/${this.state.accessory}.png')`;
            accLayer.style.display = 'block';
        } else {
            accLayer.style.display = 'none';
        }
    }

    updateDOMPosition() {
        if(!this.el) return;
        this.el.style.left = this.state.pos.x + 'vw';
        this.el.style.top = this.state.pos.y + 'vh';
    }

    setTransition(enable) {
        if(!this.el) return;
        this.el.style.transition = enable ? 'left 2s ease-in-out, top 2s ease-in-out' : 'none';
    }

    setFace(mood) {
        if(!this.mouth) return;
        if (mood === 'surprised') this.mouth.textContent = 'O';
        else if (mood === 'dizzy') {
            this.mouth.textContent = 'o';
            this.eyeL.style.height = '2px'; this.eyeL.style.transform = 'rotate(45deg)';
            this.eyeR.style.height = '2px'; this.eyeR.style.transform = 'rotate(-45deg)';
        }
        else {
            this.mouth.textContent = 'w';
            this.eyeL.style.height = '8px'; this.eyeL.style.transform = 'none';
            this.eyeR.style.height = '8px'; this.eyeR.style.transform = 'none';
        }
    }

    // =================================================================
    //  INTERAÇÃO E FÍSICA
    // =================================================================

    bindEvents() {
        // Mouse
        this.el.addEventListener('mousedown', (e) => this.onGrab(e));
        window.addEventListener('mousemove', (e) => this.onDrag(e));
        window.addEventListener('mouseup', (e) => this.onRelease(e));
        
        // Touch
        this.el.addEventListener('touchstart', (e) => this.onGrab(e.touches[0]));
        window.addEventListener('touchmove', (e) => this.onDrag(e.touches[0]));
        window.addEventListener('touchend', (e) => this.onRelease(e));
    }

    onGrab(e) {
        if (this.state.isHidden || this.isWalking || this.isFlying) return;
        if(e.preventDefault) e.preventDefault(); 
        
        this.isDragging = true;
        this.el.classList.add('dragging');
        this.setTransition(false);
        
        const rect = this.el.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.lastDragTime = Date.now();
        this.vel = { x:0, y:0 };

        this.setFace('surprised');
    }

    onDrag(e) {
        if (this.state.isHidden || this.isWalking) return;

        if (!this.isDragging) {
            this.lookAt(e.clientX, e.clientY);
            return;
        }

        const now = Date.now();
        const dt = now - this.lastDragTime;

        // Move
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        this.el.style.left = x + 'px';
        this.el.style.top = y + 'px';

        // Velocidade (px/frame)
        if (dt > 50) { 
            this.vel = { 
                x: e.clientX - this.lastMousePos.x, 
                y: e.clientY - this.lastMousePos.y 
            };
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.lastDragTime = now;
        }
    }

    onRelease(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.el.classList.remove('dragging');
        this.setFace('default');

        const timeSinceDrag = Date.now() - this.lastDragTime;
        
        // Detecta arremesso
        if (timeSinceDrag < 100 && (Math.abs(this.vel.x) > 3 || Math.abs(this.vel.y) > 3)) {
            this.vel.x *= 1.5;
            this.vel.y *= 1.5;
            this.startFly();
        } else {
            this.saveState();
        }
    }

    startFly() {
        this.isFlying = true;
        this.setTransition(false);
        this.setFace('dizzy');

        const loop = () => {
            if (!this.isFlying || this.isDragging || this.state.isHidden) return;

            const rect = this.el.getBoundingClientRect();
            let nextX = rect.left + this.vel.x;
            let nextY = rect.top + this.vel.y;

            // Colisões
            let hit = false;
            if (nextX <= 0 || nextX >= window.innerWidth - 60) {
                this.vel.x *= -0.8; 
                nextX = Math.max(0, Math.min(nextX, window.innerWidth - 60));
                hit = true;
            }
            if (nextY <= 0 || nextY >= window.innerHeight - 60) {
                this.vel.y *= -0.8;
                nextY = Math.max(0, Math.min(nextY, window.innerHeight - 60));
                hit = true;
            }

            if (hit && (Math.abs(this.vel.x) > 10 || Math.abs(this.vel.y) > 10)) {
                OrkaFX.shake('orka-pet-layer', 3);
            }

            // Atrito
            this.vel.x *= 0.95;
            this.vel.y *= 0.95;

            this.el.style.left = nextX + 'px';
            this.el.style.top = nextY + 'px';

            if (Math.abs(this.vel.x) < 0.5 && Math.abs(this.vel.y) < 0.5) {
                this.isFlying = false;
                this.setFace('default');
                this.saveState();
            } else {
                requestAnimationFrame(loop);
            }
        };
        requestAnimationFrame(loop);
    }

    // =================================================================
    //  AI & COMPORTAMENTO
    // =================================================================

    startAI() {
        const think = () => {
            if (this.state.isHidden) return; // Se escondeu, para de pensar

            if (this.isDragging || this.isFlying) {
                this.aiTimer = setTimeout(think, 1000); 
                return;
            }

            // 1. Modo Andar
            this.isWalking = true;
            this.el.classList.add('walking');

            const targetX = Math.random() * (window.innerWidth - 100) + 20;
            const targetY = Math.random() * (window.innerHeight - 100) + 20;

            this.lookAt(targetX, targetY);
            
            // 2. Antecipação
            setTimeout(() => {
                if (this.state.isHidden || this.isDragging) {
                     this.isWalking = false; 
                     this.el.classList.remove('walking');
                     return;
                }
                
                // 3. Movimento
                this.setTransition(true); 
                this.el.style.left = targetX + 'px';
                this.el.style.top = targetY + 'px';

                // 4. Chegada
                setTimeout(() => {
                    this.saveState();
                    this.isWalking = false;
                    this.el.classList.remove('walking');
                    
                    // Agenda próximo movimento
                    this.aiTimer = setTimeout(think, Math.random() * 5000 + 5000);

                }, 2000); 

            }, 600);
        };
        
        this.aiTimer = setTimeout(think, 2000);
    }

    lookAt(targetX, targetY) {
        if(!this.eyeL) return;
        
        const rect = this.el.getBoundingClientRect();
        const centerX = rect.left + 30;
        const centerY = rect.top + 30;

        const dx = targetX - centerX;
        const dy = targetY - centerY;
        
        const angle = Math.atan2(dy, dx);
        const distance = Math.min(Math.sqrt(dx*dx + dy*dy), 100); 
        const ratio = distance / 100;
        const maxRadius = 6; 
        
        const moveX = Math.cos(angle) * maxRadius * ratio;
        const moveY = Math.sin(angle) * maxRadius * ratio;

        this.eyeL.style.transform = `translate(${moveX}px, ${moveY}px)`;
        this.eyeR.style.transform = `translate(${moveX}px, ${moveY}px)`;
        this.mouth.style.transform = `translate(${moveX*0.3}px, ${moveY*0.3}px) translateX(-50%)`;
    }

    // =================================================================
    //  MODAL DE CUSTOMIZAÇÃO
    // =================================================================

    openCustomizationModal() {
        const modal = document.getElementById('modal-pet-shop');
        if (!modal) return;
        
        // Preview
        const preview = document.getElementById('pet-preview-dummy');
        preview.style.backgroundColor = this.state.color;
        // Copia a face atual para o preview
        preview.innerHTML = this.el ? this.el.innerHTML : `<div class="pet-face">...</div>`;

        // Renderiza Cores
        const colorGrid = document.getElementById('pet-color-grid');
        colorGrid.innerHTML = '';
        this.state.unlocked.forEach(color => {
            const btn = document.createElement('div');
            btn.className = `color-option ${this.state.color === color ? 'selected' : ''}`;
            btn.style.backgroundColor = color;
            btn.onclick = () => {
                this.state.color = color;
                this.updateSkin(); 
                preview.style.backgroundColor = color; 
                this.saveState();
                
                // UI update
                modal.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            };
            colorGrid.appendChild(btn);
        });

        // Botão Recolher dentro do modal
        const btnRecall = document.getElementById('btn-recall-pet');
        btnRecall.onclick = () => {
            this.recall();
            modal.classList.remove('active');
        };

        // Fechar
        const closeBtns = modal.querySelectorAll('.close-pet-modal');
        closeBtns.forEach(b => b.onclick = () => modal.classList.remove('active'));

        // Tabs
        const tabs = modal.querySelectorAll('.tab-btn');
        tabs.forEach(t => {
            t.onclick = () => {
                tabs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                modal.querySelectorAll('.pet-tab-content').forEach(c => c.style.display = 'none');
                const content = document.getElementById('tab-' + t.dataset.target);
                if(content) content.style.display = 'block';
            }
        });

        modal.classList.add('active');
    }

    // =================================================================
    //  PERSISTÊNCIA (A Função que faltava!)
    // =================================================================

    saveState() {
        if (this.el && !this.state.isHidden) {
             const rect = this.el.getBoundingClientRect();
             this.state.pos = {
                x: (rect.left / window.innerWidth) * 100,
                y: (rect.top / window.innerHeight) * 100
            };
        }
        localStorage.setItem('orka_pet_data', JSON.stringify(this.state));
    }
}