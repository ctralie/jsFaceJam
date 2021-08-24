/**
 * Utilities for computing facial landmarks, transferring expressions, and
 * resizing facial images to fit the GL canvas
 */

const vec3 = glMatrix.vec3;
const vec2 = glMatrix.vec2;
const MODEL_URL = './libs/models/';
const BBOX_PAD = 0.1;
let landmarkModelsLoaded = false;


/**
 * Compute a set of points that will be added to the end of a facial landmark
 * point cloud.  The new points consist of a padded bounding box around the
 * landmarks, as well as a box around the entire image
 * 
 * @param {array} points List of 2D points for facial landmarks
 * @param {float} width Width of image on which facial landmarks were computed
 * @param {float} height Height of image on which facial landmarks were computed
 * @returns An array of the new points
 */
function getBBoxPaddedPoints(points, width, height) {
    let maxX = points[0][0];
    let minX = points[0][0];
    let minY = points[0][1];
    let maxY = points[0][1];
    for (i = 0; i < points.length; i++) {
        if (points[i][0] > maxX) {
            maxX = points[i][0];
        } 
        else if (points[i][0] < minX) {
            minX = points[i][0];
        }
        if (points[i][1] > maxY) {
            maxY = points[i][1];
        } 
        else if (points[i][1] < minY) {
            minY = points[i][1];
        }
    }
    maxX = maxX + width*BBOX_PAD;
    minX = minX - width*BBOX_PAD;
    maxY = maxY + height*BBOX_PAD;
    minY = minY - height*BBOX_PAD;
    return [[minX,minY],[maxX,minY],[minX,maxY],[maxX,maxY],[0,0],[width,0],[0,height],[width,height]];
}

// Initialize an unrolled model center with bounding box points
let CMODEL = [];
let cpoints = [];
for (let i = 0; i < FACE_EXPRESSIONS.center.length; i+=2) {
    CMODEL.push(FACE_EXPRESSIONS.center[i]);
    CMODEL.push(FACE_EXPRESSIONS.center[i+1]);
    cpoints.push([FACE_EXPRESSIONS.center[i], FACE_EXPRESSIONS.center[i+1]]);
}
cpoints = getBBoxPaddedPoints(cpoints, FACE_MODEL_WIDTH, FACE_MODEL_HEIGHT);
for (let i = 0; i < cpoints.length; i++) {
    CMODEL.push(cpoints[i][0]);
    CMODEL.push(cpoints[i][1]);
}
// Compute delaunay triangulation
const CMODEL_DELAUNAY = new Delaunator(CMODEL);
const FACE_TRIS = CMODEL_DELAUNAY._triangles;
// Create quick lookup structure for adjacent triangles
const ADJACENT_TRIS = [];
for (let i = 0; i < CMODEL.length; i++) {
    ADJACENT_TRIS.push([]);
}
for (let ti = 0; ti < FACE_TRIS.length/3; ti++) {
    for (let k = 0; k < 3; k++) {
        ADJACENT_TRIS[FACE_TRIS[ti*3+k]].push(ti);
    }
}

/**
 * Compute the facial landmarks
 * @param {Image} img Handle to an image on which to compute facial landmarks
 * @returns 
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
        return;
    }
    let points = [];
    for (i = 0; i < fullFaceDescriptions[0].landmarks.positions.length; i++) {
        X = fullFaceDescriptions[0].landmarks.positions[i].x;
        Y = fullFaceDescriptions[0].landmarks.positions[i].y;
        points.push([X, Y]);
    }
    let bboxPoints = getBBoxPaddedPoints(points, img.width, img.height);
    for (let i = 0; i < bboxPoints.length; i++) {
        points.push(bboxPoints[i]);
    }
    return points;
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
 * @param {int} ti Triangle index
 * @returns [a, b, c] on the triangle, as vec3 objects
 */
function getTri(ti) {
    let a = [CMODEL[FACE_TRIS[ti*3]*2], CMODEL[FACE_TRIS[ti*3]*2+1], 0];
    let b = [CMODEL[FACE_TRIS[ti*3+1]*2], CMODEL[FACE_TRIS[ti*3+1]*2+1], 0];
    let c = [CMODEL[FACE_TRIS[ti*3+2]*2], CMODEL[FACE_TRIS[ti*3+2]*2+1], 0];
    return [a, b, c];
}

