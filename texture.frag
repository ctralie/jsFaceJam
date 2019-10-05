precision mediump float;


// The 2D position of the pixel in this fragment, interpolated via
// barycentric coordinates from positions of triangle vertices
varying vec2 v_position;
// The 2D texture coordinate in this fragment, interpolated via
// barycentric coordinates from positions of triangle vertices
varying highp vec2 v_texture;

uniform sampler2D uSampler;

uniform float uTime;

void main() {
    float c = cos(uTime);
    float s = sin(uTime);
    float x = v_texture.x;
    float y = v_texture.y;

    //Straight texture map
    gl_FragColor = texture2D(uSampler, v_texture);

    // Rotate in a circle around upper left    
    //gl_FragColor = texture2D(uSampler, vec2(c*x-s*y, s*x+c*y));

    // Translate in a circle around the center
    //gl_FragColor = texture2D(uSampler, vec2(x + c, y + s));
}
