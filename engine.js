/**
 * Motor Matemático para Mecánica de Suelos
 * Implementa un solver iterativo estricto y multi-teórico basado en dependencias.
 */

class SoilEngine {
    constructor() {
        this.rw = 1.0; // Densidad del agua en g/cm3
        this.reset();
    }

    reset() {
        // Todas las variables posibles inicializadas explícitamente a null
        this.vars = {
            Gs: null, Wt: null, Ws: null, Ww: null, Wc: null,
            Vt: null, Vs: null, Vv: null, Vw: null, Va: null, Vc: null,
            e: null, n: null, S: null, w: null,
            rt: null, rd: null
        };
        // Registro de pasos para el desarrollo matemático
        this.steps = [];
        this.errors = [];
    }

    /**
     * Define los datos iniciales conocidos
     */
    setKnowns(knowns, soilType = 'partially_saturated', normalized = false) {
        this.reset();

        // Asignar conocidos y rechazar falsely de JS que no sean undefined o null
        for (const [key, value] of Object.entries(knowns)) {
            if (value !== null && value !== undefined && !isNaN(value)) {
                this.vars[key] = parseFloat(value);
            }
        }

        // Aplicar restricciones según el tipo de suelo
        if (soilType === 'saturated') {
            this.vars.Va = 0; // No hay aire
            this.vars.S = 1;  // Saturación al 100%
        } else if (soilType === 'dry') {
            this.vars.Vw = 0; // No hay agua
            this.vars.Ww = 0;
            this.vars.w = 0;
            this.vars.S = 0;
        }

        // Capa extra o no
        if (soilType !== 'extra_layer') {
            this.vars.Wc = 0;
            this.vars.Vc = 0;
        } else {
            if (this.vars.Wc === null || this.vars.Wc === undefined) this.vars.Wc = 0;
            if (this.vars.Vc === null || this.vars.Vc === undefined) this.vars.Vc = 0;
        }

        // Modo normalizado teórico
        if (normalized) {
            if (this.vars.Vs === null || this.vars.Vs === undefined) {
                this.vars.Vs = 1.0;
                this.addStep('Vs', 'Vs = 1', '1', 1, 'Por definición (Modo Normalizado)');
            }
        }
    }

    /**
     * Agrega un paso al registro procedimental
     */
    addStep(variable, formula, substitution, result, description = '') {
        this.steps.push({
            variable,
            formula,
            substitution,
            result: parseFloat(result.toFixed(4)),
            description
        });
        // Actualiza el diccionario de variables
        this.vars[variable] = parseFloat(result.toFixed(6));
    }

