export const triangleFillVertexGLSL =
`#version 300 es

precision highp float;

in vec3 vertex;

uniform mat4 MVP;

void main(void) {
  gl_Position = MVP * vec4(vertex, 1.);
}
`;

export const triangleFillFragmentGLSL =
`#version 300 es

precision highp float;

out vec4 outColor;

void main(void) {
    outColor = vec4(1.);
}

`;

export const vertexEntireScreen = `#version 300 es

precision highp float;
precision highp isampler2D;

in vec2 vertex;

uniform float aspectRatio;

out vec2 uv;
out vec2 uv2;

void main(void) {
  uv = vec2(vertex.x * aspectRatio, vertex.y);
  uv2 = vertex*0.5+vec2(0.5);
  gl_Position = vec4(vertex, 0.5, 1.);
}

`;