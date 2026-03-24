/**
 * visuals.js - Gráficos, Diagrama de Fases SVG, 3D (Three.js)
 * v4: Capa Extra = fase independiente fuera del diagrama de 3 fases.
 *     Diagrama muestra: [CAPA EXTRA | AIRE | AGUA | SÓLIDOS] como secciones separadas.
 *     Unidades dinámicas pasadas desde app.js vía custom event.
 */

document.addEventListener('DOMContentLoaded', () => {

    const phaseDiagramEl = document.getElementById('phase-diagram');

    let proportionsChart = null;
    let enChart          = null;
    let gammaWChart      = null;

    // Unidad activa (recibida del evento)
    let currentUnit = { label: 'g/cm³', labelW: 'g', labelV: 'cm³' };

    const colors = {
        solid : '#c8a26b',
        water : '#4a9fd4',
        air   : '#e8ecf0',
        extra : '#a78bfa',  // violeta para diferenciar la capa extra
        text  : '#1e293b'
    };

    // ====================================================================
    // THREE.JS — Cubo 3D
    // ====================================================================
    const cubeContainer = document.getElementById('cube-3d');
    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45,
        cubeContainer.clientWidth / cubeContainer.clientHeight, 0.1, 100);
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
    document.addEventListener('mouseup',   () => isDragging = false);
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

    // ====================================================================
    // DIAGRAMA DE FASES SVG — 4 fases independientes
    // ====================================================================
    function updatePhaseDiagram(vars, soilType) {
        const container = phaseDiagramEl;
        container.innerHTML = '';

        const hasExtraLayer = (soilType === 'extra_layer') &&
                              ((vars.Vc !== null && vars.Vc > 0) || (vars.Wc !== null && vars.Wc > 0));

        const svgW   = 500;
        const svgH   = hasExtraLayer ? 450 : 380;
        const rectX  = 150;
        const rectW  = 120;

        // Zona del suelo: 3 fases internas
        const soilTop    = hasExtraLayer ? 80  : 30;
        const soilH      = 270; // altura fija para las 3 fases del suelo

        // Zona de la capa extra (sobre el diagrama del suelo si aplica)
        const extraH     = hasExtraLayer ? 50 : 0;
        const extraTop   = hasExtraLayer ? 20 : 0;

        // Calcular proporciones SOLO para las 3 fases del suelo
        const Vs = vars.Vs !== null ? Math.max(0, vars.Vs) : null;
        const Vw = vars.Vw !== null ? Math.max(0, vars.Vw) : null;
        const Va = vars.Va !== null ? Math.max(0, vars.Va) : null;
        const Vc = vars.Vc !== null ? Math.max(0, vars.Vc) : 0;

        const hasData = Vs !== null || Vw !== null || Va !== null;
        let fracS, fracW, fracA;
        if (hasData) {
            const total = (Vs || 0) + (Vw || 0) + (Va || 0);
            fracS = total > 0 ? (Vs || 0) / total : 1/3;
            fracW = total > 0 ? (Vw || 0) / total : 1/3;
            fracA = total > 0 ? (Va || 0) / total : 1/3;
        } else {
            fracS = 0.40; fracW = 0.30; fracA = 0.30;
        }

        const hS  = Math.round(fracS * soilH);
        const hW  = Math.round(fracW * soilH);
        const hA  = soilH - hS - hW;

        const yAir     = soilTop;
        const yWater   = soilTop + hA;
        const ySolids  = soilTop + hA + hW;
        const yBottom  = soilTop + soilH;

        const fmt = (v, d = 2) => (v !== null && v !== undefined) ? v.toFixed(d) : '?';
        const u   = currentUnit;

        // ---- Construir SVG ----
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width',   '100%');
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.style.fontFamily = "'Courier New', Courier, monospace";
        svg.style.fontSize = '11px';

        const S = (tag, attrs, text) => {
            const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            if (text !== undefined) el.textContent = text;
            return el;
        };

        // Marcadores de flecha
        const defs = S('defs', {});
        ['arrowDown', 'arrowUp'].forEach((id, i) => {
            const marker = S('marker', { id, markerWidth: 6, markerHeight: 6,
                refX: i === 0 ? 6 : 0, refY: 3,
                orient: i === 0 ? 'auto' : 'auto-start-reverse' });
            marker.appendChild(S('path', { d: 'M0,0 L0,6 L6,3 z', fill: '#333' }));
            defs.appendChild(marker);
        });
        svg.appendChild(defs);

        // ================================================================
        // A) CAPA EXTRA — bloque independiente encima del suelo
        // ================================================================
        if (hasExtraLayer) {
            // Rectángulo con fondo violeta claro
            svg.appendChild(S('rect', {
                x: rectX, y: extraTop, width: rectW, height: extraH,
                fill: '#ede9fe', stroke: '#7c3aed', 'stroke-width': 2,
                rx: 3
            }));
            // Texto dentro
            const eyC = extraTop + extraH / 2;
            svg.appendChild(S('text', {
                x: rectX + rectW / 2, y: eyC - 6,
                'text-anchor': 'middle', fill: '#5b21b6',
                'font-size': '10', 'font-style': 'italic', 'font-weight': 'bold'
            }, 'CAPA EXTRA'));
            svg.appendChild(S('text', {
                x: rectX + rectW / 2, y: eyC + 8,
                'text-anchor': 'middle', fill: '#5b21b6', 'font-size': '10'
            }, `Vc = ${fmt(Vc)} ${u.labelV}`));

            // Etiqueta de peso de capa extra (panel derecho)
            const xRightE = rectX + rectW + 25;
            svg.appendChild(S('line', {
                x1: xRightE, y1: extraTop, x2: xRightE, y2: extraTop + extraH,
                stroke: '#7c3aed', 'stroke-width': 1.5
            }));
            svg.appendChild(S('line', { x1: xRightE - 4, y1: extraTop, x2: xRightE + 4, y2: extraTop,
                stroke: '#7c3aed', 'stroke-width': 1 }));
            svg.appendChild(S('line', { x1: xRightE - 4, y1: extraTop + extraH, x2: xRightE + 4,
                y2: extraTop + extraH, stroke: '#7c3aed', 'stroke-width': 1 }));
            svg.appendChild(S('text', {
                x: xRightE + 8, y: extraTop + extraH / 2 + 4,
                fill: '#5b21b6', 'font-size': '10'
            }, `Wc = ${fmt(vars.Wc)} ${u.labelW}`));

            // Línea separadora entre capa extra y suelo
            svg.appendChild(S('line', {
                x1: rectX - 10, y1: soilTop, x2: rectX + rectW + 10, y2: soilTop,
                stroke: '#7c3aed', 'stroke-width': 1.5, 'stroke-dasharray': '5,3'
            }));
            // Nota
            svg.appendChild(S('text', {
                x: rectX - 12, y: soilTop - 4, 'text-anchor': 'end',
                fill: '#7c3aed', 'font-size': '9', 'font-style': 'italic'
            }, '← Fase externa'));
        }

        // ================================================================
        // B) Las 3 FASES DEL SUELO
        // ================================================================

        // AIRE
        svg.appendChild(S('rect', {
            x: rectX, y: yAir, width: rectW, height: hA,
            fill: '#eef1f4', stroke: '#444', 'stroke-width': 1.5
        }));
        if (hA > 15) {
            const ay = yAir + hA / 2;
            svg.appendChild(S('text', { x: rectX + rectW/2, y: ay - 6,
                'text-anchor': 'middle', fill: '#555', 'font-size': '10', 'font-style': 'italic' }, 'AIRE'));
            svg.appendChild(S('text', { x: rectX + rectW/2, y: ay + 8,
                'text-anchor': 'middle', fill: '#444', 'font-size': '10'
            }, `Va = ${fmt(vars.Va)} ${u.labelV}`));
        }

        // AGUA
        svg.appendChild(S('rect', {
            x: rectX, y: yWater, width: rectW, height: hW,
            fill: '#bde0f5', stroke: '#444', 'stroke-width': 1.5
        }));
        if (hW > 15) {
            const wy = yWater + hW / 2;
            svg.appendChild(S('text', { x: rectX + rectW/2, y: wy - 6,
                'text-anchor': 'middle', fill: '#1a5e8c', 'font-size': '10', 'font-style': 'italic' }, 'AGUA'));
            svg.appendChild(S('text', { x: rectX + rectW/2, y: wy + 8,
                'text-anchor': 'middle', fill: '#1a5e8c', 'font-size': '10'
            }, `Vw = ${fmt(vars.Vw)} ${u.labelV}`));
        }

        // SÓLIDOS
        svg.appendChild(S('rect', {
            x: rectX, y: ySolids, width: rectW, height: hS,
            fill: '#d4a96a', stroke: '#444', 'stroke-width': 1.5
        }));
        if (hS > 15) {
            const sy = ySolids + hS / 2;
            svg.appendChild(S('text', { x: rectX + rectW/2, y: sy - 6,
                'text-anchor': 'middle', fill: '#6b3a0f', 'font-size': '10', 'font-style': 'italic' }, 'SÓLIDOS'));
            svg.appendChild(S('text', { x: rectX + rectW/2, y: sy + 8,
                'text-anchor': 'middle', fill: '#6b3a0f', 'font-size': '10'
            }, `Vs = ${fmt(vars.Vs)} ${u.labelV}`));
        }

        // ================================================================
        // C) PANEL IZQUIERDO — Volúmenes con flechas
        // ================================================================
        const xLeft  = 125;
        const xLeft2 = 98;
        const xLeft3 = 72;

        // Flecha Vt total (cubre capa extra + suelo si aplica)
        const yVtTop = hasExtraLayer ? extraTop : soilTop;
        const leftG  = S('g', {});
        leftG.appendChild(S('line', { x1: xLeft, y1: yVtTop, x2: xLeft, y2: yBottom,
            stroke: '#333', 'stroke-width': 1.5 }));
        leftG.appendChild(S('line', { x1: xLeft - 5, y1: yVtTop, x2: xLeft + 5, y2: yVtTop,
            stroke: '#333', 'stroke-width': 1.2 }));
        leftG.appendChild(S('line', { x1: xLeft - 5, y1: yBottom, x2: xLeft + 5, y2: yBottom,
            stroke: '#333', 'stroke-width': 1.2 }));
        leftG.appendChild(S('text', {
            x: xLeft - 8, y: (yVtTop + yBottom) / 2 + 4,
            'text-anchor': 'end', fill: '#222', 'font-size': '11', 'font-weight': 'bold'
        }, `Vt=${fmt(vars.Vt, 2)} ${u.labelV}`));
        svg.appendChild(leftG);

        // Sub-flecha Vs
        if (hS > 0) {
            const vsG = S('g', {});
            vsG.appendChild(S('line', { x1: xLeft2, y1: ySolids, x2: xLeft2, y2: yBottom,
                stroke: '#8a5a2a', 'stroke-width': 1.2 }));
            vsG.appendChild(S('line', { x1: xLeft2 - 4, y1: ySolids, x2: xLeft2 + 4, y2: ySolids,
                stroke: '#8a5a2a', 'stroke-width': 1 }));
            vsG.appendChild(S('line', { x1: xLeft2 - 4, y1: yBottom, x2: xLeft2 + 4, y2: yBottom,
                stroke: '#8a5a2a', 'stroke-width': 1 }));
            vsG.appendChild(S('text', { x: xLeft2 - 6, y: (ySolids + yBottom) / 2 + 4,
                'text-anchor': 'end', fill: '#8a5a2a', 'font-size': '10' }, 'Vs'));
            svg.appendChild(vsG);
        }

        // Sub-flecha Vv (vacíos = Va + Vw)
        if (hA + hW > 0) {
            const vvG = S('g', {});
            vvG.appendChild(S('line', { x1: xLeft3, y1: yAir, x2: xLeft3, y2: ySolids,
                stroke: '#555', 'stroke-width': 1.2 }));
            vvG.appendChild(S('line', { x1: xLeft3 - 4, y1: yAir, x2: xLeft3 + 4, y2: yAir,
                stroke: '#555', 'stroke-width': 1 }));
            vvG.appendChild(S('line', { x1: xLeft3 - 4, y1: ySolids, x2: xLeft3 + 4, y2: ySolids,
                stroke: '#555', 'stroke-width': 1 }));
            vvG.appendChild(S('text', { x: xLeft3 - 6, y: (yAir + ySolids) / 2 + 4,
                'text-anchor': 'end', fill: '#555', 'font-size': '10' }, 'Vv'));
            svg.appendChild(vvG);
            svg.appendChild(S('text', { x: 4, y: (yAir + ySolids) / 2 + 15,
                'text-anchor': 'start', fill: '#555', 'font-size': '9' }, 'Vv = Va+Vw'));
        }

        // Cuadro e = Vv/Vs
        const eBoxY = yBottom + 10;
        const e_val = vars.e;
        svg.appendChild(S('rect', { x: 4, y: eBoxY, width: 138, height: 28,
            rx: 3, fill: '#fffde7', stroke: '#f59e0b', 'stroke-width': 1.2 }));
        svg.appendChild(S('text', { x: 73, y: eBoxY + 11, 'text-anchor': 'middle',
            fill: '#92400e', 'font-size': '9', 'font-weight': 'bold' }, 'Relación de Vacíos:'));
        svg.appendChild(S('text', { x: 73, y: eBoxY + 23, 'text-anchor': 'middle',
            fill: '#92400e', 'font-size': '10', 'font-weight': 'bold' },
            `e = Vv/Vs = ${e_val !== null ? e_val.toFixed(4) : '?'}`));

        // ================================================================
        // D) PANEL DERECHO — Pesos de las 3 fases del suelo
        // ================================================================
        const xRight  = rectX + rectW + 30;
        const xRight2 = xRight + 70;

        // Ws
        const wsG = S('g', {});
        wsG.appendChild(S('line', { x1: xRight, y1: ySolids, x2: xRight, y2: yBottom,
            stroke: '#8a5a2a', 'stroke-width': 1.5 }));
        wsG.appendChild(S('line', { x1: xRight - 4, y1: ySolids, x2: xRight + 4, y2: ySolids,
            stroke: '#8a5a2a', 'stroke-width': 1 }));
        wsG.appendChild(S('line', { x1: xRight - 4, y1: yBottom, x2: xRight + 4, y2: yBottom,
            stroke: '#8a5a2a', 'stroke-width': 1 }));
        wsG.appendChild(S('text', { x: xRight + 8, y: (ySolids + yBottom) / 2 + 4,
            fill: '#8a5a2a', 'font-size': '10'
        }, `Ws = ${fmt(vars.Ws)} ${u.labelW}`));
        svg.appendChild(wsG);

        // Ww
        if (hW > 0) {
            const wwG = S('g', {});
            wwG.appendChild(S('line', { x1: xRight, y1: yWater, x2: xRight, y2: ySolids,
                stroke: '#1a5e8c', 'stroke-width': 1.5 }));
            wwG.appendChild(S('line', { x1: xRight - 4, y1: yWater, x2: xRight + 4, y2: yWater,
                stroke: '#1a5e8c', 'stroke-width': 1 }));
            wwG.appendChild(S('line', { x1: xRight - 4, y1: ySolids, x2: xRight + 4, y2: ySolids,
                stroke: '#1a5e8c', 'stroke-width': 1 }));
            wwG.appendChild(S('text', { x: xRight + 8, y: (yWater + ySolids) / 2 + 4,
                fill: '#1a5e8c', 'font-size': '10'
            }, `Ww = ${fmt(vars.Ww)} ${u.labelW}`));
            svg.appendChild(wwG);
        }

        // Wt total flecha exterior
        const yWtTop = hW > 0 ? yWater : ySolids;
        const wtG = S('g', {});
        wtG.appendChild(S('line', { x1: xRight2, y1: yWtTop, x2: xRight2, y2: yBottom,
            stroke: '#222', 'stroke-width': 1.5 }));
        wtG.appendChild(S('line', { x1: xRight2 - 5, y1: yWtTop, x2: xRight2 + 5, y2: yWtTop,
            stroke: '#222', 'stroke-width': 1.2 }));
        wtG.appendChild(S('line', { x1: xRight2 - 5, y1: yBottom, x2: xRight2 + 5, y2: yBottom,
            stroke: '#222', 'stroke-width': 1.2 }));
        wtG.appendChild(S('text', { x: xRight2 + 6, y: (yWtTop + yBottom) / 2 + 4,
            fill: '#222', 'font-size': '10', 'font-weight': 'bold'
        }, `Wt=${fmt(vars.Wt, 2)} ${u.labelW}`));
        svg.appendChild(wtG);

        // Cuadro ecuación de pesos
        const eqBoxY = yBottom + 10;
        const eqLabel = hasExtraLayer
            ? `Wt = Ws + Ww + Wc = ${fmt(vars.Wt, 2)} ${u.labelW}`
            : `Wt = Ws + Ww = ${fmt(vars.Wt, 2)} ${u.labelW}`;
        svg.appendChild(S('rect', { x: rectX + rectW + 20, y: eqBoxY, width: 175, height: 28,
            rx: 3, fill: '#f0f9ff', stroke: '#38bdf8', 'stroke-width': 1.2 }));
        svg.appendChild(S('text', { x: rectX + rectW + 108, y: eqBoxY + 11, 'text-anchor': 'middle',
            fill: '#0369a1', 'font-size': '9', 'font-weight': 'bold' }, 'Peso Total:'));
        svg.appendChild(S('text', { x: rectX + rectW + 108, y: eqBoxY + 23, 'text-anchor': 'middle',
            fill: '#0369a1', 'font-size': '10', 'font-weight': 'bold' }, eqLabel));

        // Ejes
        svg.appendChild(S('text', { x: rectX - 2, y: yBottom + 50, 'text-anchor': 'end',
            fill: '#666', 'font-size': '9', 'font-style': 'italic' }, '← VOLÚMENES'));
        svg.appendChild(S('text', { x: rectX + rectW + 2, y: yBottom + 50,
            fill: '#666', 'font-size': '9', 'font-style': 'italic' }, 'PESOS →'));

        container.appendChild(svg);
    }

    // ====================================================================
    // CUBO 3D — capa extra SOLO cuando soilType === 'extra_layer' AND Vc > 0
    // ====================================================================
    function updateCube3D(vars, soilType) {
        while (soilGroup.children.length > 0) soilGroup.remove(soilGroup.children[0]);

        // La capa extra solo aparece si el tipo de suelo es explícitamente extra_layer
        const showExtra = (soilType === 'extra_layer') && (vars.Vc > 0 || vars.Wc > 0);
        const VcVal     = showExtra ? (vars.Vc || 0) : 0;

        const Vsuelo = (vars.Vs || 0) + (vars.Vw || 0) + (vars.Va || 0);
        const VtTot  = Vsuelo + VcVal || 1;

        // Fracciones de las 3 fases del suelo
        let sFrac = Vsuelo > 0 ? Math.max(0, (vars.Vs || 0) / VtTot) : 0.40;
        let wFrac = Vsuelo > 0 ? Math.max(0, (vars.Vw || 0) / VtTot) : 0.30;
        let aFrac = Vsuelo > 0 ? Math.max(0, (vars.Va || 0) / VtTot) : 0.30;
        
        // Fracción de capa extra: 0 si no aplica
        let cFrac = 0;
        if (showExtra) {
            if (VcVal > 0) {
                cFrac = Math.max(0, VcVal / VtTot);
            } else if (vars.Wc !== null && vars.Wc > 0) {
                cFrac = 0.15; // Representación visual cuando se desconoce el volumen exacto
            }
        }

        // Normalizar solo las 3 fases del suelo si no hay capa extra
        const total = sFrac + wFrac + aFrac + cFrac;
        if (total > 0) { sFrac /= total; wFrac /= total; aFrac /= total; cFrac /= total; }

        const size = 1.0;

        const drawBox = (frac, hexColor, prevY, opacity = 1) => {
            if (frac <= 0.005) return prevY;
            const h   = size * frac;
            const geo = new THREE.BoxGeometry(size, h, size);
            const mat = new THREE.MeshPhongMaterial({
                color: new THREE.Color(hexColor),
                transparent: opacity < 1,
                opacity
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = prevY + h / 2;
            const edges = new THREE.EdgesGeometry(geo);
            mesh.add(new THREE.LineSegments(edges,
                new THREE.LineBasicMaterial({ color: 0x333333, opacity: 0.3, transparent: true })));
            soilGroup.add(mesh);
            return prevY + h;
        };

        const startY = -size / 2;
        let pY = drawBox(sFrac, '#c8a26b', startY);      // sólidos
        pY     = drawBox(wFrac, '#4a9fd4', pY, 0.8);    // agua
        pY     = drawBox(aFrac, '#dde5ee', pY, 0.4);    // aire
        if (showExtra && cFrac > 0)
            drawBox(cFrac, '#a78bfa', pY, 0.85);        // capa extra (solo si aplica)

        soilGroup.position.y = -0.1;
    }

    // ====================================================================
    // GRÁFICO PROPORCIONES (PIE)
    // ====================================================================
    function updateProportionsChart(vars) {
        const ctx = document.getElementById('proportions-chart').getContext('2d');
        const dataValues = [
            Math.max(0, vars.Vs || 0),
            Math.max(0, vars.Vw || 0),
            Math.max(0, vars.Va || 0),
            Math.max(0, vars.Vc || 0)
        ];
        const uLabel = currentUnit.labelV;

        if (proportionsChart) {
            proportionsChart.data.datasets[0].data = dataValues;
            proportionsChart.options.plugins.title.text =
                `Proporciones volumétricas (${uLabel})`;
            proportionsChart.update();
        } else {
            proportionsChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: [`Sólidos (${uLabel})`, `Agua (${uLabel})`,
                             `Aire (${uLabel})`, `Capa Extra (${uLabel})`],
                    datasets: [{
                        data: dataValues,
                        backgroundColor: [colors.solid, colors.water, colors.air, colors.extra],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: `Proporciones volumétricas (${uLabel})` },
                        legend: { position: 'right', labels: { font: { family: 'Inter' } } }
                    }
                }
            });
        }
    }

    // ====================================================================
    // GRÁFICO e vs n
    // ====================================================================
    function updateENChart(vars) {
        const ctx = document.getElementById('e-n-chart').getContext('2d');
        const curveData = [];
        for (let e = 0; e <= 2; e += 0.1) curveData.push({ x: e, y: e / (1 + e) });
        const currentData = (vars.e !== null && vars.n !== null)
            ? [{ x: vars.e, y: vars.n }] : [];

        if (enChart) {
            enChart.data.datasets[1].data = currentData;
            enChart.update();
        } else {
            enChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Teoría: n = e/(1+e)', data: curveData,
                          borderColor: colors.text, borderWidth: 2,
                          showLine: true, pointRadius: 0, tension: 0.4 },
                        { label: 'Estado Actual', data: currentData,
                          backgroundColor: colors.water, borderColor: '#0369a1', pointRadius: 6 }
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

    // ====================================================================
    // GRÁFICO γ vs w
    // ====================================================================
    function updateGammaWChart(vars) {
        const ctx = document.getElementById('gamma-w-chart').getContext('2d');
        const uLabel = currentUnit.label;
        let curveData = [];
        if (vars.Gs !== null && vars.e !== null) {
            for (let w = 0; w <= 0.6; w += 0.05)
                curveData.push({ x: w, y: (1 + w) * vars.Gs / (1 + vars.e) });
        }
        const currentData = (vars.w !== null && vars.rt !== null)
            ? [{ x: vars.w, y: vars.rt }] : [];

        if (gammaWChart) {
            gammaWChart.data.datasets[0].data = curveData;
            gammaWChart.data.datasets[1].data = currentData;
            gammaWChart.options.scales.y.title.text = `Densidad Total γt (${uLabel})`;
            gammaWChart.update();
        } else {
            gammaWChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Curva Teórica', data: curveData,
                          borderColor: colors.solid, showLine: true, pointRadius: 0 },
                        { label: 'Estado Actual', data: currentData,
                          backgroundColor: '#ef4444', pointRadius: 6 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Humedad w (decimal)' } },
                        y: { title: { display: true, text: `Densidad Total γt (${uLabel})` } }
                    }
                }
            });
        }
    }

    // ====================================================================
    // EVENTOS
    // ====================================================================
    document.addEventListener('soilDataUpdated', (ev) => {
        const vars      = ev.detail.vars;
        const soilType  = ev.detail.soilType || 'partially_saturated';
        if (ev.detail.unitInfo) currentUnit = ev.detail.unitInfo;
        updatePhaseDiagram(vars, soilType);
        updateProportionsChart(vars, soilType);
        updateCube3D(vars, soilType);   // ← pasar soilType para controlar capa extra
        updateENChart(vars);
        updateGammaWChart(vars);
    });

    document.addEventListener('soilDataReset', () => {
        // Resetear sin capa extra (soil type desconocido)
        updatePhaseDiagram({});
        updateCube3D({}, 'partially_saturated');  // nunca muestra capa extra en reset
        if (proportionsChart) {
            proportionsChart.data.datasets[0].data = [0, 0, 0, 0];
            proportionsChart.update();
        }
        if (enChart) { enChart.data.datasets[1].data = []; enChart.update(); }
        if (gammaWChart) {
            gammaWChart.data.datasets[0].data = [];
            gammaWChart.data.datasets[1].data = [];
            gammaWChart.update();
        }
    });

    // Estado inicial — sin capa extra
    updatePhaseDiagram({});
    updateCube3D({}, 'partially_saturated');
});
