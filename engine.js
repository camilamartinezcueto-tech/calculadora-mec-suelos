/**
 * Motor Matemático para Mecánica de Suelos
 * v4: Fase extra (Capa) completamente independiente.
 *     Vt = Vs + Vv + Vc  (Vc externo al suelo)
 *     Wt = Ws + Ww + Wc
 *     Las relaciones internas del suelo (e, n, S) SOLO involucran Vs, Vw, Va.
 *     La porosidad n = Vv / (Vs + Vv)  — NO incluye Vc.
 */

class SoilEngine {
    constructor() {
        // γw base en g/cm³; se ajusta desde fuera según unidad elegida
        this.rw = 1.0;
        this.reset();
    }

    reset() {
        this.vars = {
            Gs: null, Wt: null, Ws: null, Ww: null, Wc: null,
            Vt: null, Vs: null, Vv: null, Vw: null, Va: null, Vc: null,
            e: null, n: null, S: null, w: null,
            rt: null, rd: null
        };
        this.steps  = [];
        this.errors = [];
    }

    setKnowns(knowns, soilType = 'partially_saturated', normalized = false) {
        this.reset();

        for (const [key, value] of Object.entries(knowns)) {
            if (value !== null && value !== undefined && !isNaN(value)) {
                this.vars[key] = parseFloat(value);
            }
        }

        // Restricciones por tipo de suelo
        if (soilType === 'saturated') {
            this.vars.Va = 0;
            this.vars.S  = 1;
        } else if (soilType === 'dry') {
            this.vars.Vw = 0;
            this.vars.Ww = 0;
            this.vars.w  = 0;
            this.vars.S  = 0;
        }

        this.soilType = soilType;

        // Capa extra: si NO es extra_layer, fijar Wc=0 y Vc=0
        if (soilType !== 'extra_layer') {
            this.vars.Wc = 0;
            this.vars.Vc = 0;
        }
        // Si es extra_layer, NO forzar a 0. Pueden ser calculados como incógnitas.

        if (normalized) {
            if (this.vars.Vs === null || this.vars.Vs === undefined) {
                this.vars.Vs = 1.0;
                this.addStep('Vs', 'V_s = 1', '1', 1, 'Por definición (Modo Normalizado)');
            }
        }
    }

    addStep(variable, formula, substitution, result, description = '') {
        this.steps.push({
            variable, formula, substitution,
            result: parseFloat(result.toFixed(4)),
            description
        });
        this.vars[variable] = parseFloat(result.toFixed(6));
    }

