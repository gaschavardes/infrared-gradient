attribute vec4 tangent;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

// From shader chunk
#ifdef USE_ENV

    vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	    return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
    }
    vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
        // dir can be either a direction vector or a normal vector
        // upper-left 3x3 of matrix is assumed to be orthogonal
        return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
    }
    
#endif

varying vec4 vWorldPosition;