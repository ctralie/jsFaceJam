const MODEL_URL = './libs/models/';

/**
 * Compute the facial landmarks
 * @param {Image} img Handle to an image on which to compute facial landmarks
 * @param {float} pad Amount by which to pad the window around the facial landmarks (default 0.1)
 * @returns 
 */
async function getFacialLandmarks(img, pad) {
    await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
    await faceapi.loadFaceLandmarkModel(MODEL_URL);

    if (pad === undefined) {
        pad = 0.1;
    }
    let fullFaceDescriptions = await faceapi.detectAllFaces(img).withFaceLandmarks();
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
