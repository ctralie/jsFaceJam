/**
 * A function that compiles a particular shader
 * @param {object} gl WebGL handle
 * @param {string} shadersrc A string holding the GLSL source code for the shader
 * @param {string} type The type of shader ("fragment" or "vertex") 
 * 
 * @returns{shader} Shader object
 */
function getShader(gl, shadersrc, type) {
    var shader;
    if (type == "fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } 
    else if (type == "vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } 
    else {
        return null;
    }
    
    gl.shaderSource(shader, shadersrc);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log("Unable to compile " + type + " shader...")
        console.log(shadersrc);
        console.log(gl.getShaderInfoLog(shader));
        alert("Could not compile shader");
        return null;
    }
    return shader;
}


/**
 * Compile a vertex shader and a fragment shader and link them together
 * 
 * @param {object} gl WebGL Handle
 * @param {string} prefix Prefix for naming the shader
 * @param {string} vertexSrc A string holding the GLSL source code for the vertex shader
 * @param {string} fragmentSrc A string holding the GLSL source code for the fragment shader
 */
function getShaderProgram(gl, prefix, vertexSrc, fragmentSrc) {
    let vertexShader = getShader(gl, vertexSrc, "vertex");
    let fragmentShader = getShader(gl, fragmentSrc, "fragment");
    let shader = gl.createProgram();
    gl.attachShader(shader, vertexShader);
    gl.attachShader(shader, fragmentShader);
    gl.linkProgram(shader);
    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
        throw new Error("Could not initialize shader" + prefix);
    }
    shader.name = prefix;
    return shader;
}

/**
 * Load in and compile a vertex/fragment shader pair asynchronously
 * 
 * @param {object} gl WebGL Handle
 * @param {string} prefix File prefix for shader.  It is expected that there
 * will be both a vertex shader named prefix.vert and a fragment
 * shader named prefix.frag
 * 
 * @returns{Promise} A promise that resolves to a shader program, where the 
 * vertex/fragment shaders are compiled/linked together
 */
function getShaderProgramAsync(gl, prefix) {
    return new Promise((resolve, reject) => {
        $.get(prefix + ".vert", function(vertexSrc) {
            $.get(prefix + ".frag", function(fragmentSrc) {
                resolve(getShaderProgram(gl, prefix, vertexSrc, fragmentSrc));
            });
        });
    });
}