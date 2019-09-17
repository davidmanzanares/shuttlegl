export class Plane {
    constructor (normal, w) {
        this.normal = normal;
        this.w = w;
    }
    flip () {
        return new Plane(this.normal.negated(), -this.w);
    }
    // Test if p is within the region delimited by this plane
    test (p) {
        return (this.normal.x * p.x + this.normal.y * p.y + this.normal.z * p.z) >= this.w;
    }
}

export function planeFromPoints (pa, pb, pc) {
    const n = pb.sub(pa).cross(pc.sub(pa)).normalize();
    return new Plane(n, n.dot(pa));
}