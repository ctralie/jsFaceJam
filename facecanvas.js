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
 * Concatenate a list of face points together into one list and add 
 * the points at the extremities of the image
 * @param {3d array} faces An array of faces, each of which has a list of points, 
 *                         each of which is a list [x, y]
 * @param {int} width Width of image containing faces
 * @param {int} height Height of image containing faces
 */
function unwrapFacePoints(faces, width, height) {
    let points = [];
    for (let f = 0; f < faces.length; f++) {
        for (let i = 0; i < faces[f].length; i++) {
            points.push(faces[f][i]);
        }
    }
    points.push([0,0]);
    points.push([width,0]);
    points.push([width,height]);
    points.push([0,height]);
    return points;
}

/**
 * Given a list of pixel locations on an image, transform them into texture coordinates
 * @param {2d array} points An array of points, each of which is a list [x, y].
 * It is assumed that the second to last point has coordinates [width, width]
 *  
 */
function getTextureCoordinates(points) {
    let texPoints = [];
    let res = points[points.length-2][0];
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
 * It is assumed that the second to last point has coordinates [width, width]
 */
function getVertexCoordinates(points) {
    let vertPoints = [];
    let res = points[points.length-2][0];
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
        this.texture = null; // Regular texture
        this.wtexture = null; // Watermarked texture
        this.faces = []; // List of face points
        this.imgwidth = 0;
        this.imgheight = 0;

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
        this.activation = [];
        this.setupAudioHandlers();

        this.eyebrowEnergySlider = document.getElementById("eyebrowEnergySlider");
        this.eyebrowEnergySlider.value = 40;
        this.faceEnergySlider = document.getElementById("faceEnergySlider");
        this.faceEnergySlider.value = 100;
        this.smoothnessSlider = document.getElementById("smoothnessSlider");
        this.smoothnessSlider.value = 100;
        this.resolutionSlider = document.getElementById("resolutionSlider");
        this.resolutionSlider.value = 256;
        this.resolutionSlider.onchange = function() {
            let val = that.resolutionSlider.value;
            // Round to nearest power of 2
            val = Math.round(Math.log(val)/Math.log(2));
            val = Math.pow(2, val);
            that.resolutionSlider.value = val;
            document.getElementById("resolutionSliderLabel").innerHTML = "Download Resolution " + val + "x" + val;
        }
        this.resolutionSlider.onchange();
        this.fpsSlider = document.getElementById("fpsSlider");
        this.fpsSlider.value = 15;
        this.fpsSlider.onchange = function() {
            let val = that.fpsSlider.value;
            document.getElementById("fpsSliderLabel").innerHTML = "Download fps " + val;
        }
        this.fpsSlider.onchange();


        this.time = 0.0;
        this.facesReady = false;
        this.thisTime = (new Date()).getTime();
        this.lastTime = this.thisTime;
        this.time = 0;
        this.animating = false;

        // Variables for capturing to a video
        this.capturing = false;
        this.capFrame = 0;
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
            if (!that.facesReady) {
                progressBar.setLoadingFailed("Be sure to load a face to see the animation!");
            }
            else if(!that.audioReady) {
                progressBar.setLoadingFailed("Be sure to load a tune!");
            }
        }
        this.audioPlayer.addEventListener("play", function() {
            if (that.facesReady && that.audioReady) {
                that.animating = true;
                requestAnimationFrame(that.repaint.bind(that));
            }
            else {
                printMissing();
            }
        });
        this.audioPlayer.addEventListener("pause", function() {
            that.animating = false;
            if (that.facesReady && that.audioReady) {
                requestAnimationFrame(that.repaint.bind(that));
            }
            else {
                printMissing();
            }
        });
        this.audioPlayer.addEventListener("seek", function() {
            if (that.facesReady && that.audioReady) {
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
            let payload = {samples:that.audio.samples, sr:that.audio.sr, win:that.win, hop:that.hop};
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
                    that.activation = event.data.activation;
                    resolve();
                }
            }
        }).then(() => {
            if (this.facesReady) {
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
     * @param {3d array} faces An array of faces, each of which has a list of points, 
     *                         each of which is a list [x, y]
     */
    updateVertexBuffer(faces) {
        let that = this;
        if (!('shaderReady' in this.shader)) {
            this.shader.then(that.updateVertexBuffer(faces).bind(that));
        }
        else {
            const gl = this.gl;
            const points = unwrapFacePoints(faces, this.imgwidth, this.imgheight);
            let vertPoints = getVertexCoordinates(points);
            vertPoints = new Float32Array(vertPoints);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.shader.positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
        }
    }

    /**
     * Create a triangulation between all of the points and copy it
     * over to the GPU as an index buffer.  This method assumes that 
     * the bounding boxes of the faces are disjoint and that they are all
     * contained within the full image box
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     * It is assumed that the last 4 coordinates are the bounding rectangle of
     * the full image
     */
    updateIndexBuffer(points) {
        if (!('shaderReady' in this.shader)) {
            this.shader.then(this.updateIndexBuffer(points).bind(this));
        }
        else {
            const gl = this.gl;
            const indexBuffer = this.shader.indexBuffer;

            // Step 1: Use a Delaunay triangulation to get the triangles
            // that connect bounding boxes of all of the faces to each
            // other and to the last 4 image bounding box coordinates
            let numFaces = (points.length-4)/(N_LANDMARKS+4);
            let X = [];
            // Add bounding box points
            let offset = N_LANDMARKS;
            for (let f = 0; f < numFaces; f++) {
                for (let k = 0; k < 4; k++) {
                    X.push([points[offset+k][0], points[offset+k][1]]);
                }
                offset += N_LANDMARKS+4;
            }
            offset = points.length-4;
            // Add the last 4 points for the bounding box for the full image
            for (let k = 0; k < 4; k++) {
                X.push([points[offset+k][0], points[offset+k][1]]);
            }
            let edges = [];
            // Add the edges of the bounding boxes as constraints
            for (let f = 0; f <= numFaces; f++) {
                for (let k = 0; k < 4; k++) {
                    edges.push([f*4+k, f*4+(k+1)%4]);
                }
            }
            let ctris = cdt2d(X, edges, {"interior":true}); // Connecting triangles
            let tris = [];
            // Remove triangles that intersect with a bounding box
            for (let t = 0; t < ctris.length; t++) {
                // At least two of the points on the triangle
                // must reside on a different box
                let allSame = Math.floor(ctris[t][0]/4) == Math.floor(ctris[t][1]/4);
                allSame = allSame && (Math.floor(ctris[t][1]/4) == Math.floor(ctris[t][2]/4));
                if (!allSame) {
                    // Convert indices to offset in points list and
                    // add them to the overall triangulation
                    for (let k = 0; k < 3; k++) {
                        let v = ctris[t][k]%4;  // Which vertex this is on the box
                        let f = (ctris[t][k]-v)/4; // Which box it's in
                        let vidx = f*(N_LANDMARKS+4) + v;
                        if (f < numFaces) {
                            vidx += N_LANDMARKS;
                        }
                        tris.push(vidx);
                    }
                }
            }
            
            // Step 2: Add triangles for every face
            offset = 0;
            for (let f = 0; f < numFaces; f++) {
                for (let t = 0; t < FACE_TRIS.length/3; t++) {
                    for (let k = 0; k < 3; k++) {
                        tris.push(FACE_TRIS[t*3+k] + offset);
                    }
                }
                offset += N_LANDMARKS + 4;
            }

            // Unravel points
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), gl.STATIC_DRAW);
            indexBuffer.itemSize = 1;
            indexBuffer.numItems = tris.length;
        }
    }

    /**
     * Update the points for the face for both the vertex buffer
     * and texture coordinate buffer, including points at the boundaries of the image
     * 
     * @param {3d array} faces An array of faces, each of which has a list of points, 
     *                         each of which is a list [x, y]
     * @param {int} width Width of image containing faces
     * @param {int} height Height of image containing faces
     */
     setFacePoints(faces, width, height) {
        if (faces.length > 0) {
            let that = this;
            if (!('shaderReady' in this.shader)) {
                this.shader.then(that.setFacePoints(faces, width, height).bind(that));
            }
            else {
                this.faces = faces;
                this.imgwidth = width;
                this.imgheight = height;
                const gl = this.gl;
                const points = unwrapFacePoints(faces, this.imgwidth, this.imgheight);
                this.updateVertexBuffer(faces);
                let textureCoords = new Float32Array(getTextureCoordinates(points));
                gl.bindBuffer(gl.ARRAY_BUFFER, this.shader.textureCoordBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
                this.updateIndexBuffer(points);
                if (this.active) {
                    requestAnimationFrame(this.repaint.bind(this));
                }
                this.facesReady = true;
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
        if (!this.facesReady) {
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
        const data = convertDataURIToBinary(this.canvas.toDataURL("image/"+VIDEO_IMG_EXT, 1));
        const name = `img${ pad( this.frames.length, 3 ) }.` + VIDEO_IMG_EXT;
        this.frames.push({
            name: name,
            data: data
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
                console.log(msg);
                const blob = new Blob([msg.data.MEMFS[0].data], {
                    type: "video/mp4"
                });
                const a = document.createElement('a');
                a.href = window.URL.createObjectURL(blob);
                a.innerHTML = "Click here to download generated video";
                a.download = 'facejam.mp4';
                progressBar.changeToReady("Successfully generated video");
                const downloadArea = document.getElementById("downloadLink");
                downloadArea.innerHTML = "";
                downloadArea.appendChild(a);
                a.click();
            }
        };
        // Setup audio blob
        let mp3bytes = getMP3Binary(this.audio.samples, this.audio.sr);
        that.frames.push({name: "audio.mp3", data: mp3bytes});
        // Call ffmpeg
        let videoRes = parseInt(that.resolutionSlider.value);
        worker.postMessage({
            type: 'run',
            TOTAL_MEMORY: 256*1024*1024,
            arguments: ["-i", "audio.mp3", "-r", ""+that.fpsSlider.value, "-i", "img%03d.jpeg", "-c:v", "libx264", "-crf", "1", "-vf", "scale="+videoRes+":"+videoRes, "-pix_fmt", "yuv420p", "-vb", "20M", "facejam.mp4"],
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
            let videoFps = parseInt(this.fpsSlider.value);
            time = this.capFrame/videoFps;
        }

        // Step 2: Update the facial landmark positions according to the audio
        if (this.active && this.faces.length > 0) {
            // Store first frame of the expression, then do point location
            // and map through Barycentric coordinates to the new neutral face
            let smoothness = that.smoothnessSlider.value/100;
            let eyebrow = 0;
            let activation = 0;
            if (this.audioReady && this.facesReady) {
                let idx = Math.floor(time*this.audio.sr/this.hop);
                if (idx < this.novfn.length) {
                    eyebrow = smoothness*this.beatRamp[idx] + (1-smoothness)*this.novfn[idx];
                    eyebrow *= 0.25*this.eyebrowEnergySlider.value;
                }
                if (idx < this.activation.length) {
                    activation = this.activation[idx]*this.faceEnergySlider.value/100;
                }
            }
            let faces = [];
            for (let f = 0; f < this.faces.length; f++) {
                faces[f] = transferFacialExpression("happy", this.faces[f], activation, eyebrow);
            }
            this.updateVertexBuffer(faces);
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