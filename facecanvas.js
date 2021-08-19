/**
 * Canvas for OpenGL Face Rendering
 */


/**
 * Given a list of pixel locations on an image, transform them into texture coordinates
 * @param {2d array} points An array of points, each of which is a list [x, y].
 * It is assumed that the last point has coordinates [width, width]
 *  
 */
function getTextureCoordinates(points) {
    let texPoints = [];
    let res = points[points.length-1][0];
    for (i = 0; i < points.length; i++) {
        texPoints[i*2] = points[i][0]/res;
        texPoints[(i*2)+1] = points[i][1]/res;
    }
    return texPoints;
}

/**
 * Given a list of pixel locations on an image, transform them into
 * vertex coordinates to be displayed on the viewing square [-1, 1] x [-1, 1]
 * @param {2d array} points An array of points, each of which is a list [x, y]
 * It is assumed that the last point has coordinates [width, width]
 */
function getVertexCoordinates(points) {
    let vertPoints = [];
    let res = points[points.length-1][0];
    for (i = 0; i < points.length; i++) {
        vertPoints[i*2] = 2*points[i][0]/res - 1;
        vertPoints[(i*2)+1] = 1 - (2*points[i][1]/res);
    }
    return vertPoints;
}

class FaceCanvas {
    /**
     * 
     * @param {int} hop Hop length for audio features (default 512)
     * @param {int} win Window length for audio features (default 2048)
     */
    constructor(hop, win) {
        let canvas = document.getElementById('FaceCanvas');
        this.res = Math.floor(0.8*Math.min(window.innerWidth, window.innerHeight));
        canvas.width = this.res;
        canvas.height = this.res;

        canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
        this.canvas = canvas;
        this.shader = null;
        this.texture = null;

        this.audio = null; // SampledAudio object
        this.audioPlayer = document.getElementById("audioPlayer");
        this.audioReady = false;
        if (hop === undefined) {
            hop = 512;
        }
        if (win === undefined) {
            win = 2048;
        }
        this.hop = hop;
        this.win = win;
        this.novfn = [];
        this.featureCoords = [];
        this.setupAudioHandlers();

        this.energySlider = document.getElementById("energySlider");

        this.time = 0.0;
        this.faceReady = false;
        this.thisTime = (new Date()).getTime();
        this.lastTime = this.thisTime;
        this.time = 0;
        this.animating = false;
        this.theta = 0;

        this.active = false;

        // Initialize WebGL
        try {
            this.gl = canvas.getContext("webgl");
            this.gl.viewportWidth = this.res;
            this.gl.viewportHeight = this.res;
            this.setupShader();
        } catch (e) {
            console.log(e);
        }
    }

    setupAudioHandlers() {
        const that = this;
        function printMissing() {
            if (!that.faceReady) {
                progressBar.setLoadingFailed("Be sure to load a face to see the animation!");
            }
            else if(!that.audioReady) {
                progressBar.setLoadingFailed("Be sure to load a tune!");
            }
        }
        this.audioPlayer.addEventListener("play", function() {
            if (that.faceReady && that.audioReady) {
                that.animating = true;
                requestAnimationFrame(that.repaint.bind(that));
            }
            else {
                printMissing();
            }
        });
        this.audioPlayer.addEventListener("pause", function() {
            that.animating = false;
            if (that.faceReady && that.audioReady) {
                requestAnimationFrame(that.repaint.bind(that));
            }
            else {
                printMissing();
            }
        });
        this.audioPlayer.addEventListener("seek", function() {
            if (that.faceReady && that.audioReady) {
                requestAnimationFrame(that.repaint.bind(that));
            }
            else {
                printMissing();
            }
        });
    }

    setActive() {
        this.active = true;
        requestAnimationFrame(this.repaint.bind(this));
    }

    setInactive() {
        this.active = false;
    }

