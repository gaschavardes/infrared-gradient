function svgrWebpack(config) {
	// use SVGR to import SVG files as react components
	config.module.rules.push({
		test: /\.svg$/,
		use: [
			{
				loader: '@svgr/webpack',
				options: {
					icon: true,
					expandProps: false,
					template: require('./svgr-a11y-template'),
					svgoConfig: require('./svgo.config'),
					typescript: true,
				},
			},
		],
	})
}
module.exports = {
	default: svgrWebpack,
}
