// --- ESTADO GLOBAL ---
let currentView = 'main-menu';
let historyStack = [];
let forwardStack = [];
let selectedIndex = 0;
let menuOptions = [];
let activeThreadId = null;

// NUEVO: ID único anónimo por navegador
let idDispositivo = localStorage.getItem('idDispositivo');
if (!idDispositivo) {
    idDispositivo = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('idDispositivo', idDispositivo);
}

const screenContent = document.getElementById('screen-content');
const screenTitle = document.getElementById('screen-title');
const btnMenu = document.getElementById('btn-menu');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnPlay = document.getElementById('btn-play');
const btnSelect = document.getElementById('btn-select');

const popup = document.getElementById('retro-popup');
const popupTitle = document.getElementById('popup-title');
const popupMessage = document.getElementById('popup-message');
const popupFooter = popup.querySelector('.popup-footer');

// --- INICIALIZACIÓN ---
if (!localStorage.getItem('ipodPosts')) {
    localStorage.setItem('ipodPosts', JSON.stringify([]));
}

// --- SISTEMA DE POPUPS RETRO ---
function showPopup(title, message, type = 'alert', inputValue = "", onAccept = null) {
    popupTitle.innerText = title;
    popupFooter.innerHTML = '';

    if (type === 'input') {
        popupMessage.innerHTML = `${message}<br><textarea id="popup-input">${inputValue}</textarea>`;
        popupFooter.innerHTML = `<button class="retro-btn" id="btn-accept">Aceptar</button>
                                 <button class="retro-btn" id="btn-cancel">Cancelar</button>`;
    } else if (type === 'confirm') {
        popupMessage.innerText = message;
        popupFooter.innerHTML = `<button class="retro-btn" id="btn-accept">Sí</button>
                                 <button class="retro-btn" id="btn-cancel">No</button>`;
    } else {
        popupMessage.innerText = message;
        popupFooter.innerHTML = `<button class="retro-btn" id="btn-accept">Aceptar</button>`;
    }
    
    popup.classList.remove('hidden');

    document.getElementById('btn-accept').onclick = () => {
        if (type === 'input' && onAccept) {
            const val = document.getElementById('popup-input').value;
            onAccept(val);
        } else if (type === 'confirm' && onAccept) {
            onAccept();
        }
        closePopup();
    };

    if (document.getElementById('btn-cancel')) {
        document.getElementById('btn-cancel').onclick = closePopup;
    }
}

window.closePopup = function() {
    popup.classList.add('hidden');
};

// --- DATOS Y TIEMPO ---
function cleanExpiredPosts() {
    let posts = JSON.parse(localStorage.getItem('ipodPosts'));
    const fiveHours = 5 * 60 * 60 * 1000;
    const now = Date.now();
    
    // Primero filtramos los posts que ya expiraron
    posts = posts.filter(post => (now - post.timestamp) < fiveHours);
    
    // Luego, dentro de los posts vivos, filtramos las respuestas que expiraron
    posts.forEach(post => {
        if (post.replies) {
            post.replies = post.replies.filter(reply => (now - reply.timestamp) < fiveHours);
        }
    });

    localStorage.setItem('ipodPosts', JSON.stringify(posts));
    return posts;
}

function getTimeRemaining(timestamp) {
    const total = 5 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = total - (now - timestamp);
    if (diff <= 0) return "Expirado";
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return `${hours}h ${minutes}m restantes`;
}

// --- RENDERIZADO ---
function renderMainMenu() {
    currentView = 'main-menu';
    screenTitle.innerText = "iPod";
    menuOptions = [
        { label: "Pensamientos", action: () => navigateTo('thoughts-menu') },
        { label: "Post", action: () => navigateTo('posts-view') },
        { label: "Inicio", action: () => window.location.href = 'index.html' },
        { label: "Oceano", action: () => window.location.href = 'explorar.html' }
    ];
    selectedIndex = 0;
    renderList(menuOptions);
}

