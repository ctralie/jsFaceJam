/** The file that puts everything together for running */
(function() {
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    window.requestAnimationFrame = requestAnimationFrame;
  })();

let faceCanvas = new FaceCanvas();
faceCanvas.setActive();
let audio = new SampledAudio();
let progressBar = new ProgressBar();

/********************************************************
 *                 PICTURE MENUS                        *
 ********************************************************/
let examplePictureMenu = document.getElementById("ExamplePictures");
examplePictureMenu.addEventListener('change', function(e){
    let image = new Image();
    image.src = e.target.value;
    image.onload = function() {
        imageLoaded(image);
    }
    progressBar.startLoading();
});

let imageInput = document.getElementById('imageInput');
imageInput.addEventListener('change', function(e) {
    let reader = new FileReader();
    reader.onload = function(e) {
        let arrayBufferView = new Uint8Array(e.target.result);
        let blob = new Blob([arrayBufferView], {type: imageInput.files[0].type});
        let urlCreator = window.URL || window.webkitURL;
        let imageUrl = urlCreator.createObjectURL(blob);
        let image = new Image();
        image.src = imageUrl;
        console.log(e.target.result);
        image.onload = function() {
            imageLoaded(image);
        }
    }
    reader.readAsArrayBuffer(imageInput.files[0]);
    progressBar.startLoading();
});


/********************************************************
 *                    TUNE MENUS                        *
 ********************************************************/

let exampleTuneMenu = document.getElementById("ExampleTunes");
exampleTuneMenu.addEventListener('change', function(e){
    audio.loadFile(e.target.value).then(function(){
        progressBar.changeToReady("Finished loading audio");
        faceCanvas.connectAudio(audio);
    });
    progressBar.loadString = "Loading audio";
    progressBar.startLoading();
});

const clientID = "3e2dfda5badd4c5bb3a0945288629c1e";
const redirectURI = "http://127.0.0.1:5500";
let spotify = new Spotify("spotifyDiv", clientID, redirectURI, audio, function() {
    progressBar.changeToReady("Finished loading audio");
    faceCanvas.connectAudio(audio);
},
function() {
    progressBar.setLoadingFailed("Failed to load Spotify audio 😿");
});

let tuneInput = document.getElementById('tuneInput');
tuneInput.addEventListener('change', function(e) {
    let reader = new FileReader();
    reader.onload = function(e) {
        audio.setSamplesAudioBuffer(e.target.result).then(function(){
            progressBar.changeToReady("Finished loading audio");
            faceCanvas.connectAudio(audio);
        });
    }
    reader.readAsArrayBuffer(tuneInput.files[0]);
    progressBar.loadString = "Loading audio";
    progressBar.startLoading();
});

function startRecording() {
    progressBar.startLoading();
    audio.startRecording("start", "stop");
    progressBar.loadString = "Recording audio";
}
function stopRecording() {
    audio.stopRecording().then(function(){
        progressBar.changeToReady("Finished loading audio");
        faceCanvas.connectAudio(audio);
    });
}

/********************************************************
 *                  OTHER BUTTONS                       *
 ********************************************************/
function downloadVideo() {
    faceCanvas.startVideoCapture();
}