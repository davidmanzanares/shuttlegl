import Cache from './cache';
import { triangleFillVertexGLSL, triangleFillFragmentGLSL, pointVertexGLSL, pointFragmentGLSL, lineVertexGLSL, lineFragmentGLSL } from './shaders';
import { Matrix3, Matrix4, Vector3 } from 'math.gl';
import { earclip } from './earclip';

// Parts of the code copied and/or modified from https://github.com/CartoDB/carto-vl/blob/master/src/renderer/shaders/utils.js
// licensed under the BSD-3 license

const shaderCache = new Cache();
const programCache = new Cache();
let programID = 1;

class VAO {
    constructor(gl, vertexList, ...extraVertexAttributes) {
        this.gl = gl;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexList), gl.STATIC_DRAW);
        this.vertexCount = vertexList.length / 3;
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        this.extraVertexBuffers = [];
        extraVertexAttributes.forEach((extraVertexAttrib, i) => {
            this.extraVertexBuffers.push(gl.createBuffer());
            gl.bindBuffer(gl.ARRAY_BUFFER, this.extraVertexBuffers[i]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(extraVertexAttrib), gl.STATIC_DRAW);
            // this.vertexCount = extraVertexAttrib.length / 3;
            // TODO support non 3-dimensions, float extra attribs
            gl.vertexAttribPointer(i + 1, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(i + 1);
        });
    }
    render() {
        this.gl.bindVertexArray(this.vao);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexCount);
    }
}

class Shader {
    constructor(gl, vertexGLSL, fragmentGLSL) {
        this.gl = gl;
        this.program = compileProgram(gl, vertexGLSL, fragmentGLSL);
    }
    use() {
        this.gl.useProgram(this.program);
    }
    uniform(name, value) {
        const location = this.gl.getUniformLocation(this.program, name);
        if (typeof value === 'number') {
            this.gl.uniform1f(location, value);
        } else if (value.length === 2) {
            this.gl.uniform2f(location, value[0], value[1]);
        } else if (value.length === 3) {
            this.gl.uniform3f(location, ...value);
        } else if (value.length === 4) {
            this.gl.uniform4f(location, ...value);
        } else if (value.length === 9) {
            this.gl.uniformMatrix3fv(location, false, value);
        } else if (value.length === 16) {
            this.gl.uniformMatrix4fv(location, false, value);
        } else {
            throw new Error(`Cannot deduce WebGL uniform call for the provided value`);
        }
    }
}

class View {
    constructor(camera = [0, 0, 0], horizontalRotation = Math.PI, verticalRotation = Math.PI / 2) {
        this.camera = new Vector3(camera);
        this.horizontalRotation = horizontalRotation;
        this.verticalRotation = verticalRotation;
    }

    moveForward(dx) {
        const movement = this.getForwardDirection().scale(dx);
        this.camera.add(movement);
    }
    moveSideways(dz) {
        const movement = this.getRightDirection().scale(dz);
        this.camera.add(movement);

    }
    moveVertically(dy) {
        const movement = this.getUpDirection().scale(dy);
        this.camera.add(movement);
    }

    rotateHorizontally(dh) {
        this.horizontalRotation = (this.horizontalRotation + dh) % (Math.PI * 2);
    }
    rotateVertically(dv) {
        this.verticalRotation = clamp(this.verticalRotation + dv, -Math.PI * 0.9, Math.PI * 0.9);
    }

    getForwardDirection() {
        return new Vector3(
            Math.sin(this.verticalRotation) * Math.cos(this.horizontalRotation), Math.cos(this.verticalRotation),
            Math.sin(this.verticalRotation) * Math.sin(this.horizontalRotation)
        );
    }
    getRightDirection() {
        return this.getForwardDirection().cross(this.getUpDirection());
    }
    getUpDirection() {
        return new Vector3(0, 1, 0);
    }

