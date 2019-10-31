function doPCA(X) {
    N = X.length;
    d = X[0].length;
	//Step 3: Compute and subtract off mean
	let mean = numeric.rep([d], 0);
	for (i = 0; i < N; i++) {
		for (k = 0; k < d; k++) {
			mean[k] += X[i][k];
		}
	}
	for (var k = 0; k < d; k++) {
	    mean[k] /= N;
	}
	//Allocate new array for storing mean-centered
	Y = numeric.rep([N, d], 0);
	for (i = 0; i < N; i++) {
		for (k = 0; k < d; k++) {
			Y[i][k] = X[i][k] - mean[k];
		}
	}
	
	//Step 5: Do PCA
	B = numeric.dot(numeric.transpose(Y), Y);
	let res = numeric.eig(B);
	let E = res.E.x;
	let lambda = res.lambda.x;
	for (var i = 0; i < d; i++) {
	    //Change from variance into standard deviation
	    lambda[i] = Math.sqrt(lambda[i]/N);
	}
	return {E:E, lambda:lambda, mean:mean};
}
