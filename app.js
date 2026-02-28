/**
 * app.js - Controlador de la interfaz y renderizador matemático
 * Cambios v2:
 *  - Sin auto-fill de inputs calculados (solo se muestran en Resultados Finales)
 *  - Sin auto-cálculo al escribir (solo al presionar Calcular)
 *  - PDF exporta todas las secciones: inputs, desarrollo y gráficas
 */

document.addEventListener('DOMContentLoaded', () => {
    const soilEngine = new SoilEngine();

    // Configuración de variables de entrada
    const INPUT_FIELDS = [
        { id: 'Wt', label: 'Peso Total (W<sub>t</sub>)', unit: 'g' },
        { id: 'Ws', label: 'Peso Sólidos (W<sub>s</sub>)', unit: 'g' },
        { id: 'Ww', label: 'Peso Agua (W<sub>w</sub>)', unit: 'g' },
        { id: 'Wc', label: 'Peso Capa (W<sub>c</sub>)', unit: 'g', extra: true },

        { id: 'Vt', label: 'Vol. Total (V<sub>t</sub>)', unit: 'cm³' },
        { id: 'Vs', label: 'Vol. Sólidos (V<sub>s</sub>)', unit: 'cm³' },
        { id: 'Vv', label: 'Vol. Vacíos (V<sub>v</sub>)', unit: 'cm³' },
        { id: 'Vw', label: 'Vol. Agua (V<sub>w</sub>)', unit: 'cm³' },
        { id: 'Va', label: 'Vol. Aire (V<sub>a</sub>)', unit: 'cm³' },
        { id: 'Vc', label: 'Vol. Capa (V<sub>c</sub>)', unit: 'cm³', extra: true },

        { id: 'Gs', label: 'Gravedad Específica (G<sub>s</sub>)', unit: '' },
        { id: 'e', label: 'Relación de vacíos (e)', unit: '' },
        { id: 'n', label: 'Porosidad (n)', unit: '' },
        { id: 'S', label: 'Grado Saturación (S)', unit: '' },
        { id: 'w', label: 'Humedad (w)', unit: '' },

        { id: 'rt', label: 'Dens. Total (γ<sub>t</sub>)', unit: 'g/cm³' },
        { id: 'rd', label: 'Dens. Seca (γ<sub>d</sub>)', unit: 'g/cm³' }
    ];

    const dataInputsContainer = document.getElementById('data-inputs');
    const soilTypeSelect = document.getElementById('soil-type');
    const calculateBtn = document.getElementById('btn-calculate');
    const resetBtn = document.getElementById('btn-reset');
    const exportBtn = document.getElementById('btn-export');
    const procedureContent = document.getElementById('procedure-content');
    const alertModal = document.getElementById('alert-modal');
    const alertMessage = document.getElementById('alert-message');
    const closeModal = document.querySelector('.close-btn');
    const normalizedModeSwitch = document.getElementById('normalized-mode');
    const modeCalcRadio = document.getElementById('mode-calc');
    const modeSimRadio = document.getElementById('mode-sim');
    const panelCalcMode = document.getElementById('panel-calc-mode');
    const panelSimMode = document.getElementById('panel-sim-mode');

    // Último resultado calculado (disponible para la simulación)
    let lastResult = null;

    // ------------------------------------------------------------------
    // GENERACIÓN DE INPUTS
    // ------------------------------------------------------------------
    function renderInputs() {
        dataInputsContainer.innerHTML = '';
        const currentType = soilTypeSelect.value;
        const showExtra = currentType === 'extra_layer';

        INPUT_FIELDS.forEach(field => {
            if (field.extra && !showExtra) return;

            let specialValue = '';
            let disabled = '';
            if (currentType === 'saturated') {
                if (field.id === 'S') { specialValue = '1'; disabled = 'disabled'; }
                if (field.id === 'Va') { specialValue = '0'; disabled = 'disabled'; }
            } else if (currentType === 'dry') {
                if (['S', 'Vw', 'Ww', 'w'].includes(field.id)) {
                    specialValue = '0'; disabled = 'disabled';
                }
            }

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
                    ${field.unit ? `<span class="input-group-text">${field.unit}</span>` : ''}
                </div>
            `;
            dataInputsContainer.appendChild(div);
        });

        bindInputEvents();
    }

    // ------------------------------------------------------------------
    // GESTIÓN DE MODOS
    // ------------------------------------------------------------------
    function switchMode(mode) {
        if (mode === 'calc') {
            panelCalcMode.classList.remove('hidden');
            panelSimMode.classList.add('hidden');
        } else {
            panelCalcMode.classList.add('hidden');
            panelSimMode.classList.remove('hidden');
        }
    }

    // Escuchar clicks en todos los radio buttons de modo
    document.querySelectorAll('input[name="app-mode"]').forEach(radio => {
        radio.addEventListener('change', () => switchMode(radio.value));
    });
    // También escuchar en los labels para máxima compatibilidad
    document.querySelectorAll('.mode-option').forEach(label => {
        label.addEventListener('click', () => {
            const radio = label.querySelector('input[type=radio]');
            if (radio) switchMode(radio.value);
        });
    });


    // ------------------------------------------------------------------
    // RENDERIZADO KATEX
    // ------------------------------------------------------------------
    function renderFormula(element, texString) {
        katex.render(texString, element, { throwOnError: false, displayMode: true });
    }

    // ------------------------------------------------------------------
    // FUNCIÓN PRINCIPAL DE CÁLCULO
    // ------------------------------------------------------------------
    function triggerCalculation() {
        const knowns = {};
        INPUT_FIELDS.forEach(field => {
            const el = document.getElementById(`input-${field.id}`);
            if (el && el.value !== '' && el.dataset.userValue === 'true') {
                knowns[field.id] = parseFloat(el.value);
            }
        });

        const soilType = soilTypeSelect.value;
        const isNormalized = normalizedModeSwitch.checked;
        soilEngine.setKnowns(knowns, soilType, isNormalized);
        const result = soilEngine.solve();
        lastResult = result;

        // Limpiar procedimiento
        procedureContent.innerHTML = '';

        if (result.steps.length === 0) {
            procedureContent.innerHTML = `
                <div class="math-step">
                    <p>No se proporcionaron suficientes datos para calcular variables adicionales o todas ya están resueltas.</p>
                </div>
            `;
        } else {
            // Pasos matemáticos
            result.steps.forEach((step, index) => {
                const stepDiv = document.createElement('div');
                stepDiv.className = 'math-step';

                const title = document.createElement('div');
                title.className = 'math-step-title';
                title.textContent = `Paso ${index + 1}: ${step.description}`;
                stepDiv.appendChild(title);

                const texDisplay = document.createElement('div');
                stepDiv.appendChild(texDisplay);

                const unitMatch = INPUT_FIELDS.find(f => f.id === step.variable);
                const unitStr = unitMatch && unitMatch.unit ? `\\text{ (${unitMatch.unit})}` : '';
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

            ['Wt', 'Vt', 'Ws', 'Vs', 'Ww', 'Vw', 'Va', 'Gs', 'e', 'n', 'S', 'w', 'rt', 'rd'].forEach(k => {
                if (result.vars[k] !== null && result.vars[k] !== undefined) {
                    const line = document.createElement('div');
                    line.style.cssText = 'padding:6px 8px;background:var(--bg-tertiary);border-radius:4px;font-size:0.85rem;';
                    const fMatch = INPUT_FIELDS.find(f => f.id === k);
                    const label = fMatch ? fMatch.label : k;
                    const unit = fMatch ? fMatch.unit : '';
                    line.innerHTML = `<strong>${label}:</strong> ${result.vars[k].toFixed(4)} ${unit}`;
                    summaryGrid.appendChild(line);
                }
            });

            finalDiv.appendChild(summaryGrid);
            procedureContent.appendChild(finalDiv);
        }

        // Mostrar errores físicos
        if (result.errors.length > 0) {
            alertMessage.innerHTML = '<ul>' + result.errors.map(e => `<li>${e}</li>`).join('') + '</ul>';
            alertModal.classList.remove('hidden');
        }

        // Disparar evento para actualizar gráficos
        document.dispatchEvent(new CustomEvent('soilDataUpdated', {
            detail: { vars: result.vars, soilType }
        }));

        // Habilitar simulación si hay datos suficientes
        updateSimPanel(result.vars);
    }

    // ------------------------------------------------------------------
    // PANEL DE SIMULACIÓN
    // ------------------------------------------------------------------
    const simSlider = document.getElementById('sim-sat-slider');
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
        const rw = 1.0;

        // Constantes físicas
        const Vs = base.Vs;
        const Vt = base.Vt;
        const Gs = base.Gs;
        const Ws = base.Ws;

        if (!Vs || !Vt) return;

        // Recalcular a partir de S_sim fijo con Vs, Vt, Ws constantes
        const Vv = Vt - Vs;
        const Vw = S_sim * Vv;
        const Va = Vv - Vw;
        const Ww = Vw * rw;
        const Wt = (Ws !== null ? Ws : 0) + Ww;
        const w = (Ws && Ws !== 0) ? Ww / Ws : null;
        const e = (Vs !== 0) ? Vv / Vs : null;
        const n = (Vt !== 0) ? Vv / Vt : null;
        const rt = (Vt !== 0) ? Wt / Vt : null;
        const rd = (Ws && Vt) ? Ws / Vt : null;

        const simVars = { Vs, Vt, Vv, Vw, Va, Ws, Ww, Wt, Gs, S: S_sim, w, e, n, rt, rd, Wc: 0, Vc: 0 };

        // Mostrar resultados en panel
        const rows = [
            ['Vw (Vol. Agua)', Vw, 'cm³'],
            ['Va (Vol. Aire)', Va, 'cm³'],
            ['Ww (Peso Agua)', Ww, 'g'],
            ['Wt (Peso Total)', Wt, 'g'],
            ['w (Humedad)', w, ''],
            ['e (Rel. Vacíos)', e, ''],
            ['n (Porosidad)', n, ''],
            ['γt (Den. Total)', rt, 'g/cm³'],
            ['γd (Den. Seca)', rd, 'g/cm³'],
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

        // Redibujar gráficos con datos simulados
        document.dispatchEvent(new CustomEvent('soilDataUpdated', {
            detail: { vars: simVars, soilType: 'sim', isSimulation: true }
        }));
    });

    // ------------------------------------------------------------------
    // EVENTOS
    // ------------------------------------------------------------------
    function bindInputEvents() {
        const inputs = document.querySelectorAll('#data-inputs .form-control');
        inputs.forEach(input => {
            input.removeEventListener('input', handleManualInput);
            input.addEventListener('input', handleManualInput);
        });
    }

    function handleManualInput(e) {
        const target = e.target;
        // Solo marcamos el campo, NO calculamos automáticamente
        if (target.value !== '') {
            target.dataset.userValue = 'true';
        } else {
            target.dataset.userValue = 'false';
        }
    }

    // Inicializar inputs
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
    // EXPORTAR PDF — todas las secciones
    // ------------------------------------------------------------------
    exportBtn.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentW = pageW - margin * 2;
        let curY = margin;

        exportBtn.textContent = 'Generando PDF...';
        exportBtn.disabled = true;

        // Helper: añadir imagen de un elemento HTML al PDF
        async function addSectionToPDF(element, titleText) {
            if (!element || element.offsetHeight === 0) return;
            // Título de sección
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            if (curY + 10 > pageH - margin) { doc.addPage(); curY = margin; }
            doc.text(titleText, margin, curY);
            curY += 6;

            // Renderizar elemento a canvas
            try {
                const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const imgH = (canvas.height * contentW) / canvas.width;

                // Paginar si no cabe
                if (curY + imgH > pageH - margin) { doc.addPage(); curY = margin; }
                doc.addImage(imgData, 'PNG', margin, curY, contentW, imgH);
                curY += imgH + 6;
            } catch (err) {
                console.error('html2canvas error:', err);
            }
        }

        try {
            // Encabezado
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('Reporte de Mecánica de Suelos', margin, curY);
            curY += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, margin, curY);
            curY += 5;
            const tipoSuelo = soilTypeSelect.options[soilTypeSelect.selectedIndex].text;
            doc.text(`Tipo de Suelo: ${tipoSuelo}`, margin, curY);
            curY += 8;
            doc.setLineWidth(0.4);
            doc.line(margin, curY, pageW - margin, curY);
            curY += 5;

            // 1. Entrada de datos
            await addSectionToPDF(document.getElementById('panel-calc-mode'), '1. Entrada de Datos');

            // 2. Desarrollo matemático
            await addSectionToPDF(document.getElementById('procedure-content'), '2. Desarrollo Matemático');

            // 3. Cada gráfica individualmente
            const visualCards = document.querySelectorAll('.visual-card');
            let vi = 3;
            for (const card of visualCards) {
                const h3 = card.querySelector('h3');
                const title = h3 ? `${vi}. ${h3.textContent}` : `${vi}. Gráfica`;
                await addSectionToPDF(card, title);
                vi++;
            }

            doc.save('reporte_mecanica_suelos.pdf');
        } catch (err) {
            console.error(err);
            alert('Error al generar PDF');
        }

        exportBtn.textContent = 'Exportar PDF';
        exportBtn.disabled = false;
    });

});
