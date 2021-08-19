/**
 * A class to show loading progress
 */

function ProgressBar() {
    //A function to show a progress bar
    this.loading = false;
    this.loadString = "Loading";
    this.loadColor = "#cccc00";
    this.ndots = 0;
    this.waitingDisp = document.getElementById("pagestatus");
    this.startLoading = function() {
        this.loading = true;
        this.changeLoad();
    }
    this.changeLoad = function() {
        if (!this.loading) {
            return;
        }
        var s = "<h3><font color = \"" + this.loadColor + "\">" + this.loadString;
        for (var i = 0; i < this.ndots; i++) {
            s += ".";
        }
        s += "</font></h3>";
        this.waitingDisp.innerHTML = s;
        if (this.loading) {
            this.ndots = (this.ndots + 1)%12;
            setTimeout(this.changeLoad.bind(this), 200);
        }
    };
    this.changeToReady = function(message) {
        this.loading = false;
        if (message === undefined) {
            message = "Ready";
        }
        this.waitingDisp.innerHTML = "<h3><font color = \"#009900\">" + message + "</font></h3>";
    };
    this.setLoadingFailed = function(message) {
        if (message === undefined) {
            message = "Loading Failed :(";
        }
        this.loading = false;
        this.waitingDisp.innerHTML = "<h3><font color = \"red\">" + message + "</font></h3>";
    };
}