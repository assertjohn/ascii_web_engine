/* -------------------------------------------------------------------------- */
/*                                   Classes                                  */
/* -------------------------------------------------------------------------- */

class Point3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(point) {
        return new Point3D(this.x + point.x, this.y + point.y, this.z + point.z);
    }

    negate() {
        return new Point3D(-this.x, -this.y, -this.z);
    }

    sub(other) {
        return new Point3D(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    cross(other) {
        return new Point3D(
            this.y * other.z - this.z * other.y,
            this.z * other.x - this.x * other.z,
            this.x * other.y - this.y * other.x
        );
    }

    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    // scale function for a point
    scale(factor) {
        return new Point3D(this.x * factor, this.y * factor, this.z * factor);
    }

    toString() {
        return `(${this.x}, ${this.y}, ${this.z})`;
    }
}

class Point2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Object3D {
    constructor() {
        this.vertices = [];
    }

    rotateX(angle) {
        this.vertices = this.vertices.map(vertex => rotateX(vertex, angle));
    }

    rotateY(angle) {
        this.vertices = this.vertices.map(vertex => rotateY(vertex, angle));
    }

    translate(dx, dy, dz) {
        this.vertices = this.vertices.map(vertex => 
            new Point3D(vertex.x + dx, vertex.y + dy, vertex.z + dz)
        );
    }

    scale(sx, sy, sz) {
        this.vertices = this.vertices.map(vertex => 
            new Point3D(vertex.x * sx, vertex.y * sy, vertex.z * sz)
        );
    }
    // Calculate average depth for sorting
    averageZ() {
        return this.vertices.reduce((sum, v) => sum + v.z, 0) / this.vertices.length;
    }

    transformVertices(func) {
        this.vertices = this.vertices.map(func);
    }
}

class Model extends Object3D {
    constructor(filename) {
        super();
        this.faces = [];
        fetch(filename).then(response => response.text()).then(data => {
            let lines = data.split('\n');
            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('v ')) {
                    let [x, y, z] = line.slice(2).split(' ').map(Number);
                    this.vertices.push(new Point3D(x, y, z));
                } else if (line.startsWith('f ')) {
                    let indices = line.slice(2).split(' ').map(v => Number(v.split('/')[0]) - 1); // -1 to convert to zero-based index
                    this.faces.push(indices);
                }
            });
        });
    }
    getNormal(face, vertices) {
        let [i1, i2, i3] = face;
        let v1 = vertices[i2].sub(vertices[i1]);
        let v2 = vertices[i3].sub(vertices[i1]);
        let normal = v1.cross(v2);
        return normal;
    }

    cullBackfaces(face, cameraPosition, vertices) {
        let normal = this.getNormal(face, vertices);
        let [i1, i2, i3] = face;
        let faceCenter = vertices[i1].add(vertices[i2]).add(vertices[i3]).scale(1 / 3);
        let faceToCamera = cameraPosition.sub(faceCenter);
        let dotProduct = normal.dot(faceToCamera);

        let threshold = -0.0; // adjust as needed
        return dotProduct < -threshold;
    }
}

class Floor extends Object3D {
    constructor(y, size) {
        super();
        this.vertices = [
            new Point3D(-size, y, size),
            new Point3D(size, y, size),
            new Point3D(size, y, -size),
            new Point3D(-size, y, -size)
        ];
    }
}

/* -------------------------------------------------------------------------- */
/*                              Utility Functions                             */
/* -------------------------------------------------------------------------- */
function getFaceCentroid(face, vertices) {
    if (!face || !face.indices || !Array.isArray(face.indices)) {
        console.error('Invalid face or face.indices not found', face);
        return;
    }

    let points = face.indices.map(i => vertices[i]);
    let x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    let y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    let z = points.reduce((sum, p) => sum + p.z, 0) / points.length;
    return new Point3D(x, y, z);
}

function distance(p1, p2) {
    return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2);
}

function rotateY(point, angle) {
    const rad = angle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const {x, z} = point;

    return new Point3D(
        cos * x - sin * z,
        point.y,
        sin * x + cos * z
    );
}

function rotateX(point, angle) {
    const rad = angle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const {y, z} = point;

    return new Point3D(
        point.x,
        cos * y + sin * z,
        -sin * y + cos * z
    );
}


function project(point) {
    const fov = 2;
    const aspectRatio = charWidth / charHeight;

    let x = point.x - offsetX;
    let y = -point.y + offsetY; 
    let z = -point.z + zoom;

    const factor = fov / (fov + z);
    return new Point2D(
        Math.round((x * factor * aspectRatio + 1) * gridWidth / 2),
        Math.round((y * factor + 1) * gridHeight / 2) 
    );
}

