#pragma glslify: blendSoftLight = require(../utils/blendSoftLight.glsl)
#pragma glslify: blendLinearLight = require(../utils/blendLinearLight.glsl)
#pragma glslify: blendLighten = require(../utils/blendLighten.glsl)
#pragma glslify: blendOverlay = require(../utils/blendOverlay.glsl)
#pragma glslify: blendColorDodge = require(../utils/blendColorDodge.glsl)
#pragma glslify: blendScreen = require(../utils/blendScreen.glsl)
#pragma glslify: blendAdd = require(../utils/blendAdd.glsl)
#pragma glslify: blendMultiply = require(../utils/blendMultiply.glsl)

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

uniform float uDiffuseMatcapBlend;
uniform float uEnvMapBlend;

uniform vec3 uColor;
uniform int uBlendMode;

#ifdef USE_MATCAP
    uniform sampler2D tMatcap;
#endif

#ifdef USE_MATCAP_MAP
    uniform sampler2D tMatcapMap;
#endif

#ifdef USE_DIFFUSE
    uniform float uDiffuseScale;
    uniform sampler2D tDiffuse;
#endif

#ifdef USE_NORMAL
    uniform sampler2D tNormal;
    uniform float uNormalScale;
    uniform float uNormalStrength;
#endif

#ifdef USE_ROUGH
    uniform sampler2D tRoughness;
#endif

varying vec4 vWorldPosition;

#ifdef USE_ENV

    uniform sampler2D tEnvMap;
    uniform float uEnvMapStrength;
    uniform float uRoughness;
    
    // Shader chunk that handles sampling the mipmapped image
    #include <cubeUVreflectionFrag>

    // Env map common
     vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	    return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
    }
    vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
        // dir can be either a direction vector or a normal vector
        // upper-left 3x3 of matrix is assumed to be orthogonal
        return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
    }

	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			vec3 reflectVec = reflect( - viewDir, normal );
			// Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( tEnvMap, reflectVec, roughness ); // Sample the mipmapped image
			return envMapColor.rgb * uEnvMapStrength;
	}

#endif