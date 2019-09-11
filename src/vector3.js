
export default function vec3(x, y, z) {
    return new Vector3(x, y, z);
}

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    add(other) {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    sub(other) {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }
    cross(other) {
        return new Vector3(
            this.y * other.z - this.z * other.y,
            this.z * other.x - this.x * other.z,
            this.x * other.y - this.y * other.x
        );
    }
    min(other) {
        return new Vector3(Math.min(this.x, other.x), Math.min(this.y, other.y), Math.min(this.z, other.z));
    }
    max(other) {
        return new Vector3(Math.max(this.x, other.x), Math.max(this.y, other.y), Math.max(this.z, other.z));
    }
    abs() {
        return new Vector3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
    }
    array() {
        return [this.x, this.y, this.z];
    }
}