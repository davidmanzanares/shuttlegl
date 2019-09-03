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

    const vertexList = [];
    const normalList = [];
    for (let i=0; i<triangleList.length; i++){
        const t = triangleList[i];
        vertexList.push(t.pos.x, t.pos.y, t.pos.z);
        normalList.push(t.normal.x, t.normal.y, t.normal.z);
    }
    return new VAO(gl, vertexList, normalList);
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

export function createShader(gl, vertexGLSL, fragmentGLSL){
    return new Shader(gl, vertexGLSL, fragmentGLSL);
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
    constructor({
        gl,
        polygonList, 
        showPoints = true,
        showEdges = true,
        showTriangulationLines = true,
        showPolygons = true,

        customPolygonShader = null,
    }) {
        this.gl = gl;
        this.pointShader = createShaderPoint(gl);
        this.lineShader = createShaderLine(gl);
        this.polygonShader = createShaderPolygon(gl);

        this.showPoints = showPoints;
        this.showEdges = showEdges;
        this.showTriangulationLines = showTriangulationLines;
        this.showPolygons = showPolygons;

        this.customPolygonShader = customPolygonShader; //new Shader(gl, triangleFillVertexGLSL, triangleFillFragmentGLSL);


        const points = [];

        for (let i=0; i<polygonList.length; i++){
            const polygon = polygonList[i];
            for (let j=0; j<polygon.length; j++){
                const v = polygon[j];
                points.push(v.pos.x, v.pos.y, v.pos.z);
            }
        }
        this.pointVAO = createVAOfromPointList(gl, points);

        const lines = [];
        for (let i=0; i<polygonList.length; i++){
            const polygon = polygonList[i];
            for (let i = 0; i < polygon.length; i++) {
                const v1 = polygon[i];
                lines.push(
                    v1.pos.x,
                    v1.pos.y,
                    v1.pos.z,
                )
                let j = i + 1;
                if (j === polygon.length) {
                    j = 0;
                }
                const v2 = polygon[j];
                lines.push(
                    v2.pos.x,
                    v2.pos.y,
                    v2.pos.z,
                )
            }
        }
        this.lineVAO = createVAOfromLineList(gl, lines);

        const triangleList = polygonList.flatMap(polygon => earclip(polygon));
        const trianguleLines = [];
        for (let i = 0; i < triangleList.length / 3; i++) {
            trianguleLines.push(
                triangleList[3 * i].pos.x,
                triangleList[3 * i].pos.y,
                triangleList[3 * i].pos.z,
                triangleList[3 * i + 1].pos.x,
                triangleList[3 * i + 1].pos.y,
                triangleList[3 * i + 1].pos.z,

                triangleList[3 * i + 1].pos.x,
                triangleList[3 * i + 1].pos.y,
                triangleList[3 * i + 1].pos.z,
                triangleList[3 * i + 2].pos.x,
                triangleList[3 * i + 2].pos.y,
                triangleList[3 * i + 2].pos.z,

                triangleList[3 * i + 2].pos.x,
                triangleList[3 * i + 2].pos.y,
                triangleList[3 * i + 2].pos.z,
                triangleList[3 * i].pos.x,
                triangleList[3 * i].pos.y,
                triangleList[3 * i].pos.z,
            )
        }
        this.trianguleLinesVAO = createVAOfromLineList(gl, trianguleLines);
        this.polygonVAO = createVAOfromPolygonList(gl, polygonList);
    }
    render(modelViewProjectionMatrix, displayWidth, displayHeight, {camera, model}) {
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.enable(this.gl.BLEND);

        this.gl.cullFace(this.gl.FRONT);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.enable(this.gl.DEPTH_TEST);
//        this.gl.depthFunc(this.gl.LEQUAL);

        if (this.polygonVAO && this.showPolygons) {
            const shader = this.customPolygonShader || this.polygonShader;
            shader.use();
            shader.uniform('MVP', modelViewProjectionMatrix);
            if (!this.customPolygonShader) {
                shader.uniform('color', [0.3, 0.3, 0.6, 0.1]);
            }else{
                shader.uniform('camera', camera);
                shader.uniform('Model', model);
            }
            this.polygonVAO.render();
        }

      this.gl.polygonOffset(0, 1);
        this.gl.disable(this.gl.CULL_FACE);

        if (this.pointVAO && this.showPoints) {
            this.pointShader.use();
            this.pointShader.uniform('MVP', modelViewProjectionMatrix);
            this.pointShader.uniform('pointSize', [1 / displayWidth, 1 / displayHeight].map(x => x * 14.));
            this.pointShader.uniform('color', [0.01, 0.01, 0.01, 1]);
            this.pointShader.uniform('zOffset', -0.00003);
            this.pointVAO.render();
        }

        if (this.lineVAO && this.showEdges) {
            this.lineShader.use();
            this.lineShader.uniform('MVP', modelViewProjectionMatrix);
            this.lineShader.uniform('lineSize', [1 / displayWidth, 1 / displayHeight].map(x => x * 2.));
            this.lineShader.uniform('color', [0.9, 0.1, 0.01, 0.8]);
            this.lineShader.uniform('zOffset', -0.00001);
            this.lineVAO.render();
        }

        if (this.trianguleLinesVAO && this.showTriangulationLines) {
            this.lineShader.use();
            this.lineShader.uniform('MVP', modelViewProjectionMatrix);
            this.lineShader.uniform('lineSize', [1 / displayWidth, 1 / displayHeight].map(x => x * 0.5));
            this.lineShader.uniform('color', [0., 0.9, 0.3, 0.3]);
            this.lineShader.uniform('zOffset', -0.00002);
            this.trianguleLinesVAO.render();
        }
    }
}

export function createMeshRenderer(options) {
    return new MeshRenderer(options);
}

export function clamp(x, min, max) {
    return Math.max(Math.min(x, max), min);
}

export {loadWavefront} from './wavefront';
