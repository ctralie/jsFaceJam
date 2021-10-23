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
        // Step 2: Estimate tempo
        postMessage({type:"newTask", taskString:"Estimating tempo"});
        let tempoInfo = getACDFDFTTempo(novfn, hop, sr);
        let tempos = getKHighestTempos(tempoInfo.bpm, tempoInfo.strength, 6);
        tempos.sort(function(a, b){
            let diffa = Math.abs(a - 120);
            let diffb = Math.abs(b - 120);
            return diffa - diffb;
        }); // Go with tempos closest to 120 bpm first

        // Step 3: Extract beats
        postMessage({type:"newTask", taskString:"Finding beats"});
        let beats = getBeats(novfn, sr, hop, tempos[0], 1);
        let beatRamp = getRampBeats(novfn, beats);
        
        // Step 4: Extract energy
        postMessage({type:"newTask", taskString:"Computing energy"});
        let activation = getSpectrogramPower(S);
        max = 0;
        for (let i = 0; i < activation.length; i++) {
            if (activation[i] > max) {
                max = activation[i];
            }
        }
        for (let i = 0; i < activation.length; i++) {
            activation[i] /= max;
        }

        postMessage({type:"end", novfn:novfn, beatRamp:beatRamp, tempoInfo:tempoInfo, activation:activation});

    }).catch(reason => {
        postMessage({type:"error", taskString:reason});
    });
}