function renderThoughtsMenu() {
    currentView = 'thoughts-menu';
    screenTitle.innerText = "Pensamientos";
    menuOptions = [
        { label: "Publicar", action: () => navigateTo('publish-view') },
        { label: "Publicaciones", action: () => navigateTo('my-posts-view') }
    ];
    selectedIndex = 0;
    renderList(menuOptions);
}

function renderPublishView() {
    currentView = 'publish-view';
    screenTitle.innerText = "Publicar";
    
    screenContent.innerHTML = `
        <div class="full-screen-view">
            <h3>¿Qué piensas?</h3>
            <textarea id="post-input" placeholder="Escribe algo..."></textarea>
            <button class="publish-btn" id="btn-submit-post">Publicar</button>
        </div>
    `;

    document.getElementById('btn-submit-post').addEventListener('click', async () => {
        const text = document.getElementById('post-input').value;
        if (text.trim() !== "") {
            try {
                await db.collection("ipodPosts").add({
                    user: "Anonimo",
                    text: text,
                    timestamp: Date.now(),
                    likes: 0,
                    dislikes: 0,
                    replies: [],
                    creadorId: idDispositivo // <--- GUARDAMOS TU ID
                });
                showPopup("Éxito", "¡Pensamiento publicado!");
                goBack(); 
            } catch (error) {
                console.error(error);
                showPopup("Error", "No se pudo conectar a la base de datos.");
            }
        } else {
            showPopup("Error", "No puedes publicar algo vacío.");
        }
    });
}

function renderMyPosts() {
    currentView = 'my-posts-view';
    screenTitle.innerText = "Publicaciones";
    
    db.collection("ipodPosts").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        if (snapshot.empty) {
            screenContent.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">No hay pensamientos recientes.</div>`;
            return;
        }

        let html = '';
        const now = Date.now();

        snapshot.forEach(docSnap => {
            const post = docSnap.data();
            const docId = docSnap.id;
            if (now - post.timestamp > 5 * 60 * 60 * 1000) return; // Ocultar expirados

            if (post.dislikes === undefined) post.dislikes = 0; 
            if (!post.replies) post.replies = [];

            // EL CANDADO: Solo mostramos los botones si el ID coincide
            let botonesAccion = '';
            if (post.creadorId === idDispositivo) {
                botonesAccion = `
                    <div class="post-actions">
                        <button class="action-btn" onclick="editPost('${docId}')">✏️ Editar</button>
                        <button class="action-btn" onclick="askDeletePost('${docId}')">🗑️ Eliminar</button>
                    </div>
                `;
            }

            html += `
                <div class="post-card">
                    <strong>${post.user}</strong>
                    <div class="post-text-box">${post.text}</div>
                    <span class="post-time">${getTimeRemaining(post.timestamp)}</span>
                    
                    <div class="reaction-container">
                        <button class="reaction-btn" onclick="reactToPost('${docId}', 'like')">❤️ ${post.likes}</button>
                        <button class="reaction-btn" onclick="reactToPost('${docId}', 'dislike')">👎 ${post.dislikes}</button>
                        <button class="action-reply-btn" onclick="openThread('${docId}')">💬 ${post.replies.length}</button>
                    </div>
                    ${botonesAccion}
                </div>
            `;
        });
        screenContent.innerHTML = html;
    });
}

function renderPostsFeed() {
    currentView = 'posts-view';
    screenTitle.innerText = "Post";

    db.collection("ipodPosts").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        if (snapshot.empty) {
            screenContent.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">No hay posts disponibles.</div>`;
            return;
        }

        let html = '';
        const now = Date.now();

        snapshot.forEach(docSnap => {
            const post = docSnap.data();
            const docId = docSnap.id;
            if (now - post.timestamp > 5 * 60 * 60 * 1000) return;

            if (post.dislikes === undefined) post.dislikes = 0;
            if (!post.replies) post.replies = [];

            html += `
                <div class="post-card">
                    <strong>${post.user}</strong>
                    <div class="post-text-box">${post.text}</div>
                    <span class="post-time">${getTimeRemaining(post.timestamp)}</span>
                    
                    <div class="reaction-container">
                        <button class="reaction-btn" onclick="reactToPost('${docId}', 'like')">❤️ ${post.likes}</button>
                        <button class="reaction-btn" onclick="reactToPost('${docId}', 'dislike')">👎 ${post.dislikes}</button>
                        <button class="action-reply-btn" onclick="openThread('${docId}')">💬 ${post.replies.length}</button>
                    </div>
                </div>
            `;
        });
        screenContent.innerHTML = html;
    });
}

