const MODEL_URL = './libs/models/';

let modelsLoaded = false;

/**
 * Compute the facial landmarks
 * @param {Image} img Handle to an image on which to compute facial landmarks
 * @param {float} pad Amount by which to pad the window around the facial landmarks (default 0.1)
 * @returns 
 */
async function getFacialLandmarks(img, pad) {
    if (!modelsLoaded) {
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
        await faceapi.loadFaceLandmarkModel(MODEL_URL);
        modelsLoaded = true;
    }
    if (pad === undefined) {
        pad = 0.1;
    }
    let fullFaceDescriptions = await faceapi.detectAllFaces(img).withFaceLandmarks();
    if (fullFaceDescriptions.length == 0) {
        console.log("No faces found!");
        return;
    }
    let points = [];
    for (i = 0; i < fullFaceDescriptions[0].landmarks.positions.length; i++) {
        X = fullFaceDescriptions[0].landmarks.positions[i].x;
        Y = fullFaceDescriptions[0].landmarks.positions[i].y;
        points.push([X, Y]);
    }
    maxX = points[0][0];
    minX = points[0][0];
    minY = points[0][1];
    maxY = points[0][1];
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
    maxX = maxX + img.width*pad;
    minX = minX - img.width*pad;
    maxY = maxY + img.height*pad;
    minY = minY - img.height*pad;
    points.push([minX,minY],[maxX,minY],[minX,maxY],[maxX,maxY],[0,0],[img.width,0],[0,img.height],[img.width,img.height]);
    return points;
}

/**
 * Callback once a square version of an image has been drawn, with padding
 * @param {Image} image A Javascript handle to a square image
 */
function squareImageDrawn(image) {
    let texture = loadTexture(faceCanvas.gl, image);
    faceCanvas.updateTexture(texture);
    debugCanvas.img = image;
    requestAnimationFrame(activeCanvas.repaint.bind(activeCanvas));
    // Initialize facial landmarks
    getFacialLandmarks(image).then(points => {
        faceCanvas.animating = true;
        faceCanvas.setPoints(points);
        debugCanvas.updatePoints(points);
        requestAnimationFrame(activeCanvas.repaint.bind(activeCanvas));
    });
}

/**
 * Use an offscreen canvas to draw this image to a square region
 * @param {Image} image A Javascript image handle
 */
function imageLoaded(image) {
    let offscreenCanvas = document.createElement("canvas");
    let res = Math.max(image.width, image.height);
    offscreenCanvas.width = res;
    offscreenCanvas.height = res;
    let ctx = offscreenCanvas.getContext("2d");
    ctx.clearRect(0, 0, res, res);
    ctx.drawImage(image, 0, 0);

    let squareImg = new Image();
    squareImg.src = offscreenCanvas.toDataURL();
    squareImg.onload = function() {
        squareImageDrawn(squareImg);
    }
}