    solve() {
        let changed = true;
        let iterCount = 0;
        const maxIter = 100;

        while (changed && iterCount < maxIter) {
            changed = false;
            iterCount++;

            const v   = this.vars;
            const rw  = this.rw;

            // ==============================================================
            // 1. PESOS TOTALES Y FUNDAMENTALES
            // ==============================================================

            // Wt = Ws + Ww + Wc
            if (v.Wt === null && v.Ws !== null && v.Ww !== null && v.Wc !== null) {
                this.addStep('Wt', 'W_t = W_s + W_w + W_c',
                    `W_t = ${v.Ws} + ${v.Ww} + ${v.Wc}`,
                    v.Ws + v.Ww + v.Wc, 'Peso total (sólidos + agua + capa extra)');
                changed = true;
            } else if (v.Ws === null && v.Wt !== null && v.Ww !== null && v.Wc !== null) {
                this.addStep('Ws', 'W_s = W_t - W_w - W_c',
                    `W_s = ${v.Wt} - ${v.Ww} - ${v.Wc}`,
                    v.Wt - v.Ww - v.Wc, 'Despeje peso de sólidos');
                changed = true;
            } else if (v.Ww === null && v.Wt !== null && v.Ws !== null && v.Wc !== null) {
                this.addStep('Ww', 'W_w = W_t - W_s - W_c',
                    `W_w = ${v.Wt} - ${v.Ws} - ${v.Wc}`,
                    v.Wt - v.Ws - v.Wc, 'Despeje peso de agua');
                changed = true;
            }

            // ==============================================================
            // 2. VOLÚMENES — La capa extra es EXTERNA al sistema de vacíos
            //    Vt = Vs + Vv + Vc
            //    Vv = Vw + Va  (interna del suelo, sin Vc)
            // ==============================================================

            // Vv = Vw + Va
            if (v.Vv === null && v.Vw !== null && v.Va !== null) {
                this.addStep('Vv', 'V_v = V_w + V_a',
                    `V_v = ${v.Vw} + ${v.Va}`,
                    v.Vw + v.Va, 'Volumen de vacíos del suelo (agua + aire)');
                changed = true;
            } else if (v.Vw === null && v.Vv !== null && v.Va !== null) {
                this.addStep('Vw', 'V_w = V_v - V_a',
                    `V_w = ${v.Vv} - ${v.Va}`,
                    v.Vv - v.Va, 'Despeje volumen de agua');
                changed = true;
            } else if (v.Va === null && v.Vv !== null && v.Vw !== null) {
                this.addStep('Va', 'V_a = V_v - V_w',
                    `V_a = ${v.Vv} - ${v.Vw}`,
                    v.Vv - v.Vw, 'Despeje volumen de aire');
                changed = true;
            }

            // Vt = Vs + Vv + Vc
            if (v.Vt === null && v.Vs !== null && v.Vv !== null && v.Vc !== null) {
                this.addStep('Vt', 'V_t = V_s + V_v + V_c',
                    `V_t = ${v.Vs} + ${v.Vv} + ${v.Vc}`,
                    v.Vs + v.Vv + v.Vc, 'Volumen total del sistema');
                changed = true;
            } else if (v.Vs === null && v.Vt !== null && v.Vv !== null && v.Vc !== null) {
                this.addStep('Vs', 'V_s = V_t - V_v - V_c',
                    `V_s = ${v.Vt} - ${v.Vv} - ${v.Vc}`,
                    v.Vt - v.Vv - v.Vc, 'Despeje volumen de sólidos');
                changed = true;
            } else if (v.Vv === null && v.Vt !== null && v.Vs !== null && v.Vc !== null) {
                this.addStep('Vv', 'V_v = V_t - V_s - V_c',
                    `V_v = ${v.Vt} - ${v.Vs} - ${v.Vc}`,
                    v.Vt - v.Vs - v.Vc, 'Despeje volumen de vacíos desde Vt');
                changed = true;
            }

            // Ww = Vw * γw  (relación agua)
            if (v.Ww === null && v.Vw !== null && rw !== 0) {
                this.addStep('Ww', 'W_w = V_w \\cdot \\gamma_w',
                    `W_w = ${v.Vw} \\cdot ${rw}`,
                    v.Vw * rw, 'Peso del agua a partir de su volumen');
                changed = true;
            } else if (v.Vw === null && v.Ww !== null && rw !== 0) {
                this.addStep('Vw', 'V_w = \\frac{W_w}{\\gamma_w}',
                    `V_w = \\frac{${v.Ww}}{${rw}}`,
                    v.Ww / rw, 'Volumen de agua a partir de su peso');
                changed = true;
            }

            // ==============================================================
            // 3. RELACIÓN DE VACÍOS (e) — solo suelo, sin Vc
            // ==============================================================
            if (v.e === null) {
                if (v.Vv !== null && v.Vs !== null && v.Vs !== 0) {
                    this.addStep('e', 'e = \\frac{V_v}{V_s}',
                        `e = \\frac{${v.Vv}}{${v.Vs}}`,
                        v.Vv / v.Vs, 'Relación de vacíos (fases del suelo)');
                    changed = true;
                } else if (v.Gs !== null && v.rd !== null && v.rd !== 0) {
                    this.addStep('e', 'e = \\frac{G_s \\cdot \\gamma_w}{\\gamma_d} - 1',
                        `e = \\frac{${v.Gs} \\cdot ${rw}}{${v.rd}} - 1`,
                        (v.Gs * rw / v.rd) - 1, 'Relación de vacíos teórica');
                    changed = true;
                } else if (v.n !== null && v.n !== 1) {
                    this.addStep('e', 'e = \\frac{n}{1 - n}',
                        `e = \\frac{${v.n}}{1 - ${v.n}}`,
                        v.n / (1 - v.n), 'Relación de vacíos desde porosidad');
                    changed = true;
                } else if (v.w !== null && v.Gs !== null && v.S !== null && v.S !== 0) {
                    this.addStep('e', 'e = \\frac{w \\cdot G_s}{S}',
                        `e = \\frac{${v.w} \\cdot ${v.Gs}}{${v.S}}`,
                        (v.w * v.Gs) / v.S, 'Relación de vacíos combinada (S·e = w·Gs)');
                    changed = true;
                }
            } else {
                if (v.Vv === null && v.Vs !== null) {
                    this.addStep('Vv', 'V_v = e \\cdot V_s',
                        `V_v = ${v.e} \\cdot ${v.Vs}`,
                        v.e * v.Vs, 'Volumen de vacíos desde e');
                    changed = true;
                }
                if (v.Vs === null && v.Vv !== null && v.e !== 0) {
                    this.addStep('Vs', 'V_s = \\frac{V_v}{e}',
                        `V_s = \\frac{${v.Vv}}{${v.e}}`,
                        v.Vv / v.e, 'Volumen sólido desde e');
                    changed = true;
                }
            }

            // ==============================================================
            // 4. POROSIDAD (n) — solo sobre Vs + Vv (suelo), NO incluye Vc
            //    n = Vv / (Vs + Vv)  ≡  Vv / Vsuelo
            // ==============================================================
            if (v.n === null) {
                // Usando volumen del suelo = Vs + Vv
                if (v.Vv !== null && v.Vs !== null) {
                    const Vsuelo = v.Vs + v.Vv;
                    if (Vsuelo > 0) {
                        this.addStep('n', 'n = \\frac{V_v}{V_s + V_v}',
                            `n = \\frac{${v.Vv}}{${v.Vs} + ${v.Vv}}`,
                            v.Vv / Vsuelo, 'Porosidad del suelo (sin capa extra)');
                        changed = true;
                    }
                } else if (v.e !== null && v.e !== -1) {
                    this.addStep('n', 'n = \\frac{e}{1 + e}',
                        `n = \\frac{${v.e}}{1 + ${v.e}}`,
                        v.e / (1 + v.e), 'Porosidad desde relación de vacíos');
                    changed = true;
                }
            } else {
                // Despejes desde n: n = Vv/(Vs+Vv)  →  Vv = n*Vs/(1-n)
                if (v.Vv === null && v.Vs !== null && v.n !== 1) {
                    this.addStep('Vv', 'V_v = \\frac{n \\cdot V_s}{1 - n}',
                        `V_v = \\frac{${v.n} \\cdot ${v.Vs}}{1 - ${v.n}}`,
                        (v.n * v.Vs) / (1 - v.n), 'Volumen de vacíos desde n y Vs');
                    changed = true;
                }
            }

            // ==============================================================
            // 5. SATURACIÓN (S) — solo suelo interno
            // ==============================================================
            if (v.S === null) {
                if (v.Vw !== null && v.Vv !== null && v.Vv !== 0) {
                    this.addStep('S', 'S = \\frac{V_w}{V_v}',
                        `S = \\frac{${v.Vw}}{${v.Vv}}`,
                        v.Vw / v.Vv, 'Grado de saturación');
                    changed = true;
                } else if (v.w !== null && v.Gs !== null && v.e !== null && v.e !== 0) {
                    this.addStep('S', 'S = \\frac{w \\cdot G_s}{e}',
                        `S = \\frac{${v.w} \\cdot ${v.Gs}}{${v.e}}`,
                        (v.w * v.Gs) / v.e, 'Saturación (S·e = w·Gs)');
                    changed = true;
                }
            } else {
                if (v.Vw === null && v.Vv !== null) {
                    this.addStep('Vw', 'V_w = S \\cdot V_v',
                        `V_w = ${v.S} \\cdot ${v.Vv}`,
                        v.S * v.Vv, 'Volumen de agua desde S');
                    changed = true;
                }
                if (v.Vv === null && v.Vw !== null && v.S !== 0) {
                    this.addStep('Vv', 'V_v = \\frac{V_w}{S}',
                        `V_v = \\frac{${v.Vw}}{${v.S}}`,
                        v.Vw / v.S, 'Volumen de vacíos desde S');
                    changed = true;
                }
            }

            // ==============================================================
            // 6. DENSIDAD SECA (γd) — basada en suelo solo (Ws/Vt_suelo)
            //    Si hay Vc, el Vt del suelo es Vs + Vv
            // ==============================================================
            if (v.rd === null) {
                if (v.Ws !== null && v.Vs !== null && v.Vv !== null) {
                    const Vsuelo = v.Vs + v.Vv;
                    if (Vsuelo > 0) {
                        this.addStep('rd', '\\gamma_d = \\frac{W_s}{V_s + V_v}',
                            `\\gamma_d = \\frac{${v.Ws}}{${v.Vs} + ${v.Vv}}`,
                            v.Ws / Vsuelo, 'Densidad seca del suelo');
                        changed = true;
                    }
                } else if (v.Gs !== null && v.e !== null && v.e !== -1) {
                    this.addStep('rd', '\\gamma_d = \\frac{G_s \\cdot \\gamma_w}{1 + e}',
                        `\\gamma_d = \\frac{${v.Gs} \\cdot ${rw}}{1 + ${v.e}}`,
                        (v.Gs * rw) / (1 + v.e), 'Densidad seca teórica');
                    changed = true;
                } else if (this.soilType !== 'extra_layer' && v.rt !== null && v.w !== null && v.w !== -1) {
                    this.addStep('rd', '\\gamma_d = \\frac{\\gamma_t}{1 + w}',
                        `\\gamma_d = \\frac{${v.rt}}{1 + ${v.w}}`,
                        v.rt / (1 + v.w), 'Densidad seca desde húmeda (sin capa extra)');
                    changed = true;
                }
            } else {
                if (v.Ws === null && v.Vs !== null && v.Vv !== null) {
                    const Vsuelo = v.Vs + v.Vv;
                    this.addStep('Ws', 'W_s = \\gamma_d \\cdot (V_s + V_v)',
                        `W_s = ${v.rd} \\cdot ${Vsuelo}`,
                        v.rd * Vsuelo, 'Peso sólido desde densidad seca');
                    changed = true;
                }
            }

            // ==============================================================
            // 7. DENSIDAD TOTAL (γt) — Wt / Vt del sistema completo
            // ==============================================================
            if (v.rt === null) {
                if (v.Wt !== null && v.Vt !== null && v.Vt !== 0) {
                    this.addStep('rt', '\\gamma_t = \\frac{W_t}{V_t}',
                        `\\gamma_t = \\frac{${v.Wt}}{${v.Vt}}`,
                        v.Wt / v.Vt, 'Densidad total del sistema');
                    changed = true;
                } else if (this.soilType !== 'extra_layer' && v.w !== null && v.Gs !== null && v.e !== null && v.e !== -1) {
                    this.addStep('rt', '\\gamma_t = \\frac{(1 + w) \\cdot G_s \\cdot \\gamma_w}{1 + e}',
                        `\\gamma_t = \\frac{(1 + ${v.w}) \\cdot ${v.Gs} \\cdot ${rw}}{1 + ${v.e}}`,
                        ((1 + v.w) * v.Gs * rw) / (1 + v.e), 'Densidad total teórica (sin capa extra)');
                    changed = true;
                } else if (this.soilType !== 'extra_layer' && v.rd !== null && v.w !== null) {
                    this.addStep('rt', '\\gamma_t = \\gamma_d \\cdot (1 + w)',
                        `\\gamma_t = ${v.rd} \\cdot (1 + ${v.w})`,
                        v.rd * (1 + v.w), 'Densidad total desde seca y humedad (sin capa extra)');
                    changed = true;
                }
            } else {
                if (v.Wt === null && v.Vt !== null) {
                    this.addStep('Wt', 'W_t = \\gamma_t \\cdot V_t',
                        `W_t = ${v.rt} \\cdot ${v.Vt}`,
                        v.rt * v.Vt, 'Peso total desde densidad');
                    changed = true;
                }
                if (v.Vt === null && v.Wt !== null && v.rt !== 0) {
                    this.addStep('Vt', 'V_t = \\frac{W_t}{\\gamma_t}',
                        `V_t = \\frac{${v.Wt}}{${v.rt}}`,
                        v.Wt / v.rt, 'Volumen total desde densidad');
                    changed = true;
                }
            }

            // ==============================================================
            // 8. GRAVEDAD ESPECÍFICA (Gs)
            // ==============================================================
            if (v.Gs === null && v.Ws !== null && v.Vs !== null && v.Vs !== 0 && rw !== 0) {
                this.addStep('Gs', 'G_s = \\frac{W_s}{V_s \\cdot \\gamma_w}',
                    `G_s = \\frac{${v.Ws}}{${v.Vs} \\cdot ${rw}}`,
                    v.Ws / (v.Vs * rw), 'Gravedad específica');
                changed = true;
            } else if (v.Ws === null && v.Gs !== null && v.Vs !== null) {
                this.addStep('Ws', 'W_s = G_s \\cdot V_s \\cdot \\gamma_w',
                    `W_s = ${v.Gs} \\cdot ${v.Vs} \\cdot ${rw}`,
                    v.Gs * v.Vs * rw, 'Peso sólido desde Gs');
                changed = true;
            } else if (v.Vs === null && v.Gs !== null && v.Ws !== null && v.Gs !== 0 && rw !== 0) {
                this.addStep('Vs', 'V_s = \\frac{W_s}{G_s \\cdot \\gamma_w}',
                    `V_s = \\frac{${v.Ws}}{${v.Gs} \\cdot ${rw}}`,
                    v.Ws / (v.Gs * rw), 'Volumen sólido desde Gs');
                changed = true;
            }

            // ==============================================================
            // 9. HUMEDAD (w)
            // ==============================================================
            if (v.w === null && v.Ww !== null && v.Ws !== null && v.Ws !== 0) {
                this.addStep('w', 'w = \\frac{W_w}{W_s}',
                    `w = \\frac{${v.Ww}}{${v.Ws}}`,
                    v.Ww / v.Ws, 'Contenido de humedad gravimétrico');
                changed = true;
            } else if (v.Ww === null && v.w !== null && v.Ws !== null) {
                this.addStep('Ww', 'W_w = w \\cdot W_s',
                    `W_w = ${v.w} \\cdot ${v.Ws}`,
                    v.w * v.Ws, 'Peso de agua desde w');
                changed = true;
            } else if (v.Ws === null && v.w !== null && v.Ww !== null && v.w !== 0) {
                this.addStep('Ws', 'W_s = \\frac{W_w}{w}',
                    `W_s = \\frac{${v.Ww}}{${v.w}}`,
                    v.Ww / v.w, 'Peso sólido desde w');
                changed = true;
            }

            // ==============================================================
            // 10. COMBINACIONES ADICIONALES
            // ==============================================================

            // Vs desde Vt, e  (Vt del suelo = Vs+Vv = Vs(1+e); Vt_sistema = Vt_suelo + Vc)
            if (v.Vs === null && v.Vt !== null && v.Vc !== null && v.e !== null && v.e !== -1) {
                const Vsuelo = v.Vt - v.Vc;
                if (Vsuelo > 0) {
                    this.addStep('Vs', 'V_s = \\frac{V_t - V_c}{1 + e}',
                        `V_s = \\frac{${v.Vt} - ${v.Vc}}{1 + ${v.e}}`,
                        Vsuelo / (1 + v.e), 'Volumen sólido desde Vt, Vc y e');
                    changed = true;
                }
            }

            // Ws desde (Wt - Wc) y w
            if (v.Ws === null && v.Wt !== null && v.w !== null && v.Wc !== null && v.w !== -1) {
                const pesoSuelo = v.Wt - v.Wc;
                if (pesoSuelo >= 0) {
                    this.addStep('Ws', 'W_s = \\frac{W_t - W_c}{1 + w}',
                        `W_s = \\frac{${v.Wt} - ${v.Wc}}{1 + ${v.w}}`,
                        pesoSuelo / (1 + v.w), 'Peso sólido desde peso total y humedad');
                    changed = true;
                }
            }
        }

        this.validatePhysics();
        return { vars: this.vars, steps: this.steps, errors: this.errors };
    }

