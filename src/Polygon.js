import { planeFromPoints } from './Plane'

let types = new Uint8Array(64 * 1024);

export class Polygon {
    constructor(vertices, shared, plane = null) {
        this.vertices = vertices;
        this.shared = shared;
        this.plane = plane || planeFromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
    }

    invert() {
        this.vertices.reverse().map(v => v.clone()).forEach(v => { v.flip(); });
        this.plane = this.plane.flip();
        return this;
    }

    // `epsilon` is the tolerance used by `splitPolygon()` to decide if a
    // point is on the plane.
    splitPolygon(plane, coplanarFront, coplanarBack, front, back, epsilon = 1e-5) {
        const COPLANAR = 0;
        const FRONT = 1;
        const BACK = 2;
        const SPANNING = 3;

        if (plane.normal.sub(this.plane.normal).length()<0.001 && Math.abs(plane.w-this.plane.w)<0.001){
            //coplanarBack.push(this);
            //return;
        }

        if (plane === this.plane){
            coplanarBack.push(this);
            return;
        }

        // Classify each point as well as the entire polygon into one of the above
        // four classes.
        let polygonType = 0;
        if (types.length < this.vertices.length) {
            types = new Uint8Array(this.vertices.length);
        }
        epsilon=0.00000001;
        const eps = epsilon
        if (epsilon === null && Math.abs(this.plane.normal.dot(plane.normal)) > 0.999) {
            /*if (plane.w > this.plane.w) {
                front.push(this);
            } else {
                back.push(this);
            }
            return;*/
            /*front.push(this);
            back.push(this);
            return;*/
        }
        for (let i = 0; i < this.vertices.length; i++) {
            const t = plane.normal.dot(this.vertices[i].pos) - plane.w;
            let type = (t < -epsilon) ? BACK : (t > epsilon) ? FRONT : COPLANAR;
            if (epsilon === null){
                //type = t<0?BACK:FRONT;
            }
            polygonType |= type;
            types[i] = type;
        }

        // Put the polygon in the correct list, splitting it when necessary.
        switch (polygonType) {
            case COPLANAR:
                if (eps === null && false) {
                    front.push(this);
                    back.push(this);
                    break;
                }
                (plane.normal.dot(this.plane.normal) > 0 ? coplanarFront : coplanarBack).push(this);
                break;
            case FRONT:
                front.push(this);
                break;
            case BACK:
                back.push(this);
                break;
            case SPANNING:
                let f = []; let b = [];
                for (let i = 0; i < this.vertices.length; i++) {
                    let j = (i + 1) % this.vertices.length;
                    let ti = types[i]; let tj = types[j];
                    let vi = this.vertices[i]; let vj = this.vertices[j];
                    if (ti !== BACK) f.push(vi);
                    if (ti !== FRONT) b.push(vi);
                    if ((ti | tj) === SPANNING) {
                        let t = (plane.w - plane.normal.dot(vi.pos)) / plane.normal.dot(vj.pos.sub(vi.pos));
                        let v = vi.interpolate(vj, t);
                        f.push(v);
                        b.push(v);
                    }
                }
                if (f.length >= 3) front.push(new Polygon(f, this.shared, this.plane));
                if (b.length >= 3) back.push(new Polygon(b, this.shared, this.plane));
                break;
        }
    }
}