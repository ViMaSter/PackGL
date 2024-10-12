import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

export class QuaternionUtilities {
    static multiplyQuaternion(q1, q2) {
        return new RAPIER.Quaternion(
            q1.x * q2.w + q1.w * q2.x + q1.y * q2.z - q1.z * q2.y,
            q1.y * q2.w + q1.w * q2.y + q1.z * q2.x - q1.x * q2.z,
            q1.z * q2.w + q1.w * q2.z + q1.x * q2.y - q1.y * q2.x,
            q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
        );
    }

    static quaternionFromEuler(x, y, z) {
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(x, y, z));
        return q;
    }

    static quaternionToEuler(q) {
        const euler = new THREE.Euler();
        euler.setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
        return euler;
    }
}