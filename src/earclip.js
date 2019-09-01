import { Vector3 } from "math.gl";

export function earclip(polygon) {
    //Based on https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf
    //O(N^2)

    const a = new Vector3(polygon[0].pos.x, polygon[0].pos.y, polygon[0].pos.z);
    const b = new Vector3(polygon[1].pos.x, polygon[1].pos.y, polygon[1].pos.z);
    const c = new Vector3(polygon[2].pos.x, polygon[2].pos.y, polygon[2].pos.z);

    const u = new Vector3(b).sub(a);
    const v = new Vector3(c).sub(b);

    const cross = new Vector3(u).cross(v);
    const crossAbs = cross.map(Math.abs);
    const index = crossAbs.findIndex(x => x === Math.max(...crossAbs));
    const ignoredPlane = index === 0 ?
        'x'
        : index === 1 ? 'y' : 'z';


    let vertexListHead = createDoublyLinkedListFrom3DvertexArray(polygon, ignoredPlane);

    //Make earness doubled-linked list (not cyclic)
    let earListHead = null;
    let numVertices = 0;
    for (let vertex = vertexListHead, first = true; first || vertex !== vertexListHead; vertex = vertex.next, first = false) {
        if (isEar(vertexListHead, vertex)) {
            //Append eartip to the head of the ears list
            const eartip = { prev: null, next: earListHead, v: vertex };
            vertex.earListNode = eartip;
            if (earListHead !== null) {
                earListHead.prev = eartip;
            }
            earListHead = eartip;
        }
        numVertices++;
    }

    const triangles = [];
    while (true) {
        if (earListHead == null) {
            throw new Error("Invalid input polygon or internal error");
        }
        const eartip = earListHead.v;

        const ear1 = eartip.prev;
        const ear2 = eartip;
        const ear3 = eartip.next;
        //Push eartip to triangle list, the order is important to enable face culling
        if (ear1.reverse){
            triangles.push(ear1, ear2, ear3);
        }else{
            triangles.push(ear3, ear2, ear1);
        }

        //Check finish condition
        numVertices--;
        if (numVertices < 3) {
            break;
        }

        //Remove the eartip from the linked list of vertices
        ear1.next = ear3;
        ear3.prev = ear1;
        vertexListHead = ear1; //In case vertexListHead was the eartip (ear2)

        //Remove eartip from ears list
        earListHead = earListHead.next;
        if (earListHead !== null) {
            earListHead.prev = null;
        }
        //Recompute adjacent vertices (ear1, ear3) earness
        earListHead = recomputeEarness(vertexListHead, earListHead, ear1);
        earListHead = recomputeEarness(vertexListHead, earListHead, ear3);
    }
    return triangles;
}

// Returns the head of a doubly linked list from a list of the form [v0x,v0y,v0z, v1x,v1y,v1z...]
function createDoublyLinkedListFrom3DvertexArray(array, ignoredPlane) {
    const vertexListStorage = [];

    for (let i = 0; i < array.length; i++) {
        if (ignoredPlane === 'x') {
            vertexListStorage[i] = {
                ...array[i],
                x: array[i].pos.z,
                y: array[i].pos.y,
                z: array[i].pos.x,
                prev: null,
                next: null,
                earListNode: null,
            };
        } else if (ignoredPlane === 'y') {
            vertexListStorage[i] = {
                ...array[i],
                x: array[i].pos.x,
                y: array[i].pos.z,
                z: array[i].pos.y,
                prev: null,
                next: null,
                earListNode: null,
            };
        } else {
            vertexListStorage[i] = {
                ...array[i],
                x: array[i].pos.x,
                y: array[i].pos.y,
                z: array[i].pos.z,
                prev: null,
                next: null,
                earListNode: null,
            };
        }
    }

    // if the first polygon is clockwise, we need to reverse it
    const a = new Vector3(vertexListStorage[0].x, vertexListStorage[0].y, 0);
    const b = new Vector3(vertexListStorage[1].x, vertexListStorage[1].y, 0);
    const c = new Vector3(vertexListStorage[2].x, vertexListStorage[2].y, 0);

    const u = new Vector3(b).sub(a);
    const v = new Vector3(c).sub(b);

    const C = new Vector3(u).cross(v);
    if (C.z > 0) {
        vertexListStorage.reverse();
        for (let i = 0; i < vertexListStorage.length; i++) {
            vertexListStorage[i].reverse = true;
        }
    }
    if (C.z == 0) {
        throw new Error('Invalid input or internal error');
    }
    for (let i = 0; i < vertexListStorage.length; i++) {
        vertexListStorage[i].prev = vertexListStorage[mod(i - 1, vertexListStorage.length)];
        vertexListStorage[i].next = vertexListStorage[mod(i + 1, vertexListStorage.length)];
    }
    return vertexListStorage[0];
}

function isEar(vertexList, eartip) {
    //eartip is an ear if and only if:
    //   eartip is convex (not reflex)
    //   AND
    //   all other reflex vertices are outside the ear's triangle
    if (isReflex(eartip)) {
        return false;
    }
    for (let vertex = vertexList, first = true; first || vertex !== vertexList; vertex = vertex.next, first = false) {
        if (isReflex(vertex) && vertex !== eartip.prev && vertex !== eartip && vertex !== eartip.next &&
            isPointInTriangle(vertex, eartip.prev, eartip, eartip.next)) {
            return false;
        }
    }
    return true;
}

function isReflex(vertex) {
    const a = vertex.prev;
    const b = vertex;
    const c = vertex.next;
    return isPointInHalfSpace(b, a, c);
}

//Returns positive or negative values depending on which half-space
//p1 is present, respect the line formed by points p2 and p3
function isPointInHalfSpace(p1, p2, p3) {
    //V=P1-P3                            //V points to P1 from P3
    //L=P2-P3                            //L is the direction of the line
    //N=normal(L)=(P2Y-P3Y, -(P2X, P3X)) //N is a normal of the line
    //d=dot(V, N)                        //d sign is the results of the test
    //This is just the expansion of "d" with the above formulas
    return ((p1.x - p3.x) * (p2.y - p3.y) - (p1.y - p3.y) * (p2.x - p3.x)) <= 0;
}

function isPointInTriangle(point, t1, t2, t3) {
    //If point is inside the 3 half-spaces, then, and only then, it is inside the triangle
    const b1 = isPointInHalfSpace(point, t1, t2);
    const b2 = isPointInHalfSpace(point, t2, t3);
    const b3 = isPointInHalfSpace(point, t3, t1);
    return (b1 === b2) && (b2 === b3);
}

//Recomputes the earness of vertex, the earListHead is returned, always use it
function recomputeEarness(vertexListHead, earListHead, vertex) {
    const b = isEar(vertexListHead, vertex);
    if (b && vertex.earListNode === null) {
        //Add vertex to eartip list
        vertex.earListNode = {
            prev: null,
            next: earListHead,
            v: vertex
        };
        if (earListHead !== null) {
            earListHead.prev = vertex.earListNode;
        }
        earListHead = vertex.earListNode;
    } else if (!b && vertex.earListNode !== null) {
        //Remove vertex from eartip list
        if (earListHead === vertex.earListNode) {
            earListHead = earListHead.next;
        }
        if (vertex.earListNode.prev !== null) {
            vertex.earListNode.prev.next = vertex.earListNode.next;
        }
        if (vertex.earListNode.next !== null) {
            vertex.earListNode.next.prev = vertex.earListNode.prev;
        }
        vertex.earListNode = null;
    }
    return earListHead;
}

//Return i modulo m, it will return a positive result always
function mod(i, m) {
    return ((i % m) + m) % m;
}
