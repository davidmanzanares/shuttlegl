import Cache from './cache';
import { triangleFillVertexGLSL, triangleFillFragmentGLSL } from './shaders';
import { Matrix3, Matrix4, Vector3 } from 'math.gl';

// Parts of the code copied and/or modified from https://github.com/CartoDB/carto-vl/blob/master/src/renderer/shaders/utils.js
// licensed under the BSD-3 license

const shaderCache = new Cache();
const programCache = new Cache();
let programID = 1;

class VAO {
    constructor(gl, vertexList) {
        this.gl = gl;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexList), gl.STATIC_DRAW);
        this.vertexCount = vertexList.length / 3;
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
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
        this.gl.uniformMatrix4fv(location, false, value);
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

    rotateHorizontally(dh){
        this.horizontalRotation = (this.horizontalRotation + dh) % (Math.PI * 2);
    }
    rotateVertically(dv){
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

    getViewMatrix(){
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
    return new VAO(gl, polygonList[0]);
}

export function createShaderPolygonFill(gl) {
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

export function createView(...args){
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

export function clamp (x, min, max) {
    return Math.max(Math.min(x, max), min);
}
