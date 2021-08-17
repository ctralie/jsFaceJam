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

    constructor(canvas, debugcanvas) {
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

        // Initialize WebGL
        try {
            this.gl = this.getContext("webgl");
            this.gl.viewportWidth = this.width;
            this.gl.viewportHeight = this.height;
        } catch (e) {
            console.log(e);
        }
    }

    /**
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     */
    setPoints(points) {
        this.points = points;
        this.debugcanvas.points = points;
    }

    /**
     * This function sets up and compiles the shader, and it allocates
     * memory for the vertex buffer, index buffer, and triangles buffer
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    setupShader(W, H) {
        let gl = this.canvas.gl;
        let that = this;
        let points = this.points;

        this.shader = new Promise((resolve, reject) => {
            getShaderProgramAsync(gl, "texture").then((shader) => {
                shader.positionLocation = gl.getAttribLocation(shader, "a_position");
                shader.textureLocation = gl.getAttribLocation(shader, "a_texture");
                gl.enableVertexAttribArray(shader.positionLocation);
                gl.enableVertexAttribArray(shader.textureLocation);
                shader.uSampler = gl.getUniformLocation(shader, 'uSampler');
                shader.uTimeUniform = gl.getUniformLocation(shader, "uTime");
                resolve(shader);
            });
        });
        this.shader.then(shader => {
            shader.shaderReady = true;
            // Setup positions for the vertex buffer
            const positionBuffer = gl.createBuffer();
            let vertPoints = new Float32Array(getVertexCoordinates(points, W, H));
            shader.W = W;
            shader.H = H;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
            gl.vertexAttribPointer(shader.positionLocation, 2, gl.FLOAT, false, 0, 0);
            shader.positionBuffer = positionBuffer;
            shader.positionLocation = positionLocation;

            // Setup positions for the texture coordinate buffer
            const textureCoordBuffer = gl.createBuffer();
            let textureCoords = new Float32Array(getTextureCoordinates(points, W, H));
            gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
            gl.vertexAttribPointer(textureLocation, 2, gl.FLOAT, false, 0, 0);
            shader.textureCoordBuffer = textureCoordBuffer;
            shader.textureLocation = textureLocation;

            // Setup triangles
            const indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(FACE_TRIS), gl.STATIC_DRAW);
            indexBuffer.itemSize = 1;
            indexBuffer.numItems = FACE_TRIS.length;
            shader.indexBuffer = indexBuffer;
            that.shader = shader;
            resolve(shader);
        });
    }

    updateTexture(texture) {
        this.texture = texture;
    }

    /**
     * Update the vertex buffer with a new set of points
     * 
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    updateVertexBuffer(W, H) {
        let gl = canvas.gl;
        let shader = canvas.shader;
        let vertPoints = canvas.getVertexCoordinates(this.points, W, H);
        vertPoints = new Float32Array(vertPoints);
        gl.bindBuffer(gl.ARRAY_BUFFER, shader.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
    }

    repaint() {
        let shader = canvas.shader;
        if (!("shaderReady" in shader)) {
            // Wait for shader promise
            shader.then(this.repaint.bind(this));
        }
        this.updateBarycentric();
        if (this.texture == null) {
            console.log("Texture has not been initialized");
            return;
        }

        let gl = canvas.gl;
        canvas.gl.useProgram(shader);

        // Bind vertex, texture and index buffers to draw two triangles
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader.indexBuffer);
        gl.drawElements(gl.TRIANGLES, shader.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        // Set the time
        this.thisTime = (new Date()).getTime();
        this.time += (this.thisTime - this.lastTime)/1000.0;
        this.lastTime = this.thisTime;
        gl.uniform1f(shader.uTimeUniform, this.time);

        // Set active texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(shader.uSampler, 0);

        // Keep the animation loop going
        if (this.active && this.animating) {
            // TODO (Later, for expression transfer): Store first frame of Parker's face,
            // then do point location, and map through Barycentric coordinates to the new
            // neutral face
            let epsilon = [expressions.sv[0]*Math.cos(this.theta),expressions.sv[1]*Math.sin(this.theta),0,0,0,0,0,0,0,0];
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
                            p.push(this.points[i][k] + 5*(1+Math.sin(10*time))); // Y coordinate goes with cosine
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
            //this.debugcanvas.repaint();
            this.updateVertexBuffer(shader.W, shader.H);
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
        let points1D = numeric.add(numeric.dot(expressions.PCs,epsilon),expressions.center);
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

