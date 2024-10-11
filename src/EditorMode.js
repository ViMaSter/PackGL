import * as THREE from 'three';

export class EditorMode {
    #isRightMouseDown = false
    #lastMouseX = 0;
    #lastMouseY = 0;

    #keys = {};
    #camera;

    constructor(camera) {
        this.#camera = camera;
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
        this.#camera.getWorldDirection(direction);

        if (this.#keys['w']) {
            this.#camera.position.addScaledVector(direction, this.moveSpeed);
        }
        if (this.#keys['s']) {
            this.#camera.position.addScaledVector(direction, -this.moveSpeed);
        }

        const right = new THREE.Vector3();
        this.#camera.getWorldDirection(right);
        right.cross(new THREE.Vector3(0, 1, 0));
        right.normalize();

        if (this.#keys['a']) {
            this.#camera.position.addScaledVector(right, -this.moveSpeed);
        }
        if (this.#keys['d']) {
            this.#camera.position.addScaledVector(right, this.moveSpeed);
        }

        if (this.#keys[' ']) { // Space key
            this.#camera.position.y += this.moveSpeed;
        }
        if (this.#keys['Shift']) { // Shift key
            this.#camera.position.y -= this.moveSpeed;
        }

        // Keep the this.#camera roll locked
        this.#camera.up.set(0, 1, 0);
        this.#camera.lookAt(this.#camera.position.clone().add(direction));
    }

    handleKeyDown(e) {
        this.#keys[e.key] = true;
    }

    handleKeyUp(e) {
        this.#keys[e.key] = false;
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
        euler.setFromQuaternion(this.#camera.quaternion);

        euler.y -= deltaX / 1000;
        euler.x -= deltaY / 1000;

        this.#camera.quaternion.setFromEuler(euler);

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