/**
 * Web worker for computing a 3D embedding of the audio features
 */
importScripts("jsanov/features.js");
importScripts("jsanov/libs/fft.min.js");
importScripts("libs/numeric-1.2.6.min.js");
importScripts("matrixutils.js");

/**
 * Create a 3D projection of the data
 */
onmessage = function(event) {
    let samples = event.data.samples;
    let win = event.data.win;
    let hop = event.data.hop;
    let sr = event.data.sr;
    let nfeatures = event.data.nfeatures;
    postMessage({type:"newTask", taskString:"Computing audio novelty function"});
    getSuperfluxNovfn(samples, sr, win, hop).then(result => {
        let S = result.S;
        let novfn = result.novfn;
        // Step 1: Normalize the audio novelty function
        postMessage({type:"newTask", taskString:"Normalizing audio novelty function"});
        let max = 0;
        for (let i = 0; i < novfn.length; i++) {
            max = Math.max(max, novfn[i]);
        }
        for (let i = 0; i < novfn.length; i++) {
            novfn[i] /= max;
        }
        // Step 2: Extract beats
        postMessage({type:"newTask", taskString:"Finding beats"});
        let beats = getBeats(novfn, sr, hop, 120, 1);
        let beatRamp = getRampBeats(novfn, beats);
        // Step 3: Compute other types of features
        postMessage({type:"newTask", taskString:"Computing spectrogram features"});
        let Y = [];
        // Allocate space for features
        for (let i = 0; i < novfn.length; i++) {
            Y.push(new Float32Array(nfeatures));
            // First feature is spectral flux
            Y[i][0] = novfn[i];
        }
        postMessage({type:"newTask", taskString:"Computing spectral centroid"});
        let centroid = getSpectralCentroid(S);
        for (let i = 0; i < novfn.length; i++) {
            Y[i][1] = centroid[i];
        }
        postMessage({type:"newTask", taskString:"Computing spectral roloff"});
        let roloff = getSpectralRoloff(S);
        for (let i = 0; i < novfn.length; i++) {
            Y[i][2] = roloff[i];
        }
        // Step 4: Normalize features
        postMessage({type:"newTask", taskString:"Normalizing Features"});
        Y = getSTDevNorm(Y);

        postMessage({type:"end", novfn:novfn, beatRamp:beatRamp, Y:Y});

    }).catch(reason => {
        postMessage({type:"error", taskString:reason});
    });
}
