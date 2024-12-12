/*
 * WARN: a few of the plugins that are supposedly enabled by default according to svgo's doc
 * (https://nicedoc.io/svg/svgo#built-in-plugins)
 * actually needed to be explicitly added here (for example 'removeTitle')
 * so it's possible there are still some plugins that need to be added to this config file
 */
module.exports = {
	multipass: true,

	js2svg: {
		pretty: true,
		indent: '	',
	},

	plugins: [
		'collapseGroups',
		'removeDimensions',
		'removeXMLNS',
		'removeStyleElement',
		'removeScriptElement',
		'removeRasterImages',
		'removeTitle',
		'removeMetadata',
		'removeDesc',
		{
			name: 'cleanupNumericValues',
			params: {
				floatPrecision: 2,
			},
		},
		{
			name: 'convertPathData',
			params: {
				floatPrecision: 2,
			},
		},
		{
			name: 'removeViewBox',
			active: false,
		},
		{
			name: 'removeAttrs',
			params: {
				attrs: [
					'id',
					'fill',
					'stroke',
					// 'stroke-width',
					// 'fill-rule',
					// 'clip-rule',
				],
			},
		},
	],
}
