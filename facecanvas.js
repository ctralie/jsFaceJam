/**
 * Canvas for OpenGL Face Rendering
 */


/**
 * Given a list of pixel locations on an image, transform them into texture coordinates
 */
function getTextureCoordinates(points, W, H) {
    let texPoints = [];
    let divisor = 0;
    if (W > H) {
        divisor = W;
    } else {
        divisor = H;
    }
    for (i = 0; i < points.length; i++) {
        texPoints[i*2] = points[i][0]/divisor;
        texPoints[(i*2)+1] = points[i][1]/divisor;
    }
    return texPoints;
}

/**
 * Given a list of pixel locations on an image, transform them into
 * vertex coordinates to be displayed on the viewing square [-1, 1] x [-1, 1]
 */
function getVertexCoordinates(points, W, H) {
    let vertPoints = [];
    let divisor = 0;
    if (W > H) {
        divisor = W;
    } else {
        divisor = H;
    }     
    for (i = 0; i < points.length; i++) {
        vertPoints[i*2] = 2*points[i][0]/divisor - 1;
        vertPoints[(i*2)+1] = 1 - (2*points[i][1]/divisor);
    }
    return vertPoints;
}

class FaceCanvas {
    constructor( debugcanvas) {
        let canvas = document.getElementById('FaceCanvas');
        canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
        this.canvas = canvas;
        this.debugcanvas = debugcanvas;
        this.shader = null;
        this.texture = null;

        this.time = 0.0;
        this.thisTime = (new Date()).getTime();
        this.lastTime = this.thisTime;
        this.time = 0;
        this.animating = false;
        this.theta = 0;

        this.W = 1;
        this.H = 1;

        this.active = false;

        // Initialize WebGL
        try {
            this.gl = canvas.getContext("webgl");
            this.gl.viewportWidth = canvas.width;
            this.gl.viewportHeight = canvas.height;
            this.setupShader();
        } catch (e) {
            console.log(e);
        }
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

    updateTexture(texture) {
        this.texture = texture;
    }

    /**
     * Update the vertex buffer with a new set of points, but do not
     * update the texture coordinate buffer.  This can be used to move
     * the face around
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    updateVertexBuffer(points, W, H) {
        let that = this;
        if (!('shaderReady' in this.shader)) {
            this.shader.then(that.updateVertexBuffer(points, W, H).bind(that));
        }
        else {
            const gl = this.gl;
            console.log(points);
            let vertPoints = getVertexCoordinates(points, W, H);
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
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
     setPoints(points, W, H) {
        let that = this;
        if (!('shaderReady' in this.shader)) {
            this.shader.then(that.setPoints(points, W, H).bind(that));
        }
        else {
            this.points = points;
            this.W = W;
            this.H = H;
            const gl = this.gl;
            this.debugcanvas.updatePoints(points, W, H);
            this.updateVertexBuffer(points, W, H);
            let textureCoords = new Float32Array(getTextureCoordinates(points, W, H));
            gl.bindBuffer(gl.ARRAY_BUFFER, this.shader.textureCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
            if (this.active) {
                requestAnimationFrame(this.repaint.bind(this));
            }
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
        //this.updateBarycentric();
        if (this.texture == null) {
            console.log("Texture has not been initialized");
            return;
        }
        const gl = this.gl;
        gl.useProgram(shader);

        // Set the time
        this.thisTime = (new Date()).getTime();
        this.time += (this.thisTime - this.lastTime)/1000.0;
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
        if (this.active && this.animating) {
            // TODO (Later, for expression transfer): Store first frame of Parker's face,
            // then do point location, and map through Barycentric coordinates to the new
            // neutral face
            let epsilon = [FACE_EXPRESSIONS.sv[0]*Math.cos(this.theta),FACE_EXPRESSIONS.sv[1]*Math.sin(this.theta),0,0,0,0,0,0,0,0];
            //TODO: Use numeric.js to do the matrix multiplication and addition of the center
            //Unravel the array into a 2D array
            // Move eyebrows up and down
            let points = [];
            for (let i = 0; i < this.points.length; i++) {
                let p = [];
                if (16 < i && i < 27) {
                    for (let k = 0; k < 2; k++) {
                        if (k == 0) {
                            p.push(this.points[i][k]); // X coordinate remains fixed
                        }
                        else {
                            p.push(this.points[i][k] + 5*(1+Math.sin(10*this.time))); // Y coordinate goes with cosine
                        } 
                    }
                } 
                else {
                    for (let k = 0; k < 2; k++) {
                        p.push(this.points[i][k]);
                    }
                } 
                points.push(p);
            }
            this.theta += 0.1;
            this.updateVertexBuffer(points, this.W, this.H);
            //this.debugcanvas.updatePoints(points);
            //this.debugcanvas.repaint();
            requestAnimationFrame(this.repaint.bind(this));
        }
    }

    /**
     * In the below: X refers to model, Y refers to new face image that's been inputted
     * Given that we have N landmarks, given the expression model expressions,
     * and given a set of coordinates "epsilon" to apply to the model
     * 1) Apply the coordinates to the model (coords = center + PCs*epsilon)
     * 2) Unravel the coordinates into XModelNew (N x 2).  Now we have 2D coordinates 
     *      for the *model face* in a new expression determined by epsilon
     * 3) Come up with barycentric coordinates alpha_i and triangle index T_i 
     *      for every x_i in XModelNew
     * 4) Given Y (N x 2), the coordinates of the new face landmarks.  For each
     *      y_i in Y, apply alpha_i to triangle T_i, using the appropriate coordinates
     *      Y as the vertices of triangle T_i
     *      In particular, if alpha_i = (scalar a, scalar b, scalar c), 
     *      and T_i = (vector y_a, vector y_b, vector y_c)
     *      final re-positioning of y_i = a*y_a + b*y_b + c*y_c
     */
    updateBarycentric(epsilon) {
        // Step 1:
        let points1D = numeric.add(numeric.dot(FACE_EXPRESSIONS.PCs,epsilon), FACE_EXPRESSIONS.center);
        // Step 2: Unravel into 2D array
        let XModelNew = [];
        for (let i = 0; i < points1D.length; i += 2) {
            XModelNew.push([points1D[i],points1D[i+1]]);
        }
        // Step 3: TODO

        // Step 4: TODO

        // Return Y

    }
}

