import * as THREE from 'three';
import { QuaternionUtilities } from './Utility.js';
import { ObjectTypes, attachedCollisionGroup, trashCollisionGroup } from './LevelLoader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import RAPIER from '@dimforge/rapier3d-compat'

export class PlayMode {
    playerCube = null;
    #playerLine = null;
    #attachedCube = null;
    #keys = {};
    #levelLoader;
    #scene;
    #world;

    constructor(levelLoader, scene, world) {
        this.#levelLoader = levelLoader;
        this.#scene = scene;
        this.#world = world;
        this.moveSpeed = 5;
        this.turnSpeed = 1;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.updatePlayerPosition = this.updatePlayerPosition.bind(this);
    }

    handleKeyDown(e) {
        this.#keys[e.key] = true;

        if (e.key === ' ') {
            if (this.#attachedCube) {
                this.detachCube();
            } else {
                this.attachCube();
            }
        }
    }

    handleKeyUp(e) {
        this.#keys[e.key] = false;
    }

    attachCube() {
        let direction = new THREE.Vector3();
        this.playerCube.cube.getWorldDirection(direction);
        direction.normalize();
        // multiply by 2
        direction = new THREE.Vector3(direction.x * 2, direction.y * 2, direction.z * 2);

        const raycaster = new THREE.Raycaster(this.playerCube.cube.position, direction);
        raycaster.camera = this.#levelLoader.camera;
        raycaster.layers.enableAll();
        const intersects = raycaster.intersectObjects(this.#scene.children, true);
        console.log(intersects.map(({object}) => object.name));
        if (intersects.length === 0) {
            return;
        }
        const intersectedObject = intersects[0].object;
        const layer = new THREE.Layers();
        layer.enable(trashCollisionGroup)
        if (!intersectedObject.layers.test(layer)) {
            return;
        }

        this.#attachedCube = this.#levelLoader.find(({cube}) => cube === intersectedObject);
        if (!this.#attachedCube) {
            return;
        }

        this.#attachedCube.body.setBodyType(RAPIER.RigidBodyType.Fixed); // Freeze physics
        this.#attachedCube.collider.setCollisionGroups(attachedCollisionGroup);

        // Store offset relative to player's position in local space
        const playerPosition = new THREE.Vector3(
            this.playerCube.body.translation().x,
            this.playerCube.body.translation().y,
            this.playerCube.body.translation().z
        );
        const attachedPosition = new THREE.Vector3(
            this.#attachedCube.body.translation().x,
            this.#attachedCube.body.translation().y,
            this.#attachedCube.body.translation().z
        );
        const rapierQuat = this.playerCube.body.rotation();
        const threeQuat = new THREE.Quaternion(rapierQuat.x, rapierQuat.y, rapierQuat.z, rapierQuat.w);
        const offset = attachedPosition.sub(playerPosition).applyQuaternion(threeQuat.conjugate());
        this.#attachedCube.body.offset = offset;
        // Store the y euler rotation of the player and attached cube
        const playerEulerInRads = QuaternionUtilities.quaternionToEuler(this.playerCube.body.rotation());
        const attachedEulerInRads = QuaternionUtilities.quaternionToEuler(this.#attachedCube.body.rotation());
        console.log({offset: this.#attachedCube.body.offset})
        this.#attachedCube.body.playerRotationYInRads = playerEulerInRads.y;
        this.#attachedCube.body.attachedRotationYInRads = attachedEulerInRads.y;
    }

    detachCube() {
        if (this.#attachedCube) {
            // enable all collisions again
            this.#attachedCube.collider.setCollisionGroups(0xFFFFFFFF);
            this.#attachedCube.body.setBodyType(RAPIER.RigidBodyType.Dynamic); // Unfreeze physics
            this.#attachedCube = null;
        }
    }

    updatePlayerPosition({delta}) {
        if (!this.playerCube) return;

        const direction = new THREE.Vector3();
        this.playerCube.cube.getWorldDirection(direction);

        let newPos = {x: 0, y: 0, z: 0};
        let newRot = this.playerCube.body.rotation();

        if (this.#keys['w']) {
            newPos.x += direction.x * this.moveSpeed * delta;
            newPos.z += direction.z * this.moveSpeed * delta;
        }
        if (this.#keys['s']) {
            newPos.x -= direction.x * this.moveSpeed * delta;
            newPos.z -= direction.z * this.moveSpeed * delta;
        }
        let rotationThisFrame = null;
        {
            const right = new THREE.Vector3();
            this.playerCube.cube.getWorldDirection(right);
            right.cross(new THREE.Vector3(0, 1, 0));
            right.normalize();

            if (this.#keys['q']) {
                newPos.x -= right.x * this.moveSpeed * delta;
                newPos.z -= right.z * this.moveSpeed * delta;
            }
            if (this.#keys['e']) {
                newPos.x += right.x * this.moveSpeed * delta;
                newPos.z += right.z * this.moveSpeed * delta;
            }
            if (this.#keys['a']) {
                rotationThisFrame = this.turnSpeed * delta;
                const q = QuaternionUtilities.quaternionFromEuler(0, rotationThisFrame, 0);
                newRot = QuaternionUtilities.multiplyQuaternion(newRot, q);
            }
            if (this.#keys['d']) {
                rotationThisFrame = -this.turnSpeed * delta;
                const q = QuaternionUtilities.quaternionFromEuler(0, rotationThisFrame, 0);
                newRot = QuaternionUtilities.multiplyQuaternion(newRot, q);
            }
        }

        this.characterController.computeColliderMovement(this.playerCube.collider, newPos, null, null, (collider) => {
            return collider.collisionGroups() != attachedCollisionGroup;
        });
        let correctedMovement = this.characterController.computedMovement();

        this.playerCube.body.setLinvel(new RAPIER.Vector3(correctedMovement.x / delta, correctedMovement.y / delta, correctedMovement.z / delta));
        this.playerCube.body.setTranslation(new RAPIER.Vector3(this.playerCube.body.translation().x, 0.5, this.playerCube.body.translation().z));
        this.playerCube.body.setRotation(newRot);

        // Update player line to always shoot from player position + 1 unit in front
        const shootDirection = new THREE.Vector3();
        this.playerCube.cube.getWorldDirection(shootDirection);
        shootDirection.normalize();
        const shootPosition = this.playerCube.cube.position.clone().add(shootDirection);
        this.#playerLine.geometry.setPositions( [
            this.playerCube.cube.position.x, this.playerCube.cube.position.y, this.playerCube.cube.position.z,
            shootPosition.x, shootPosition.y, shootPosition.z,
            this.playerCube.cube.position.x, this.playerCube.cube.position.y, this.playerCube.cube.position.z
        ] );
        this.playerLight.position.set(this.playerCube.cube.position.x, this.playerCube.cube.position.y, this.playerCube.cube.position.z);

        // Move attached cube with player
        this.updateAttachedCube(rotationThisFrame);
    }

    updateAttachedCube(eulerRotation) {
        if (!this.#attachedCube) return;

        const direction = new THREE.Vector3();
        this.playerCube.cube.getWorldDirection(direction);

        const offset = this.#attachedCube.body.offset.clone().applyQuaternion(this.playerCube.body.rotation());
        const newPos = new THREE.Vector3(
            this.playerCube.body.translation().x + offset.x,
            this.playerCube.body.translation().y + offset.y,
            this.playerCube.body.translation().z + offset.z
        );

        this.#attachedCube.body.setTranslation(newPos);

        const rotationOffset = QuaternionUtilities.quaternionFromEuler(0, eulerRotation, 0)
        let newRot = this.#attachedCube.body.rotation();
        newRot = QuaternionUtilities.multiplyQuaternion(newRot, rotationOffset);
        this.#attachedCube.body.setRotation(newRot);
    }

    enable() {
        const playerCell = this.#levelLoader.levelData.reduce((acc, row, rowIndex) => {
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

        const x = playerCell.colIndex - this.#levelLoader.levelData[0].length / 2;
        const y = playerCell.rowIndex - this.#levelLoader.levelData.length / 2;
        this.playerLight = new THREE.PointLight( 0xffffff, 1000, 100 );
        this.playerLight.position.set(x, 1, y);
        this.#scene.add( this.playerLight );

        this.playerCube = this.#levelLoader.spawnCube(x, y, 1, 1, ObjectTypes.PLAYER);
        this.characterController = this.#world.createCharacterController(0.01);
        this.characterController.setApplyImpulsesToDynamicBodies(true);
        this.playerCube.body.setRotation(QuaternionUtilities.quaternionFromEuler(0, Math.PI, 0))

        this.#playerLine = new Line2();
        this.#playerLine.material.color.set( 0xffffff );
        this.#playerLine.material.linewidth = 10;
        this.#scene.add( this.#playerLine );

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('update', this.updatePlayerPosition);
    }

    disable() {
        if (!this.playerCube) return;

        this.#scene.remove(this.#playerLine);
        this.#scene.remove(this.playerLight);

        this.playerCube.remove();
        this.playerCube = null;

        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('update', this.updatePlayerPosition);
    }
}