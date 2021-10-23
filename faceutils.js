/**
 * Utilities for computing facial landmarks, transferring expressions, and
 * resizing facial images to fit the GL canvas
 */

const vec3 = glMatrix.vec3;
const vec2 = glMatrix.vec2;
const MODEL_URL = './libs/models/';
let landmarkModelsLoaded = false;


/**
 * Compute the facial landmarks
 * @param {Image} img Handle to an image on which to compute facial landmarks
 * @returns {   
 *           "faces": A list of facial landmarks of all of the faces present in 
 *                   the image, including the 4 bounding box points for each one
 *           "width": Width of the image
 *           "height": Height of the image
 *          }
 */
async function getFacialLandmarks(img) {
    if (!landmarkModelsLoaded) {
        progressBar.loadString = "Loading face model (this will take a moment the first time)";
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
        await faceapi.loadFaceLandmarkModel(MODEL_URL);
        landmarkModelsLoaded = true;
    }
    progressBar.loadString = "Computing facial landmarks";
    let fullFaceDescriptions = await faceapi.detectAllFaces(img).withFaceLandmarks();
    if (fullFaceDescriptions.length == 0) {
        progressBar.setLoadingFailed("No faces found!  Try another image");
        return [];
    }
    let faces = [];
    for (let f = 0; f < fullFaceDescriptions.length; f++) {
        let points = [];
        for (i = 0; i < fullFaceDescriptions[f].landmarks.positions.length; i++) {
            X = fullFaceDescriptions[f].landmarks.positions[i].x;
            Y = fullFaceDescriptions[f].landmarks.positions[i].y;
            points.push([X, Y]);
        }
        let bboxPoints = getBBoxPaddedPoints(points);
        for (let i = 0; i < bboxPoints.length; i++) {
            points.push(bboxPoints[i]);
        }
        faces.push(points);
    }
    return {"faces":faces, "width":img.width, "height":img.height};
}


/**
 * Construct a vector from a to be using the glMatrix library
 * @param {vec3} x Tail of new vector
 * @param {vec3} y Tip of new vector
 */
 function fromXToY(x, y) {
    let ret = vec3.create();
    vec3.subtract(ret, y, x);
    return ret;
}

/**
 * Given three 3D vertices a, b, and c, compute the area 
 * of the triangle they span
 * @param {vec3} a First point
 * @param {vec3} b Second point
 * @param {vec3} c Third point
 * 
 * @return {float} Area of the triangle
 */
 function getTriangleArea(a, b, c) {
    let ab = fromXToY(a, b);
    let ac = fromXToY(a, c);
    let cross = vec3.create();
    vec3.cross(cross, ab, ac);
    return Math.sqrt(vec3.dot(cross, cross))/2;
}

/**
 * Compute the barycentric coordinates of a point p with respect to a triangle /\abc
 * 
 * @param {vec3} a Point a on the triangle
 * @param {vec3} b Point b on the triangle
 * @param {vec3} c Point c on the triangle
 * @param {vec3} p The point whose barycentric coordinates we seek
 * 
 * @return {vec3} An vec3 with the barycentric coordinates (alpha, beta, gamma)
 * 				  corresponding to a, b, and c, respectively, so that
 * 				  alpha + beta + gamma = 1, and alpha, beta, gamma >= 0
 * 				  If p is not inside of /\abc, then return []
 */
 function getBarycentricCoords(a, b, c, p) {
	let coords = [];
	let area_abc = getTriangleArea(a, b, c);
	if (area_abc == 0) {
		// For zero area triangle, return (1, 0, 0)
		// if p = a = b = c, or (0, 0, 0) otherwise
		let v = vec3.create();
		vec3.subtract(v, p, a);
		if (vec3.length(v) == 0) {
			coords = [1, 0, 0];
		}
    }
    else {
        let tri = [a, b, c];
        var total_area = 0.0;
        for (var i = 0; i < 3; i++) {
            let area = getTriangleArea(tri[(i+1)%3], tri[(i+2)%3], p);
            coords[i] = area/area_abc;
            total_area += area;
        }
        let eps = 1e-5;
        if (total_area > area_abc*(1+eps)) {
            // If it's outside, reset the coords to zero
            coords = [];
        }
    }
	return coords;
}

