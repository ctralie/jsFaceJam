

/**
 * Load in string from a text file.
 * This function is blocking.
 * @param {string} filename Path to file
 * @param {string} errTxt Error text
 * 
 * @return {string} String from text file
 */
function loadTxt(filename, errTxt) {
    try {
        var request = new XMLHttpRequest();
        request.open("GET", filename, false);
        request.overrideMimeType("text/plain");
        request.send(null);
        return request.responseText;
    }
    catch(err) {
        if (errTxt === undefined) {
            errTxt = "";
        }
        alert("Error loading text file " + filename + ". " + errTxt);
        throw err;
    }
};


/**
 * A function that compiles a particular shader
 * @param {*} gl WebGL handle
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
 * 
 * @param {*} gl WebGL Handle
 * @param {string} prefix File prefix for shader.  It is expected that there
 * will be both a vertex shader named prefix.vert and a fragment
 * shader named prefix.frag
 * 
 * @returns{shaderprogram} An object holding the shaders linked together
 * and compiled/linked into a program
 */
function getShaderProgram(gl, prefix) {
    let vertexSrc = loadTxt(prefix + ".vert");
    let fragmentSrc = loadTxt(prefix + ".frag");
    let vertexShader = getShader(gl, vertexSrc, "vertex");
    let fragmentShader = getShader(gl, fragmentSrc, "fragment");

    let shader = gl.createProgram();
    gl.attachShader(shader, vertexShader);
    gl.attachShader(shader, fragmentShader);
    gl.linkProgram(shader);
    if (!gl.getProgramParameter(shader, gl.LINK_STATUS)) {
        alert("Could not initialize shader" + prefix);
    }
    shader.name = prefix;
    return shader;
}