/**
 * In the below: X refers to model, Y refers to new face image that's been inputted
 * Given that we have N landmarks, given the expression model expressions,
 * and given a set of coordinates "epsilon" to apply to the model
 * 1) Apply the coordinates to the model (coords = center + PCs*epsilon)
 * 2) Unravel the coordinates into XModelNew (N x 2).  Now we have 2D coordinates 
 *      for the *model face* in a new expression determined by epsilon
 * 3) Apply eyebrow motion by moving eyebrow landmarks vertically.  This assumes
 *    the head is aligned vertically in the model
 * 4) Come up with barycentric coordinates alpha_i and triangle index T_i 
 *      for every x_i in XModelNew
 * 5) Given Y (N x 2), the coordinates of the new face landmarks.  For each
 *      y_i in Y, apply alpha_i to triangle T_i, using the appropriate coordinates
 *      Y as the vertices of triangle T_i
 *      In particular, if alpha_i = (scalar a, scalar b, scalar c), 
 *      and T_i = (vector y_a, vector y_b, vector y_c)
 *      final re-positioning of y_i = a*y_a + b*y_b + c*y_c
 * @param {array} epsilon The coordinates of the expression
 * @param {array} Y An Nx2 array of the coordinates of the new face landmarks, assumed
 *                  to be in a neutral expression
 * @param {float} dEyebrow Signed amount of eyebrow movement (default 0)
 * 
 * @return {array} An Nx2 array with the new facial landmarks
 */
 function transferFacialExpression(epsilon, Y, dEyebrow) {
    if (dEyebrow === undefined) {
        dEyebrow = 0;
    }
    let tic = (new Date()).getTime();
    // Step 1: Apply the coordinates to the model (coords = center + PCs*epsilon)
    let points1D = numeric.add(numeric.dot(FACE_EXPRESSIONS.PCs,epsilon), FACE_EXPRESSIONS.center);
    // Step 2: Unravel into 2D array
    let XModelNew = [];
    for (let i = 0; i < points1D.length; i += 2) {
        // Make 3D with implied z=0 so we can use vec3
        XModelNew.push([points1D[i],points1D[i+1], 0]); 
    }
    // Step 3: Apply eyebrow motion
    if (dEyebrow != 0) {
        for (let i = EYEBROW_START; i <= EYEBROW_END; i++) {
            XModelNew[i][1] += dEyebrow;
        }
    }
    // Step 4: Do point location on every point in XModelNew with respect to the 
    // mean face, and compute barycentric coordinates
    let TIdx = [];
    let coords = [];
    let touched = []; // Keep track of the last vertex that checked this triangle
    for (let i = 0; i < FACE_TRIS.length/3; i++) {
        touched.push(-1);
    }
    let foundLast = 0;
    for (let i = 0; i < XModelNew.length; i++) {
        coords[i] = [1, 0, 0];
        TIdx.push(-1);
        // First check the adjacent triangles
        let k = 0;
        while(k < ADJACENT_TRIS[i].length && TIdx[i] == -1) {
            let ti = ADJACENT_TRIS[i][k];
            touched[ti] = i;
            let abcd = getTri(ti);
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
                    let abcd = getTri(ti);
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
    // Step 5: Transfer the barycentric coordinates to the new face
    let YNew = [];
    for (let i = 0; i < XModelNew.length; i++) {
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
    // Append on the last 8 points for the bounding box of Y
    for (let i = 0; i < 8; i++) {
        YNew.push(Y[Y.length-8+i]);
    }
    let toc = (new Date()).getTime();
    //console.log("Elapsed time point location: ", toc-tic, ", foundLast = ", foundLast, "of", XModelNew.length);
    return YNew;
}


/**
 * Callback once a square version of an image has been drawn, with padding
 * @param {Image} image A Javascript handle to a square image
 */
function squareImageDrawn(image) {
    let texture = loadTexture(faceCanvas.gl, image);
    faceCanvas.updateTexture(texture);
    // Initialize facial landmarks
    getFacialLandmarks(image).then(points => {
        faceCanvas.setPoints(points);
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
}
