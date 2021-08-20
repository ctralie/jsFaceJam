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
        let beats = getBeats(novfn, sr, hop, 120, 100);
        let beatRamp = getRampBeats(novfn, beats);
        
        postMessage({type:"end", novfn:novfn, beatRamp:beatRamp, Y:[]});
    }).catch(reason => {
        postMessage({type:"error", taskString:reason});
    });
}
