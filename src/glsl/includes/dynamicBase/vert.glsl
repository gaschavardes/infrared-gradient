// <normal_vertex> :
vec3 objectNormal = vec3( normal );
vec3 objectTangent = vec3( tangent.xyz );

// <defaultnormal_vertex> :
vec3 transformedNormal = objectNormal;
#ifdef USE_INSTANCING
	mat3 m = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
	transformedNormal = m * transformedNormal;
#endif
transformedNormal = normalMatrix * transformedNormal;
vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;

// <normal_vertex> :
vNormal = normalize( transformedNormal );
vTangent = normalize( transformedTangent );
vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );

vec4 mvPosition = vec4( transformedPosition, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;

vViewPosition = - mvPosition.xyz;

// world pos chunk
#ifdef USE_ENV
	vec4 worldPosition = vec4( transformedPosition, 1.0 );
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;

	vWorldPosition = worldPosition;

#endif