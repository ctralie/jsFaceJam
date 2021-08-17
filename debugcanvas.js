/**
 * HTML5 Canavs for debugging (drawing Delaunay triangles, etc)
 */
class DebugCanvas {
    constructor() {
        let canvas = document.getElementById('DebugCanvas');
        this.canvas = canvas;
        let ctx = canvas.getContext("2d"); //For drawing
        this.ctx = ctx;
        //Need this to disable that annoying menu that pops up on right click
        canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
        this.img = null;
        this.points = [];
    }

    repaint() {
        if (this.img === null) {
            return;
        }
		const dW = 5;
        let ctx = this.ctx;
		ctx.clearRect(0, 0, W, H); // Puts white over everything to clear it
        ctx.drawImage(this.img, 0, 0);
        for (let i = 0; i < FACE_TRIS.length; i += 3) {
            for (let k = 0; k < 3; k++) {
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