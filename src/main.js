import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EditorMode } from './EditorMode.js';
import { PlayMode } from './PlayMode.js';
import { LevelLoader } from './LevelLoader.js';
import { QuaternionUtilities } from './Utility.js';

await RAPIER.init()
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
const world = new RAPIER.World(gravity)

const scene = new THREE.Scene();

const levelLoader = new LevelLoader(scene, world);
await levelLoader.loadLevel('static/level/0.lvl');

document.addEventListener('contextmenu', (e) => e.preventDefault());

const clock = new THREE.Clock();
let delta;

// physics debug rendering
const isDebugModeCheckbox = document.createElement('input');
{
    const renderPhysicsDebug = document.createElement('label');
    renderPhysicsDebug.innerText = 'Physics Debug Visualizer';
    renderPhysicsDebug.style.position = 'absolute';
    renderPhysicsDebug.style.top = '40px';
    renderPhysicsDebug.style.right = '30px';
    renderPhysicsDebug.style.color = 'white';
    
    isDebugModeCheckbox.type = 'checkbox';
    isDebugModeCheckbox.addEventListener('change', (e) => {
        if (!e.target.checked) {
            debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
            debugGeometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
        }
    });
    const debugGeometry = new THREE.BufferGeometry();
    const debugMaterial = new THREE.LineBasicMaterial({ vertexColors: true });
    const debugLine = new THREE.LineSegments(debugGeometry, debugMaterial);
    scene.add(debugLine);
    
    renderPhysicsDebug.appendChild(isDebugModeCheckbox);
    document.body.appendChild(renderPhysicsDebug);
}

class UpdateEvent extends Event {
    constructor(delta) {
        super('update');
        this.delta = delta;
    }
}

const isPlayModeCheckbox = document.createElement('input');
const playMode = new PlayMode(levelLoader, scene, world);
const editorMode = new EditorMode(levelLoader.camera);
{

    const playModeLabel = document.createElement('label');
    playModeLabel.innerText = 'PlayMode';
    playModeLabel.style.position = 'absolute';
    playModeLabel.style.top = '10px';
    playModeLabel.style.right = '30px';
    playModeLabel.style.color = 'white';

    isPlayModeCheckbox.type = 'checkbox';

    playModeLabel.appendChild(isPlayModeCheckbox);
    document.body.appendChild(playModeLabel);

    isPlayModeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            editorMode.disable();
            playMode.enable();
            return;
        }
        
        playMode.disable();
        editorMode.enable();
    });

    const changeEvent = new Event('change');
    isPlayModeCheckbox.dispatchEvent(changeEvent);
}

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

    let currentKey = null;
    let state = "ROTATING_LEFT";
    const automateInput = async () => {
        if (!isPlayModeCheckbox.checked) {
            return;
        }

        if (!playMode.playerCube) {
            return;
        }

        const left = -90;
        const right = 90;
        const tolerance = 1;
        const rotQuaternion = playMode.playerCube.body.rotation();
        const rotEuler = QuaternionUtilities.quaternionToEuler(rotQuaternion).y * 180 / Math.PI;

        if (state === "ROTATING_LEFT") {
            console.log(`rotEuler: ${rotEuler}, left: ${left}, diff: ${Math.abs(rotEuler - left)}`);
            if (Math.abs(rotEuler - left) < tolerance) {
                document.dispatchEvent(new KeyboardEvent('keyup', { key: currentKey }));
                currentKey = null;
                state = "MOVING_LEFT";
                return;
            }

            if (currentKey) {
                return;
            }

            currentKey = 'a';
            document.dispatchEvent(new KeyboardEvent('keydown', { key: currentKey }));
        }

        if (state === "MOVING_LEFT") {
            console.log(`x: ${playMode.playerCube.body.translation().x}`);
            if (playMode.playerCube.body.translation().x < -3) {
                document.dispatchEvent(new KeyboardEvent('keyup', { key: currentKey }));
                currentKey = null;
                state = "ROTATING_RIGHT";
                return;
            }

            if (currentKey) {
                return;
            }

            currentKey = 'w';
            document.dispatchEvent(new KeyboardEvent('keydown', { key: currentKey }));
        }

        if (state === "ROTATING_RIGHT") {
            console.log(`rotEuler: ${rotEuler}, left: ${right}, diff: ${Math.abs(rotEuler - right)}`);
            if (Math.abs(rotEuler - right) < tolerance) {
                document.dispatchEvent(new KeyboardEvent('keyup', { key: currentKey }));
                currentKey = null;
                state = "MOVING_RIGHT";
                return;
            }

            if (currentKey) {
                return;
            }

            currentKey = 'd';
            document.dispatchEvent(new KeyboardEvent('keydown', { key: currentKey }));
        }

        if (state === "MOVING_RIGHT") {
            console.log(`x: ${playMode.playerCube.body.translation().x}`);
            if (playMode.playerCube.body.translation().x > 2) {
                document.dispatchEvent(new KeyboardEvent('keyup', { key: currentKey }));
                currentKey = null;
                state = "ROTATING_LEFT";
                return;
            }

            if (currentKey) {
                return;
            }

            currentKey = 'w';
            document.dispatchEvent(new KeyboardEvent('keydown', { key: currentKey }));
        }
    }

const gameLoop = () => {
    delta = clock.getDelta()
    world.timestep = Math.min(delta, 0.1)

    const readInputEvent = new Event('readInput');
    document.dispatchEvent(readInputEvent);
    const updateEvent = new UpdateEvent(delta);
    document.dispatchEvent(updateEvent);

    automateInput();

    world.step();

    levelLoader.applyPhysicsWorldToThreeJS();

    if (isDebugModeCheckbox.checked) {
        const { vertices, colors } = world.debugRender();
        debugGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        debugGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    renderer.render(scene, levelLoader.camera);
}

renderer.setAnimationLoop( gameLoop );