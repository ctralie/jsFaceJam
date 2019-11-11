function loadJSON(filename, errTxt) {
    try {
        let request = new XMLHttpRequest();
        request.open("GET", filename, false);
        request.overrideMimeType("application/json");
        request.send(null);
        return JSON.parse(request.responseText);
    }
    catch(err) {
        if (errTxt === undefined) {
            errTxt = "";
        }
        alert("Error loading JSON file " + filename + ". " + errTxt);
        throw err;
    }
}


function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

/**
 * Canavs for OpenGL Face Rendering
 */

let time = 0.0;
let thisTime = (new Date()).getTime();
let lastTime = thisTime;

let tris = [34,52,35,34,33,52,33,51,52,63,53,52,52,53,35,62,63,52,51,62,52,50,62,51,33,50,51,66,65,63,63,65,53,30,32,33,33,32,50,30,33,34,35,30,34,67,66,62,62,66,63,49,61,50,50,61,62,55,64,53,53,54,35,30,31,32,32,31,50,56,55,65,65,55,53,55,54,64,64,54,53,61,67,62,66,56,65,59,67,61,57,56,66,31,49,50,58,66,67,58,57,66,35,29,30,30,29,31,28,29,42,59,58,67,49,59,61,48,60,49,49,60,59,31,48,49,60,48,59,47,29,35,29,40,31,2,3,48,46,47,35,47,42,29,42,27,28,28,40,29,14,46,35,47,43,42,46,43,47,42,22,27,55,10,54,15,45,46,9,10,55,9,55,56,9,56,8,56,57,8,38,39,21,27,39,28,8,57,58,10,11,54,11,12,54,39,40,28,14,35,54,46,44,43,45,44,46,12,13,54,13,14,54,7,58,59,7,8,58,6,7,59,21,39,27,39,38,40,40,41,31,22,42,43,38,41,40,48,6,59,5,6,48,14,15,46,4,5,48,38,37,41,3,4,48,48,31,2,37,36,41,2,31,41,23,44,24,23,43,44,23,22,43,38,20,37,1,2,41,25,44,45,15,16,45,18,17,36,22,21,27,23,21,22,16,26,45,25,24,44,36,1,41,26,25,45,21,20,38,36,0,1,23,20,21,69,20,23,68,19,20,20,19,37,17,0,36,18,36,37,19,18,37,11,71,12,12,71,13,13,71,14,14,71,15,15,69,16,10,71,11,9,71,10,8,71,9,7,70,8,8,70,71,6,70,7,5,70,6,4,70,5,3,70,4,2,70,3,1,70,2,68,70,1,16,69,26,26,69,25,25,69,24,24,69,23,71,69,15,69,68,20,19,68,18,18,68,17,17,68,0,0,68,1,72,68,73,68,69,73,73,69,75,69,71,75,71,74,75,71,70,74,70,72,74,68,72,70];

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
     * @param {int} W Number of pixels across the width
     * @param {int} H Number of pixels across the height
     */
    canvas.setupShader = function(points, W, H) {
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
        // Update time
        thisTime = (new Date()).getTime();
        time += (thisTime - lastTime)/1000.0;
        lastTime = thisTime;

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

        // Load the expressions
        let expressions = loadJSON("ExpressionsModel.json","ERROR");
        console.log(expressions);
        //Loop through the expressions



        // Keep the animation loop going
        if (canvas.active && canvas.animating) {
            let points = [];
            let column = [];

            let theta = 0;
            let epsilon = Math.sin(theta);

            for (i = 0; i < 2; i++) { //Change this loop to loop through all dimensions (d)
                column.push(expressions.PC[d][k]); //dth dimension of column k
            }

            points += expressions.center + expressions.sv[k]*epsilon*column;

            //Change theta and call requestAnimFrame(repaint) until theta reaches 2*pi

            //Add bounding box points?



            // Move eyebrows up and down
                /*
            for (let i = 0; i < textureShader.points.length; i++) {
                let p = [];

                

                
                if (16 < i && i < 27) {
                    for (let k = 0; k < 2; k++) {
                        if (k == 0) {
                            p.push(textureShader.points[i][k]); // X coordinate remains fixed
                        }
                        else {
                            p.push(textureShader.points[i][k] + 5*(1+Math.sin(10*time))); // Y coordinate goes with cosine
                        } 
                    }
                } else {
                    for (let k = 0; k < 2; k++) {
                        p.push(textureShader.points[i][k]);
                    }
                } 
                points.push(p);
            }*/
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

