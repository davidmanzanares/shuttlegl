
export class AABB {
    constructor (min, max) {
        this.min = min;
        this.max = max;
    }
    intersection (aabb) {
        return new AABB(
            this.min.max(aabb.min),
            this.max.min(aabb.max)
        );
    }
    center () {
        return (this.min.add(this.max)).multiplyByScalar(0.5);
    }
    size () {
        return this.max.sub(this.min);
    }
}