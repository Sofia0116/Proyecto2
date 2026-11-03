document.addEventListener('DOMContentLoaded', () => {
    if (!window.db) {
        alert("Firebase no ha cargado. Revisa tu conexión a internet.");
        return;
    }

    const db = window.db;
    const TIEMPO_EXPIRACION = 6 * 60 * 60 * 1000;
    const TAMANO_MUNDO = 5000;

    let iconoBase64 = null;
    let imagenBase64 = null;
    let docIdActual = null;
    let recuerdoActualData = null;

    let idDispositivo = localStorage.getItem('idDispositivo');
    if (!idDispositivo) {
        idDispositivo = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem('idDispositivo', idDispositivo);
    }

    // ==========================================
    // NOTIFICACIONES
    // ==========================================
    const contenedorNotif = document.getElementById('contenedor-notificaciones');
    function notificar(mensaje, titulo = '✦ Aviso ✦', duracion = 4000) {
        if (!contenedorNotif) return;
        const notif = document.createElement('div');
        notif.className = 'notificacion';
        notif.innerHTML = `
            <button class="notificacion-cerrar" aria-label="Cerrar">&times;</button>
            <div class="notificacion-titulo">${titulo}</div>
            <div class="notificacion-texto">${mensaje}</div>
        `;
        contenedorNotif.appendChild(notif);
        const cerrar = () => { notif.classList.add('cerrando'); setTimeout(() => notif.remove(), 300); };
        notif.querySelector('.notificacion-cerrar').addEventListener('click', cerrar);
        if (duracion > 0) setTimeout(cerrar, duracion);
    }

    function confirmarAccion(mensaje, alAceptar) {
        if (!contenedorNotif) return;
        const notif = document.createElement('div');
        notif.className = 'notificacion';
        notif.style.maxWidth = '380px'; 
        notif.innerHTML = `
            <div class="notificacion-titulo">✦ Confirmación ✦</div>
            <div class="notificacion-texto" style="margin-bottom: 12px;">${mensaje}</div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-retro btn-pequeno btn-cancelar">Cancelar</button>
                <button class="btn-retro btn-pequeno btn-aceptar" style="background: #FFA3BE; color: white; border-color: #A57352;">Aceptar</button>
            </div>
        `;
        contenedorNotif.appendChild(notif);
        const cerrar = () => { notif.classList.add('cerrando'); setTimeout(() => notif.remove(), 300); };
        notif.querySelector('.btn-cancelar').addEventListener('click', cerrar);
        notif.querySelector('.btn-aceptar').addEventListener('click', () => { cerrar(); alAceptar(); });
    }

    // ==========================================
    // COMPRESIÓN DE IMÁGENES
    // ==========================================
    function comprimirImagen(file, maxWidth, maxHeight, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } } 
                else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
    }

            // ==========================================
        // COMPRESIÓN ESPECIAL PARA PNG (Conserva transparencia)
        // ==========================================
        function comprimirIcono(file, maxSize, callback) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width, height = img.height;
                    if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
                    else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // Usamos PNG para conservar la transparencia (fondo de nube)
                    callback(canvas.toDataURL('image/png'));
                };
            };
        }

    // ==========================================
    // CANVAS NAVEGABLE
    // ==========================================
    const board = document.getElementById('oceanoBoard');
    const world = document.getElementById('oceanoWorld');
    let isDragging = false, startX = 0, startY = 0, currentX = 0, currentY = 0, scale = 0.5;
    let mouseMoved = false;

    function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

    function updateWorldTransform(withTransition = false) {
        if (!board || !world) return;
        const boardW = board.clientWidth || 800, boardH = board.clientHeight || 600;
        const maxX = Math.max(0, (TAMANO_MUNDO * scale - boardW) / 2);
        const maxY = Math.max(0, (TAMANO_MUNDO * scale - boardH) / 2);
        currentX = clamp(currentX, -maxX, maxX); currentY = clamp(currentY, -maxY, maxY);
        world.style.transition = withTransition ? 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
        world.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px)) scale(${scale})`;
    }

    if (board) {
        board.addEventListener('mousedown', (e) => {
            if (e.target.closest('.oceano-controls') || e.target.closest('.btn-subir-flotante')) return;
            isDragging = true; mouseMoved = false; startX = e.clientX - currentX; startY = e.clientY - currentY; world.style.transition = 'none';
        });
        board.addEventListener('touchstart', (e) => {
            if (e.target.closest('.oceano-controls') || e.target.closest('.btn-subir-flotante')) return;
            isDragging = true; mouseMoved = false; startX = e.touches[0].clientX - currentX; startY = e.touches[0].clientY - currentY; world.style.transition = 'none';
        }, { passive: true });
        board.addEventListener('wheel', (e) => {
            e.preventDefault(); if (e.deltaY < 0 && scale < 2) scale += 0.08; else if (e.deltaY > 0 && scale > 0.2) scale -= 0.08; updateWorldTransform(false);
        }, { passive: false });
    }

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX - startX; currentY = e.clientY - startY;
        if (Math.abs(currentX) > 5 || Math.abs(currentY) > 5) mouseMoved = true;
        updateWorldTransform(false);
    });
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX - startX; currentY = e.touches[0].clientY - startY;
        mouseMoved = true; updateWorldTransform(false);
    }, { passive: true });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('touchend', () => { isDragging = false; });

    // ==========================================
    // RENDERIZAR DESDE FIREBASE
    // ==========================================
    document.getElementById('zoomInBtn')?.addEventListener('click', () => { if (scale < 2) { scale += 0.2; updateWorldTransform(true); } });
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => { if (scale > 0.2) { scale -= 0.2; updateWorldTransform(true); } });
    document.getElementById('resetBtn')?.addEventListener('click', () => { currentX = 0; currentY = 0; scale = 0.5; updateWorldTransform(true); });
    
    document.getElementById('randomBtn')?.addEventListener('click', () => {
        const iconos = world.querySelectorAll('.icono-flotante');
        if (iconos.length === 0) return notificar('Todavía no hay recuerdos en el océano.', '✦ Vacío ✦');
        const target = iconos[Math.floor(Math.random() * iconos.length)];
        const top = parseFloat(target.style.top), left = parseFloat(target.style.left);
        currentX = -(left - TAMANO_MUNDO / 2) * 0.9; currentY = -(top - TAMANO_MUNDO / 2) * 0.9; scale = 0.9;
        updateWorldTransform(true); target.classList.add('destacado'); setTimeout(() => target.classList.remove('destacado'), 2000);
    });

    async function limpiarExpirados() {
        try {
            const snapshot = await db.collection("recuerdos").where("fechaExpiracion", "<", Date.now()).get();
            snapshot.forEach(async (documento) => { await db.collection("recuerdos").doc(documento.id).delete(); });
        } catch(e) { console.log("Error limpiando:", e); }
    }

            function iniciarOceano() {
            limpiarExpirados();
            
            db.collection("recuerdos").where("fechaExpiracion", ">", Date.now())
              .onSnapshot((snapshot) => {
                world.innerHTML = '';
                snapshot.forEach((docSnap) => {
                    const foto = docSnap.data();
                    const docId = docSnap.id;
                    
                    const div = document.createElement('div');
                    div.className = 'icono-flotante';
                    div.style.left = `${foto.posX}px`; div.style.top = `${foto.posY}px`;
                    div.style.animationDelay = `${Math.random() * 5}s`;
                    
                    const img = document.createElement('img');
                    // Ahora leemos el icono desde Firebase (foto.iconoUrl) o del localStorage
                    img.src = foto.iconoUrl || localStorage.getItem(`foto_${docId}`); 
                    img.alt = 'Recuerdo Oculto';
                    
                    div.addEventListener('click', (e) => { e.stopPropagation(); if (!mouseMoved) abrirModal(docId, foto); });
                    div.appendChild(img); world.appendChild(div);
                });
            }, (error) => {
                console.error("Error al leer:", error);
            });
            updateWorldTransform(false);
        }

    // ==========================================
    // FLUJO DE SUBIDA
    // ==========================================
    const modalSubida = document.getElementById('modal-subida');
    const paso1 = document.getElementById('paso-1'), paso2 = document.getElementById('paso-2'), pasoFinal = document.getElementById('paso-final');
    const btnElegirIcono = document.getElementById('btn-elegir-icono'), btnElegirImagen = document.getElementById('btn-elegir-imagen'), btnLanzar = document.getElementById('btn-lanzar');
    const inputIcono = document.getElementById('input-icono'), inputImagen = document.getElementById('input-imagen');
    const previewIcono = document.getElementById('preview-icono'), previewImagen = document.getElementById('preview-imagen');

    document.getElementById('btn-subir-recuerdo')?.addEventListener('click', () => {
        modalSubida.classList.remove('oculto'); paso1.classList.remove('oculto'); paso2.classList.add('oculto'); pasoFinal.classList.add('oculto');
        previewIcono.innerHTML = ''; previewImagen.innerHTML = ''; iconoBase64 = null; imagenBase64 = null;
    });
    document.getElementById('btn-cancelar-subida')?.addEventListener('click', () => modalSubida.classList.add('oculto'));

            if (btnElegirIcono) {
            btnElegirIcono.addEventListener('click', () => inputIcono.click());
            inputIcono.addEventListener('change', (e) => {
                const archivo = e.target.files[0];
                if (!archivo || archivo.type !== 'image/png') return notificar('Selecciona un archivo .PNG', '✦ Formato inválido ✦');
                
                // Usamos la nueva función comprimirIcono
                comprimirIcono(archivo, 150, (base64) => {
                    iconoBase64 = base64;
                    previewIcono.innerHTML = `<img src="${iconoBase64}">`;
                    paso1.classList.add('oculto'); paso2.classList.remove('oculto');
                });
                inputIcono.value = '';
            });
        }

    if (btnElegirImagen) {
        btnElegirImagen.addEventListener('click', () => inputImagen.click());
        inputImagen.addEventListener('change', (e) => {
            const archivo = e.target.files[0]; if (!archivo) return;
            comprimirImagen(archivo, 800, 800, (base64) => {
                imagenBase64 = base64; previewImagen.innerHTML = `<img src="${imagenBase64}">`;
                paso2.classList.add('oculto'); pasoFinal.classList.remove('oculto');
            });
            inputImagen.value = '';
        });
    }

           if (btnLanzar) {
            btnLanzar.addEventListener('click', async () => {
                if (!iconoBase64 || !imagenBase64) return notificar('Faltan datos.', '✦ Error ✦');
                btnLanzar.textContent = "Lanzando..."; btnLanzar.disabled = true;

                try {
                    // Guardamos el icono directamente en Firebase
                    const docRef = await db.collection("recuerdos").add({
                        iconoUrl: iconoBase64,
                        fechaExpiracion: Date.now() + TIEMPO_EXPIRACION,
                        posX: (TAMANO_MUNDO / 2) + (Math.random() * 1800 - 900),
                        posY: (TAMANO_MUNDO / 2) + (Math.random() * 1800 - 900),
                        creadorId: idDispositivo,
                        comentarios: []
                    });

                    // Guardamos la foto grande en el localStorage (para que no ocupe espacio en Firebase)
                    localStorage.setItem(`foto_${docRef.id}`, imagenBase64);

                    modalSubida.classList.add('oculto');
                    currentX = 0; currentY = 0; scale = 0.5; updateWorldTransform(true);
                    notificar('¡Recuerdo lanzado al océano!', '✦ Lanzado ✦', 5000);
                } catch (error) {
                    console.error("Error al subir:", error);
                    notificar('Error de conexión con Firebase.', '✦ Error ✦', 6000); 
                } finally {
                    btnLanzar.textContent = "[ Lanzar al Océano ]"; btnLanzar.disabled = false;
                }
            });
        }

    // ==========================================
    // MODAL Y COMENTARIOS
    // ==========================================
    const modalFoto = document.getElementById('modal-foto');
    const imgGrande = document.getElementById('img-grande');
    const tarjetaFoto = document.getElementById('tarjeta-foto');
    const modalContenido = document.getElementById('modal-contenido-tarjeta');
    const listaComentarios = document.getElementById('lista-comentarios');
    const nuevoComentario = document.getElementById('nuevo-comentario');

    function abrirModal(docId, foto) {
        docIdActual = docId; recuerdoActualData = foto;
        imgGrande.src = localStorage.getItem(`foto_${docId}`) || '';

        tarjetaFoto.style.width = '380px'; tarjetaFoto.style.height = '380px';
        modalContenido.style.width = '380px'; modalContenido.style.height = '380px';

        imgGrande.onload = () => {
            const ancho = imgGrande.naturalWidth, alto = imgGrande.naturalHeight;
            const maxAncho = window.innerWidth * 0.8, maxAlto = window.innerHeight * 0.8;
            let esc = 1;
            if (ancho > maxAncho || alto > maxAlto) esc = Math.min(maxAncho / ancho, maxAlto / alto);
            const anchoFinal = Math.max(ancho * esc, 380), altoFinal = Math.max(alto * esc, 380);
            modalContenido.style.width = `${anchoFinal}px`; modalContenido.style.height = `${altoFinal}px`;
            tarjetaFoto.style.width = `${anchoFinal}px`; tarjetaFoto.style.height = `${altoFinal}px`;
        };

        modalFoto.classList.remove('oculto'); tarjetaFoto.classList.remove('volteada');
        cargarComentarios(foto.comentarios || []);
    }

    document.getElementById('cerrar-modal')?.addEventListener('click', () => modalFoto.classList.add('oculto'));

    if (tarjetaFoto) {
        tarjetaFoto.addEventListener('dblclick', (e) => {
            if (e.target.closest('textarea') || e.target.closest('button')) return;
            tarjetaFoto.classList.toggle('volteada');
        });
    }

    function cargarComentarios(comentarios) {
        if (!listaComentarios) return; listaComentarios.innerHTML = '';
        if (comentarios.length === 0) {
            listaComentarios.innerHTML = '<div style="font-style: italic; opacity: 0.5; font-size: 0.85rem; padding: 5px 0;">Aún no hay notas...</div>'; return;
        }
        
        comentarios.forEach((com, index) => {
            const item = document.createElement('div'); item.className = 'comentario-item';
            const span = document.createElement('span'); span.className = 'comentario-texto'; span.textContent = com.texto;
            const acciones = document.createElement('div'); acciones.className = 'comentario-acciones';

            if (com.creadorId === idDispositivo) {
                const btnEditar = document.createElement('button'); btnEditar.className = 'btn-accion-comentario'; btnEditar.innerHTML = '✎';
                btnEditar.addEventListener('click', () => editarComentario(item, com.texto, index));
                const btnEliminar = document.createElement('button'); btnEliminar.className = 'btn-accion-comentario'; btnEliminar.innerHTML = '🗑';
                btnEliminar.addEventListener('click', () => eliminarComentario(index));
                acciones.appendChild(btnEditar); acciones.appendChild(btnEliminar);
            }

            item.appendChild(span); item.appendChild(acciones); listaComentarios.appendChild(item);
        });
    }

    function editarComentario(item, textoViejo, index) {
        item.innerHTML = '';
        const contenedor = document.createElement('div'); contenedor.className = 'comentario-editando';
        const textarea = document.createElement('textarea'); textarea.value = textoViejo;
        const botones = document.createElement('div'); botones.className = 'comentario-editando-botones';

        const btnGuardar = document.createElement('button'); btnGuardar.textContent = 'Guardar';
        btnGuardar.addEventListener('click', async () => {
            const nuevo = textarea.value.trim();
            if (!nuevo) return notificar('No puede estar vacía.', '✦ Nota vacía ✦');
            const nuevosComentarios = [...recuerdoActualData.comentarios];
            nuevosComentarios[index].texto = nuevo;
            await db.collection("recuerdos").doc(docIdActual).update({ comentarios: nuevosComentarios });
            recuerdoActualData.comentarios = nuevosComentarios; cargarComentarios(nuevosComentarios);
            notificar('Nota actualizada.', '✦ Editada ✦', 2500);
        });

        const btnCancelar = document.createElement('button'); btnCancelar.textContent = 'Cancelar';
        btnCancelar.addEventListener('click', () => cargarComentarios(recuerdoActualData.comentarios || []));

        botones.appendChild(btnGuardar); botones.appendChild(btnCancelar);
        contenedor.appendChild(textarea); contenedor.appendChild(botones); item.appendChild(contenedor);
        textarea.focus(); textarea.select();
    }

    function eliminarComentario(index) {
        confirmarAccion('¿Seguro que quieres eliminar esta nota?', async () => {
            const nuevosComentarios = [...recuerdoActualData.comentarios];
            nuevosComentarios.splice(index, 1);
            await db.collection("recuerdos").doc(docIdActual).update({ comentarios: nuevosComentarios });
            recuerdoActualData.comentarios = nuevosComentarios; cargarComentarios(nuevosComentarios);
            notificar('Nota eliminada.', '✦ Eliminada ✦', 2500);
        });
    }

    document.getElementById('btn-guardar-comentario')?.addEventListener('click', async () => {
        const texto = nuevoComentario.value.trim(); if (!texto) return;
        const nuevoComentarioObj = { texto: texto, creadorId: idDispositivo };
        const nuevosComentarios = [...(recuerdoActualData.comentarios || []), nuevoComentarioObj];
        await db.collection("recuerdos").doc(docIdActual).update({ comentarios: nuevosComentarios });
        recuerdoActualData.comentarios = nuevosComentarios;
        nuevoComentario.value = ''; cargarComentarios(nuevosComentarios);
        notificar('Nota añadida.', '✦ Guardada ✦', 2000);
    });

    // INICIO
    iniciarOceano();
});