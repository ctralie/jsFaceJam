"""
Some code from Chris Tralie's original FaceJam to compute
PCA of facial landmarks after doing Procrustes alignment
"""

import numpy as np
from scipy.spatial import tsearch
from sklearn.decomposition import PCA
import scipy.misc
import scipy.io as sio
import matplotlib.pyplot as plt
import matplotlib.image as mpimage
import os
import imageio
import subprocess

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


def getFaceModel(n_components=10, doPlot = False):
    """
    Do Procrustes alignment on all of the frames to align them
    to the first frame, and do PCA down to some number
    Parameters
    ----------
    n_components: int
        Number of principal components to compute
    """
    allkeypts = sio.loadmat("frames/allkeypts.mat")["X"]
    print(allkeypts.shape)
    allkeypts = allkeypts[:, 0:-8, :] # Discard the bounding boxes
    Y = allkeypts[0, :, :].T
    
    ## Step 1: Do procrustes to align all frames to first frame
    for i in range(1, allkeypts.shape[0]):
        X = allkeypts[i, :, :].T
        Cx, Cy, R = getProcrustesAlignment(X[:, 0:-4], Y[:, 0:-4], np.arange(X.shape[1]-4))
        XNew = X - Cx
        XNew = R.dot(XNew)
        XNew += Cy
        XNew[:, -4::] = Y[:, -4::]
        allkeypts[i, :, :] = XNew.T
    
    ## Step 2: Now do PCA on the keypoints
    X = np.reshape(allkeypts, (allkeypts.shape[0], allkeypts.shape[1]*allkeypts.shape[2]))
    XC = np.mean(X, 0)[None, :]
    X -= XC
    pca = PCA(n_components=n_components)
    pca.fit(X)
    P = pca.components_.T
    sv = np.sqrt(pca.singular_values_)
    
    return {'XC':XC.flatten(), "P":P, "sv":sv, "allkeypts":allkeypts}

def plotPCs(res, N):
    """
    Plot principal components as scatterplots
    """
    XC, P, sv, allkeypts = res["XC"], res["P"], res["sv"], res["allkeypts"]
    k = int(np.ceil(np.sqrt(N+1)))
    plt.figure(figsize=(20, 20))
    plt.subplot(k, k, 1)
    plt.stem(sv)
    plt.title("Principal Component Standard Deviation")
    for i in range(N):
        Y = XC + sv[i]*P[:, i]
        XKey2 = np.reshape(Y, (allkeypts.shape[1], allkeypts.shape[2]))
        plt.subplot(k, k, i+2)
        plt.scatter(XKey2[:, 0], -XKey2[:, 1])
        plt.axis('equal')
        plt.title("Principal Component %i"%i)
    plt.savefig("principalaxes.png", bbox_inches='tight')

def makeEllipse(res, k1 = 0, k2 = 1):
    """
    Trace out an ellipse in the space of principal components
    """
    XC, P, sv = res["XC"], res["P"], res["sv"]
    NEllipse = 100
    t = np.linspace(0, 2*np.pi, NEllipse+1)[0:NEllipse]
    Y = np.zeros((P.shape[0], NEllipse))
    p1 = P[:, k1]
    p2 = P[:, k2]
    Y = XC[:, None] + sv[0]*p1[:, None]*np.cos(t[None, :]) + sv[1]*p2[:, None]*np.sin(t[None, :])
    Y = np.reshape(Y, (int(Y.shape[0]/2), 2, Y.shape[1]))
    Y[:, 1, :] = np.max(Y[:, 1, :]) - Y[:, 1, :]
    xmin = np.min(Y[:, 0, :])
    xmax = np.max(Y[:, 0, :])
    ymin = np.min(Y[:, 1, :])
    ymax = np.max(Y[:, 1, :])
    dx = xmax-xmin
    dy = ymax-ymin
    xmin -= 0.1*dx
    xmax += 0.1*dx
    ymin -= 0.1*dy
    ymax += 0.1*dy
    for i in range(Y.shape[2]):
        plt.clf()
        y = Y[:, :, i]
        plt.scatter(y[:, 0], y[:, 1])
        plt.xlim([xmin, xmax])
        plt.ylim([ymin, ymax])
        plt.axis('off')
        plt.savefig("Ellipse%i.png"%i, bbox_inches='tight')
    



if __name__ == '__main__':
    res = getFaceModel()
    #np.savetxt("center.txt", res['XC'].flatten(), fmt='%.3g', delimiter=',')
    #np.savetxt("sv.txt", res['sv'], fmt='%.3g', delimiter=',')
    #plotPCs(res, 10)
    makeEllipse(res, 3, 4)