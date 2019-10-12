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
    points.push([minX,minY],[maxX,maxY],[minX,maxY],[maxX,minY],[0,0],[0,img.height],[img.width,0],[img.width,img.height]);
    updateDelaunay();
}
