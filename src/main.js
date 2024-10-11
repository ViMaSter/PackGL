import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EditorMode } from './EditorMode.js';
import { PlayMode } from './PlayMode.js';
import { LevelLoader } from './LevelLoader.js';

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

{
    const playMode = new PlayMode(levelLoader, scene, world);
    const editorMode = new EditorMode(levelLoader.camera);

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

const gameLoop = () => {
    delta = clock.getDelta()
    world.timestep = Math.min(delta, 0.1)

    const readInputEvent = new Event('readInput');
    document.dispatchEvent(readInputEvent);
    const updateEvent = new UpdateEvent(delta);
    document.dispatchEvent(updateEvent);

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