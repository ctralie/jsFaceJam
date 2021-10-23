"""
Code to stabilize facial landmarks and extract particular expressions
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import median_filter
from skimage import io
import json

def getProcrustesAlignment(X, Y, idx):
    """
    Given correspondences between two point clouds, to center
    them on their centroids and compute the Procrustes alignment to
    align one to the other
    Parameters
    ----------
    X: ndarray(2, M) 
        Matrix of points in X
    Y: ndarray(2, M) 
        Matrix of points in Y (the target point cloud)
    
    Returns
    -------
    (Cx, Cy, Rx):
        Cx: 3 x 1 matrix of the centroid of X
        Cy: 3 x 1 matrix of the centroid of corresponding points in Y
        Rx: A 3x3 rotation matrix to rotate and align X to Y after
        they have both been centered on their centroids Cx and Cy
    """
    Cx = np.mean(X, 1)[:, None]
    #Pull out the corresponding points in Y by using numpy
    #indexing notation along the columns
    YCorr = Y[:, idx]
    #Get the centroid of the *corresponding points* in Y
    Cy = np.mean(YCorr, 1)[:, None]
    #Subtract the centroid from both X and YCorr with broadcasting
    XC = X - Cx
    YCorrC = YCorr - Cy
    #Compute the singular value decomposition of YCorrC*XC^T
    (U, S, VT) = np.linalg.svd(YCorrC.dot(XC.T))
    R = U.dot(VT)
    return (Cx, Cy, R)    


def getFaceModel(filepath, stabilize = False, doPlot = False):
    """
    Do Procrustes alignment on all of the frames to align them
    to the first frame, and pull out a few specific expressions
    Parameters
    ----------
    filepath: string
        Path to json file with this expression
    stabilize: boolean
        Whether to apply rigid Procrustes stabilization
    doPlot: boolean
        Whether to plot the landmarks to show stabilization
    """
    allkeypts = np.array(json.load(open(filepath)))
    allkeypts = allkeypts[:, 0:-8, :] # Discard the bounding boxes
    afterprocrustes = np.zeros_like(allkeypts)
    
    ## Step 1: Do procrustes to align all frames to first frame
    if stabilize:
        Y = allkeypts[0, :, :].T
        for i in range(1, allkeypts.shape[0]):
            X = allkeypts[i, :, :].T
            Cx, Cy, R = getProcrustesAlignment(X, Y, np.arange(X.shape[1]))
            XNew = X - Cx
            XNew = R.dot(XNew)
            XNew += Cy
            afterprocrustes[i, :, :] = XNew.T
    aftermedian = np.zeros_like(afterprocrustes)
    for k in range(2):
        aftermedian[:, :, k] = median_filter(afterprocrustes[:, :, k], size=(8, 1))
    
    if doPlot:
        xlim = [np.min(allkeypts[:, :, 0]), np.max(allkeypts[:, :, 0])]
        ylim = [np.min(allkeypts[:, :, 1]), np.max(allkeypts[:, :, 1])]
        plt.figure(figsize=(10, 10))
        for i in range(len(aftermedian)):
            plt.clf()
            plt.subplot(221)
            X = allkeypts[i, :, :]
            I = io.imread("frames/frames/{}.png".format(i+1))
            plt.imshow(I)
            plt.scatter(X[:, 0], X[:, 1], 2)
            plt.axis("off")

            plt.subplot(222)
            plt.scatter(X[:, 0], X[:, 1])
            plt.xlim(xlim)
            plt.ylim(ylim)
            plt.gca().invert_yaxis()
            plt.axis("off")
            plt.title("Original Landmarks")

            plt.subplot(223)
            X = afterprocrustes[i, :, :]
            plt.scatter(X[:, 0], X[:, 1])
            plt.xlim(xlim)
            plt.ylim(ylim)
            plt.gca().invert_yaxis()
            plt.axis("off")
            plt.title("Procrustes Aligned Landmarks")

            plt.subplot(224)
            X = aftermedian[i, :, :]
            plt.scatter(X[:, 0], X[:, 1])
            for k in range(X.shape[0]):
                plt.text(X[k, 0], X[k, 1], "%i"%k)
            plt.xlim(xlim)
            plt.ylim(ylim)
            plt.gca().invert_yaxis()
            plt.axis("off")
            plt.title("Median Smoothed Landmarks")

            plt.savefig("Processed{}.png".format(i), bbox_inches='tight')
    return aftermedian

res = getFaceModel("smile.json", stabilize=True, doPlot=False)
res = np.round(res, 1).tolist()
json.dump(res, open("smileres.json", "w"))