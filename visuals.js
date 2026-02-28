/**
 * visuals.js - Gráficos, Diagrama de Fases SVG académico, 3D y Simulador
 * v2: Diagrama de fases estilo libro de texto ingenieril (SVG puro)
 *     Cubo 3D con tamaño corregido en estado inicial
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. REFERENCIAS DOM ---
    const phaseDiagramEl = document.getElementById('phase-diagram');

    // --- 2. VARIABLES GLOBALES ---
    let proportionsChart = null;
    let enChart = null;
    let gammaWChart = null;

    // --- 3. COLORES ---
    const colors = {
        solid: '#c8a26b',
        water: '#4a9fd4',
        air: '#e8ecf0',
        extra: '#9ca3af',
        text: '#1e293b'
    };

    // =====================================================================
    // --- 4. THREE.JS (Cubo 3D) ---
    // =====================================================================
    const cubeContainer = document.getElementById('cube-3d');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    // Cámara más cercana para que no sobresalga
    const camera = new THREE.PerspectiveCamera(45, cubeContainer.clientWidth / cubeContainer.clientHeight, 0.1, 100);
    camera.position.set(1.8, 1.8, 2.5);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(cubeContainer.clientWidth, cubeContainer.clientHeight);
    cubeContainer.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(4, 6, 5);
    scene.add(dirLight);

    const soilGroup = new THREE.Group();
    scene.add(soilGroup);

    window.addEventListener('resize', () => {
        camera.aspect = cubeContainer.clientWidth / cubeContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(cubeContainer.clientWidth, cubeContainer.clientHeight);
    });

    let isDragging = false, prevMouse = { x: 0, y: 0 };
    cubeContainer.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('mousemove', e => {
        if (isDragging) {
            soilGroup.rotation.y += (e.offsetX - prevMouse.x) * 0.01;
            soilGroup.rotation.x += (e.offsetY - prevMouse.y) * 0.01;
        }
        prevMouse = { x: e.offsetX, y: e.offsetY };
    });

    function animate() {
        requestAnimationFrame(animate);
        if (!isDragging) soilGroup.rotation.y += 0.003;
        renderer.render(scene, camera);
    }
    animate();

    // =====================================================================
    // --- 5. DIAGRAMA DE FASES SVG ESTILO ACADÉMICO TÉCNICO ---
    // =====================================================================
    function updatePhaseDiagram(vars) {
        const container = phaseDiagramEl;
        container.innerHTML = '';

        // Dimensiones del SVG
        const svgW = 480;
        const svgH = 380;
        const rectX = 140;   // X inicio del rectángulo central
        const rectW = 120;   // Ancho del rectángulo
        const rectTop = 30;
        const rectH = 300;

        // Calcular proporciones
        const Vt = (vars.Vt && vars.Vt > 0) ? vars.Vt : 1;
        const Vs = vars.Vs !== null ? Math.max(0, vars.Vs) : null;
        const Vw = vars.Vw !== null ? Math.max(0, vars.Vw) : null;
        const Va = vars.Va !== null ? Math.max(0, vars.Va) : null;

        // Si no hay datos, mostrar placeholder dividido igualmente
        const hasData = Vs !== null || Vw !== null || Va !== null;
        let fracS, fracW, fracA;
        if (hasData) {
            const total = (Vs || 0) + (Vw || 0) + (Va || 0);
            fracS = total > 0 ? (Vs || 0) / total : 1 / 3;
            fracW = total > 0 ? (Vw || 0) / total : 1 / 3;
            fracA = total > 0 ? (Va || 0) / total : 1 / 3;
        } else {
            fracS = 0.4; fracW = 0.3; fracA = 0.3;
        }

        // Alturas en px dentro del rectángulo
        const hS = Math.round(fracS * rectH);
        const hW = Math.round(fracW * rectH);
        const hA = rectH - hS - hW;

        // Y posiciones (top = aire, medio = agua, bottom = sólidos)
        const yAir = rectTop;
        const yWater = rectTop + hA;
        const yTop = rectTop;             // top of rect
        const ySolids = rectTop + hA + hW;
        const yBottom = rectTop + rectH;     // bottom of rect

        // Pesos
        const Ws = vars.Ws !== null ? vars.Ws : null;
        const Ww = vars.Ww !== null ? vars.Ww : null;
        const Wt = vars.Wt !== null ? vars.Wt : null;

        // Razón de vacíos
        const e_val = vars.e !== null ? vars.e : null;
        const Vv_val = vars.Vv !== null ? vars.Vv : null;

        const fmt = (v, d = 2) => (v !== null && v !== undefined) ? v.toFixed(d) : '?';

        // -------- Construir SVG --------
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.style.fontFamily = "'Courier New', Courier, monospace";
        svg.style.fontSize = '11px';

        const S = (tag, attrs, text) => {
            const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            if (text !== undefined) el.textContent = text;
            return el;
        };

        // Función de flecha vertical (arriba ↓ o ↑, marcando rango)
        const arrowV = (x, y1, y2, label, anchor = 'end', offset = -8) => {
            const g = S('g', {});
            // Línea
            g.appendChild(S('line', { x1: x, y1: y1, x2: x, y2: y2, stroke: '#222', 'stroke-width': 1.2, 'marker-end': 'url(#arrowDown)', 'marker-start': 'url(#arrowUp)' }));
            // Tick superior
            g.appendChild(S('line', { x1: x - 4, y1: y1, x2: x + 4, y2: y1, stroke: '#222', 'stroke-width': 1 }));
            // Tick inferior
            g.appendChild(S('line', { x1: x - 4, y1: y2, x2: x + 4, y2: y2, stroke: '#222', 'stroke-width': 1 }));
            // Etiqueta en el centro
            const midY = (y1 + y2) / 2;
            const textEl = S('text', { x: x + offset, y: midY + 4, 'text-anchor': anchor, fill: '#222', 'font-size': '10', 'font-weight': 'bold' }, label);
            g.appendChild(textEl);
            return g;
        };

        // ---- Definiciones (marcadores de flecha) ----
        const defs = S('defs', {});
        const mkArrow = (id, refX, orient) => {
            const marker = S('marker', { id, markerWidth: 6, markerHeight: 6, refX, refY: 3, orient });
            marker.appendChild(S('path', { d: 'M0,0 L0,6 L6,3 z', fill: '#222' }));
            return marker;
        };
        defs.appendChild(mkArrow('arrowDown', 6, 'auto'));
        defs.appendChild(mkArrow('arrowUp', 0, 'auto-start-reverse'));
        svg.appendChild(defs);

        // ================================================================
        // A) RECTÁNGULO CENTRAL — las tres fases
        // ================================================================

        // AIRE (top)
        svg.appendChild(S('rect', {
            x: rectX, y: yAir, width: rectW, height: hA,
            fill: '#eef1f4', stroke: '#444', 'stroke-width': 1.5
        }));
        // Label AIRE
        if (hA > 15) {
            const ay = yAir + hA / 2;
            svg.appendChild(S('text', { x: rectX + rectW / 2, y: ay - 6, 'text-anchor': 'middle', fill: '#555', 'font-size': '10', 'font-style': 'italic' }, 'AIRE'));
            svg.appendChild(S('text', { x: rectX + rectW / 2, y: ay + 8, 'text-anchor': 'middle', fill: '#444', 'font-size': '10' }, `Va = ${fmt(vars.Va)} cm³`));
        }

        // AGUA
        svg.appendChild(S('rect', {
            x: rectX, y: yWater, width: rectW, height: hW,
            fill: '#bde0f5', stroke: '#444', 'stroke-width': 1.5
        }));
        if (hW > 15) {
            const wy = yWater + hW / 2;
            svg.appendChild(S('text', { x: rectX + rectW / 2, y: wy - 6, 'text-anchor': 'middle', fill: '#1a5e8c', 'font-size': '10', 'font-style': 'italic' }, 'AGUA'));
            svg.appendChild(S('text', { x: rectX + rectW / 2, y: wy + 8, 'text-anchor': 'middle', fill: '#1a5e8c', 'font-size': '10' }, `Vw = ${fmt(vars.Vw)} cm³`));
        }

        // SÓLIDOS
        svg.appendChild(S('rect', {
            x: rectX, y: ySolids, width: rectW, height: hS,
            fill: '#d4a96a', stroke: '#444', 'stroke-width': 1.5
        }));
        if (hS > 15) {
            const sy = ySolids + hS / 2;
            svg.appendChild(S('text', { x: rectX + rectW / 2, y: sy - 6, 'text-anchor': 'middle', fill: '#6b3a0f', 'font-size': '10', 'font-style': 'italic' }, 'SÓLIDOS'));
            svg.appendChild(S('text', { x: rectX + rectW / 2, y: sy + 8, 'text-anchor': 'middle', fill: '#6b3a0f', 'font-size': '10' }, `Vs = ${fmt(vars.Vs)} cm³`));
        }

        // ================================================================
        // B) PANEL IZQUIERDO — Volúmenes con flechas
        // ================================================================
        const xLeft = 115;   // posición de las flechas izquierdas

        // Flecha: Vt completo (toda la altura)
        const leftG = S('g', {});
        leftG.appendChild(S('line', { x1: xLeft, y1: yTop, x2: xLeft, y2: yBottom, stroke: '#333', 'stroke-width': 1.5 }));
        leftG.appendChild(S('line', { x1: xLeft - 5, y1: yTop, x2: xLeft + 5, y2: yTop, stroke: '#333', 'stroke-width': 1.2 }));
        leftG.appendChild(S('line', { x1: xLeft - 5, y1: yBottom, x2: xLeft + 5, y2: yBottom, stroke: '#333', 'stroke-width': 1.2 }));
        leftG.appendChild(S('text', { x: xLeft - 8, y: (yTop + yBottom) / 2 + 4, 'text-anchor': 'end', fill: '#222', 'font-size': '11', 'font-weight': 'bold' }, `V=${fmt(vars.Vt, 2)}`));
        svg.appendChild(leftG);

        // Sub-flecha: Vs (desde el fondo)
        const xLeft2 = 88;
        if (hS > 0) {
            const vsG = S('g', {});
            vsG.appendChild(S('line', { x1: xLeft2, y1: ySolids, x2: xLeft2, y2: yBottom, stroke: '#8a5a2a', 'stroke-width': 1.2 }));
            vsG.appendChild(S('line', { x1: xLeft2 - 4, y1: ySolids, x2: xLeft2 + 4, y2: ySolids, stroke: '#8a5a2a', 'stroke-width': 1 }));
            vsG.appendChild(S('line', { x1: xLeft2 - 4, y1: yBottom, x2: xLeft2 + 4, y2: yBottom, stroke: '#8a5a2a', 'stroke-width': 1 }));
            vsG.appendChild(S('text', { x: xLeft2 - 6, y: (ySolids + yBottom) / 2 + 4, 'text-anchor': 'end', fill: '#8a5a2a', 'font-size': '10' }, `Vs`));
            svg.appendChild(vsG);
        }

        // Sub-flecha: Vv (parte de vacíos = Va + Vw, desde tope hasta nivel de sólido)
        const xLeft3 = 66;
        if (hA + hW > 0) {
            const vvG = S('g', {});
            vvG.appendChild(S('line', { x1: xLeft3, y1: yTop, x2: xLeft3, y2: ySolids, stroke: '#555', 'stroke-width': 1.2 }));
            vvG.appendChild(S('line', { x1: xLeft3 - 4, y1: yTop, x2: xLeft3 + 4, y2: yTop, stroke: '#555', 'stroke-width': 1 }));
            vvG.appendChild(S('line', { x1: xLeft3 - 4, y1: ySolids, x2: xLeft3 + 4, y2: ySolids, stroke: '#555', 'stroke-width': 1 }));
            vvG.appendChild(S('text', { x: xLeft3 - 6, y: (yTop + ySolids) / 2 + 4, 'text-anchor': 'end', fill: '#555', 'font-size': '10' }, `Vv`));
            svg.appendChild(vvG);
            // Nota Vv = Va + Vw
            svg.appendChild(S('text', { x: 6, y: (yTop + ySolids) / 2 + 15, 'text-anchor': 'start', fill: '#555', 'font-size': '9' }, 'Vv = Va + Vw'));
        }

        // Cuadro resaltado e = Vv/Vs
        const eBoxX = 4, eBoxY = yBottom + 8;
        svg.appendChild(S('rect', { x: eBoxX, y: eBoxY, width: 130, height: 28, rx: 3, fill: '#fffde7', stroke: '#f59e0b', 'stroke-width': 1.2 }));
        svg.appendChild(S('text', { x: eBoxX + 65, y: eBoxY + 11, 'text-anchor': 'middle', fill: '#92400e', 'font-size': '9', 'font-weight': 'bold' }, 'Relación de Vacíos:'));
        svg.appendChild(S('text', { x: eBoxX + 65, y: eBoxY + 23, 'text-anchor': 'middle', fill: '#92400e', 'font-size': '10', 'font-weight': 'bold' }, `e = Vv/Vs = ${fmt(e_val, 4)}`));

        // ================================================================
        // C) PANEL DERECHO — Pesos con flechas
        // ================================================================
        const xRight = rectX + rectW + 30;

        // Flecha total W (desde fondo hasta nivel de agua — sólidos + agua, no aire pesa)
        const yWeightTop = ySolids - hW;   // Tope donde comienza agua
        const yWeightBottom = yBottom;

        // Ws (sólidos)
        const wsG = S('g', {});
        wsG.appendChild(S('line', { x1: xRight, y1: ySolids, x2: xRight, y2: yBottom, stroke: '#8a5a2a', 'stroke-width': 1.5 }));
        wsG.appendChild(S('line', { x1: xRight - 4, y1: ySolids, x2: xRight + 4, y2: ySolids, stroke: '#8a5a2a', 'stroke-width': 1 }));
        wsG.appendChild(S('line', { x1: xRight - 4, y1: yBottom, x2: xRight + 4, y2: yBottom, stroke: '#8a5a2a', 'stroke-width': 1 }));
        wsG.appendChild(S('text', { x: xRight + 8, y: (ySolids + yBottom) / 2 + 4, fill: '#8a5a2a', 'font-size': '10' }, `Ws = ${fmt(vars.Ws)} g`));
        svg.appendChild(wsG);

        // Ww (agua)
        if (hW > 0) {
            const wwG = S('g', {});
            wwG.appendChild(S('line', { x1: xRight, y1: yWater, x2: xRight, y2: ySolids, stroke: '#1a5e8c', 'stroke-width': 1.5 }));
            wwG.appendChild(S('line', { x1: xRight - 4, y1: yWater, x2: xRight + 4, y2: yWater, stroke: '#1a5e8c', 'stroke-width': 1 }));
            wwG.appendChild(S('line', { x1: xRight - 4, y1: ySolids, x2: xRight + 4, y2: ySolids, stroke: '#1a5e8c', 'stroke-width': 1 }));
            wwG.appendChild(S('text', { x: xRight + 8, y: (yWater + ySolids) / 2 + 4, fill: '#1a5e8c', 'font-size': '10' }, `Ww = ${fmt(vars.Ww)} g`));
            svg.appendChild(wwG);
        }

        // Wt total (flecha exterior grande)
        const xRight2 = xRight + 70;
        const yWtTop = hW > 0 ? yWater : ySolids;
        const wtG = S('g', {});
        wtG.appendChild(S('line', { x1: xRight2, y1: yWtTop, x2: xRight2, y2: yBottom, stroke: '#222', 'stroke-width': 1.5 }));
        wtG.appendChild(S('line', { x1: xRight2 - 5, y1: yWtTop, x2: xRight2 + 5, y2: yWtTop, stroke: '#222', 'stroke-width': 1.2 }));
        wtG.appendChild(S('line', { x1: xRight2 - 5, y1: yBottom, x2: xRight2 + 5, y2: yBottom, stroke: '#222', 'stroke-width': 1.2 }));
        wtG.appendChild(S('text', { x: xRight2 + 6, y: (yWtTop + yBottom) / 2 + 4, fill: '#222', 'font-size': '10', 'font-weight': 'bold' }, `W=${fmt(vars.Wt, 2)} g`));
        svg.appendChild(wtG);

        // Ecuación W = Ws + Ww
        const eqBoxX = rectX + rectW + 20, eqBoxY = yBottom + 8;
        svg.appendChild(S('rect', { x: eqBoxX, y: eqBoxY, width: 160, height: 28, rx: 3, fill: '#f0f9ff', stroke: '#38bdf8', 'stroke-width': 1.2 }));
        svg.appendChild(S('text', { x: eqBoxX + 80, y: eqBoxY + 11, 'text-anchor': 'middle', fill: '#0369a1', 'font-size': '9', 'font-weight': 'bold' }, 'Peso Total:'));
        svg.appendChild(S('text', { x: eqBoxX + 80, y: eqBoxY + 23, 'text-anchor': 'middle', fill: '#0369a1', 'font-size': '10', 'font-weight': 'bold' }, `W = Ws + Ww = ${fmt(vars.Wt, 2)} g`));

        // Etiquetas de eje: VOLUMEN / PESO
        svg.appendChild(S('text', { x: rectX - 2, y: yBottom + 50, 'text-anchor': 'end', fill: '#666', 'font-size': '9', 'font-style': 'italic' }, '← VOLÚMENES'));
        svg.appendChild(S('text', { x: rectX + rectW + 2, y: yBottom + 50, fill: '#666', 'font-size': '9', 'font-style': 'italic' }, 'PESOS →'));

        container.appendChild(svg);
    }

    // =====================================================================
    // --- 6. CUBO 3D ---
    // =====================================================================
    function updateCube3D(vars) {
        while (soilGroup.children.length > 0) soilGroup.remove(soilGroup.children[0]);

        const Vt = vars.Vt && vars.Vt > 0 ? vars.Vt : 1;
        let sFrac = vars.Vs !== null ? Math.max(0, vars.Vs / Vt) : 0.40;
        let wFrac = vars.Vw !== null ? Math.max(0, vars.Vw / Vt) : 0.30;
        let aFrac = vars.Va !== null ? Math.max(0, vars.Va / Vt) : 0.30;

        const total = sFrac + wFrac + aFrac;
        if (total > 0) { sFrac /= total; wFrac /= total; aFrac /= total; }

        const size = 1.0;

        const drawBox = (frac, hexColor, prevY, opacity = 1) => {
            if (frac <= 0.005) return prevY;
            const h = size * frac;
            const geo = new THREE.BoxGeometry(size, h, size);
            const mat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(hexColor),
                transparent: opacity < 1,
                opacity
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = prevY + h / 2;
            const edges = new THREE.EdgesGeometry(geo);
            mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333, opacity: 0.3, transparent: true })));
            soilGroup.add(mesh);
            return prevY + h;
        };

        const startY = -size / 2;
        let pY = drawBox(sFrac, '#c8a26b', startY);
        pY = drawBox(wFrac, '#4a9fd4', pY, 0.8);
        drawBox(aFrac, '#dde5ee', pY, 0.4);

        soilGroup.position.y = -0.1;
    }

    // =====================================================================
    // --- 7. GRÁFICO PROPORCIONES (PIE) ---
    // =====================================================================
    function updateProportionsChart(vars) {
        const ctx = document.getElementById('proportions-chart').getContext('2d');
        const dataValues = [
            Math.max(0, vars.Vs || 0),
            Math.max(0, vars.Vw || 0),
            Math.max(0, vars.Va || 0),
            Math.max(0, vars.Vc || 0)
        ];
        if (proportionsChart) {
            proportionsChart.data.datasets[0].data = dataValues;
            proportionsChart.update();
        } else {
            proportionsChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Sólidos (Vs)', 'Agua (Vw)', 'Aire (Va)', 'Capa Extra (Vc)'],
                    datasets: [{ data: dataValues, backgroundColor: [colors.solid, colors.water, colors.air, colors.extra], borderWidth: 1 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { font: { family: 'Inter' } } } }
                }
            });
        }
    }

    // =====================================================================
    // --- 8. GRÁFICO e vs n ---
    // =====================================================================
    function updateENChart(vars) {
        const ctx = document.getElementById('e-n-chart').getContext('2d');
        const curveData = [];
        for (let e = 0; e <= 2; e += 0.1) curveData.push({ x: e, y: e / (1 + e) });
        const currentData = (vars.e !== null && vars.n !== null) ? [{ x: vars.e, y: vars.n }] : [];

        if (enChart) {
            enChart.data.datasets[1].data = currentData;
            enChart.update();
        } else {
            enChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Teoría: n = e/(1+e)', data: curveData, borderColor: colors.text, borderWidth: 2, showLine: true, pointRadius: 0, tension: 0.4 },
                        { label: 'Estado Actual', data: currentData, backgroundColor: colors.water, borderColor: '#0369a1', pointRadius: 6 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Relación de Vacíos (e)' } },
                        y: { title: { display: true, text: 'Porosidad (n)' }, min: 0, max: 1 }
                    }
                }
            });
        }
    }

    // =====================================================================
    // --- 9. GRÁFICO γ vs w ---
    // =====================================================================
    function updateGammaWChart(vars) {
        const ctx = document.getElementById('gamma-w-chart').getContext('2d');
        let curveData = [];
        if (vars.Gs !== null && vars.e !== null) {
            for (let w = 0; w <= 0.6; w += 0.05)
                curveData.push({ x: w, y: (1 + w) * vars.Gs / (1 + vars.e) });
        }
        const currentData = (vars.w !== null && vars.rt !== null) ? [{ x: vars.w, y: vars.rt }] : [];

        if (gammaWChart) {
            gammaWChart.data.datasets[0].data = curveData;
            gammaWChart.data.datasets[1].data = currentData;
            gammaWChart.update();
        } else {
            gammaWChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Curva Teórica', data: curveData, borderColor: colors.solid, showLine: true, pointRadius: 0 },
                        { label: 'Estado Actual', data: currentData, backgroundColor: '#ef4444', pointRadius: 6 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Humedad w (Adim)' } },
                        y: { title: { display: true, text: 'Densidad Total γt (g/cm³)' } }
                    }
                }
            });
        }
    }

    // =====================================================================
    // --- 10. EVENTOS ---
    // =====================================================================
    document.addEventListener('soilDataUpdated', (ev) => {
        const vars = ev.detail.vars;
        updatePhaseDiagram(vars);
        updateProportionsChart(vars);
        updateCube3D(vars);
        updateENChart(vars);
        updateGammaWChart(vars);
    });

    document.addEventListener('soilDataReset', () => {
        // Mostrar diagrama vacío
        updatePhaseDiagram({});
        updateCube3D({});
        if (proportionsChart) { proportionsChart.data.datasets[0].data = [0, 0, 0, 0]; proportionsChart.update(); }
        if (enChart) { enChart.data.datasets[1].data = []; enChart.update(); }
        if (gammaWChart) { gammaWChart.data.datasets[0].data = []; gammaWChart.data.datasets[1].data = []; gammaWChart.update(); }
    });

    // Estado inicial
    updatePhaseDiagram({});
    updateCube3D({});

});