// --- VISTA DE RESPUESTAS (THREAD) ACTUALIZADA ---
function renderThread() {
    currentView = 'thread-view';
    screenTitle.innerText = "Respuestas";
    
    // Escuchamos el documento específico en Firebase en tiempo real
    db.collection("ipodPosts").doc(activeThreadId).onSnapshot((docSnap) => {
        if (!docSnap.exists) {
            showPopup("Expirado", "Esta publicación ya no existe.");
            goBack();
            return;
        }

        const post = docSnap.data();
        const postId = docSnap.id;

        // Ocultar si ya expiró
        if (Date.now() - post.timestamp > 5 * 60 * 60 * 1000) {
            showPopup("Expirado", "Esta publicación ya expiró.");
            goBack();
            return;
        }

        if (!post.replies) post.replies = [];

        let repliesHtml = '';
        if (post.replies.length === 0) {
            repliesHtml = '<div style="text-align:center; color:#888; font-size:11px; margin-top:10px;">Sé el primero en responder.</div>';
        } else {
            post.replies.forEach((reply, index) => {
                if (reply.likes === undefined) reply.likes = 0;
                if (reply.dislikes === undefined) reply.dislikes = 0;

                repliesHtml += `
                    <div class="reply-item">
                        <div class="reply-header">
                            <strong>${reply.user}</strong>
                            <span class="reply-time">${getTimeRemaining(reply.timestamp)}</span>
                        </div>
                        <div>${reply.text}</div>
                        
                        <div class="reply-actions">
                            <button class="reply-action-btn" onclick="reactToReply('${postId}', ${index}, 'like')">❤️ ${reply.likes}</button>
                            <button class="reply-action-btn" onclick="reactToReply('${postId}', ${index}, 'dislike')">👎 ${reply.dislikes}</button>
                        </div>
                    </div>
                `;
            });
        }

        screenContent.innerHTML = `
            <div class="thread-view">
                <div class="original-post">
                    <strong>${post.user}</strong>
                    <div style="margin-top:3px;">${post.text}</div>
                </div>
                
                <div class="replies-list">
                    ${repliesHtml}
                </div>

                <div class="reply-input-container">
                    <input type="text" id="reply-input" placeholder="Responder...">
                    <button class="reply-send-btn" id="btn-send-reply">Enviar</button>
                </div>
            </div>
        `;

        document.getElementById('btn-send-reply').addEventListener('click', () => {
            const replyText = document.getElementById('reply-input').value;
            if (replyText.trim() !== "") {
                sendReply(postId, replyText);
            }
        });

        document.getElementById('reply-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const replyText = document.getElementById('reply-input').value;
                if (replyText.trim() !== "") sendReply(postId, replyText);
            }
        });
    });
}

window.openThread = function(id) {
    activeThreadId = id;
    historyStack.push(currentView);
    forwardStack = [];
    renderThread();
};

async function sendReply(postId, text) {
    const docRef = db.collection("ipodPosts").doc(postId);
    const doc = await docRef.get();
    
    if (doc.exists) {
        const post = doc.data();
        const nuevasRespuestas = post.replies || [];
        nuevasRespuestas.push({
            user: "Anonimo",
            text: text,
            timestamp: Date.now(),
            likes: 0,
            dislikes: 0,
            creadorId: idDispositivo // Aquí también guardamos quién respondió
        });

        await docRef.update({ replies: nuevasRespuestas });
        renderThread(); 
    }
}

