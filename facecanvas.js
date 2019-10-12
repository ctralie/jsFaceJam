function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

/**
 * Canavs for OpenGL Face Rendering
 */
function FaceCanvas() {
    let canvas = document.getElementById('FaceCanvas');
    this.canvas = canvas;
    this.textureShader = null;
    this.texture = null;

    /**
     * Given a list of pixel locations on an image, transform them into texture coordinates
     */
    this.getTextureCoordinates = function(points, W, H) {
        let texPoints = [];
        // TODO: Fill in texture transformation
        let fac = Math.max(W, H);
        for (let i = 0; i < points.length; i++) {
            texPoints.push([points[i][0]/fac, points[i][1]/fac]);
        }
        return texPoints;
    }

    /**
     * Given a list of pixel locations on an image, transform them into
     * vertex coordinates to be displayed on the viewing square [-1, 1] x [-1, 1]
     */
    this.getVertexCoordinates = function(points, W, H) {
        let vertPoints = []
        let fac = Math.max(W, H);
        for (let i = 0; i < points.length; i++) {
            let x = 2*points[i][0]/fac-1;
            let y = 1-2*points[i][1]/fac;
            vertPoints.push([x, y]);
        }
        return vertPoints;
    }

    /**
     * This function sets up and compiles the shader
     * Also copy over all buffers that don't change
     * 
     * @param {2d array} points An array of points, each of which is a list [x, y]
     * @param {2d array} tris An array of triangles, each of which is an index array [i, j, k]
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    this.setupShader = function(points, tris, W, H) {
        let gl = this.canvas.gl;
        let textureShader = getShaderProgram(gl, "texture");
        textureShader.uSampler = gl.getUniformLocation(textureShader, 'uSampler');
        textureShader.uTimeUniform = gl.getUniformLocation(textureShader, "uTime");
        
        // Step 1: Setup vertex position buffer
        textureShader.positionBuffer = gl.createBuffer();
        textureShader.positionLocation = gl.getAttribLocation(textureShader, "a_position");
        gl.enableVertexAttribArray(textureShader.positionLocation);
        gl.vertexAttribPointer(textureShader.positionLocation, 2, gl.FLOAT, false, 0, 0);
    
        // Step 2: Setup index buffer and send over all triangles, which don't change
        const indexBuffer = gl.createBuffetextureCoords = new Float32Array(textureCoords);r();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), gl.STATIC_DRAW); // Copy over fixed triangles
        indexBuffer.itemSize = 1;
        indexBuffer.numItems = 6;
        textureShader.indexBuffer = indexBuffer;

        
        // Step 3: Setup texture coordinate buffer
        textureShader.textureLocation = gl.getAttribLocation(textureShader, "a_texture");
        gl.enableVertexAttribArray(textureShader.textureLocation);
        const textureCoordBuffer = gl.createBuffer();
        gl.vertexAttribPointer(textureShader.textureLocation, 2, gl.FLOAT, false, 0, 0);

        // Step 4: Compute and copy over 
        let textureCoords = this.getTextureCoordinates(points, W, H);
        textureCoords = new Float32Array(textureCoords); // Recast as 32 bit float array for GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);

        // Save away texture shader
        this.textureShader = textureShader;
    }

    this.updateTexture = function(texture) {
        this.texture = texture;
    }

    this.updateVertexBuffer = function(points, W, H) {
        // TODO: Copy over points to another array where they've
        // been transformed appropriately
        let vertPoints = this.getVertexCoordinates(points, W, H);
        vertPoints = new Float32Array(vertPoints);
        let positionBuffer = this.textureShader.positionBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertPoints, gl.STATIC_DRAW);
    }


    this.repaint = function() {
        if (this.textureShader === null || this.texture == null) {
            return;
        }
        let canvas = this.canvas;
        let gl = canvas.gl;
        let textureShader = this.textureShader;
        canvas.gl.useProgram(textureShader);

        // Bind vertex and index buffers to draw two triangles
        gl.bindBuffer(gl.ARRAY_BUFFER, textureShader.positionBuffer);
        gl.vertexAttribPointer(textureShader.positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        // Set the time
        thisTime = (new Date()).getTime();
        time += (thisTime - lastTime)/1000.0;
        lastTime = thisTime;
        gl.uniform1f(uTimeUniform, time);

        // Set active texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(uSampler, 0);

        // Keep the animation loop going
        requestAnimationFrame(render);
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