    validatePhysics() {
        this.errors = [];
        const v = this.vars;

        if (v.S !== null && (v.S < -0.01 || v.S > 1.01))
            this.errors.push(`El grado de saturación (S=${(v.S * 100).toFixed(1)}%) supera los límites físicos (0–100%). Verifique sus datos.`);

        if (v.n !== null && (v.n < -0.01 || v.n >= 1.00))
            this.errors.push(`La porosidad (n=${(v.n * 100).toFixed(1)}%) debe estar entre 0 y 100%.`);

        if (v.e !== null && v.e < 0)
            this.errors.push(`La relación de vacíos (e=${v.e.toFixed(3)}) no puede ser negativa.`);

        if (v.Gs !== null && (v.Gs < 1.0 || v.Gs > 4.0))
            this.errors.push(`Gs (${v.Gs.toFixed(2)}) está fuera del rango típico (1.0–4.0). Verifique sus datos.`);

        ['Wt', 'Ws', 'Ww', 'Wc', 'Vt', 'Vs', 'Vv', 'Vw', 'Va', 'Vc'].forEach(key => {
            if (v[key] !== null && v[key] < -0.0001)
                this.errors.push(`El valor de ${key} (${v[key].toFixed(4)}) es negativo, lo cual es físicamente imposible.`);
        });

        if (v.Vt !== null && v.Vt === 0)
            this.errors.push('El Volumen Total no puede ser 0.');

        if (v.Vs !== null && v.Vs === 0)
            this.errors.push('El Volumen de Sólidos no puede ser 0 en Mecánica de Suelos.');
    }
}

if (typeof window !== 'undefined') window.SoilEngine = SoilEngine;
