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
        const q = new RAPIER.Quaternion();
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
        return q;
    }

    static quaternionToEuler(q) {
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
}