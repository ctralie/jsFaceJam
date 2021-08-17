
let FACE_TRIS = [34,52,35,34,33,52,33,51,52,63,53,52,52,53,35,62,63,52,51,62,52,50,62,51,33,50,51,66,65,63,63,65,53,30,32,33,33,32,50,30,33,34,35,30,34,67,66,62,62,66,63,49,61,50,50,61,62,55,64,53,53,54,35,30,31,32,32,31,50,56,55,65,65,55,53,55,54,64,64,54,53,61,67,62,66,56,65,59,67,61,57,56,66,31,49,50,58,66,67,58,57,66,35,29,30,30,29,31,28,29,42,59,58,67,49,59,61,48,60,49,49,60,59,31,48,49,60,48,59,47,29,35,29,40,31,2,3,48,46,47,35,47,42,29,42,27,28,28,40,29,14,46,35,47,43,42,46,43,47,42,22,27,55,10,54,15,45,46,9,10,55,9,55,56,9,56,8,56,57,8,38,39,21,27,39,28,8,57,58,10,11,54,11,12,54,39,40,28,14,35,54,46,44,43,45,44,46,12,13,54,13,14,54,7,58,59,7,8,58,6,7,59,21,39,27,39,38,40,40,41,31,22,42,43,38,41,40,48,6,59,5,6,48,14,15,46,4,5,48,38,37,41,3,4,48,48,31,2,37,36,41,2,31,41,23,44,24,23,43,44,23,22,43,38,20,37,1,2,41,25,44,45,15,16,45,18,17,36,22,21,27,23,21,22,16,26,45,25,24,44,36,1,41,26,25,45,21,20,38,36,0,1,23,20,21,69,20,23,68,19,20,20,19,37,17,0,36,18,36,37,19,18,37,11,71,12,12,71,13,13,71,14,14,71,15,15,69,16,10,71,11,9,71,10,8,71,9,7,70,8,8,70,71,6,70,7,5,70,6,4,70,5,3,70,4,2,70,3,1,70,2,68,70,1,16,69,26,26,69,25,25,69,24,24,69,23,71,69,15,69,68,20,19,68,18,18,68,17,17,68,0,0,68,1,72,68,73,68,69,73,73,69,75,69,71,75,71,74,75,71,70,74,70,72,74,68,72,70];
// Load the expressions
let expressions = loadJSON("ExpressionsModel.json","ERROR");

async function getFaces(img) {
    const MODEL_URL = './libs/models/';
    
    await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
    await faceapi.loadFaceLandmarkModel(MODEL_URL);

    let fullFaceDescriptions = await faceapi.detectAllFaces(img).withFaceLandmarks();

    points.length = 0;
    for (i=0; i < fullFaceDescriptions[0].landmarks.positions.length; i++) {
        X = fullFaceDescriptions[0].landmarks.positions[i].x;
        Y = fullFaceDescriptions[0].landmarks.positions[i].y;
        points.push([X, Y]);
    }
    maxX = points[0][0];
    minX = points[0][0];
    minY = points[0][1];
    maxY = points[0][1];
    pad = 0.1;
    for (i = 0; i < points.length; i++) {
        if (points[i][0] > maxX) {
            maxX = points[i][0];
        } else if (points[i][0] < minX) {
            minX = points[i][0];
        }

        if (points[i][1] > maxY) {
            maxY = points[i][1];
        } else if (points[i][1] < minY) {
            minY = points[i][1];
        }
    }

    maxX = maxX + img.width*pad;
    minX = minX - img.width*pad;
    maxY = maxY + img.height*pad;
    minY = minY - img.height*pad;
    points.push([minX,minY],[maxX,minY],[minX,maxY],[maxX,maxY],[0,0],[img.width,0],[0,img.height],[img.width,img.height]);
    updateDelaunay(img);
}
