/**
 * HTML5 Canavs for debugging (drawing Delaunay triangles, etc)
 */
class DebugCanvas {
    constructor() {
        let canvas = document.getElementById('DebugCanvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.canvas = canvas;
        let ctx = canvas.getContext("2d"); //For drawing
        this.ctx = ctx;
        //Need this to disable that annoying menu that pops up on right click
        canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
        this.img = null;
        this.points = [];
        this.active = false;
    }

    setActive() {
        this.active = true;
        requestAnimationFrame(this.repaint.bind(this));
    }

    setInactive() {
        this.active = false;
    }

    /**
     * Update the points that will be drawn in this canvas
     * @param {2d array} points An array of points, each of which is a list [x, y]
     */
    updatePoints(points, W, H) {
        this.points = points;
    }

    repaint() {
        if (this.img === null) {
            return;
        }
		const dW = 5;
        let ctx = this.ctx;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Puts white over everything to clear it
        ctx.drawImage(this.img, 0, 0);
        for (let i = 0; i < FACE_TRIS.length; i += 3) {
            for (let k = 0; k < 3; k++) {
                if (FACE_TRIS[i+k] < this.points.length && FACE_TRIS[i+(k+1)%3] < this.points.length) {
                    let p = this.points[FACE_TRIS[i+k]];
                    let q = this.points[FACE_TRIS[i+(k+1)%3]];
                    ctx.beginPath();
                    ctx.moveTo(p[0],p[1]);
                    ctx.lineTo(q[0],q[1]);
                    ctx.stroke();
    
                    ctx.font = "10px Arial";
                    ctx.fillStyle = "white";
                    ctx.fillText(FACE_TRIS[i+k], this.points[FACE_TRIS[i+k]][0], this.points[FACE_TRIS[i+k]][1]);
                }
            }
        }
    }
}