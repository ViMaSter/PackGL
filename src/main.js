import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import RAPIER from '@dimforge/rapier3d-compat'
import { QuaternionUtilities } from './Utility.js';

await RAPIER.init()
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
const world = new RAPIER.World(gravity)
const dynamicBodies = []

const keys = {};

const trashCollisionGroup = 2;
const attachedCollisionGroup = 3;

const ObjectTypes = {
    FLOOR: { color: 0x333333, type: RAPIER.RigidBodyDesc.fixed, mass: 1 },
    WALL: { color: 0xFFFFFF, type: RAPIER.RigidBodyDesc.fixed, mass: 1 },
    GOAL: { color: 0x00ff00, type: null, mass: 1 },
    TRASH1: { color: 0xff0000, type: RAPIER.RigidBodyDesc.dynamic, mass: 1000, customCollisionGroup: trashCollisionGroup},
    TRASH2: { color: 0xffa500, type: RAPIER.RigidBodyDesc.dynamic, mass: 1000, customCollisionGroup: trashCollisionGroup},
    PLAYER: { color: 0x0000ff, type: RAPIER.RigidBodyDesc.kinematicVelocityBased, mass: 1 },
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 10, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.layers.enableAll();

const quaternionToEuler = (q) => {
    const euler = new THREE.Euler();
    const ysqr = q.y * q.y;

    // roll (x-axis rotation)
    const t0 = +2.0 * (q.w * q.x + q.y * q.z);
    const t1 = +1.0 - 2.0 * (q.x * q.x + ysqr);
    euler.x = Math.atan2(t0, t1);

    // pitch (y-axis rotation)
    let t2 = +2.0 * (q.w * q.y - q.z * q.x);
    t2 = t2 > 1.0 ? 1.0 : t2;
    t2 = t2 < -1.0 ? -1.0 : t2;
    euler.y = Math.asin(t2);

    // yaw (z-axis rotation)
    const t3 = +2.0 * (q.w * q.z + q.x * q.y);
    const t4 = +1.0 - 2.0 * (ysqr + q.z * q.z);
    euler.z = Math.atan2(t3, t4);

    return euler;
}


class EditorMode {
    #isRightMouseDown = false
    #lastMouseX = 0;
    #lastMouseY = 0;

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

        if (keys[' ']) { // Space key
            camera.position.y += this.moveSpeed;
        }
        if (keys['Shift']) { // Shift key
            camera.position.y -= this.moveSpeed;
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
            this.#isRightMouseDown = true;
            this.#lastMouseX = e.clientX;
            this.#lastMouseY = e.clientY;
        }
    }

    handleMouseUp(e) {
        if (e.button === 2) {
            this.#isRightMouseDown = false;
        }
    }

    handleMouseMove(e) {
        if (!this.#isRightMouseDown) {
            return;
        }

        const deltaX = e.clientX - this.#lastMouseX;
        const deltaY = e.clientY - this.#lastMouseY;

        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);

        euler.y -= deltaX / 1000;
        euler.x -= deltaY / 1000;

        camera.quaternion.setFromEuler(euler);

        this.#lastMouseX = e.clientX;
        this.#lastMouseY = e.clientY;
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
    #playerCube = null;
    #playerLine = null;
    #attachedCube = null;

    constructor() {
        this.moveSpeed = 5;
        this.turnSpeed = 5;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.updatePlayerPosition = this.updatePlayerPosition.bind(this);
    }

    handleKeyDown(e) {
        keys[e.key] = true;

        if (e.key === ' ') {
            if (this.#attachedCube) {
                this.detachCube();
            } else {
                this.attachCube();
            }
        }
    }

    handleKeyUp(e) {
        keys[e.key] = false;
    }

    attachCube() {
        let direction = new THREE.Vector3();
        this.#playerCube.cube.getWorldDirection(direction);
        direction.normalize();
        // multiply by 2
        direction = new THREE.Vector3(direction.x * 2, direction.y * 2, direction.z * 2);

        const raycaster = new THREE.Raycaster(this.#playerCube.cube.position, direction);
        raycaster.camera = camera;
        raycaster.layers.enableAll();
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length === 0) {
            return;
        }
        const intersectedObject = intersects[0].object;
        const layer = new THREE.Layers();
        layer.enable(trashCollisionGroup)
        if (!intersectedObject.layers.test(layer)) {
            return;
        }

        this.#attachedCube = dynamicBodies.find(([cube]) => cube === intersectedObject);
        if (!this.#attachedCube) {
            return;
        }

        this.#attachedCube[1].setBodyType(RAPIER.RigidBodyType.Fixed); // Freeze physics
        this.#attachedCube[2].setCollisionGroups(attachedCollisionGroup);

        // Store offset relative to player's position in local space
        const playerPosition = new THREE.Vector3(
            this.#playerCube.body.translation().x,
            this.#playerCube.body.translation().y,
            this.#playerCube.body.translation().z
        );
        const attachedPosition = new THREE.Vector3(
            this.#attachedCube[1].translation().x,
            this.#attachedCube[1].translation().y,
            this.#attachedCube[1].translation().z
        );
        const rapierQuat = this.#playerCube.body.rotation();
        const threeQuat = new THREE.Quaternion(rapierQuat.x, rapierQuat.y, rapierQuat.z, rapierQuat.w);
        const offset = attachedPosition.sub(playerPosition).applyQuaternion(threeQuat.conjugate());
        this.#attachedCube[1].offset = offset;
        // Store the y euler rotation of the player and attached cube
        const playerEulerInRads = quaternionToEuler(this.#playerCube.body.rotation());
        const attachedEulerInRads = quaternionToEuler(this.#attachedCube[1].rotation());
        console.log({offset: this.#attachedCube[1].offset})
        this.#attachedCube[1].playerRotationYInRads = playerEulerInRads.y;
        this.#attachedCube[1].attachedRotationYInRads = attachedEulerInRads.y;
    }

    detachCube() {
        if (this.#attachedCube) {
            // enable all collisions again
            this.#attachedCube[2].setCollisionGroups(0xFFFFFFFF);
            this.#attachedCube[1].setBodyType(RAPIER.RigidBodyType.Dynamic); // Unfreeze physics
            this.#attachedCube = null;
        }
    }

    updatePlayerPosition() {
        if (!this.#playerCube) return;

        const direction = new THREE.Vector3();
        this.#playerCube.cube.getWorldDirection(direction);

        let newPos = {x: 0, y: 0, z: 0};
        let newRot = this.#playerCube.body.rotation();

        if (keys['w']) {
            newPos.x += direction.x * this.moveSpeed * delta;
            newPos.z += direction.z * this.moveSpeed * delta;
        }
        if (keys['s']) {
            newPos.x += direction.x * -this.moveSpeed * delta;
            newPos.z += direction.z * -this.moveSpeed * delta;
        }
        let rotationThisFrame = null;
        {
            const right = new THREE.Vector3();
            this.#playerCube.cube.getWorldDirection(right);
            right.cross(new THREE.Vector3(0, 1, 0));
            right.normalize();

            if (keys['q']) {
                newPos.x += right.x * -this.moveSpeed * delta;
                newPos.z += right.z * -this.moveSpeed * delta;
            }
            if (keys['e']) {
                newPos.x += right.x * this.moveSpeed * delta;
                newPos.z += right.z * this.moveSpeed * delta;
            }
            if (keys['a']) {
                rotationThisFrame = this.turnSpeed * delta;
                const q = QuaternionUtilities.quaternionFromEuler(0, rotationThisFrame, 0);
                newRot = QuaternionUtilities.multiplyQuaternion(newRot, q);
            }
            if (keys['d']) {
                rotationThisFrame = -this.turnSpeed * delta;
                const q = QuaternionUtilities.quaternionFromEuler(0, rotationThisFrame, 0);
                newRot = QuaternionUtilities.multiplyQuaternion(newRot, q);
            }
        }

        this.characterController.computeColliderMovement(this.#playerCube.collider, newPos, null, null, (collider) => {
            return collider.collisionGroups() != attachedCollisionGroup;
        });
        let correctedMovement = this.characterController.computedMovement();

        this.#playerCube.body.setLinvel(new RAPIER.Vector3(correctedMovement.x / delta, correctedMovement.y / delta, correctedMovement.z / delta));
        this.#playerCube.body.setTranslation(new RAPIER.Vector3(this.#playerCube.body.translation().x, 0.5, this.#playerCube.body.translation().z));
        this.#playerCube.body.setRotation(newRot);

        // Update player line to always shoot from player position + 1 unit in front
        const shootDirection = new THREE.Vector3();
        this.#playerCube.cube.getWorldDirection(shootDirection);
        shootDirection.normalize();
        const shootPosition = this.#playerCube.cube.position.clone().add(shootDirection);
        this.#playerLine.geometry.setPositions( [
            this.#playerCube.cube.position.x, this.#playerCube.cube.position.y, this.#playerCube.cube.position.z,
            shootPosition.x, shootPosition.y, shootPosition.z,
            this.#playerCube.cube.position.x, this.#playerCube.cube.position.y, this.#playerCube.cube.position.z
        ] );
        this.playerLight.position.set(this.#playerCube.cube.position.x, this.#playerCube.cube.position.y, this.#playerCube.cube.position.z);

        // Move attached cube with player
        this.updateAttachedCube(rotationThisFrame);
    }

    updateAttachedCube(eulerRotation) {
        if (!this.#attachedCube) return;

        const direction = new THREE.Vector3();
        this.#playerCube.cube.getWorldDirection(direction);

        const offset = this.#attachedCube[1].offset.clone().applyQuaternion(this.#playerCube.body.rotation());
        const newPos = new THREE.Vector3(
            this.#playerCube.body.translation().x + offset.x,
            this.#playerCube.body.translation().y + offset.y,
            this.#playerCube.body.translation().z + offset.z
        );

        this.#attachedCube[1].setTranslation(newPos);

        const rotationOffset = QuaternionUtilities.quaternionFromEuler(0, eulerRotation, 0)
        let newRot = this.#attachedCube[1].rotation();
        newRot = QuaternionUtilities.multiplyQuaternion(newRot, rotationOffset);
        this.#attachedCube[1].setRotation(newRot);
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

        this.#playerCube = LevelLoader.spawnCube(x, y, 1, 1, ObjectTypes.PLAYER);
        this.characterController = world.createCharacterController(0.01);
        this.characterController.setApplyImpulsesToDynamicBodies(true);
        this.#playerCube.body.setRotation(QuaternionUtilities.quaternionFromEuler(0, Math.PI, 0))

        this.#playerLine = new Line2();
        this.#playerLine.material.color.set( 0xffffff );
        this.#playerLine.material.linewidth = 10;
        scene.add( this.#playerLine );

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('updateEntities', this.updatePlayerPosition);
    }

    disable() {
        if (!this.#playerCube) return;

        scene.remove(this.#playerLine);
        scene.remove(this.playerLight);

        this.#playerCube.remove();
        this.#playerCube = null;

        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('updateEntities', this.updatePlayerPosition);
    }
}

class LevelLoader {
    static #addBasics(levelData) {
        const floorSize = Math.max(levelData[0].length, levelData.length);

        const floor = this.spawnCube(0, 0, floorSize, floorSize, ObjectTypes.FLOOR);
        floor.body.setTranslation(new RAPIER.Vector3(0, 0, 0));

        // ambient light
        const light = new THREE.AmbientLight(0x404040); // soft white light
        scene.add(light);

        // point light
        const spotLight = new THREE.PointLight(0xffffff, floorSize*25, floorSize*20);
        spotLight.castShadow = true;
        spotLight.position.set(0, 25, 0);
        scene.add(spotLight);

        const spotLightHelper = new THREE.PointLightHelper(spotLight, 1);
        scene.add(spotLightHelper);
    }

    static async loadLevel(levelPath) {
        const loader = new THREE.FileLoader();
        const data = await new Promise((resolve, reject) => {
            loader.load(levelPath, resolve, undefined, reject);
        });

        const levelData = data.split('\n');
        levelData.forEach((row, rowIndex) => {
            row.split('').forEach((cell, colIndex) => {
                const x = colIndex - levelData[0].length / 2;
                const y = rowIndex - levelData.length / 2;
                switch (cell) {
                    case 'W':
                        this.spawnCube(x, y, 1, 1, ObjectTypes.WALL);
                        break;
                    case 'G':
                        this.spawnCube(x, y, 1, 1, ObjectTypes.GOAL);
                        break;
                    case '1':
                        this.spawnCube(x, y, 0.75, 0.75, ObjectTypes.TRASH1);
                        break;
                    case '2':
                        this.spawnCube(x, y, 0.75, 0.75, ObjectTypes.TRASH2);
                        break;
                    case ' ':
                    case 'S':
                        break;
                    default:
                        throw new Error(`Unknown cell type: ${cell}`);
                }
            });
        });

        this.#addBasics(levelData);

        return levelData;
    }

    static #spawnTrigger(x, y, sizeX, sizeY, object) {
        const geometry = new THREE.BoxGeometry(sizeX, 1, sizeY);
        const material = new THREE.MeshStandardMaterial({ color: object.color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, 0.5, y);
        scene.add(cube);
        return cube;
    };

    static spawnCube(x, y, sizeX, sizeY, object) {
        const cube = this.#spawnTrigger(x, y, sizeX, sizeY, object);
        cube.name = `#${object.color.toString(16).padStart(6, '0')}`;
        if (object.type === null) {
            return cube;
        }

        const body = world.createRigidBody(object.type().setTranslation(x, 0.5, y)); 
        const shape = RAPIER.ColliderDesc.cuboid(sizeX / 2, 1 / 2, sizeY / 2).setDensity(object.mass);
        const collider = world.createCollider(shape, body);
        cube.layers.disableAll();
        cube.layers.enable(1);
        if (object.customCollisionGroup !== undefined) {
            collider.setCollisionGroups(0xFFFF0000 | object.customCollisionGroup);
            cube.layers.enable(object.customCollisionGroup);
        }

        dynamicBodies.push([cube, body, collider]);

        const remove = () => {
            dynamicBodies.splice(dynamicBodies.findIndex(([, b]) => b === body), 1);
            scene.remove(cube);
            world.removeCollider(collider);
            world.removeRigidBody(body);
        };
        return {cube, body, collider, remove};
    };
}

const levelData = await LevelLoader.loadLevel('static/level/0.lvl');

document.addEventListener('contextmenu', (e) => e.preventDefault());
camera.position.z = 35;
camera.position.y = 111;
camera.rotation.x = -Math.PI / 2.5;

const clock = new THREE.Clock();
let delta;

const debugGeometry = new THREE.BufferGeometry();
const debugMaterial = new THREE.LineBasicMaterial({ vertexColors: true });
const debugLine = new THREE.LineSegments(debugGeometry, debugMaterial);
scene.add(debugLine);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );


const renderPhysicsDebug = document.createElement('label');
renderPhysicsDebug.innerText = 'Physics Debug Visualizer';
renderPhysicsDebug.style.position = 'absolute';
renderPhysicsDebug.style.top = '40px';
renderPhysicsDebug.style.right = '30px';
renderPhysicsDebug.style.color = 'white';

const isDebugModeCheckbox = document.createElement('input');
isDebugModeCheckbox.type = 'checkbox';
isDebugModeCheckbox.addEventListener('change', (e) => {
    if (!e.target.checked) {
        debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
        debugGeometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
    }
});

renderPhysicsDebug.appendChild(isDebugModeCheckbox);
document.body.appendChild(renderPhysicsDebug);

const gameLoop = () => {
    delta = clock.getDelta()
    world.timestep = Math.min(delta, 0.1)

    const readInputEvent = new Event('readInput');
    document.dispatchEvent(readInputEvent);
    const updateEntities = new Event('updateEntities');
    document.dispatchEvent(updateEntities);

    world.step()

    for (let i = 0, n = dynamicBodies.length; i < n; i++) {
        if (!dynamicBodies[i][1]) {
            continue;
        }
        dynamicBodies[i][0].position.copy(dynamicBodies[i][1].translation())
        dynamicBodies[i][0].quaternion.copy(dynamicBodies[i][1].rotation())
    }

    if (isDebugModeCheckbox.checked) {
        const { vertices, colors } = world.debugRender();
        debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        debugGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    renderer.render(scene, camera);
}

{
    const playerMode = new PlayerMode();
    const editorMode = new EditorMode();

    const playModeLabel = document.createElement('label');
    playModeLabel.innerText = 'PlayMode';
    playModeLabel.style.position = 'absolute';
    playModeLabel.style.top = '10px';
    playModeLabel.style.right = '30px';
    playModeLabel.style.color = 'white';

    const isPlayModeCheckbox = document.createElement('input');
    isPlayModeCheckbox.type = 'checkbox';

    playModeLabel.appendChild(isPlayModeCheckbox);
    document.body.appendChild(playModeLabel);

    isPlayModeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            editorMode.disable();
            playerMode.enable();
            return;
        }
        
        playerMode.disable();
        editorMode.enable();
    });

    const changeEvent = new Event('change');
    isPlayModeCheckbox.dispatchEvent(changeEvent);
}

renderer.setAnimationLoop( gameLoop );