/**
 * Get the coordinates of the 3 points on a particular triangle in
 * the facemodel
 * @param {array} X 2D array of points
 * @param {array} tris 2D array of triangle indices
 * @param {int} ti Triangle index
 * @returns [a, b, c] on the triangle, as vec3 objects
 */
function getTri(X, tris, ti) {
    let a = [X[tris[ti*3]][0], X[tris[ti*3]][1], 0];
    let b = [X[tris[ti*3+1]][0], X[tris[ti*3+1]][1], 0];
    let c = [X[tris[ti*3+2]][0], X[tris[ti*3+2]][1], 0];
    return [a, b, c];
}

/**
 * In the below: X refers to model, Y refers to new face image that's been inputted
 * Given that we have N landmarks, given a particular facial expression, and given 
 * the activation to apply to that expression
 * 1) Figure out a facial frame in the trajectory of the facial expression, using
 *    linear interpolation, and put it into the array XModelNew (N x 2).  
 *    Now we have 2D coordinates for the new expression determined by activation
 * 2) Apply eyebrow motion by moving eyebrow landmarks vertically.  This assumes
 *    the head is aligned vertically in the model
 * 3) Come up with barycentric coordinates alpha_i and triangle index T_i 
 *      for every x_i in XModelNew
 * 4) Given Y (N x 2), the coordinates of the new face landmarks.  For each
 *      y_i in Y, apply alpha_i to triangle T_i, using the appropriate coordinates
 *      Y as the vertices of triangle T_i
 *      In particular, if alpha_i = (scalar a, scalar b, scalar c), 
 *      and T_i = (vector y_a, vector y_b, vector y_c)
 *      final re-positioning of y_i = a*y_a + b*y_b + c*y_c
 * @param {string} expression 
 * @param {array} Y An Nx2 array of the coordinates of the new face landmarks, assumed
 *                  to be in a neutral expression
 * @param {array} activation How much the expression is activated
 * @param {float} dEyebrow Signed amount of eyebrow movement (default 0)
 * 
 * @return {array} An Nx2 array with the new facial landmarks
 */
 function transferFacialExpression(expression, Y, activation, dEyebrow) {
    if (activation === undefined) {
        activation = 0;
    }
    if (dEyebrow === undefined) {
        dEyebrow = 0;
    }
    let tic = (new Date()).getTime();
    // Step 1: Figure out facial expression
    if (!(expression in FACE_EXPRESSIONS)) {
        console.log("ERROR: Looking for expression " + expression + ", which does not exist");
        return Y;
    }
    let frames = FACE_EXPRESSIONS[expression];
    let idx = activation*(frames.length-1);
    let i1 = Math.floor(idx);
    let i2 = Math.ceil(idx);
    let dt = idx - i1;
    let XModelNew = [];
    for (let i = 0; i < frames[0].length; i++) {
        // Make 3D with implied z=0 so we can use vec3
        let x = (1-dt)*frames[i1][i][0] + dt*frames[i2][i][0];
        let y = (1-dt)*frames[i1][i][1] + dt*frames[i2][i][1];
        XModelNew.push([x, y, 0]); 
    }
    // Step 2: Apply eyebrow motion
    if (dEyebrow != 0) {
        for (let i = EYEBROW_START; i <= EYEBROW_END; i++) {
            XModelNew[i][0] = frames[0][i][0];
            XModelNew[i][1] = frames[0][i][1] + dEyebrow;
        }
    }
    // Step 3: Do point location on every point in XModelNew with respect to the 
    // mean face, and compute barycentric coordinates
    let TIdx = [];
    let coords = [];
    let touched = []; // Keep track of the last vertex that checked this triangle
    for (let i = 0; i < FACE_TRIS.length/3; i++) {
        touched.push(-1);
    }
    let foundLast = 0;
    // Do point location on all but the 4 bbox points
    for (let i = 0; i < XModelNew.length - 4; i++) { 
        coords[i] = [1, 0, 0];
        TIdx.push(-1);
        // First check the adjacent triangles
        let k = 0;
        while(k < ADJACENT_TRIS[i].length && TIdx[i] == -1) {
            let ti = ADJACENT_TRIS[i][k];
            touched[ti] = i;
            let abcd = getTri(frames[0], FACE_TRIS, ti);
            abcd.push(XModelNew[i]);
            let coordsi = getBarycentricCoords.apply(null, abcd);
            if (coordsi.length > 0) {
                TIdx[i] = ti;
                coords[i] = coordsi;
            }
            k++;
        }
        if (TIdx[i] == -1) {
            foundLast++;
            // Did not find in the adjacent triangles, so switch to 
            // brute force (TODO: Could be improved with half-edge based
            // breadth first search)
            let ti = 0;
            while(ti < FACE_TRIS.length/3 && TIdx[i] == -1) {
                if (touched[ti] < i) {
                    touched[ti] = i;
                    let abcd = getTri(frames[0], FACE_TRIS, ti);
                    abcd.push(XModelNew[i]);
                    let coordsi = getBarycentricCoords.apply(null, abcd);
                    if (coordsi.length > 0) {
                        TIdx[i] = ti;
                        coords[i] = coordsi;
                    }
                }
                ti++;
            }
        }
    }
    // Step 4: Transfer the barycentric coordinates of all but the last 4
    // bbox points to the new face
    let YNew = [];
    for (let i = 0; i < XModelNew.length-4; i++) {
        let ti = TIdx[i];
        let y = vec2.create();
        if (ti > -1) {
            let a = Y[FACE_TRIS[ti*3]];
            let b = Y[FACE_TRIS[ti*3+1]];
            let c = Y[FACE_TRIS[ti*3+2]];
            vec2.scaleAndAdd(y, y, a, coords[i][0]);
            vec2.scaleAndAdd(y, y, b, coords[i][1]);
            vec2.scaleAndAdd(y, y, c, coords[i][2]);
        }
        else {
            y = Y[i];
        }
        YNew.push(y);
    }
    // Append on the last 4 points for the bounding box of Y
    for (let i = 0; i < 4; i++) {
        YNew.push(Y[Y.length-4+i]);
    }
    
    let toc = (new Date()).getTime();
    //console.log("Elapsed time point location: ", toc-tic, ", foundLast = ", foundLast, "of", XModelNew.length);
    return YNew;
}