    getViewMatrix() {
        const view = {
            eye: this.camera,
            center: this.getForwardDirection().add(this.camera),
            up: this.getUpDirection()
        };
        const viewMatrix = (new Matrix4()).lookAt(view);
        return viewMatrix;
    }
}

export function createVAOfromPolygonList(gl, polygonList) {
    const triangleList = polygonList.flatMap(polygon => earclip(polygon));
    return new VAO(gl, triangleList);
}
export function createVAOfromPointList(gl, pointList) {
    let triangleList = [];
    for (let i = 0; i < pointList.length / 3; i++) {
        triangleList.push(
            pointList[3 * i],
            pointList[3 * i + 1],
            pointList[3 * i + 2],
            pointList[3 * i],
            pointList[3 * i + 1],
            pointList[3 * i + 2],
            pointList[3 * i],
            pointList[3 * i + 1],
            pointList[3 * i + 2],
        );
    }
    return new VAO(gl, triangleList);
}

// Create line VAO => 2 triangles per line, other vertex in second vertexattrib
// Create line Shader => move vertex by vertexID using line direction normal with matrix
// distance to ending points, distance to ray
export function createVAOfromLineList(gl, lineList) {
    let triangleList = [];
    let triangleListB = [];
    for (let i = 0; i < lineList.length / 6; i++) {
        triangleList.push(
            lineList[6 * i + 0],
            lineList[6 * i + 1],
            lineList[6 * i + 2],

            lineList[6 * i + 3],
            lineList[6 * i + 4],
            lineList[6 * i + 5],

            lineList[6 * i + 3],
            lineList[6 * i + 4],
            lineList[6 * i + 5],


            lineList[6 * i + 3],
            lineList[6 * i + 4],
            lineList[6 * i + 5],

            lineList[6 * i + 0],
            lineList[6 * i + 1],
            lineList[6 * i + 2],

            lineList[6 * i + 0],
            lineList[6 * i + 1],
            lineList[6 * i + 2],
        );
        triangleListB.push(
            lineList[6 * i + 3],
            lineList[6 * i + 4],
            lineList[6 * i + 5],

            lineList[6 * i + 0],
            lineList[6 * i + 1],
            lineList[6 * i + 2],

            lineList[6 * i + 0],
            lineList[6 * i + 1],
            lineList[6 * i + 2],


            lineList[6 * i + 0],
            lineList[6 * i + 1],
            lineList[6 * i + 2],

            lineList[6 * i + 3],
            lineList[6 * i + 4],
            lineList[6 * i + 5],

            lineList[6 * i + 3],
            lineList[6 * i + 4],
            lineList[6 * i + 5],
        );
    }
    return new VAO(gl, triangleList, triangleListB);
}

export function createShaderLine(gl) {
    return new Shader(gl, lineVertexGLSL, lineFragmentGLSL);
}


export function createShaderPoint(gl) {
    return new Shader(gl, pointVertexGLSL, pointFragmentGLSL);
}

export function createShaderPolygon(gl) {
    return new Shader(gl, triangleFillVertexGLSL, triangleFillFragmentGLSL);
}


export function compileProgram(gl, glslvertexShader, glslfragmentShader) {
    const code = glslvertexShader + glslfragmentShader;

    if (programCache.has(gl, code)) {
        return programCache.get(gl, code).program;
    }

    const shader = {};
    const vertexShader = compileShader(gl, glslvertexShader, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, glslfragmentShader, gl.FRAGMENT_SHADER);

    shader.program = gl.createProgram();

    gl.attachShader(shader.program, vertexShader);
    gl.attachShader(shader.program, fragmentShader);
    gl.linkProgram(shader.program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(shader.program, gl.LINK_STATUS)) {
        throw new Error(`Unable to link the shader program: ${gl.getProgramInfoLog(shader.program)}.`);
    }

    shader.programID = programID++;
    programCache.set(gl, code, shader);

    return shader.program;
}

export function createView(...args) {
    return new View(...args)
}

