/**
 * app.js - Controlador principal de la UI
 * v4: Selector de unidades, capa extra independiente, PDF mejorado.
 */

document.addEventListener('DOMContentLoaded', () => {
    const soilEngine = new SoilEngine();

    // ------------------------------------------------------------------
    // SISTEMA DE UNIDADES
    // ------------------------------------------------------------------
    const UNIT_SYSTEMS = {
        'g/cm³': {
            label: 'g/cm³', labelW: 'g', labelV: 'cm³',
            rwBase: 1.0,          // γw en g/cm³
            factorDensity: 1.0,   // multiplicador para densidades (rt, rd)
            factorWeight:  1.0,   // multiplicador para pesos (Wt, Ws, Ww, Wc)
            factorVolume:  1.0    // multiplicador para volúmenes
        },
        'kg/m³': {
            label: 'kg/m³', labelW: 'kg', labelV: 'm³',
            rwBase: 1000.0,
            factorDensity: 1000.0,
            factorWeight:  0.001,
            factorVolume:  1e-6
        },
        'kN/m³': {
            label: 'kN/m³', labelW: 'kN', labelV: 'm³',
            rwBase: 9.81,
            factorDensity: 9.81,
            factorWeight:  1 / (9.81 * 1000),
            factorVolume:  1e-6
        },
        'N/m³': {
            label: 'N/m³', labelW: 'N', labelV: 'm³',
            rwBase: 9810.0,
            factorDensity: 9810.0,
            factorWeight:  1 / 9810.0,
            factorVolume:  1e-6
        },
        'lb/ft³': {
            label: 'lb/ft³', labelW: 'lb', labelV: 'ft³',
            rwBase: 62.4,
            factorDensity: 62.4,
            factorWeight:  1 / 62.4,
            factorVolume:  1 / 28316.85
        }
    };

    let activeUnit = UNIT_SYSTEMS['g/cm³'];

    // ------------------------------------------------------------------
    // CAMPOS DE ENTRADA
    // ------------------------------------------------------------------
    const INPUT_FIELDS = [
        { id: 'Wt',  label: 'Peso Total (W<sub>t</sub>)',       unitType: 'W' },
        { id: 'Ws',  label: 'Peso Sólidos (W<sub>s</sub>)',     unitType: 'W' },
        { id: 'Ww',  label: 'Peso Agua (W<sub>w</sub>)',        unitType: 'W' },
        { id: 'Wc',  label: 'Peso Capa Extra (W<sub>c</sub>)',  unitType: 'W',  extra: true },
        { id: 'Vt',  label: 'Vol. Total (V<sub>t</sub>)',       unitType: 'V' },
        { id: 'Vs',  label: 'Vol. Sólidos (V<sub>s</sub>)',     unitType: 'V' },
        { id: 'Vv',  label: 'Vol. Vacíos (V<sub>v</sub>)',      unitType: 'V' },
        { id: 'Vw',  label: 'Vol. Agua (V<sub>w</sub>)',        unitType: 'V' },
        { id: 'Va',  label: 'Vol. Aire (V<sub>a</sub>)',        unitType: 'V' },
        { id: 'Vc',  label: 'Vol. Capa Extra (V<sub>c</sub>)',  unitType: 'V',  extra: true },
        { id: 'Gs',  label: 'Gravedad Específica (G<sub>s</sub>)', unitType: '' },
        { id: 'e',   label: 'Relación de vacíos (e)',           unitType: '' },
        { id: 'n',   label: 'Porosidad (n)',                    unitType: '' },
        { id: 'S',   label: 'Grado Saturación (S)',             unitType: '' },
        { id: 'w',   label: 'Humedad (w)',                      unitType: '' },
        { id: 'rt',  label: 'Dens. Total (γ<sub>t</sub>)',      unitType: 'D' },
        { id: 'rd',  label: 'Dens. Seca (γ<sub>d</sub>)',       unitType: 'D' }
    ];

    function getFieldUnit(field) {
        if (field.unitType === 'W') return activeUnit.labelW;
        if (field.unitType === 'V') return activeUnit.labelV;
        if (field.unitType === 'D') return activeUnit.label;
        return '';
    }

    const dataInputsContainer = document.getElementById('data-inputs');
    const soilTypeSelect      = document.getElementById('soil-type');
    const calculateBtn        = document.getElementById('btn-calculate');
    const resetBtn            = document.getElementById('btn-reset');
    const exportBtn           = document.getElementById('btn-export');
    const procedureContent    = document.getElementById('procedure-content');
    const alertModal          = document.getElementById('alert-modal');
    const alertMessage        = document.getElementById('alert-message');
    const closeModal          = document.querySelector('.close-btn');
    const normalizedModeSwitch = document.getElementById('normalized-mode');
    const unitSelector        = document.getElementById('unit-selector');

    let lastResult = null;

    // ------------------------------------------------------------------
    // UNIDADES — actualizar motor y ui cuando cambia
    // ------------------------------------------------------------------
    unitSelector.addEventListener('change', () => {
        activeUnit = UNIT_SYSTEMS[unitSelector.value] || UNIT_SYSTEMS['g/cm³'];
        soilEngine.rw = activeUnit.rwBase;
        renderInputs();
        // Si hay un resultado previo, recalcular con nuevas unidades
        if (lastResult) triggerCalculation();
    });

    // ------------------------------------------------------------------
    // GENERACIÓN DE INPUTS
    // ------------------------------------------------------------------
    function renderInputs() {
        dataInputsContainer.innerHTML = '';
        const currentType = soilTypeSelect.value;
        const showExtra   = currentType === 'extra_layer';

        INPUT_FIELDS.forEach(field => {
            if (field.extra && !showExtra) return;

            let specialValue = '';
            let disabled = '';
            if (currentType === 'saturated') {
                if (field.id === 'S')  { specialValue = '1'; disabled = 'disabled'; }
                if (field.id === 'Va') { specialValue = '0'; disabled = 'disabled'; }
            } else if (currentType === 'dry') {
                if (['S', 'Vw', 'Ww', 'w'].includes(field.id)) {
                    specialValue = '0'; disabled = 'disabled';
                }
            }

            const unitLabel = getFieldUnit(field);
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label for="input-${field.id}">${field.label}</label>
                <div class="input-group">
                    <input type="number" step="any" class="form-control"
                           id="input-${field.id}"
                           placeholder="Desconocido"
                           ${disabled}
                           value="${specialValue}"
                           data-user-value="${specialValue !== '' ? 'true' : 'false'}">
                    ${unitLabel ? `<span class="input-group-text">${unitLabel}</span>` : ''}
                </div>
            `;
            dataInputsContainer.appendChild(div);
        });

        bindInputEvents();
    }

    // ------------------------------------------------------------------
    // SWITCH MODOS (Cálculo Real / Simulación)
    // ------------------------------------------------------------------
    const panelCalcMode = document.getElementById('panel-calc-mode');
    const panelSimMode  = document.getElementById('panel-sim-mode');

    function switchMode(mode) {
        if (mode === 'calc') {
            panelCalcMode.classList.remove('hidden');
            panelSimMode.classList.add('hidden');
        } else {
            panelCalcMode.classList.add('hidden');
            panelSimMode.classList.remove('hidden');
        }
    }

    document.querySelectorAll('input[name="app-mode"]').forEach(radio => {
        radio.addEventListener('change', () => switchMode(radio.value));
    });
    document.querySelectorAll('.mode-option').forEach(label => {
        label.addEventListener('click', () => {
            const radio = label.querySelector('input[type=radio]');
            if (radio) switchMode(radio.value);
        });
    });

    // ------------------------------------------------------------------
    // KATEX
    // ------------------------------------------------------------------
    function renderFormula(element, texString) {
        katex.render(texString, element, { throwOnError: false, displayMode: true });
    }

    // ------------------------------------------------------------------
    // CÁLCULO PRINCIPAL
    // ------------------------------------------------------------------
    function triggerCalculation() {
        const knowns = {};
        INPUT_FIELDS.forEach(field => {
            const el = document.getElementById(`input-${field.id}`);
            if (el && el.value !== '' && el.dataset.userValue === 'true') {
                knowns[field.id] = parseFloat(el.value);
            }
        });

        const soilType    = soilTypeSelect.value;
        const isNormalized = normalizedModeSwitch.checked;
        soilEngine.rw = activeUnit.rwBase;
        soilEngine.setKnowns(knowns, soilType, isNormalized);
        const result = soilEngine.solve();
        lastResult = result;

        procedureContent.innerHTML = '';

        if (result.steps.length === 0) {
            procedureContent.innerHTML = `
                <div class="math-step">
                    <p>No se proporcionaron suficientes datos para calcular variables adicionales o todas ya están resueltas.</p>
                </div>
            `;
        } else {
            result.steps.forEach((step, index) => {
                const stepDiv = document.createElement('div');
                stepDiv.className = 'math-step';

                const title = document.createElement('div');
                title.className = 'math-step-title';
                title.textContent = `Paso ${index + 1}: ${step.description}`;
                stepDiv.appendChild(title);

                const texDisplay = document.createElement('div');
                stepDiv.appendChild(texDisplay);

                const fMatch  = INPUT_FIELDS.find(f => f.id === step.variable);
                const unitStr = fMatch && getFieldUnit(fMatch)
                    ? `\\text{ (${getFieldUnit(fMatch)})}` : '';
                const fullTex = `${step.formula} \\\\[1em] ${step.substitution} = \\mathbf{${step.result}}${unitStr}`;
                renderFormula(texDisplay, fullTex);

                procedureContent.appendChild(stepDiv);
            });

            // Cuadro de resultados finales
            const finalDiv = document.createElement('div');
            finalDiv.className = 'math-step';
            finalDiv.id = 'final-results-box';
            finalDiv.style.borderLeft = '4px solid var(--accent-blue-solid)';
            finalDiv.innerHTML = '<div class="math-step-title">Resultados Finales</div>';

            const summaryGrid = document.createElement('div');
            summaryGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;';

            const showKeys = soilType === 'extra_layer'
                ? ['Wt','Vt','Ws','Vs','Ww','Vw','Va','Wc','Vc','Gs','e','n','S','w','rt','rd']
                : ['Wt','Vt','Ws','Vs','Ww','Vw','Va','Gs','e','n','S','w','rt','rd'];

            showKeys.forEach(k => {
                if (result.vars[k] !== null && result.vars[k] !== undefined) {
                    const line = document.createElement('div');
                    line.style.cssText = 'padding:6px 8px;background:var(--bg-tertiary);border-radius:4px;font-size:0.85rem;';
                    const fMatch  = INPUT_FIELDS.find(f => f.id === k);
                    const label   = fMatch ? fMatch.label : k;
                    const unit    = fMatch ? getFieldUnit(fMatch) : '';
                    line.innerHTML = `<strong>${label}:</strong> ${result.vars[k].toFixed(4)} ${unit}`;
                    summaryGrid.appendChild(line);
                }
            });

            finalDiv.appendChild(summaryGrid);
            procedureContent.appendChild(finalDiv);
        }

        if (result.errors.length > 0) {
            alertMessage.innerHTML = '<ul>' + result.errors.map(e => `<li>${e}</li>`).join('') + '</ul>';
            alertModal.classList.remove('hidden');
        }

        document.dispatchEvent(new CustomEvent('soilDataUpdated', {
            detail: { vars: result.vars, soilType, unitInfo: activeUnit }
        }));

        updateSimPanel(result.vars);
    }

    // ------------------------------------------------------------------
    // PANEL DE SIMULACIÓN
    // ------------------------------------------------------------------
    const simSlider  = document.getElementById('sim-sat-slider');
    const simDisplay = document.getElementById('sim-s-display');
    const simResults = document.getElementById('sim-results');

    function updateSimPanel(vars) {
        if (!vars.Vs || !vars.Vt) {
            simResults.innerHTML = '<p class="sim-placeholder">Calcula datos reales primero para activar la simulación.</p>';
            return;
        }
        simResults.innerHTML = '<p class="sim-placeholder">Mueve el slider para simular cambios en S.</p>';
    }

    simSlider.addEventListener('input', () => {
        const S_sim = parseFloat(simSlider.value);
        simDisplay.textContent = (S_sim * 100).toFixed(1) + '%';

        if (!lastResult) return;
        const base = lastResult.vars;
        const rw   = activeUnit.rwBase;

        const Vs = base.Vs;
        const Vt = base.Vt;
        const Vc = base.Vc || 0;
        const Gs = base.Gs;
        const Ws = base.Ws;

        if (!Vs || !Vt) return;

        const Vv = Vt - Vs - Vc;
        const Vw = S_sim * Vv;
        const Va = Vv - Vw;
        const Ww = Vw * rw;
        const Wc = base.Wc || 0;
        const Wt = (Ws || 0) + Ww + Wc;
        const w  = (Ws && Ws !== 0) ? Ww / Ws : null;
        const e  = Vs !== 0 ? Vv / Vs : null;
        const n  = (Vs && Vv !== null) ? Vv / (Vs + Vv) : null;
        const rt = Vt !== 0 ? Wt / Vt : null;
        const rd = (Ws && (Vs + Vv) > 0) ? Ws / (Vs + Vv) : null;

        const simVars = { Vs, Vt, Vv, Vw, Va, Ws, Ww, Wt, Gs, S: S_sim, w, e, n, rt, rd, Wc, Vc };

        const u = activeUnit;
        const rows = [
            ['Vw (Vol. Agua)',  Vw, u.labelV],
            ['Va (Vol. Aire)',  Va, u.labelV],
            ['Ww (Peso Agua)',  Ww, u.labelW],
            ['Wt (Peso Total)', Wt, u.labelW],
            ['w (Humedad)',     w, ''],
            ['e (Rel. Vacíos)', e, ''],
            ['n (Porosidad)',   n, ''],
            [`γt (Den. Total)`, rt, u.label],
            [`γd (Den. Seca)`,  rd, u.label],
        ];

        simResults.innerHTML = `
            <div class="sim-results-grid">
                ${rows.map(([lbl, val, unit]) =>
            `<div class="sim-result-row">
                        <span class="sim-lbl">${lbl}</span>
                        <span class="sim-val">${val !== null ? val.toFixed(4) : '—'} ${unit}</span>
                    </div>`
        ).join('')}
            </div>
        `;

        document.dispatchEvent(new CustomEvent('soilDataUpdated', {
            detail: { vars: simVars, soilType: 'sim', isSimulation: true, unitInfo: u }
        }));
    });

    // ------------------------------------------------------------------
    // EVENTOS DE INPUTS
    // ------------------------------------------------------------------
    function bindInputEvents() {
        document.querySelectorAll('#data-inputs .form-control').forEach(input => {
            input.removeEventListener('input', handleManualInput);
            input.addEventListener('input', handleManualInput);
        });
    }

    function handleManualInput(e) {
        const target = e.target;
        target.dataset.userValue = target.value !== '' ? 'true' : 'false';
    }

    renderInputs();

    soilTypeSelect.addEventListener('change', () => {
        renderInputs();
        procedureContent.innerHTML = `<div class="empty-state"><p>Ingrese los datos y presione "Calcular" para ver el procedimiento paso a paso.</p></div>`;
        document.dispatchEvent(new CustomEvent('soilDataReset'));
        lastResult = null;
    });

    calculateBtn.addEventListener('click', triggerCalculation);

    resetBtn.addEventListener('click', () => {
        INPUT_FIELDS.forEach(field => {
            const el = document.getElementById(`input-${field.id}`);
            if (el) {
                el.value = el.disabled ? el.value : '';
                el.dataset.userValue = (el.disabled && el.value !== '') ? 'true' : 'false';
            }
        });
        procedureContent.innerHTML = `<div class="empty-state"><p>Ingrese los datos y presione "Calcular" para ver el procedimiento paso a paso.</p></div>`;
        document.dispatchEvent(new CustomEvent('soilDataReset'));
        lastResult = null;
        simResults.innerHTML = '<p class="sim-placeholder">Calcula datos reales primero para activar la simulación.</p>';
    });

    closeModal.addEventListener('click', () => alertModal.classList.add('hidden'));

    // ------------------------------------------------------------------
    // EXPORTAR PDF — Reporte técnico nativo (sin html2canvas)
    // ------------------------------------------------------------------
    exportBtn.addEventListener('click', async () => {
        if (!lastResult) {
            alert('No hay resultados calculados. Presione "Calcular" primero.');
            return;
        }

        exportBtn.textContent = 'Generando PDF...';
        exportBtn.disabled    = true;

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pW  = doc.internal.pageSize.getWidth();   // 210
            const pH  = doc.internal.pageSize.getHeight();  // 297
            const mg  = 14;                                 // margen
            const cW  = pW - mg * 2;                       // 182 mm
            let y     = mg;

            // ── Colores corporativos ──────────────────────────────────────
            const NAVY   = [20,  60, 130];
            const BLUE   = [30, 110, 200];
            const LGRAY  = [245, 247, 250];
            const DGRAY  = [80,  80,  80];
            const BLACK  = [20,  20,  20];
            const WHITE  = [255, 255, 255];
            const GOLD   = [180, 130,  30];
            const LINE   = [200, 210, 230];

            // ── Helpers ───────────────────────────────────────────────────
            const checkY = (need = 12) => {
                if (y + need > pH - mg) { doc.addPage(); addFooter(); y = mg; }
            };

            const hLine = (yy = y, color = LINE) => {
                doc.setDrawColor(...color);
                doc.setLineWidth(0.3);
                doc.line(mg, yy, pW - mg, yy);
            };

            let pageNum = 1;
            const addFooter = () => {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.setTextColor(...DGRAY);
                doc.text('Análisis Volumétrico y Gravimétrico de Suelos — UPB', mg, pH - 7);
                doc.text(`Pág. ${pageNum}`, pW - mg, pH - 7, { align: 'right' });
                pageNum++;
            };

            // ── PORTADA / ENCABEZADO ──────────────────────────────────────
            // Franja de color superior
            doc.setFillColor(...NAVY);
            doc.rect(0, 0, pW, 38, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(...WHITE);
            doc.text('REPORTE DE MECÁNICA DE SUELOS', mg, 16);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text('Análisis Volumétrico y Gravimétrico de Fases', mg, 24);

            doc.setFontSize(9);
            const tipoSuelo = soilTypeSelect.options[soilTypeSelect.selectedIndex].text;
            doc.text(`Tipo de suelo: ${tipoSuelo}   |   Unidades: ${activeUnit.label}   |   Fecha: ${new Date().toLocaleDateString('es-CO')}`, mg, 32);

            y = 46;
            hLine(y);
            y += 5;

            // ── SECCIÓN 1: DATOS DE ENTRADA ───────────────────────────────
            const drawSectionTitle = (title) => {
                checkY(14);
                doc.setFillColor(...BLUE);
                doc.rect(mg, y, cW, 8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...WHITE);
                doc.text(title, mg + 3, y + 5.5);
                y += 11;
                doc.setTextColor(...BLACK);
            };

            drawSectionTitle('1.  DATOS DE ENTRADA');

            // Tabla de entradas
            const inputRows = [];
            INPUT_FIELDS.forEach(field => {
                const el = document.getElementById(`input-${field.id}`);
                if (el && el.value !== '') {
                    const val = parseFloat(el.value);
                    if (!isNaN(val)) {
                        inputRows.push([field.label.replace(/<[^>]+>/g, ''), val.toString(), getFieldUnit(field) || '—']);
                    }
                }
            });

            const drawTable = (headers, rows, colWidths) => {
                const rowH    = 7;
                const hdrH    = 8;
                const totalW  = colWidths.reduce((a, b) => a + b, 0);
                let xBase     = mg;

                // Cabecera
                checkY(hdrH + 2);
                doc.setFillColor(...LGRAY);
                doc.rect(xBase, y, totalW, hdrH, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(...NAVY);
                let cx = xBase;
                headers.forEach((h, i) => {
                    doc.text(h, cx + 2, y + hdrH - 2);
                    cx += colWidths[i];
                });
                y += hdrH;
                hLine(y, NAVY);

                // Filas
                rows.forEach((row, ri) => {
                    checkY(rowH + 1);
                    if (ri % 2 === 0) {
                        doc.setFillColor(250, 251, 255);
                        doc.rect(xBase, y, totalW, rowH, 'F');
                    }
                    doc.setFont('helvetica', ri % 2 === 0 ? 'normal' : 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(...BLACK);
                    cx = xBase;
                    row.forEach((cell, j) => {
                        doc.text(String(cell).substring(0, 35), cx + 2, y + rowH - 2);
                        cx += colWidths[j];
                    });
                    y += rowH;
                    // Línea tenue
                    doc.setDrawColor(...LINE);
                    doc.setLineWidth(0.15);
                    doc.line(xBase, y, xBase + totalW, y);
                });

                // Marco exterior
                doc.setDrawColor(...BLUE);
                doc.setLineWidth(0.4);
                doc.rect(xBase, y - rows.length * rowH - hdrH, totalW, rows.length * rowH + hdrH, 'S');
                y += 5;
            };

            if (inputRows.length > 0) {
                drawTable(
                    ['Variable', 'Valor', 'Unidad'],
                    inputRows,
                    [100, 50, 32]
                );
            }

            // ── SECCIÓN 2: DESARROLLO MATEMÁTICO ─────────────────────────
            drawSectionTitle('2.  DESARROLLO MATEMÁTICO');

            const vars = lastResult.vars;
            lastResult.steps.forEach((step, i) => {
                checkY(18);
                const fM    = INPUT_FIELDS.find(f => f.id === step.variable);
                const uStr  = fM ? getFieldUnit(fM) : '';

                // Número y descripción del paso
                doc.setFillColor(238, 242, 252);
                doc.rect(mg, y, cW, 7, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(...NAVY);
                doc.text(`Paso ${i + 1}:  ${step.description}`, mg + 2, y + 5);
                y += 8;

                // Fórmula (texto plano limpio)
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...DGRAY);
                // Limpiar LaTeX básico para texto
                const cleanTex = (t) => t
                    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
                    .replace(/\\cdot/g, '·')
                    .replace(/\\text\{([^}]+)\}/g, '$1')
                    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
                    .replace(/\\gamma_([a-z])/g, 'γ$1')
                    .replace(/\\gamma/g, 'γ')
                    .replace(/\\cdot/g, '·')
                    .replace(/\\_([a-z])/g, '$1')
                    .replace(/[{}\\]/g, '')
                    .replace(/\s+/g, ' ').trim();

                const formulaLine = cleanTex(step.formula);
                const substLine   = cleanTex(step.substitution);
                const resultLine  = `  →  ${step.variable} = ${step.result} ${uStr}`;

                doc.text(formulaLine,  mg + 4, y + 4);        y += 5;
                doc.text(substLine,    mg + 4, y + 4);        y += 5;

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...BLUE);
                doc.setFontSize(9.5);
                doc.text(resultLine, mg + 4, y + 4);
                y += 7;

                hLine(y, [220, 228, 245]);
                y += 2;
            });

            // ── SECCIÓN 3: RESULTADOS FINALES ─────────────────────────────
            y += 3;
            drawSectionTitle('3.  RESULTADOS FINALES');

            const soilType = soilTypeSelect.value;
            const showKeys = soilType === 'extra_layer'
                ? ['Wt','Vt','Ws','Vs','Ww','Vw','Va','Wc','Vc','Gs','e','n','S','w','rt','rd']
                : ['Wt','Vt','Ws','Vs','Ww','Vw','Va','Gs','e','n','S','w','rt','rd'];

            const resultRows = [];
            showKeys.forEach(k => {
                if (vars[k] !== null && vars[k] !== undefined) {
                    const fM    = INPUT_FIELDS.find(f => f.id === k);
                    const label = (fM ? fM.label : k).replace(/<[^>]+>/g, '');
                    const unit  = fM ? getFieldUnit(fM) : '';
                    resultRows.push([label, vars[k].toFixed(4), unit || '—']);
                }
            });

            // Split results into two columns
            const half    = Math.ceil(resultRows.length / 2);
            const left    = resultRows.slice(0, half);
            const right   = resultRows.slice(half);
            const rowH_r  = 7;

            checkY((half + 1) * rowH_r + 10);

            // Encabezado columnas
            const col1X = mg, col2X = mg + cW / 2 + 2;
            const colW  = cW / 2 - 2;

            ['Variable', 'Valor', 'Unidad'].forEach((h, i) => {
                const offsets = [0, 70, 88];
                doc.setFillColor(...LGRAY);
                doc.rect(col1X + offsets[i], y, i < 2 ? 70 : 24, 7, 'F');
                doc.rect(col2X + offsets[i], y, i < 2 ? 70 : 24, 7, 'F');
            });
            doc.setFillColor(...LGRAY);
            doc.rect(col1X, y, colW, 7, 'F');
            doc.rect(col2X, y, colW, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...NAVY);
            doc.text('Variable', col1X + 2, y + 5);
            doc.text('Valor', col1X + 80, y + 5);
            doc.text('Variable', col2X + 2, y + 5);
            doc.text('Valor', col2X + 80, y + 5);
            y += 8;
            hLine(y, NAVY);

            const maxRows = Math.max(left.length, right.length);
            for (let i = 0; i < maxRows; i++) {
                checkY(rowH_r + 1);
                if (i % 2 === 0) {
                    doc.setFillColor(252, 253, 255);
                    doc.rect(col1X, y, colW, rowH_r, 'F');
                    doc.rect(col2X, y, colW, rowH_r, 'F');
                }
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(...BLACK);

                if (left[i]) {
                    doc.text(left[i][0].substring(0, 26),  col1X + 2,    y + 5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...BLUE);
                    doc.text(`${left[i][1]} ${left[i][2]}`, col1X + 78, y + 5, { align: 'right' });
                }
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...BLACK);
                if (right[i]) {
                    doc.text(right[i][0].substring(0, 26), col2X + 2,    y + 5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...BLUE);
                    doc.text(`${right[i][1]} ${right[i][2]}`, col2X + 78, y + 5, { align: 'right' });
                }
                y += rowH_r;
                doc.setDrawColor(...LINE);
                doc.setLineWidth(0.15);
                doc.line(col1X, y, col1X + colW, y);
                doc.line(col2X, y, col2X + colW, y);
            }
            doc.setDrawColor(...BLUE);
            doc.setLineWidth(0.4);
            doc.rect(col1X, y - maxRows * rowH_r - 8, colW, maxRows * rowH_r + 8, 'S');
            doc.rect(col2X, y - maxRows * rowH_r - 8, colW, maxRows * rowH_r + 8, 'S');
            y += 8;

            // ── SECCIÓN 4: GRÁFICAS ───────────────────────────────────────
            const chartDefs = [
                { id: 'proportions-chart', title: '4.  PROPORCIONES VOLUMÉTRICAS' },
                { id: 'e-n-chart',         title: '5.  RELACIÓN e vs n' },
                { id: 'gamma-w-chart',     title: '6.  VARIACIÓN γt vs w' }
            ];

            for (const cd of chartDefs) {
                const cvs = document.getElementById(cd.id);
                if (!cvs || cvs.width === 0) continue;

                doc.addPage();
                addFooter();
                y = mg;
                drawSectionTitle(cd.title);

                // Export directly from Chart.js canvas (native, no html2canvas)
                const imgData = cvs.toDataURL('image/png', 1.0);
                let imgH    = (cvs.height / cvs.width) * cW;
                let imgW    = cW;
                const maxH  = pH - y - mg - 10;
                
                if (imgH > maxH) {
                    imgH = maxH;
                    imgW = (cvs.width / cvs.height) * imgH;
                }
                
                const xPos = mg + (cW - imgW) / 2;
                doc.addImage(imgData, 'PNG', xPos, y, imgW, imgH);
                y += imgH + 6;
            }

            // Diagrama de fases — renderizar SVG en canvas temporal
            const phaseSVG = document.querySelector('#phase-diagram svg');
            if (phaseSVG) {
                doc.addPage();
                addFooter();
                y = mg;
                drawSectionTitle('7.  DIAGRAMA DE FASES');

                try {
                    const svgStr  = new XMLSerializer().serializeToString(phaseSVG);
                    const blob    = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                    const url     = URL.createObjectURL(blob);
                    const img     = new Image();
                    await new Promise((res, rej) => {
                        img.onload = res;
                        img.onerror = rej;
                        img.src = url;
                    });

                    const tmpCanvas = document.createElement('canvas');
                    const scale     = 3;
                    tmpCanvas.width  = img.naturalWidth  * scale || 1500;
                    tmpCanvas.height = img.naturalHeight * scale || 1200;
                    const tCtx = tmpCanvas.getContext('2d');
                    tCtx.scale(scale, scale);
                    tCtx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);

                    const phaseImg  = tmpCanvas.toDataURL('image/png', 1.0);
                    let phaseImgH = (tmpCanvas.height / tmpCanvas.width) * cW;
                    let phaseImgW = cW;
                    const maxPhaseH = pH - y - mg - 10;
                    
                    if (phaseImgH > maxPhaseH) {
                        phaseImgH = maxPhaseH;
                        phaseImgW = (tmpCanvas.width / tmpCanvas.height) * phaseImgH;
                    }
                    
                    const pxPos = mg + (cW - phaseImgW) / 2;
                    doc.addImage(phaseImg, 'PNG', pxPos, y, phaseImgW, phaseImgH);
                    y += phaseImgH + 6;
                } catch (svgErr) {
                    console.warn('SVG render error:', svgErr);
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9);
                    doc.setTextColor(...DGRAY);
                    doc.text('(Diagrama de fases no disponible en este entorno)', mg, y + 5);
                    y += 10;
                }
            }

            // Pie de página en la primera página (la portada)
            // (las demás se agregan en addFooter)
            // La primera página ya fue escrita — agregar pie retroactivamente
            const totalPages = doc.internal.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.setTextColor(...DGRAY);
                doc.text('Análisis Volumétrico y Gravimétrico de Suelos', mg, pH - 7);
                doc.text(`Página ${p} de ${totalPages}`, pW - mg, pH - 7, { align: 'right' });
                // Línea pie
                doc.setDrawColor(...LINE);
                doc.setLineWidth(0.3);
                doc.line(mg, pH - 10, pW - mg, pH - 10);
            }

            doc.save('reporte_mecanica_suelos.pdf');

        } catch (err) {
            console.error('PDF export error:', err);
            alert('Error al generar el PDF. Revisa la consola para más detalles.');
        }

        exportBtn.textContent = 'Exportar PDF';
        exportBtn.disabled    = false;
    });

});

