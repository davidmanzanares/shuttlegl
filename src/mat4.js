import vec3 from './vector3'
import { Matrix4 as MGLMat4 } from 'math.gl';

export class Matrix4 {
    constructor(list) {
        this.list = list;
    }
    mul(mat) {
        const a = this.list;
        const b = mat.list;
        const l = new Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let s = 0;
                for (let k = 0; k < 4; k++) {
                    s += a[4 * i + k] * b[4 * k + j];
                }
                l[4 * i + j] = s;
            }
        }
        return new Matrix4(l);
    }
    mulVec4(v) {
        const l = new Array(4);
        for (let i = 0; i < 4; i++) {
            let s = 0.;
            for (let j = 0; j < 4; j++) {
                s += v[j] * this.list[4 * i + j];
            }
            l[i] = s;
        }
        return l;
    }
    mulVec3(v) {
        return vec3(...this.mulVec4([v.x, v.y, v.z, 1.]));
    }
}

export function mat4FromModel(translation, rotation, scale) {
    const tr = translationMatrix(translation);
    const rot = rotationMatrix(rotation);
    const sc = scaleMatrix(scale);
    return tr.mul(rot).mul(sc);
}

export function translationMatrix(translation) {
    return new Matrix4([
        1, 0, 0, translation.x,
        0, 1, 0, translation.y,
        0, 0, 1, translation.z,
        0, 0, 0, 1,
    ]);
}

export function rotationXMatrix(r) {
    return new Matrix4([
        1, 0, 0, 0,
        0, Math.cos(r), -Math.sin(r), 0,
        0, Math.sin(r), Math.cos(r), 0,
        0, 0, 0, 1,
    ]);
}

export function rotationYMatrix(r) {
    return new Matrix4([
        Math.cos(r), 0, Math.sin(r), 0,
        0, 1, 0, 0,
        -Math.sin(r), 0, Math.cos(r), 0,
        0, 0, 0, 1,
    ]);
}

export function rotationZMatrix(r) {
    return new Matrix4([
        Math.cos(r), -Math.sin(r), 0, 0,
        Math.sin(r), Math.cos(r), 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);
}

export function rotationMatrix(rotation) {
    const rx = rotationXMatrix(rotation.x / 180 * Math.PI);
    const ry = rotationYMatrix(rotation.y / 180 * Math.PI);
    const rz = rotationZMatrix(rotation.z / 180 * Math.PI);
    return rx.mul(ry).mul(rz);
}

export function scaleMatrix(scale) {
    return new Matrix4([
        scale.x, 0, 0, 0,
        0, scale.y, 0, 0,
        0, 0, scale.z, 0,
        0, 0, 0, 1
    ]);
}

export function mat4LookAt(view) {
    const viewMatrix = (new MGLMat4()).lookAt(view);
    return new Matrix4([...viewMatrix]);
}