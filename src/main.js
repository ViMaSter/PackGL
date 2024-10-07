import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

import Stats from 'stats-gl';

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

class EditorMode {
    constructor() {
        this.moveSpeed = 1;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp =  this.handleKeyUp.bind(this);
        this.handleMouseDown =  this.handleMouseDown.bind(this);
        this.handleMouseUp =    this.handleMouseUp.bind(this);
        this.handleMouseMove =  this.handleMouseMove.bind(this);
        this.handleWheel =    this.handleWheel.bind(this);
        this.updateCameraPosition = this.updateCameraPosition.bind(this);
    }

    updateCameraPosition() {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        if (keys['w']) {
            camera.position.addScaledVector(direction, this.moveSpeed);
        }
        if (keys['s']) {
            camera.position.addScaledVector(direction, -this.moveSpeed);
        }

        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(new THREE.Vector3(0, 1, 0));
        right.normalize();

        if (keys['a']) {
            camera.position.addScaledVector(right, -this.moveSpeed);
        }
        if (keys['d']) {
            camera.position.addScaledVector(right, this.moveSpeed);
        }

        // Keep the camera roll locked
        camera.up.set(0, 1, 0);
        camera.lookAt(camera.position.clone().add(direction));
    }

    handleKeyDown(e) {
        keys[e.key] = true;
    }

    handleKeyUp(e) {
        keys[e.key] = false;
    }

    handleMouseDown(e) {
        if (e.button === 2) {
            isRightMouseDown = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    }

    handleMouseUp(e) {
        if (e.button === 2) {
            isRightMouseDown = false;
        }
    }

    handleMouseMove(e) {
        if (isRightMouseDown) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            camera.rotation.y -= deltaX / 1000;
            camera.rotation.x -= deltaY / 1000;

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    }

    handleWheel(e) {
        if (e.deltaY < 0) {
            this.moveSpeed += 0.1;
        } else {
            this.moveSpeed = Math.max(0.1, this.moveSpeed - 0.1);
        }
    }

    enable() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('wheel', this.handleWheel);
        document.addEventListener('updateEntities', this.updateCameraPosition);
    }

    disable() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('wheel', this.handleWheel);
        document.removeEventListener('updateEntities', this.updateCameraPosition);
    }
}

class PlayerMode {
    playerCube = null;
    playerLine = null;

    constructor() {
        this.moveSpeed = 0.1;
        this.turnSpeed = 0.05;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.updatePlayerPosition = this.updatePlayerPosition.bind(this);
    }

    handleKeyDown(e) {
        keys[e.key] = true;
    }

    handleKeyUp(e) {
        keys[e.key] = false;
    }

    updatePlayerPosition() {
        if (!this.playerCube) return;

        const direction = new THREE.Vector3();
        this.playerCube.getWorldDirection(direction);

        if (keys['w']) {
            this.playerCube.position.addScaledVector(direction, this.moveSpeed);
        }
        if (keys['s']) {
            this.playerCube.position.addScaledVector(direction, -this.moveSpeed);
        }

        const right = new THREE.Vector3();
        this.playerCube.getWorldDirection(right);
        right.cross(new THREE.Vector3(0, 1, 0));
        right.normalize();

        if (keys['a']) {
            this.playerCube.position.addScaledVector(right, -this.moveSpeed);
        }
        if (keys['d']) {
            this.playerCube.position.addScaledVector(right, this.moveSpeed);
        }
        if (keys['q']) {
            this.playerCube.rotation.y += this.turnSpeed;
        }
        if (keys['e']) {
            this.playerCube.rotation.y -= this.turnSpeed;
        }

        // Update player line to always shoot from player position + 1 unit in front
        const shootDirection = new THREE.Vector3();
        this.playerCube.getWorldDirection(shootDirection);
        shootDirection.normalize();
        const shootPosition = this.playerCube.position.clone().add(shootDirection);
        this.playerLine.geometry.setPositions( [
            this.playerCube.position.x, this.playerCube.position.y, this.playerCube.position.z,
            shootPosition.x, shootPosition.y, shootPosition.z,
            this.playerCube.position.x, this.playerCube.position.y, this.playerCube.position.z
        ] );
    }

    enable() {
        const playerCell = levelData.reduce((acc, row, rowIndex) => {
            if (acc) return acc;
            const colIndex = row.indexOf('S');
            if (colIndex !== -1) {
                return { rowIndex, colIndex };
            }
            return null;
        }, null);
        if (!playerCell) {
            console.error('No player cell found');
            return;
        }

        const x = playerCell.colIndex - levelData[0].length / 2;
        const y = playerCell.rowIndex - levelData.length / 2;
        this.playerCube = spawnCube(x, y, Colors.PLAYER);
        this.playerCube.rotation.y = Math.PI;

        this.playerLine = new Line2();
        this.playerLine.material.color.set( 0xffffff );
        this.playerLine.material.linewidth = 10;
        scene.add( this.playerLine );

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('updateEntities', this.updatePlayerPosition);
    }

    disable() {
        scene.remove(this.playerCube);
        this.playerCube = null;
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('updateEntities', this.updatePlayerPosition);
    }
}

const playerMode = new PlayerMode();
const editorMode = new EditorMode();

checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        editorMode.disable();
        playerMode.enable();
    } else {
        playerMode.disable();
        editorMode.enable();
    }
});

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
let levelData = [];
const levelPath = 'static/level/0.lvl';
loader.load(levelPath, (data) => {
    levelData = data.split('\n');
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
});

const spawnCube = (x, y, object) => {
    const geometry = new THREE.BoxGeometry(object.size, object.size, object.size);
    const material = new THREE.MeshBasicMaterial({ color: object.color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, 0.5, y);
    scene.add(cube);
    return cube;
};

// disable rightclick context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

camera.position.z = 75;
camera.position.y = 233;
camera.rotation.x = -Math.PI / 2.5;

// listen to mose wheel and change camera rotation z

function gameLoop() {
    const readInputEvent = new Event('readInput');
    document.dispatchEvent(readInputEvent);
    const updateEntities = new Event('updateEntities');
    document.dispatchEvent(updateEntities);
    
    renderer.render(scene, camera);
}

const changeEvent = new Event('change');
checkbox.dispatchEvent(changeEvent);
renderer.setAnimationLoop( gameLoop );