function drawLine(point1, point2, fill = '@', color = 'white') {
    if(!point1 || !point2) {
        console.log('Undefined points detected');
        return;
    }
    // console.log(point1, point2);
    let x0 = point1.x;
    let y0 = point1.y;
    let x1 = point2.x;
    let y1 = point2.y;

    let z0 = point1.z;
    let z1 = point2.z;
    let dz = z1 - z0;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);

    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;

    let err = dx - dy;

    while(true) {
        // Prevent index out of range errors
        if(x0 >= 0 && x0 < grid[0].length && y0 >= 0 && y0 < grid.length) {
            let t = Math.abs(x0 - point1.x) / dx;
            let currentZ = z0 + dz * t;
            // grid[y0][x0] = `<span class="${color}">${fill}</span>`;
            grid[y0][x0] = fill;
            zBuffer[y0][x0] = currentZ
        }

        if(x0 === x1 && y0 === y1) {
            break;
        }

        const e2 = 2 * err;

        if(e2 > -dy) {
            err -= dy;
            x0 += sx;
        }

        if(e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
}

function fillTriangle(p1, p2, p3, fill = '.', color = 'white') {
    if(p1.y > p2.y) { [p1, p2] = [p2, p1]; }
    if(p2.y > p3.y) { [p2, p3] = [p3, p2]; }
    if(p1.y > p2.y) { [p1, p2] = [p2, p1]; }

    const dy1 = p2.y - p1.y;
    const dx1 = p2.x - p1.x;
    const dy2 = p3.y - p1.y;
    const dx2 = p3.x - p1.x;

    const dax_step = dy1 ? dx1 / Math.abs(dy1) : 0;
    const dbx_step = dy2 ? dx2 / Math.abs(dy2) : 0;

    let sy;
    if(dy1) {
        for(let i = p1.y; i <= p2.y; i++) {
            sy = i - p1.y;
            const ax = Math.round(p1.x + sy * dax_step);
            const bx = Math.round(p1.x + sy * dbx_step);
            drawLine(new Point2D(ax, i, p1.z), new Point2D(bx, i, p2.z), fill, color);

        }
    }

    const dy1b = p3.y - p2.y;
    const dx1b = p3.x - p2.x;

    const dax_stepb = dy1b ? dx1b / Math.abs(dy1b) : 0;

    if(dy1b) {
        for(let i = p2.y; i <= p3.y; i++) {
            sy = i - p1.y;
            const ax = Math.round(p2.x + (i - p2.y) * dax_stepb);
            const bx = Math.round(p1.x + sy * dbx_step);
            drawLine(new Point2D(ax, i, p1.z), new Point2D(bx, i, p2.z), fill, color);

        }
    }
}

function fillQuadrilateral(points, fill = '.') {
    fillTriangle(points[0], points[1], points[3], fill);
    fillTriangle(points[1], points[2], points[3], fill);
}

/* -------------------------------------------------------------------------- */
/*                              Global Variables                              */
/* -------------------------------------------------------------------------- */

// Scene
let myModel = new Model("models/chicken.obj");
let scene = [myModel];
let floor = new Floor(0, 10); 

// Camera
let cameraRotationX = 0;
let cameraRotationY = 0;

let offsetX = 0;
let offsetY = 1;
let angle = -100; // Default: 40
let angleX = -30; // Default: -30
let zoom = 20.0;

// Grid & Canvase
const gameArea = document.getElementById('canvas');
let charWidth = 4;
let charHeight = 6;
let grid;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;
let gridWidth = Math.floor(windowWidth / charWidth);
let gridHeight = Math.floor(windowHeight / charHeight);
gridWidth -= 4;
gridHeight -= 4;

// Interaction
let mousedown = false;
let mouseX, mouseY;
let isMiddleButtonDown = false;

// Timing
steps = 0;

// Utilities
let zBuffer; 

// Rendering Options
let backfaceCulling = false;
let zBuffering = true;
let isFloor = true;
let filledFaces = true;

// FPS
let lastTimestamp = performance.now();
let frameCount = 0;
let fps = 0;

/* -------------------------------------------------------------------------- */
/*                               Main Draw Loop                               */
/* -------------------------------------------------------------------------- */

function draw(currentTimestamp) {
    
    grid = new Array(gridHeight);
    for(let i = 0; i < grid.length; i++){
        grid[i] = new Array(gridWidth).fill(' ');
    }

    let delta = (currentTimestamp - lastTimestamp) / 1000;
    frameCount++;
    if (delta >= 1) { // if a second has passed, update fps
        fps = frameCount;
        frameCount = 0;
        lastTimestamp = currentTimestamp;
    }

    zBuffer = new Array(gridHeight);
    for(let i = 0; i < zBuffer.length; i++){
        zBuffer[i] = new Array(gridWidth).fill(Infinity);
    }

    if (isFloor) {
        let projectedPoints = floor.vertices.map(point => {
            let rotatedPoint = rotateY(point, angle);
            rotatedPoint = rotateX(rotatedPoint, angleX);
            return project(rotatedPoint);
        });
        
        fillTriangle(projectedPoints[0], projectedPoints[1], projectedPoints[3],'.', 'blue');
        fillTriangle(projectedPoints[1], projectedPoints[2], projectedPoints[3],'.', 'blue');    
    }  

    if (steps == 100) {
        scene[0].scale(20, 20, 20);
    }
    
    scene[0].rotateY(0.5)

    let cameraPosition = new Point3D(offsetX, offsetY, zoom);
    
    scene.forEach(object => {
        let transformedVertices = object.vertices.map(vertex => rotateY(vertex, angle));
        transformedVertices = transformedVertices.map(vertex => rotateX(vertex, angleX));

        let faces = object.faces.map(face => {
            if (!Array.isArray(face)) {
                console.error('Invalid face data', face);
                return;
            }
        
            return {
                indices: face,
                centroid: getFaceCentroid({indices: face}, transformedVertices)
            }
        }).filter(face => face !== undefined);  // Filter out any faces that were invalid

        // Sort faces by distance to the camera (from far to near)
        faces.sort((a, b) => distance(cameraPosition, b.centroid) - distance(cameraPosition, a.centroid));

        faces.forEach(face => {
            if (backfaceCulling && !object.cullBackfaces(face.indices, cameraPosition, transformedVertices)) {
                return;
            }

            let projectedPoints = face.indices.map(index => {
                let point = transformedVertices[index];
                if (!point) {
                    console.error('Undefined point detected', point);
                    return;
                }
                return project(point);
            });

            projectedPoints = projectedPoints.filter(point => point !== undefined);
            
            if (filledFaces){
                if (projectedPoints.length === 3) {
                    fillTriangle(projectedPoints[0], projectedPoints[1], projectedPoints[2], fill=' ');
                } else if (projectedPoints.length === 4) {
                    fillQuadrilateral(projectedPoints, fill=' ');
                }
            }
            for (let i = 0; i < projectedPoints.length; i++) {
                drawLine(projectedPoints[i], projectedPoints[(i+1) % projectedPoints.length]);
            }
        });
    });

    steps++;

    // Convert grid to a string and draw
    gameArea.innerHTML = grid.map(row => row.join('')).join('\n');

    // Debugging info
    document.getElementById('info').innerHTML = `
        Camera Angles: X=${angle.toFixed(2)}, Y=${angleX.toFixed(2)} <br>
        Camera Position: X=${offsetX.toFixed(2)}, Y=${offsetY.toFixed(2)}, Z=${zoom.toFixed(2)} <br>
        FPS: ${fps} <br>
        Backface Culling (C): ${backfaceCulling ? 'On' : 'Off'} <br>
        Wireframe (W): ${filledFaces ? 'Off' : 'On'} <br>
        Z Buffering (Z): ${zBuffering ? 'Off' : 'On'} <br>
        Floor (F): ${isFloor ? 'On' : 'Off'} <br>
        `;

    requestAnimationFrame(draw);
}

/* -------------------------------------------------------------------------- */
/*                                 Interaction                                */
/* -------------------------------------------------------------------------- */

window.addEventListener('mousedown', e => {
    e.preventDefault(); 
    if (e.button === 1) { 
        isMiddleButtonDown = true; 
    } else {
        mousedown = true;
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
});

window.addEventListener('mouseup', e => {
    if (e.button === 1) { 
        isMiddleButtonDown = false;
    } else {
        mousedown = false;
    }
});

window.addEventListener('mousemove', e => { 
    const dx = e.clientX - mouseX;
    const dy = e.clientY - mouseY;
    if (isMiddleButtonDown) { // move camera
        offsetX -= dx * 0.005;
        offsetY += dy * 0.005;
    } else if (mousedown) { // rotate camera
        angle -= dx * 0.1;
        angleX -= dy * 0.1;
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
});

window.addEventListener('wheel', e => { // zoom
    zoom += e.deltaY * 0.005; 
});

window.addEventListener('keydown', e => { // Toggle backface culling
    if (e.key === 'c' || e.key === 'c') { 
        backfaceCulling = !backfaceCulling; 
        // console.log(`backfaceCulling is now ${backfaceCulling}`); 
    }
});

window.addEventListener('keydown', e => { // Toggle floor
    if (e.key === 'f' || e.key === 'f') { 
        isFloor = !isFloor; 
        // console.log(`isFloor is now ${isFloor}`); 
    }
});

window.addEventListener('keydown', e => { // Toggle z-buffering
    if (e.key === 'z' || e.key === 'z') { 
        zBuffering = !zBuffering; 
        // console.log(`zBuffering is now ${zBuffering}`); 
    }
});

window.addEventListener('keydown', e => { // Toggle wireframe
    if (e.key === 'w' || e.key === 'w') { 
        filledFaces = !filledFaces; 
        // console.log(`zBuffering is now ${zBuffering}`); 
    }
});

/* -------------------------------------------------------------------------- */
/*                                 Draw Screen                                */
/* -------------------------------------------------------------------------- */

draw();