attribute vec2 a_texture;
attribute vec2 a_position;

varying vec2 v_texture;
varying vec2 v_position;

void main() {
  gl_Position = vec4(a_position, 0, 1);
  v_texture = a_texture;
  v_position = a_position;
}