    /**
     * Motor principal iterativo de matriz cruzada
     */
    solve() {
        let changed = true;
        let iterCount = 0;
        const maxIter = 100; // Evitar ciclos

        while (changed && iterCount < maxIter) {
            changed = false;
            iterCount++;

            const v = this.vars;
            const rw = this.rw;

            // --- 1. PESOS Y VOLÚMENES FUNDAMENTALES (SUMAS Y RESTAS) ---

            // Wt = Ws + Ww + Wc
            if (v.Wt === null && v.Ws !== null && v.Ww !== null && v.Wc !== null) {
                this.addStep('Wt', 'W_t = W_s + W_w + W_c', `W_t = ${v.Ws} + ${v.Ww} + ${v.Wc}`, v.Ws + v.Ww + v.Wc, 'Peso total como suma de fases');
                changed = true;
            } else if (v.Ws === null && v.Wt !== null && v.Ww !== null && v.Wc !== null) {
                this.addStep('Ws', 'W_s = W_t - W_w - W_c', `W_s = ${v.Wt} - ${v.Ww} - ${v.Wc}`, v.Wt - v.Ww - v.Wc, 'Despeje de peso de sólidos');
                changed = true;
            } else if (v.Ww === null && v.Wt !== null && v.Ws !== null && v.Wc !== null) {
                this.addStep('Ww', 'W_w = W_t - W_s - W_c', `W_w = ${v.Wt} - ${v.Ws} - ${v.Wc}`, v.Wt - v.Ws - v.Wc, 'Despeje de peso de agua');
                changed = true;
            }

            // Vt = Vs + Vv + Vc
            if (v.Vt === null && v.Vs !== null && v.Vv !== null && v.Vc !== null) {
                this.addStep('Vt', 'V_t = V_s + V_v + V_c', `V_t = ${v.Vs} + ${v.Vv} + ${v.Vc}`, v.Vs + v.Vv + v.Vc, 'Volumen total');
                changed = true;
            } else if (v.Vs === null && v.Vt !== null && v.Vv !== null && v.Vc !== null) {
                this.addStep('Vs', 'V_s = V_t - V_v - V_c', `V_s = ${v.Vt} - ${v.Vv} - ${v.Vc}`, v.Vt - v.Vv - v.Vc, 'Despeje de volumen de sólidos');
                changed = true;
            } else if (v.Vv === null && v.Vt !== null && v.Vs !== null && v.Vc !== null) {
                this.addStep('Vv', 'V_v = V_t - V_s - V_c', `V_v = ${v.Vt} - ${v.Vs} - ${v.Vc}`, v.Vt - v.Vs - v.Vc, 'Despeje de volumen de vacíos');
                changed = true;
            }

            // Vv = Vw + Va
            if (v.Vv === null && v.Vw !== null && v.Va !== null) {
                this.addStep('Vv', 'V_v = V_w + V_a', `V_v = ${v.Vw} + ${v.Va}`, v.Vw + v.Va, 'Volumen de vacíos');
                changed = true;
            } else if (v.Vw === null && v.Vv !== null && v.Va !== null) {
                this.addStep('Vw', 'V_w = V_v - V_a', `V_w = ${v.Vv} - ${v.Va}`, v.Vv - v.Va, 'Despeje de volumen de agua');
                changed = true;
            } else if (v.Va === null && v.Vv !== null && v.Vw !== null) {
                this.addStep('Va', 'V_a = V_v - V_w', `V_a = ${v.Vv} - ${v.Vw}`, v.Vv - v.Vw, 'Despeje de volumen de aire');
                changed = true;
            }

            // Ww = Vw * rw
            if (v.Ww === null && v.Vw !== null && rw !== 0) {
                this.addStep('Ww', 'W_w = V_w \\cdot \\gamma_w', `W_w = ${v.Vw} \\cdot ${rw}`, v.Vw * rw, 'Peso del agua a partir de su volumen');
                changed = true;
            } else if (v.Vw === null && v.Ww !== null && rw !== 0) {
                this.addStep('Vw', 'V_w = \\frac{W_w}{\\gamma_w}', `V_w = \\frac{${v.Ww}}{${rw}}`, v.Ww / rw, 'Volumen de agua a partir de su peso');
                changed = true;
            }

            // --- 2. MULTI-ECUACIONES: RELACIÓN DE VACÍOS (e) ---
            if (v.e === null) {
                // e = Vv / Vs
                if (v.Vv !== null && v.Vs !== null && v.Vs !== 0) {
                    this.addStep('e', 'e = \\frac{V_v}{V_s}', `e = \\frac{${v.Vv}}{${v.Vs}}`, v.Vv / v.Vs, 'Relación de vacíos (Definición)');
                    changed = true;
                }
                // e = (Gs * rw / rd) - 1
                else if (v.Gs !== null && v.rd !== null && v.rd !== 0) {
                    this.addStep('e', 'e = \\frac{G_s \\cdot \\gamma_w}{\\gamma_d} - 1', `e = \\frac{${v.Gs} \\cdot ${rw}}{${v.rd}} - 1`, (v.Gs * rw / v.rd) - 1, 'Relación de vacíos teórica e');
                    changed = true;
                }
                // e = n / (1 - n)
                else if (v.n !== null && v.n !== 1) {
                    this.addStep('e', 'e = \\frac{n}{1 - n}', `e = \\frac{${v.n}}{1 - ${v.n}}`, v.n / (1 - v.n), 'Relación de vacíos desde porosidad');
                    changed = true;
                }
                // e = w * Gs / S
                else if (v.w !== null && v.Gs !== null && v.S !== null && v.S !== 0) {
                    this.addStep('e', 'e = \\frac{w \\cdot G_s}{S}', `e = \\frac{${v.w} \\cdot ${v.Gs}}{${v.S}}`, (v.w * v.Gs) / v.S, 'Relación de vacíos combinada');
                    changed = true;
                }
            } else {
                // Despejes desde e
                if (v.Vv === null && v.Vs !== null) {
                    this.addStep('Vv', 'V_v = e \\cdot V_s', `V_v = ${v.e} \\cdot ${v.Vs}`, v.e * v.Vs, 'Despeje volumen de vacíos desde e');
                    changed = true;
                }
                if (v.Vs === null && v.Vv !== null && v.e !== 0) {
                    this.addStep('Vs', 'V_s = \\frac{V_v}{e}', `V_s = \\frac{${v.Vv}}{${v.e}}`, v.Vv / v.e, 'Despeje volumen de sólidos desde e');
                    changed = true;
                }
            }

            // --- 3. MULTI-ECUACIONES: POROSIDAD (n) ---
            if (v.n === null) {
                // n = Vv / Vt
                if (v.Vv !== null && v.Vt !== null && v.Vt !== 0) {
                    this.addStep('n', 'n = \\frac{V_v}{V_t}', `n = \\frac{${v.Vv}}{${v.Vt}}`, v.Vv / v.Vt, 'Porosidad de la muestra');
                    changed = true;
                }
                // n = e / (1 + e)
                else if (v.e !== null && v.e !== -1) {
                    this.addStep('n', 'n = \\frac{e}{1 + e}', `n = \\frac{${v.e}}{1 + ${v.e}}`, v.e / (1 + v.e), 'Porosidad desde relación de vacíos');
                    changed = true;
                }
            } else {
                // Despejes desde n
                if (v.Vv === null && v.Vt !== null) {
                    this.addStep('Vv', 'V_v = n \\cdot V_t', `V_v = ${v.n} \\cdot ${v.Vt}`, v.n * v.Vt, 'Volumen de vacíos desde porosidad');
                    changed = true;
                }
                if (v.Vt === null && v.Vv !== null && v.n !== 0) {
                    this.addStep('Vt', 'V_t = \\frac{V_v}{n}', `V_t = \\frac{${v.Vv}}{${v.n}}`, v.Vv / v.n, 'Despeje volumen total desde porosidad');
                    changed = true;
                }
            }

            // --- 4. MULTI-ECUACIONES: SATURACIÓN (S) ---
            if (v.S === null) {
                // S = Vw / Vv
                if (v.Vw !== null && v.Vv !== null && v.Vv !== 0) {
                    this.addStep('S', 'S = \\frac{V_w}{V_v}', `S = \\frac{${v.Vw}}{${v.Vv}}`, v.Vw / v.Vv, 'Grado de saturación');
                    changed = true;
                }
                // S = w * Gs / e
                else if (v.w !== null && v.Gs !== null && v.e !== null && v.e !== 0) {
                    this.addStep('S', 'S = \\frac{w \\cdot G_s}{e}', `S = \\frac{${v.w} \\cdot ${v.Gs}}{${v.e}}`, (v.w * v.Gs) / v.e, 'Saturación usando relación de estado (wGs=Se)');
                    changed = true;
                }
            } else {
                if (v.Vw === null && v.Vv !== null) {
                    this.addStep('Vw', 'V_w = S \\cdot V_v', `V_w = ${v.S} \\cdot ${v.Vv}`, v.S * v.Vv, 'Despeje volumen de agua desde S');
                    changed = true;
                }
                if (v.Vv === null && v.Vw !== null && v.S !== 0) {
                    this.addStep('Vv', 'V_v = \\frac{V_w}{S}', `V_v = \\frac{${v.Vw}}{${v.S}}`, v.Vw / v.S, 'Despeje volumen de vacíos desde S');
                    changed = true;
                }
            }

            // --- 5. MULTI-ECUACIONES: DENSIDAD SECA (rd) ---
            if (v.rd === null) {
                // rd = Ws / Vt
                if (v.Ws !== null && v.Vt !== null && v.Vt !== 0) {
                    this.addStep('rd', '\\gamma_d = \\frac{W_s}{V_t}', `\\gamma_d = \\frac{${v.Ws}}{${v.Vt}}`, v.Ws / v.Vt, 'Densidad seca (Definición)');
                    changed = true;
                }
                // rd = Gs * rw / (1 + e)
                else if (v.Gs !== null && v.e !== null && v.e !== -1) {
                    this.addStep('rd', '\\gamma_d = \\frac{G_s \\cdot \\gamma_w}{1 + e}', `\\gamma_d = \\frac{${v.Gs} \\cdot ${rw}}{1 + ${v.e}}`, (v.Gs * rw) / (1 + v.e), 'Densidad seca teórica a partir de e');
                    changed = true;
                }
                // rd = rt / (1 + w)
                else if (v.rt !== null && v.w !== null && v.w !== -1) {
                    this.addStep('rd', '\\gamma_d = \\frac{\\gamma_t}{1 + w}', `\\gamma_d = \\frac{${v.rt}}{1 + ${v.w}}`, v.rt / (1 + v.w), 'Densidad seca respecto a densidad húmeda');
                    changed = true;
                }
            } else {
                if (v.Ws === null && v.Vt !== null) {
                    this.addStep('Ws', 'W_s = \\gamma_d \\cdot V_t', `W_s = ${v.rd} \\cdot ${v.Vt}`, v.rd * v.Vt, 'Despeje de sólidos desde densidad seca');
                    changed = true;
                }
            }

            // --- 6. MULTI-ECUACIONES: DENSIDAD TOTAL (rt) ---
            if (v.rt === null) {
                // rt = Wt / Vt
                if (v.Wt !== null && v.Vt !== null && v.Vt !== 0) {
                    this.addStep('rt', '\\gamma_t = \\frac{W_t}{V_t}', `\\gamma_t = \\frac{${v.Wt}}{${v.Vt}}`, v.Wt / v.Vt, 'Densidad húmeda total');
                    changed = true;
                }
                // rt = (1 + w) * Gs * rw / (1 + e)
                else if (v.w !== null && v.Gs !== null && v.e !== null && v.e !== -1) {
                    this.addStep('rt', '\\gamma_t = \\frac{(1 + w) \\cdot G_s \\cdot \\gamma_w}{1 + e}', `\\gamma_t = \\frac{(1 + ${v.w}) \\cdot ${v.Gs} \\cdot ${rw}}{1 + ${v.e}}`, ((1 + v.w) * v.Gs * rw) / (1 + v.e), 'Densidad total teórica');
                    changed = true;
                }
                // rt = rd * (1 + w)
                else if (v.rd !== null && v.w !== null) {
                    this.addStep('rt', '\\gamma_t = \\gamma_d \\cdot (1 + w)', `\\gamma_t = ${v.rd} \\cdot (1 + ${v.w})`, v.rd * (1 + v.w), 'Densidad total desde seca y humedad');
                    changed = true;
                }
            } else {
                if (v.Wt === null && v.Vt !== null) {
                    this.addStep('Wt', 'W_t = \\gamma_t \\cdot V_t', `W_t = ${v.rt} \\cdot ${v.Vt}`, v.rt * v.Vt, 'Despeje peso total desde densidad');
                    changed = true;
                }
                if (v.Vt === null && v.Wt !== null && v.rt !== 0) {
                    this.addStep('Vt', 'V_t = \\frac{W_t}{\\gamma_t}', `V_t = \\frac{${v.Wt}}{${v.rt}}`, v.Wt / v.rt, 'Despeje volumen total desde densidad');
                    changed = true;
                }
            }

            // --- 7. DEPENDENCIAS CRUZADAS VARIAS ---

            // Gravedad Específica Gs = Ws / (Vs * rw)
            if (v.Gs === null && v.Ws !== null && v.Vs !== null && v.Vs !== 0 && rw !== 0) {
                this.addStep('Gs', 'G_s = \\frac{W_s}{V_s \\cdot \\gamma_w}', `G_s = \\frac{${v.Ws}}{${v.Vs} \\cdot ${rw}}`, v.Ws / (v.Vs * rw), 'Gravedad específica calculada');
                changed = true;
            } else if (v.Ws === null && v.Gs !== null && v.Vs !== null) {
                this.addStep('Ws', 'W_s = G_s \\cdot V_s \\cdot \\gamma_w', `W_s = ${v.Gs} \\cdot ${v.Vs} \\cdot ${rw}`, v.Gs * v.Vs * rw, 'Peso de sólidos a partir de Gravedad Específica');
                changed = true;
            } else if (v.Vs === null && v.Gs !== null && v.Ws !== null && v.Gs !== 0 && rw !== 0) {
                this.addStep('Vs', 'V_s = \\frac{W_s}{G_s \\cdot \\gamma_w}', `V_s = \\frac{${v.Ws}}{${v.Gs} \\cdot ${rw}}`, v.Ws / (v.Gs * rw), 'Volumen de sólidos a partir de Gravedad Específica');
                changed = true;
            }

            // Humedad w = Ww / Ws
            if (v.w === null && v.Ww !== null && v.Ws !== null && v.Ws !== 0) {
                this.addStep('w', 'w = \\frac{W_w}{W_s}', `w = \\frac{${v.Ww}}{${v.Ws}}`, v.Ww / v.Ws, 'Contenido de humedad gravimétrico');
                changed = true;
            } else if (v.Ww === null && v.w !== null && v.Ws !== null) {
                this.addStep('Ww', 'W_w = w \\cdot W_s', `W_w = ${v.w} \\cdot ${v.Ws}`, v.w * v.Ws, 'Despeje de peso de agua desde w');
                changed = true;
            } else if (v.Ws === null && v.w !== null && v.Ww !== null && v.w !== 0) {
                this.addStep('Ws', 'W_s = \\frac{W_w}{w}', `W_s = \\frac{${v.Ww}}{${v.w}}`, v.Ww / v.w, 'Despeje peso sólido desde w');
                changed = true;
            }

            // Despejes combinados e y Vt para Vs (Vt = Vs(1+e))
            if (v.Vs === null && v.Vt !== null && v.e !== null && v.e !== -1) {
                this.addStep('Vs', 'V_s = \\frac{V_t}{1 + e}', `V_s = \\frac{${v.Vt}}{1 + ${v.e}}`, v.Vt / (1 + v.e), 'Volumen de sólidos desde volumen total y vacíos');
                changed = true;
            }

            // Despejes combinados n y Vt para Vs (Vs = Vt(1-n))
            if (v.Vs === null && v.Vt !== null && v.n !== null) {
                this.addStep('Vs', 'V_s = V_t \\cdot (1 - n)', `V_s = ${v.Vt} \\cdot (1 - ${v.n})`, v.Vt * (1 - v.n), 'Volumen sólido restante desde porosidad');
                changed = true;
            }

            // Despejes combinados Ws desde Wt y w (Wt = Ws(1+w) si Wc = 0)
            let pesoSueloNeto = v.Wt;
            if (v.Wt !== null && v.Wc !== null) pesoSueloNeto = v.Wt - v.Wc;
            if (v.Ws === null && v.Wt !== null && v.w !== null && v.Wc !== null && v.w !== -1) {
                this.addStep('Ws', 'W_s = \\frac{W_t - W_c}{1 + w}', `W_s = \\frac{${pesoSueloNeto}}{1 + ${v.w}}`, pesoSueloNeto / (1 + v.w), 'Peso sólido deducido de peso total y humedad');
                changed = true;
            }
        }

        this.validatePhysics();
        return {
            vars: this.vars,
            steps: this.steps,
            errors: this.errors
        };
    }

