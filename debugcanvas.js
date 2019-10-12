/**
 * HTML5 Canavs for debugging (drawing Delaunay triangles, etc)
 */
function DebugCanvas() {
	let canvas = document.getElementById('DebugCanvas');
	let ctx = canvas.getContext("2d"); //For drawing
	//Need this to disable that annoying menu that pops up on right click
	canvas.addEventListener("contextmenu", function(e){ e.stopPropagation(); e.preventDefault(); return false; }); 
    this.canvas = canvas;
    this.ctx = ctx;
    this.img = null;

    this.repaint = function() {
        if (this.img === null) {
            return;
        }
		const dW = 5;
        let ctx = this.ctx;
		ctx.clearRect(0, 0, W, H); // Puts white over everything to clear it
        ctx.drawImage(img, 0, 0);

		ctx.fillStyle = [0, 0, 0];
		points.forEach(function(p) {
			ctx.fillRect(p.x-dW, p.y-dW, dW*2+1, dW*2+1);
		});

        for (let i = 0; i < tris.length; i += 3) {
            for (let k = 0; k < 3; k++) {
                let p = points[tris[i+k]];
                let q = points[tris[i+(k+1)%3]];
                ctx.beginPath();
                ctx.moveTo(p[0],p[1]);
                ctx.lineTo(q[0],q[1]);
                ctx.stroke();
            }
        }
    }

}


