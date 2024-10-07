import * as THREE from 'three';
const loader = new THREE.FileLoader();

const editMode = true;

// Create checkbox
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.style.position = 'absolute';
checkbox.style.top = '10px';
checkbox.style.right = '10px';
document.body.appendChild(checkbox);

const keys = {};
let isRightMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let playerCube = null;

const handleKeyDown = (e) => keys[e.key] = true;
const handleKeyUp = (e) => keys[e.key] = false;
const handleMouseDown = (e) => {
    if (e.button === 2) {
        isRightMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
};
const handleMouseUp = (e) => {
    if (e.button === 2) {
        isRightMouseDown = false;
    }
};
const handleMouseMove = (e) => {
    if (isRightMouseDown) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;

        camera.rotation.y -= deltaX / 1000;
        camera.rotation.x -= deltaY / 1000;

        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
};
const handleWheel = (e) => {
    if (e.deltaY < 0) {
        moveSpeed += 0.1;
    } else {
        moveSpeed = Math.max(0.1, moveSpeed - 0.1);
    }
};

const enableEditorMode = () => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('wheel', handleWheel);
};

const disableEditorMode = () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('wheel', handleWheel);
};

checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        disableEditorMode();
        enablePlayerMode();
    } else {
        disablePlayerMode();
        enableEditorMode();
    }
});

const movePlayer = () => {
    if (!playerCube) return;

    const moveDistance = 0.1;
    if (keys['w']) playerCube.position.z -= moveDistance;
    if (keys['s']) playerCube.position.z += moveDistance;
    if (keys['a']) playerCube.position.x -= moveDistance;
    if (keys['d']) playerCube.position.x += moveDistance;
};

const enablePlayerMode = () => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
};

const disablePlayerMode = () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
}

enableEditorMode();

const Colors = {
    FLOOR: { color: 0x333333, size: 1.0 },
    WALL: { color: 0xFFFFFF, size: 1.0 },
    GOAL: { color: 0x00ff00, size: 1.0 },
    TRASH1: { color: 0xff0000, size: 0.75 },
    TRASH2: { color: 0xffa500, size: 0.75 },
    PLAYER: { color: 0x0000ff, size: 1.0 },
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 10, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// add floor
{
    const geometry = new THREE.BoxGeometry( 38, 1, 38 );
    const material = new THREE.MeshBasicMaterial( { color: Colors.FLOOR.color } );
    const cube = new THREE.Mesh( geometry, material );
    scene.add( cube );
}
// generate level
const levelPath = 'static/level/0.lvl';
loader.load(levelPath, (data) => {
    const levelData = data.split('\n');
    levelData.forEach((row, rowIndex) => {
        row.split('').forEach((cell, colIndex) => {
            const x = colIndex - levelData[0].length / 2;
            const y = rowIndex - levelData.length / 2;
            switch (cell) {
                case 'W':
                    spawnCube(x, y, Colors.WALL);
                    break;
                case 'G':
                    spawnCube(x, y, Colors.GOAL);
                    break;
                case '1':
                    spawnCube(x, y, Colors.TRASH1);
                    break;
                case '2':
                    spawnCube(x, y, Colors.TRASH2);
                    break;
            }
        });
    });

    // add player
    // pick any `S` cell
    const playerCell = levelData.reduce((acc, row, rowIndex) => {
        if (acc) return acc;
        const colIndex = row.indexOf('S');
        if (colIndex !== -1) {
            return { rowIndex, colIndex };
        }
        return null;
    }, null);
    if (playerCell) {
        const x = playerCell.colIndex - levelData[0].length / 2;
        const y = playerCell.rowIndex - levelData.length / 2;
        spawnCube(x, y, Colors.PLAYER);
    }
});

const spawnCube = (x, y, object) => {
    const geometry = new THREE.BoxGeometry(object.size, object.size, object.size);
    const material = new THREE.MeshBasicMaterial({ color: object.color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, 0.5, y);
    scene.add(cube);
};

// move camera with wasd and mouse if right click is held
const updateCameraPosition = () => {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    if (keys['w']) {
        camera.position.addScaledVector(direction, moveSpeed);
    }
    if (keys['s']) {
        camera.position.addScaledVector(direction, -moveSpeed);
    }

    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.cross(new THREE.Vector3(0, 1, 0));
    right.normalize();

    if (keys['a']) {
        camera.position.addScaledVector(right, -moveSpeed);
    }
    if (keys['d']) {
        camera.position.addScaledVector(right, moveSpeed);
    }

    // Keep the camera roll locked
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.clone().add(direction));
};

// disable rightclick context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

camera.position.z = 75;
camera.position.y = 233;
camera.rotation.x = -Math.PI / 2.5;

// listen to mose wheel and change camera rotation z
let moveSpeed = 1;

document.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) {
        moveSpeed += 0.1;
    } else {
        moveSpeed = Math.max(0.1, moveSpeed - 0.1);
    }
});

function animate() {
    updateCameraPosition();
    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );