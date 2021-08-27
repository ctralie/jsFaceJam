/**
 * Canvas for OpenGL Face Rendering
 */

const VIDEO_IMG_EXT = "jpeg";

// https://semisignal.com/tag/ffmpeg-js/
function base64ToBinary(base64) {
    let raw = window.atob(base64);
    let rawLength = raw.length;
    let array = new Uint8Array(new ArrayBuffer(rawLength));
    for (i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}
function convertDataURIToBinary(dataURI) {
    let base64 = dataURI.replace(/^data[^,]+,/,'');
    return base64ToBinary(base64);
};

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }

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
        const that = this;
        let canvas = document.getElementById('FaceCanvas');
        this.res = Math.floor(0.8*Math.min(window.innerWidth, window.innerHeight));
        canvas.width = this.res;
        canvas.height = this.res;

        canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
        this.canvas = canvas;
        this.shader = null;
        this.texture = null;
        this.wtexture = null;

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
        this.beatRamp = [];
        this.featureCoords = [];
        this.setupAudioHandlers();

        this.eyebrowEnergySlider = document.getElementById("eyebrowEnergySlider");
        this.eyebrowEnergySlider.value = 20;
        this.faceEnergySlider = document.getElementById("faceEnergySlider");
        this.faceEnergySlider.value = 20;
        this.smoothnessSlider = document.getElementById("smoothnessSlider");
        this.smoothnessSlider.value = 100;
        this.resolutionSlider = document.getElementById("resolutionSlider");
        this.resolutionSlider.value = 256;
        this.resolutionSlider.onchange = function() {
            let val = that.resolutionSlider.value;
            document.getElementById("resolutionSliderLabel").innerHTML = "Download Resolution " + val + "x" + val + " (larger will take longer)";
        }
        this.resolutionSlider.onchange();

        this.time = 0.0;
        this.faceReady = false;
        this.thisTime = (new Date()).getTime();
        this.lastTime = this.thisTime;
        this.time = 0;
        this.animating = false;

        // Variables for capturing to a video
        this.capturing = false;
        this.capFrame = 0;
        this.videoFps = 20;
        this.frames = [];


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
     * Compute all of the audio features used to animate the face
     */
    computeAudioFeatures() {
        const that = this;
        new Promise((resolve, reject) => {
            const worker = new Worker("audioworker.js");
            let payload = {samples:that.audio.samples, sr:that.audio.sr, win:that.win, hop:that.hop, nfeatures:FACE_EXPRESSIONS.sv.length};
            worker.postMessage(payload);
            worker.onmessage = function(event) {
                if (event.data.type == "newTask") {
                    progressBar.loadString = event.data.taskString;
                }
                else if (event.data.type == "error") {
                    that.progressBar.setLoadingFailed(event.data.taskString);
                    reject();
                }
                else if (event.data.type == "debug") {
                    console.log("Debug: " + event.data.taskString);
                }
                else if (event.data.type == "end") {
                    that.novfn = event.data.novfn;
                    that.beatRamp = event.data.beatRamp;
                    that.featureCoords = event.data.Y;
                    resolve();
                }
            }
        }).then(() => {
            if (this.faceReady) {
                progressBar.changeToReady();
            }
            else {
                progressBar.changeMessage("Finished audio, waiting for face");
            }
            that.audioReady = true;
        }).catch(reason => {
            progressBar.setLoadingFailed(reason);
        });
        progressBar.startLoading();
    }

    /**
     * Connect audio to this face canvas and compute the features
     * @param {SampledAudio} audio A SampledAudio object with loaded audio samples
     */
    connectAudio(audio) {
        this.audio = audio;
        audio.connectAudioPlayer(this.audioPlayer);
        this.computeAudioFeatures();
    }

    updateTexture(texture) {
        this.texture = texture;
    }

    updateWTexture(wtexture) {
        this.wtexture = wtexture;
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
                if (this.audioReady) {
                    progressBar.changeToReady();
                }
                else if (progressBar.loading) {
                    progressBar.changeMessage("Finished facial landmarks, waiting for audio");
                }
            }
        }
        else {
            console.log("Warning: Undefined points");
        }
    }

    /**
     * Begin the process of capturing the video frame by frame
     */
    startVideoCapture() {
        if (!this.faceReady) {
            progressBar.setLoadingFailed("Need to select face image first!");
        }
        else if (!this.audioReady) {
            progressBar.setLoadingFailed("Need to select tune first!");
        }
        else {
            if (!progressBar.loading) {
                progressBar.startLoading("Saving video");
            }
            this.capturing = true;
            this.capFrame = 0;
            this.frames = [];
            requestAnimationFrame(this.repaint.bind(this));
        }
    }


    /**
     * Capture and watermark the current state of the gl canvas and add
     * it to the list fo frames
     */
    captureVideoFrame() {
        this.frames.push({
            name: `img${ pad( this.frames.length, 3 ) }.` + VIDEO_IMG_EXT,
            data: convertDataURIToBinary(this.canvas.toDataURL("image/"+VIDEO_IMG_EXT, 1))
        });
        this.capFrame += 1;
        requestAnimationFrame(this.repaint.bind(this));
    }

    /**
     * Stitch all of the images together into an mp4 video with an ffmpeg
     * worker, add audio, and save as a download
     * With help from
     * https://gist.github.com/ilblog/5fa2914e0ad666bbb85745dbf4b3f106
     */
    finishVideoCapture() {      
        let that = this;
        const worker = new Worker('libs/ffmpeg-worker-mp4.js');
        worker.onmessage = function(e) {
            var msg = e.data;
            if (msg.type == "stderr") {
                progressBar.changeMessage(msg.data);
            }
            else if (msg.type == "exit") {
                progressBar.setLoadingFailed("Process exited with code " + msg.data);
            }
            else if (msg.type == "done") {
                const blob = new Blob([msg.data.MEMFS[0].data], {
                    type: "video/mp4"
                });
                const a = document.createElement('a');
                a.href = window.URL.createObjectURL(blob);
                a.style.display = 'none';
                a.download = 'facejam.mp4';
                document.body.appendChild(a);
                a.click();
                progressBar.changeToReady("Successfully generated video");
            }
        };
        // Setup audio blob
        const audioArr = new Float32Array(this.audio.samples);
        // Get WAV file bytes and audio params of your audio source
        const wavBytes = getWavBytes(audioArr.buffer, {
            isFloat: true,       // floating point or 16-bit integer
            numChannels: 1,
            sampleRate: this.audio.sr,
        })
        that.frames.push({name: "audio.wav", data: wavBytes});
        // Call ffmpeg
        let videoRes = parseInt(that.resolutionSlider.value);
        //", drawtext=fontfile=assets/fonts/Ubuntu-Italic.ttf:text='facejam.app':fontcolor=white:fontsize=12:box=1:boxcolor=black@0.5:boxborderw=5:x=0:y=0"
        worker.postMessage({
            type: 'run',
            TOTAL_MEMORY: 256*1024*1024,
            arguments: ["-r", ""+that.videoFps, "-i", "img%03d.jpeg", "-c:v", "libx264", "-crf", "1", "-vf", "scale="+videoRes+":"+videoRes, "-pix_fmt", "yuv420p", "-vb", "20M", "facejam.mp4"],
            MEMFS: that.frames
        });        


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
        // Step 1: Set the time
        this.thisTime = (new Date()).getTime();
        this.time += (this.thisTime - this.lastTime)/1000.0;
        this.lastTime = this.thisTime;
        let time = this.audioPlayer.currentTime;
        if (this.capturing) {
            time = this.capFrame/this.videoFps;
        }

        // Step 2: Update the facial landmark positions according to the audio
        if (this.active && this.points.length > 0) {
            // TODO (Later, for expression transfer): Store first frame of Parker's face,
            // then do point location, and map through Barycentric coordinates to the new
            // neutral face
            let smoothness = that.smoothnessSlider.value/100;
            let epsilon = new Float32Array(FACE_EXPRESSIONS.sv.length);
            let eyebrow = 0;
            if (this.audioReady && this.faceReady) {
                let idx = Math.floor(time*this.audio.sr/this.hop);
                if (idx < this.novfn.length) {
                    eyebrow = smoothness*this.beatRamp[idx] + (1-smoothness)*this.novfn[idx];
                    eyebrow *= 0.25*this.eyebrowEnergySlider.value;
                }
                if (idx < this.featureCoords.length) {
                    for (let i = 0; i < this.featureCoords[idx].length; i++) {
                        epsilon[i] = 0.1*this.faceEnergySlider.value*this.featureCoords[idx][i]*FACE_EXPRESSIONS.sv[i];
                    }
                }
            }
            let points = transferFacialExpression(epsilon, this.points, eyebrow);
            this.updateVertexBuffer(points);
        }

        // Step 3: Finally, draw the frame
        const gl = this.gl;
        gl.useProgram(shader);
        gl.uniform1f(shader.uTimeUniform, this.time);

        // Set active texture
        gl.activeTexture(gl.TEXTURE0);
        if (this.capturing) {
            gl.bindTexture(gl.TEXTURE_2D, this.wtexture);
        }
        else {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
        }
        gl.uniform1i(shader.uSampler, 0);

        // Bind vertex, texture and index buffers to draw two triangles
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader.indexBuffer);
        gl.drawElements(gl.TRIANGLES, shader.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
        if (this.capturing) {
            let duration = this.audioPlayer.duration;
            if (time < duration) {
                let perc = Math.round(100*time/duration);
                progressBar.changeMessage(perc + "% completed capturing frames");
                this.captureVideoFrame();
            }
            else {
                this.capturing = false;
                progressBar.changeMessage("Assembling video");
                this.finishVideoCapture();
            }
        }
        else if (this.animating) {
            requestAnimationFrame(this.repaint.bind(this));
        }
    }
}