function compileShader(gl, sourceCode, type) {
    if (shaderCache.has(gl, sourceCode)) {
        return shaderCache.get(gl, sourceCode);
    }

    const shader = gl.createShader(type);
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`An error occurred compiling the shaders: ${log}\nSource:\n${sourceCode}`);
    }

    shaderCache.set(gl, sourceCode, shader);

    return shader;
}

class MeshRenderer {
    constructor(gl, polygonList) {
        this.gl = gl;
        this.pointShader = createShaderPoint(gl);
        this.lineShader = createShaderLine(gl);
        this.polygonShader = createShaderPolygon(gl);

        const points = polygonList.reduce((acc, x) => acc.concat(x));
        this.pointVAO = createVAOfromPointList(gl, points);

        const lines = [];
        polygonList.forEach(vertices => {
            for (let i = 0; i < vertices.length / 3; i++) {
                lines.push(
                    vertices[3 * i],
                    vertices[3 * i + 1],
                    vertices[3 * i + 2],
                )
                let j = i + 1;
                if (j === vertices.length / 3) {
                    j = 0;
                }
                lines.push(
                    vertices[3 * j],
                    vertices[3 * j + 1],
                    vertices[3 * j + 2],
                )
            }
        });
        this.lineVAO = createVAOfromLineList(gl, lines);

        const triangleList = polygonList.flatMap(polygon => earclip(polygon));
        const trianguleLines = [];
        for (let i = 0; i < triangleList.length / 9; i++) {
            trianguleLines.push(
                triangleList[9 * i + 0],
                triangleList[9 * i + 1],
                triangleList[9 * i + 2],
                triangleList[9 * i + 3],
                triangleList[9 * i + 4],
                triangleList[9 * i + 5],

                triangleList[9 * i + 3],
                triangleList[9 * i + 4],
                triangleList[9 * i + 5],
                triangleList[9 * i + 6],
                triangleList[9 * i + 7],
                triangleList[9 * i + 8],

                triangleList[9 * i + 6],
                triangleList[9 * i + 7],
                triangleList[9 * i + 8],
                triangleList[9 * i + 0],
                triangleList[9 * i + 1],
                triangleList[9 * i + 2],
            )
        }
        this.trianguleLinesVAO = createVAOfromLineList(gl, trianguleLines);

        this.polygonVAO = createVAOfromPolygonList(gl, polygonList);
    }
    render(modelViewProjectionMatrix, displayWidth, displayHeight) {
        if (this.pointVAO) {
            this.pointShader.use();
            this.pointShader.uniform('MVP', modelViewProjectionMatrix);
            this.pointShader.uniform('pointSize', [1 / displayWidth, 1 / displayHeight].map(x => x * 14.));
            this.pointShader.uniform('color', [0.01, 0.01, 0.01, 1]);
            this.pointVAO.render();
        }

        if (this.lineVAO) {
            this.lineShader.use();
            this.lineShader.uniform('MVP', modelViewProjectionMatrix);
            this.lineShader.uniform('lineSize', [1 / displayWidth, 1 / displayHeight].map(x => x * 2.));
            this.lineShader.uniform('color', [0.9, 0.1, 0.01, 0.8]);
            this.lineVAO.render();
        }

        if (this.trianguleLinesVAO) {
            this.lineShader.uniform('lineSize', [1 / displayWidth, 1 / displayHeight].map(x => x * 0.));
            this.lineShader.uniform('color', [0., 0.9, 0.3, 0.3]);
            this.trianguleLinesVAO.render();
        }

        if (this.polygonVAO) {
            this.polygonShader.use();
            this.polygonShader.uniform('MVP', modelViewProjectionMatrix);
            this.polygonShader.uniform('color', [0.3, 0.3, 0.6, 0.1]);
            this.polygonVAO.render();
        }
    }
}

export function createMeshRenderer(gl, polygonList) {
    return new MeshRenderer(gl, polygonList);
}

export function clamp(x, min, max) {
    return Math.max(Math.min(x, max), min);
}