    /**
     * This function sets up and compiles the shader, and it allocates
     * memory for the vertex buffer, index buffer, and triangles buffer
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     */
    setupShader() {
        const gl = this.gl;
        let that = this;

        this.shader = new Promise((resolve, reject) => {
            getShaderProgramAsync(gl, "texture").then((shader) => {
                shader.positionLocation = gl.getAttribLocation(shader, "a_position");
                shader.textureLocation = gl.getAttribLocation(shader, "a_texture");
                gl.enableVertexAttribArray(shader.positionLocation);
                gl.enableVertexAttribArray(shader.textureLocation);
                shader.uSampler = gl.getUniformLocation(shader, 'uSampler');
                shader.uTimeUniform = gl.getUniformLocation(shader, "uTime");

                // Setup positions for the vertex buffer
                const positionBuffer = gl.createBuffer();
                shader.positionBuffer = positionBuffer;
                gl.bindBuffer(gl.ARRAY_BUFFER, shader.positionBuffer);
                gl.vertexAttribPointer(shader.positionLocation, 2, gl.FLOAT, false, 0, 0);

                // Setup positions for the texture coordinate buffer
                const textureCoordBuffer = gl.createBuffer();
                shader.textureCoordBuffer = textureCoordBuffer;
                gl.bindBuffer(gl.ARRAY_BUFFER, shader.textureCoordBuffer);
                gl.vertexAttribPointer(shader.textureLocation, 2, gl.FLOAT, false, 0, 0);

                // Setup triangles
                const indexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(FACE_TRIS), gl.STATIC_DRAW);
                indexBuffer.itemSize = 1;
                indexBuffer.numItems = FACE_TRIS.length;
                shader.indexBuffer = indexBuffer;
                that.shader = shader;

                shader.shaderReady = true;
                resolve(shader);
            });
        });
    }

    /**
     * Connect audio to this face canvas and compute the features
     * @param {SampledAudio} audio A SampledAudio object with loaded audio samples
     */
    connectAudio(audio) {
        const that = this;
        this.audio = audio;
        audio.connectAudioPlayer(this.audioPlayer);
        audio.getSuperfluxNovfn(this.win, this.hop).then(novfn => {
            // Step 1: Normalize the audio novelty function
            let max = 0;
            for (let i = 0; i < novfn.length; i++) {
                max = Math.max(max, novfn[i]);
            }
            for (let i = 0; i < novfn.length; i++) {
                novfn[i] /= max;
            }
            that.novfn = novfn;
            // Step 2: Compute mel features
            progressBar.loadString = "Computing Mel features";
            const sr = that.audio.sr;
            let win = Math.floor(Math.log2(sr/4));
            win = Math.pow(2, win);
            //let win = that.win*2;
            audio.getSpectrogram(win, that.hop).then(S => {
                let M = getMelFilterbank(win, sr, 80, Math.min(8000, sr/2), 100);
                let X = numeric.dot(S, M);
                X = doPCA(X, FACE_EXPRESSIONS.sv.length, 20);
                let Y = getSTDevNorm(X);
                console.log(Y);
                that.featureCoords = Y;
                that.audioReady = true;
                progressBar.changeToReady();
            }).catch(reason => {
                progressBar.setLoadingFailed(reason);
            });
        }).catch(reason => {
            progressBar.setLoadingFailed(reason);
        });
        progressBar.startLoading("Computing audio novelty function");
    }

    updateTexture(texture) {
        this.texture = texture;
    }

    /**
     * Update the vertex buffer with a new set of points, but do not
     * update the texture coordinate buffer.  This can be used to move
     * the face around
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     */
    updateVertexBuffer(points) {
        let that = this;
        if (!('shaderReady' in this.shader)) {
            this.shader.then(that.updateVertexBuffer(points).bind(that));
        }
        else {
            const gl = this.gl;
            let vertPoints = getVertexCoordinates(points);
            vertPoints = new Float32Array(vertPoints);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.shader.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
        }
    }

    /**
     * Update the points for the face for both the vertex buffer
     * and texture coordinate buffer.
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     */
     setPoints(points) {
        if (!(points === undefined)) {
            let that = this;
            if (!('shaderReady' in this.shader)) {
                this.shader.then(that.setPoints(points).bind(that));
            }
            else {
                this.points = points;
                const gl = this.gl;
                this.updateVertexBuffer(points);
                let textureCoords = new Float32Array(getTextureCoordinates(points));
                gl.bindBuffer(gl.ARRAY_BUFFER, this.shader.textureCoordBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
                if (this.active) {
                    requestAnimationFrame(this.repaint.bind(this));
                }
                this.faceReady = true;
                progressBar.changeToReady();
            }
        }
        else {
            console.log("Warning: Undefined points");
        }
    }

    repaint() {
        let that = this;
        let shader = this.shader;
        if (!("shaderReady" in shader)) {
            // Wait for shader promise
            shader.then(requestAnimationFrame(that.repaint.bind(that)));
            return;
        }
        if (this.texture == null) {
            return;
        }
        const gl = this.gl;
        gl.useProgram(shader);

        // Set the time
        this.thisTime = (new Date()).getTime();
        this.time += (this.thisTime - this.lastTime)/1000.0;
        this.theta += 10*(this.thisTime - this.lastTime)/1000.0;
        this.lastTime = this.thisTime;
        gl.uniform1f(shader.uTimeUniform, this.time);

        // Set active texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(shader.uSampler, 0);

        // Bind vertex, texture and index buffers to draw two triangles
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader.indexBuffer);
        gl.drawElements(gl.TRIANGLES, shader.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        // Keep the animation loop going
        let time = this.audioPlayer.currentTime;
        if (this.active && this.points.length > 0) {
            // TODO (Later, for expression transfer): Store first frame of Parker's face,
            // then do point location, and map through Barycentric coordinates to the new
            // neutral face
            let epsilon = new Float32Array(FACE_EXPRESSIONS.sv.length);
            let eyebrow = 0;
            if (this.audioReady && this.faceReady) {
                let idx = Math.floor(time*this.audio.sr/this.hop);
                /*if (idx < this.novfn.length) {
                    eyebrow = this.novfn[idx]*20;
                }*/
                if (idx < this.novfn.length) {
                    for (let i = 0; i < this.featureCoords[idx].length; i++) {
                        epsilon[i] = this.energySlider.value*this.featureCoords[idx][i]*FACE_EXPRESSIONS.sv[i];
                    }
                }
            }
            let points = transferFacialExpression(epsilon, this.points, eyebrow);
            this.updateVertexBuffer(points);
        }
        if (this.animating) {
            requestAnimationFrame(this.repaint.bind(this));
        }
    }
}

