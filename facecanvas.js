function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

/**
 * Canavs for OpenGL Face Rendering
 */
function FaceCanvas(canvas) {
    canvas.textureShader = null;
    canvas.texture = null;
    canvas.lastTime = (new Date()).getTime();
    canvas.time = 0;
    canvas.animating = false;

    /**
     * Given a list of pixel locations on an image, transform them into texture coordinates
     */
    canvas.getTextureCoordinates = function(points, W, H) {
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
    canvas.getVertexCoordinates = function(points, W, H) {
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


    /**
     * This function sets up and compiles the shader, and it allocates
     * memory for the vertex buffer, index buffer, and triangles buffer
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     * @param {2d array} tris An array of triangles, each of which is an index array [i, j, k]
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    canvas.setupShader = function(points, tris, W, H) {
        let gl = canvas.gl;
        let textureShader = getShaderProgram(gl, "texture");
        let positionLocation = gl.getAttribLocation(textureShader, "a_position");
        let textureLocation = gl.getAttribLocation(textureShader, "a_texture");
        gl.enableVertexAttribArray(positionLocation);
        gl.enableVertexAttribArray(textureLocation);
        textureShader.uSampler = gl.getUniformLocation(textureShader, 'uSampler');
        textureShader.uTimeUniform = gl.getUniformLocation(textureShader, "uTime");

        // Setup positions for the vertex buffer
        const positionBuffer = gl.createBuffer();
        let vertPoints = new Float32Array(this.getVertexCoordinates(points, W, H));
        textureShader.points = points;
        textureShader.W = W;
        textureShader.H = H;
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        textureShader.positionBuffer = positionBuffer;
        textureShader.positionLoction = positionLocation;

        // Setup positions for the texture coordinate buffer
        const textureCoordBuffer = gl.createBuffer();
        let textureCoords = canvas.getTextureCoordinates(points, W, H);
        textureCoords = new Float32Array(textureCoords);
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
        gl.vertexAttribPointer(textureLocation, 2, gl.FLOAT, false, 0, 0);
        textureShader.textureCoordBuffer = textureCoordBuffer;
        textureShader.textureLocation = textureLocation;

        // Setup triangles
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), gl.STATIC_DRAW);
        indexBuffer.itemSize = 1;
        indexBuffer.numItems = tris.length;
        textureShader.indexBuffer = indexBuffer;
        canvas.textureShader = textureShader;
    }

    canvas.updateTexture = function(texture) {
        canvas.texture = texture;
    }

    /**
     * Update the vertex buffer with a new set of points
     * @param {2d array} points An array of points, each of which is a list [x, y]
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    canvas.updateVertexBuffer = function(points, W, H) {
        let gl = canvas.gl;
        let textureShader = canvas.textureShader;
        let vertPoints = canvas.getVertexCoordinates(points, W, H);
        vertPoints = new Float32Array(vertPoints);
        gl.bindBuffer(gl.ARRAY_BUFFER, textureShader.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
    }


    canvas.repaint = function() {
        if (canvas.textureShader === null){
            console.log("Texture shader has not been initialized");
            return;
        }
        if (canvas.texture == null) {
            console.log("Texture has not been initialized");
            return;
        }
        let gl = canvas.gl;
        let textureShader = canvas.textureShader;
        canvas.gl.useProgram(textureShader);

        // Bind vertex, texture and index buffers to draw two triangles
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textureShader.indexBuffer);
        gl.drawElements(gl.TRIANGLES, textureShader.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        // Set the time
        thisTime = (new Date()).getTime();
        canvas.time += (thisTime - canvas.lastTime)/1000.0;
        canvas.lastTime = thisTime;
        gl.uniform1f(textureShader.uTimeUniform, canvas.time);

        // Set active texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, canvas.texture);
        gl.uniform1i(textureShader.uSampler, 0);

        // Keep the animation loop going
        if (canvas.active && canvas.animating) {
            let points = [];
            for (let i = 0; i < textureShader.points.length; i++) {
                let p = [];
                if (16 < i && i < 27) {
                    for (let k = 0; k < 2; k++) {
                        p.push(textureShader.points[i][k] + 4*(Math.random()-0.5));
                    }
                } else {
                    for (let k = 0; k < 2; k++) {
                        p.push(textureShader.points[i][k]);
                    }
                }
                points.push(p);
            }
            canvas.updateVertexBuffer(points, textureShader.W, textureShader.H);
            requestAnimationFrame(canvas.repaint);
        }
    }

    // Initialize WebGL
    try {
        canvas.gl = canvas.getContext("webgl");
        canvas.gl.viewportWidth = canvas.width;
        canvas.gl.viewportHeight = canvas.height;
    } catch (e) {
        console.log(e);
    }
}

