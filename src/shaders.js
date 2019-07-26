export const lineVertexGLSL =
`#version 300 es

precision highp float;

in vec3 vertexA;
in vec3 vertexB;

uniform mat4 MVP;
uniform vec2 lineSize;

out vec3 va;
out vec3 vb;

void main(void) {
  int id = gl_VertexID % 3;
  vec2 uv = vec2(0.);
  if (id %3 == 2){
    vec3 dir = normalize(vertexA-vertexB);
    vec4 projectedDir = MVP * vec4(dir, 0.);
    vec2 dir2D = normalize(projectedDir.xy);
    uv=dir2D;
    if (gl_VertexID % 6 == 4){
      uv*=-1.;
    }
  }
  vec4 vertex = (MVP * vec4(vertexA, 1.));

  va = vertexA;
  vb = vertexB;

  gl_Position = vertex + vec4(uv*2.*0.02*vertex.w, 0., 0.);
}
`;

export const lineFragmentGLSL =
`#version 300 es

precision highp float;

in vec3 va;
in vec3 vb;

uniform vec4 color;

out vec4 outColor;

void main(void) {
  //outColor = d<0.49? color : vec4(0.);
  outColor = vec4(abs(normalize(va-vb)), 1.);
}
`;


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

export const pointVertexGLSL =
`#version 300 es

precision highp float;

in vec3 vertex;

uniform mat4 MVP;
uniform vec2 pointSize;

out vec2 uv;

void main(void) {
  int id = gl_VertexID % 3;
  if (id == 0){
    uv = vec2(0., 1.);
  } else if (id == 1){
    uv = vec2(0.866, -0.5);
  } else {
    uv = vec2(-0.866, -0.5);
  }
  vec4 vertex = (MVP * vec4(vertex, 1.));
  gl_Position = vertex + vec4(uv*2.*pointSize*vertex.w, 0., 0.);
}
`;

export const pointFragmentGLSL =
`#version 300 es

precision highp float;

in vec2 uv;

uniform vec4 color;

out vec4 outColor;

void main(void) {
  float d = length(uv);
  outColor = d<0.49? color : vec4(0.);
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