/**
 * Use an offscreen canvas to draw this image to a square region with a watermark
 * @param {Image} image A Javascript image handle
 */
function makeWatermark(image) {
    let offscreenCanvas = document.createElement("canvas");
    let res = Math.max(image.width, image.height);
    let dw = image.width/res;
    let dh = image.height/res;
    res = Math.min(1024, res);
    offscreenCanvas.width = res;
    offscreenCanvas.height = res;
    let ctx = offscreenCanvas.getContext("2d");
    ctx.clearRect(0, 0, res, res);
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, res*dw, res*dh);
    ctx.font = Math.round(24*res/512)+"px Arial";
    ctx.strokeText("www.facejam.app", 10*res/512, 20*res/512);

    let squareImg = new Image();
    squareImg.src = offscreenCanvas.toDataURL();
    squareImg.onload = function() {
        let texture = loadTexture(faceCanvas.gl, squareImg);
        faceCanvas.updateWTexture(texture);
    }
}

/**
 * Callback once a square version of an image has been drawn, with padding
 * @param {Image} image A Javascript handle to a square image
 */
function squareImageDrawn(image) {
    let texture = loadTexture(faceCanvas.gl, image);
    faceCanvas.updateTexture(texture);
    // Initialize facial landmarks
    getFacialLandmarks(image).then(res => {
        faceCanvas.setFacePoints(res.faces, res.width, res.height);
    });
}

/**
 * Use an offscreen canvas to draw this image to a square region
 * @param {Image} image A Javascript image handle
 */
function imageLoaded(image) {
    let offscreenCanvas = document.createElement("canvas");
    let res = Math.max(image.width, image.height);
    let dw = image.width/res;
    let dh = image.height/res;
    res = Math.min(1024, res);
    offscreenCanvas.width = res;
    offscreenCanvas.height = res;
    let ctx = offscreenCanvas.getContext("2d");
    ctx.clearRect(0, 0, res, res);
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, res*dw, res*dh);

    let squareImg = new Image();
    squareImg.src = offscreenCanvas.toDataURL();
    squareImg.onload = function() {
        squareImageDrawn(squareImg);
    }
    makeWatermark(image);
}
