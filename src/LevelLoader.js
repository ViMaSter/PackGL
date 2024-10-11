import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export const trashCollisionGroup = 2;
export const attachedCollisionGroup = 3;

export const ObjectTypes = {
    FLOOR: { color: 0x333333, type: RAPIER.RigidBodyDesc.fixed, mass: 1 },
    WALL: { color: 0xFFFFFF, type: RAPIER.RigidBodyDesc.fixed, mass: 1 },
    GOAL: { color: 0x00ff00, type: null, mass: 1 },
    TRASH1: { color: 0xff0000, type: RAPIER.RigidBodyDesc.dynamic, mass: 1000, customCollisionGroup: trashCollisionGroup},
    TRASH2: { color: 0xffa500, type: RAPIER.RigidBodyDesc.dynamic, mass: 1000, customCollisionGroup: trashCollisionGroup},
    PLAYER: { color: 0x0000ff, type: RAPIER.RigidBodyDesc.kinematicVelocityBased, mass: 1 },
};

export class LevelLoader {
    #dynamicBodies = []

    find(predicate) {
        return this.#dynamicBodies.find(predicate);
    }

    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
    }

    #addBasics() {
        //camera
        this.camera = new THREE.PerspectiveCamera( 10, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.layers.enableAll();
        this.camera.position.z = 35;
        this.camera.position.y = 111;
        this.camera.rotation.x = -Math.PI / 2.5;

        // floor
        const floorSize = Math.max(this.levelData[0].length, this.levelData.length);

        const floor = this.spawnCube(0, 0, floorSize, floorSize, ObjectTypes.FLOOR);
        floor.body.setTranslation(new RAPIER.Vector3(0, 0, 0));

        // ambient light
        const light = new THREE.AmbientLight(0x404040); // soft white light
        this.scene.add(light);

        // point light
        const spotLight = new THREE.PointLight(0xffffff, floorSize*25, floorSize*20);
        spotLight.castShadow = true;
        spotLight.position.set(0, 25, 0);
        this.scene.add(spotLight);

        const spotLightHelper = new THREE.PointLightHelper(spotLight, 1);
        this.scene.add(spotLightHelper);
    }

    async loadLevel(levelPath) {
        const loader = new THREE.FileLoader();
        const data = await new Promise((resolve, reject) => {
            loader.load(levelPath, resolve, undefined, reject);
        });

        this.levelData = data.split('\n');
        this.levelData.forEach((row, rowIndex) => {
            row.split('').forEach((cell, colIndex) => {
                const x = colIndex - this.levelData[0].length / 2;
                const y = rowIndex - this.levelData.length / 2;
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

        this.#addBasics();
    }

    #spawnTrigger(x, y, sizeX, sizeY, object) {
        const geometry = new THREE.BoxGeometry(sizeX, 1, sizeY);
        const material = new THREE.MeshStandardMaterial({ color: object.color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, 0.5, y);
        this.scene.add(cube);
        return cube;
    };

    spawnCube(x, y, sizeX, sizeY, object) {
        const cube = this.#spawnTrigger(x, y, sizeX, sizeY, object);
        cube.name = `#${object.color.toString(16).padStart(6, '0')}`;
        if (object.type === null) {
            return cube;
        }

        const newBody = this.world.createRigidBody(object.type().setTranslation(x, 0.5, y)); 
        const shape = RAPIER.ColliderDesc.cuboid(sizeX / 2, 1 / 2, sizeY / 2).setDensity(object.mass);
        const collider = this.world.createCollider(shape, newBody);
        cube.layers.disableAll();
        cube.layers.enable(1);
        if (object.customCollisionGroup !== undefined) {
            collider.setCollisionGroups(0xFFFF0000 | object.customCollisionGroup);
            cube.layers.enable(object.customCollisionGroup);
        }

        this.#dynamicBodies.push({cube, body: newBody, collider});

        const remove = () => {
            this.#dynamicBodies.splice(this.#dynamicBodies.findIndex(({body}) => newBody === body), 1);
            this.scene.remove(cube);
            this.world.removeCollider(collider);
            this.world.removeRigidBody(newBody);
        };
        return {cube, body: newBody, collider, remove};
    };

    applyPhysicsWorldToThreeJS()
    {
        for (let i = 0, n = this.#dynamicBodies.length; i < n; i++) {
            if (!this.#dynamicBodies[i].body) {
                continue;
            }
            this.#dynamicBodies[i].cube.position.copy(this.#dynamicBodies[i].body.translation())
            this.#dynamicBodies[i].cube.quaternion.copy(this.#dynamicBodies[i].body.rotation())
        }
    }
}