import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import RAPIER from '@dimforge/rapier3d-compat'
await RAPIER.init() // This line is only needed if using the compat version
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
const world = new RAPIER.World(gravity)
const dynamicBodies = []

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
        this.playerCube.cube.getWorldDirection(direction);

        if (keys['w']) {
            //this.playerCube.cube.position.addScaledVector(direction, this.moveSpeed);
            this.playerCube.body.applyForce(direction.x * 100, direction.y * 100, direction.z * 100)
        }
        if (keys['s']) {
            //this.playerCube.cube.position.addScaledVector(direction, -this.moveSpeed);
            this.playerCube.body.applyForce(-direction.x * 100, -direction.y * 100, -direction.z * 100)
        }

        const right = new THREE.Vector3();
        this.playerCube.cube.getWorldDirection(right);
        right.cross(new THREE.Vector3(0, 1, 0));
        right.normalize();

        if (keys['q']) {
            //this.playerCube.cube.position.addScaledVector(right, -this.moveSpeed);
        }
        if (keys['e']) {
            //this.playerCube.cube.position.addScaledVector(right, this.moveSpeed);
        }
        if (keys['a']) {
            //this.playerCube.cube.rotation.y += this.turnSpeed;
        }
        if (keys['d']) {
            //this.playerCube.cube.rotation.y -= this.turnSpeed;
        }

        // Update player line to always shoot from player position + 1 unit in front
        const shootDirection = new THREE.Vector3();
        this.playerCube.cube.getWorldDirection(shootDirection);
        shootDirection.normalize();
        const shootPosition = this.playerCube.cube.position.clone().add(shootDirection);
        this.playerLine.geometry.setPositions( [
            this.playerCube.cube.position.x, this.playerCube.cube.position.y, this.playerCube.cube.position.z,
            shootPosition.x, shootPosition.y, shootPosition.z,
            this.playerCube.cube.position.x, this.playerCube.cube.position.y, this.playerCube.cube.position.z
        ] );
        this.playerLight.position.set(this.playerCube.cube.position.x, this.playerCube.cube.position.y, this.playerCube.cube.position.z);
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
        this.playerLight = new THREE.PointLight( 0xffffff, 1000, 100 );
        this.playerLight.position.set(x, 1, y);
        scene.add( this.playerLight );

        this.playerCube = spawnCube(x, y, Colors.PLAYER);
        this.characterController = world.createCharacterController(0.01);
        const RAPIERQuaternionFromEuler = (x, y, z) => {
            const q = new RAPIER.Quaternion()
            const c1 = Math.cos(x / 2);
            const c2 = Math.cos(y / 2);
            const c3 = Math.cos(z / 2);
            const s1 = Math.sin(x / 2);
            const s2 = Math.sin(y / 2);
            const s3 = Math.sin(z / 2);

            q.x = s1 * c2 * c3 + c1 * s2 * s3;
            q.y = c1 * s2 * c3 - s1 * c2 * s3;
            q.z = c1 * c2 * s3 + s1 * s2 * c3;
            q.w = c1 * c2 * c3 - s1 * s2 * s3;
            return q
        };
        this.playerCube.body.setRotation(RAPIERQuaternionFromEuler(0, Math.PI, 0))

        this.playerLine = new Line2();
        this.playerLine.material.color.set( 0xffffff );
        this.playerLine.material.linewidth = 10;
        scene.add( this.playerLine );

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('updateEntities', this.updatePlayerPosition);
    }

    disable() {
        // scene.remove(this.playerCube);
        // scene.remove(this.playerLine);
        // scene.remove(this.playerLight);
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
    const geometry = new THREE.BoxGeometry( 38, 0, 38 );
    const material = new THREE.MeshStandardMaterial( { color: Colors.FLOOR.color } );
    const cube = new THREE.Mesh( geometry, material );
    scene.add( cube );

    // physics
    const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, -0.5, 0.0))
    const floorShape = RAPIER.ColliderDesc.cuboid(19.0, 0.5, 19.0)
    world.createCollider(floorShape, floorBody)
}
// add light
{
    const light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scene.add( light );
}
// add pointlight
{
    const spotLight = new THREE.PointLight( 0xffffff, 500, 100 );
    spotLight.castShadow = true;
    spotLight.position.set( 0, 25, 0 );
    scene.add( spotLight );
    const spotLightHelper = new THREE.PointLightHelper( spotLight, 1 );
    scene.add( spotLightHelper );
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
    const material = new THREE.MeshStandardMaterial({ color: object.color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, 1, y);
    scene.add(cube);
    // physics
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.5, y))
    const shape = RAPIER.ColliderDesc.cuboid(object.size / 2, object.size / 2, object.size / 2)
    world.createCollider(shape, body)
    dynamicBodies.push([cube, body])
    return {cube, body};
};

// disable rightclick context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

camera.position.z = 35;
camera.position.y = 111;
camera.rotation.x = -Math.PI / 2.5;

// listen to mose wheel and change camera rotation z

const clock = new THREE.Clock()
let delta

function gameLoop() {
    delta = clock.getDelta()
    world.timestep = Math.min(delta, 0.1)
    world.step()

    for (let i = 0, n = dynamicBodies.length; i < n; i++) {
        dynamicBodies[i][0].position.copy(dynamicBodies[i][1].translation())
        dynamicBodies[i][0].quaternion.copy(dynamicBodies[i][1].rotation())
    }

    const readInputEvent = new Event('readInput');
    document.dispatchEvent(readInputEvent);
    const updateEntities = new Event('updateEntities');
    document.dispatchEvent(updateEntities);

    renderer.render(scene, camera);
}

const changeEvent = new Event('change');
checkbox.dispatchEvent(changeEvent);
renderer.setAnimationLoop( gameLoop );