// NUEVA FUNCIÓN: Reaccionar a una respuesta específica
window.reactToReply = async function(postId, replyIndex, type) {
    const docRef = db.collection("ipodPosts").doc(postId);
    const doc = await docRef.get();

    if (doc.exists) {
        const post = doc.data();
        if (post.replies && post.replies[replyIndex]) {
            const reply = post.replies[replyIndex];
            
            if (type === 'like') reply.likes = (reply.likes || 0) + 1;
            if (type === 'dislike') reply.dislikes = (reply.dislikes || 0) + 1;

            // Actualizamos el array completo en Firebase
            await docRef.update({ replies: post.replies });
            // El onSnapshot de renderThread hará que se actualice la pantalla solo
        }
    }
};
window.editPost = async function(docId) {
    const docRef = db.collection("ipodPosts").doc(docId);
    const doc = await docRef.get();
    
    if (doc.exists) {
        const post = doc.data();
        showPopup("Editar Publicación", "Modifica tu texto:", 'input', post.text, async (newText) => {
            if (newText.trim() !== "") {
                await docRef.update({ text: newText });
                showPopup("Actualizado", "Tu publicación ha sido editada.");
            }
        });
    }
};

window.askDeletePost = function(docId) {
    showPopup("Eliminar", "¿Seguro que quieres eliminar este recuerdo?", 'confirm', "", async () => {
        await db.collection("ipodPosts").doc(docId).delete();
        showPopup("Eliminado", "El recuerdo ha sido borrado.");
    });
};

window.reactToPost = async function(docId, type) {
    const docRef = db.collection("ipodPosts").doc(docId);
    const doc = await docRef.get();
    if (doc.exists) {
        if (type === 'like') await docRef.update({ likes: (doc.data().likes || 0) + 1 });
        if (type === 'dislike') await docRef.update({ dislikes: (doc.data().dislikes || 0) + 1 });
    }
};

// --- NAVEGACIÓN ---
function renderList(options) {
    let html = '<ul class="menu-list">';
    options.forEach((opt, index) => {
        const selectedClass = index === selectedIndex ? 'selected' : '';
        html += `<li class="menu-item ${selectedClass}" onclick="selectOption(${index})">${opt.label}</li>`;
    });
    html += '</ul>';
    screenContent.innerHTML = html;
}

window.selectOption = function(index) {
    if (currentView === 'main-menu' || currentView === 'thoughts-menu') {
        historyStack.push(currentView); 
        forwardStack = []; 
        menuOptions[index].action();
    }
};

function navigateTo(viewName) {
    switch(viewName) {
        case 'thoughts-menu': renderThoughtsMenu(); break;
        case 'publish-view': renderPublishView(); break;
        case 'my-posts-view': renderMyPosts(); break;
        case 'posts-view': renderPostsFeed(); break;
        case 'main-menu': renderMainMenu(); break;
        case 'thread-view': renderThread(); break;
    }
}

function goBack() {
    if (historyStack.length > 0) {
        forwardStack.push(currentView);
        const previousView = historyStack.pop();
        navigateTo(previousView);
    } else {
        renderMainMenu();
    }
}

function goForward() {
    if (forwardStack.length > 0) {
        historyStack.push(currentView);
        const nextView = forwardStack.pop();
        navigateTo(nextView);
    }
}

// --- EVENT LISTENERS ---
btnMenu.addEventListener('click', () => {
    historyStack = [];
    forwardStack = [];
    renderMainMenu();
});

btnPlay.addEventListener('click', () => {
    if (currentView === 'main-menu' || currentView === 'thoughts-menu') {
        selectedIndex = (selectedIndex + 1) % menuOptions.length;
        renderList(menuOptions);
    }
});

btnNext.addEventListener('click', goForward);
btnPrev.addEventListener('click', goBack);

btnSelect.addEventListener('click', () => {
    if (currentView === 'main-menu' || currentView === 'thoughts-menu') {
        selectOption(selectedIndex);
    }
});

// --- INICIO ---
renderMainMenu();