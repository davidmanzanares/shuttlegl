export const lineVertexGLSL =
`#version 300 es

precision highp float;

in vec3 vertexA;
in vec3 vertexB;

uniform mat4 MVP;
uniform vec2 lineSize;
uniform float zOffset;

out vec3 va;
out vec3 vb;

void main(void) {
  int id = gl_VertexID;
  vec2 uv = vec2(0.);
  
  vec3 dir = normalize(vertexB-vertexA);
  vec4 projectedDir = MVP * vec4(dir, 0.);
  vec2 dir2D = normalize(projectedDir.xy);
  vec2 n = vec2(dir2D.y, -dir2D.x);
  uv=n;
  if (id % 6 == 2 || id % 6 == 5){
    uv=-n;
  }
  if (id % 3 < 3){
    uv -= dir2D;
  }else{
    uv += dir2D;
  }
  vec4 vertex = (MVP * vec4(vertexA, 1.));

  va = vertexA;
  vb = vertexB;

  vertex.z+=zOffset;
  gl_Position = vertex + vec4(uv*2.*lineSize*vertex.w, 0., 0.);
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
  // TODO: antialiasing and line ending
  //vec3 d = normalize(vb-va);
  // get va & vb in vec2 space
  // compute point to line distance in 2D
  // https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
  outColor = vec4(color);
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

uniform vec4 color;

out vec4 outColor;

void main(void) {
    outColor = color;
}

`;

export const pointVertexGLSL =
`#version 300 es

precision highp float;

in vec3 vertex;

uniform mat4 MVP;
uniform vec2 pointSize;
uniform float zOffset;
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
  vertex.z+=zOffset;
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