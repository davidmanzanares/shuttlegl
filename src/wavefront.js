export async function loadWavefront (url) {
    const response = await (await fetch(url)).text();

    const vertices = [];
    const faces = [];
    response.split('\n').forEach(l => {
        if (l.startsWith('v ')) {
            const [, x, y, z] = l.split(' ').map(Number);
            vertices.push({ x: x + 3, y, z });
        } else if (l.startsWith('f ')) {
            const [, ...faceVertices] = l.split(' ').map(x => Number(x) - 1);
            faces.push(faceVertices);
        }
    });

    const polygonList = [];
    faces.forEach(f => {
        const face = [];
        f.forEach(v => {
            face.push(
                vertices[v].x,
                vertices[v].y,
                vertices[v].z
            );
        });
        polygonList.push(face);
    });

    return polygonList;
}