    /**
     * Valida la consistencia de los resultados físicos obtenidos
     */
    validatePhysics() {
        this.errors = [];
        const v = this.vars;

        if (v.S !== null && (v.S < -0.01 || v.S > 1.01)) {
            this.errors.push(`El grado de saturación (S=${(v.S * 100).toFixed(1)}%) supera los límites físicos de 0 a 100%. Verifique sus datos.`);
        }
        if (v.n !== null && (v.n < -0.01 || v.n >= 1.00)) {
            this.errors.push(`La porosidad (n=${(v.n * 100).toFixed(1)}%) debe estar entre 0 y 100%. Un valor de 1 (vacío total) o mayor es irreal.`);
        }
        if (v.e !== null && v.e < 0) {
            this.errors.push(`La relación de vacíos (e=${v.e.toFixed(3)}) no puede ser negativa.`);
        }

        // Se valida el rango común de Gravedad Específica de sólidos.
        if (v.Gs !== null && (v.Gs < 1.0 || v.Gs > 4.0)) {
            this.errors.push(`El valor de Gs (${v.Gs.toFixed(2)}) está fuera del rango común para suelos (índices típicos entre 2.2 y 3.2). El modelo puede deformarse.`);
        }

        // Validación de no negatividad para masas y volúmenes
        const massVars = ['Wt', 'Ws', 'Ww', 'Wc', 'Vt', 'Vs', 'Vv', 'Vw', 'Va', 'Vc'];
        massVars.forEach(key => {
            if (v[key] !== null && v[key] < -0.0001) { // Pequeña tolerancia de error en flotantes (KaTeX / ThreeJS)
                this.errors.push(`El valor de ${key} (${v[key].toFixed(2)}) es negativo, lo cual es físicamente imposible.`);
            }
        });

        // Validación de denominador 0 lógico
        if (v.Vt !== null && v.Vt === 0) {
            this.errors.push(`El Volumen Total no puede ser 0.`);
        }
        if (v.Vs !== null && v.Vs === 0) {
            this.errors.push(`El Volumen de Sólidos no puede ser 0 en Mecánica de Suelos.`);
        }
    }
}

// Exponer en Window para modo Vanilla JS
if (typeof window !== 'undefined') {
    window.SoilEngine = SoilEngine;
}
