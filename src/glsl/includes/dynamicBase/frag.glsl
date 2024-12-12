#ifdef USE_DIFFUSE
	vec4 diffuseColor = texture2D( tDiffuse, vUv * uDiffuseScale );
#else
	vec4 diffuseColor = vec4(uColor, 1.0);
#endif

#if defined(USE_MATCAP) || defined(USE_ENV) || defined(USE_NORMAL)
	vec3 normal = normalize( vNormal );

	float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
	vec3 tangent = normalize( vTangent );
	vec3 bitangent = normalize( vBitangent );
	#ifdef DOUBLE_SIDED
		tangent = tangent * faceDirection;
		bitangent = bitangent * faceDirection;
	#endif
	mat3 vTBN = mat3( tangent, bitangent, normal );
#endif

#ifdef USE_NORMAL
	#ifdef OBJECTSPACE_NORMALMAP
		normal = texture2D( tNormal, vUv * uNormalScale ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
		#ifdef FLIP_SIDED
			normal = - normal;
		#endif
		#ifdef DOUBLE_SIDED
			normal = normal * faceDirection;
		#endif
		normal = normalize( normalMatrix * normal );
	#else 
		// Tangent space normal maps
		float normalScale = uNormalStrength; // Strength
		vec3 mapN = texture2D( tNormal, vUv * uNormalScale ).xyz * 2.0 - 1.0;
		mapN.xy *= normalScale;
		normal = normalize( vTBN * mapN );
	#endif
#endif

#if defined(USE_MATCAP) || defined(USE_ENV)  
	vec3 viewDir = normalize( vViewPosition );
#endif

#ifdef USE_MATCAP
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks

	vec4 matcapColor = texture2D( tMatcap, uv );

	#ifdef USE_MATCAP_MAP
		vec4 matcapMap = texture2D( tMatcapMap, vUv );
		matcapColor *= matcapMap * 1.5;
	#endif

	#ifdef USE_MATCAP_EXTRA
		vec4 extraMatcap = texture2D( tMatcapExtra, uv );
	#endif
#else
    vec4 matcapColor = vec4(1.); // default if matcap is missing
#endif

#ifdef USE_ENV
	vec3 geometryNormal = normal;
	// Lights physical fragment
	// Take into account the normals of the geometry (changed by the normal map) + the roughness factor set by the uniform
	vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );
	float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );

	#ifdef USE_ROUGH
		// Use a roughness map, multiplied by the roughness factor for extra control
		float roughness = max( clamp(texture2D(tRoughness, vUv).r * uRoughness, 0.0, 1.0), 0.0525 );// 0.0525 corresponds to the base mip of a 256 cubemap.
	#else 
		float roughness = max( uRoughness, 0.0525 );// 0.0525 corresponds to the base mip of a 256 cubemap.
	#endif
	
	roughness += geometryRoughness;
	roughness = min( roughness, 1.0 ); // Clamp it to 1

	vec3 specular = vec3( 0.0 ); 
	specular += getIBLRadiance( viewDir, geometryNormal, roughness ); 

#else
	vec3 specular = vec3(0.);
#endif

#ifdef USE_SHADOW
	vec4 shadowOverlay = texture2D(tShadow, vUv);
#endif

// Mix between all
#ifdef USE_MATCAP

	vec3 outgoingLight;

	if(uBlendMode == 0) {
        outgoingLight = blendSoftLight(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend);
    } else if(uBlendMode == 1){
        outgoingLight = blendLinearLight(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend);
    } else if(uBlendMode == 2){
        outgoingLight = blendLighten(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend);
    } else if(uBlendMode == 3){
        outgoingLight = blendOverlay(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend);
    } else if(uBlendMode == 4){
        outgoingLight = blendAdd(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend);
    } else {
        outgoingLight = blendMultiply(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend);
    }

	#ifdef USE_MATCAP_EXTRA
		outgoingLight = blendSoftLight(outgoingLight, extraMatcap.rgb, uMatcapExtraBlend);
	#endif

	#ifdef USE_SHADOW
		outgoingLight = blendMultiply(outgoingLight, shadowOverlay.rgb, uShadowBlend);
	#endif

	outgoingLight = blendAdd(outgoingLight, specular, uEnvMapBlend);

	// vec3 outgoingLight = blendAdd(blendSoftLight(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend), specular, uEnvMapBlend);
	// vec3 outgoingLight = blendAdd(blendOverlay(diffuseColor.rgb, matcapColor.rgb, uDiffuseMatcapBlend), specular, uEnvMapBlend);
#else

	vec3 outgoingLight = diffuseColor.rgb;

	#ifdef USE_SHADOW
		outgoingLight = blendMultiply(outgoingLight, shadowOverlay.rgb, uShadowBlend);
	#endif

	outgoingLight = blendAdd(outgoingLight, specular, uEnvMapBlend);

#endif

gl_FragColor = vec4( outgoingLight, diffuseColor.a );