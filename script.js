document.addEventListener('DOMContentLoaded', () => {
    // Verificar que las librerías se han cargado
    if (typeof Vex === 'undefined' || typeof Tone === 'undefined') {
        console.error('Error: Las librerías VexFlow o Tone.js no se han cargado correctamente.');
        document.getElementById('app').innerHTML = '<p style="color: red;">Error al cargar las librerías. Por favor, revisa la consola.</p>';
        return;
    }
    console.log('VexFlow y Tone.js cargados correctamente.');

    const VF = Vex.Flow;

    const utils = {
        // Convierte un nombre de nota de Tone.js (ej: "C4") a formato VexFlow (ej: "c/4")
        toVexFlowFormat(noteName) {
            return noteName.slice(0, 1).toLowerCase() + "/" + noteName.slice(1);
        }
    };

    // --- Lógica de Pestañas (Tabs) ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const modeContainers = document.querySelectorAll('.mode-container');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Desactivar todos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            modeContainers.forEach(container => container.classList.remove('active'));

            // Activar el seleccionado
            button.classList.add('active');
            const mode = button.getAttribute('data-mode');
            document.getElementById(mode).classList.add('active');
        });
    });

    // --- MODO 1: ENTRENAMIENTO AUDITIVO ---
    const mode1 = {
        stave: null,
        renderer: null,
        ctx: null,
        currentClef: 'treble',
        currentNote: null,
        synth: new Tone.PolySynth(Tone.Synth).toDestination(),

        init() {
            const container = document.getElementById('staff-container-m1');
            container.addEventListener('click', (e) => this.handleStaffClick(e));
            this.renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
            this.renderer.resize(600, 150);
            this.ctx = this.renderer.getContext();
            this.drawStaff();

            // Event Listeners
            document.getElementById('play-random-note-btn').addEventListener('click', () => this.playRandomNote());
            document.getElementById('repeat-note-btn').addEventListener('click', () => this.repeatNote());
            document.getElementById('play-major-chord-btn').addEventListener('click', () => this.playMajorChord());

            document.querySelectorAll('input[name="clef-m1"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.currentClef = e.target.value;
                    this.drawStaff(); // Redibujar el pentagrama con la nueva clave
                });
            });
        },

        drawStaff(notes = []) {
            this.ctx.clear();
            this.stave = new VF.Stave(10, 20, 580);
            this.stave.addClef(this.currentClef).addTimeSignature('4/4');
            this.stave.setContext(this.ctx).draw();

            if (notes.length > 0) {
                VF.Formatter.formatAndDraw(this.ctx, this.stave, notes);
            }
        },

        getAllowedNotes() {
            const checkboxes = document.querySelectorAll('input[name="notes-m1"]:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        },

        async playRandomNote() {
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            const allowedNotes = this.getAllowedNotes();
            if (allowedNotes.length === 0) {
                alert('Por favor, selecciona al menos una nota.');
                return;
            }
            this.drawStaff(); // Limpiar notas de feedback anteriores
            const randomIndex = Math.floor(Math.random() * allowedNotes.length);
            this.currentNote = allowedNotes[randomIndex];
            console.log('Nota a adivinar:', this.currentNote);
            this.synth.triggerAttackRelease(this.currentNote, '8n');
        },

        repeatNote() {
            if (this.currentNote) {
                this.synth.triggerAttackRelease(this.currentNote, '8n');
            } else {
                alert('Primero toca una nota aleatoria.');
            }
        },

        getNoteFromY(y) {
            const staveTopY = this.stave.getYForLine(0); // Y de la línea superior
            const lineSpacing = this.stave.getSpacingBetweenLines(); // Distancia entre líneas
            const halfLineSpacing = lineSpacing / 2;

            // Calcula cuántos "semiespacios" hay desde la línea superior del pentagrama
            const position = Math.round((y - staveTopY) / halfLineSpacing);

            // Mapeo de posiciones a notas para cada clave
            // La posición 0 es la línea superior (F5 para clave de sol, A3 para clave de fa)
            const noteMaps = {
                treble: ['G5', 'F5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'],
                bass: ['B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2']
            };

            const notes = noteMaps[this.currentClef];
            if (position >= 0 && position < notes.length) {
                return notes[position];
            }
            return null; // Clic fuera del rango de notas
        },

        handleStaffClick(e) {
            if (!this.currentNote) {
                alert('Primero, haz clic en "Tocar Nota Aleatoria".');
                return;
            }

            const svg = e.currentTarget.querySelector('svg');
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

            const clickedNote = this.getNoteFromY(svgP.y);

            if (!clickedNote) return;

            this.synth.triggerAttackRelease(clickedNote, '8n');
            const isCorrect = (clickedNote === this.currentNote);
            this.drawFeedbackNote(clickedNote, isCorrect);

            if (isCorrect) {
                setTimeout(() => {
                    this.playRandomNote();
                }, 1000);
            }
        },

        drawFeedbackNote(noteName, isCorrect) {
            const vexNoteName = utils.toVexFlowFormat(noteName);
            const note = new VF.StaveNote({
                keys: [vexNoteName],
                duration: 'q',
                clef: this.currentClef
            }).addAccidental(0, new VF.Accidental(noteName.includes('#') ? '#' : (noteName.includes('b') ? 'b' : '')));

            note.setStyle({
                fillStyle: isCorrect ? 'green' : 'red',
                strokeStyle: isCorrect ? 'green' : 'red'
            });

            this.drawStaff([note]);
        },

        async playMajorChord() {
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            // Por ahora, asumimos la tonalidad de Do Mayor.
            // La armadura no es seleccionable todavía.
            const chord = ['C4', 'E4', 'G4'];
            console.log('Tocando acorde de Do Mayor:', chord);
            this.synth.triggerAttackRelease(chord, '1n');
        }
    };

    mode1.init();

    // --- MODO 2: LECTURA A PRIMERA VISTA ---
    const mode2 = {
        renderer: null,
        ctx: null,
        score: [],
        staves: [],
        staveWidth: 350,
        synth: new Tone.PolySynth(Tone.Synth).toDestination(),
        metronome: new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 4 }).toDestination(),

        init() {
            const container = document.getElementById('staff-container-m2');
            this.renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
            this.ctx = this.renderer.getContext();

            document.getElementById('generate-score-btn').addEventListener('click', () => this.generateScore());
            document.getElementById('play-score-btn').addEventListener('click', () => this.playScore());
            document.getElementById('tempo-m2').addEventListener('input', (e) => {
                document.getElementById('tempo-value-m2').textContent = e.target.value;
                Tone.Transport.bpm.value = e.target.value;
            });

            this.generateScore();
        },

        generateScore() {
            Tone.Transport.stop(); // Detener reproducción al generar nueva partitura

            const numMeasures = document.getElementById('measures-m2').value;
            const clef = document.querySelector('input[name="clef-m2"]:checked').value;
            const allowedNotes = Array.from(document.querySelectorAll('input[name="notes-m2"]:checked')).map(cb => cb.value);
            const difficulty = document.getElementById('difficulty-m2').value;

            if (allowedNotes.length === 0) {
                alert('Por favor, selecciona al menos una nota para generar la partitura.');
                return;
            }

            this.renderer.resize(this.staveWidth * numMeasures + 50, 200);
            this.ctx.clear();
            this.staves = [];
            this.score = [];

            const durations = {
                '1': ['w', 'h'], // Fácil
                '2': ['h', 'q'], // Medio
                '3': ['q', '8']  // Difícil
            }[difficulty];

            const durationValues = { 'w': 4, 'h': 2, 'q': 1, '8': 0.5 };

            let currentX = 10;
            for (let i = 0; i < numMeasures; i++) {
                const stave = new VF.Stave(currentX, 40, this.staveWidth);
                if (i === 0) {
                    stave.addClef(clef).addTimeSignature('4/4');
                }
                stave.setContext(this.ctx).draw();
                this.staves.push(stave);

                let measureBeats = 0;
                const measureNotes = [];
                while (measureBeats < 4) {
                    const randomDuration = durations[Math.floor(Math.random() * durations.length)];
                    const randomNoteName = allowedNotes[Math.floor(Math.random() * allowedNotes.length)];

                    if (measureBeats + durationValues[randomDuration] <= 4) {
                        const vexNote = new VF.StaveNote({
                            keys: [utils.toVexFlowFormat(randomNoteName)],
                            duration: randomDuration,
                            clef: clef
                        });
                        measureNotes.push(vexNote);
                        this.score.push({ note: randomNoteName, duration: `${durationValues[randomDuration]}n`, vexNote: vexNote });
                        measureBeats += durationValues[randomDuration];
                    } else if (measureBeats < 4) {
                        // Rellenar el resto del compás si no cabe una nota grande
                        const remainingBeats = 4 - measureBeats;
                        if (remainingBeats >= 1) {
                             measureNotes.push(new VF.StaveNote({ keys: [utils.toVexFlowFormat(allowedNotes[0])], duration: 'q', clef: clef }));
                             measureBeats += 1;
                        } else {
                             measureNotes.push(new VF.StaveNote({ keys: [utils.toVexFlowFormat(allowedNotes[0])], duration: '8', clef: clef }));
                             measureBeats += 0.5;
                        }
                    }
                }

                VF.Formatter.formatAndDraw(this.ctx, stave, measureNotes);
                currentX += this.staveWidth;
            }

            // Guardar referencias a los elementos SVG de las notas para el resaltado
            this.score.forEach(item => {
                if (item.vexNote.getAttribute('el')) {
                    item.svgElement = item.vexNote.getAttribute('el').querySelector('.vf-notehead path');
                }
            });
        },

        async playScore() {
            if (this.score.length === 0) {
                alert("Primero genera una partitura.");
                return;
            }
             if (Tone.context.state !== 'running') {
                await Tone.start();
            }

            Tone.Transport.stop();
            Tone.Transport.cancel();

            // Resetear colores
            this.score.forEach(item => {
                if(item.svgElement) item.svgElement.setAttribute('fill', 'black');
            });

            Tone.Transport.bpm.value = document.getElementById('tempo-m2').value;

            let time = Tone.Time('4n') * 2; // Empezar después de 2 pulsos de metrónomo

            // Metrónomo
            this.metronome.triggerAttackRelease('C5', '16n', '0');
            this.metronome.triggerAttackRelease('C5', '16n', '4n');

            // Programar notas
            this.score.forEach(item => {
                const { note, duration, svgElement } = item;
                this.synth.triggerAttackRelease(note, duration, time);

                Tone.Transport.scheduleOnce(t => {
                    if(svgElement) svgElement.setAttribute('fill', 'red');
                }, time);

                // Programar el regreso al color negro
                const noteDurationSeconds = Tone.Time(duration).toSeconds();
                Tone.Transport.scheduleOnce(t => {
                     if(svgElement) svgElement.setAttribute('fill', 'black');
                }, time + noteDurationSeconds * 0.9); // Un poco antes de que termine

                time += Tone.Time(duration);
            });

            Tone.Transport.start();
        }
    };

    mode2.init();
});
